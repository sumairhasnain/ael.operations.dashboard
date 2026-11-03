"""Builds the Insights tab's data (one JSON record) from the dashboard's own datasets.

Usage: python3 tools/insights_build.py <data dir> <out.json>
Reads atlas_parts_daily, atlas_parts, atlas_vendors, atlas_vendor_supply, atlas_stock_critical, sp_attendance,
sp_attendance_people, cr_ideas, sap_stock, atlas_issues, jira_issues. Sample (smp_*) datasets are never used.
Every insight carries the dataset (and part code / dates) it came from, so it can be checked.

Period: the analysis month is the current month once it has 5+ days of dispatch posted, otherwise the last
closed month. The current month's pace is shown separately ("live pulse").
"""
import json, sys, os, collections as C, datetime as D

DIR, OUT = sys.argv[1], sys.argv[2]
def L(n, default=None):
    p = os.path.join(DIR, n + '.json')
    return json.load(open(p)) if os.path.exists(p) else (default if default is not None else [])
g = lambda r, k: r.get(k) or 0
pc = lambda a, b: round(a / b * 100, 1) if b else None
MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
mlab = lambda m: MN[int(m[5:]) - 1] + ' ' + m[:4]
def fm(v):
    v = float(v); a = abs(v)
    return f'{v/1e9:,.2f}B' if a >= 1e9 else f'{v/1e6:,.1f}M' if a >= 1e6 else f'{v/1e3:,.0f}K' if a >= 1e4 else f'{v:,.0f}'

import re
def tc(x):
    x = str(x or '').strip()
    def one(w):
        if re.search(r'\d', w) or w.upper().strip('()') in ('CD', 'CG', 'SPD', 'FCB', 'BFT', 'HPDC', 'PP', 'ABS', 'CIF', 'OSP', 'AHL'): return w.upper()
        return re.sub(r"[A-Za-z][A-Za-z']*", lambda m: m.group(0).capitalize(), w.lower())
    return ' '.join(one(w) for w in x.split())
P = {p['code']: p for p in L('atlas_parts')}
PD = L('atlas_parts_daily')
months = sorted({r['date'][:7] for r in PD})
today = (D.datetime.utcnow() + D.timedelta(hours=5)).strftime('%Y-%m-%d')
cur = today[:7]
def posted_days(m): return len({r['date'] for r in PD if r['date'][:7] == m and g(r, 'disp_actual') > 0})
M = cur if posted_days(cur) >= 5 else max(m for m in months if m < cur)
PREV = [m for m in months if m < M]
rows = lambda m: [r for r in PD if r['date'][:7] == m]
def tot(rs, cond=lambda p: True):
    a = [0, 0, 0, 0]
    for r in rs:
        p = P.get(r['code'], {})
        if cond(p):
            for i, k in enumerate(['prod_plan', 'prod_actual', 'disp_plan', 'disp_actual']): a[i] += g(r, k)
    return a
RM = rows(M); o = tot(RM)
fin_ok = lambda p: p.get('type') == 'Finished'
# shops whose finished production plan is mostly missing (plan < 20% of actual) are left out of finished-goods production %
shp = C.defaultdict(lambda: [0, 0, 0, 0])
for r in RM:
    p = P.get(r['code'], {})
    if fin_ok(p):
        for i, k in enumerate(['prod_plan', 'prod_actual', 'disp_plan', 'disp_actual']): shp[p['shop']][i] += g(r, k)
noplan_shops = sorted(s for s, v in shp.items() if v[1] > 0 and v[0] < 0.2 * v[1])
fin = tot(RM, lambda p: fin_ok(p) and p.get('shop') not in noplan_shops)
inh = tot(RM, lambda p: p.get('type') == 'In-house')
trend = [{'m': m, 'label': MN[int(m[5:]) - 1], 'pp': t[0], 'pa': t[1], 'dp': t[2], 'da': t[3]} for m in months if m <= M for t in [tot(rows(m))] if t[2] > 0][-6:]
prev_t = tot(rows(PREV[-1])) if PREV else None

# ---- delivery ----
gap = C.defaultdict(lambda: [0, 0, 0, 0])
for r in RM:
    if fin_ok(P.get(r['code'], {})):
        for i, k in enumerate(['prod_plan', 'prod_actual', 'disp_plan', 'disp_actual']): gap[r['code']][i] += g(r, k)
gaps = sorted(((v[2] - v[3], k, v) for k, v in gap.items() if v[2] > v[3]), reverse=True)
gross = sum(x[0] for x in gaps); net = o[2] - o[3]
day = C.defaultdict(lambda: [0, 0])
for r in RM:
    if fin_ok(P.get(r['code'], {})): d = int(r['date'][8:]); day[d][0] += g(r, 'disp_plan'); day[d][1] += g(r, 'disp_actual')
nd = max(day) if day else 30
cum = []; cp = ca = 0
for d in range(1, nd + 1): cp += day[d][0]; ca += day[d][1]; cum.append([d, cp, ca])
workdays = sum(1 for d in day if day[d][1] > 0) or 1
last7 = sum(day[d][1] for d in range(nd - 6, nd + 1)); back = pc(last7, o[3])
def part_hist(code):
    out = []
    for m in months[-3:] if M == months[-1] else [x for x in months if x <= M][-3:]:
        t = [0, 0, 0, 0]
        for r in rows(m):
            if r['code'] == code:
                for i, k in enumerate(['prod_plan', 'prod_actual', 'disp_plan', 'disp_actual']): t[i] += g(r, k)
        out.append({'m': m, 'prod': pc(t[1], t[0]), 'disp': pc(t[3], t[2])})
    return out
noprod = [(v[2], k, v) for k, v in gap.items() if v[2] > 0 and v[0] == 0 and P[k]['shop'] not in noplan_shops]
noprod.sort(reverse=True)
made_not_shipped = sorted(((v[1] - v[3], s, v) for s, v in shp.items() if v[0] and v[1] >= v[0] and v[3] < 0.95 * v[2] and s not in noplan_shops), reverse=True)

# ---- supply ----
V = [v for v in L('atlas_vendors') if v.get('month_schedule') and v.get('compliance_pct') is not None]
vsc = sum(v['month_schedule'] for v in V); vrc = sum(v['received_mtd'] for v in V)
unnamed = [v for v in V if v['vendor'].strip().isdigit()]
big_miss = [v for v in V if not v['vendor'].strip().isdigit() and v['compliance_pct'] < 20 and v['month_schedule'] > 0.05 * vsc]
odd = unnamed + big_miss; rest = [v for v in V if v not in odd]
rest_pct = pc(sum(v['received_mtd'] for v in rest), sum(v['month_schedule'] for v in rest))
v80 = sum(1 for v in V if v['compliance_pct'] < 80)
VS = L('atlas_vendor_supply'); vm = C.defaultdict(lambda: [0, 0])
for r in VS: vm[(r['vendor'].strip(), r['date'][:7])][0] += r.get('scheduled') or 0; vm[(r['vendor'].strip(), r['date'][:7])][1] += r.get('received') or 0
vmonths = sorted({m for (_, m) in vm if m <= M})[-4:]
vend = C.defaultdict(dict); vshort = C.defaultdict(int)
for (v, mo), x in vm.items():
    if x[0] > 0 and mo in vmonths: vend[v][mo] = round(x[1] / x[0] * 100); vshort[v] += max(0, x[0] - x[1])
chronic = sorted([(v, ms) for v, ms in vend.items() if len(ms) >= 3 and sum(1 for c in ms.values() if c < 80) >= 3], key=lambda x: sum(x[1].values()) / len(x[1]))
SC = L('atlas_stock_critical'); zero = [r for r in SC if (r.get('stock') or 0) + (r.get('vendor_stock') or 0) == 0]
scs = C.Counter(r['shop'] for r in SC); zs = C.Counter(r['shop'] for r in zero)
zero_gap = [r for r in zero if r['code'] in gap and gap[r['code']][2] > gap[r['code']][3]]

# ---- people ----
AM = max((r['date'][:7] for r in L('sp_attendance')), default=M)
AM = M if any(r['date'][:7] == M for r in L('sp_attendance')) else AM
A = [r for r in L('sp_attendance') if r['date'][:7] == AM]
PP = [r for r in L('sp_attendance_people') if r['month'] == AM]
ar = C.defaultdict(lambda: [0, 0, 0])
for r in A: ar[r['area']][0] += r['present']; ar[r['area']][1] += r['absent']; ar[r['area']][2] += r['ot_hours']
hc = C.Counter(r['area'] for r in PP)
abs_pct = pc(sum(v[1] for v in ar.values()), sum(v[0] + v[1] for v in ar.values()))
ot_tot = sum(v[2] for v in ar.values())
areas = sorted(([k, pc(v[1], v[0] + v[1]), round(v[2]), hc.get(k, 0)] for k, v in ar.items() if v[0] + v[1] > 0), key=lambda x: -x[1])
wdd = C.defaultdict(lambda: [0, 0])
for r in A: w = D.date.fromisoformat(r['date']).weekday(); wdd[w][0] += r['present']; wdd[w][1] += r['absent']
wdp = [[['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][w], pc(wdd[w][1], wdd[w][0] + wdd[w][1])] for w in range(7) if wdd[w][0] + wdd[w][1]]
sw = [min(g(r, 'abs_in_ot_weeks') * 8, g(r, 'ot_in_abs_weeks')) for r in PP]
sw_people = sum(1 for x in sw if x > 0); sw_hrs = round(sum(sw))
chron_abs = [r for r in PP if g(r, 'absent') >= 5]; tot_abs = sum(g(r, 'absent') for r in PP) or 1
ca_share = pc(sum(g(r, 'absent') for r in chron_abs), tot_abs)
no_ot = [a for a in areas if a[1] >= 10 and a[2] == 0 and a[3] >= 20]
top_ot = max(ar.items(), key=lambda x: x[1][2]) if ar else ('', [0, 0, 0])

# ---- cost ----
CR = L('cr_ideas'); ideas = [r for r in CR if not r.get('fin_only')]; finonly = [r for r in CR if r.get('fin_only')]
cr_ann = sum(r.get('annual_pkr') or 0 for r in ideas); cr_done = sum(r.get('annual_pkr') or 0 for r in ideas if r['status'] == 'Completed')
crs = C.defaultdict(lambda: [0, 0])
for r in ideas: crs[r['shop']][0] += r.get('annual_pkr') or 0; crs[r['shop']][1] += (r.get('annual_pkr') or 0) if r['status'] == 'Completed' else 0
crs = sorted(crs.items(), key=lambda x: -x[1][0])
behind = sorted({r['key'] for r in ideas if r['status'] != 'Completed' and r.get('fin_target') and r.get('target') and r['fin_target'] < r['target']})
fin_shops = C.Counter(r['shop'] for r in finonly).most_common(5)
S = L('sap_stock'); inv = sum(r.get('value_pkr') or 0 for r in S)
mb = C.defaultdict(float); cb = C.defaultdict(float)
for r in S: mb[r.get('move_bucket') or '?'] += r.get('value_pkr') or 0; cb[r.get('cover_bucket') or '?'] += r.get('value_pkr') or 0
slow = sum(v for k, v in mb.items() if k != 'Moved in last 90 days')
excess = sum(r.get('excess_pkr') or 0 for r in S)
topx = sorted(S, key=lambda r: -(r.get('excess_pkr') or 0))[:8]
nouse = sorted([r for r in S if (r.get('excess_pkr') or 0) > 20e6 and (not r.get('use_month') or (r.get('cover_days') or 0) > 1825)], key=lambda r: -(r['excess_pkr']))[:4]
inv_asof = max((r.get('asof') or '' for r in S), default='')

# ---- governance ----
I = L('atlas_issues'); iop = [r for r in I if r.get('status') != 'closed']
closed = [r for r in I if r.get('status') == 'closed']; noev = [r for r in closed if 'not evidenced' in (r.get('status_note') or '')]
ishop = C.Counter(r['shop'] or 'General' for r in I).most_common(7)
J = L('jira_issues'); jop = [j for j in J if j.get('cat') != 'done']; jod = [j for j in jop if j.get('due') and j['due'] < today]
jas = C.Counter(tc(j.get('assignee') or 'Unassigned') for j in jod).most_common(7)

# ---------------- insights (ranked) ----------------
cands = []
def add(score, area, head, body, impact, src, link=None, conf='Verified'):
    cands.append({'score': round(score, 1), 'area': area, 'head': head, 'body': body, 'impact': impact, 'src': src, 'link': link, 'conf': conf})
if gaps:
    s, k, v = gaps[0]; h = part_hist(k)
    lift = pc(o[3] + s, o[2])
    add(70 + 30 * s / max(net, 1), 'Delivery', f'Fix {tc(P[k]["part"])} first: {fm(s)} units short, {pc(s, net):.0f}% of the dispatch gap.',
        f'Dispatched {fm(v[3])} of {fm(v[2])} planned ({pc(v[3], v[2]):.0f}%); production {pc(v[1], v[0]) or 0:.0f}% of plan. Last months: ' + ', '.join(f'{MN[int(x["m"][5:])-1]} {x["disp"]:.0f}%' for x in h if x['disp'] is not None) + '.',
        f'Closing it lifts plant dispatch from {pc(o[3], o[2]):.0f}% to {lift:.0f}%.', f'atlas_parts_daily, code {k}, {mlab(M)}', 'Delivery')
if inh[0] and fin[0] and pc(inh[1], inh[0]) > pc(fin[1], fin[0]) + 3:
    add(min(80, 50 + (pc(inh[1], inh[0]) - pc(fin[1], fin[0])) * 3), 'Delivery', 'In-house parts are over plan while finished goods slip.',
        f'In-house parts {pc(inh[1], inh[0]):.0f}% of plan (+{fm(inh[1] - inh[0])} units); finished goods {pc(fin[1], fin[0]):.1f}%' + (f' (excl. {", ".join(noplan_shops)}, plan not loaded)' if noplan_shops else '') + '.',
        'Re-point surplus in-house capacity to the finished lines that are short.', 'atlas_parts_daily + atlas_parts (part type)')
noprod_s = [x for x in noprod if x[2][3] < x[0]]
for sh_ in noplan_shops:
    v = shp[sh_]
    if v[2] > v[3]:
        add(55 + min(30, 30 * (v[2] - v[3]) / max(net, 1)), 'Delivery', f'{sh_}: {fm(v[2] - v[3])} units short and no production plan loaded.', f'Sales plan {fm(v[2])}, shipped {fm(v[3])} ({pc(v[3], v[2]):.0f}%). The production plan covers only {fm(v[0])} against {fm(v[1])} made, so the shop is working without a plan in Atlas. Biggest gaps: ' + ', '.join(f'{tc(P[k]["part"])} {fm(x[2]-x[3])}' for k, x in sorted(((k, x) for k, x in gap.items() if P[k]['shop'] == sh_), key=lambda y: -(y[1][2]-y[1][3]))[:2]) + '.', 'Load the production plan in Atlas so the shortfall shows up day by day.', f'atlas_parts_daily, shop {sh_}, {mlab(M)}', 'Delivery', 'Check data')
if noprod_s:
    noprod = noprod_s; s, k, v = noprod[0]
    add(55 + min(30, 30 * sum(x[0] - x[2][3] for x in noprod[:3]) / max(net, 1)), 'Data', f'{len(noprod)} finished part{"s" if len(noprod) > 1 else ""} had a sales plan but no production plan.',
        '; '.join(f'{tc(P[x[1]]["part"])} {fm(x[0])} planned, {fm(x[2][3])} shipped' for x in noprod[:3]) + '.',
        'Ask PPC to load the production plan; until then these parts cannot be scheduled.', f'atlas_parts_daily, prod_plan = 0 and disp_plan > 0, {mlab(M)}', 'Delivery', 'Check data')
if odd:
    add(60, 'Supply', f'Vendor schedule {pc(vrc, vsc):.0f}%, but {len(odd)} lines explain {pc(sum(v["month_schedule"] - v["received_mtd"] for v in odd), vsc - vrc):.0f}% of the gap.',
        (f'{len(unnamed)} lines carry only a vendor code ({fm(sum(v["month_schedule"] for v in unnamed))} units, {fm(sum(v["received_mtd"] for v in unnamed))} received)' if unnamed else '') + (('; ' if unnamed else '') + ', '.join(f'{tc(v["vendor"])} {v["compliance_pct"]}% of {fm(v["month_schedule"])}' for v in big_miss) if big_miss else '') + f'. All other vendors: {rest_pct:.0f}%.',
        'Check the vendor schedule upload before chasing these vendors.', f'atlas_vendors, {mlab(M)}', 'Supply', 'Check data')
if chronic:
    add(50 + 2 * len(chronic), 'Supply', f'{len(chronic)} vendors missed 80% in at least 3 of the last {len(vmonths)} months.',
        ', '.join(f'{tc(v.split(" (")[0])} (avg {sum(ms.values())/len(ms):.0f}%)' for v, ms in chronic[:5]) + '.',
        'Recovery plan or second source at the next vendor review.', f'atlas_vendor_supply, {mlab(vmonths[0][:7]+"")[:3]}–{mlab(vmonths[-1])}', 'Supply')
if zero_gap:
    add(55, 'Supply', f'{len(zero_gap)} part{"s" if len(zero_gap) > 1 else ""} short on dispatch also at zero stock.', ', '.join(f'{tc(r["part"])} (safety {fm(r["safety_stock"])})' for r in zero_gap[:4]) + '.',
        'Treat as one red item across Supply and Delivery.', 'atlas_stock_critical + atlas_parts_daily', 'Supply')
if sw_hrs:
    add(50 + pc(sw_hrs, ot_tot) * .5, 'People', f'{sw_people} people logged overtime in the same weeks they were absent.',
        f'{sw_hrs:,} hours paid at 1.5× that would have been 1.0× with attendance ({pc(sw_hrs, ot_tot):.0f}% of all overtime). {top_ot[0]} carries the most overtime: {top_ot[1][2]:,.0f} h, {pc(top_ot[1][2], ot_tot):.0f}% of the plant.',
        f'~{sw_hrs/2:,.0f} hours of avoidable premium a month.', f'sp_attendance_people, {mlab(AM)}', 'People')
if cr_ann:
    lo = min((x for x in crs if x[1][0] > 0.15 * cr_ann), key=lambda x: x[1][1] / x[1][0], default=None)
    add(40 + (100 - pc(cr_done, cr_ann)) * .3, 'Cost', f'Only {pc(cr_done, cr_ann):.0f}% of the Rs {cr_ann/1e6:.1f}M CR plan is delivered.',
        (f'{lo[0]} holds {pc(lo[1][0], cr_ann):.0f}% of the pipeline with {pc(lo[1][1], lo[1][0]):.0f}% done. ' if lo else '') + f'{len(behind)} ideas are behind their Finance month; {len(finonly)} Finance budget lines have no matching idea.',
        'Weekly CR review for the lagging shop until half is booked.', 'cr_ideas (VA/CR decks + Finance CR budget)', 'Cost')
if inv:
    add(50 + pc(slow, inv) * .5, 'Cash', f'Rs {slow/1e6:,.0f}M of stock has not moved in 90+ days.',
        f'{pc(slow, inv):.0f}% of Rs {inv/1e9:.2f}B. ' + ('Largest lots with almost no use: ' + ', '.join(f'{tc(r["part"])[:42]} Rs {r["excess_pkr"]/1e6:.0f}M' for r in nouse[:3]) + '.' if nouse else ''),
        f'A 25% release frees ~Rs {slow*.25/1e6:,.0f}M of working capital.', f'sap_stock (MB52, {inv_asof})', 'Cash')
if jop:
    add(30 + pc(len(jod), len(jop)) * .3, 'Actions', f'{pc(len(jod), len(jop)):.0f}% of open Jira activities are overdue.',
        f'{len(jod)} of {len(jop)}; ' + ', '.join(f'{a} {n}' for a, n in jas[:3]) + '.', 'Re-date or close in this week\'s review.', f'jira_issues, due before {today}', 'Actions')
if noev:
    add(30 + pc(len(noev), len(closed)) * .3, 'Actions', f'{len(noev)} of {len(closed)} closed meeting issues were closed without evidence.',
        'Their notes say "not evidenced": the fix was agreed, but no stock, output or receipt figure confirms it.', 'Close only with a linked number.', 'atlas_issues, status_note', 'Actions')
if no_ot:
    add(30, 'Data', f'{", ".join(a[0] for a in no_ot)}: {no_ot[0][1]:.0f}% absent and no overtime entered.', 'Every other large area records overtime. Either it is not being entered or capacity is being lost.', 'Confirm with the shop.', f'sp_attendance, {mlab(AM)}', 'People', 'Check data')
cands.sort(key=lambda x: -x['score'])
# keep the top five varied: at most two from one area
top, rest_c, seen = [], [], C.Counter()
for c in cands:
    (top if len(top) < 5 and seen[c['area']] < 2 else rest_c).append(c); seen[c['area']] += c in top
cands = top + rest_c

# ---------------- KPIs ----------------
def kp(label, val, unit, sub, flag, state, prev=None, better='up'):
    return {'label': label, 'val': val, 'unit': unit, 'sub': sub, 'flag': flag, 'state': state, 'prev': prev, 'better': better}
kpis = [
    kp('Dispatch', pc(o[3], o[2]), '%', f'{fm(o[3])} of {fm(o[2])} planned', f'{fm(net)} units short', 'bad' if pc(o[3], o[2]) < 95 else 'ok', pc(prev_t[3], prev_t[2]) if prev_t else None),
    kp('Production', pc(o[1], o[0]), '%', f'{fm(o[1])} of {fm(o[0])} planned', f'finished goods {pc(fin[1], fin[0]):.1f}%', 'ok' if pc(fin[1], fin[0]) >= 97 else 'warn', pc(prev_t[1], prev_t[0]) if prev_t else None),
    kp('Vendor schedule', pc(vrc, vsc), '%', f'{fm(vrc)} of {fm(vsc)} units', f'{v80} vendors under 80%', 'bad' if pc(vrc, vsc) < 85 else 'warn'),
    kp('Absenteeism', abs_pct, '%', f'{len(PP):,} people · OT {ot_tot:,.0f} h', f'{sw_people} with OT in absent weeks', 'bad' if abs_pct >= 12 else 'warn', None, 'down'),
    kp('CR delivered', pc(cr_done, cr_ann), '%', f'Rs {cr_done/1e6:.1f}M of Rs {cr_ann/1e6:.1f}M a year', f'{len(behind)} behind Finance month', 'warn' if pc(cr_done, cr_ann) < 50 else 'ok'),
    kp('Slow inventory', round(slow / 1e6), 'Rs M', f'of Rs {inv/1e9:.2f}B not moved 90+ days', f'Rs {excess/1e6:,.0f}M above cover target', 'warn', None, 'down'),
]

# ---------------- live pulse (current month) ----------------
pulse = None
if cur != M and any(r['date'][:7] == cur for r in PD):
    t = tot(rows(cur)); pulse = {'m': cur, 'label': mlab(cur), 'prod_plan': t[0], 'prod_act': t[1], 'disp_plan_month': t[2], 'disp_act': t[3], 'note': 'Plan loaded; actuals not yet posted in SAP.' if not t[1] and not t[3] else ''}
elif cur == M:
    dn = int(today[8:]); plan_td = sum(day[d][0] for d in range(1, dn + 1)); pulse = {'m': cur, 'label': mlab(cur), 'disp_plan_td': plan_td, 'disp_act': o[3], 'gap_td': plan_td - o[3]}

# ---------------- checks (data health / exceptions) ----------------
checks = [
    {'name': 'Sales plan without production plan', 'n': len(noprod), 'detail': ', '.join(tc(P[x[1]]['part']) for x in noprod[:3]) or 'none', 'src': 'atlas_parts_daily'},
    {'name': 'Finished shops with production plan missing', 'n': len(noplan_shops), 'detail': ', '.join(noplan_shops) or 'none', 'src': 'atlas_parts_daily'},
    {'name': 'Vendor schedule lines without a vendor name', 'n': len(unnamed), 'detail': f'{fm(sum(v["month_schedule"] for v in unnamed))} units' if unnamed else 'none', 'src': 'atlas_vendors'},
    {'name': 'Vendors under 80% for 3+ months', 'n': len(chronic), 'detail': ', '.join(tc(v.split(' (')[0]) for v, _ in chronic[:3]) or 'none', 'src': 'atlas_vendor_supply'},
    {'name': 'Parts at zero stock (incl. vendor stock)', 'n': len(zero), 'detail': ', '.join(f'{s} {n}' for s, n in zs.most_common(3)) or 'none', 'src': 'atlas_stock_critical'},
    {'name': 'Areas absent 10%+ with no overtime entered', 'n': len(no_ot), 'detail': ', '.join(a[0] for a in no_ot) or 'none', 'src': 'sp_attendance'},
    {'name': 'Stock lots over Rs 20M with no use recorded', 'n': len(nouse), 'detail': ', '.join(tc(r['part']) for r in nouse[:3]) or 'none', 'src': 'sap_stock'},
    {'name': 'Finance budget lines with no matching idea', 'n': len(finonly), 'detail': ', '.join(f'{s} {n}' for s, n in fin_shops[:3]) or 'none', 'src': 'cr_ideas'},
]

out = {
    'asof': today, 'period': M, 'period_label': mlab(M), 'att_period': mlab(AM), 'inv_asof': inv_asof,
    'kpis': kpis, 'decisions': cands[:5], 'more': cands[5:], 'pulse': pulse, 'checks': checks,
    'delivery': {'trend': trend, 'cum': cum, 'gaps': [{'code': k, 'part': tc(P[k]['part']), 'shop': P[k]['shop'], 'short': s, 'plan': v[2], 'act': v[3]} for s, k, v in gaps[:8]],
                 'gross': gross, 'net': net, 'back': back, 'avg_day': round(o[3] / workdays),
                 'shops': sorted([{'shop': s, 'prod': pc(v[1], v[0]) if s not in noplan_shops else None, 'disp': pc(v[3], v[2]), 'short': max(0, v[2] - v[3])} for s, v in shp.items() if v[2]], key=lambda x: -x['short']),
                 'made_not_shipped': [{'shop': s, 'units': round(u)} for u, s, v in made_not_shipped[:3]]},
    'supply': {'chronic': [{'vendor': tc(v), 'months': ms, 'short': vshort[v]} for v, ms in chronic], 'vmonths': vmonths,
               'stock_shops': [{'shop': s, 'n': n, 'zero': zs.get(s, 0)} for s, n in scs.most_common(8)],
               'zero': [{'part': tc(r['part']), 'shop': r['shop'], 'safety': r['safety_stock']} for r in zero][:14]},
    'people': {'areas': areas, 'weekday': wdp, 'swap_hrs': sw_hrs, 'swap_people': sw_people, 'abs_conc': ca_share, 'abs_conc_n': len(chron_abs), 'abs_conc_pct': pc(len(chron_abs), len(PP))},
    'cost': {'cr': [{'shop': s, 'plan': v[0], 'done': v[1]} for s, v in crs], 'behind': behind, 'fin_only': len(finonly), 'fin_shops': fin_shops,
             'move': [[k, mb[k]] for k in ['Moved in last 90 days', '91–365 days', 'Over 1 year', 'No movement since Jan 2024'] if k in mb],
             'cover': [[k, cb[k]] for k in ['Under 15 days', '15–30 days', '30–90 days', '90–180 days', 'Over 180 days', 'No use in 6 months', 'Use not recorded'] if k in cb],
             'excess': [{'part': tc(r['part']), 'cat': r['category'], 'cover': r.get('cover_days'), 'excess': r.get('excess_pkr') or 0, 'value': r.get('value_pkr') or 0} for r in topx]},
    'actions': {'issues_shop': ishop, 'open': [{'id': r['id'], 'item': r['item'], 'shop': r['shop'], 'priority': r['priority'], 'last': r['last_meeting']} for r in sorted(iop, key=lambda r: r['last_meeting'])],
                'n_issues': len(I), 'n_closed': len(closed), 'n_noev': len(noev), 'jira_open': len(jop), 'jira_overdue': len(jod), 'jira_owner': jas},
}
json.dump([out], open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(json.dumps({'period': M, 'decisions': [c['head'] for c in cands[:5]], 'more': len(cands) - 5}, ensure_ascii=False, indent=1))
