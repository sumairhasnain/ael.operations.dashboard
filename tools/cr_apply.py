"""Apply what Claude read from an uploaded CR / CC presentation to the Idea Register.

Usage: python3 tools/cr_apply.py <changes.json> [--dry]
changes.json:
{
  "upload_id": 7, "file_name": "Clutch CR Nov.pptx", "slide_dir": "/path/out/7",
  "blobs": {"3": "<artifact blob id of slide-3.jpg>", ...},          # optional; filled after uploading the slide pictures
  "changes": [
    {"key": "CL-05", "model": "CD70", "set": {"status": "Completed", "target": "2026-11"}, "slides": [[3, "Summary"], [4, "Idea pictures"]]},
    {"new": true, "set": {"shop": "Clutch", "model": "CD70", "part": "...", "item": "...", "category": "Resource", "how": "...",
      "target": "2026-12", "status": "In Progress", "cr_unit": 0.5, "monthly_pkr": 40000, "before": "...", "after": "..."}, "slides": [[5, "Summary"]]}
  ]
}
Fields not given stay as they are. When cr_unit changes without a monthly figure, monthly saving scales with it (same volume);
FY saving = monthly x months from the target month to June 2027; quarter follows the target month. Slide pictures are added to
data/cr_slides.json as up<upload id>-<slide n> and linked from the idea (its slide window then shows them).
Prints a one-line result for the upload log and writes it to <slide_dir>/result.txt."""
import base64, json, os, re, sys

R = 'data/cr_ideas.json'; SL = 'data/cr_slides.json'
spec = json.load(open(sys.argv[1])); dry = '--dry' in sys.argv
ideas = json.load(open(R)); slides = json.load(open(SL))
uid = spec['upload_id']; blobs = spec.get('blobs', {}); sd = spec.get('slide_dir', '')
FY_START, FY_END = (2026, 7), (2027, 6)
STATUS = ['Proposal', 'Pending', 'In Progress', 'Completed']

def ym(v):
    if not v: return None
    m = re.match(r'^(\d{4})-(\d{1,2})', str(v)); assert m, f'bad month {v!r} (use YYYY-MM)'
    return f'{int(m[1]):04d}-{int(m[2]):02d}'
def months_left(t):
    if not t: return 12
    y, m = map(int, t.split('-'))
    if (y, m) < FY_START: return 12
    if (y, m) > FY_END: return 0
    return (FY_END[0] - y) * 12 + FY_END[1] - m + 1
def quarter(t):
    if not t: return None
    m = int(t.split('-')[1]); return 'Q' + str(((m - 7) % 12) // 3 + 1)
def prefix(shop):
    ks = [r['key'].split('-')[0] for r in ideas if r['shop'] == shop and not r['key'].startswith('FIN-')]
    if ks: return max(set(ks), key=ks.count)
    return re.sub(r'[^A-Z]', '', shop.upper())[:2] or 'CR'
def next_key(p):
    n = [int(r['key'].split('-')[1]) for r in ideas if r['key'].startswith(p + '-') and r['key'].split('-')[1].isdigit()]
    return f'{p}-{max(n or [0]) + 1:02d}'

done, added = [], []
for c in spec['changes']:
    s = dict(c.get('set', {}))
    if 'target' in s: s['target'] = ym(s['target'])
    if 'status' in s: assert s['status'] in STATUS, f"status must be one of {STATUS}"
    if c.get('new'):
        for k in ('shop', 'model', 'item', 'status'): assert s.get(k), f'new idea needs {k}'
        key = next_key(prefix(s['shop']))
        r = {'key': key, 'shop': s['shop'], 'dash_shop': s['shop'], 'model': s['model'], 'model_label': s['model'], 'part': '', 'item': '', 'item_type': '',
             'category': 'Resource', 'how': '', 'target': None, 'status': 'Pending', 'cr_unit': None, 'cr_unit_plan': None, 'monthly_pkr': 0, 'fy_pkr': 0,
             'investment_pkr': None, 'payback': None, 'before': '', 'after': '', 'source': f"Upload #{uid}: {spec.get('file_name', '')}", 'slide': None,
             'note': '', 'annual_pkr': 0, 'quarter': None, 'fy': 'FY 2026-27', 'fin_unit': None, 'fin_target': None, 'fin_detail': 'Not in the Finance CR budget'}
        old_unit = None; ideas.append(r); added.append(key)
    else:
        m = [r for r in ideas if r['key'] == c['key'] and (not c.get('model') or r['model'] == c['model'])]
        assert m, f"no idea {c['key']} {c.get('model') or ''}"
        assert len(m) == 1, f"{c['key']} has {len(m)} rows ({', '.join(r['model'] for r in m)}); give model"
        r = m[0]; old_unit = r.get('cr_unit')
    old_monthly = r.get('monthly_pkr') or 0
    r.update(s)
    if 'model' in s: r['model_label'] = s['model']
    if 'shop' in s: r['dash_shop'] = s['shop']
    if 'cr_unit' in s and 'monthly_pkr' not in s and old_unit and s['cr_unit'] is not None:
        r['monthly_pkr'] = round(old_monthly / old_unit * s['cr_unit'])
    if 'fy_pkr' not in s and ({'monthly_pkr', 'cr_unit', 'target'} & set(s) or c.get('new')):
        r['fy_pkr'] = round((r.get('monthly_pkr') or 0) * months_left(r.get('target')))
    r['annual_pkr'] = r['fy_pkr']
    r['quarter'] = quarter(r.get('target')) or r.get('quarter')
    if r.get('cr_unit') and r.get('investment_pkr') and r.get('monthly_pkr'): r['payback'] = round(r['investment_pkr'] / r['monthly_pkr'], 1)
    if c.get('slides'):
        lst = []
        for n, cap in c['slides']:
            nm = f'up{uid}-{n}'; img = os.path.join(sd, f'slide-{n}.jpg'); assert os.path.exists(img), f'missing {img}'
            src = 'data:image/jpeg;base64,' + base64.b64encode(open(img, 'rb').read()).decode()
            slides[:] = [x for x in slides if x['name'] != nm] + [{'name': nm, 'src': src}]
            lst.append([nm, f'{cap}: upload #{uid}, slide {n}' if cap else f'Upload #{uid}, slide {n}', blobs.get(str(n))])
        r['slides'] = lst
    r['upd'] = {'upload': uid, 'file': spec.get('file_name', '')}
    what = ', '.join(f"{k} {v}" for k, v in s.items() if k in ('status', 'target', 'cr_unit')) or ('details' if s else '')
    done.append(f"{r['key']}{' (' + r['model'] + ')' if r['model'] else ''}{' NEW' if c.get('new') else ''}"
                + (f": {what}" if what else '') + (f"; slide window {', '.join(str(n) for n, _ in c['slides'])}" if c.get('slides') else ''))

res = 'Mapped to ' + ' | '.join(done) if done else 'No idea changes found'
print(res)
if not dry:
    json.dump(ideas, open(R, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(slides, open(SL, 'w'), ensure_ascii=False, separators=(',', ':'))
    if sd: open(os.path.join(sd, 'result.txt'), 'w').write(res)
