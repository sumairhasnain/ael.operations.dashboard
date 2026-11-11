"""Merge Atlas's still-working feeds into the SAP-mode data (Umair, 9 Nov 2026).
While Atlas's daily bridge (/ppc-daily) is down, /ppc-feeds?month=YYYY-MM still updates during the day:
  prod  = PPC_Prd_Compliance (month-to-date production per material, asOf a date)
  rcv   = BI_API_Vendor_Sch_Rec (daily receipts and schedule per vendor and material)
The MB51 file is exported once a morning, so these feeds are often ahead of it.
  sales = AHL sales (month-to-date dispatch per material)
Rules: receipts are only ever raised (per day, code and vendor), never lowered. Production and dispatch per code are raised to
Atlas's month-to-date (counting our days up to Atlas's asOf); the difference goes on the asOf day, since the feeds have no days.
(11 Nov 2026, Umair: the sales feed was being left out, so the dashboard showed less dispatch than Atlas. Always merge it.)
Codes outside atlas_parts_daily / atlas_vendor_supply are left alone (merged codes are already combined).
Usage: python3 atlas_feed_merge.py <afeed dump> <data dir | parts_daily.json,vendor_supply.json> <plan_dump.txt (vendor names)>
The dump is '@@AFEED' text: ##P code|qty, ##S code|qty, ##R date|code|vendor|receipt|schedule, from the Atlas tab.
"""
import json, sys, collections

def load(path):
    t = open(path).read()
    if not t.startswith('@@AFEED'):
        try: t = json.loads(t)[0]['text']
        except Exception: pass
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
    t = t.rstrip('#')
    sec = lambda n: [l for l in t.split('##' + n + '\n')[1].split('\n##')[0].split('\n') if l and not l.startswith('#')]
    return sec

def main(dump, data, plan):
    sec = load(dump)
    try: meta = dict(l.split('=', 1) for l in sec('M'))
    except Exception: meta = {}
    asof = meta.get('asof')
    P = {l.split('|')[0]: float(l.split('|')[1]) for l in sec('P')}
    # merged codes (same map as atlas_from_sap.py / atlas_dump.js): variants are summed into the dashboard's code
    MERGE = {'9010118004': '9010118003', '9010118005': '9010118003', '9010118006': '9010118003', '9020118002': '9020118003', '9030118001': '9030118000'}
    P2 = {}
    for c, q in P.items(): P2[MERGE.get(c, c)] = P2.get(MERGE.get(c, c), 0) + q
    P = P2
    Sl = {}
    for l in sec('S'):
        c, q = l.split('|')[:2]; c = MERGE.get(c, c); Sl[c] = Sl.get(c, 0) + float(q or 0)
    R = [l.split('|') for l in sec('R')]
    if not asof: asof = max(r[0] for r in R)
    pdp, vsp = data.split(',') if ',' in data else (data + '/atlas_parts_daily.json', data + '/atlas_vendor_supply.json')
    pd = json.load(open(pdp)); v = json.load(open(vsp))
    pt = open(plan).read(); V = dict(l.split('|', 1) for l in pt.split('##V\n')[1].split('\n##')[0].split('\n') if '|' in l)
    m = asof[:7]; mtd = collections.defaultdict(float); idx = {}
    for i, r in enumerate(pd):
        if r['date'].startswith(m) and r['date'] <= asof: mtd[r['code']] += r.get('prod_actual') or 0
        idx[(r['code'], r['date'])] = i
    codes = {r['code'] for r in pd}; padd = []
    for c, a in P.items():
        if c in codes and a > mtd[c] + 0.5:
            d = a - mtd[c]; k = (c, asof)
            if k in idx: pd[idx[k]]['prod_actual'] = (pd[idx[k]].get('prod_actual') or 0) + d
            else: pd.append({'date': asof, 'code': c, 'prod_plan': 0, 'prod_actual': d, 'disp_plan': 0, 'disp_actual': None}); idx[k] = len(pd) - 1
            padd.append((c, round(d)))
    # dispatch: same rule as production, on disp_actual (Atlas AHL sales feed)
    mtdd = collections.defaultdict(float)
    for r in pd:
        if r['date'].startswith(m) and r['date'] <= asof: mtdd[r['code']] += r.get('disp_actual') or 0
    dadd = []
    for c, a in Sl.items():
        if c in codes and a > mtdd[c] + 0.5:
            d = a - mtdd[c]; k = (c, asof)
            if k in idx: pd[idx[k]]['disp_actual'] = (pd[idx[k]].get('disp_actual') or 0) + d
            else: pd.append({'date': asof, 'code': c, 'prod_plan': 0, 'prod_actual': None, 'disp_plan': 0, 'disp_actual': d}); idx[k] = len(pd) - 1
            dadd.append((c, round(d)))
    miss = round(sum(a for c, a in Sl.items() if c not in codes))
    known = {str(r['code']) for r in v}; shop = {str(r['code']): r.get('shop') for r in v}; vi = {}
    for i, r in enumerate(v): vi[(r['date'], str(r['code']), r['vendor'])] = i
    agg = collections.defaultdict(float)
    for dt, c, vd, rc, sc in R:
        if c in known and float(rc) > 0: agg[(dt, c, V.get(vd, vd))] += float(rc)
    radd = 0
    for (dt, c, vn), q in agg.items():
        if (dt, c, vn) in vi:
            r = v[vi[(dt, c, vn)]]
            if q > (r.get('received') or 0) + 0.5: radd += q - (r.get('received') or 0); r['received'] = round(q)
        else:
            tot = sum((v[i].get('received') or 0) for kk, i in vi.items() if kk[0] == dt and kk[1] == c)
            if q > tot + 0.5: v.append({'date': dt, 'vendor': vn, 'code': c, 'shop': shop.get(c), 'received': round(q - tot), 'scheduled': 0}); radd += q - tot
    json.dump(pd, open(pdp, 'w'), separators=(',', ':')); json.dump(v, open(vsp, 'w'), separators=(',', ':'))
    print(json.dumps({'asof': asof, 'prod_added': sum(x[1] for x in padd), 'prod_codes': padd, 'disp_added': sum(x[1] for x in dadd), 'disp_codes': dadd, 'sales_not_on_dashboard': miss, 'rcv_added': round(radd)}))

if __name__ == '__main__':
    main(*sys.argv[1:4])
