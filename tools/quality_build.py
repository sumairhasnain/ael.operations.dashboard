"""Quality tab dataset from SAP (19 Nov 2026, Umair).

Usage: python3 quality_build.py <mb51q dump.txt> [<wide mb51q dump.txt>] <mb52 dump.txt> <data dir> <out quality_sap.json>

Inputs
  mb51q dump   tools/mb51q_extract.js on the newest MB51 file (quality movement types with Text / Reference / entry time)
  wide dump    optional, the same extract on a wide MB51 export (adds Material Document, vendor name, PO, user)
  mb52 dump    tools/mb52_extract.js text (current QI / blocked / rejection-store stock)
  data dir     dashboard data folder: sap_bom.json, atlas_parts.json, atlas_bom.json, atlas_stock_critical.json, sap_bom_cost.json
How SAP shows quality here
  101 with supplier ........ goods receipt = one lot (part + vendor + posting date + Reference / DC)
  321 / 322 ................ QI decision (and its reversal). Into a rejection store = rejected at inspection, else released OK
  350 ...................... QI to blocked (rejected at inspection)
  311 / 312 into a rej store transfer of rejected stock (text says INHOUSE REJECTION or VENDOR REJECTION-<name>)
  344 / 343 ................ unrestricted -> blocked (hold) and back (release)
  122 / 123 ................ return to vendor (text carries the defect and DC number) and its reversal
  551-556 .................. scrap
  Rejection stores: KHI 0009, KHI 0012, SKP 0007, SKP 0012.
SAP has no defect codes: the defect name is cleaned from the posting text and grouped into a defect type by keywords.
Cp / Cpk, line-rejection defect logs and warranty claims are not in SAP; the page shows them as waiting for a QC file."""
import json, re, sys, os, collections, datetime as dt

REJ = {('KHI', '0009'), ('KHI', '0012'), ('SKP', '0007'), ('SKP', '0012')}
strip = lambda c: str(c).strip().lstrip('0') or str(c).strip()

def read_dump(p):
    L = open(p, encoding='utf-8').read().rstrip('#').split('\n')
    head = {}; cols = None; rows = []
    for l in L:
        if l.startswith('@@'): continue
        if cols is None:
            if l.startswith('cols='): cols = l[5:].split('|'); continue
            if '=' in l: k, v = l.split('=', 1); head[k] = v; continue
        if l and cols: rows.append(dict(zip(cols, l.split('|'))))
    return head, rows

def num(x):
    try: return float(str(x).replace(',', ''))
    except ValueError: return 0.0

# ---------------- defect text -> name / type ----------------
TYPES = [
    ('Leakage', r'LEAK'),
    ('Crack / Breakage', r'CRACK|BROKEN|BREAK|DAMAG|BEND|BENT|DEFORM|CHIP'),
    ('Plating / Surface', r'CHROME|PLATING|PLATE THICK|RUST|DENT|SCRATCH|PAINT|FINISH|BLOW ?HOLE|POROS|PIN ?HOLE|SURFACE|BURR|SPOT|FLASH'),
    ('Dimensional', r'SIZE|LENGTH|DIA|HEIGHT|THICK|WIDTH|SHORT|LONG|LOOSE|TIGHT|STEP|OVAL|RUN ?OUT|FLATNESS|BORE|THREAD|PITCH|ANGLE|GAP|N\.?G'),
    ('Missing / Assembly', r'MISS|GROMMET|GROMONT|PUNCH|WRONG|MIX|ASSY|ASSEMBL|TILT|JAM'),
    ('Material / Hardness', r'HARD|MATERIAL|SOFT|BRITTLE|COMPOSITION'),
    ('Process allowance', r'ALLOWANCE'),
]
def defect_of(text, ref=''):
    t = (text or '').upper().replace('&AMP;', '&')
    if not t or re.fullmatch(r'[\d\s\-*/.#,]+', t): return '', '', ''
    if re.match(r'^(SM|OK|RACK|MAIL REF|RETURN TO VENDOR|RPS|INHOUSE REJECTIO|VENDOR REJECTION|KD#)', t) or re.search(r'\bOK\b', t):
        if t.startswith('INHOUSE REJECTIO'): return 'In-house rejection (no defect named)', 'Unspecified', ''
        if t.startswith('VENDOR REJECTION'): return 'Vendor rejection (no defect named)', 'Unspecified', ''
        if t.startswith('RETURN TO VENDOR'): return 'Return to vendor (no defect named)', 'Unspecified', ''
        return '', '', ''
    cls = ''
    m = re.match(r'^\s*(?:100%\s*,?\s*)?([ABC])\s*[-,]\s*', t)
    if m: cls = m.group(1); t = t[m.end():]
    t = re.sub(r'\b\d{6}\b', ' ', t)                                    # vendor / GRN numbers
    t = re.sub(r'\(?\b\d{4,6}-[A-Z .]+\)?', ' ', t)                       # (28368-ILYAS) inspector + GRN
    t = re.sub(r'D\.?C\s*#?\s*[:\-]?\s*[A-Z]*-?\d+', ' ', t)               # DC#UAI-10362
    t = re.sub(r'100\s*%', ' ', t); t = re.sub(r'\(VD\)|\(EQ REJ\)\.?', ' ', t)
    t = re.sub(r'\b\d+(\.\d+)?\b', ' ', t); t = re.sub(r'[\*#()]+', ' ', t)
    t = re.sub(r'\s*,\s*', ', ', t); t = re.sub(r'\s+', ' ', t).strip(' ,.-&')
    if not t: return '', '', cls
    name = t.title().replace(' Ng', ' NG').replace('Ng ', 'NG ')
    if name == 'NG': name = 'Not good (no detail)'
    typ = next((k for k, rx in TYPES if re.search(rx, t)), 'Other')
    return name[:60], typ, cls

def vendor_in_text(text, names):
    t = (text or '').upper()
    for c in re.findall(r'\b(\d{6})\b', t):
        if c in names: return c
    m = re.search(r'VENDOR REJECTION-?\s*([A-Z&]+)', t)
    if m:
        w = m.group(1)
        hit = [c for c, n in names.items() if n.upper().startswith(w)]
        if len(hit) == 1: return hit[0]
    return ''

def main(args):
    if len(args) == 5: qn, qw, m52, ddir, outp = args
    else: qn, m52, ddir, outp = args; qw = None
    J = lambda f: json.load(open(os.path.join(ddir, f)))
    names = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sap_vendor_names.json')))
    head, R = read_dump(qn)
    # -------- enrich from the wide export (Material Document, vendor name, PO, user) --------
    W = {}
    if qw and os.path.exists(qw):
        _, RW = read_dump(qw)
        for r in RW:
            k = (r['Material'], r['Movement Type'], r['Plant'], r['Storage Location'], r['Posting Date'], r['Time of Entry'], r['Qty in unit of entry'])
            W.setdefault(k, r)
            if r.get('Supplier') and r.get('Name 1'): names.setdefault(strip(r['Supplier']), r['Name 1'])
    # -------- part master: BOM level, FG, shop, source, critical --------
    bom = J('sap_bom.json')[0]; ap = {str(x['code']): x for x in J('atlas_parts.json')}
    ab = {str(x['code']): x for x in J('atlas_bom.json')}
    crit = {str(x['code']): x for x in J('atlas_stock_critical.json')}
    fgshop = {f['fg']: f['shop'] for f in bom['fgs']}; fgname = {f['fg']: f['part'] for f in bom['fgs']}
    lvl = {}; fgs = collections.defaultdict(set); parent = {}
    for f in bom['fgs']: lvl[f['fg']] = 0; fgs[f['fg']].add(f['fg'])
    for t in bom['tree']:
        c = str(t['code']); l = int(t['lvl'])
        if c not in lvl or l < lvl[c]: lvl[c] = l; parent[c] = str(t['parent'])
        fgs[c].add(t['fg'])
    for c, x in ap.items():
        if x.get('type') == 'Finished': lvl.setdefault(c, 0); fgs[c].add(c)
    rates = J('sap_bom_cost.json')[0].get('rates', {}); sst = {}
    unit = {}
    for x in J('sap_stock.json'):
        if x.get('code'): sst.setdefault(strip(x['code']), x)
        if x.get('code') and x.get('unit_pkr'): unit.setdefault(strip(x['code']), x['unit_pkr'])
    def rate(c):   # SAP issue rate (sap_bom_cost), else the MB52 stock unit value (sap_stock)
        r = rates.get(c) or {}
        return r.get('rate') or r.get('rate_rcv') or unit.get(c) or 0
    # -------- collapse the +/- legs into single events --------
    PAIR = {'321', '322', '343', '344', '349', '350', '311', '312'}
    legs = collections.defaultdict(list); singles = []
    for r in R:
        mt = r['Movement Type']; q = num(r['Qty in unit of entry'])
        if mt in PAIR:
            legs[(r['Material'], mt, r['Plant'], r['Posting Date'], r['Time of Entry'], abs(q), r['Text'], r['Reference'])].append(r)
        else: singles.append(r)
    ev = []
    def base(r, mt, q, frm, to):
        w = W.get((r['Material'], r['Movement Type'], r['Plant'], r['Storage Location'], r['Posting Date'], r['Time of Entry'], r['Qty in unit of entry'])) or {}
        code = strip(r['Material']); sup = strip(r['Supplier']) if r['Supplier'] else ''
        if not sup: sup = vendor_in_text(r['Text'], names)
        dn, dty, dcl = defect_of(r['Text'], r['Reference'])
        return dict(d=r['Posting Date'], e=r['Entry Date'], t=r['Time of Entry'], code=code, part=r['Material Description'], mt=mt, qty=q, plant=r['Plant'],
                    frm=frm, to=to, vendor=sup, ref=r['Reference'], text=r['Text'], defect=dn, dtype=dty, dclass=dcl, uom=r['Base Unit of Measure'],
                    doc=w.get('Material Document', ''), po=w.get('Purchase order', ''), user=w.get('User Name', ''), amt=num(r['Amt.in Loc.Cur.']))
    for k, rs in legs.items():
        pos = [x for x in rs if num(x['Qty in unit of entry']) > 0]; neg = [x for x in rs if num(x['Qty in unit of entry']) < 0]
        for i in range(max(len(pos), len(neg))):
            p = pos[i] if i < len(pos) else None; n = neg[i] if i < len(neg) else None; r = p or n
            ev.append(base(r, k[1], k[5], (n or {}).get('Storage Location', ''), (p or {}).get('Storage Location', '')))
    for r in singles:
        q = num(r['Qty in unit of entry']); mt = r['Movement Type']
        ev.append(base(r, mt, q, r['Storage Location'] if q < 0 else '', r['Storage Location'] if q > 0 else ''))
    # -------- classify --------
    isrej = lambda plant, s: (plant, s) in REJ
    out = []; lots = []; prod = collections.Counter(); recv = collections.Counter(); recv_day = collections.Counter()
    for e in ev:
        mt, pl = e['mt'], e['plant']; q = abs(e['qty']); k = ''
        if mt == '101':
            if not re.fullmatch(r'\d{6,}|\d{4,5}-[\w-]+|[\w-]{6,}', e['code']) or not e['part']: continue
            if e['vendor']:
                if e['qty'] > 0:
                    lots.append(dict(code=e['code'], vendor=e['vendor'], d=e['d'], t=e['t'], ref=e['ref'], qty=e['qty'], plant=pl, sloc=e['to'], doc=e['doc'], po=e['po']))
                recv[(e['code'], e['vendor'])] += e['qty']; recv_day[(e['d'], e['vendor'])] += e['qty']
                continue
            if isrej(pl, e['to'] or e['frm']):
                if re.search(r'RPS', (e['text'] + e['ref']).upper()): k = 'return_rps'
                else: continue
            else: prod[e['code']] += e['qty']; continue
        elif mt == '102':
            if e['vendor']: recv[(e['code'], e['vendor'])] += e['qty']; recv_day[(e['d'], e['vendor'])] += e['qty']
            else: prod[e['code']] += e['qty']
            continue
        elif mt in ('321', '322'):
            to, frm = (e['to'], e['frm']) if mt == '321' else (e['frm'], e['to'])
            k = 'qi_reject' if isrej(pl, to) else 'qi_release'
            if mt == '322': q = -q
            e['to'], e['frm'] = to, frm
        elif mt in ('349', '350'): k = 'qi_reject'; q = q if mt == '350' else -q
        elif mt in ('311', '312'):
            to, frm = (e['to'], e['frm']) if mt == '311' else (e['frm'], e['to'])
            if isrej(pl, to) and not isrej(pl, frm): k = 'reject_transfer'
            elif isrej(pl, frm) and not isrej(pl, to): k = 'rej_store_out'
            else: continue
            if mt == '312': q = -q
            e['to'], e['frm'] = to, frm
        elif mt == '344': k = 'block'
        elif mt == '343': k = 'unblock'
        elif mt == '122': k = 'rtv'
        elif mt == '123': k = 'rtv'; q = -q
        elif mt in ('551', '553', '555'): k = 'scrap'
        elif mt in ('552', '554', '556'): k = 'scrap'; q = -q
        elif mt in ('701', '702'):
            if not isrej(pl, e['to'] or e['frm']): continue
            k = 'rej_count_adj'; q = e['qty']
        if not k: continue
        txt = (e['text'] + ' ' + e['ref']).upper()
        e['origin'] = 'vendor' if (e['vendor'] or 'VENDOR REJ' in txt) else 'inhouse'
        if 'INHOUSE' in txt: e['origin'] = 'inhouse'
        e['kind'] = k; e['q'] = q
        # rej: counts as rejected quantity; disp: how rejected stock left (return to vendor / scrap / moved out of the rejection store)
        e['rej'] = int(k in ('qi_reject', 'reject_transfer') or (k == 'rtv' and not isrej(pl, e['frm'])) or (k == 'scrap' and not isrej(pl, e['frm']))
                       or (k == 'rej_store_out' and re.search(r'INHOUSE REJ|VENDOR REJ', txt) is not None) or (k == 'scrap' and 'ALLOWANCE' in txt))
        e['disp'] = {'rtv': 'Returned to vendor', 'scrap': 'Scrapped', 'rej_store_out': 'Moved out of rejection store'}.get(k, '')
        m_ = re.search(r'(\d{2})?-?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[- ]?(\d{2})', txt)
        e['period'] = ('20' + m_.group(3) + '-' + '%02d' % (['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].index(m_.group(2)) + 1)) if m_ else e['d'][:7]
        e['val'] = round(q * rate(e['code']), 0) if k != 'rtv' or not e['amt'] else round(abs(e['amt']) * (1 if q >= 0 else -1), 0)
        out.append(e)
    out.sort(key=lambda e: (e['d'], e['t'], e['code']))
    # -------- lots: FIFO the QI decisions onto the receipts (per part + vendor) --------
    lots.sort(key=lambda x: (x['d'], x['t']))
    for x in lots: x.update(ok=0.0, rej=0.0, ok_d='', rej_d='', rtv=0.0, rtv_d='', scrap=0.0, rtv_defect='')
    byk = collections.defaultdict(list)
    for x in lots: byk[(x['code'], x['vendor'])].append(x)
    def fifo(key, qty, d, fld, dfld):
        for x in byk.get(key, []):
            if qty <= 1e-9: break
            if x['d'] > d: break
            free = x['qty'] - x['ok'] - x['rej'] if fld in ('ok', 'rej') else x['rej'] - x['rtv'] - x['scrap']
            if free <= 1e-9: continue
            take = min(free, qty); x[fld] += take; qty -= take
            x[dfld] = max(x[dfld], d) if x[dfld] else d
        return qty
    left = collections.Counter()
    for e in out:
        if e['origin'] != 'vendor' or not e['vendor'] or e['q'] <= 0: continue
        key = (e['code'], e['vendor'])
        if e['kind'] == 'qi_release': left['ok'] += fifo(key, e['q'], e['d'], 'ok', 'ok_d')
        elif e['kind'] in ('qi_reject', 'reject_transfer'): left['rej'] += fifo(key, e['q'], e['d'], 'rej', 'rej_d')
    QI_SLOC = {('KHI', '0001'), ('KHI', '0003'), ('KHI', '0023'), ('SKP', '0002'), ('KHI', '0015')}
    qi_pairs = {(e['code'], e['vendor']) for e in out if e['kind'] in ('qi_release', 'qi_reject') and e['vendor']}
    byref = collections.defaultdict(list)
    for x in lots: byref[(x['code'], x['vendor'])].append(x)
    for e in out:   # a return to vendor names its DC; tie it to that receipt, else to the latest receipt before it
        if e['kind'] != 'rtv' or e['q'] <= 0 or not e['vendor']: continue
        cand = [x for x in byref.get((e['code'], e['vendor']), []) if x['d'] <= e['d']]
        toks = set(re.findall(r'[A-Z]*-?\d{3,}', (e['text'] + ' ' + e['ref']).upper()))
        hit = [x for x in cand if x['ref'] and (x['ref'].upper() in toks or any(t.endswith(x['ref'].upper()) for t in toks))]
        x = (hit or cand[-1:] or [None])[-1]
        if x is None: e['lot_d'] = ''; continue
        x['rtv'] += e['q']; x['rtv_d'] = max(x['rtv_d'], e['d']) if x['rtv_d'] else e['d']; x['rtv_defect'] = e['defect']
        e['lot_d'] = x['d']; e['lot_ref'] = x['ref']; e['lot_qty'] = x['qty']; e['lot_match'] = 'DC' if hit else 'latest receipt'
        e['days_from_receipt'] = (dt.date.fromisoformat(e['d']) - dt.date.fromisoformat(x['d'])).days
    for x in lots:
        x['qi'] = (x['code'], x['vendor']) in qi_pairs
        x['open'] = round(max(0.0, x['qty'] - x['ok'] - x['rej']), 3) if x['qi'] else 0.0
        x['insp'] = bool(x['ok'] or x['rej'])
    # -------- rejection -> disposition (return / scrap) ageing, per part + vendor-or-inhouse --------
    pend = collections.defaultdict(list); disp = []
    for e in out:
        key = (e['code'], e['vendor'] if e['origin'] == 'vendor' else '')
        if e['kind'] in ('qi_reject', 'reject_transfer') and e['q'] > 0: pend[key].append([e['d'], e['q'], e])
        elif e['kind'] in ('rtv', 'scrap') and e['q'] > 0:
            q = e['q']
            for p in pend.get(key, []):
                if q <= 1e-9: break
                if p[1] <= 1e-9 or p[0] > e['d']: continue
                take = min(p[1], q); p[1] -= take; q -= take
                disp.append(dict(code=e['code'], vendor=key[1], rej_d=p[0], disp_d=e['d'], qty=take, how=e['kind'],
                                 days=(dt.date.fromisoformat(e['d']) - dt.date.fromisoformat(p[0])).days))
    asof = max((e['d'] for e in out if e['d'] <= head.get('mtime', '9')[:10]), default='')
    pend_open = []
    for key, ps in pend.items():
        for d0, q, e in ps:
            if q > 1e-9: pend_open.append(dict(code=key[0], vendor=key[1], rej_d=d0, qty=round(q, 3), days=(dt.date.fromisoformat(asof) - dt.date.fromisoformat(d0)).days if asof else 0, defect=e['defect']))
    # -------- holds: block (344) -> release (343) / scrap --------
    hold = []; hb = collections.defaultdict(list)
    for e in out:
        if e['kind'] == 'block': hb[e['code']].append([e['d'], e['q'], e])
        elif e['kind'] == 'unblock':
            q = e['q']
            for p in hb.get(e['code'], []):
                if q <= 1e-9: break
                if p[1] <= 1e-9: continue
                take = min(p[1], q); p[1] -= take; q -= take
                hold.append(dict(code=e['code'], from_d=p[0], to_d=e['d'], qty=take, how='released', days=(dt.date.fromisoformat(e['d']) - dt.date.fromisoformat(p[0])).days, reason=p[2]['text']))
    for c, ps in hb.items():
        for d0, q, e in ps:
            if q > 1e-9: hold.append(dict(code=c, from_d=d0, to_d='', qty=round(q, 3), how='open', days=(dt.date.fromisoformat(asof) - dt.date.fromisoformat(d0)).days if asof else 0, reason=e['text']))
    # -------- MB52: what is on hold right now --------
    mh, mrows = read_dump(m52); stock = []
    for r in mrows:
        pl, sl = r['Plant'], r['Sloc']; qi, bl, unr = num(r['QI']), num(r['Blocked']), num(r['Unr'])
        rej = unr if (pl, sl) in REJ else 0
        if not (qi or bl or rej): continue
        c = strip(r['Material'])
        stock.append(dict(code=c, part=r['Desc'], plant=pl, sloc=sl, sloc_name=r.get('SlocName', ''), qi=qi, blocked=bl, rej_store=rej, uom=r['UoM'], rate=rate(c)))
    # QI age: oldest receipt still un-inspected for that part
    oldest = {}
    for x in lots:
        if x['open'] > 0: oldest.setdefault(x['code'], (x['d'], x['vendor']))
    for s in stock:
        o = oldest.get(s['code'])
        s['qi_since'] = o[0] if (o and s['qi']) else ''; s['qi_vendor'] = o[1] if (o and s['qi']) else ''
        s['qi_days'] = (dt.date.fromisoformat(asof) - dt.date.fromisoformat(o[0])).days if (o and s['qi'] and asof) else None
    # -------- part master for every code that appears --------
    codes = {e['code'] for e in out} | {x['code'] for x in lots} | {s['code'] for s in stock} | set(prod)
    parts = {}
    for c in codes:
        a = ap.get(c) or {}; b = ab.get(c) or {}
        f = sorted(fgs.get(c, []))
        shop = a.get('shop') or b.get('shop') or (fgshop.get(f[0]) if f else '') or (sst.get(c) or {}).get('shop') or ''
        src = b.get('source') or ('In-house' if (a.get('type') or '').startswith(('Finished', 'In')) else '')
        if not src: src = 'Imported' if c[:2] in ('30', '50') and len(c) == 10 else ''
        parts[c] = dict(lvl=lvl.get(c), fg=f[:6], shop=shop, src=src, cat=(sst.get(c) or {}).get('category', ''), crit=c in crit, ss=(crit.get(c) or {}).get('safety_stock'), rate=round(rate(c), 2))
    for e in out:
        p = parts.get(e['code'], {})
        if not p.get('src'): p['src'] = 'Vendor' if e['origin'] == 'vendor' else 'In-house'
    vend = {}
    for v in {e['vendor'] for e in out if e['vendor']} | {x['vendor'] for x in lots}:
        vend[v] = names.get(v, '')
    rcv = [dict(code=c, vendor=v, qty=round(q, 3)) for (c, v), q in recv.items() if q]
    # -------- BOM drill: each FG's tree, kept only along branches that lead to a part with quality data --------
    qc = {e['code'] for e in out if e['kind'] != 'qi_release'} | {s['code'] for s in stock} | {x['code'] for x in lots if x['rej'] or x['open'] or x['rtv']}
    tree = {}
    byfg = collections.defaultdict(list)
    for t in bom['tree']: byfg[t['fg']].append(t)
    for fg, rows in byfg.items():
        kids = collections.defaultdict(list)
        for i, t in enumerate(rows): kids[str(t['parent'])].append(i)
        keep = set()
        def walk(i):
            t = rows[i]; c = str(t['code']); hit = c in qc
            for j in kids.get(c, []):
                if rows[j]['lvl'] == t['lvl'] + 1 and walk(j): hit = True
            if hit: keep.add(i)
            return hit
        top = [i for i, t in enumerate(rows) if t['lvl'] == 1]
        any_ = [walk(i) for i in top]
        if keep or fg in qc:
            tree[fg] = [[rows[i]['lvl'], str(rows[i]['code']), str(rows[i]['parent']), rows[i].get('qty_fg') or rows[i].get('qty'), rows[i]['part'][:48]] for i in sorted(keep)]
            for i in keep:
                c = str(rows[i]['code']); parts.setdefault(c, dict(lvl=rows[i]['lvl'], fg=[fg], shop=fgshop.get(fg, ''), src='', cat='', crit=c in crit, ss=None, rate=round(rate(c), 2)))
                parts[c].setdefault('name', rows[i]['part'])
    res = dict(asof=asof, month=asof[:7], file=head.get('file', ''), mtime=head.get('mtime', ''), mb52_file=mh.get('file', ''), mb52_mtime=mh.get('mtime', ''),
               rej_slocs=sorted('%s %s' % x for x in REJ),
               note='Built from SAP MB51 quality movements and MB52. Defect names come from SAP posting text; SAP holds no defect codes, Cp/Cpk or warranty data.',
               events=[{k: e[k] for k in ('d', 'e', 't', 'code', 'part', 'mt', 'kind', 'q', 'val', 'plant', 'frm', 'to', 'vendor', 'origin', 'ref', 'text', 'defect', 'dtype', 'dclass', 'uom', 'doc', 'po', 'user', 'rej', 'disp', 'period', 'lot_d', 'lot_ref', 'lot_qty', 'lot_match', 'days_from_receipt') if k in e} for e in out if e['kind'] != 'qi_release'],
               releases=[[e['d'], e['code'], e['vendor'], round(e['q'], 3), e['origin']] for e in out if e['kind'] == 'qi_release'],
               lots=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in x.items()} for x in lots],
               disp=disp, pending=pend_open, holds=hold, stock=stock, received=rcv, produced={c: round(q, 3) for c, q in prod.items() if q},
               parts=parts, vendors=vend, fg_names=fgname, fg_shop=fgshop, tree=tree,
               critical=[dict(code=str(x['code']), part=x['part'], shop=x['shop'], ss=x['safety_stock'], stock=x['stock'], vstock=x['vendor_stock'], cover=x['cover_pct']) for x in crit.values()])
    json.dump([res], open(outp, 'w'), separators=(',', ':'))
    K = collections.Counter(); KQ = collections.Counter()
    for e in out: K[e['kind']] += 1; KQ[e['kind']] += e['q']
    print(json.dumps(dict(asof=asof, events=len(out), kinds=dict(K), qty={k: round(v) for k, v in KQ.items()}, lots=len(lots), lots_qi=sum(1 for x in lots if x['qi']), lots_open=sum(1 for x in lots if x['open'] > 0), rej_qty=round(sum(e['q'] for e in out if e.get('rej'))), rtv_matched=sum(1 for e in out if e.get('lot_match')=='DC'),
                          disp=len(disp), pending=len(pend_open), holds=len(hold), stock_rows=len(stock), qi_total=round(sum(s['qi'] for s in stock)),
                          blocked_total=round(sum(s['blocked'] for s in stock)), rej_store_total=round(sum(s['rej_store'] for s in stock)),
                          defects=collections.Counter(e['dtype'] for e in out if e['dtype']).most_common(), size=os.path.getsize(outp))))

if __name__ == '__main__':
    main(sys.argv[1:])
