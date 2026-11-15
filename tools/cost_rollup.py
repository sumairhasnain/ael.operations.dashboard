"""Product cost roll-up (Umair, 15 Nov 2026 17:16).

"When doing product level costing, all cost of sub level components should appear in the parent part's cost to determine
the finished goods cost."  Restated from July 2026; work in progress stays in the shop that made it (casting shop etc.).

For every month and every shop S that makes in-house components (SAP MB51 101 receipts with no supplier):
  k_S        = S's cost for the month (material + indirect material + labour + utilities, including what S itself received
               from its own suppliers) / standard value of everything S produced that month (101 less 102 at SAP standard)
  transfer   = standard value of S's components consumed by other shops (261 less 262 at SAP standard) x k_S
  parent     = the shop whose finished goods use the component in the SAP CS03 BOM (split by finished units x BOM quantity
               when several shops use it); a component no BOM uses, or used inside S itself, stays in S
  Cost moves element by element (S's material, tools, wages ... in proportion), so the company total of every month and
  every element is unchanged. Components made but not yet consumed (work in progress) keep their cost in S.
  Shops are processed supplier-first (topological order), so a part that passes through two in-house shops carries both.

Frozen months (July-October): their direct material excluded only the in-house parts list of the 10-11-26 MB51 file, so only
those components are rolled up there; parts made in-house but not on that list are already in the parent's purchased
material at SAP value and are not moved again (no double count).
"""
import collections
import pandas as pd

CORE = ('Direct material', 'Indirect material', 'Direct labour', 'Utilities')
FROZEN_MADE_TO = '2026-11-10'          # the frozen Jul-Oct rows were built with the in-house list of this file


def _st(c): return str(c).strip().lstrip('0')


def load_moves(rpkl, upkl, frm):
    r = pd.read_pickle(rpkl); r['d'] = pd.to_datetime(r['Posting Date']); r['m'] = r.d.dt.strftime('%Y-%m')
    r['Material'] = r['Material'].astype(str).map(_st); r['sup'] = r['Supplier'].fillna('').astype(str).str.strip()
    r = r[(r.m >= frm) & r['Movement Type'].astype(str).isin(['101', '102'])]
    u = pd.read_pickle(upkl); u['m'] = pd.to_datetime(u['Posting Date']).dt.strftime('%Y-%m'); u['Material'] = u['Material'].astype(str).map(_st)
    u = u[(u.m >= frm) & u['Movement Type'].astype(str).isin(['261', '262'])]
    nov = r[(r.m == FROZEN_MADE_TO[:7]) & (r.d <= FROZEN_MADE_TO)]
    made_frozen = set(nov[nov.sup == ''].Material) - set(nov[nov.sup != ''].Material)
    prod = r[r.sup == ''].groupby(['m', 'Material'])['Amt.in Loc.Cur.'].sum()          # 102 rows carry negative amounts
    cons = (-u.groupby(['m', 'Material'])['amt'].sum())                                   # 261 negative, 262 positive
    q = u.groupby(['m', 'Material'])['Qty in unit of entry'].sum() if 'Qty in unit of entry' in u.columns else None
    return prod, cons, q, made_frozen


def maker_fn(bom, shop_of, raw_shop, rates=None):
    """The shop that MAKES a component. The SAP part master puts a casting under the shop that uses it (HUB REAR CASTED -> Hubs),
    but the casting is poured where its raw material is booked (HD2 BS1 ingot -> HPDC). So: the shop of the component's own
    BOM inputs (largest by value; an in-house input counts by its own maker), else the part master's shop."""
    rates = rates or {}; kids = collections.defaultdict(dict)
    for t in bom['tree']:
        p, c = _st(t['parent']), _st(t['code'])
        if p != c: kids[p][c] = max(kids[p].get(c, 0), float(t['qty'] or 0))
    memo = {}
    def mk(c, depth=0):
        if c in memo: return memo[c]
        if depth > 8 or c not in kids: return shop_of(c) or ''
        votes = collections.defaultdict(float)
        for ch, q in kids[c].items():
            sh = mk(ch, depth + 1) if ch in kids else (raw_shop(ch) or shop_of(ch) or '')
            r = (rates.get(ch) or {}).get('rate') or 1.0
            if sh: votes[sh] += max(q, 1e-9) * r
        memo[c] = max(votes, key=votes.get) if votes else (shop_of(c) or '')
        return memo[c]
    return mk


def rollup(out_rows, prod, cons, cons_q, made_now, made_frozen, frozen_months, shop_of, bom, units_of, desc=None):
    """out_rows: list of COGM row dicts (modified in place: supplier rows scaled down, parent rows added with 'from').
    shop_of(code) -> the shop that makes the component (see maker_fn); bom = sap_bom dataset [0]; units_of(month) -> {fg code: finished units}."""
    desc = desc or {}
    fgshop = {}; nalt = collections.Counter(f['fg'] for f in bom['fgs'])
    for f in bom['fgs']: fgshop[f['fg']] = f['shop']
    uses = collections.defaultdict(list)                     # component -> [(fg, qty per fg / alternatives)]
    for t in bom['tree']: uses[_st(t['code'])].append((t['fg'], t['qty_fg'] / max(1, nalt[t['fg']])))
    months = sorted({r['month'] for r in out_rows})
    summ = {}
    for m in months:
        made = made_frozen if m in frozen_months else made_now
        U = units_of(m)
        # standard value produced per supplier shop
        V = collections.defaultdict(float)
        if m in prod.index.get_level_values(0):
            for c, v in prod.loc[m].items():
                if c in made and v: V[shop_of(c) or ''] += float(v)
        # consumption of in-house components, routed to parent shops by the BOM
        flows = collections.defaultdict(float); comp = collections.defaultdict(list)
        if m in cons.index.get_level_values(0):
            for c, v in cons.loc[m].items():
                if c not in made or v <= 0: continue
                S = shop_of(c) or ''
                if not S or not uses.get(c): continue
                w = collections.defaultdict(float)
                for fg, qq in uses[c]:
                    P = fgshop.get(fg)
                    if P: w[P] += qq * (U.get(_st(fg), 0) or 0)
                if not sum(w.values()):
                    for fg, qq in uses[c]:
                        P = fgshop.get(fg)
                        if P: w[P] += 1.0
                tw = sum(w.values())
                for P, x in w.items():
                    if P == S or not x: continue
                    flows[(S, P)] += float(v) * x / tw
                    qn = float(cons_q.loc[(m, c)]) if cons_q is not None and (m, c) in cons_q.index else None
                    comp[(S, P)].append((c, desc.get(c, ''), float(v) * x / tw, -qn * x / tw if qn is not None else None))
        if not flows: continue
        # supplier-first order
        shops = {s for s, _ in flows} | {p for _, p in flows}
        indeg = collections.Counter(p for (s, p) in flows if s != p)
        order, ready = [], sorted(s for s in shops if not indeg[s])
        out_e = collections.defaultdict(set)
        for s, p in flows: out_e[s].add(p)
        while ready:
            s = ready.pop(0); order.append(s)
            for p in sorted(out_e[s]):
                indeg[p] -= 1
                if indeg[p] == 0: ready.append(p)
        order += sorted(shops - set(order))                # a cycle, if any, is processed in name order
        moved = 0.0
        for S in order:
            outs = {p: v for (s, p), v in flows.items() if s == S}
            if not outs or not V.get(S): continue
            rows = [r for r in out_rows if r['month'] == m and r['shop'] == S and r['element'] in CORE and r['value_pkr']]
            C = sum(r['value_pkr'] for r in rows)
            if C <= 0: continue
            k = C / V[S]
            T = min(C, k * sum(outs.values()))
            if T <= 0: continue
            scale = T / (k * sum(outs.values()))
            add = collections.defaultdict(float)
            for r in rows:
                share = r['value_pkr'] / C
                for P, sv in outs.items():
                    add[(P, r['element'], r['sub'])] += sv * k * scale * share
                r['value_pkr'] = round(r['value_pkr'] * (1 - T / C))
            for (P, e, sub), v in add.items():
                if abs(v) < 1: continue
                top = sorted(comp[(S, P)], key=lambda x: -x[2])
                out_rows.append({'month': m, 'shop': P, 'element': e, 'sub': sub, 'from': S, 'value_pkr': round(v), 'estimate': False,
                                 'detail': {'from': S, 'k': round(k, 4), 'n_items': len(top),
                                            'top': [{'code': c, 'part': d[:44], 'value': round(x * k * scale), 'qty': round(q) if q else None} for c, d, x, q in top[:6]]},
                                 'asof': next((r.get('asof') for r in rows if r.get('asof')), '')})
            moved += T
        summ[m] = round(moved / 1e6, 1)
    return summ
