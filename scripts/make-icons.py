#!/usr/bin/env python3
"""Passivo app icons (v3 Navy & Gold) — built from the approved hero art.
Source : design/character/passivo-fox-hero.jpg (1254x1254, fox on navy with gold ring)
Outputs: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon-32}.png
         src/assets/{app-icon-512,app-icon-foreground,app-icon-background}.png
Run    : npm run icons   (wraps this script; needs python3 + Pillow: pip install pillow)
Adaptive icon: foreground = fox disc on transparent, fully inside the central 66% (Android safe zone);
background = solid brand navy #0F1E46. Maskable PNG = hero scaled to 82% on a feathered navy field so
every launcher mask (circle/squircle/teardrop) keeps the ring + ears.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'design/character/passivo-fox-hero.jpg'
ICONS = ROOT / 'public/icons'; ASSETS = ROOT / 'src/assets'
NAVY = (15, 30, 70)
CX, CY, R = 627, 640, 610            # ring centre / radius used for the round crop (ear tips included)

hero = Image.open(SRC).convert('RGB')
W = hero.width
ICONS.mkdir(parents=True, exist_ok=True)

def save(img, path):
    img.save(path, optimize=True); print('wrote', path.relative_to(ROOT), img.size, img.mode)

# 1) "any" icons: the full hero, it already is a full-bleed navy square
for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    save(hero.resize((size, size), Image.LANCZOS), ICONS / name)
save(hero.resize((512, 512), Image.LANCZOS), ASSETS / 'app-icon-512.png')

# 2) favicon: tighter crop (ears to chin) so the face survives at 32px
save(hero.crop((60, 20, 1200, 1160)).resize((32, 32), Image.LANCZOS), ICONS / 'favicon-32.png')

# 3) maskable: hero at 82% over a navy field, edges feathered into the field
def feathered(img, scale, size, feather=0.09):
    inner = int(size * scale)
    art = img.resize((inner, inner), Image.LANCZOS)
    arr = np.asarray(img.resize((64, 64))).reshape(-1, 3)
    edge = np.concatenate([np.asarray(img.resize((64, 64)))[0], np.asarray(img.resize((64, 64)))[:, 0]])
    field = tuple(int(v) for v in edge.mean(axis=0))
    canvas = Image.new('RGB', (size, size), field)
    m = Image.new('L', (inner, inner), 0)
    f = int(inner * feather)
    ImageDraw.Draw(m).rectangle((f, f, inner - f, inner - f), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(f / 2))
    canvas.paste(art, ((size - inner) // 2, (size - inner) // 2), m)
    return canvas
save(feathered(hero, 0.82, 512), ICONS / 'icon-maskable-512.png')

# 4) adaptive foreground: fox disc, transparent outside, diameter = 66% of the canvas
FG = 1024
disc = hero.crop((CX - R, CY - R, CX + R, CY + R))
mask = Image.new('L', disc.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, disc.width - 1, disc.height - 1), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(10))
# keep the blurred edge inside the disc so no halo extends past the safe zone
inner = Image.new('L', disc.size, 0); ImageDraw.Draw(inner).ellipse((14, 14, disc.width - 15, disc.height - 15), fill=255)
mask = Image.fromarray(np.minimum(np.asarray(mask), np.asarray(inner.filter(ImageFilter.GaussianBlur(8)))))
d = int(FG * 0.66)
disc = disc.resize((d, d), Image.LANCZOS).convert('RGBA'); disc.putalpha(mask.resize((d, d), Image.LANCZOS))
fg = Image.new('RGBA', (FG, FG), (0, 0, 0, 0)); fg.paste(disc, ((FG - d) // 2, (FG - d) // 2), disc)
save(fg, ASSETS / 'app-icon-foreground.png')

# 5) adaptive background: solid navy
save(Image.new('RGB', (FG, FG), NAVY), ASSETS / 'app-icon-background.png')
