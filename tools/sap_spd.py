"""SPD supplies: frozen plan vs actual from the daily SAP MB51 file (Umair, 5 Nov 2026).
Usage: python3 sap_spd.py <frozen spd_plan_YYYY-MM.json> <mb51 dump .txt> <spd_supply.json (read if present, rewritten)>

Actual SPD supply = goods issue 601 less reversal 602 of the plan's AAL SPD codes (91xxxxxxxx), by posting day. Checked 5 Nov on
MB51 05.11.26: every 601 of those codes came from the three finished-goods stores KHI 0008 FG Store, KHI 0019 FG Store-Polymer
and SKP 0008 FG Store-1; production into SPD codes is 101 at the shop stores, moved by 313/315 into the FG stores first.
601/602 from any other store are still counted (and listed under by_store) so nothing goes missing.
The output is one record {months: {YYYY-MM: {...}}}; other months already in the file are kept. Earlier days never lose quantity:
if a new file shows less for a day than the dashboard already has, the run stops (SHRINK) and changes nothing.
"""
import sys, json, os, collections, datetime

FG = {('KHI', '0008'): 'KHI 0008 FG Store', ('KHI', '0019'): 'KHI 0019 FG Store-Polymer', ('SKP', '0008'): 'SKP 0008 FG Store-1'}

def text_of(p):
    raw = open(p, encoding='utf-8').read()
    if not raw.startswith('@@'):
        t = json.loads(raw)[0]['text'].split('\n\n(captured')[0]
        raw = json.JSONDecoder().raw_decode(t)[0] if t.startswith('"') else t
    return raw.rstrip('#')

def main():
    plan_p, mb51_p, out = sys.argv[1:4]
    P = json.load(open(plan_p)); month = P['month']
    y, m = int(month[:4]), int(month[5:]); nd = len(P['items'][0]['plan_days'])
    codes = {i['code'] for i in P['items']}
    act = collections.defaultdict(lambda: [0.0] * nd); store = collections.defaultdict(lambda: collections.defaultdict(float)); last = ''
    head = {}
    for ln in text_of(mb51_p).split('\n'):
        f = ln.split('|')
        if len(f) < 11:
            if '=' in ln and '|' not in ln: k, v = ln.split('=', 1); head[k] = v
            continue
        if f[7] not in ('601', '602'): continue
        c, d = f[0].strip().lstrip('0'), f[3]
        if c not in codes or not d.startswith(month): continue
        try: q = -float(f[2])               # 601 posts a negative quantity, 602 a positive one
        except ValueError: continue
        act[c][int(d[8:10]) - 1] += q; store[c][FG.get((f[10], f[9]), f'{f[10]} {f[9]}')] += q; last = max(last, d)
    prev = {}
    if os.path.exists(out):
        try: prev = json.load(open(out))[0]
        except Exception: prev = {}
    months = prev.get('months', {})
    if isinstance(months, str): months = json.loads(months)
    old = {i['code']: i for i in (months.get(month) or {}).get('items', [])}
    items = []
    for p in P['items']:
        a = [round(x) for x in act.get(p['code'], [0.0] * nd)]
        o = old.get(p['code'])
        if o and sum(a) < sum(o.get('act_days', [])) - 0.5:
            sys.exit(f"SHRINK: {p['code']} actual {sum(a)} is below the dashboard's {sum(o['act_days'])} - nothing changed")
        items.append(dict(p, act_days=a, actual=sum(a), by_store={k: round(v) for k, v in store.get(p['code'], {}).items() if round(v)}))
    asof = last or (months.get(month) or {}).get('asof', '')
    months[month] = dict(asof=asof, mb51_file=head.get('file', ''), plan_frozen_at=P['frozen_at'], plan_source=P['source'],
                         rule='Actual = 601 less 602 on the plan\'s AAL SPD codes (FG stores KHI 0008, KHI 0019, SKP 0008)', items=items)
    json.dump([dict(months=months)], open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    tp = sum(i['plan'] for i in items); ta = sum(i['actual'] for i in items)
    bs = collections.defaultdict(float)
    for c in store.values():
        for s, q in c.items(): bs[s] += q
    print(json.dumps(dict(month=month, asof=asof, lines=len(items), plan=tp, actual=ta, pct=round(ta / tp * 100, 1) if tp else None,
                          by_store={k: round(v) for k, v in bs.items()})))

if __name__ == '__main__':
    main()
