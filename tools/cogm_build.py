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
    for (m, mat), v in u.groupby(['m', 'Material'])['amt'].sum().items():
        rows[key(m, shop_of.get(mat, ''), 'Direct material', 'Purchased material')] += -float(v)
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
        x = extra[(m, sh or 'Unassigned')]; x['people'] += 1; x['absent_days'] += ab; x['absent_pkr'] += ab * day; x['ot_hours'] += ot
    # utilities: electricity from the utilities sheet (MWh x 1,000 x Rs/kWh); current month estimated if not on the sheet yet
    months = sorted({k[0] for k in rows}); est = set(); last = max(UTIL_MWH)
    for m in months:
        if m in UTIL_MWH: src, f = UTIL_MWH[m], 1.0
        elif m == cur: src, f = UTIL_MWH[last], min(1.0, wdays(m) / DAYS); est.add(m)
        else: continue
        for sh, mwh in src.items():
            rows[key(m, sh, 'Utilities', 'Electricity')] += mwh * 1000 * RATE_KWH * f
            extra_u[(m, sh)] = round(mwh * f, 2)
    out_rows = [{'month': m, 'shop': s, 'element': e, 'sub': sub, 'value_pkr': round(v), 'estimate': e == 'Utilities' and m in est,
                 **({'mwh': extra_u.get((m, s))} if e == 'Utilities' else {}), 'rate_kwh': RATE_KWH if e == 'Utilities' else None, 'asof': asof}
                for (m, s, e, sub), v in sorted(rows.items()) if abs(v) >= 1]
    for (m, s), x in sorted(extra.items()):
        out_rows.append({'month': m, 'shop': s, 'element': 'Labour detail', 'sub': '', 'value_pkr': 0, 'people': int(x['people']),
                         'absent_days': round(x['absent_days'], 1), 'absent_pkr': round(x['absent_pkr']), 'ot_hours': round(x['ot_hours'], 1),
                         'wage': WAGE, 'day_rate': round(day, 2), 'hour_rate': round(hour, 2), 'asof': asof})
    # 11 Nov 19:08 (Umair): per finished product. Each shop's cost is divided by its actual production volume (Atlas
    # atlas_parts_daily, prod_actual) to give Rs per unit; the volume is the shop's FINISHED products, or, for a shop that
    # makes no finished product, its in-house parts (basis says which). Every finished product of a shop carries the
    # shop's Rs/unit for each element (volume-based allocation).
    try:
        parts = {st(q['code']): q for q in json.load(open(data + '/atlas_parts.json'))}
        pdd = json.load(open(data + '/atlas_parts_daily.json'))
    except Exception as e:
        parts, pdd = {}, []; print('no production volume:', e)
    SHOPX = {'Fuel Cock': 'Carburetor'}
    vol = collections.defaultdict(lambda: collections.defaultdict(float)); prod = collections.defaultdict(float)
    for r in pdd:
        m = r['date'][:7]; a = r.get('prod_actual') or 0
        if not (FROM <= m <= cur) or r['date'] > asof or not a: continue
        q = parts.get(st(r['code'])) or {}; sh = SHOPX.get(q.get('shop'), q.get('shop')) or ''; t = q.get('type') or ''
        if not sh: continue
        vol[(m, sh)][t] += a
        if t == 'Finished': prod[(m, sh, st(r['code']))] += a
    for (m, sh), o in sorted(vol.items()):
        fin = o.get('Finished', 0); ih = sum(v for k, v in o.items() if k != 'Finished')
        out_rows.append({'month': m, 'shop': sh, 'element': 'Volume', 'sub': '', 'value_pkr': 0, 'units': round(fin or ih),
                         'basis': 'Finished' if fin else 'In-house parts', 'finished': round(fin), 'inhouse': round(ih), 'asof': asof})
    for (m, sh, c), a in sorted(prod.items()):
        q = parts.get(c) or {}
        out_rows.append({'month': m, 'shop': sh, 'element': 'Product', 'sub': '', 'value_pkr': 0, 'code': c, 'part': q.get('part') or '',
                         'model': q.get('model') or '', 'units': round(a), 'asof': asof})
    json.dump(out_rows, open(out, 'w'), separators=(',', ':'))
    tot = collections.defaultdict(float)
    for r in out_rows:
        if r['month'] == cur and r['element'] not in ('Volume', 'Product'): tot[r['element']] += r['value_pkr']
    print(json.dumps({'asof': asof, 'months': months, 'rows': len(out_rows), 'inhouse_parts_left_out': len(made),
                      'current_month_pkr_m': {k: round(v / 1e6, 1) for k, v in tot.items() if k != 'Labour detail'}}))


if __name__ == '__main__':
    main(*sys.argv[1:6])
