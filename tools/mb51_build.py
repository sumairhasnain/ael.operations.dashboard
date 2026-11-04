"""Merge a daily MB51 dump (from the SharePoint Portal Data/MB51 folder, extracted in-browser) into the
12-month receiving/consumption history and rebuild the Inventory datasets.

Usage: python3 mb51_build.py <mb51 dump .txt> [<more dumps> ...]
Each dump starts with '@@MB51' and has pipe rows: Material|Desc|Qty|PostDate|Amt|CC|Supplier|MT|UoM|Sloc (101/102/201/202).
For every month present in the dumps, the matching month in r.pkl (101/102) and c.pkl (201/202) is replaced with the
dump's rows (the daily file is the authoritative full month to date), all other months kept. Writes r2.pkl / c2.pkl and
reruns make_inv into ./out_mb51 using the current Atlas-refreshed stock (s2.pkl)."""
import sys, subprocess, pandas as pd, numpy as np

COLS = ['Material', 'Material Description', 'Qty in unit of entry', 'Storage Location', 'Base Unit of Measure',
        'Document Date', 'Posting Date', 'Cost Center', 'Entry Date', 'Time of Entry', 'Amt.in Loc.Cur.',
        'Supplier', 'Movement Type', 'Plant', 'Text', 'Reference']

def parse(paths):
    rows = []
    for p in paths:
        lines = open(p, encoding='utf-8').read().split('\n')
        assert lines[0] == '@@MB51', p + ' is not an MB51 dump'
        hdr = [l for l in lines[:6] if l.startswith('cols=')]
        for l in lines:
            if not l or l.startswith('@@MB51') or l.startswith(('file=', 'month=', 'cols=')):
                continue
            f = l.split('|')
            if len(f) < 8:
                continue
            mat, desc, qty, pd_, amt, cc, sup, mt = f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]
            uom = f[8] if len(f) > 8 else ''
            sloc = f[9] if len(f) > 9 else ''
            rows.append(dict(Material=mat.strip(), **{'Material Description': desc},
                             **{'Qty in unit of entry': float(qty or 0)}, **{'Storage Location': sloc},
                             **{'Base Unit of Measure': uom}, **{'Document Date': pd.to_datetime(pd_)},
                             **{'Posting Date': pd.to_datetime(pd_)}, **{'Cost Center': cc or np.nan},
                             **{'Entry Date': pd.NaT}, **{'Time of Entry': np.nan},
                             **{'Amt.in Loc.Cur.': float(amt or 0)}, **{'Supplier': sup or np.nan},
                             **{'Movement Type': mt}, Plant='KHI', Text='', Reference=''))
    df = pd.DataFrame(rows, columns=COLS)
    return df

def merge(hist_path, new, mts):
    hist = pd.read_pickle(hist_path)
    nn = new[new['Movement Type'].isin(mts)].copy()
    months = sorted(nn['Posting Date'].dt.strftime('%Y-%m').unique())
    keep = hist[~hist['Posting Date'].dt.strftime('%Y-%m').isin(months)]
    out = pd.concat([keep, nn], ignore_index=True).sort_values('Posting Date').reset_index(drop=True)
    return out, months, len(hist), len(keep), len(nn)

def main():
    dumps = sys.argv[1:] or ['/home/claude/mb51/oct.txt']
    new = parse(dumps)
    r2, rm, rh, rk, rn = merge('r.pkl', new, ['101', '102'])
    c2, cm, ch, ck, cn = merge('c.pkl', new, ['201', '202'])
    r2.to_pickle('r2.pkl'); c2.to_pickle('c2.pkl')
    # 4 Nov (Umair): 261/262 issues to production orders -> u.pkl (by material and day), for cover on real consumption
    try:
        u2, um, uh, uk, un = merge('u.pkl', new.assign(amt=new['Amt.in Loc.Cur.']), ['261', '262'])
        u2 = u2[['Material', 'Posting Date', 'Movement Type', 'Qty in unit of entry', 'amt']]; u2.to_pickle('u2.pkl')
        print('consumption 261: months refreshed', um, 'hist', uh, '-> kept', uk, '+ new', un, '=', len(u2))
    except Exception as e: print('consumption 261 skipped:', e)
    print('receiving: months refreshed', rm, 'hist', rh, '-> kept', rk, '+ new', rn, '=', len(r2))
    print('consumption: months refreshed', cm, 'hist', ch, '-> kept', ck, '+ new', cn, '=', len(c2))
    import datetime as dt
    asof = max(r2['Posting Date'].max(), c2['Posting Date'].max()).date().isoformat()
    import os
    subprocess.run(['python3', 'make_inv.py', 'r2.pkl', 'c2.pkl', 's2.pkl', 'out_mb51', asof, 'u2.pkl' if os.path.exists('u2.pkl') else 'u.pkl'], check=True)

if __name__ == '__main__':
    main()
