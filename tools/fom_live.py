"""F.O.M live month from Atlas (Umair, 1 Nov).
Usage: python3 fom_live.py <fom.json> <atlas_month.json> <YYYY-MM> <out.json>
atlas_month.json = {"D": {code: month-to-date sales qty}, "P": {code: month-to-date production qty}} as Atlas's
PPC_Sales_vs_Prd and PPC_Prd_Compliance BAPIs return them for the month's last day (or today).
Each F.O.M line is built from the same SAP codes and factors as the AEL F.O.M sheet (fom.json "codes").
A line is filled only when Atlas carries every one of its codes (sales for 601 codes, production for 101 codes);
codes with no movement in the sheet's MB51 (Jul–Oct 2026) are not required; otherwise it stays empty until a full SAP MB51 source is linked. Months marked "sheet" (the official AEL figures)
are never overwritten."""
import json, sys
fom_p, atl_p, m, out_p = sys.argv[1:5]
F = json.load(open(fom_p)); one = isinstance(F, list); F = F[0] if one else F
def load_atlas(path):
    """atlas_month.json, or the saved tool-result file of the javascript_tool call that returned '#…#@@FOMATL{...}'"""
    raw = open(path, errors='ignore').read()
    if '@@FOMATL' not in raw: return json.loads(raw)
    try: t = json.loads(raw)[0]['text']
    except Exception: t = raw
    if t.startswith('"'): t = json.loads(t[:t.rindex('"') + 1])
    return json.loads(t.split('@@FOMATL', 1)[1].split('\n\n(captured')[0])
A = load_atlas(atl_p); D, P = A.get('D', {}), A.get('P', {})
if F.get('source', {}).get(m) in ('sheet', 'mb51'):   # 4 Nov (Umair): a month built from the daily SAP MB51 file is not overwritten by Atlas
    print(json.dumps({'month': m, 'skipped': 'official sheet month' if F['source'][m] == 'sheet' else 'month held by the daily SAP MB51 file'})); sys.exit(0)
if not any(float(x or 0) for x in list(D.values()) + list(P.values())):   # Atlas has nothing for this month yet: don't open its button
    print(json.dumps({'month': m, 'skipped': 'no sales or production in Atlas yet'})); sys.exit(0)
v, cov, miss = {}, [], {}
for lid, codes in (F.get('codes') or {}).items():
    if not codes: continue
    tot, ok, lack = 0.0, True, []
    for code, f, basis, *act in codes:
        src = D if basis == 'D' else P
        if code not in src:
            if act and not act[0]: continue   # code with no SAP movement Jul–Oct 2026: not needed for coverage
            ok = False; lack.append(code); continue
        tot += f * float(src[code] or 0)
    if ok: v[lid] = round(tot, 2); cov.append(lid)
    else: miss[lid] = len(lack)
F.setdefault('months', {})[m] = v
F.setdefault('source', {})[m] = 'atlas'
F['asof'] = A.get('asof', F.get('asof'))
json.dump([F] if one else F, open(out_p, 'w'), separators=(',', ':'))
print(json.dumps({'month': m, 'lines_live': len(cov), 'lines_waiting_for_mb51': len(miss), 'live': cov}))
