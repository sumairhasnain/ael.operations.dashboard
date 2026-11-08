"""In-house production of BOM level parts that Atlas does not report (Umair, 8 Nov 2026).
Some level parts are both bought and made in-house under one code, e.g. 6530010066 Clutch Center with Boss CG125
Machined: M.A.K / Tecno Pack supply it machined, and the clutch shop machines Dawood / MBI castings (6090213003)
into the same code. Atlas has no production line for it, so the in-house part comes from MB51: movement 101 (less 102)
with no supplier and a non-zero value = goods receipt from a production order.

tools/sap_transit.py calls inhouse() for every MB51 dump it reads and stores the result per month as
sap_transit.months[<YYYY-MM>].inhouse = [[date, code, qty], ...] (so the MB51 daily task keeps it current with no extra step).
The dashboard's "Finished Part vs Level 2 & 3 Components" chart adds it to the level part's line.

Standalone check: python3 sap_inhouse.py <mb51 dump .txt> [<data dir>]
"""
import json, os, sys
from collections import defaultdict

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')

def level_codes(data_dir=DATA):
    """BOM level codes that Atlas has no production for (not in atlas_parts_daily)."""
    bom = json.load(open(os.path.join(data_dir, 'atlas_bom.json')))
    in_atlas = {str(r['code']) for r in json.load(open(os.path.join(data_dir, 'atlas_parts_daily.json')))}
    return {str(b['code']) for b in bom if b.get('level')} - in_atlas

def inhouse(dump, codes):
    """{month: [[date, code, qty], ...]} from an '@@MB51' dump."""
    hdr, agg, months = {}, defaultdict(float), set()
    for line in open(dump, errors='ignore'):
        line = line.rstrip('\n')
        if line.startswith('cols='):
            hdr = {k: i for i, k in enumerate(line[5:].split('|'))}; continue
        if not hdr or '|' not in line: continue
        p = line.split('|')
        if len(p) < len(hdr): continue
        d = p[hdr['PostDate']]
        if len(d) >= 7: months.add(d[:7])
        c, mt = p[hdr['Material']], p[hdr['MT']]
        if c not in codes or mt not in ('101', '102') or p[hdr['Supplier']].strip(): continue
        try: q, a = float(p[hdr['Qty']]), float(p[hdr['Amt']] or 0)
        except ValueError: continue
        if a == 0: continue  # zero-value receipts are not production
        agg[(d, c)] += q
    out = {m: [] for m in months}
    for (d, c), q in sorted(agg.items()):
        if q: out[d[:7]].append([d, c, round(q, 3)])
    return out

if __name__ == '__main__':
    r = inhouse(sys.argv[1], level_codes(sys.argv[2] if len(sys.argv) > 2 else DATA))
    tot = defaultdict(float)
    for rows in r.values():
        for d, c, q in rows: tot[c] += q
    print(json.dumps({'months': sorted(r), 'codes_made': {c: round(q) for c, q in sorted(tot.items())}}))
