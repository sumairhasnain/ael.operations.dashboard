"""Multi-level BOM Excel from data/sap_bom.json (+ sap_bom_cost.json rates). Usage: python3 tools/bom_excel.py data out.xlsx"""
import sys, json, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
D, out = sys.argv[1:3]
B = json.load(open(D + '/sap_bom.json'))[0]; K = json.load(open(D + '/sap_bom_cost.json'))[0]; R = K['rates']
fgd = {f['fg']: f for f in B['fgs']}
wb = Workbook(); wb.remove(wb.active)
# 13 Nov 21:30 (Umair): one sheet per shop so each shop's BOM is easy to find; summary sheets cover all shops
hf = PatternFill('solid', fgColor='1D3FD6')
shops = sorted({f.get('shop', '') for f in B['fgs']}, key=lambda x: (x != 'Clutch', x))
def tree_sheet(ws, rows):
    H = ['Shop', 'FG code', 'FG description', 'Alt', 'Level', 'Parent', 'Item', 'Component', 'Description', 'Qty per parent', 'UoM', 'Qty per 1 FG', 'Moving avg rate (MB51)', 'Value per 1 FG (level 1)', 'Status']
    ws.append(H); hf = PatternFill('solid', fgColor='1D3FD6')
    for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hf; c.alignment = Alignment(wrap_text=True)
    for t in rows:
        f = fgd[t['fg']]; r = R.get(t['code'], {}).get('rate')
        ws.append([f.get('shop', ''), t['fg'], f['part'], t['alt'], t['lvl'], t['parent'], t['item'], t['code'], t['part'], t['qty'], t['uom'], t['qty_fg'], r, round(t['qty_fg'] * r, 2) if (r and t['lvl'] == 1) else None, t['status']])
    lf = {1: 'E8EEF9', 2: 'F3F6FC'}
    for row in ws.iter_rows(min_row=2):
        l = row[4].value; row[8].alignment = Alignment(indent=min(l - 1, 8))
        if l in lf:
            for c in row: c.fill = PatternFill('solid', fgColor=lf[l])
        row[11].number_format = '0.000###'; row[12].number_format = '#,##0.00'; row[13].number_format = '#,##0.00'
    for i, w in enumerate([13, 12, 32, 5, 6, 12, 6, 12, 40, 12, 6, 12, 14, 14, 18], 1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions

for sh in shops:
    tree_sheet(wb.create_sheet(sh + ' BOM'), [t for t in B['tree'] if fgd[t['fg']].get('shop', '') == sh])
s = wb.create_sheet('Cost per FG'); s.append(['Shop', 'FG code', 'FG description', 'Alt', 'Note', 'Levels', 'Material / unit (moving avg)', 'At latest receipt prices', 'FG MB51 receipt rate'])
fc = {(c['fg'], c['alt']): c for c in K['fg_cost']}
for f in B['fgs']:
    c = fc.get((f['fg'], f['alt']), {}); s.append([f.get('shop', ''), f['fg'], f['part'], f['alt'], f.get('alt_note', ''), f['levels'], c.get('mat_unit'), c.get('mat_unit_rcv'), (R.get(f['fg']) or {}).get('rate')])
s2 = wb.create_sheet('Raw material per FG'); s2.append(['Shop', 'FG code', 'FG description', 'Alt', 'Component', 'Description', 'UoM', 'Qty per 1 FG'])
agg = collections.OrderedDict()
for t in B['tree']:
    if t['status'] != 'Exploded':
        k = (t['fg'], t['alt'], t['code'], t['part'], t['uom']); agg[k] = agg.get(k, 0) + t['qty_fg']
for (fg, alt, c, p, u), v in agg.items(): s2.append([fgd[fg].get('shop', ''), fg, fgd[fg]['part'], alt, c, p, u, round(v, 6)])
for sh in (s, s2):
    for c in sh[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hf
    sh.freeze_panes = 'A2'; sh.auto_filter.ref = sh.dimensions
    for i in range(1, sh.max_column + 1): sh.column_dimensions[get_column_letter(i)].width = 16
    sh.column_dimensions['C'].width = 32
wb.save(out); print({w.title: w.max_row - 1 for w in wb})
