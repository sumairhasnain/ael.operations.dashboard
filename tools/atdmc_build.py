"""ATDMC (die making, SAP plant MDP) stock and consumption, kept apart from production data.

17 Nov 2026 (Umair): the die-making plant's stock is isolated from production. mb51_build.py now leaves plant MDP rows out
of the inventory history, and this script builds the ATDMC datasets on their own. The Inventory tab and the Overview
Inventory window add them only when 'Include ATDMC Stock' is switched on (off by default).

MB52 does not carry plant MDP, so ATDMC stock is built from MB51: receipts (101/102) less issues (201/202), from the first
month MDP appears (Nov 2026). The movement history is kept in data/atdmc_moves.json; every run replaces the months found in
the new dump(s) and keeps the rest.

Usage: python3 atdmc_build.py <data dir> <out dir> <mb51 dump.txt> [<more dumps> ...]
Writes <out>/atdmc_moves.json, sap_stock_atdmc.json, sap_flow_atdmc.json, sap_cc_atdmc.json, sap_rcv_sup_atdmc.json."""
import sys, os, re, json, collections, datetime as dt

DATA, OUT, DUMPS = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(OUT, exist_ok=True)
st = lambda c: str(c).strip()

# same category rules as tools/sap_inventory.py (cat2): Umair's item calls, lubricants, then the code series
OVR = {**{c: 'Consumables' for c in ('1010380082', '1010380086', '1510410001', '1510410086', '1510410011', '1510410012', '1510410013', '1510410000', '1513010009', '2000100079', '2510910222', '2509955067', '2510910148', '05402-SB-15L')},
       **{c: 'Raw Material' for c in ('1510510012', '1510510086')}}
LUBRX = re.compile(r'\bOILS?\b|GREASE|LUBRICANT|LUBRICATION GREAS')
NOTLUB = re.compile(r'FILTER|SEAL|PUMP|STONE|GUN|GAUGE|GUAGE|ABSORBENT|SPILL|TRAP|UNIT|LUBRICATOR|KEROSINE|SUCTION')
def cat_of(code, d):
    c = st(code); d = str(d or '').upper()
    if c in OVR: return OVR[c]
    if not re.match(r'\d{10}$', c) or (LUBRX.search(d) and not NOTLUB.search(d) and c[:2] in ('10', '15', '20', '25')): return 'Lubricants'
    if c[:2] == '10': return 'Raw Material'
    return {'15': 'Consumables', '20': 'Tools', '25': 'Spares'}.get(c[:2], 'Production parts')

# ---- moves: previous history + the dumps (months in the dumps replace the stored ones) ----
new = []
for p in DUMPS:
    for ln in open(p, encoding='utf-8'):
        if ln.startswith(('@@', 'file=', 'month=', 'cols=')): continue
        f = ln.rstrip('\n').split('|')
        if len(f) < 11 or f[10].strip() != 'MDP' or f[7] not in ('101', '102', '201', '202'): continue
        if not f[0].strip(): continue   # service lines with no material (freight etc.) are not stock
        try: q = float(f[2] or 0); a = float(f[4] or 0)
        except ValueError: continue
        new.append({'code': st(f[0]), 'part': f[1].strip(), 'qty': q, 'date': f[3][:10], 'amt': a, 'cc': f[5].strip(), 'sup': f[6].strip().lstrip('0'), 'mt': f[7], 'uom': f[8].strip(), 'sloc': f[9].strip()})
prev_p = os.path.join(DATA, 'atdmc_moves.json')
prev = json.load(open(prev_p)) if os.path.exists(prev_p) else []
nm = {x['date'][:7] for x in new}
moves = sorted([x for x in prev if x['date'][:7] not in nm] + new, key=lambda x: (x['date'], x['code'], x['mt']))
asof = max([x['date'] for x in moves] or [dt.date.today().isoformat()])
today = dt.date.fromisoformat(asof)
days = lambda d: (today - dt.date.fromisoformat(d)).days

# ---- stock by material ----
M = collections.defaultdict(lambda: {'q': 0.0, 'rq': 0.0, 'ra': 0.0, 'iq': 0.0, 'ia': 0.0, 'lr': None, 'li': None, 'r90': 0.0, 'i90': 0.0, 'r182': 0.0, 'ra182': 0.0, 'r365': 0.0, 'ra365': 0.0, 'i182': 0.0, 'im': set(), 'sl': set(), 'part': '', 'uom': ''})
for x in moves:
    o = M[x['code']]; o['part'] = o['part'] or x['part']; o['uom'] = o['uom'] or x['uom']; o['q'] += x['qty']; dd = days(x['date'])
    if x['sloc']: o['sl'].add('MDP ' + x['sloc'])
    if x['mt'] in ('101', '102'):
        o['rq'] += x['qty']; o['ra'] += x['amt']
        if x['mt'] == '101': o['lr'] = max(o['lr'] or '', x['date'])
        if dd <= 90: o['r90'] += x['qty']
        if dd <= 182: o['r182'] += x['qty']; o['ra182'] += x['amt']
        if dd <= 365: o['r365'] += x['qty']; o['ra365'] += x['amt']
    else:
        o['iq'] -= x['qty']; o['ia'] -= x['amt']
        if x['mt'] == '201': o['li'] = max(o['li'] or '', x['date'])
        if dd <= 90: o['i90'] -= x['qty']
        if dd <= 182: o['i182'] -= x['qty']; o['im'].add(x['date'][:7])
first = min([x['date'] for x in moves] or [asof]); span = max(1.0, min(6.0, (days(first) + 1) / 30.4))   # months of history behind the use rate (at most 6)
COVB = [(15, 'Under 15 days'), (30, '15–30 days'), (90, '30–90 days'), (180, '90–180 days')]
STK = []
for code, o in M.items():
    cat = cat_of(code, o['part']); unit = o['ra'] / o['rq'] if o['rq'] > 0 else None
    qty = round(o['q'], 4); val = qty * unit if unit and qty > 0 else 0.0
    um = o['i182'] / span if o['i182'] > 0 else 0.0; daily = um / 30.4 if um else 0
    cx = qty / daily if daily else None
    cb = ('Out of stock' if qty <= 0 else next((n for t, n in COVB if cx < t), 'Over 180 days')) if daily else 'No use in 6 months'
    exc = max(0.0, val - (180 * daily * unit if (daily and unit) else 0)) if val > 0 else 0
    lr, li = o['lr'], o['li']; age = days(lr) if lr else None
    mv = max([d for d in (li, lr if (cat == 'Raw Material' or not li) else None) if d] or [None]) if (li or lr) else None; md = days(mv) if mv else None
    if qty <= 0: continue   # nothing on hand by MB51 (issues can come from stock held before the MB51 files carried plant MDP, and MB52 has no MDP): leave out rather than call it out of stock
    STK.append({'code': code, 'part': o['part'].strip(' *'), 'group': '', 'category': cat, 'stage': 'Raw material' if cat == 'Raw Material' else 'Shop spares & consumables',
                'shop': 'ATDMC', 'shop_by': 'plant MDP', 'models': '', 'uom': o['uom'], 'stock': round(max(qty, 0), 2), 'qi': 0, 'blocked': 0, 'transit': 0,
                'value_pkr': round(val), 'unit_pkr': round(unit, 2) if unit else None, 'slocs': ', '.join(sorted(o['sl'])), 'last_rcv': lr, 'last_issue': li,
                'rcv_90d': round(o['r90'], 2), 'issue_90d': round(o['i90'], 2), 'rcv_12m': round(o['r365'], 2), 'rcv_12m_pkr': round(o['ra365']), 'rcv_6m': round(o['r182'], 2), 'rcv_6m_pkr': round(o['ra182']),
                'use_6m_pkr': round(um * 6 * unit) if unit else 0, 'use_month': round(um, 2), 'use_basis': 'issues' if um else None, 'use_months': len(o['im']), 'cover_stock': None,
                'cover_days': round(cx) if cx is not None else None, 'cover_bucket': cb, 'excess_pkr': round(exc), 'move_days': md,
                'move_bucket': 'No movement since Jan 2024' if md is None else 'Moved in last 90 days' if md <= 90 else '91–365 days' if md <= 365 else 'Over 1 year',
                'age_days': age, 'age_bucket': 'Not received since Jan 2024' if age is None else '0–90 days' if age <= 90 else '91–180 days' if age <= 180 else '181–365 days' if age <= 365 else 'Over 1 year',
                'asof': asof, 'plant': 'MDP', 'atdmc': 1, **({'oos': 1} if qty <= 0 else {})})

# ---- flows, cost centres, suppliers (same shapes as sap_flow / sap_cc / sap_rcv_sup, shop 'ATDMC') ----
vn = {}
for pth in (os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sap_vendor_names.json'),):
    if os.path.exists(pth): vn.update(json.load(open(pth)))
try:
    for q in json.load(open(os.path.join(DATA, 'atlas_vendors.json'))): vn.setdefault(str(q['vendor_code']).lstrip('0'), q['vendor'].strip())
except Exception: pass
fl, cc, sp = collections.defaultdict(lambda: [0.0, 0]), collections.defaultdict(lambda: [0.0, 0]), collections.defaultdict(lambda: [0.0, 0])
for x in moves:
    m = x['date'][:7]; cat = cat_of(x['code'], x['part'])
    if x['mt'] in ('101', '102'):
        k = (m, 'ATDMC', cat, 'Purchase' if x['sup'] else 'Production'); fl[k][0] += x['amt']; fl[k][1] += 1
        if x['sup']: k = (m, x['sup'], cat); sp[k][0] += x['amt']; sp[k][1] += 1
    else:
        k = (m, 'ATDMC', cat, 'Consumption'); fl[k][0] -= x['amt']; fl[k][1] += 1
        k = (m, x['cc'] or '—', cat); cc[k][0] -= x['amt']; cc[k][1] += 1
FLOW = [{'month': k[0], 'shop': k[1], 'category': k[2], 'kind': k[3], 'value_pkr': round(v[0]), 'lines': v[1], 'asof': asof, 'atdmc': 1} for k, v in fl.items() if abs(v[0]) >= 1]
CCR = [{'month': k[0], 'cc': k[1], 'category': k[2], 'shop': 'ATDMC', 'label': 'CC ' + k[1] + ' · ATDMC', 'value_pkr': round(v[0]), 'lines': v[1], 'asof': asof, 'atdmc': 1} for k, v in cc.items() if abs(v[0]) >= 1]
p3 = sorted({x['date'][:7] for x in moves})[-3:]
SUP = [{'month': k[0], 'supplier': k[1], 'name': vn.get(k[1], 'Supplier ' + k[1]), 'shop': 'ATDMC', 'category': k[2], 'value_pkr': round(v[0]), 'lines': v[1], 'asof': asof, 'atdmc': 1} for k, v in sp.items() if k[0] in p3 and abs(v[0]) >= 1]

dump = lambda n, rows: json.dump(rows, open(os.path.join(OUT, n + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
dump('atdmc_moves', moves); dump('sap_stock_atdmc', STK); dump('sap_flow_atdmc', FLOW); dump('sap_cc_atdmc', CCR); dump('sap_rcv_sup_atdmc', SUP)
print(json.dumps({'moves': len(moves), 'months': sorted({x['date'][:7] for x in moves}), 'stock_rows': len(STK), 'stock_value_m': round(sum(x['value_pkr'] for x in STK) / 1e6, 2),
                  'by_cat': {c: round(sum(x['value_pkr'] for x in STK if x['category'] == c) / 1e6, 2) for c in sorted({x['category'] for x in STK})}, 'flow': len(FLOW), 'cc': len(CCR), 'sup': len(SUP), 'asof': asof}))
