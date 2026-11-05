"""Build sp_attendance.json (by area / section / day) and sp_attendance_people.json (per person per month) from the latest
'@@ATT' dump in this session's transcript (also when the tool result was saved to a file). Months already in
./sp_attendance_people_prev.json (the dashboard's current copy, if downloaded) are kept unless the new dump has them,
so the 3-month figures build up as the workbook moves to a new month. Prints a summary."""
import json, glob, os, re, sys
SHOP = {'CARBURETOR PRECISION PARTS': 'Carb Child Parts', 'CLUTCH': 'Clutch', 'CLUTCH PRESS': 'Clutch', 'HUB MACHINING': 'Hubs',
        'DRUM GEAR SHIFT': 'Drum Gear', 'IGNITION COIL': 'Ignition Coil', 'CARBURETOR': 'Carburetor', 'PISTON': 'Piston',
        'CAST IRON FOUNDRY': 'CIF Machining', 'DIE CASTING': 'HPDC / Die Cast', 'KEIHIN DIE CASTING': 'Carburetor', 'ALUMINIUM FOUNDRY': 'Aluminium Foundry'}
def _spilled(s):
    m = re.search(r'saved to (/\S+?\.txt)', s)
    if not m or not os.path.exists(m.group(1)): return None
    try:
        raw = open(m.group(1), errors='ignore').read()
        if '@@ATT' not in raw: return None
        try: arr = json.loads(raw); t = arr[0]['text'] if isinstance(arr, list) else raw
        except Exception: t = raw
        t = t.split('\n\n(captured')[0].strip()
        if t.startswith('"'): t = json.loads(t)
        return t if t.startswith('@@ATT') else None
    except Exception: return None
def find():
    best = None
    for T in glob.glob('/root/.claude/projects/*/*.jsonl') + glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')):
        for l in open(T, errors='ignore'):
            if '@@ATT' not in l and 'saved to /' not in l: continue
            try: o = json.loads(l)
            except Exception: continue
            st = [o]
            while st:
                x = st.pop()
                if isinstance(x, str):
                    s = x
                    if 'saved to /' in s and '@@ATT' not in s[:20]:
                        sp = _spilled(s)
                        if sp: best = sp.rstrip('#')
                        continue
                    if s.startswith('"@@ATT'):
                        try: s = json.loads(s.split('\n\n(captured')[0])
                        except Exception: continue
                    if isinstance(s, str) and s.startswith('@@ATT'): best = s.rstrip('#')
                elif isinstance(x, dict): st.extend(x.values())
                elif isinstance(x, list): st.extend(x)
    return best
d = find()
if not d: sys.exit('NO_ATT')
agg_txt, _, ppl_txt = d.partition('\n##P\n')
sec = lambda s: (s if s != '?' else 'General').title()
rows = []
for ln in agg_txt.split('\n')[2:]:
    if not ln: continue
    a, s, dt, hc, p, ab, lv, off, oth, ot, otn = ln.split('|')
    rows.append(dict(date=dt, area=a.title(), section=sec(s), shop=SHOP.get(a, a.title()),
                     headcount=int(hc), present=float(p), absent=float(ab), leave=float(lv), off=float(off), other=float(oth),
                     ot_hours=float(ot), ot_people=int(otn)))
rows.sort(key=lambda r: (r['date'], r['area'], r['section']))
# 5 Nov (Umair): the attendance workbook changed to 'Daily Attendance.xlsx' (November on); earlier months come from
# ./sp_attendance_prev.json (the dashboard's current copy, if downloaded) so the daily file keeps building up too.
if os.path.exists('sp_attendance_prev.json'):
    try:
        _nm = {r['date'][:7] for r in rows}
        rows = [r for r in json.load(open('sp_attendance_prev.json')) if r['date'][:7] not in _nm] + rows
    except Exception: pass
json.dump(rows, open('sp_attendance.json', 'w'), separators=(',', ':'))
_last = max(r['date'][:7] for r in rows); _cur = [r for r in rows if r['date'].startswith(_last)]
P = sum(r['present'] for r in _cur); A = sum(r['absent'] for r in _cur)
summary = dict(rows=len(rows), months=sorted({r['date'][:7] for r in rows}), days=f"{_cur[0]['date']}..{_cur[-1]['date']}", absent_pct=round(100 * A / max(1, P + A), 1), ot_hours=round(sum(r['ot_hours'] for r in _cur)))
# per person per month (working-day present / absent / leave; overtime on all days)
ppl = []
for ln in ppl_txt.split('\n'):
    if not ln: continue
    f = ln.split('|'); m, eid, nm, a, s, g, p, ab, lv, ot, otd = f[:11]
    row = dict(month=m, emp_id=eid, name=nm, area=a.title(), section=sec(s), shop=SHOP.get(a, a.title()), grade=g,
               present=float(p), absent=float(ab), leave=float(lv), ot_hours=float(ot), ot_days=int(otd))
    if len(f) >= 14:   # overtime while absent (28 Oct): OT hours in weeks with an absence, absent days in weeks with OT, days absent with OT
        row.update(ot_in_abs_weeks=float(f[11]), abs_in_ot_weeks=float(f[12]), absent_with_ot_days=int(f[13]))
    ppl.append(row)
if ppl:
    new_m = {r['month'] for r in ppl}
    if os.path.exists('sp_attendance_people_prev.json'):
        ppl += [r for r in json.load(open('sp_attendance_people_prev.json')) if r['month'] not in new_m]
    ppl.sort(key=lambda r: (r['month'], r['area'], r['section'], r['name']))
    json.dump(ppl, open('sp_attendance_people.json', 'w'), separators=(',', ':'))
    summary.update(people=sum(1 for r in ppl if r['month'] == max(new_m)), people_months=sorted({r['month'] for r in ppl}))
else: summary.update(people='none in dump (old att_dump.js?)')
print(json.dumps(summary))
