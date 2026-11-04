"""In-transit quantities: production posted by the casting and press shops (SAP 101 into their own storage locations)
that the main store has not yet received (315), net of what those shops issued straight to production orders from their
own location (261/262 from the shop location). Umair, 4 Nov 2026.

Usage: python3 sap_transit.py <mb51 dump .txt> [<more dumps>...] <out.json>
Dumps are '@@MB51' pipe text from tools/mb51_extract.js (Material|Desc|Qty|PostDate|Amt|CC|Supplier|MT|UoM|Sloc|Plant),
with movement types 101/102 (production receipt), 313/315 (two-step transfer to store), 261/262 (issue to production orders).
Only the month of each dump is used (each daily file is the full month to date); when two dumps hold the same month the
later one wins.

Shops by producing storage location (the shop posts 101 there):
  1006 HPDC / Die Cast · 1022 1023 1024 1025 CIF Casting · 1027 1021 Aluminium Foundry · 1031 Clutch Press
Parts that never reach the store (intermediate stages: molten metal, casted, fettled) are left out: a part is listed only
when the store received some of it (315) in the month, or it has a positive in-transit figure and received some last month.
in_transit = posted (101-102) - received by store (315) - sent to SPD (315 into 0008) - issued directly from the shop
             location (261-262); never below 0.
Store locations (Umair, 4 Nov): for Clutch Press only 0003 (main store) counts as received; transfers to any other
location (1004 clutch shop etc.) stay in transit. 0008 is the dispatch / finished-goods store (SPD spares and OEM sales both post from it): press plates and castings
received there were made for SPD or direct sale, not for in-house clutch and hub assembly, so they are excluded from
in-transit and shown separately as 'spd'.
The casting shops' output is received by other stores (HPDC -> 0015, Aluminium Foundry -> 1020, CIF -> 0023 / 0003), so
for them every 315 outside 0008 counts as received until Umair narrows it.
half_day   = posted / working days elapsed / 2 (days with any 101 for the shop); red when in_transit > half_day, else yellow.
"""
import json, sys, collections, datetime as dt

SL = {'1006': 'HPDC / Die Cast', '1022': 'CIF Casting', '1023': 'CIF Casting', '1024': 'CIF Casting', '1025': 'CIF Casting',
      '1027': 'Aluminium Foundry', '1021': 'Aluminium Foundry', '1031': 'Clutch Press'}
# dashboard shop filter values that reveal the card
DASH = {'HPDC / Die Cast': 'HPDC / Die Cast', 'CIF Casting': 'CIF Machining', 'Aluminium Foundry': 'Aluminium Foundry', 'Clutch Press': 'Clutch'}
SPD = {'0008'}                                   # dispatch / finished-goods store (SPD and OEM sales post from it): not in transit to the main store
STORE = {'Clutch Press': {'0003'}}               # locations that count as 'received by store' per shop; shops not listed: any location except SPD

def read(path):
    raw = open(path, encoding='utf-8').read()
    if not raw.startswith('@@MB51') and not raw.startswith('@@'):
        try: t = json.loads(raw)[0]['text']
        except Exception: t = raw
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
        raw = t.rstrip('#')
    rows = []
    for ln in raw.split('\n'):
        if not ln or ln.startswith(('@@', 'file=', 'month=', 'cols=')): continue
        f = ln.split('|')
        if len(f) < 10: continue
        rows.append((f[0].lstrip('0'), f[1], float(f[2] or 0), f[3], f[7], f[9]))   # code, desc, qty, date, mt, sloc
    return rows

def build(dumps, out):
    bym = {}
    try:
        kp = json.load(open(out)); kp = kp[0] if isinstance(kp, list) else kp; keep = kp.get('months', {})   # months already built (earlier files) stay unless a dump replaces them
    except Exception: keep = {}
    for p in dumps:
        rs = read(p)
        for m in {r[3][:7] for r in rs if r[3]}: bym[m] = [r for r in rs if r[3].startswith(m)]   # later dump wins
    months = sorted(bym)
    res = {'months': {k: v for k, v in keep.items() if k not in bym}, 'asof': None, 'shops': sorted(set(SL.values())), 'dash': DASH}
    prev_315 = {}
    pm = max((k for k in keep if k < months[0]), default=None) if months else None
    if pm: prev_315 = {i['code']: i['received'] for i in keep[pm]['items']}
    for m in months:
        rows = bym[m]
        posted = collections.defaultdict(float); rcv = collections.defaultdict(float); direct = collections.defaultdict(float); spd = collections.defaultdict(float)
        desc = {}; shop = {}; days101 = collections.defaultdict(set); last101 = {}; last315 = {}; daily = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
        for code, d, q, date, mt, sl in rows:
            if mt in ('101', '102') and sl in SL:
                posted[code] += q; shop.setdefault(code, SL[sl]); desc.setdefault(code, d)
                if mt == '101' and q > 0: days101[SL[sl]].add(date); last101[code] = max(last101.get(code, ''), date); daily[code][date][0] += q
            elif mt == '315' and q > 0:
                if sl in SPD: spd[code] += q; continue
                st = STORE.get(shop.get(code))
                if st and sl not in st: continue           # moved somewhere other than the store: still in transit
                rcv[code] += q; last315[code] = max(last315.get(code, ''), date); daily[code][date][1] += q
            elif mt in ('261', '262') and sl in SL:
                direct[code] += -q   # 261 negative in SAP, 262 positive
        items = []
        for code, p in posted.items():
            if p <= 0: continue
            r = rcv.get(code, 0.0); dd = max(0.0, direct.get(code, 0.0)); sp = spd.get(code, 0.0)
            if r <= 0 and sp <= 0 and prev_315.get(code, 0) <= 0: continue   # intermediate stage: never routed through the store
            transit = max(0.0, p - r - sp - dd)
            wd = max(1, len(days101.get(shop[code], ())))
            half = p / wd / 2
            items.append({'code': code, 'part': desc.get(code, ''), 'shop': shop[code], 'dash_shop': DASH[shop[code]],
                          'posted': round(p), 'received': round(r), 'direct': round(dd), 'spd': round(sp), 'in_transit': round(transit),
                          'half_day': round(half), 'flag': 'red' if transit > half else 'yellow',
                          'last_posted': last101.get(code), 'last_received': last315.get(code),
                          'days': sorted([[k, round(v[0]), round(v[1])] for k, v in daily[code].items()])})
        items.sort(key=lambda x: -x['in_transit'])
        res['months'][m] = {'items': items, 'working_days': {s: len(v) for s, v in days101.items()},
                            'to': max((r[3] for r in rows), default=None)}
        prev_315 = {c: rcv.get(c, 0) + spd.get(c, 0) for c in set(rcv) | set(spd)}
    res['asof'] = max(v['to'] for v in res['months'].values() if v.get('to')) if res['months'] else None
    json.dump([res], open(out, 'w'), separators=(',', ':'))   # one record, as a list like the other dataset files
    last = res['months'][months[-1]] if months else {'items': []}
    print(json.dumps({'months': months, 'asof': res['asof'], 'parts': len(last['items']),
                      'in_transit': sum(i['in_transit'] for i in last['items']),
                      'red': sum(1 for i in last['items'] if i['flag'] == 'red' and i['in_transit'] > 0)}))

if __name__ == '__main__':
    build(sys.argv[1:-1], sys.argv[-1])
