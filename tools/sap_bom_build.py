"""SAP multi-level BOM (CS03, read screen by screen) -> data/sap_bom.json and data/sap_bom_cost.json.
Usage: python3 tools/sap_bom_build.py bom/clutch_cs03_single_level.tsv,bom/ignition_cs03_single_level.tsv <MB51 receipts r2.pkl> <MB51 261 u2.pkl> <asof> data
13 Nov 2026 (Umair): rates only from SAP MB51 (or Atlas if it ever carries prices - it does not today).
Rate per base unit = MB51 receipts (101 less 102) amount / quantity over the last 180 days; if none, all receipts since
Jan 2024; if none, issues to production orders (261 less 262) over 180 days. Structure and cost are separate datasets so
that the BOM tab can show the tree to people who may not see cost."""
import sys, os, csv, json, collections
import pandas as pd
tsv, rpk, upk, asof, out = sys.argv[1:6]
# 13 Nov 2026 21:13 (Umair): more shops - tsv may be a comma list (bom/clutch_..., bom/ignition_...). Finished goods are the
# top parents (codes starting 9 that are nobody's component); their shop and name come from data/atlas_parts.json.
rows, seen = [], {}
for f in tsv.split(','):   # a sub-assembly read in two shops' files (e.g. resin sand mix) is kept once, from the first file
    for r in csv.reader(open(f), delimiter='\t'):
        if r and r[0] != 'parent' and seen.setdefault((r[0], r[2]), f) == f: rows.append(r)
bom = collections.defaultdict(lambda: collections.defaultdict(list)); desc = {}; base = {}; buom = {}
for p, pl, alt, b, bu, it, ic, c, d, q, u, a in rows:
    if u == 'CM': q, u = float(q) / 100, 'M'     # 13 Nov 23:05: airn cord is stocked and priced per metre in SAP
    bom[p][alt].append(dict(item=it, code=c, qty=float(q), uom=u, asm=a)); desc[c] = d.strip(); base[(p, alt)] = float(b); buom[p] = bu
comps = {r[7] for r in rows}
try: AP = {str(r['code']): r for r in json.load(open(os.path.join(out, 'atlas_parts.json')))}
except Exception: AP = {}
FGN = {'9010113004': 'CLUTCH ASSY CD70 GGJX (INH)', '9020113004': 'CLUTCH ASSY CG125', '9030113004': 'CLUTCH ASSY PRIDOR (INH)',
      '9030113005': 'CLUTCH ASSY PRIDOR (INH PARTS)', '9070113004': 'CLUTCH ASSY CB150F'}
# 13 Nov 22:45: inventory-only items (not in Atlas parts list) placed in the shop that makes them
XSHOP = {'6590510025': 'Polymer', '6590510030': 'Polymer', '6590510031': 'Polymer', '6590510032': 'Polymer', '9090510182': 'Polymer',
         '9010510016': 'Polymer', '9110510001': 'Polymer', '9110510002': 'Polymer', '9110510004': 'Polymer', '9120510001': 'Polymer',
         '9120510002': 'Polymer', '9010118004': 'Drum Gear', '9010410008': 'Carb Child Parts', '9190213003': 'Clutch', '6520321001': 'Piston'}
FG = {p: FGN.get(p) or (AP.get(p) or {}).get('part') or desc.get(p) or p for p in sorted(bom) if (p.startswith('9') or p in XSHOP) and p not in comps}
SHOP = {p: (AP.get(p) or {}).get('shop') or XSHOP.get(p) or ('Clutch' if p in FGN else '') for p in FG}
ALT = {('9010113004', '1'): 'In-house drive plate', ('9010113004', '2'): 'OSP drive plate', ('9010113004', '3'): 'Vendor drive plate'}
tree = []
def walk(fg, alt, p, palt, mult, lvl):
    for k in sorted(bom[p][palt], key=lambda x: x['item']):
        ext = mult * k['qty'] / base[(p, palt)]; c = k['code']; has = c in bom
        st = 'Exploded' if has else ('Raw / bought-out' if k['asm'] == 'N' or c[0] in '15' else 'Sub-levels pending')
        tree.append(dict(fg=fg, alt=alt, lvl=lvl, parent=p, item=k['item'], code=c, part=desc.get(c, ''), qty=k['qty'], uom=k['uom'], qty_fg=round(ext, 6), status=st))
        if has and lvl < 15: walk(fg, alt, c, '1', ext, lvl + 1)
for fg in FG:
    for alt in sorted(bom[fg]): walk(fg, alt, fg, alt, 1.0, 1)
fgs = [dict(fg=f, part=FG[f], shop=SHOP[f], alt=a, alt_note=ALT.get((f, a), ''), levels=max(t['lvl'] for t in tree if t['fg'] == f and t['alt'] == a),
            l1=sum(1 for t in tree if t['fg'] == f and t['alt'] == a and t['lvl'] == 1),
            pending=sorted({t['code'] for t in tree if t['fg'] == f and t['alt'] == a and t['status'] == 'Sub-levels pending'})) for f in FG for a in sorted(bom[f])]
json.dump([dict(asof=asof, source='SAP CS03, plant KHI, usage 1', shops=sorted(set(SHOP.values())), fgs=fgs, tree=tree)], open(out + '/sap_bom.json', 'w'), separators=(',', ':'))
# rates from MB51. 13 Nov 2026 14:37 (Umair): production cost carries the moving-average price SAP values issues at (261),
# not the latest supplier price on receipts. So: rate = 261/262 amount / quantity over the last 60 days (else 180 days);
# the receipt rate is kept beside it as the latest price. A KG material issued in grams in some months shows a rate ~1000x
# below its receipt rate: those issue lines are dropped, not converted.
r = pd.read_pickle(rpk); u = pd.read_pickle(upk); today = pd.Timestamp(asof)
for df in (r, u): df['Material'] = df['Material'].astype(str); df['Posting Date'] = pd.to_datetime(df['Posting Date'])
r = r[r['Posting Date'] <= today]; u = u[u['Posting Date'] <= today]
u['m'] = u['Posting Date'].dt.strftime('%Y-%m'); r['m'] = r['Posting Date'].dt.strftime('%Y-%m')
codes = sorted({t['code'] for t in tree} | set(FG))
# 13 Nov 22:30: materials the BOM carries in grams (granules, resins, magnet wire). MB51 books them in G, KG or TON depending
# on the document, so every MB51 line for them is brought to grams first, judged by its own price per unit
# (over Rs 20 a unit means it was entered in KG, over Rs 20,000 in TON). Rates for these are then per gram, matching the BOM.
GU = {k['code'] for p_ in bom for a_ in bom[p_] for k in bom[p_][a_] if k['uom'] == 'G'}
for df, ac in ((r, 'Amt.in Loc.Cur.'), (u, 'amt')):
    mk = df['Material'].isin(GU) & (df['Qty in unit of entry'] != 0)
    lr = (df.loc[mk, ac] / df.loc[mk, 'Qty in unit of entry']).abs()
    df.loc[mk, 'Qty in unit of entry'] = df.loc[mk, 'Qty in unit of entry'] * lr.map(lambda v: 1e6 if v > 20000 else 1e3 if v > 20 else 1.0)
def rt(d, qc, ac):
    q = d[qc].sum(); a = d[ac].sum()
    return (abs(a) / abs(q), d['Posting Date'].max().strftime('%Y-%m-%d'), round(abs(q), 3)) if abs(q) > 0 and abs(a) > 0 and (q > 0) == (a > 0) else None
recv = {}
for c in codes:
    x = r[r.Material == c]; d180 = today - pd.Timedelta(days=179)
    v = rt(x[x['Posting Date'] >= d180], 'Qty in unit of entry', 'Amt.in Loc.Cur.') or rt(x, 'Qty in unit of entry', 'Amt.in Loc.Cur.')
    if v: recv[c] = v
def clean_issues(y, c):
    """drop issue lines priced as grams (rate under 1/100 of the receipt rate)"""
    if c in recv and len(y):
        lr = (y['amt'] / y['Qty in unit of entry']).abs()
        y = y[~((lr > 0) & (lr < recv[c][0] / 100))]
    return y
rates = {}
for c in codes:
    y = clean_issues(u[u.Material == c], c)
    for basis, d in (('MB51 issues (261 less 262), last 60 days', y[y['Posting Date'] >= today - pd.Timedelta(days=59)]),
                     ('MB51 issues (261 less 262), last 180 days', y[y['Posting Date'] >= today - pd.Timedelta(days=179)])):
        v = rt(d, 'Qty in unit of entry', 'amt')
        if v: rates[c] = dict(rate=round(v[0], 4), basis=basis, last=v[1]); break
    if c not in rates and c in recv: rates[c] = dict(rate=round(recv[c][0], 4), basis='MB51 receipts (no issues to production in 180 days)', last=recv[c][1])
    # 13 Nov 22:40: carburetor kit parts (3xxx) are issued at Rs 0 and never received through MB51 101 - SAP carries them at no
    # value, so they are rated 0 (shown as such) rather than left blank
    if c not in rates and c not in recv:
        y0 = u[(u.Material == c) & u['Movement Type'].astype(str).isin(['261', '262'])]
        if len(y0) and float(y0['amt'].abs().sum()) == 0:
            rates[c] = dict(rate=0.0, basis='SAP issues it at Rs 0 (no MB51 receipt value) - kit part carried at no cost', last=y0['Posting Date'].max().strftime('%Y-%m-%d'))
    if c in recv and c in rates:
        rates[c]['rate_rcv'] = round(recv[c][0], 4); rates[c]['rcv_last'] = recv[c][1]
cost = []
for f in fgs:
    t1 = [t for t in tree if t['fg'] == f['fg'] and t['alt'] == f['alt'] and t['lvl'] == 1]
    lines = [dict(code=t['code'], part=t['part'], qty_fg=t['qty_fg'], v=round(t['qty_fg'] * rates[t['code']]['rate'], 2) if t['code'] in rates else None,
                  v_rcv=round(t['qty_fg'] * rates[t['code']].get('rate_rcv', rates[t['code']]['rate']), 2) if t['code'] in rates else None) for t in t1]
    cost.append(dict(fg=f['fg'], alt=f['alt'], mat_unit=round(sum(l['v'] or 0 for l in lines), 2), mat_unit_rcv=round(sum(l['v_rcv'] or 0 for l in lines), 2),
                     lines=sorted(lines, key=lambda l: -(l['v'] or 0)), missing=[l['code'] for l in lines if l['v'] is None]))
# monthly usage at level 1: standard = FG output (MB51 101 less 102 of the FG) x BOM qty; actual = 261 less 262 of the component.
# CD70's three BOM alternatives are weighted by that month's issues of the three drive plates (in-house 6510213002, OSP 6510213012, vendor 6510213011).
DP = {'1': '6510213002', '2': '6510213012', '3': '6510213011'}
usage = {}
for SH_ in sorted(set(SHOP.values())):
  FGS = [f for f in FG if SHOP[f] == SH_]; usage[SH_] = {}
  for M in sorted(m for m in u['m'].unique() if m >= '2026-06'):
      units = {f: float(r[(r.Material == f) & (r.m == M)]['Qty in unit of entry'].sum()) for f in FGS}
      dq = {a: -float(u[(u.Material == c) & (u.m == M)]['Qty in unit of entry'].sum()) for a, c in DP.items()}; tq = sum(max(0, v) for v in dq.values())
      w = {a: (max(0, v) / tq if tq else (1.0 if a == '1' else 0.0)) for a, v in dq.items()}
      std = collections.Counter()
      for t in tree:
          # other finished goods with several alternatives (carburetor CD70 / CG125, case air cleaner) are split evenly across them
          if t['lvl'] == 1 and t['fg'] in units: std[t['code']] += units[t['fg']] * t['qty_fg'] * (w[t['alt']] if t['fg'] == '9010113004' else 1 / len(bom[t['fg']]))
      lines = []
      for c, sq in std.items():
          y = clean_issues(u[(u.Material == c) & (u.m == M)], c); aq = -float(y['Qty in unit of entry'].sum()); aa = -float(y['amt'].sum())
          mr = aa / aq if aq > 0 and aa > 0 else (rates.get(c) or {}).get('rate')
          lines.append([c, round(sq, 3), round(aq, 3), round(mr, 4) if mr else None])
      usage[SH_][M] = dict(units={k: round(v) for k, v in units.items()}, alt_w={k: round(v, 3) for k, v in w.items()}, lines=lines)
json.dump([dict(asof=asof, mb51_to=str(u['Posting Date'].max().date()), rule='Moving-average price SAP issues at: MB51 261 less 262 amount / quantity, last 60 days (else 180); receipt rate kept as latest supplier price',
                rates=rates, fg_cost=cost, usage=usage)], open(out + '/sap_bom_cost.json', 'w'), separators=(',', ':'))
print(len(tree), 'tree rows;', len(rates), 'of', len(codes), 'codes rated')
for cst in cost: print(cst['fg'], cst['alt'], cst['mat_unit'], cst['mat_unit_rcv'], cst['missing'])
for M, x in [(sh + ' ' + m, v) for sh, d in usage.items() for m, v in d.items()]:
    sv = sum(l[1] * (l[3] or 0) for l in x['lines']); av = sum(l[2] * (l[3] or 0) for l in x['lines']); print(M, x['units'], round(sv / 1e6, 1), round(av / 1e6, 1))
