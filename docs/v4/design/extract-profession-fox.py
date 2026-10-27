#!/usr/bin/env python3
"""Extract the 8 waving profession foxes from design/character/professions-ref/owner-professions-ref.jpg (720x1560).
Run: python3 -I docs/v4/design/extract-profession-fox.py [--debug DIR]   (Pillow + numpy + scipy). Deterministic.
Matting: the card is a flat navy (~#182339) and each fox sits in a slightly lighter navy box (~#1A263E). Both are dark and
low-texture, but the police uniform, the lawyer's suit and the programmer's hoodie are ALSO navy/black, so a colour key would
eat them. Instead the background is FLOOD-FILLED from the box's top / left / right edges through pixels close to the local
navy (the cartoon's dark outline is the barrier), plus per-fox bottom seeds for pockets that only open to the bottom cut
(between tail and body). The 2px edge band gets a soft alpha (distance to the navy) and is un-mixed from the navy, so no dark
fringe shows on the light theme. The fox is cut flat at the bottom in the source; the card art keeps that flat base.
Outputs (src/assets/profession-fox/):
  <id>.webp       card art @1x, 104x120  (CSS 104x120)
  <id>@2x.webp    card art at the source resolution 159x184 (= 1.53x; never upscaled; srcset "1x, 1.5x")
  <id>-head.webp  HUD avatar @1x 44x44, bust (head + collar), square, transparent (CSS clips the circle)
  <id>-head@2x.webp 88x88"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = f'{ROOT}/design/character/professions-ref/owner-professions-ref.jpg'
OUT = f'{ROOT}/src/assets/profession-fox'
BOX_W, BOX_H = 159, 184             # the fox image box in the reference (identical for all 8 cards)
COL_X = {'R': 453, 'L': 109}        # RTL grid: the first card of a row is on the right
ROW_Y = [155, 471, 787, 1103]
# reference order (RTL, row by row) -> profession ids in src/data/professions.he.json (labels under each fox)
LAYOUT = {
  'teacher':    ('R', 0),  # מורה
  'engineer':   ('L', 0),  # מהנדס/ת
  'driver':     ('R', 1),  # נהג/ת מונית
  'nurse':      ('L', 1),  # אח/ות
  'programmer': ('R', 2),  # מפתח/ת תוכנה
  'police':     ('L', 2),  # שוטר/ת
  'cook':       ('R', 3),  # טבח/ית
  'lawyer':     ('L', 3),  # עורך/ת דין
}
OPEN = {'police': 3, 'driver': 2, 'lawyer': 2}  # the navy uniform touches the navy card through a weak outline: cut leaks narrower than 6px
POCKET_MIN, POCKET_D = 300, 7.5   # enclosed flat navy areas this big are background, not cloth (cloth has texture, d >= 8)
T_HALO = 26.0                     # darker-than-card pixels up to this distance = ringing halo, not outline (black, > 40)
PROTECT = {'driver': [(66, 33), (75, 24), (88, 20), (100, 18), (115, 19), (128, 24), (138, 32), (143, 42), (140, 50), (100, 48), (68, 42)]}
HALO = {'driver': 12.0, 'lawyer': 0.0}   # dark navy cap / black suit: a tighter halo limit
BE_CLOTH = 5.0                    # blue excess over the card that marks navy cloth (police uniform)
# HUD avatar crop: (cx, cy, size) in box px. A BUST (head + collar), not the head alone: 4 of the 8 heads are identical
# without the outfit, and at 44px the collar (stethoscope, headphones, tie, cardigan, chef's scarf) tells them apart.
HEAD = {}
HEAD_DEFAULT = (100, 74, 128)
T_BG = 14.0     # max distance to the navy for background pixels (outline / fur are > 30 away)
CARD_H, CARD_W1 = 120, 104
HEAD_PX = {'': 44, '@2x': 88}

def flood(cand):
    """Background = the pixels of `cand` connected to the box's top / left / right edge (the bottom is the cut through the body)."""
    seed = np.zeros_like(cand); seed[0, :] = seed[:, 0] = seed[:, -1] = True; seed &= cand
    lab, _ = ndi.label(cand); ids = np.unique(lab[seed]); ids = ids[ids > 0]
    return np.isin(lab, ids)

def largest(m):
    lab, n = ndi.label(m)
    if n > 1: m = lab == (1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))))
    return m

def matte(box, pid):
    a = np.asarray(box, dtype=np.float32)
    border = np.concatenate([a[:3].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    B = np.median(border, axis=0)                                    # the card / box navy
    sm = np.stack([ndi.median_filter(a[..., c], 3) for c in range(3)], -1)
    d = np.linalg.norm(sm - B, axis=2)                               # distance to the navy, JPEG noise removed
    g = np.stack([ndi.gaussian_filter(a[..., c], 2.0) for c in range(3)], -1)
    be = g[..., 2] - (g[..., 0] + g[..., 1]) / 2                     # blue excess: navy cloth is bluer than the card
    cloth = be > np.median(be[d < T_BG]) + BE_CLOTH
    darker = sm.mean(2) < B.mean() - 2
    keep = np.zeros(d.shape, bool)
    if pid in PROTECT:   # hand-traced areas that are cloth although they match the card (the driver's navy cap crown)
        from PIL import ImageDraw
        k = Image.new('L', (d.shape[1], d.shape[0]), 0); ImageDraw.Draw(k).polygon(PROTECT[pid], fill=1); keep = np.asarray(k, bool)
    cand = ((d < T_BG) | (darker & (d < HALO.get(pid, T_HALO)))) & ~cloth & ~keep   # + the dark JPEG ringing halo outside the outline
    bg = flood(cand)
    r = OPEN.get(pid, 0)
    if r:   # cut thin leak channels through a weak outline (police): keep only the bg reachable through >= 2r px gaps
        core = flood(ndi.binary_opening(bg, iterations=r)); bg &= ndi.binary_dilation(core, iterations=r + 1)
    fg = largest(ndi.binary_fill_holes(ndi.binary_closing(~bg, iterations=1) | keep))
    # enclosed navy pockets (between the waving arm and the head, between arm and tail): big + flat -> background
    lab, n = ndi.label(cand & fg)
    for i in range(1, n + 1):
        m = lab == i
        ys, xs = np.nonzero(m)
        if m.sum() >= POCKET_MIN and d[m].mean() < POCKET_D and ys.mean() > 70 and xs.mean() < 80: fg &= ~m   # arm side only
    fg = largest(ndi.binary_opening(fg, iterations=1))
    thin = fg & ~ndi.binary_opening(fg, iterations=2)               # specks and 1-3px spurs of the halo (not ear tips: d > 30)
    fg = largest((fg & ~(thin & (d < 30))) | keep)
    # soft edge: a 2px band inside the silhouette gets alpha from the distance to the local navy, then is un-mixed
    wgt = ndi.gaussian_filter((~fg).astype(np.float32), 5)
    Bloc = np.stack([ndi.gaussian_filter(a[..., c] * ~fg, 5) for c in range(3)], -1) / np.maximum(wgt[..., None], 1e-3)
    Bloc = np.where(wgt[..., None] > 0.02, Bloc, B)
    dl = np.linalg.norm(a - Bloc, axis=2)
    alpha = fg.astype(np.float32)
    band = fg & ~ndi.binary_erosion(fg, iterations=2)
    t = np.clip((dl - 6) / 40, 0, 1); t = t * t * (3 - 2 * t)
    alpha[band] = np.maximum(t[band], 0.35)                         # the band never drops below .35: no see-through nicks
    alpha[-1, :] = alpha[-2, :]                                       # the bottom cut stays a clean edge
    alpha = ndi.gaussian_filter(alpha, 0.5) * ndi.binary_dilation(fg, iterations=1)
    A = alpha[..., None]
    rgb = np.where(A > 0.02, (a - (1 - A) * Bloc) / np.maximum(A, 0.02), 0)
    # pixels outside the silhouette (the 1px blur ring) take the colour of the nearest inside pixel: un-mixing a low alpha
    # would amplify JPEG noise into bright specks
    _, (iy, ix) = ndi.distance_transform_edt(~ndi.binary_erosion(fg, iterations=1), return_indices=True)
    rgb = np.where(ndi.binary_erosion(fg, iterations=1)[..., None], rgb, rgb[iy, ix])
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), ~fg

def save(img, path, q=66, aq=52):   # q66 / alpha 52: no visible loss at 1:1 on either theme, keeps the set under 120 KB
    img.save(path, 'WEBP', quality=q, alpha_quality=aq, method=6)
    return os.path.getsize(path)

def main():
    dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
    src = Image.open(SRC).convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for pid, (col, row) in LAYOUT.items():
        x0, y0 = COL_X[col], ROW_Y[row]
        box = src.crop((x0, y0, x0 + BOX_W, y0 + BOX_H))
        img, bgm = matte(box, pid)
        if dbg:
            img.save(f'{dbg}/{pid}-master.png'); Image.fromarray((bgm * 255).astype(np.uint8)).save(f'{dbg}/{pid}-bg.png')
        total += save(img.resize((CARD_W1, CARD_H), Image.LANCZOS), f'{OUT}/{pid}.webp')
        total += save(img, f'{OUT}/{pid}@2x.webp')
        cx, cy, s = HEAD.get(pid, HEAD_DEFAULT)
        hb = (round(cx - s / 2), round(cy - s / 2), round(cx + s / 2), round(cy + s / 2))
        head = Image.new('RGBA', (round(s), round(s)), (0, 0, 0, 0))
        head.alpha_composite(img.crop((max(hb[0], 0), max(hb[1], 0), min(hb[2], BOX_W), min(hb[3], BOX_H))), (max(-hb[0], 0), max(-hb[1], 0)))
        for suf, px in HEAD_PX.items():
            total += save(head.resize((px, px), Image.LANCZOS), f'{OUT}/{pid}-head{suf}.webp')
    print(f'{len(LAYOUT)} foxes, {len(LAYOUT) * 4} files, {total / 1024:.1f} KB total')

if __name__ == '__main__':
    main()
