"""Scheduled-run refresh. Inputs in the working dir: atlas_parts_daily.json, atlas_parts.json, atlas_bom.json, atlas_issues.json
(downloaded from the dashboard artifact) and the latest '@@REFRESH' dump in this session's transcript.
Writes new_*.json files and prints a summary JSON."""
import json, glob, os, sys, calendar

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
            if '@@REFRESH' not in l and 'saved to /' not in l: continue
            try: o = json.loads(l)
            except Exception: continue
            st = [o]
            while st:
                x = st.pop()
                if isinstance(x, str):
                    s = x
                    if 'saved to /' in s and '@@REFRESH' not in s[:20]:
                        sp = _spilled(s, '@@REFRESH')
                        if sp and '##ISS' in sp: best = sp
                        continue
                    if s.startswith('"@@REFRESH'):
                        try: s = json.loads(s.split('\n\n(captured')[0])
                        except Exception: continue
                    if isinstance(s, str) and s.startswith('@@REFRESH') and '##ISS' in s: best = s
                elif isinstance(x, dict): st.extend(x.values())
                elif isinstance(x, list): st.extend(x)
    return best
dump = find_dump()
if not dump: sys.exit('NO_DUMP')
sec, cur, head = {}, None, {}
for ln in dump.split('\n')[1:]:
    if ln.startswith('##'): cur = ln[2:]; sec[cur] = []; continue
    if cur is None: k, v = ln.split('=', 1); head[k] = v
    elif ln: sec[cur].append(ln)
asof = head['asof']; m = asof[:7]; nd = calendar.monthrange(int(m[:4]), int(m[5:]))[1]
parts = {p['code']: p for p in json.load(open('atlas_parts.json'))}
arr = lambda s: ([int(float(x or 0)) for x in s.split(',')] if s else []) + [0] * nd
rows = [r for r in json.load(open('atlas_parts_daily.json')) if not r['date'].startswith(m)]
for ln in sec.get('PD', []):
    f = (ln.split('|') + [''] * 5)[:5]; c = f[0]
    if c not in parts: continue
    P, A, SP, SA = (arr(x)[:nd] for x in f[1:5]); fg = parts[c]['type'] == 'Finished'
    for i in range(nd):
        d = f'{m}-{i+1:02d}'; fut = d > asof
        if P[i] == 0 and (SP[i] == 0 or not fg) and (fut or (A[i] == 0 and (SA[i] == 0 or not fg))): continue
        r = dict(date=d, code=c, prod_plan=P[i], prod_actual=None if fut else A[i])
        if fg: r.update(disp_plan=SP[i], disp_actual=None if fut else SA[i])
        rows.append(r)
rows.sort(key=lambda r: (r['date'], r['code']))
json.dump(rows, open('new_atlas_parts_daily.json', 'w'), separators=(',', ':'))
rcv = []
for ln in sec.get('RCV', []):
    code, a = ln.split('|')
    for i, q in enumerate(a.split(',')):
        q = int(float(q or 0))
        if q: rcv.append(dict(date=f'{m}-{i+1:02d}', code=code, received=q))
# 3 Nov (Umair): keep earlier months' receipts so the dashboard's previous-month views stay complete
if os.path.exists('atlas_vendor_rcv.json'):
    try: rcv = [r for r in json.load(open('atlas_vendor_rcv.json')) if not str(r.get('date', '')).startswith(m)] + rcv
    except Exception: pass
json.dump(rcv, open('new_atlas_vendor_rcv.json', 'w'), separators=(',', ':'))
sch = dict(ln.split('|') for ln in sec.get('SCH', []))
bom = json.load(open('atlas_bom.json'))
for b in bom: b['sched_oct'] = int(float(sch.get(b['code'], 0) or 0))  # field holds the CURRENT month's vendor schedule
json.dump(bom, open('new_atlas_bom.json', 'w'), separators=(',', ':'))
old = json.load(open('atlas_issues.json')); byname = {r['item']: r for r in old}; nid = max([r['id'] for r in old] + [0]) + 1
for ln in sec.get('ISS', []):
    _, item, shop, pri, status, meet, prob, note = (ln.split('|') + [''] * 8)[:8]
    r = byname.get(item)
    if r:
        if meet and meet > r.get('last_meeting', ''): r.update(last_meeting=meet, problem=prob, status_note=note)
        if not r.get('closed_by') and not r.get('opened_by'): r['status'] = status or r['status']  # closed or reopened by Umair on the dashboard stays as he set it
        if pri and pri != r.get('priority') and not r.get('priority_by'): r['priority'] = pri   # a priority Umair set on the dashboard stays
    else:
        old.append(dict(id=nid, item=item, shop=shop or 'General', priority=pri or 'Not set', status=status or 'open', last_meeting=meet, problem=prob, status_note=note)); nid += 1
json.dump(old, open('new_atlas_issues.json', 'w'), separators=(',', ':'))
import datetime as _dt
data_to = asof; _t = (_dt.datetime.utcnow() + _dt.timedelta(hours=5)).strftime('%Y-%m-%d')
if _t[:7] == m and _t > asof: asof = _t  # plan runs to today (PKT); actuals stay at data_to
oc = [r for r in rows if r['date'].startswith(m) and r['date'] <= asof]; S = lambda k: sum(r.get(k) or 0 for r in oc)
print(json.dumps(dict(asof=asof, data_to=data_to, month=m, pd_rows=len(rows), rcv_rows=len(rcv), issues=len(old),
  prod_pct=round(100 * S('prod_actual') / max(1, S('prod_plan')), 1), disp_pct=round(100 * S('disp_actual') / max(1, S('disp_plan')), 1))))
# --- Sanity guard (21 Oct): Atlas's Production tab can return bad data. Compare the new production/dispatch
# with what the dashboard already holds; if past days changed a lot or MTD dropped, write nothing and stop.
try:
    prev = json.load(open('atlas_parts_daily.json'))
except Exception:
    prev = []
def _tot(rs, k):
    t = {}
    for r in rs:
        if r['date'].startswith(m) and r['date'] < _t and r.get(k) is not None: t[r['date']] = t.get(r['date'], 0) + (r.get(k) or 0)
    return t
problems = []
for k, lbl in (('prod_actual', 'production'), ('disp_actual', 'dispatch')):
    o, n = _tot(prev, k), _tot(rows, k)
    recent = sorted(o)[-2:]  # the last two loaded days may still grow (late postings, or a bad day being corrected)
    for d, ov in sorted(o.items()):
        nv = n.get(d, 0)
        if ov >= 1000 and nv < ov - max(500, 0.10 * ov): problems.append(f'{lbl} {d}: was {ov:,}, Atlas now {nv:,}')
        elif ov >= 1000 and d not in recent and nv > ov + max(500, 0.10 * ov): problems.append(f'{lbl} {d}: was {ov:,}, Atlas now {nv:,}')
    os_, ns_ = sum(o.values()), sum(v for d, v in n.items() if d in o)
    if os_ and ns_ < 0.97 * os_: problems.append(f'{lbl} MTD for days already loaded fell from {os_:,} to {ns_:,}')
    last = max(n) if n else None
    if last and n[last] == 0 and any(v > 0 for v in list(o.values())[-3:]): problems.append(f'{lbl} {last}: zero')
if problems:
    import os
    for f in ('new_atlas_parts_daily.json', 'new_atlas_vendor_rcv.json', 'new_atlas_bom.json', 'new_atlas_issues.json'):
        try: os.remove(f)
        except OSError: pass
    print('ABNORMAL_DATA ' + json.dumps(problems[:12]))
    raise SystemExit(2)
