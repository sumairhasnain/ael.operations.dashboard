"""Merge Atlas's still-working feeds into the SAP-mode data (Umair, 9 Nov 2026).
While Atlas's daily bridge (/ppc-daily) is down, /ppc-feeds?month=YYYY-MM still updates during the day:
  prod  = PPC_Prd_Compliance (month-to-date production per material, asOf a date)
  rcv   = BI_API_Vendor_Sch_Rec (daily receipts and schedule per vendor and material)
The MB51 file is exported once a morning, so these feeds are often ahead of it.
Rules: receipts are only ever raised (per day, code and vendor), never lowered. Production per code is raised to Atlas's
month-to-date (counting our days up to Atlas's asOf); the difference goes on the asOf day, since the feed has no days.
Codes outside atlas_parts_daily / atlas_vendor_supply are left alone (merged codes are already combined).
Usage: python3 atlas_feed_merge.py <afeed dump> <data dir> <plan_dump.txt (vendor names)>
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
    meta = dict(l.split('=', 1) for l in sec('M')) if '##M' in open(dump).read() else {}
    asof = meta.get('asof')
    P = {l.split('|')[0]: float(l.split('|')[1]) for l in sec('P')}
    R = [l.split('|') for l in sec('R')]
    if not asof: asof = max(r[0] for r in R)
    pdp = data + '/atlas_parts_daily.json'; vsp = data + '/atlas_vendor_supply.json'
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
    print(json.dumps({'asof': asof, 'prod_added': sum(x[1] for x in padd), 'prod_codes': padd, 'rcv_added': round(radd)}))

if __name__ == '__main__':
    main(*sys.argv[1:4])
