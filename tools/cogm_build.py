#!/usr/bin/env python3
"""Cost of Production (COGM) by shop and month (Umair, 11 Nov 2026).

COGM = Direct material + Indirect material + Direct labour + Utilities

  Direct material   SAP MB51 261 less 262 (issues to production orders) of PURCHASED materials, valued at SAP amount.
                    Parts made in-house (101 receipts with no supplier) are left out, so a part is not counted again
                    when the next stage consumes it. Shop = the shop of the consumed material (sap_stock part master).
  Indirect material SAP 201/202 cost-centre issues (sap_cc.json): Tools, Consumables, Spares, Lubricants.
  Direct labour     Attendance workbook, one row per person (sp_attendance_people.json):
                    monthly wage Rs 42,500; day rate = 42,500 / 26; hour rate = day rate / 8 (8-hour shift).
                    wages = 42,500 x (working days so far / 26, at most 1) less absent days x day rate
                    overtime = overtime hours x hour rate x 1.5
  Utilities         electricity MWh per shop from the utilities sheet x Rs 32/kWh; the current month is estimated (estimate: true)
                    until its figures are given. Gas is not costed yet (no rate).

usage: cogm_build.py <u.pkl (261/262 history)> <mb51 dump of the current month> <data dir> <out cogm.json> [asof YYYY-MM-DD]
"""
import collections, datetime as dt, json, sys
import pandas as pd

WAGE, DAYS, HOURS, OT_X = 42500.0, 26, 8, 1.5
FROM = '2026-07'                                   # Atlas financial year starts in July
INDIRECT = ('Tools', 'Consumables', 'Spares', 'Lubricants')
# Electricity (Umair, 11 Nov 2026): MWh per shop from the 'Utilities Consumption Trend' sheet (Atlas Engineering), costed at
# Rs 32 per kWh (the Nov-26 rate, used for all months until other rates are given). HPDC -> HPDC / Die Cast, ZDC (zinc die
# casting) -> Carburetor, ALF -> Aluminium Foundry, Cast Iron -> CIF Machining, Machining -> Machining (as the sheet names it).
# A month with no sheet figures yet (the current one) is estimated from the last month on file, pro rata to working days so far.
RATE_KWH = 32.0
UTIL_MWH = {
  '2026-07': {'HPDC / Die Cast': 37.03, 'Carburetor': 22.73 + 67.51, 'Aluminium Foundry': 205.59, 'Polymer': 83.59, 'Machining': 28.45, 'Ignition Coil': 19.32, 'Piston': 41.21, 'CIF Machining': 206.65},
  '2026-08': {'HPDC / Die Cast': 57.83, 'Carburetor': 26.08 + 94.18, 'Aluminium Foundry': 279.63, 'Polymer': 126.74, 'Machining': 38.43, 'Ignition Coil': 26.45, 'Piston': 45.91, 'CIF Machining': 267.92},
  '2026-09': {'HPDC / Die Cast': 54.91, 'Carburetor': 25.13 + 85.45, 'Aluminium Foundry': 275.36, 'Polymer': 116.41, 'Machining': 39.84, 'Ignition Coil': 25.96, 'Piston': 47.67, 'CIF Machining': 264.81},
  '2026-10': {'HPDC / Die Cast': 55.6, 'Carburetor': 44.02 + 82.22, 'Aluminium Foundry': 267.6, 'Polymer': 106.9, 'Machining': 38.64, 'Ignition Coil': 24.37, 'Piston': 47.84, 'CIF Machining': 245.13}}

# Gas (Umair, 11 Nov 2026): '000 Nm3 a month from the same sheet's Gas Consumption charts (read as thousands of cubic metres),
# costed at about Rs 55 per Nm3. HPDC -> HPDC / Die Cast, ZDC -> Carburetor, Drum Gear -> Drum Gear, Cast Iron -> CIF Machining.
RATE_GAS = 55.0
GAS_KNM3 = {
  '2026-07': {'HPDC / Die Cast': 7.0, 'Carburetor': 2.48, 'Drum Gear': 2.31, 'CIF Machining': 1.5},
  '2026-08': {'HPDC / Die Cast': 7.0, 'Carburetor': 2.48, 'Drum Gear': 2.72, 'CIF Machining': 1.6},
  '2026-09': {'HPDC / Die Cast': 7.0, 'Carburetor': 2.48, 'Drum Gear': 2.94, 'CIF Machining': 1.43},
  '2026-10': {'HPDC / Die Cast': 7.0, 'Carburetor': 2.28, 'Drum Gear': 2.49, 'CIF Machining': 1.58}}
# Shop products (Umair, 11 Nov 2026): CIF makes Sleeve CG (in-house), Cylinder Pridor, Drive Plate casting and Boss Clutch
# Center Pridor casting; their volume is the SAP MB51 101 production (current month) or the F.O.M lines (earlier months).
# Cushion makes Front Forks and Rear Cushions: volume in motorcycle sets (F.O.M weights, 4 pieces a set).
# Aluminium Foundry casts BFTs and Pistons: its whole cost is shared to Bridge Fork Top and Piston by their production.
# Zinc (ZDC) belongs to Carburetor casting (Keihin / zinc die casting: carburetor body castings CD70 and CG).
CIF_PRODUCTS = {'6590331001': 'SLEEVE CYLINDER CG125 (in-house)', '9030331000': 'CYLINDER PRIDOR', '6503800001': 'DRIVE PLATE CASTING (in-house)',
                '6530381005': 'CLUTCH CENTER WITH BOSS PRIDOR CASTING'}
CIF_FOM = ('ci_sleeve', 'ci_cyl', 'ci_dp', 'ci_boss')
# Bought-in material SAP does not tie to a shop (Umair confirmed 11 Nov 2026): codes, then description keywords
MAT_SHOP = {'5090910011': 'Ignition Coil', '5090910010': 'Ignition Coil', '5020910009': 'Ignition Coil', '5090910005': 'Ignition Coil',
            '5090910007': 'Ignition Coil', '5020910015': 'Ignition Coil', '5020910014': 'Ignition Coil', '5020910007': 'Ignition Coil',
            '6020840003': 'Cushion', '6020850003': 'Cushion', '6110271034': 'Cushion', '5010210002': 'Clutch', '1010510033': 'Polymer'}
KW_SHOP = [('WIRE MAGNET', 'Ignition Coil'), ('RESIN', 'Ignition Coil'), ('BOBBIN', 'Ignition Coil'), ('CASE COIL', 'Ignition Coil'),
           ('CASE BOTTOM', 'Cushion'), ('CUSHION', 'Cushion'), ('FRONT FORK', 'Cushion'), ('PLASTIC', 'Polymer'), ('PP MATERIAL', 'Polymer')]


def main(upkl, mb51, data, out, asof=None):
    asof = asof or dt.date.today().isoformat()
    cur = asof[:7]
    st = lambda c: str(c).strip().lstrip('0')
    shop_of = {}
    for r in json.load(open(data + '/sap_stock.json')): shop_of[st(r['code'])] = r.get('shop') or ''
    for f in ('atlas_parts.json', 'atlas_child_stock.json'):
        try:
            for r in json.load(open(data + '/' + f)): shop_of.setdefault(st(r['code']), r.get('shop') or '')
        except Exception: pass
    # parts made in-house: 101 receipts with no supplier in the current MB51 file
    inh, buy = set(), set()
    for ln in open(mb51, encoding='utf-8'):
        f = ln.rstrip('\n').split('|')
        if len(f) < 11 or ln.startswith(('@@', 'file=', 'month=', 'cols=')): continue
        if f[7] == '101': (buy if f[6].strip() else inh).add(st(f[0]))
    made = inh - buy
    rows = collections.defaultdict(float); extra = collections.defaultdict(lambda: collections.defaultdict(float))
    key = lambda m, s, e, sub: (m, s or 'Unassigned', e, sub)
    # direct material
    u = pd.read_pickle(upkl); u['m'] = pd.to_datetime(u['Posting Date']).dt.strftime('%Y-%m'); u['Material'] = u['Material'].astype(str).map(st)
    u = u[(u.m >= FROM) & (u.m <= cur) & (u['Movement Type'].astype(str).isin(['261', '262']))]
    u = u[~u.Material.isin(made)]
    desc = {st(r['code']): str(r.get('part') or '').upper() for r in json.load(open(data + '/sap_stock.json'))}
    mdesc = {}
    for ln in open(mb51, encoding='utf-8'):
        f = ln.split('|')
        if len(f) > 2 and not ln.startswith(('@@', 'file=', 'month=', 'cols=')): mdesc.setdefault(st(f[0]), f[1].upper())
    def mshop(mat):
        d = desc.get(mat, '') or mdesc.get(mat, '')
        if mat in MAT_SHOP: return MAT_SHOP[mat]
        if 'ZINC' in d: return 'Carburetor'                                  # ZDC: carburetor body casting
        if 'HD2' in d.replace(' ', '') and 'BS1' in d.replace(' ', ''): return 'HPDC / Die Cast'   # HD2 BS1 aluminium: HPDC only (Umair)
        if not shop_of.get(mat):
            for kw, sh in KW_SHOP:
                if kw in d: return sh
        if not shop_of.get(mat) and 'ALUMIN' in d and 'INGOT' in d: return 'Aluminium Foundry'
        return shop_of.get(mat, '')
    for (m, mat), v in u.groupby(['m', 'Material'])['amt'].sum().items():
        rows[key(m, mshop(mat), 'Direct material', 'Purchased material')] += -float(v)
    # indirect material
    for r in json.load(open(data + '/sap_cc.json')):
        if FROM <= r['month'] <= cur and r['category'] in INDIRECT:
            rows[key(r['month'], r.get('shop') or '', 'Indirect material', r['category'])] += float(r['value_pkr'])
    # direct labour
    day, hour = WAGE / DAYS, WAGE / DAYS / HOURS
    def wdays(m):                                   # Mon-Sat working days counted so far in month m
        y, mo = map(int, m.split('-')); d0 = dt.date(y, mo, 1)
        end = min((dt.date(y + mo // 12, mo % 12 + 1, 1) - dt.timedelta(days=1)), dt.date.fromisoformat(asof))
        return sum(1 for i in range((end - d0).days + 1) if (d0 + dt.timedelta(days=i)).weekday() != 6)
    share = {}; extra_u = {}
    for p in json.load(open(data + '/sp_attendance_people.json')):
        m = p['month']
        if not (FROM <= m <= cur): continue
        if m not in share: share[m] = min(1.0, wdays(m) / DAYS) if m == cur else 1.0
        sh = p.get('shop') or ''
        ab, ot = float(p.get('absent') or 0), float(p.get('ot_hours') or 0)
        wages = max(0.0, WAGE * share[m] - ab * day); otc = ot * hour * OT_X
        rows[key(m, sh, 'Direct labour', 'Wages')] += wages
        rows[key(m, sh, 'Direct labour', 'Overtime')] += otc
        x = extra[(m, sh or 'Unassigned')]; x['people'] += 1; x['wages_pkr'] += wages; x['ot_pkr'] += otc; x['absent_days'] += ab; x['absent_pkr'] += ab * day; x['ot_hours'] += ot
    # utilities: electricity from the utilities sheet (MWh x 1,000 x Rs/kWh); current month estimated if not on the sheet yet
    months = sorted({k[0] for k in rows}); est = set(); last = max(UTIL_MWH)
    for m in months:
        if m in UTIL_MWH: src, f = UTIL_MWH[m], 1.0
        elif m == cur: src, f = UTIL_MWH[last], min(1.0, wdays(m) / DAYS); est.add(m)
        else: continue
        for sh, mwh in src.items():
            rows[key(m, sh, 'Utilities', 'Electricity')] += mwh * 1000 * RATE_KWH * f
            extra_u[(m, sh)] = round(mwh * f, 2)
        gsrc = GAS_KNM3.get(m) or (GAS_KNM3[max(GAS_KNM3)] if m == cur else None)
        for sh, k in (gsrc or {}).items():
            g = 1.0 if m in GAS_KNM3 else f
            rows[key(m, sh, 'Utilities', 'Gas')] += k * 1000 * RATE_GAS * g
    # ---- production volume per shop (11 Nov, Umair) ----
    import os; rd = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    pick = lambda f: (data + '/' + f) if os.path.exists(data + '/' + f) else os.path.join(rd, f)   # repo data/ if not copied
    try:
        parts = {st(q['code']): q for q in json.load(open(pick('atlas_parts.json')))}
        pdd = json.load(open(pick('atlas_parts_daily.json')))
    except Exception as e:
        parts, pdd = {}, []; print('no Atlas production volume:', e)
    try: fom = json.load(open(pick('fom.json')))[0]
    except Exception: fom = {'months': {}, 'codes': {}}
    SHOPX = {'Fuel Cock': 'Carburetor'}
    vol = collections.defaultdict(lambda: collections.defaultdict(float)); prod = collections.defaultdict(float)
    for r in pdd:
        m = r['date'][:7]; a = r.get('prod_actual') or 0
        if not (FROM <= m <= cur) or r['date'] > asof or not a: continue
        q = parts.get(st(r['code'])) or {}; sh = SHOPX.get(q.get('shop'), q.get('shop')) or ''; t = q.get('type') or ''
        if not sh or sh == 'CIF Machining': continue
        vol[(m, sh)][t] += a
        if t == 'Finished': prod[(m, sh, st(r['code']), q.get('part') or '', q.get('model') or '')] += a
    # CIF and Cushion from SAP MB51 101 production (current month) / F.O.M (earlier months)
    p101 = collections.defaultdict(float)
    for ln in open(mb51, encoding='utf-8'):
        f = ln.rstrip('\n').split('|')
        if len(f) < 11 or ln.startswith(('@@', 'file=', 'month=', 'cols=')) or f[6].strip(): continue
        if f[7] in ('101', '102'):
            try: p101[st(f[0])] += float(f[2] or 0) * (1 if f[7] == '101' else -1)
            except ValueError: pass
    cw = {st(c): w for c, w, *_ in (fom.get('codes') or {}).get('tc_cushion', [])}
    for m in sorted({k[0] for k in rows}):
        if m == cur:
            for c, nm in CIF_PRODUCTS.items():
                if p101.get(c, 0) > 0: vol[(m, 'CIF Machining')]['Finished'] += p101[c]; prod[(m, 'CIF Machining', c, nm, '')] += p101[c]
            cu = sum(p101.get(c, 0) * w for c, w in cw.items())
            if cu > 0: vol[(m, 'Cushion')]['Finished'] += cu; prod[(m, 'Cushion', 'FF+RC', 'FRONT FORK & REAR CUSHION (sets)', '')] += cu
        else:
            fm = (fom.get('months') or {}).get(m) or {}
            for k in CIF_FOM:
                if fm.get(k): vol[(m, 'CIF Machining')]['Finished'] += fm[k]; prod[(m, 'CIF Machining', k, {'ci_sleeve': 'SLEEVES', 'ci_cyl': 'CYLINDER', 'ci_dp': 'DRIVE PLATE CASTING', 'ci_boss': 'CLUTCH CENTER BOSS CASTING'}[k] + ' (F.O.M)', '')] += fm[k]
            if fm.get('tc_cushion'): vol[(m, 'Cushion')]['Finished'] += fm['tc_cushion']; prod[(m, 'Cushion', 'FF+RC', 'FRONT FORK & REAR CUSHION (sets, F.O.M)', '')] += fm['tc_cushion']
    units = {k: (o.get('Finished', 0) or sum(v for t, v in o.items() if t != 'Finished')) for k, o in vol.items()}
    # "Machining" on the utilities sheet = Clutch (without the press shop), Drum Gear and Hub Machining (Umair, 11 Nov):
    # shared to those three shops by the products each produced in the month (production volume)
    for (m, sh, e, sub), v in list(rows.items()):
        if sh != 'Machining': continue
        w = {k: units.get((m, k), 0) for k in ('Clutch', 'Drum Gear', 'Hubs')}; t = sum(w.values())
        if not t: continue
        del rows[(m, sh, e, sub)]
        for k, n in w.items():
            if n: rows[(m, k, e, sub)] += v * n / t; extra_u[(m, k)] = round((extra_u.get((m, k)) or 0) + (extra_u.get((m, 'Machining')) or 0) * n / t, 2)
    # Aluminium Foundry casts BFT and Piston: share all its cost to them by production volume
    alloc = {}
    for (m, sh, e, sub), v in list(rows.items()):
        if sh != 'Aluminium Foundry': continue
        tgt = {t: units.get((m, t), 0) for t in ('Bridge Fork Top', 'Piston')}; tt = sum(tgt.values())
        if not tt: continue
        del rows[(m, sh, e, sub)]
        for t, uu in tgt.items():
            if uu: rows[(m, t, e, sub)] += v * uu / tt; alloc[(m, t, e, sub)] = alloc.get((m, t, e, sub), 0) + v * uu / tt
    out_rows = [{'month': m, 'shop': s, 'element': e, 'sub': sub, 'value_pkr': round(v), 'estimate': e == 'Utilities' and m in est,
                 **({'mwh': extra_u.get((m, s))} if e == 'Utilities' and sub == 'Electricity' else {}),
                 **({'from_alf': round(alloc[(m, s, e, sub)])} if (m, s, e, sub) in alloc else {}), 'asof': asof}
                for (m, s, e, sub), v in sorted(rows.items()) if abs(v) >= 1]
    for (m, s), x in sorted(extra.items()):
        out_rows.append({'month': m, 'shop': s, 'element': 'Labour detail', 'sub': '', 'value_pkr': 0, 'people': int(x['people']),
                         'absent_days': round(x['absent_days'], 1), 'absent_pkr': round(x['absent_pkr']), 'ot_hours': round(x['ot_hours'], 1),
                         'wages_pkr': round(x['wages_pkr']), 'ot_pkr': round(x['ot_pkr']),
                         'wage': WAGE, 'day_rate': round(day, 2), 'hour_rate': round(hour, 2), 'asof': asof})
    for (m, sh), o in sorted(vol.items()):
        fin = o.get('Finished', 0); ih = sum(v for k, v in o.items() if k != 'Finished')
        out_rows.append({'month': m, 'shop': sh, 'element': 'Volume', 'sub': '', 'value_pkr': 0, 'units': round(fin or ih),
                         'basis': 'sets' if sh == 'Cushion' else ('Finished' if fin else 'In-house parts'), 'finished': round(fin), 'inhouse': round(ih), 'asof': asof})
    for (m, sh, c, nm, md), a in sorted(prod.items()):
        out_rows.append({'month': m, 'shop': sh, 'element': 'Product', 'sub': '', 'value_pkr': 0, 'code': c, 'part': nm, 'model': md, 'units': round(a), 'asof': asof})
    json.dump(out_rows, open(out, 'w'), separators=(',', ':'))
    tot = collections.defaultdict(float)
    for r in out_rows:
        if r['month'] == cur and r['element'] not in ('Volume', 'Product'): tot[r['element']] += r['value_pkr']
    print(json.dumps({'asof': asof, 'months': months, 'rows': len(out_rows), 'inhouse_parts_left_out': len(made),
                      'current_month_pkr_m': {k: round(v / 1e6, 1) for k, v in tot.items() if k != 'Labour detail'}}))


if __name__ == '__main__':
    main(*sys.argv[1:6])
