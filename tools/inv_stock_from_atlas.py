import json, pandas as pd
s = pd.read_pickle('s.pkl'); s['Material'] = s['Material'].str.strip()
r = pd.read_pickle('r.pkl'); r = r[r['Material'].notna()].copy(); r['Material'] = r['Material'].str.strip()
feed = {x[0].strip(): x for x in json.load(open('/home/claude/dash/os/feeds.json'))}
found = {k for k, x in feed.items() if x[1] != '' or x[2] != 0}
# unit price per material: MB52 value / qty, else average purchase/production receipt price (last 12 months)
g = s.groupby('Material').agg(q=('Unrestricted', 'sum'), v=('Value Unrestricted', 'sum'))
up = (g['v'] / g['q']).where(g['q'] > 0)
r12 = r[r['Posting Date'] >= r['Posting Date'].max() - pd.Timedelta(days=365)]
rg = r12.groupby('Material').agg(q=('Qty in unit of entry', 'sum'), a=('Amt.in Loc.Cur.', 'sum'))
rp = (rg['a'] / rg['q']).where(rg['q'] > 0)
stats = {'replaced': 0, 'changed': 0, 'added': 0, 'no_price': []}
out = []
for m, grp in s.groupby('Material', sort=False):
    grp = grp.copy()
    if m in found:
        nq = float(feed[m][2]); oq = grp['Unrestricted'].sum(); stats['replaced'] += 1
        if abs(nq - oq) > 0.001: stats['changed'] += 1
        if oq > 0: grp['Unrestricted'] = grp['Unrestricted'] / oq * nq
        else: grp['Unrestricted'] = 0.0; grp.iloc[0, grp.columns.get_loc('Unrestricted')] = nq
        p = up.get(m)
        if nq > 0 and (p is None or pd.isna(p)): stats['no_price'].append(m)
        grp['Value Unrestricted'] = grp['Unrestricted'] * (float(p) if p is not None and pd.notna(p) else 0.0)
    out.append(grp)
s2 = pd.concat(out)
# codes Atlas shows with stock that the MB52 file never listed
uom = r.drop_duplicates('Material').set_index('Material')['Base Unit of Measure']
add = []
for m in found - set(s['Material']):
    x = feed[m]; q = float(x[2])
    if q <= 0: continue
    p = 0.0
    if not p: stats['no_price'].append(m)
    add.append({'Plant': 'KHI', 'Storage Location': '', 'Material Group': '', 'Material': m, 'Material Description': x[1], 'Base Unit of Measure': uom.get(m, ''),
                'Unrestricted': q, 'Quality Inspection': 0, 'Transit and Transfer': 0.0, 'Blocked': 0, 'Value Unrestricted': q * p})
stats['added'] = len(add)
if add: s2 = pd.concat([s2, pd.DataFrame(add)], ignore_index=True)
s2.to_pickle('s2.pkl')
print(json.dumps({**stats, 'no_price_n': len(stats['no_price']), 'no_price': stats['no_price'][:20],
  'old_value_m': round(s['Value Unrestricted'].sum()/1e6,1), 'new_value_m': round(s2['Value Unrestricted'].sum()/1e6,1)}))
