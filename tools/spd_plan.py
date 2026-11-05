"""Freeze the month's SPD supply plan (Umair, 5 Nov 2026: "pick up the SPD plan from this workbook and keep it frozen through November").
Usage: python3 spd_plan.py <spd dump .txt> <YYYY-MM> <out spd_plan_YYYY-MM.json> [frozen_at ISO]

Reads the sheet named like '01. SPD (Nov 26)' from the '@@SPD' dump (tools/spd_plan_extract.js; Asif Iqbal's 'SPD STATUS' workbook).
Header row: the row whose column D reads 'AAL SPD CODE' (C = AHL SPD code, D = AAL code, E = description, F = model, H = month demand,
I.. = days 1..31). The part group (column B) and responsibility (column G) are written only on a group's first row / total row, so they
are carried down. Rows without a 9xxxxxxxxx AAL code (group totals, blank lines) are skipped. Refuses to overwrite an existing frozen file.
"""
import sys, re, json, os, datetime

MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

def col_idx(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n

def col_name(n):
    s = ''
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

def main():
    dump, month, out = sys.argv[1:4]
    frozen_at = sys.argv[4] if len(sys.argv) > 4 else datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if os.path.exists(out): sys.exit(f'FROZEN: {out} already exists - the {month} plan is frozen and is not re-read')
    raw = open(dump, encoding='utf-8').read()
    if not raw.startswith('@@SPD'):
        t = json.loads(raw)[0]['text'].split('\n\n(captured')[0]
        raw = json.JSONDecoder().raw_decode(t)[0] if t.startswith('"') else t
    raw = raw.rstrip('#'); head = raw.split('\n', 1)[0]
    meta = {}
    try: meta = json.loads(head.split('|', 2)[2])
    except Exception: pass
    y, m = int(month[:4]), int(month[5:])
    want = re.compile(r'SPD\s*\(\s*' + MON[m - 1] + r'[a-z]*\s*' + str(y)[2:] + r'\s*\)', re.I)
    L = raw.split('\n'); s = next((i for i, l in enumerate(L) if l.startswith('##SHEET ') and want.search(l)), None)
    if s is None: sys.exit(f'NO_SHEET: no "SPD ({MON[m-1].title()} {str(y)[2:]})" sheet in the workbook')
    e = next((i for i in range(s + 1, len(L)) if L[i].startswith('##SHEET ')), len(L))
    rows = []
    for l in L[s + 1:e]:
        p = l.split('\t'); rows.append((int(p[0]), dict(x.split('=', 1) for x in p[1:] if '=' in x)))
    hdr = next((rn for rn, c in rows if c.get('D', '').strip().upper() == 'AAL SPD CODE'), None)
    if hdr is None: sys.exit('NO_HEADER: no row with "AAL SPD CODE" in column D')
    d1 = col_idx('I'); ndays = [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    days_cols = [col_name(d1 + k) for k in range(ndays)]
    grp, resp, items = '', '', []
    for rn, c in rows:
        if rn <= hdr: continue
        if c.get('B', '').strip(): grp = c['B'].strip(); resp = ''
        code = c.get('D', '').strip()
        if c.get('G', '').strip():
            resp = c['G'].strip()
            # the group's total row (below its parts) carries the responsibility (GMP / GMSC): give it to the group's parts
            if not re.fullmatch(r'9\d{9}', code):
                for it in items:
                    if it['group'] == grp and not it['resp']: it['resp'] = resp
        if not re.fullmatch(r'9\d{9}', code): continue
        days = [round(num(c.get(k))) for k in days_cols]
        items.append(dict(group=grp, code=code, ahl_code=c.get('C', '').strip(), desc=c.get('E', '').strip(), model=c.get('F', '').strip(),
                          resp=resp, plan=round(num(c.get('H'))), plan_days=days))
    if len(items) < 20: sys.exit(f'TOO_FEW: only {len(items)} plan lines found')
    # a code listed twice (5 Nov: 9170113004 Clutch Assy CG150 under both Cushion and Clutch Assy) becomes one line, so its
    # supply is not counted twice: plans are added and the line goes to the group named in its description, else the first one
    merged, dups = {}, []
    for it in items:
        o = merged.get(it['code'])
        if not o: merged[it['code']] = it; continue
        dups.append(it['code']); o['plan'] += it['plan']; o['plan_days'] = [a + b for a, b in zip(o['plan_days'], it['plan_days'])]
        if it['group'].upper() in it['desc'].upper() and o['group'].upper() not in o['desc'].upper(): o['group'], o['resp'] = it['group'], it['resp'] or o['resp']
    items = list(merged.values())
    doc = dict(month=month, frozen_at=frozen_at, source=dict(workbook=meta.get('name', ''), saved=meta.get('mod', ''), sheet=L[s][8:]), merged_duplicates=dups, items=items)
    json.dump(doc, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(dict(month=month, lines=len(items), groups=len({i['group'] for i in items}), plan=sum(i['plan'] for i in items),
                          phased=sum(sum(i['plan_days']) for i in items), workbook=meta.get('name'), saved=meta.get('mod'))))

if __name__ == '__main__':
    main()
