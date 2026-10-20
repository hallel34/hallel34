#!/usr/bin/env python3
"""Re-exports the cut-out fox poses (WebP @1x/@2x) from design/character/poses/<pose>-source.jpg (white background).
Run: python3 scripts/make-fox-poses.py   (needs pillow numpy scipy)
Method: flood-fill the near-white background from the border, then un-mix the white from the edge band
(alpha from the projection onto the nearest solid colour) so there is no white fringe on dark backgrounds."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'design/character/poses'
OUT = ROOT / 'src/assets/fox'
# @2x display height in px (the @1x file is exactly half); aspect = current POSES aspect in src/ui/fox.js
TARGET = {'roll': (256, 431, 450), 'tip': (300, 281, 450), 'wave': (600, 262, 450), 'tired': (600, 276, 450), 'hammock': (520, 450, 408)}


def cutout(path, holes=False):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    whiteish = rgb.min(axis=2) >= 240
    lab, _ = ndi.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    if holes:  # enclosed background pockets (between arm and head, hammock mesh): pure white and larger than a tooth
        sizes = ndi.sum(whiteish, lab, index=np.arange(1, lab.max() + 1))
        for i, sz in enumerate(sizes, start=1):
            if i not in border and sz > 400:
                bg |= lab == i
    near = ndi.binary_dilation(bg, iterations=3)
    solid = ~near
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    fg = rgb[idx[0], idx[1]]                      # nearest solid colour for every pixel
    d = 255.0 - fg
    den = (d * d).sum(axis=2)
    num = ((255.0 - rgb) * d).sum(axis=2)
    a = np.where(den > 900, np.clip(num / np.maximum(den, 1), 0, 1), 1.0)
    a = np.where(bg, 0.0, a)
    a = np.where(solid, 1.0, a)
    a = np.where(a < 0.04, 0.0, a)
    col = np.where(solid[..., None], rgb, np.clip((rgb - (1 - a[..., None]) * 255) / np.maximum(a[..., None], 1e-3), 0, 255))
    col = np.where((a < 1)[..., None], np.where(a[..., None] > 0.5, col, fg), col)
    out = np.dstack([col, a * 255]).round().astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def fit_canvas(im, ratio):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bbox)
    w, h = im.size
    if w / h < ratio:   # pad width
        nw = round(h * ratio); c = Image.new('RGBA', (nw, h), (0, 0, 0, 0)); c.paste(im, ((nw - w) // 2, 0)); return c
    nh = round(w / ratio); c = Image.new('RGBA', (w, nh), (0, 0, 0, 0)); c.paste(im, (0, nh - h)); return c


for pose, (h2, ow, oh) in TARGET.items():
    base = fit_canvas(cutout(SRC / f'{pose}-source.jpg', holes=pose in ('wave', 'hammock', 'tip', 'tired')), ow / oh)
    for scale, suffix in ((2, '@2x'), (1, '')):
        h = h2 if scale == 2 else h2 // 2
        w = round(h * ow / oh)
        im = base.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
        f = OUT / f'{pose}{suffix}.webp'
        im.save(f, 'WEBP', quality=84, alpha_quality=90, method=6)
        print(f.name, im.size, f.stat().st_size)
