"""Conversion cost (Rs per unit) by cost element, 2025-26 vs 2026-27, from the 'Conversion Cost Analysis' slides of
'VA-CR Ideas for Cost Saving - All Shops' (slides 3 Clutch, 9 Ignition Coil, 30 Piston, 37 Carburetor, 42 CIP).
Values are the slide charts / tables. Where a slide's printed total disagrees with its own components, the components win
(noted per row). Writes cr_conv.json: one row per shop, model, year and cost element."""
import json, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else 'cr_conv.json'
E = ['Direct / Indirect Labor', 'Tools & Cons.', 'Utilities', 'Repair & Maint.']
# shop, dashboard shop, model, product, slide, COP share of conversion, {year: [labor, tools, utilities, repair]}, note
S = [
    ('Clutch', 'Clutch', 'CD70', 'Clutch Assy CD70', 3, 11, {'2025-26': [59, 39.6, 32, 11], '2026-27': [59, 35.8, 32, 11]}, ''),
    ('Clutch', 'Clutch', 'CG125', 'Clutch Assy CG125', 3, 3, {'2025-26': [65, 17.76, 27, 7], '2026-27': [65, 17.3, 27, 7]}, ''),
    ('Ignition Coil', 'Ignition Coil', 'CD70', 'Ignition Coil CD70', 9, 9, {'2025-26': [42, 9, 8, 8], '2026-27': [38, 8.6, 6, 8]}, ''),
    ('Ignition Coil', 'Ignition Coil', 'CG125', 'Ignition Coil CG125', 9, 9, {'2025-26': [42.4, 12.3, 8, 7.2], '2026-27': [41, 12, 8, 5]},
     'Slide prints totals 116.76 / 116.3 and saving 0.46 (copied from the Clutch slide); the components add to 69.9 / 66.0, a 3.9 saving'),
    ('Piston', 'Piston', 'CD70', 'Piston CD70', 30, 42, {'2025-26': [78.9, 14.8, 27.4, 13.0], '2026-27': [69.9, 13.0, 27.3, 12.9]}, ''),
    ('Piston', 'Piston', 'CG125', 'Piston CG125', 30, 42, {'2025-26': [77.9, 11.2, 42.2, 14.0], '2026-27': [68.9, 8.9, 40.8, 13.9]}, ''),
    ('Carburetor', 'Carburetor', 'CD70', 'Carburetor CD70', 37, 9, {'2025-26': [80, 55, 19, 15], '2026-27': [79, 45.7, 19, 15]}, ''),
    ('Carburetor', 'Carburetor', 'CG125', 'Carburetor CG125', 37, 6, {'2025-26': [76, 65, 19, 20], '2026-27': [75, 52.5, 19, 20]},
     'Utilities 19 and Repair & Maint. 20 as in the slide table (the chart colours show them the other way round)'),
    ('CIF Machining', 'CIF Machining', 'All models', 'CIP (cast iron parts)', 42, None,
     {'2024-25': [104.5, 38.46, 89.79, 4.61], '2025-26': [79.34, 34.82, 43.39, 13.49]},
     'Slide gives 2024-25 and 2025-26 for all CIP parts (no model named). Its 2026-27 chart shows only Rs 9.7 (4.3 / 2.4 / 2.0 / 1.0), which reads as a planned saving, not a full cost, so it is left out'),
]
COP = {('CIF Machining', '2024-25'): 10, ('CIF Machining', '2025-26'): 13, ('CIF Machining', '2026-27'): 3}
rows = []
for shop, ds, model, prod, slide, cop, yrs, note in S:
    for fy, vals in yrs.items():
        for e, v in zip(E, vals):
            rows.append({'shop': shop, 'dash_shop': ds, 'model': model, 'product': prod, 'fy': fy, 'element': e, 'rs_unit': v,
                         'cop_pct': COP.get((ds, fy), cop), 'slide': slide, 'note': note, 'source': 'VA-CR Ideas for Cost Saving - All Shops'})
json.dump(rows, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
for shop, ds, model, prod, slide, cop, yrs, note in S:
    t = {fy: round(sum(v), 2) for fy, v in yrs.items()}; print(prod, t)
print(len(rows), 'rows')
