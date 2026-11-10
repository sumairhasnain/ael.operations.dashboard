#!/usr/bin/env python3
"""OSP vendor receipts from MB51 (Umair, 10 Nov 2026).

Alsons' OSP carburetor child parts (30-series codes, vendor mapped in Atlas's OSP list) are booked in SAP
as movement type 501 (receipt without PO) into store 0015, with no supplier on the line:
  * 501 lines whose Reference is an Alsons delivery number (short numbers such as 14784, 14791)
    = Alsons supply, counted in full. Nothing is subtracted for in-house production.
  * 501 lines whose Reference is an 8-digit 8xxxxxxx number (e.g. 80265304) = in-house production
    supplied to the shop, NOT vendor supply (left out).
  * 502 reverses a 501 with the same reference rule.
Exception (Oct, Nov, Dec 2026 only): Screw Drain C12 (3090410005) also comes from Faraz Industries,
received in SAP as 101 on 6010410020 from vendor 100375. Those receipts are shown on 3090410005 as
Faraz supply for those three months only.

Receipts only ever go UP: each (date, vendor, code) keeps the higher of the dashboard's figure and MB51's.

usage: osp_alsons.py <mb51 dump> <plan_dump.txt> <atlas_vendor_supply.json (rewritten)> [r.pkl history]
"""
import collections, json, re, sys

FARAZ_SRC, FARAZ_TO, FARAZ_V = '6010410020', '3090410005', '100375'
FARAZ_MONTHS = ('2026-10', '2026-11', '2026-12')
INHOUSE_REF = re.compile(r'^8\d{7}$')
OSP_501_VENDORS = {'100022'}   # vendors whose 501 deliveries count (Umair confirmed Alsons, 10 Nov); add others only on his word


def main(mb51_p, plan_p, vs_p, hist_p=None):
    st = lambda c: str(c).strip().lstrip('0')
    sec, osp, vname, shop = None, {}, {}, {}
    for ln in open(plan_p, encoding='utf-8').read().split('\n'):
        if ln.startswith('##'): sec = ln; continue
        f = ln.split('|')
        if sec == '##OSP' and len(f) >= 2: osp[st(f[0])] = st(f[1])
        elif sec == '##V' and len(f) >= 2: vname[st(f[0])] = f[1]
        elif sec == '##PARTS' and len(f) >= 2: shop[st(f[0])] = f[1]

    got = collections.defaultdict(float)          # (date, vendor code, code) -> qty
    skipped_inhouse, no_ref, has_ref_col, month = 0.0, 0.0, False, ''
    for ln in open(mb51_p, encoding='utf-8').read().split('\n'):
        if ln.startswith('month='): month = ln[6:13]
        if ln.startswith('cols=') and ln.rstrip().endswith('|Ref'): has_ref_col = True
        f = ln.split('|')
        if len(f) < 11 or ln.startswith(('@@', 'file=', 'month=', 'cols=')): continue
        code, mt, d = st(f[0]), f[7], f[3]
        try: q = float(f[2] or 0)
        except ValueError: continue
        if mt in ('501', '502') and osp.get(code) in OSP_501_VENDORS:
            ref = f[11].strip() if len(f) > 11 else ''
            s = q if mt == '501' else -abs(q)
            if INHOUSE_REF.match(ref): skipped_inhouse += s; continue
            if not ref: no_ref += s; continue
            got[(d, osp[code], code)] += s
        elif mt in ('101', '102') and code == FARAZ_SRC and st(f[6]) == FARAZ_V and d[:7] in FARAZ_MONTHS:
            got[(d, FARAZ_V, FARAZ_TO)] += q if mt == '101' else -abs(q)
    if not has_ref_col:
        print('NO_REF_COLUMN: MB51 dump has no Reference column (update ops/mb51 extract_js); 501 receipts not split'); return 2

    # earlier Faraz months from the receiving history (the daily file holds only the current month)
    if hist_p:
        import pandas as pd
        r = pd.read_pickle(hist_p)
        m = r['Material'].astype(str).str.lstrip('0'); sp = r['Supplier'].astype(str).str.lstrip('0')
        x = r[(m == FARAZ_SRC) & (sp == FARAZ_V)].copy()
        x['d'] = pd.to_datetime(x['Posting Date']).dt.strftime('%Y-%m-%d')
        for _, row in x.iterrows():
            if row['d'][:7] in FARAZ_MONTHS and row['d'][:7] != month:
                q = float(row['Qty in unit of entry'] or 0)
                got[(row['d'], FARAZ_V, FARAZ_TO)] += q if str(row['Movement Type']) == '101' else -abs(q)

    vs = json.load(open(vs_p))
    idx = {(r['date'], r['vendor'], str(r['code'])): r for r in vs}
    added = changed = 0; tot = collections.defaultdict(float)
    for (d, v, c), q in sorted(got.items()):
        q = round(q)
        name = vname.get(v, v)
        tot[(d[:7], name, c)] += q
        r = idx.get((d, name, c))
        if r is None:
            r = dict(date=d, vendor=name, code=c, shop=shop.get(c, 'Carburetor'), received=0, scheduled=0)
            vs.append(r); idx[(d, name, c)] = r; added += 1
        if q > (r.get('received') or 0):
            r['received'] = q; changed += 1
        r['received_sap'] = r['received']      # nothing subtracted for in-house: these are pure vendor deliveries
    json.dump(vs, open(vs_p, 'w'), ensure_ascii=False, separators=(',', ':'))   # same compact layout and row order as vsup_build
    print(json.dumps(dict(month=month, rows_added=added, rows_raised=changed, inhouse_501_left_out=round(skipped_inhouse),
                          no_reference_left_out=round(no_ref),
                          totals={f'{k[0]} {k[1]} {k[2]}': v for k, v in sorted(tot.items())})))
    return 0


if __name__ == '__main__':
    sys.exit(main(*sys.argv[1:5]))
