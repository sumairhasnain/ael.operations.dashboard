"""Turn an uploaded CR / CC presentation into slide pictures and text, ready to read.

Usage: python3 tools/cr_inbox.py <upload folder, e.g. ../crinbox/files/7> <out folder>
Writes <out>/slide-<n>.jpg (1280 px wide) and <out>/slides.json: [{"n": 1, "text": "...", "img": "slide-1.jpg"}, ...]
plus meta.json copied from the upload. .pptx / .ppt are converted to PDF with LibreOffice first;
text comes from python-pptx when it is a .pptx (fuller than the PDF text), otherwise from pdftotext."""
import json, os, shutil, subprocess, sys, glob

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
meta = json.load(open(os.path.join(src, 'meta.json')))
shutil.copy(os.path.join(src, 'meta.json'), os.path.join(out, 'meta.json'))
f = os.path.join(src, meta['file'])
ext = f.rsplit('.', 1)[-1].lower()
pdf = f
if ext in ('pptx', 'ppt'):
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', out, f], check=True, capture_output=True, timeout=300)
    pdf = os.path.join(out, os.path.splitext(os.path.basename(f))[0] + '.pdf')
for old in glob.glob(os.path.join(out, 'slide-*.jpg')): os.remove(old)
subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=80', '-scale-to-x', '1280', '-scale-to-y', '-1', pdf, os.path.join(out, 'p')], check=True, timeout=600)
pages = sorted(glob.glob(os.path.join(out, 'p-*.jpg')), key=lambda p: int(p.rsplit('-', 1)[1].split('.')[0]))
for i, p in enumerate(pages, 1): os.rename(p, os.path.join(out, f'slide-{i}.jpg'))
texts = {}
if ext == 'pptx':
    try:
        from pptx import Presentation
        for i, s in enumerate(Presentation(f).slides, 1):
            parts = []
            for sh in s.shapes:
                if sh.has_text_frame and sh.text_frame.text.strip(): parts.append(sh.text_frame.text.strip())
                if getattr(sh, 'has_table', False) and sh.has_table:
                    for row in sh.table.rows: parts.append(' | '.join(c.text.strip() for c in row.cells))
            texts[i] = '\n'.join(parts)
    except Exception as e:
        print('python-pptx text failed, using PDF text:', e)
for i in range(1, len(pages) + 1):
    if not texts.get(i):
        r = subprocess.run(['pdftotext', '-layout', '-f', str(i), '-l', str(i), pdf, '-'], capture_output=True, text=True)
        texts[i] = r.stdout.strip()
sl = [{'n': i, 'text': texts.get(i, ''), 'img': f'slide-{i}.jpg'} for i in range(1, len(pages) + 1)]
json.dump(sl, open(os.path.join(out, 'slides.json'), 'w'), ensure_ascii=False, indent=1)
print(f"upload {meta['id']}: {meta['file_name']} by {meta.get('uploaded_by') or meta.get('email')}, shop {meta.get('shop') or '-'}, note: {meta.get('note') or '-'}")
print(f'{len(sl)} slides -> {out}')
