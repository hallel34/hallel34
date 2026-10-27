#!/usr/bin/env python3
"""Extract the owner's 3D raster tiles from design/board-ref/owner-board-3d-tiles.jpg into src/assets/tile3d/.
Run: python3 -I docs/v4/design/extract-tile3d.py   (needs Pillow + numpy + scipy). Deterministic; re-run after changing a box.
Matting: the board is a flat beige B. Per pixel p, s = <p,B>/<B,B> and r = |p - sB|. r large = tile; r small = board, where
(1 - s) is the darkening = alpha of a black contact shadow. The tile = the largest strong-chroma component near the crop centre,
holes filled (cream banknote band, baby face), 1.5px antialias band unmixed against the local board colour.
Canvas: 1.25 x 1.5 of the tile cell (footprint = 80% of the width, body base at 1 - 1/12 of the height), see board-spec.md 13 and 14."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = f'{ROOT}/design/board-ref/owner-board-3d-tiles.jpg'
OUT = f'{ROOT}/src/assets/tile3d'
K = 1440 / 989  # boxes below are in the 989-wide preview coordinates
BOX = {  # type: (x0, y0, x1, y1) around ONE tile incl. its shadow
  'payday':      (312, 665, 442, 805),   # yellow banknote, top row
  'opportunity': (192, 638, 322, 805),   # green house, top row
  'expense':     (547, 665, 677, 805),   # red lightning, top row
  'market':      (432, 638, 557, 805),   # blue chart, top row
  'baby':        (52, 992, 188, 1122),   # pink baby face, left column
  'charity':     (72, 665, 202, 791),    # purple heart, top row
}
ERODE = {'baby': 8, 'charity': 8}   # these two nearly touch the tile below them
BOARD_SAT = {'payday': 0.36}        # the yellow tile shares the board's hue: only low-saturation pixels count as board
CELL_W, CELL_H = 1.25, 1.5          # canvas in cells
FOOT = 0.80                          # footprint width / canvas width
BASE = 1 - 1 / 12                    # body base line / canvas height (leaves 1/12 for the contact shadow)
SIZES = {'': 75, '@2x': 150}         # canvas width px per density (cell up to 60 css, board-spec 14); height = width * 1.2.
                                     # @2x footprint 120px < the ~155px source footprint: still a downscale, never an upscale

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def matte(crop, erode=3, board_sat=0.55):
    a = np.asarray(crop, dtype=np.float32)
    h, w, _ = a.shape
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    lum = border.sum(1); B = np.median(border[lum >= np.percentile(lum, 60)], axis=0)
    s = (a @ B) / (B @ B)
    r = np.linalg.norm(a - s[..., None] * B, axis=2)
    rel = r / (np.maximum(s, 0.05) * np.linalg.norm(B))   # chroma residual relative to the local brightness
    # warm board shadows are MORE saturated than the lit board but keep its hue: exclude beige-hue, mid-saturation pixels
    hsv = np.asarray(crop.convert('HSV')).astype(np.float32) / 255
    hue, sat = hsv[..., 0] * 360, hsv[..., 1]
    boardish = (hue > 16) & (hue < 54) & (sat < board_sat)
    core = ~boardish & ((r > 26) | (rel > 0.10))
    core = ndi.binary_opening(core, iterations=2)
    lab, n = ndi.label(ndi.binary_erosion(core, iterations=erode))
    yy, xx = np.mgrid[:h, :w]
    best, score = 0, -1
    for i in range(1, n + 1):
        m = lab == i
        d = np.hypot(yy[m].mean() - h * .55, xx[m].mean() - w / 2)
        sc = m.sum() / (1 + d / 10)
        if sc > score: best, score = i, sc
    tile = ndi.binary_dilation(lab == best, iterations=erode + 1) & core
    tile = ndi.binary_fill_holes(ndi.binary_closing(tile, iterations=3))
    warm = (hue > 16) & (hue < 54) & (sat < 0.55)        # board-hue pixels, also for the yellow tile
    for _ in range(8):                                       # peel board-hue pixels that touch the outside (shadow skirt)
        edge = tile & ~ndi.binary_erosion(tile, border_value=0)
        peel = edge & warm
        if not peel.any(): break
        tile &= ~peel
    band = ndi.binary_dilation(tile, iterations=2) & ~tile
    at = tile.astype(np.float32)
    at[band] = np.where(boardish[band], 0, np.maximum(smooth(14, 40, r[band]), smooth(0.05, 0.14, rel[band])))
    # shadow: only near this tile (drops the neighbours' shadows), fading out over 16px
    dist = ndi.distance_transform_edt(~tile)
    sh = np.clip((1 - s) - 0.035, 0, 1) / 0.965 * smooth(16, 6, dist)
    ty = np.nonzero(tile)[0]; t0, t1 = ty.min(), ty.max()
    sh *= smooth(t0 + .30 * (t1 - t0), t0 + .60 * (t1 - t0), yy)   # contact shadow only on the lower part (light from the top)
    sh[tile] = 0
    sh = ndi.gaussian_filter(sh, 0.8)
    A = at + (1 - at) * sh
    bgl = np.clip(s, 0, 1.2)[..., None] * B
    fg = np.where(at[..., None] > 0.02, (a - (1 - at[..., None]) * bgl) / np.maximum(at[..., None], 0.02), 0)
    rgb = np.where(at[..., None] > 0, fg * at[..., None] / np.maximum(A[..., None], 1e-3), 0)  # shadow part is black
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(A * 255, 0, 255)]).astype(np.uint8)
    ys, xs = np.nonzero(tile)
    return Image.fromarray(out, 'RGBA'), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

def place(img, bbox, cw):
    ch = round(cw * CELL_H / CELL_W)
    x0, y0, x1, y1 = bbox
    sc = FOOT * cw / (x1 - x0)
    big = img.resize((round(img.width * sc), round(img.height * sc)), Image.LANCZOS)
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ox = round(cw / 2 - (x0 + x1) / 2 * sc); oy = round(BASE * ch - y1 * sc)
    canvas.alpha_composite(big, (max(ox, 0), max(oy, 0)), (max(-ox, 0), max(-oy, 0)))
    return canvas

def hue_shift(img, sel, fn):
    """Recolour the pixels where sel(h,s,v) is true with fn(h,s,v)->(h,s,v). HSV in 0..1 floats."""
    rgba = np.asarray(img).astype(np.float32) / 255
    import colorsys
    hsv = np.asarray(img.convert('RGB').convert('HSV')).astype(np.float32) / 255
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = sel(H, S, V)
    H2, S2, V2 = fn(H.copy(), S.copy(), V.copy())
    hsv2 = np.dstack([np.where(m, H2, H), np.where(m, S2, S), np.where(m, V2, V)])
    rgb = Image.fromarray((np.clip(hsv2, 0, 1) * 255).astype(np.uint8), 'HSV').convert('RGB')
    out = np.dstack([np.asarray(rgb), (rgba[..., 3] * 255).astype(np.uint8)])
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def diffuse_fill(img, hole, iters=400):
    """Fill `hole` from its surroundings by repeated neighbour averaging (smooth top-face inpaint, no OpenCV)."""
    a = np.asarray(img).astype(np.float32)
    rgb = a[..., :3].copy(); known = ~hole
    rgb[hole] = 0
    w = known.astype(np.float32)
    acc = rgb * w[..., None]
    for _ in range(iters):
        acc_b = ndi.uniform_filter(acc, size=(3, 3, 1)); w_b = ndi.uniform_filter(w, size=3)
        new = acc_b / np.maximum(w_b[..., None], 1e-4)
        rgb[hole] = new[hole]
        acc = rgb * np.maximum(w, (w_b > 0))[..., None]; w = np.maximum(w, (w_b > 0).astype(np.float32))
    a[..., :3] = rgb
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def arc_pts(p0, p1, r, n=24):
    """SVG arc (large=0, sweep=1) from p0 to p1 with radius r, as points (y down)."""
    import math
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2; dx, dy = x1 - x0, y1 - y0; q = math.hypot(dx, dy)
    r = max(r, q / 2); hgt = math.sqrt(r * r - (q / 2) ** 2)
    # sweep=1 (clockwise on screen) with the small arc: centre lies to the right of the chord direction
    cx, cy = mx - hgt * dy / q, my + hgt * dx / q
    a0, a1 = math.atan2(y0 - cy, x0 - cx), math.atan2(y1 - cy, x1 - cx)
    while a1 < a0: a1 += 2 * math.pi
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def bez_pts(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append(tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return out

def draw_sparkle(d, px, sw):
    """The exact paths of tile/opportunity.svg: the four-point sparkle (4 cubic segments) and the small plus."""
    segs = [((10.5, 3), (11.1, 7), (13.1, 9.3), (17.5, 10.5)), ((17.5, 10.5), (13.1, 11.7), (11.1, 14), (10.5, 18)),
            ((10.5, 18), (9.9, 14), (7.9, 11.7), (3.5, 10.5)), ((3.5, 10.5), (7.9, 9.3), (9.9, 7), (10.5, 3))]
    pts = [p for sg in segs for p in bez_pts(*sg)]
    d.line([px(x, y) for x, y in pts], fill=255, width=sw, joint='curve')
    for a, b in (((19, 15), (19, 20)), ((16.5, 17.5), (21.5, 17.5))):
        d.line([px(*a), px(*b)], fill=255, width=sw)
        for q in (px(*a), px(*b)): d.ellipse([q[0] - sw / 2, q[1] - sw / 2, q[0] + sw / 2, q[1] + sw / 2], fill=255)

def emboss_glyph(tile, svg_paths, box, ink=(255, 246, 227), draw=None):
    """Draw a monoline glyph (default: the tax-audit magnifier; `draw(d, px, sw)` for another) as a raised cream emboss:
    dark offset shadow, cream body, light top edge."""
    from PIL import ImageDraw, ImageFilter
    W = tile.width; S = 8  # supersample
    gx, gy, gs = box       # glyph top-left + size, in tile px
    def stroke_layer(dx, dy, width):
        L = Image.new('L', (W * S, tile.height * S), 0); d = ImageDraw.Draw(L)
        u = gs * S / 24; px = lambda x, y: ((gx + dx) * S + x * u, (gy + dy) * S + y * u)
        sw = max(1, round(width * u))
        if draw:
            draw(d, px, sw)
            return L.resize(tile.size, Image.LANCZOS)
        cx, cy, rr = 10.5, 10.5, 7
        d.ellipse([px(cx - rr, cy - rr), px(cx + rr, cy + rr)], outline=255, width=sw)
        d.line([px(15.5, 15.5), px(20.5, 20.5)], fill=255, width=sw)
        for p in (px(15.5, 15.5), px(20.5, 20.5)): d.ellipse([p[0] - sw / 2, p[1] - sw / 2, p[0] + sw / 2, p[1] + sw / 2], fill=255)
        # question mark = the exact path of tile/tax-audit.svg: M8.6 8.6 a2 2 0 0 1 3.9.6 c0 1.3-2 1.7-2 2.9 ; dot at 10.5 14.6
        pts = arc_pts((8.6, 8.6), (12.5, 9.2), 2.0) + bez_pts((12.5, 9.2), (12.5, 10.5), (10.5, 10.9), (10.5, 12.1))
        d.line([px(x, y) for x, y in pts], fill=255, width=sw, joint='curve')
        for x, y in (pts[0], pts[-1]):
            q = px(x, y); d.ellipse([q[0] - sw / 2, q[1] - sw / 2, q[0] + sw / 2, q[1] + sw / 2], fill=255)
        q = px(10.5, 14.6); rq = sw * .62
        d.ellipse([q[0] - rq, q[1] - rq, q[0] + rq, q[1] + rq], fill=255)
        return L.resize(tile.size, Image.LANCZOS)
    body = stroke_layer(0, 0, 2.6)
    shadow = stroke_layer(gs * .03, gs * .06, 2.6).filter(ImageFilter.GaussianBlur(gs * .025))
    hi = stroke_layer(-gs * .012, -gs * .02, 1.6)
    out = tile.copy()
    def comp(mask, color, k):
        lay = Image.new('RGBA', tile.size, color + (0,)); lay.putalpha(mask.point(lambda v: int(v * k)))
        out.alpha_composite(lay)
    comp(shadow, (20, 40, 40), .55)
    comp(body, ink, 1)
    # lower half of the stroke slightly darker = rounded cream bevel
    lower = Image.eval(body, lambda v: v)  # same mask
    grad = Image.linear_gradient('L').resize(tile.size)
    bevel = Image.composite(lower, Image.new('L', tile.size, 0), grad.point(lambda v: 255 if v > 0 else 0))
    comp(Image.fromarray((np.asarray(body, np.float32) * (np.asarray(grad, np.float32) / 255) ** 2).astype(np.uint8)), (196, 170, 128), .45)
    comp(Image.fromarray((np.asarray(hi, np.float32) * (1 - np.asarray(grad, np.float32) / 255)).astype(np.uint8)), (255, 255, 255), .6)
    return out

def main():
    src = Image.open(SRC).convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    master = {}
    for name, b in BOX.items():
        crop = src.crop(tuple(round(v * K) for v in b))
        img, bbox = matte(crop, ERODE.get(name, 3), BOARD_SAT.get(name, 0.55))
        master[name] = place(img, bbox, 240)   # 4x master (cell 192), downsampled per density
    # family expense: red body -> deep amber, yellow bolt -> cream (keeps the bolt readable on amber)
    red = lambda H, S, V: ((H < 0.045) | (H > 0.93)) & (S > 0.35)
    amber = hue_shift(master['expense'], red, lambda H, S, V: (np.full_like(H, 0.072), np.clip(S * 1.0, 0, 1), V * 0.93))
    master['expense-family'] = hue_shift(amber, lambda H, S, V: (H > 0.10) & (H < 0.19) & (S > 0.35),
                                         lambda H, S, V: (np.full_like(H, 0.11), S * 0.22, np.clip(V * 1.04, 0, 1)))
    # tax audit: the pink baby tile body with its medallion inpainted, pink -> teal, cream magnifier emboss
    base = master['baby']
    hsv = np.asarray(base.convert('RGB').convert('HSV')).astype(np.float32) / 255
    alpha = np.asarray(base)[..., 3]
    pink = ((hsv[..., 0] > 0.86) | (hsv[..., 0] < 0.03)) & (hsv[..., 1] > 0.22) & (alpha > 250)
    body = ndi.binary_fill_holes(alpha > 250)
    medal = ndi.binary_fill_holes(ndi.binary_closing(body & ~pink, iterations=4)) & body
    medal = ndi.binary_opening(medal, iterations=2)
    lab, n = ndi.label(medal)
    if n:
        sizes = ndi.sum(medal, lab, range(1, n + 1)); medal = lab == (1 + int(np.argmax(sizes)))
    medal = ndi.binary_dilation(medal, iterations=4) & body
    filled = diffuse_fill(base, medal)
    teal = hue_shift(filled, lambda H, S, V: ((H > 0.80) | (H < 0.06)) & (S > 0.12),
                     lambda H, S, V: (np.full_like(H, 0.49), np.clip(S * 1.15, 0, 1), V * 0.82))
    ys, xs = np.nonzero(medal)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    gs = float(xs.max() - xs.min()) * 1.08; cx, cy = float(cx), float(cy)
    master['tax-audit'] = emboss_glyph(teal, None, (cx - gs * 10.5 / 24 - gs * .06, cy - gs * 10.5 / 24 - gs * .04, gs))
    # opportunity (owner, 2026-10-25): a NEUTRAL tile instead of the green house. The same rounded body as tax audit (medallion
    # inpainted), the gain-family green, and the sparkle of tile/opportunity.svg as the cream emboss. Without colour it reads by its
    # silhouette: a sparkle on a plain slab, unlike the banknote slab of payday and the magnifier of tax audit.
    green = hue_shift(filled, lambda H, S, V: ((H > 0.80) | (H < 0.06)) & (S > 0.12),
                      lambda H, S, V: (np.full_like(H, 0.37), np.clip(S * 1.05, 0, 1), V * 0.80))
    gs2 = gs * 1.04
    master['opportunity'] = emboss_glyph(green, None, (cx - gs2 * 11 / 24, cy - gs2 * 11 / 24 - gs2 * .02, gs2), draw=draw_sparkle)
    only = set(filter(None, os.environ.get('TILE3D_ONLY', '').split(',')))  # e.g. TILE3D_ONLY=opportunity: rewrite just that tile
    total = 0
    for name, im in master.items():
        if only and name not in only: continue
        for suf, w in SIZES.items():
            h = round(w * CELL_H / CELL_W)
            p = f'{OUT}/{name}{suf}.webp'
            im.resize((w, h), Image.LANCZOS).save(p, 'WEBP', quality=80, alpha_quality=85, method=6)
            total += os.path.getsize(p)
        if os.environ.get("TILE3D_MASTER"): im.save(f"{os.environ['TILE3D_MASTER']}/{name}-master.png")
    print(f'{len(master)} tiles, {len(master) * len(SIZES)} files, {total / 1024:.1f} KB total')

if __name__ == '__main__':
    main()
