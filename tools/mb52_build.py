"""Stock frame from the daily SAP MB52 file (SharePoint Portal Data/MB52; Umair, 5 Nov 2026).
Usage: python3 mb52_build.py <mb52 dump .txt> <s.pkl> <r.pkl> <out s2.pkl> [<prev atlas_part_stock.json> <prev atlas_child_stock.json> <out mb52_parts.json>]

The dump is '@@MB52' pipe text from tools/mb52_extract.js: Plant|Sloc|Group|Material|Desc|UoM|Unr|QI|Transit|Blocked|MatType|SlocName,
both plants (KHI, SKP), only lines holding stock. Atlas's stock feed counts every storage location at both plants except the
rejection stores (KHI 0009 AAL Rej., KHI 0012 Rej. Store, SKP 0007 Rejection Store, SKP 0012); fitted 5 Nov against Atlas's own
feed: 12,372 of 12,801 codes exact, the rest are parts that moved between the two snapshots. The same rule is applied here. The daily MB52 export carries quantities but no value, so each line is valued at:
the unit value in the reference MB52 (s.pkl, Umair's 27 Oct export with values), else 0 (listed as no_price) - the same basis the
dashboard used with the Atlas stock feed. Receipt prices are NOT used: many receipts are entered in a different unit from the base
unit (e.g. CEMEDINE 575F received in KG against a base unit of G), which would inflate values a thousandfold.
Writes the same columns make_inv.py reads (s.pkl layout) and prints a summary."""
import sys, json, html, pandas as pd

EXCLUDE = {('KHI', '0009'), ('KHI', '0012'), ('SKP', '0007'), ('SKP', '0012')}   # rejection stores, not counted by Atlas

def read(p):
    raw = open(p, encoding='utf-8').read()
    if not raw.startswith('@@MB52'):
        try: t = json.loads(raw)[0]['text']
        except Exception: t = raw
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
        raw = t
    raw = raw.rstrip('#'); head = {}; rows = []
    for ln in raw.split('\n'):
        if ln.startswith(('@@', 'cols=')): continue
        if '=' in ln and '|' not in ln: k, v = ln.split('=', 1); head[k] = v; continue
        f = [html.unescape(x) for x in ln.split('|')]   # the sheet XML escapes & < > ('C &amp; A' -> 'C & A')
        if len(f) < 10: continue
        if (f[0], f[1]) in EXCLUDE: continue
        rows.append(dict(Plant=f[0], **{'Storage Location': f[1], 'Material Group': f[2], 'Material': f[3].strip(), 'Material Description': f[4],
                    'Base Unit of Measure': f[5], 'Unrestricted': float(f[6] or 0), 'Quality Inspection': float(f[7] or 0),
                    'Transit and Transfer': float(f[8] or 0), 'Blocked': float(f[9] or 0)}))
    return head, pd.DataFrame(rows)

def main():
    dump, sref, rref, out = sys.argv[1:5]
    head, s = read(dump)
    ref = pd.read_pickle(sref); ref['Material'] = ref['Material'].str.strip()
    g = ref.groupby('Material').agg(q=('Unrestricted', 'sum'), v=('Value Unrestricted', 'sum')); up = (g['v'] / g['q']).where(g['q'] > 0)
    r = pd.read_pickle(rref); r = r[r['Material'].notna()].copy(); r['Material'] = r['Material'].str.strip()
    r12 = r[r['Posting Date'] >= r['Posting Date'].max() - pd.Timedelta(days=365)]
    amt = 'amt' if 'amt' in r12.columns else 'Amt.in Loc.Cur.'
    rg = r12.groupby('Material').agg(q=('Qty in unit of entry', 'sum'), a=(amt, 'sum')); rp = (rg['a'] / rg['q']).where(rg['q'] > 0)
    price = s['Material'].map(up).fillna(0.0)
    s['Value Unrestricted'] = s['Unrestricted'] * price
    no_price = sorted(set(s.loc[(price == 0) & (s['Unrestricted'] > 0), 'Material']))
    # material group from the reference export where the daily file leaves it blank
    mg = ref.drop_duplicates('Material').set_index('Material')['Material Group']
    s['Material Group'] = s['Material Group'].where(s['Material Group'].astype(str).str.len() > 0, s['Material'].map(mg)).fillna('')
    # materials with no stock today keep their (zero) lines from the reference export: make_inv maps materials to shops through the
    # storage locations they are listed under, so dropping them would move receipts between shops
    z = ref[~ref['Material'].isin(set(s['Material']))].copy()
    for k in ('Unrestricted', 'Quality Inspection', 'Transit and Transfer', 'Blocked', 'Value Unrestricted'): z[k] = 0.0
    s = pd.concat([s, z[s.columns.intersection(z.columns)]], ignore_index=True)
    s = s[['Plant', 'Storage Location', 'Material Group', 'Material', 'Material Description', 'Base Unit of Measure', 'Unrestricted',
           'Quality Inspection', 'Transit and Transfer', 'Blocked', 'Value Unrestricted']]
    s.to_pickle(out)
    if len(sys.argv) > 7:   # per-part stock for the Atlas-fed datasets (SAP mode): MB52 quantity + SAP safety / vendor stock carried from the last Atlas read
        prev_ps = {str(r['code']): r for r in json.load(open(sys.argv[5]))}; prev_cs = {str(r['code']): r for r in json.load(open(sys.argv[6]))}
        q = s.groupby(s['Material'].str.lstrip('0'))['Unrestricted'].sum(); asof = (head.get('mtime') or '')[:10]
        rows = [dict(code=c, qty=float(q.get(c, 0.0)), safety=int((prev_ps.get(c) or {}).get('safety') or (prev_cs.get(c) or {}).get('safety_stock') or 0),
                     vendor_stock=int((prev_cs.get(c) or {}).get('vendor_stock') or 0), asof=asof) for c in sorted(set(prev_ps) | set(prev_cs))]
        json.dump(rows, open(sys.argv[7], 'w'), separators=(',', ':'))
    print(json.dumps(dict(file=head.get('file'), mtime=head.get('mtime'), lines=len(s), materials=int(s['Material'].nunique()),
                          value_m=round(s['Value Unrestricted'].sum() / 1e6, 1), qi_lines=int((s['Quality Inspection'] > 0).sum()),
                          blocked_lines=int((s['Blocked'] > 0).sum()), no_price_n=len(no_price), no_price=no_price[:15])))

if __name__ == '__main__':
    main()
