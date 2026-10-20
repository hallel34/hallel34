#!/usr/bin/env python3
"""Builds src/assets/wordmark.svg: outlined Rubik Black glyphs (no font dependency).
Hebrew 'פסיבו' large, 'PASSIVO' tracked below; gold fill + navy outline so it reads on dark AND light grounds.
Run: python3 scripts/make-wordmark.py  (needs fonttools: pip install fonttools)"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
F = ROOT / 'node_modules/@fontsource/rubik/files'
heb = TTFont(F / 'rubik-hebrew-900-normal.woff'); lat = TTFont(F / 'rubik-latin-900-normal.woff')

def run(font, text, size, x0, y0, track=0, rtl=False):
    cmap = font.getBestCmap(); gs = font.getGlyphSet(); upm = font['head'].unitsPerEm; k = size / upm
    chars = list(text)
    adv = [font['hmtx'][cmap[ord(c)]][0] * k + track for c in chars]
    total = sum(adv) - track
    paths = []
    x = x0 + total if rtl else x0
    for c, a in zip(chars, adv):
        g = cmap[ord(c)]; pen = SVGPathPen(gs)
        gx = x - (a - track) if rtl else x
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, gx, y0)))
        paths.append(pen.getCommands())
        x = gx - track if rtl else x + a
    return ' '.join(paths), total

W = 360
hp, hw = run(heb, 'פסיבו', 124, 0, 124, track=2, rtl=True)
hx = (W - hw) / 2
hp, hw = run(heb, 'פסיבו', 124, hx, 124, track=2, rtl=True)
lp, lw = run(lat, 'PASSIVO', 40, 0, 182, track=16)
lx = (W - lw) / 2
lp, lw = run(lat, 'PASSIVO', 40, lx, 182, track=16)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 200" width="{W}" height="200" role="img" aria-label="פסיבו Passivo">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD479"/><stop offset=".55" stop-color="#F2B53A"/><stop offset="1" stop-color="#E3A020"/></linearGradient></defs>
<g stroke-linejoin="round" stroke-linecap="round">
<path d="{hp}" fill="#0F1E46" stroke="#0F1E46" stroke-width="14" transform="translate(0 4)"/>
<path d="{hp}" fill="url(#g)" stroke="#0F1E46" stroke-width="7" paint-order="stroke"/>
<path d="{lp}" fill="#0F1E46" stroke="#0F1E46" stroke-width="10" transform="translate(0 3)"/>
<path d="{lp}" fill="#FFF0D4" stroke="#0F1E46" stroke-width="5" paint-order="stroke"/>
</g></svg>'''
(ROOT / 'src/assets/wordmark.svg').write_text(svg); print('wordmark', hw, lw, len(svg))
