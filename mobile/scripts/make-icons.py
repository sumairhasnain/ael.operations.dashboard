# Placeholder AEL icon (navy square, white "AEL"). Replace assets/icon.png with the real logo and re-run.
import sys, os
from PIL import Image, ImageDraw, ImageFont
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'assets', 'icon.png')
if not os.path.exists(src):
    im = Image.new('RGB', (1024, 1024), '#12355b'); d = ImageDraw.Draw(im)
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 360)
    except Exception: f = ImageFont.load_default()
    w = d.textlength('AEL', font=f); d.text(((1024 - w) / 2, 330), 'AEL', font=f, fill='white')
    im.save(src)
base = Image.open(src).convert('RGBA')
res = os.path.join(root, 'android/app/src/main/res')
for dpi, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(res, 'mipmap-' + dpi)
    base.resize((px, px), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    m = Image.new('L', (px, px), 0); ImageDraw.Draw(m).ellipse((0, 0, px - 1, px - 1), fill=255)
    r = base.resize((px, px), Image.LANCZOS); r.putalpha(m); r.save(os.path.join(d, 'ic_launcher_round.png'))
    fp = int(px * 108 / 48); fg = Image.new('RGBA', (fp, fp), (0, 0, 0, 0))   # adaptive: art kept inside the safe zone
    inner = base.resize((int(fp * 0.61), int(fp * 0.61)), Image.LANCZOS); o = (fp - inner.width) // 2; fg.paste(inner, (o, o)); fg.save(os.path.join(d, 'ic_launcher_foreground.png'))
open(os.path.join(res, 'values/ic_launcher_background.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#12355B</color>\n</resources>\n')
print('icons written')
