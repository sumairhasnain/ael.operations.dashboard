"""SAP multi-level BOM (CS03, read screen by screen) -> data/sap_bom.json and data/sap_bom_cost.json.
Usage: python3 tools/sap_bom_build.py bom/clutch_cs03_single_level.tsv <MB51 receipts r2.pkl> <MB51 261 u2.pkl> <asof> data
13 Nov 2026 (Umair): rates only from SAP MB51 (or Atlas if it ever carries prices - it does not today).
Rate per base unit = MB51 receipts (101 less 102) amount / quantity over the last 180 days; if none, all receipts since
Jan 2024; if none, issues to production orders (261 less 262) over 180 days. Structure and cost are separate datasets so
that the BOM tab can show the tree to people who may not see cost."""
import sys, csv, json, collections
import pandas as pd
tsv, rpk, upk, asof, out = sys.argv[1:6]
rows = [r for r in csv.reader(open(tsv), delimiter='\t') if r and r[0] != 'parent']
bom = collections.defaultdict(lambda: collections.defaultdict(list)); desc = {}; base = {}; buom = {}
for p, pl, alt, b, bu, it, ic, c, d, q, u, a in rows:
    bom[p][alt].append(dict(item=it, code=c, qty=float(q), uom=u, asm=a)); desc[c] = d.strip(); base[(p, alt)] = float(b); buom[p] = bu
FG = {'9010113004': 'CLUTCH ASSY CD70 GGJX (INH)', '9020113004': 'CLUTCH ASSY CG125', '9030113004': 'CLUTCH ASSY PRIDOR (INH)',
      '9030113005': 'CLUTCH ASSY PRIDOR (INH PARTS)', '9070113004': 'CLUTCH ASSY CB150F'}
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
fgs = [dict(fg=f, part=FG[f], alt=a, alt_note=ALT.get((f, a), ''), levels=max(t['lvl'] for t in tree if t['fg'] == f and t['alt'] == a),
            l1=sum(1 for t in tree if t['fg'] == f and t['alt'] == a and t['lvl'] == 1),
            pending=sorted({t['code'] for t in tree if t['fg'] == f and t['alt'] == a and t['status'] == 'Sub-levels pending'})) for f in FG for a in sorted(bom[f])]
json.dump([dict(asof=asof, source='SAP CS03, plant KHI, usage 1', fgs=fgs, tree=tree)], open(out + '/sap_bom.json', 'w'), separators=(',', ':'))
# rates from MB51
r = pd.read_pickle(rpk); u = pd.read_pickle(upk); today = pd.Timestamp(asof)
for df in (r, u): df['Material'] = df['Material'].astype(str); df['Posting Date'] = pd.to_datetime(df['Posting Date'])
r = r[r['Posting Date'] <= today]; u = u[u['Posting Date'] <= today]
codes = sorted({t['code'] for t in tree} | set(FG))
rates = {}
def rt(d, qc, ac):
    q = d[qc].sum(); a = d[ac].sum()
    return (abs(a) / abs(q), d['Posting Date'].max().strftime('%Y-%m-%d'), round(abs(q), 3)) if abs(q) > 0 and abs(a) > 0 and (q > 0) == (a > 0) else None
for c in codes:
    x = r[r.Material == c]; y = u[u.Material == c]; d180 = today - pd.Timedelta(days=179)
    for basis, d, qc, ac in (('MB51 receipts, last 180 days', x[x['Posting Date'] >= d180], 'Qty in unit of entry', 'Amt.in Loc.Cur.'),
                             ('MB51 receipts since Jan 2024', x, 'Qty in unit of entry', 'Amt.in Loc.Cur.'),
                             ('MB51 issues to production (261), last 180 days', y[y['Posting Date'] >= d180], 'Qty in unit of entry', 'amt')):
        v = rt(d, qc, ac)
        if v: rates[c] = dict(rate=round(v[0], 4), basis=basis, last=v[1], qty=v[2]); break
    iv = rt(y[y['Posting Date'] >= d180], 'Qty in unit of entry', 'amt')
    if c in rates and iv:
        rates[c]['rate_261'] = round(iv[0], 4); g = rates[c]['rate'] / iv[0]
        # a KG item issued in grams shows ~1000x apart: a unit difference, not a price difference
        if 0.75 <= g <= 1.33 or 600 <= g <= 1700: pass
        else: rates[c]['check'] = f"MB51 receipt rate {rates[c]['rate']:,.2f} vs issue (261) rate {iv[0]:,.2f}"
# unit check: a KG item whose 261 rate is ~1000x below its receipt rate was issued in grams; receipts are used, so nothing to fix
cost = []
for f in fgs:
    t1 = [t for t in tree if t['fg'] == f['fg'] and t['alt'] == f['alt'] and t['lvl'] == 1]
    lines = [dict(code=t['code'], qty_fg=t['qty_fg'], rate=(rates.get(t['code']) or {}).get('rate')) for t in t1]
    mat = sum(l['qty_fg'] * l['rate'] for l in lines if l['rate'] is not None)
    cost.append(dict(fg=f['fg'], alt=f['alt'], mat_unit=round(mat, 2), missing=[l['code'] for l in lines if l['rate'] is None]))
json.dump([dict(asof=asof, rule='MB51 receipts (101 less 102) amount / quantity, last 180 days; else all receipts since Jan 2024; else 261 issues', rates=rates, fg_cost=cost)],
          open(out + '/sap_bom_cost.json', 'w'), separators=(',', ':'))
print(len(tree), 'tree rows;', len(rates), 'of', len(codes), 'codes rated')
for cst in cost: print(cst)
miss = [c for c in codes if c not in rates]; print('no MB51 rate:', miss)
