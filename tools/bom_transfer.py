"""Material follows the product (Umair, 13 Nov 2026 22:58).

SAP issues a casting's raw material (ingot, pig iron, insert...) to the shop that pours the casting, and COGM assigns
direct material by the consumed material's shop. So a shop whose parts are cast elsewhere (Hubs from HPDC, Pridor/CB150F
clutch parts from HPDC, drum gear from the cast-iron foundry...) showed almost no material. This moves, for the current
month, each purchased raw material the SAP CS03 BOM puts into a shop's finished goods from the shop it was booked to into
the shop that made the product:  value = finished-good units x BOM quantity per unit (all levels) x moving-average rate,
capped at what was actually booked for that material this month.
"""
import collections


def transfers(sap_bom, sap_bom_cost, fg_units, booked, made=(), shopx=None):
    """fg_units {fg: units this month}; booked {raw: (shop, value)}. Returns [(raw, part, from, to, value, qty)]."""
    shopx = shopx or {}
    fgshop = {f['fg']: shopx.get(f['shop'], f['shop']) for f in sap_bom['fgs']}
    nalt = collections.Counter(f['fg'] for f in sap_bom['fgs'])
    rates = sap_bom_cost.get('rates') or {}
    need = collections.defaultdict(float); part = {}
    for t in sap_bom['tree']:
        if t['status'] == 'Exploded' or t['code'] in made: continue
        n = fg_units.get(t['fg'], 0)
        if n <= 0 or t['fg'] not in fgshop: continue
        need[(t['code'], fgshop[t['fg']])] += n * t['qty_fg'] / nalt[t['fg']]; part[t['code']] = t['part']
    want = collections.defaultdict(list)
    for (c, to), q in need.items():
        if c not in booked: continue
        frm, bv = booked[c]
        if bv <= 0: continue
        r = (rates.get(c) or {}).get('rate') or 0
        if r > 0: want[c].append((to, q, q * r))
    out = []
    for c, L in want.items():
        # the booking shop's own BOM need counts too: if less was booked than all shops need, every shop is scaled alike
        frm, bv = booked[c]; tot = sum(v for _, _, v in L); k = min(1.0, bv / tot) if tot else 0
        for to, q, v in L:
            if to != frm and v * k > 0: out.append((c, part.get(c, ''), frm, to, v * k, q))
    return out
