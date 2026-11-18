"""Purchasing tab (18 Nov 2026, Umair): ME5A purchase requisitions + SAP MB51 receipts + MB52 stock -> me5a.json.

Usage: python3 me5a_build.py <dir with ME5A dumps *.txt> <sap_stock.json> <r.pkl (MB51 101/102 history)> <out me5a.json> [asof YYYY-MM-DD]

ME5A dumps are '@@ME5A' pipe text made in the browser from SharePoint Portal Data/ME5A (Nov,2026.xlsx and Old Data/*.xlsx); one
line per PR item, columns found by header name. The 2023 workbook has no text columns (only numbers survived) so it is not used.

Rules (all on the item reference, i.e. SAP material code, plants KHI + SKP; ATDMC plant MDP is kept out like the Inventory tab):
- PR pending = processing status N (no PO yet), not deleted. 'Awaiting release' = release indicator X; otherwise released.
- PO raised = status B. Received against a PO line is worked out first-in-first-out per material: MB51 101 less 102 receipts are
  given to the oldest PO line of that material whose PO date is on or before the receipt date. The rest is 'delivery awaited'.
  (MB51 carries no PO number, so this is an estimate; a PO line counts as delivered once 98% of it is covered.)
- Framework (FO) requisitions are blanket orders and are left out of lead times.
- Lead time per item = median days from PO date to the receipt that completed the PO line (history since Jan 2024); if the item
  never completed a PO, the median of its category is used. PR approval time = release date - PR date; PR-to-PO time = PO date -
  release date.
- Use rate = sap_stock use_month (6-month issues). Reorder point = daily use x lead time x 1.5. Order-up-to = daily use x (lead
  time + category days target: Tools 60, Consumables 45, Spares 180, Lubricants 45, Raw Material 30). Items whose stock + open PR
  + open PO is below the reorder point are short; the proposed PR qty brings them up to the order-up-to level (not for Raw
  Material, as asked).
- Excess on order = open PR + open PO quantity above what the order-up-to level needs (all of it when there is no use in 6 months).
- Price history = monthly receipt price (MB51 101 amount / qty) per item, PKR per unit.
"""
import sys, os, re, json, glob, pickle, collections, datetime as dt
import pandas as pd

SRC, STK, RPK, OUT = sys.argv[1:5]
ASOF = sys.argv[5] if len(sys.argv) > 5 else dt.date.today().isoformat()
TODAY = pd.Timestamp(ASOF)
CATS = ('Tools', 'Consumables', 'Spares', 'Lubricants', 'Raw Material')
TARGET = {'Tools': 60, 'Consumables': 45, 'Spares': 180, 'Lubricants': 45, 'Raw Material': 30}

# ---------------- ME5A ----------------
fr = []
for f in sorted(glob.glob(os.path.join(SRC, '*.txt'))):
    L = open(f, encoding='utf-8').read().split('\n')
    if not L or not L[0].startswith('@@ME5A'): continue
    cols = [l for l in L[:4] if l.startswith('cols=')][0][5:].split('|')
    body = [l.split('|') for l in L if l and not l.startswith(('@@', 'file=', 'cols='))]
    x = pd.DataFrame([b for b in body if len(b) == len(cols)], columns=cols); x['src'] = os.path.basename(f); fr.append(x)
d = pd.concat(fr, ignore_index=True)
d = d[d['Purchase Requisition'] != ''].copy()
d['key'] = d['Purchase Requisition'] + '-' + d['Item of requisition']
d = d.drop_duplicates('key', keep='first')
xl = lambda s: pd.to_datetime(pd.to_numeric(s, errors='coerce'), unit='D', origin='1899-12-30')
d['prd'] = xl(d['Requisition date']); d['rel'] = xl(d['Release Date']); d['pod'] = xl(d['Purchase Order Date'])
d['deld'] = pd.to_datetime(d['Delivery Date'], format='%Y%m%d', errors='coerce')
num = lambda c: pd.to_numeric(d[c].str.replace(',', ''), errors='coerce').fillna(0)
d['qty'] = num('Quantity requested'); d['qord'] = num('Quantity ordered'); d['vprice'] = num('Valuation Price') / num('Price Unit').replace(0, 1)
d['val'] = num('Total Value'); d['plt'] = num('Planned Deliv. Time')
d['code'] = d['Material'].str.strip()
d['del'] = d['Deletion Indicator'].eq('true')
d['st'] = d['Processing status']
lines_all = len(d)
mdp = d['Plant'].eq('MDP')
d = d[~mdp & ~d['del']].copy()

# ---------------- stock (item reference) ----------------
S = json.load(open(STK))
items = {}
for r in S:
    c = str(r.get('code') or '').strip()
    if not c or r.get('category') not in CATS: continue
    o = items.setdefault(c, {'code': c, 'part': r.get('part') or '', 'cat': r['category'], 'uom': r.get('uom') or '', 'shop': r.get('shop') or '',
                             'stock': 0.0, 'value': 0.0, 'unit': r.get('unit_pkr'), 'use_month': r.get('use_month') or 0, 'cover_days': r.get('cover_days'),
                             'excess_pkr': 0, 'last_rcv': r.get('last_rcv'), 'last_issue': r.get('last_issue')})
    o['stock'] += float(r.get('stock') or 0); o['value'] += float(r.get('value_pkr') or 0); o['excess_pkr'] += float(r.get('excess_pkr') or 0)
    if not o['unit'] and r.get('unit_pkr'): o['unit'] = r['unit_pkr']
dm = d[d['code'].isin(items)].copy()

# ---------------- MB51 receipts ----------------
R = pickle.load(open(RPK, 'rb'))
R = R[R['Movement Type'].astype(str).isin(['101', '102'])].copy()
R['code'] = R['Material'].astype(str).str.strip(); R = R[R['code'].isin(items)]
R['q'] = pd.to_numeric(R['Qty in unit of entry'], errors='coerce').fillna(0); R['a'] = pd.to_numeric(R['Amt.in Loc.Cur.'], errors='coerce').fillna(0)
R['dte'] = pd.to_datetime(R['Posting Date'])
R['sup'] = R['Supplier'].fillna('').astype(str).str.lstrip('0')

# FIFO receipts -> PO lines
po = dm[(dm['st'] == 'B') & (dm['qord'] > 0) & dm['pod'].notna()].sort_values(['code', 'pod', 'key']).copy()
po['got'] = 0.0; po['done'] = pd.NaT; po['first'] = pd.NaT
pidx = {c: list(g.index) for c, g in po.groupby('code')}
for c, g in R.sort_values('dte').groupby('code'):
    ids = pidx.get(c)
    if not ids: continue
    for _, rr in g.iterrows():
        q = rr['q']
        if q <= 0: continue   # reversals (102) are small next to receipts; ignored in the allocation
        for i in ids:
            if q <= 0: break
            if po.at[i, 'pod'] > rr['dte']: break
            need = po.at[i, 'qord'] - po.at[i, 'got']
            if need <= 1e-9: continue
            take = min(need, q); po.at[i, 'got'] += take; q -= take
            if pd.isna(po.at[i, 'first']): po.at[i, 'first'] = rr['dte']
            if po.at[i, 'got'] >= 0.98 * po.at[i, 'qord'] and pd.isna(po.at[i, 'done']): po.at[i, 'done'] = rr['dte']
po['open'] = (po['qord'] - po['got']).clip(lower=0)
po.loc[po['got'] >= 0.98 * po['qord'], 'open'] = 0
po['lt'] = (po['done'] - po['pod']).dt.days
po.loc[po['Document Type'] == 'FO', 'lt'] = None   # framework (blanket) requisitions run for months: not a lead time
# an open PO line older than 6 months is most likely short-closed or received under another code/unit: listed apart as 'over 6 months'
po['stale'] = (po['open'] > 0) & ((TODAY - po['pod']).dt.days > 183)

# lead times
lt_ok = po.dropna(subset=['lt']); lt_ok = lt_ok[lt_ok['lt'] <= 365]   # a 'lead time' over a year is a matching artefact
lt_item = lt_ok.groupby('code')['lt'].median()
cat_of = {c: o['cat'] for c, o in items.items()}
po['cat'] = po['code'].map(cat_of)
lt_ok = lt_ok.assign(cat=lt_ok['code'].map(cat_of))
lt_cat = lt_ok.groupby('cat')['lt'].median().to_dict()
dm['appr'] = (dm['rel'] - dm['prd']).dt.days
dm['p2o'] = (dm['pod'] - dm['rel']).dt.days

# ---------------- per item ----------------
pend = dm[dm['st'] == 'N']
OUTI = []
for c, o in items.items():
    pe = pend[pend['code'] == c]; pp = po[po['code'] == c]; op = pp[(pp['open'] > 0) & ~pp['stale']]
    hist = dm[dm['code'] == c]
    lt = lt_item.get(c); lt_src = 'history'
    if lt is None or pd.isna(lt):
        pl = hist['plt'][hist['plt'] > 0]
        if len(pl): lt, lt_src = float(pl.median()), 'planned'
        else: lt, lt_src = float(lt_cat.get(o['cat'], 30)), 'category'
    lt = max(1.0, float(lt))
    du = (o['use_month'] or 0) / 30.4
    pr_q = float(pe['qty'].sum()); po_q = float(op['open'].sum()); pipe = pr_q + po_q
    tgt = TARGET.get(o['cat'], 45); rop = du * lt * 1.5; upto = du * (lt + tgt)
    short = du > 0 and o['stock'] + pipe < rop
    bought = len(hist) > 0   # only items bought through PRs since Jan 2024 get a proposal (finished oils sold to AHL etc. are not bought this way)
    prop = max(0.0, upto - o['stock'] - pipe) if short and bought and o['cat'] != 'Raw Material' else 0.0
    exc = (pipe if du == 0 else max(0.0, o['stock'] + pipe - upto)) if pipe > 0 else 0.0
    exc = min(exc, pipe)
    cover = (o['stock'] / du) if du > 0 else None
    ap = hist['appr'].dropna(); p2 = hist[hist['st'] == 'B']['p2o'].dropna(); lts = pp['lt'].dropna(); lts = lts[lts <= 365]
    if not (len(hist) or o['stock'] > 0): continue
    # price history: monthly receipt price
    rr = R[(R['code'] == c) & (R['q'] > 0) & (R['a'] > 0)]
    ph = []
    if len(rr):
        g = rr.groupby(rr['dte'].dt.strftime('%Y-%m')).agg(q=('q', 'sum'), a=('a', 'sum'))
        ph = [[m, round(a / q, 2)] for m, (q, a) in g.iterrows() if q > 0]
    sups = rr.groupby('sup')['a'].sum().sort_values(ascending=False).head(3).index.tolist() if len(rr) else []
    det = []
    for _, h in hist.sort_values('prd', ascending=False).head(8).iterrows():
        pr_ = pp[pp['key'] == h['key']]
        det.append({'pr': h['Purchase Requisition'], 'it': h['Item of requisition'], 'd': h['prd'].strftime('%Y-%m-%d') if pd.notna(h['prd']) else None,
                    'rel': h['rel'].strftime('%Y-%m-%d') if pd.notna(h['rel']) else None, 'q': h['qty'], 'st': h['st'],
                    'po': h['Purchase order'] or None, 'pod': h['pod'].strftime('%Y-%m-%d') if pd.notna(h['pod']) else None,
                    'qo': h['qord'] or None, 'got': round(float(pr_['got'].iloc[0]), 2) if len(pr_) else None,
                    'done': pr_['done'].iloc[0].strftime('%Y-%m-%d') if len(pr_) and pd.notna(pr_['done'].iloc[0]) else None,
                    'by': h['Requisitioner'], 'sup': h['Name of Supplier'] or h['Name of Desired Supplier'] or None, 'rx': h['Release indicator'] == 'X'})
    OUTI.append({'code': c, 'part': o['part'], 'cat': o['cat'], 'uom': o['uom'], 'shop': o['shop'], 'stock': round(o['stock'], 2), 'value': round(o['value']),
                 'unit': o['unit'], 'use_month': round(o['use_month'] or 0, 2), 'cover': round(cover) if cover is not None else None,
                 'lt': round(lt), 'lt_src': lt_src, 'lt_n': int(len(lts)), 'appr': round(float(ap.median()), 1) if len(ap) else None,
                 'p2o': round(float(p2.median()), 1) if len(p2) else None, 'prs': int(len(hist)),
                 'pr_open': round(pr_q, 2), 'pr_open_n': int(len(pe)), 'pr_open_rx': int((pe['Release indicator'] == 'X').sum()),
                 'pr_oldest': int((TODAY - pe['prd'].min()).days) if len(pe) else None,
                 'po_open': round(po_q, 2), 'po_open_n': int(len(op)), 'po_next': op['deld'].min().strftime('%Y-%m-%d') if len(op) and pd.notna(op['deld'].min()) else None,
                 'po_late': int((op['deld'] < TODAY).sum()) if len(op) else 0,
                 'bought': bool(bought), 'fo': int((hist['Document Type'] == 'FO').sum()), 'rop': round(rop, 2), 'upto': round(upto, 2), 'short': bool(short), 'prop': round(prop, 2), 'excess_q': round(exc, 2),
                 'excess_v': round(exc * (o['unit'] or 0)), 'price': ph, 'sups': sups, 'det': det})

# ---------------- open lines (pending PRs, open POs) ----------------
def L(h, kind, extra):
    return {'kind': kind, 'pr': h['Purchase Requisition'], 'it': h['Item of requisition'], 'code': h['code'] or None, 'txt': h['Short Text'],
            'cat': cat_of.get(h['code']) or ('No material code' if not h['code'] else 'Other'), 'q': h['qty'], 'uom': h['Unit of Measure'],
            'd': h['prd'].strftime('%Y-%m-%d') if pd.notna(h['prd']) else None, 'rel': h['rel'].strftime('%Y-%m-%d') if pd.notna(h['rel']) else None,
            'age': int((TODAY - h['prd']).days) if pd.notna(h['prd']) else None, 'by': h['Requisitioner'], 'grp': h['Purchasing Group'],
            'val': round(float(h['val'])), 'plant': h['Plant'], 'sup': h['Name of Supplier'] or h['Name of Desired Supplier'] or None, **extra}
PL = []
for _, h in d[d['st'] == 'N'].iterrows():
    PL.append(L(h, 'pr', {'rx': h['Release indicator'] == 'X'}))
for i, h in po[(po['open'] > 0)].iterrows():
    PL.append(L(h, 'po', {'po': h['Purchase order'], 'pod': h['pod'].strftime('%Y-%m-%d'), 'qo': h['qord'], 'got': round(float(h['got']), 2), 'open': round(float(h['open']), 2),
                          'deld': h['deld'].strftime('%Y-%m-%d') if pd.notna(h['deld']) else None, 'late': int((TODAY - h['deld']).days) if pd.notna(h['deld']) and h['deld'] < TODAY else 0,
                          'stale': bool(h['stale']), 'open_v': round(float(h['open'] * h['vprice']))}))

# monthly processing KPIs (all lines with a material, KHI+SKP)
mk = []
for m, g in dm.groupby(dm['prd'].dt.strftime('%Y-%m')):
    b = g[g['st'] == 'B']
    pm = po[po['pod'].dt.strftime('%Y-%m') == m]
    mk.append({'m': m, 'prs': int(len(g)), 'po': int(len(b)), 'appr': round(float(g['appr'].dropna().median()), 1) if g['appr'].notna().any() else None,
               'p2o': round(float(b['p2o'].dropna().median()), 1) if b['p2o'].notna().any() else None,
               'lt': round(float(pm['lt'].dropna().median()), 1) if pm['lt'].notna().any() else None, 'val': round(float(g['val'].sum()))})

out = {'asof': ASOF, 'files': sorted(d['src'].unique().tolist()), 'lines_all': lines_all, 'lines_mdp': int(mdp.sum()),
       'lt_cat': {k: round(v) for k, v in lt_cat.items()}, 'targets': TARGET, 'items': OUTI, 'open': PL, 'monthly': mk}
json.dump([out], open(OUT, 'w'), separators=(',', ':'), default=lambda x: None if pd.isna(x) else (float(x) if hasattr(x, '__float__') else str(x)))
k = lambda f: sum(1 for i in OUTI if f(i))
print(json.dumps({'items': len(OUTI), 'short': k(lambda i: i['short']), 'prop': k(lambda i: i['prop'] > 0), 'excess': k(lambda i: i['excess_q'] > 0),
                  'excess_v_m': round(sum(i['excess_v'] for i in OUTI) / 1e6, 1), 'pr_pending': sum(1 for l in PL if l['kind'] == 'pr'),
                  'po_open': sum(1 for l in PL if l['kind'] == 'po'), 'lt_cat': out['lt_cat'], 'size_kb': round(os.path.getsize(OUT) / 1024)}))
