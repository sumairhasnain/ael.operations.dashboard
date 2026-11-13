"""Append one CS03 screen to bom/<file>.tsv. Usage: python3 tools/bom_add.py FILE PARENT ALT BASE BASEUOM <<< 'item|comp|desc|qty|uom' lines"""
import sys, csv
f, par, alt, base, bu = sys.argv[1:6]
rows = list(csv.reader(open(f), delimiter='\t')) if __import__('os').path.exists(f) else [['parent','plant','alt','base_qty','base_uom','item','icat','component','description','qty','uom','assembly']]
assert not any(r[0] == par and r[2] == alt for r in rows[1:]), 'already recorded ' + par
n = 0
for ln in sys.stdin.read().strip().splitlines():
    it, c, d, q, u = [x.strip() for x in ln.split('|')]; rows.append([par, 'KHI', alt, base, bu, it, 'L', c, d, q, u, '?']); n += 1
csv.writer(open(f, 'w'), delimiter='\t', lineterminator='\n').writerows(rows); print(par, alt, n)
