"""Builds atlas_vendor_supply.json (daily receipts and schedule by vendor and part), atlas_vendor_sched.json (monthly vendor schedules)
and atlas_child_stock.json (child-part stock, safety and stock at vendor) from the latest '@@VSUP' dump in this session's transcript
(written by vsup_dump.js). Prints a short summary."""
import json, glob, os, re

def _text_of(raw):
    """Tool result text: a JSON-quoted string, maybe followed by the '(captured at ...)' note."""
    t = raw.split('\n\n(captured')[0].strip()
    if t.startswith('"'):
        try: t = json.loads(t)
        except Exception: return None
    return t if isinstance(t, str) else None

def find_dump():
    """vsup_dump.js keeps its text in window.__VS; it is read back in pieces that start with '@@CHUNK<n>|'.
    Collect the pieces in transcript order (inline or saved to a file) and join the latest complete run starting at 0."""
    seq = []
    for T in glob.glob('/root/.claude/projects/*/*.jsonl') + glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
        for l in open(T, errors='ignore'):
            if '@@CHUNK' not in l and 'saved to /' not in l: continue
            try: o = json.loads(l)
            except Exception: continue
            if o.get('type') != 'user': continue
            def walk(x):
                if isinstance(x, str):
                    m = re.search(r'saved to (/\S+?\.txt)', x)
                    if m and os.path.exists(m.group(1)) and not x.lstrip('"').startswith('@@CHUNK'):
                        raw = open(m.group(1), errors='ignore').read()
                        if '@@CHUNK' not in raw[:200]: return
                        try: raw = json.loads(raw)[0]['text']
                        except Exception: pass
                        t = _text_of(raw)
                    else:
                        t = _text_of(x) if x.lstrip().lstrip('"').startswith('@@CHUNK') else None
                    if t and t.startswith('@@CHUNK'):
                        k, body = t.split('|', 1); seq.append((int(k[7:]), body.rstrip('#')))
                elif isinstance(x, dict): [walk(v) for v in x.values()]
                elif isinstance(x, list): [walk(v) for v in x]
            walk(o)
    best = None
    for i, (k, _) in enumerate(seq):
        if k != 0: continue
        parts, n = [], 0
        for kk, b in seq[i:]:
            if kk == n: parts.append(b); n += 1
            elif kk == 0 and n: break
        txt = ''.join(parts)
        if txt.startswith('@@VSUP') and '##R' in txt: best = txt
    return best

import sys
txt = open(sys.argv[1], encoding='utf-8').read().rstrip('#') if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else find_dump()   # 5 Nov: SAP fallback passes a dump file
if not txt: print('NO_VSUP_DUMP'); raise SystemExit(1)
head, sec, cur = {}, {}, None
for ln in txt.split('\n')[1:]:
    if ln.startswith('##'): cur = ln[2:]; sec[cur] = []; continue
    if cur is None and '=' in ln: k, v = ln.split('=', 1); head[k] = v
    elif ln: sec[cur].append(ln)
SHOP = {'clutch': 'Clutch', 'cushion': 'Cushion', 'carb': 'Carburetor', 'dgs': 'Drum Gear', 'bft': 'Bridge Fork Top', 'ign': 'Ignition Coil',
        'polymer': 'Polymer', 'cif': 'CIF Machining', 'carbchildparts': 'Carb Child Parts', 'hubs': 'Hubs', 'hpdc': 'HPDC / Die Cast',
        'fuelcock': 'Fuel Cock', 'piston': 'Piston'}
sa = head.get('stock_asof', ''); asof = sa[:4] + '-' + sa[4:6] + '-' + sa[6:8] if len(sa) == 8 else sa
vn = {}
for ln in sec.get('V', []):
    c, n = (ln.split('|') + [''])[:2]; vn[c] = n.strip() or c
parts = {}
for ln in sec.get('P', []):
    code, shop, cls, safety, qty, vst, desc = (ln.split('|') + [''] * 7)[:7]
    parts[code] = dict(code=code, part=desc, shop=SHOP.get(shop, shop.title() or 'Other'), source='In-house' if 'HOUSE' in cls.upper() else 'Vendor',
                       safety_stock=int(float(safety or 0)), stock=int(float(qty or 0)), vendor_stock=int(float(vst or 0)), asof=asof)
bom = {}
if os.path.exists('atlas_bom.json'):
    try:
        for r in json.load(open('atlas_bom.json')): bom[str(r.get('code'))] = dict(part=r.get('part', ''), shop=r.get('shop') or 'Other')
    except Exception: pass
def info(code): return parts.get(code) or bom.get(code) or {}
sup = []
for ln in sec.get('R', []):
    d, v, code, r, s = (ln.split('|') + [''] * 5)[:5]
    p = info(code)
    sup.append(dict(date=d, vendor=vn.get(v, v), code=code, shop=p.get('shop', 'Other'), received=int(r or 0), scheduled=int(s or 0)))
sch = []
for ln in sec.get('S', []):
    m, v, code, q = (ln.split('|') + [''] * 4)[:4]
    p = info(code)
    sch.append(dict(month=m, vendor_code=v, vendor=vn.get(v, v), code=code, part=p.get('part', ''), shop=p.get('shop', 'Other'), schedule=int(q or 0)))
# --- 22 Oct: match Atlas's vendor view. Atlas takes the schedule from its Schedule Entry (S.schedule), spread evenly over
# its working days up to the last receiving day, and counts outsourced (OSP) receipts from its rejection feed. ---
_W = {}
for ln in sec.get('W', []):
    m, d = (ln.split('|') + [''])[:2]; _W[m] = [int(x) for x in d.split(',') if x]
_sm = {r['month'] for r in sch}
for r in sup:
    if r['date'][:7] in _sm: r['scheduled'] = 0           # replaced by Atlas's own schedule below
sup = [r for r in sup if r['received'] or r['scheduled']]
for r in sch:
    days = _W.get(r['month']) or []
    if r['schedule'] <= 0 or not days: continue
    q, n = r['schedule'], len(days); base = q // n; extra = q - base * n
    for k, d in enumerate(days):
        v = base + (1 if k < extra else 0)
        if v: sup.append(dict(date=f"{r['month']}-{d:02d}", vendor=r['vendor'], code=r['code'], shop=r['shop'], received=0, scheduled=v, plan=1))
_m = (head.get('months') or '').split(',')[-1]
_schv = {}
for r in sch:
    if r['month'] == _m: _schv.setdefault(r['code'], r['vendor_code'])
_rto = max((r['date'] for r in sup if r['date'].startswith(_m) and r['received']), default=f'{_m}-01')
for ln in sec.get('O', []):
    code, vc, tot, cum = (ln.split('|') + [''] * 4)[:4]; tot = int(float(tot or 0)); p = info(code)
    vend = vn.get(vc, vc) if vc else vn.get(_schv.get(code, ''), _schv.get(code, 'Outsourced (OSP)'))
    cum = [int(x) for x in cum.split(',') if x != '']
    prev, got = 0, 0
    for d, c in enumerate(cum, 1):
        q = c - prev; prev = max(prev, c)
        if q > 0: sup.append(dict(date=f'{_m}-{d:02d}', vendor=vend, code=code, shop=p.get('shop', 'Other'), received=q, scheduled=0, osp=1)); got += q
    if tot - got > 0: sup.append(dict(date=_rto, vendor=vend, code=code, shop=p.get('shop', 'Other'), received=tot - got, scheduled=0, osp=1))
# Atlas only counts parts in its part master or schedule (receipts for other codes are left out of its vendor view)
_known = set(parts) | {r['code'] for r in sch}
sup = [r for r in sup if r['code'] in _known]
# one row per date / vendor / part (schedule and receipts together); OSP receipts keep their own flagged row
_g = {}
for r in sup:
    k = (r['date'], r['vendor'], r['code'], 1 if r.get('osp') else 0)
    if k in _g: _g[k]['received'] += r['received']; _g[k]['scheduled'] += r['scheduled']
    else:
        _g[k] = dict(date=r['date'], vendor=r['vendor'], code=r['code'], shop=r['shop'], received=r['received'], scheduled=r['scheduled'])
        if r.get('osp'): _g[k]['osp'] = 1
sup = list(_g.values())
sup.sort(key=lambda r: (r['date'], r['vendor'], r['code']))
# vendors per child part (from schedules and receipts) for the stock table
pv = {}
for r in sch + sup: pv.setdefault(r['code'], set()).add(r['vendor'])
stock = []
for p in parts.values():
    q = dict(p); q['vendors'] = ' / '.join(sorted(pv.get(p['code'], []))); stock.append(q)
stock.sort(key=lambda r: (r['shop'], r['part']))
# --- 23 Oct (Umair): SAP posts Carb Child Parts in-house production as Alsons receipts on the same vendor part codes.
# Alsons' actual supply = SAP receipt less in-house production of the matching in-house code (month to date, never below 0).
ALSONS_IH = {  # Alsons vendor code: in-house code(s) of the same part (Carb Child Parts shop)
    '3010410030': ['9010410007'], '3010410031': ['9010410011'], '3010410032': ['6510410005'], '3010410033': ['9010410009'],
    '3010410034': ['9010410006'], '3010410039': ['9010410010'], '3020410002': ['9020410009'], '3020410032': ['9020410011'],
    '3020410035': ['9020410010'], '3020410049': ['9020410012'], '3090410001': ['9090410002'], '3090410005': ['6590410001', '9090410001']}
# Screw Stop CD70 and Screw Drain: machined in-house, plated at a vendor (Adamjee) and received back as the plated code,
# which is the part equivalent to Alsons'. For these the in-house quantity is the plated receipts, not the machining output.
ALSONS_PLATED = {'3010410032': ['9010410008'], '3090410005': ['9090410001']}
# 6 Nov (Umair): FCB CD70. In-house FCBs (9010410012, Carb Child Parts) go out on OSP and come back as receipts on the vendor
# code 3010410021, the same code the vendor's own supply arrives on. Same netting as Alsons, for any vendor on that code:
# 3010410021 then counts vendor supply only and 9010410012 in-house production only.
OSP_IH = {'3010410021': ['9010410012']}
def alsons_net(sup, pdaily):
    """sup: vendor supply rows; pdaily: atlas_parts_daily rows. Rewrites Alsons 'received' on ALSONS_IH codes (keeps SAP figure in received_sap)."""
    import collections
    prod = collections.defaultdict(lambda: collections.defaultdict(int))
    for x in pdaily:
        c = str(x.get('code'))
        for vc, ih in {**ALSONS_IH, **OSP_IH}.items():
            if c in ih and x.get('prod_actual'): prod[vc][x['date']] += int(x['prod_actual'] or 0)
    for vc, pc_codes in ALSONS_PLATED.items():
        prod[vc] = collections.defaultdict(int)
        for r in sup:
            if r['code'] in pc_codes and not r.get('ih_adj'): prod[vc][r['date']] += int(r.get('received_sap', r['received']) or 0)
    months = {r['date'][:7] for r in sup}
    for vc in [*ALSONS_IH, *OSP_IH]:
        for m in months:
            rows = sorted([r for r in sup if r['code'] == vc and r['date'][:7] == m and (vc in OSP_IH or 'ALSONS' in str(r['vendor']).upper())], key=lambda r: r['date'])
            pdm = {d: q for d, q in prod[vc].items() if d[:7] == m}
            if not rows or not pdm: continue
            dates = sorted({r['date'] for r in rows} | set(pdm))
            rc = pc = net = 0; by = collections.defaultdict(list)
            for r in rows: by[r['date']].append(r)
            for d in dates:
                rc += sum(int(r.get('received_sap', r['received']) or 0) for r in by.get(d, [])); pc += pdm.get(d, 0)
                cum = max(0, rc - pc)  # Alsons actual month to date = SAP receipts to date less in-house production to date
                inc = cum - net; net = cum
                for r in by.get(d, []):
                    sap = int(r.get('received_sap', r['received']) or 0); r['received_sap'] = sap
                    take = max(0, min(sap, inc)); r['received'] = take; inc -= take
                if inc:  # production posted on a day without enough receipts: book the difference as an adjustment that day
                    tpl = rows[0]; sup.append(dict(date=d, vendor=tpl['vendor'], code=vc, shop=tpl['shop'], received=inc, scheduled=0, received_sap=0, ih_adj=1))
    return sup
_pdf = 'new_atlas_parts_daily.json' if os.path.exists('new_atlas_parts_daily.json') else 'atlas_parts_daily.json'
if os.path.exists(_pdf):
    try: alsons_net(sup, json.load(open(_pdf))); sup.sort(key=lambda r: (r['date'], r['vendor'], r['code']))
    except Exception as e: print('alsons net skipped:', e)
else: print('alsons net skipped: no atlas_parts_daily.json')
_cur = (head.get('months') or '').split(',')[-1]
if _cur and not any(str(r.get('date', '')).startswith(_cur) and r.get('received') for r in sup):
    print('NO_VSUP_DUMP: Atlas receiving feed returned no receipts for ' + _cur + '; keeping the dashboard\'s current vendor data'); raise SystemExit(1)
# 3 Nov (Umair): receipts must never go down. For any month where the dashboard's current file holds more received units
# than this dump (Atlas no longer reads the full past month), keep the dashboard's rows for that month.
if os.path.exists('prev_atlas_vendor_supply.json'):
    try:
        _prev = json.load(open('prev_atlas_vendor_supply.json')); _sum = lambda rs, mo: sum(x.get('received') or 0 for x in rs if str(x.get('date', '')).startswith(mo))
        for _mo in sorted({str(x.get('date', ''))[:7] for x in _prev}):
            if _sum(_prev, _mo) > _sum(sup, _mo):
                sup = [x for x in sup if not str(x.get('date', '')).startswith(_mo)] + [x for x in _prev if str(x.get('date', '')).startswith(_mo)]
                print('kept dashboard rows for', _mo)
    except Exception as e: print('prev merge skipped', e)
json.dump(sup, open('atlas_vendor_supply.json', 'w'), separators=(',', ':'))
json.dump(sch, open('atlas_vendor_sched.json', 'w'), separators=(',', ':'))
json.dump(stock, open('atlas_child_stock.json', 'w'), separators=(',', ':'))
print(json.dumps(dict(vendor_supply=len(sup), vendor_sched=len(sch), child_stock=len(stock), months=head.get('months'), stock_asof=asof,
                      rcv_to=max((r['date'] for r in sup if r['received']), default=''))))
