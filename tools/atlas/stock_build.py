"""Builds atlas_stock_critical.json, atlas_shop_parts.json, atlas_vendors.json and atlas_part_stock.json from the latest '@@STOCK' dump
in this session's transcript (written by stock_dump.js). Prints a short summary."""
import json, glob, os

import re as _re
def _spilled(s, tag):
    """A large tool result is saved to a file and the transcript only holds its path. Read the dump from that file."""
    m = _re.search(r'saved to (/\S+?\.txt)', s)
    if not m or not os.path.exists(m.group(1)): return None
    try:
        raw = open(m.group(1), errors='ignore').read()
        if tag not in raw: return None
        try: arr = json.loads(raw); t = arr[0]['text'] if isinstance(arr, list) else raw
        except Exception: t = raw
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
        t = t.rstrip('#')   # padding used to spill a large result to a file
        return t if t.startswith(tag) else None
    except Exception: return None

def find_dump():
    best = None
    for T in glob.glob('/root/.claude/projects/*/*.jsonl') + glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
        for l in open(T, errors='ignore'):
            if '@@STOCK' not in l and 'saved to /' not in l: continue
            try: o = json.loads(l)
            except Exception: continue
            def walk(x):
                nonlocal best
                if isinstance(x, str):
                    if 'saved to /' in x and not x.strip().startswith(('@@STOCK','"@@STOCK')):
                        sp = _spilled(x, '@@STOCK')
                        if sp and '##PARTS' in sp: best = sp
                        return
                    s = x.strip()
                    if s.startswith('"@@STOCK'):
                        try: s = json.loads(s.split('\n\n(captured')[0])
                        except Exception: return
                    if isinstance(s, str) and s.startswith('@@STOCK') and '##PARTS' in s: best = s
                elif isinstance(x, dict): [walk(v) for v in x.values()]
                elif isinstance(x, list): [walk(v) for v in x]
            walk(o)
    return best

import sys
txt = open(sys.argv[1], encoding='utf-8').read().rstrip('#') if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else find_dump()   # 5 Nov: SAP fallback passes a dump file
if not txt: print('NO_STOCK_DUMP'); raise SystemExit(1)
head, sec, cur = {}, {}, None
for ln in txt.split('\n')[1:]:
    if ln.startswith('##'): cur = ln[2:]; sec[cur] = []; continue
    if cur is None and '=' in ln: k, v = ln.split('=', 1); head[k] = v
    elif ln: sec[cur].append(ln)
SHOP = {'clutch': 'Clutch', 'cushion': 'Cushion', 'carb': 'Carburetor', 'dgs': 'Drum Gear', 'bft': 'Bridge Fork Top', 'ign': 'Ignition Coil',
        'polymer': 'Polymer', 'cif': 'CIF Machining', 'carbchildparts': 'Carb Child Parts', 'hubs': 'Hubs', 'hpdc': 'HPDC / Die Cast',
        'fuelcock': 'Fuel Cock', 'piston': 'Piston'}
asof = head.get('stock_asof') or head.get('rcv_to')
rcv_to = head.get('rcv_to') or asof
day = int(rcv_to[8:10]) if rcv_to else 1; last = int(head.get('lastRcvDay') or 26)
frac = min(day, last) / last

parts = []
for ln in sec.get('PARTS', []):
    code, shop, cls, safety, qty, vst, desc = (ln.split('|') + [''] * 7)[:7]
    parts.append(dict(code=code, shop=SHOP.get(shop, shop.title() or 'General'), cls=cls, safety=int(float(safety or 0)),
                      stock=int(float(qty or 0)), vendor_stock=int(float(vst or 0)), part=desc))
codes = {p['code'] for p in parts}
# supply by material (all vendors) and by vendor
mat, ven = {}, {}
# 6 Nov (Umair): in-house FCB CD70 (9010410012) comes back from OSP as receipts on the vendor code 3010410021; take the
# in-house quantity (month to date) out of that code's receipts so it counts vendor supply only (same rule as vsup_build).
OSP_IH = {'3010410021': ['9010410012'], '3020410048': ['9020410016']}; _ihq = {}
try:
    _m0 = (head.get('month') or '')
    _pdf = 'new_atlas_parts_daily.json' if os.path.exists('new_atlas_parts_daily.json') else 'atlas_parts_daily.json'
    for _x in (json.load(open(_pdf)) if _m0 and os.path.exists(_pdf) else []):
        for _vc, _ih in OSP_IH.items():
            if str(_x.get('code')) in _ih and str(_x.get('date', '')).startswith(_m0): _ihq[_vc] = _ihq.get(_vc, 0) + (_x.get('prod_actual') or 0)
except Exception as _e: print('osp net skipped:', _e)
for ln in sec.get('VEND', []):
    vcode, mcode, name, s, r = (ln.split('|') + [''] * 5)[:5]; s = float(s or 0); r = float(r or 0)
    if mcode in _ihq and r: _t = min(r, _ihq[mcode]); r -= _t; _ihq[mcode] -= _t
    a = mat.setdefault(mcode, [0, 0]); a[0] += s; a[1] += r
    v = ven.setdefault(vcode, dict(vendor=name, vendor_code=vcode.zfill(10), parts=set(), month_schedule=0, received_mtd=0))
    v['parts'].add(mcode); v['month_schedule'] += s; v['received_mtd'] += r

crit = []
for p in parts:
    if p['safety'] <= 0: continue
    p['cover_pct'] = round(100 * (p['stock'] + p['vendor_stock']) / p['safety'])
    if p['cover_pct'] < 50:
        crit.append(dict(shop=p['shop'], code=p['code'], part=p['part'], safety_stock=p['safety'], stock=p['stock'], vendor_stock=p['vendor_stock'], cover_pct=p['cover_pct'], asof=asof))
crit.sort(key=lambda r: (r['shop'], r['cover_pct']))

shops = {}
for p in parts:
    if p['shop'] == 'General': continue
    o = shops.setdefault(p['shop'], dict(shop=p['shop'], child_parts=0, with_safety_level=0, below_safety=0, below_half_safety=0,
                                         supply_tracked=0, supply_on_track=0, supply_behind=0, _pcts=[]))
    o['child_parts'] += 1
    if p['safety'] > 0:
        o['with_safety_level'] += 1
        if p['cover_pct'] < 100: o['below_safety'] += 1
        if p['cover_pct'] < 50: o['below_half_safety'] += 1
    s, r = mat.get(p['code'], [0, 0])
    if s > 0:
        pct = 100 * r / (s * frac); o['supply_tracked'] += 1; o['_pcts'].append(min(pct, 200))
        if pct >= 95: o['supply_on_track'] += 1
        elif pct < 80: o['supply_behind'] += 1
sp = []
for o in shops.values():
    pc = o.pop('_pcts'); o['avg_supply_mtd_pct'] = round(sum(pc) / len(pc)) if pc else None; o['asof'] = asof; sp.append(o)

vend = []
for v in ven.values():
    exp = v['month_schedule'] * frac
    vend.append(dict(vendor=v['vendor'], vendor_code=v['vendor_code'], parts=len(v['parts']), month_schedule=round(v['month_schedule']),
                     received_mtd=round(v['received_mtd']), compliance_pct=round(100 * v['received_mtd'] / exp) if exp else None, asof=rcv_to))
vend.sort(key=lambda r: r['vendor'])

json.dump(crit, open('atlas_stock_critical.json', 'w'), separators=(',', ':'))
# 3 Nov (Umair): until the new month has a vendor schedule, keep the last month's supply figures per shop
if os.path.exists('prev_atlas_shop_parts.json'):
    try:
        _old = {r['shop']: r for r in json.load(open('prev_atlas_shop_parts.json'))}
        for r in sp:
            o = _old.get(r['shop'])
            if o and not r.get('supply_tracked') and o.get('supply_tracked'):
                for k in ('supply_tracked', 'supply_on_track', 'supply_behind', 'avg_supply_mtd_pct'): r[k] = o.get(k)
                r['supply_asof'] = o.get('supply_asof') or o.get('asof')
    except Exception: pass
json.dump(sp, open('atlas_shop_parts.json', 'w'), separators=(',', ':'))
if head.get('rcv_to'): json.dump(vend, open('atlas_vendors.json', 'w'), separators=(',', ':'))
else: print('atlas_vendors.json not written: Atlas receiving feed was empty; upload the other stock files only')
pstk, seen = [], set()
for ln in sec.get('PSTK', []):
    c, q, ss = (ln.split('|') + ['0', '0'])[:3]
    sv = int(float(ss or 0)) or next((p['safety'] for p in parts if p['code'] == c), 0)
    pstk.append(dict(code=c, stock=int(float(q or 0)), safety=sv or None, asof=asof)); seen.add(c)
for p in parts:  # system safety level for planned parts that have no stock line today
    if p['code'] not in seen and p['safety'] > 0: pstk.append(dict(code=p['code'], stock=None, safety=p['safety'], asof=asof))
if pstk: json.dump(pstk, open('atlas_part_stock.json', 'w'), separators=(',', ':'))
print(json.dumps(dict(stock_asof=asof, rcv_to=rcv_to, critical=len(crit), shops=len(sp), vendors=len(vend), part_stock=len(pstk))))
