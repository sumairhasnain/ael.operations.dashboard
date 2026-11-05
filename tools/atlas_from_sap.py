"""SAP fallback for the Atlas refresh (Umair, 5 Nov 2026). When Atlas's SAP bridge (/bapi-proxy, /ppc-daily) is down, rebuild the
Atlas-fed datasets from the daily SAP MB51 file (and MB52 when given), using Atlas's own plans, schedules, part master and
Problems list read from the Atlas page (which still works without the bridge).

Usage: python3 atlas_from_sap.py <plan dump> <mb51 dump> <out dir> [--mb52 <mb52 stock json>] [--prev-stock atlas_part_stock.json]

plan dump : '@@PLAN' text from the Atlas page (plan_dump.js): fg/ih/sales plan days per code, vendor schedules, working days,
            part master (code|shop|cls|safety|desc|cat), vendor names, OSP vendors, Problems list.
mb51 dump : '@@MB51' pipe text (Material|Desc|Qty|PostDate|Amt|CC|Supplier|MT|UoM|Sloc|Plant) from tools/mb51_extract.js.
mb52 json : optional list of {code, qty, value, safety?} rows (tools/mb52_extract.js) for stock; else stock lines come from
            --prev-stock (the dashboard's last atlas_part_stock.json) so the stock files keep their last known figures.

Writes into <out dir> three dumps in exactly the formats the live scripts consume, so refresh_live.py, stock_build.py and
vsup_build.py run unchanged (same sanity guards):
  refresh_dump.txt  (@@REFRESH: ##PD plan|actual|salesplan|salesactual by day, ##RCV, ##SCH, ##ISS)
  stock_dump.txt    (@@STOCK: ##PARTS, ##VEND, ##PSTK)
  vsup_dump.txt     (@@VSUP: ##V, ##P, ##S, ##W, ##O, ##R)
How Atlas defines the figures (checked 5 Nov against Atlas's own feed: 159 of 160 production codes exact):
  production  = 101 less 102 on production orders  (receipts with NO supplier), by part and posting day
  dispatch    = -(601 + 602) quantities, by part and posting day
  vendor rcpt = 101 less 102 WITH a supplier, by vendor, part and posting day
  merged codes and pass-through parts as in atlas_dump.js (merge map / pt set)
"""
import sys, json, collections, calendar, os

MERGE = {'9010118004': '9010118003', '9010118005': '9010118003', '9010118006': '9010118003', '9020118002': '9020118003', '9030118001': '9030118000'}
PT = {'9010118003', '9020118003', '9090218002', '9090218001', '9070331000'}   # pass-through: production = dispatch

def text_of(path):
    raw = open(path, encoding='utf-8').read()
    if not raw.startswith('@@'):
        try: t = json.loads(raw)[0]['text']
        except Exception: t = raw
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
        raw = t
    return raw.rstrip('#')

def sections(txt):
    head, sec, cur = {}, {}, None
    for ln in txt.split('\n')[1:]:
        if ln.startswith('##'): cur = ln[2:]; sec[cur] = []; continue
        if cur is None and '=' in ln: k, v = ln.split('=', 1); head[k] = v
        elif ln and cur: sec[cur].append(ln)
    return head, sec

def main():
    a = sys.argv[1:]; plan_p, mb51_p, out = a[0], a[1], a[2]
    mb52 = a[a.index('--mb52') + 1] if '--mb52' in a else None
    prev_stock = a[a.index('--prev-stock') + 1] if '--prev-stock' in a else None
    os.makedirs(out, exist_ok=True)
    head, S = sections(text_of(plan_p))
    m = head['month']; nd = calendar.monthrange(int(m[:4]), int(m[5:]))[1]
    lrd = head.get('lastRcvDay', '26'); months = head.get('months', m).split(',')
    strip = lambda c: str(c).lstrip('0')
    # --- MB51 by day ---
    prod = collections.defaultdict(lambda: [0.0] * nd); disp = collections.defaultdict(lambda: [0.0] * nd)
    rcv = collections.defaultdict(lambda: [0.0] * nd); rcv_v = collections.defaultdict(float)   # (vendor, code) -> qty month to date
    rcv_vd = collections.defaultdict(float)   # (date, vendor, code)
    last_day = m + '-01'
    for ln in text_of(mb51_p).split('\n'):
        f = ln.split('|')
        if len(f) < 10 or f[0].startswith(('@@', 'file', 'month', 'cols')): continue
        try: q = float(f[2])
        except ValueError: continue
        code, d, sup, mt = strip(f[0]), f[3], f[6].strip(), f[7]
        if not d.startswith(m): continue
        i = int(d[8:10]) - 1; last_day = max(last_day, d)
        if mt in ('101', '102'):
            s = q if mt == '101' else -q
            if sup: rcv[code][i] += s; rcv_v[(strip(sup), code)] += s; rcv_vd[(d, strip(sup), code)] += s
            else: prod[code][i] += s
        elif mt in ('601', '602'): disp[code][i] += -q
    # --- plans ---
    P, SP = {}, {}
    for ln in S.get('PLAN', []):
        k, c, days = (ln.split('|') + [''] * 3)[:3]; arr = [int(x) for x in days.split(',') if x] + [0] * nd
        if k in ('fg', 'ih'): P.setdefault(c, arr[:nd])
        elif k == 'sp': SP[c] = arr[:nd]
    by = {}
    for c0 in set(P) | set(prod) | set(SP) | set(disp):
        c = MERGE.get(c0, c0); o = by.setdefault(c, [[0] * nd for _ in range(4)])
        for k, arr in enumerate((P.get(c0), prod.get(c0), SP.get(c0), disp.get(c0))):
            if arr:
                for i in range(nd): o[k][i] += arr[i]
    enc = lambda a: ','.join(str(int(round(x))) for x in a).rstrip(',0') if any(a) else ''
    def enc2(a):
        b = [int(round(x)) for x in a]
        while b and not b[-1]: b.pop()
        return ','.join(str(x) for x in b)
    pd_lines = []
    for c, v in by.items():
        if c in PT: v[1] = v[3][:]
        s = [enc2(x) for x in v]
        if any(s): pd_lines.append('|'.join([c] + s))
    # Atlas's receiving view only counts the child parts in its part master (partCodeSet); checked 5 Nov: 99 of 100 codes exact
    known = {ln.split('|')[0] for ln in S.get('PARTS', []) if ln}
    rcv_lines = [c + '|' + enc2(a) for c, a in rcv.items() if any(a) and c in known]
    rcv_v = {k: v for k, v in rcv_v.items() if k[1] in known}
    rcv_vd = {k: v for k, v in rcv_vd.items() if k[2] in known}
    sch = collections.defaultdict(float); sch_rows = []
    for ln in S.get('SCH', []):
        mm, v, c, q = (ln.split('|') + [''] * 4)[:4]
        if mm == m: sch[c] += float(q or 0)
        sch_rows.append(ln)
    iss = S.get('ISS', [])
    refresh = ['@@REFRESH', 'asof=' + last_day, 'live=sap-mb51 rcv=sap-mb51', 'lastRcvDay=' + lrd, '##PD', *pd_lines, '##RCV', *rcv_lines,
               '##SCH', *[f'{c}|{int(round(q))}' for c, q in sch.items()], '##ISS', *iss]
    open(os.path.join(out, 'refresh_dump.txt'), 'w', encoding='utf-8').write('\n'.join(refresh))
    # --- stock ---
    parts = {}
    for ln in S.get('PARTS', []):
        c, shop, cls, safety, desc, cat = (ln.split('|') + [''] * 6)[:6]; parts[c] = dict(shop=shop, cls=cls, safety=int(float(safety or 0)), desc=desc)
    st = {}; stock_asof = ''
    if mb52:
        for r in json.load(open(mb52)):
            c = strip(r.get('code', '')); st[c] = dict(qty=float(r.get('qty') or 0), safety=int(float(r.get('safety') or 0)), vst=int(r.get('vendor_stock') or 0))
        stock_asof = json.load(open(mb52))[0].get('asof', '') if st else ''
    elif prev_stock and os.path.exists(prev_stock):
        for r in json.load(open(prev_stock)):
            st[strip(r['code'])] = dict(qty=float(r.get('stock') or 0), safety=int(r.get('safety') or 0)); stock_asof = r.get('asof', stock_asof)
    vn = {}
    for ln in S.get('V', []):
        v, n = (ln.split('|') + [''])[:2]; vn[v] = n
    PL = [f"{c}|{p['shop']}|{p['cls']}|{st.get(c, {}).get('safety') or p['safety']}|{int(round(st.get(c, {}).get('qty', 0)))}|{st.get(c, {}).get('vst', 0)}|{p['desc']}" for c, p in parts.items()]
    g = {}
    for ln in S.get('SCH', []):
        mm, v, c, q = (ln.split('|') + [''] * 4)[:4]
        if mm != m: continue
        k = v + '|' + c; g.setdefault(k, [vn.get(v, v), 0.0, 0.0]); g[k][1] += float(q or 0)
    for (v, c), q in rcv_v.items():
        if q: k = v + '|' + c; g.setdefault(k, [vn.get(v, v), 0.0, 0.0]); g[k][2] += q
    VL = [f'{k}|{o[0]}|{int(round(o[1]))}|{int(round(o[2]))}' for k, o in g.items()]
    PSTK = [f"{c}|{int(round(o['qty']))}|{o['safety']}" for c, o in st.items()]
    stock = ['@@STOCK', 'month=' + m, 'stock_asof=' + (stock_asof or last_day), 'rcv_to=' + last_day, 'lastRcvDay=' + lrd, '##PARTS', *PL, '##VEND', *VL, '##PSTK', *PSTK]
    open(os.path.join(out, 'stock_dump.txt'), 'w', encoding='utf-8').write('\n'.join(stock))
    # --- vendor supply (current month from MB51; earlier months are kept by vsup_build from the dashboard's file) ---
    R = [f'{d}|{v}|{c}|{int(round(q))}|0' for (d, v, c), q in sorted(rcv_vd.items()) if q]
    osp = S.get('OSP', [])
    vsup = ['@@VSUP', 'months=' + ','.join(months), 'stock_asof=' + (stock_asof or last_day).replace('-', ''), 'lastRcvDay=' + lrd,
            '##V', *[f'{k}|{v}' for k, v in vn.items()], '##P', *PL, '##S', *sch_rows, '##W', *S.get('W', []), '##O', '##R', *R]
    open(os.path.join(out, 'vsup_dump.txt'), 'w', encoding='utf-8').write('\n'.join(vsup))
    print(json.dumps(dict(month=m, data_to=last_day, pd=len(pd_lines), rcv_codes=len(rcv_lines), rcv_rows=len(R), issues=len(iss), stock_codes=len(st),
                          stock_source='mb52' if mb52 else ('previous' if st else 'none'))))

if __name__ == '__main__':
    main()
