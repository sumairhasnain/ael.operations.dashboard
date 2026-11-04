"""F.O.M month from the daily SAP MB51 file (Umair, 4 Nov 2026).
Usage: python3 fom_mb51.py <fom.json> <mb51 dump .txt> <YYYY-MM> <out.json>

The dump is the '@@MB51' text that tools/mb51 extract_js builds from the SharePoint Portal Data/MB51 file
(pipe rows Material|Desc|Qty|PostDate|Amt|CC|Supplier|MT|UoM|Sloc|Plant, movement types 101/102/201/202/601/602).
Each F.O.M line = sum over its SAP codes of factor x quantity, exactly as the AEL F.O.M sheet does it:
  basis D (sales)      = -(601 + 602) quantity in the month
  basis P (production) =  (101 + 102) quantity in the month
Checked against the official October 2026 sheet: every line whose codes are all in the daily file matches to the unit.

The daily export covers plant KHI only. The sheet's own MB51 also had plant SKP (Sheikhupura), where the Cushion,
Oil Pump, Front Fork, Rear Cushion and SPD Vendor codes live (material groups 102 and 112). Until the export includes
SKP, lines with SKP codes are flagged: a line with KHI codes shows the KHI part (flag 'khi'), a line that is only SKP
codes stays empty (flag 'skp'). When SKP rows appear in the file the flags clear on their own.
Months marked 'sheet' (the official AEL figures) are never overwritten."""
import json, sys
fom_p, dump_p, m, out_p = sys.argv[1:5]
F = json.load(open(fom_p)); one = isinstance(F, list); F = F[0] if one else F
if F.get('source', {}).get(m) == 'sheet':
    print(json.dumps({'month': m, 'skipped': 'official sheet month'})); sys.exit(0)
raw = open(dump_p, encoding='utf-8').read()
if not raw.startswith('@@MB51'):   # saved tool result: JSON array with the quoted text
    try: t = json.loads(raw)[0]['text']
    except Exception: t = raw
    t = t.split('\n\n(captured')[0].strip()
    if t.startswith('"'): t = json.loads(t)
    raw = t.rstrip('#')
D, P, plants, file_name = {}, {}, set(), ''
for ln in raw.split('\n'):
    if ln.startswith('file='): file_name = ln[5:]; continue
    if not ln or ln.startswith(('@@', 'month=', 'cols=')): continue
    f = ln.split('|')
    if len(f) < 8 or not f[3].startswith(m): continue
    code = f[0].lstrip('0'); q = float(f[2] or 0); mt = f[7]
    if len(f) > 10 and f[10]: plants.add(f[10])
    if mt in ('601', '602'): D[code] = D.get(code, 0.0) - q
    elif mt in ('101', '102'): P[code] = P.get(code, 0.0) + q
skp = lambda c: str(c)[4:7] in ('102', '112')   # material groups that are booked at plant SKP
have_skp = 'SKP' in plants
v, flags = {}, {}
for lid, codes in (F.get('codes') or {}).items():
    if not codes: continue
    tot, khi_hit, skp_codes = 0.0, False, 0
    for code, fac, basis, *act in codes:
        src = D if basis == 'D' else P
        if code in src: tot += fac * float(src[code] or 0); khi_hit = khi_hit or not skp(code)
        if skp(code): skp_codes += 1
    if skp_codes and not have_skp:
        if khi_hit: v[lid] = round(tot, 2); flags[lid] = 'khi'
        else: flags[lid] = 'skp'
    else: v[lid] = round(tot, 2)
# keep figures the sheet types by hand (SPD piston) if an earlier source had them
for k, x in (F.get('months', {}).get(m) or {}).items():
    if k.startswith('x_') or k == 'sp_piston': v.setdefault(k, x)
F.setdefault('months', {})[m] = v
F.setdefault('source', {})[m] = 'mb51'
F.setdefault('flags', {})[m] = flags
F.setdefault('mb51', {})[m] = {'file': file_name, 'plants': sorted(plants)}
days = sorted({ln.split('|')[3] for ln in raw.split('\n') if ln.count('|') >= 7 and ln.split('|')[3].startswith(m)})
if days: F['asof'] = max(days)
json.dump([F] if one else F, open(out_p, 'w'), separators=(',', ':'))
print(json.dumps({'month': m, 'file': file_name, 'plants': sorted(plants), 'to': days[-1] if days else None, 'lines': len(v), 'khi_only': [k for k, x in flags.items() if x == 'khi'], 'skp_only': [k for k, x in flags.items() if x == 'skp']}))
