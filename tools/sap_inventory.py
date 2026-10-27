"""Build the Inventory tab datasets from three SAP exports (MB52 stock, MB51 101/102 receipts, MB51 201/202 issues).
Usage: python3 make_inv.py <receiving.xlsx> <consumption.xlsx> <mb52.xlsx> <out_dir>
Writes sap_stock.json (one row per material in stock), sap_flow.json (monthly receipts/issues by shop),
sap_cc.json (monthly issues by cost centre) and sap_rcv_sup.json (purchase receipts by supplier, last 3 months)."""
import sys, json, re, datetime as dt
import pandas as pd

RCV, CONS, MB52, OUT = sys.argv[1:5]
DATA = __import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'data') + '/'
TXT = {'Material': str, 'Storage Location': str, 'Cost Center': str, 'Supplier': str, 'Movement Type': str, 'Material Group': str}
r = pd.read_excel(RCV, dtype=TXT); c = pd.read_excel(CONS, dtype=TXT); s = pd.read_excel(MB52, dtype=TXT)
s = s[s['Material'].notna()].copy()                      # MB52 export carries subtotal rows with no material
r = r[r['Material'].notna() & (r['Material'].str.strip() != '')].copy()   # service POs have no material: not inventory
c = c[c['Material'].notna()].copy()
for d in (r, c): d.rename(columns={'Amt.in Loc.Cur.': 'amt', 'Cost Center': 'cc'}, inplace=True)
for d in (r, c): d['Material'] = d['Material'].str.strip()
s['Material'] = s['Material'].str.strip()
ASOF_FLOW = max(r['Posting Date'].max(), c['Posting Date'].max()).strftime('%Y-%m-%d')

# ---- shop of a material: Atlas part master first, then SAP material group, then a few clear raw-material words ----
atlas = {}
for q in json.load(open(DATA + 'atlas_parts.json')): atlas[str(q['code'])] = q['shop']
for q in json.load(open(DATA + 'atlas_child_stock.json')): atlas.setdefault(str(q['code']), q['shop'])
for q in json.load(open(DATA + 'atlas_bom.json')): atlas.setdefault(str(q['code']), q['shop'])
PFX = [('CLU', 'Clutch'), ('DGS', 'Drum Gear'), ('IGN', 'Ignition Coil'), ('POL', 'Polymer'), ('PST', 'Piston'), ('HPDC', 'HPDC / Die Cast'),
       ('DIECAST', 'HPDC / Die Cast'), ('HP-', 'Hubs'), ('BUF', 'Hubs'), ('CIF', 'CIF Machining'), ('CIM', 'CIF Machining'), ('KEIHIN', 'Carburetor'),
       ('ALF', 'Bridge Fork Top'), ('ALM', 'Bridge Fork Top'), ('CUS', 'Cushion'), ('FC-', 'Fuel Cock')]
STAGE = [('FIN', 'Finished'), ('-FI', 'Finished'), ('INH', 'In-house WIP'), ('-IN', 'In-house WIP'), ('VEN', 'Vendor parts'), ('-VE', 'Vendor parts'),
         ('IMP', 'Imported parts'), ('-IM', 'Imported parts'), ('OSP', 'Outsourced'), ('GEN', 'Shop spares & consumables'), ('-GE', 'Shop spares & consumables'), ('-G', 'Shop spares & consumables')]
RAW = {'RM.AEL', 'CR.RM', 'V16', 'C02', 'L10'}
LUBE = {'MCO', 'PCMO', 'DEO', 'GEAROIL', 'HYDRAULIC', 'IND', 'OEM', 'AUTO-PART', 'C & A'}
TOOLS = {'TOOL', 'COM-GEN', 'R&P', 'MS', 'C03', 'S06', 'MAINT-GEN', 'MNT-GEN', 'SP-GEN'}
CONSUM = {'CON-O&C', 'CONSUM', 'MM-GEN', 'C & S', 'QA-GEN', 'ADM-GEN', 'PWP-GEN', 'UTL-GEN', 'WWT-GEN', 'E&P-GEN'}
KW = [(r'CLUTCH|FRICTION|GEAR PRIMARY', 'Clutch'), (r'\bPP\b|POLYLAC|\bABS\b|POLYPROP', 'Polymer'), (r'ZINC|ZDC', 'HPDC / Die Cast'),
      (r'PIG IRON|COATED SAND', 'CIF Machining'), (r'PISTON', 'Piston')]

def cat_of(g):
    g = str(g or '')
    if g in RAW: return 'Raw material', ''
    if g in LUBE: return 'Lubricants & oils', ''
    if g in TOOLS: return 'Tools & spares', ''
    if g in CONSUM: return 'Consumables & utilities', ''
    for p, sh in PFX:
        if g.startswith(p):
            st = next((n for k, n in STAGE if g.endswith(k)), 'Shop parts')
            return ('Shop spares & consumables' if st == 'Shop spares & consumables' else 'Shop parts'), st
    return 'Other', ''

def shop_of(code, g, desc):
    if code in atlas: return atlas[code], 'Atlas'
    g = str(g or '')
    for p, sh in PFX:
        if g.startswith(p): return sh, 'SAP group'
    if g in RAW:
        for pat, sh in KW:
            if re.search(pat, str(desc or '').upper()): return sh, 'Description'
    return '', ''

MODELS = [('CD70', r'CD[- ]?70'), ('CD-Dream', r'DREAM'), ('CG125S', r'CG[- ]?125\s?S\b'), ('CG125', r'CG[- ]?125'), ('Pridor', r'PRIDOR'),
          ('CB125F', r'CB[- ]?125'), ('CB150F', r'CB[- ]?150'), ('K4AA', r'K4AA')]
def models_of(desc):
    d = str(desc or '').upper(); out = []
    for m, pat in MODELS:
        if re.search(pat, d) and not (m == 'CG125' and 'CG125S' in out and not re.search(r'CG[- ]?125(?!\s?S)', d)): out.append(m)
    return '/'.join(out)

# ---- receipts and issues ----
r['kind'] = r['Supplier'].notna().map({True: 'Purchase', False: 'Production'})
r['m'] = r['Posting Date'].dt.strftime('%Y-%m'); c['m'] = c['Posting Date'].dt.strftime('%Y-%m')
c['val'] = -c['amt']; c['qty'] = -c['Qty in unit of entry']
# A 202 that reverses an earlier 201 (same material, cost centre and quantity) is netted against that issue, so a
# booking corrected a month later does not show as a huge issue in one month and a negative one in the next.
c = c.sort_values('Posting Date').reset_index(drop=True); c['eff_m'] = c['m']
iss = {}; last = {}
for i, row in c.iterrows():
    k = (row['Material'], row['cc'], round(abs(row['Qty in unit of entry']), 3))
    if row['Movement Type'] == '201': iss.setdefault(k, []).append(i)
    elif row['Movement Type'] == '202' and iss.get(k):
        j = iss[k].pop(); c.at[i, 'eff_m'] = c.at[j, 'eff_m']
    elif row['Movement Type'] == '202':   # partial or split reversal: book it to the month of the last issue it can offset (within 90 days)
        k2 = (row['Material'], row['cc']); lst = last.get(k2)
        if lst is not None and (row['Posting Date'] - lst[0]).days <= 90: c.at[i, 'eff_m'] = lst[1]
    if row['Movement Type'] == '201': last[(row['Material'], row['cc'])] = (row['Posting Date'], row['m'])
CC = {'2104': 'Clutch', '2117': 'Hubs', '2107': 'HPDC / Die Cast', '2112': 'Drum Gear', '2113': 'Carburetor', '2114': 'Ignition Coil', '2115': 'Polymer',
      '2217': 'CIF Machining', '2219': 'CIF Machining', '2220': 'CIF Machining', '2221': 'CIF Machining', '2222': 'CIF Machining', '2223': 'Bridge Fork Top',
      '2229': 'Piston', '2235': 'Piston'}
CCN = {'3119': 'Utilities (LPG, diesel)', '3109': 'Quality', '3108': 'Stores', '4101': 'Admin', '5101': 'Lube filling (drums, buckets)'}

mg = s.drop_duplicates('Material').set_index('Material')['Material Group']
desc = pd.concat([s.drop_duplicates('Material').set_index('Material')['Material Description'],
                  r.drop_duplicates('Material').set_index('Material')['Material Description'],
                  c.drop_duplicates('Material').set_index('Material')['Material Description']])
desc = desc[~desc.index.duplicated()]
LUBRX = re.compile(r'\bOILS?\b|GREASE|LUBRICANT|LUBRICATION GREAS')
NOTLUB = re.compile(r'FILTER|SEAL|PUMP|STONE|GUN|GAUGE|GUAGE|ABSORBENT|SPILL|TRAP|UNIT|LUBRICATOR|KEROSINE|SUCTION')
def cat2(code, g, d):
    """Umair's rule (27 Oct): codes 10.. and 15.. are Consumables, 20.. Tools, 25.. Spares; lubricants are their own category and never counted
    in the other three. Other codes (30.., 50.., 60.., 65.., 90.., 91..) are production parts."""
    d = str(d or '').upper(); c = str(code)
    if g in LUBE or not re.match(r'\d{10}$', c) or (LUBRX.search(d) and not NOTLUB.search(d)): return 'Lubricants'
    return {'10': 'Consumables', '15': 'Consumables', '20': 'Tools', '25': 'Spares'}.get(c[:2], 'Production parts')
def info(code):
    g = mg.get(code, ''); d = desc.get(code, '')
    cat, st = cat_of(g); sh, how = shop_of(code, g, d)
    raw = cat == 'Raw material'; cat = cat2(code, g, d)
    if raw and cat != 'Lubricants': st = st or 'Raw material' 
    return g, d, cat, st, sh, how

today = pd.Timestamp(ASOF_FLOW)
months = sorted(set(r['m']) | set(c['eff_m']))
months = [m for m in months if m >= (today - pd.DateOffset(months=11)).strftime('%Y-%m')]

# ---- flows by month x shop x category ----
flow = {}
def addf(m, sh, cat, kind, v, n=1):
    k = (m, sh, cat, kind); o = flow.setdefault(k, [0.0, 0]); o[0] += v; o[1] += n
inf = {}
for code in set(r['Material']) | set(c['Material']) | set(s['Material']): inf[code] = info(code)
for row in r[r['m'].isin(months)].itertuples(index=False):
    g, d, cat, st, sh, how = inf[row.Material]; addf(row.m, sh, cat, row.kind, float(row.amt))
for row in c[c['eff_m'].isin(months)].itertuples(index=False):
    g, d, cat, st, sh, how = inf[row.Material]
    if g in RAW: continue   # raw material goes to production orders (261); its 201/202 lines here are mostly booking corrections
    addf(row.eff_m, CC.get(row.cc, ''), cat, 'Consumption', float(row.val))
FLOW = [{'month': k[0], 'shop': k[1], 'category': k[2], 'kind': k[3], 'value_pkr': round(v[0]), 'lines': v[1], 'asof': ASOF_FLOW} for k, v in flow.items() if abs(v[0]) >= 1]

# ---- issues by cost centre ----
ccr = {}
for row in c[c['eff_m'].isin(months)].itertuples(index=False):
    if inf[row.Material][0] in RAW: continue   # raw material goes to production orders (261); its 201/202 lines here are mostly booking corrections
    cc = row.cc if isinstance(row.cc, str) else '—'; k = (row.eff_m, cc); o = ccr.setdefault(k, [0.0, 0, {}]); o[0] += float(row.val); o[1] += 1
    g = inf[row.Material][2]; o[2][g] = o[2].get(g, 0) + float(row.val)
CCR = []
for (m, cc), (v, n, by) in ccr.items():
    if abs(v) < 1: continue
    top = sorted(by.items(), key=lambda x: -x[1])[0][0] if by else ''
    CCR.append({'month': m, 'cc': cc, 'shop': CC.get(cc, ''), 'label': 'CC ' + cc + (' · ' + CC[cc] if cc in CC else ' · ' + CCN[cc] if cc in CCN else ''),
                'value_pkr': round(v), 'lines': n, 'top_category': top, 'asof': ASOF_FLOW})

# ---- purchase receipts by supplier, last 3 months ----
vn = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'sap_vendor_names.json')))
for q in json.load(open(DATA + 'atlas_vendors.json')): vn.setdefault(str(q['vendor_code']).lstrip('0'), q['vendor'].strip())
p3 = months[-3:]
sup = {}
for row in r[(r['kind'] == 'Purchase') & r['m'].isin(p3)].itertuples(index=False):
    sh = inf[row.Material][4]; k = (row.m, str(row.Supplier).lstrip('0'), sh); o = sup.setdefault(k, [0.0, 0]); o[0] += float(row.amt); o[1] += 1
SUP = [{'month': k[0], 'supplier': k[1], 'name': vn.get(k[1], 'Supplier ' + k[1]), 'shop': k[2], 'value_pkr': round(v[0]), 'lines': v[1], 'asof': ASOF_FLOW} for k, v in sup.items() if abs(v[0]) >= 1]

# ---- stock register: one row per material with stock ----
ag = s.groupby('Material').agg(qty=('Unrestricted', 'sum'), qi=('Quality Inspection', 'sum'), transit=('Transit and Transfer', 'sum'), blocked=('Blocked', 'sum'),
                               value=('Value Unrestricted', 'sum'), uom=('Base Unit of Measure', 'first'),
                               slocs=('Storage Location', lambda x: ', '.join(sorted({v for v, q in zip(x, s.loc[x.index, 'Unrestricted']) if q}))))
ag = ag[(ag['qty'] > 0) | (ag['qi'] > 0) | (ag['blocked'] > 0) | (ag['transit'] > 0)]
r1 = r[r['Movement Type'] == '101']; lr = r1.groupby('Material')['Posting Date'].max()
li = c[c['Movement Type'] == '201'].groupby('Material')['Posting Date'].max()
d90 = today - pd.Timedelta(days=89)
i90 = c[c['Posting Date'] >= d90].groupby('Material')['qty'].sum()
r90 = r[r['Posting Date'] >= d90].groupby('Material')['Qty in unit of entry'].sum()
STK = []
for code, a in ag.iterrows():
    g, d, cat, st, sh, how = inf.get(code) or info(code)
    lrd = lr.get(code); lid = li.get(code); iq = float(i90.get(code, 0)); rq = float(r90.get(code, 0))
    age = (today - lrd).days if lrd is not None and not pd.isna(lrd) else None
    bucket = 'Not received since Jan 2024' if age is None else '0–90 days' if age <= 90 else '91–180 days' if age <= 180 else '181–365 days' if age <= 365 else 'Over 1 year'
    rate = iq / 90 if iq > 0 else 0
    STK.append({'code': code, 'part': str(d or '').strip(' *'), 'group': g, 'category': cat, 'stage': st, 'shop': sh, 'shop_by': how, 'models': models_of(d),
                'uom': a['uom'], 'stock': round(float(a['qty']), 2), 'qi': round(float(a['qi']), 2), 'blocked': round(float(a['blocked']), 2), 'transit': round(float(a['transit']), 2),
                'value_pkr': round(float(a['value'])), 'unit_pkr': round(float(a['value']) / float(a['qty']), 2) if a['qty'] else None, 'slocs': a['slocs'],
                'last_rcv': lrd.strftime('%Y-%m-%d') if age is not None else None, 'last_issue': lid.strftime('%Y-%m-%d') if lid is not None and not pd.isna(lid) else None,
                'rcv_90d': round(rq, 2), 'issue_90d': round(iq, 2), 'cover_days': round(float(a['qty']) / rate) if rate else None,
                'age_days': age, 'age_bucket': bucket, 'asof': dt.date.today().isoformat()})

def dump(n, rows):
    json.dump(rows, open(OUT + '/' + n + '.json', 'w'), ensure_ascii=False, separators=(',', ':'))
dump('sap_stock', STK); dump('sap_flow', FLOW); dump('sap_cc', CCR); dump('sap_rcv_sup', SUP)
tv = sum(x['value_pkr'] for x in STK)
print(json.dumps({'stock_rows': len(STK), 'stock_value_m': round(tv / 1e6, 1), 'flow': len(FLOW), 'cc': len(CCR), 'sup': len(SUP), 'months': months[0] + '..' + months[-1], 'flow_to': ASOF_FLOW,
                  'mapped_value_share': round(sum(x['value_pkr'] for x in STK if x['shop']) / tv, 3)}))
