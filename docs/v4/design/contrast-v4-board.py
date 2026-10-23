#!/usr/bin/env python3
"""WCAG AA audit for the v4 board tile families (docs/v4/design/board-spec.md section 9).
Same helpers as docs/v3/design/contrast-v3.py. Run: python3 docs/v4/design/contrast-v4-board.py [--md]. Exit 1 on any failure."""
import sys
def h(c): c=c.lstrip('#'); return tuple(int(c[i:i+2],16) for i in (0,2,4))
def L(c):
    f=lambda v:(v/255/12.92) if v/255<=.03928 else ((v/255+.055)/1.055)**2.4
    r,g,b=map(f,h(c)); return .2126*r+.7152*g+.0722*b
def cr(a,b):
    la,lb=L(a),L(b)
    if la<lb: la,lb=lb,la
    return (la+.05)/(lb+.05)
# board ground (behind the tiles): dark = the deepest skyline band, light = paper
BOARD_D, BOARD_D2, BOARD_L = '#0A1020', '#131C33', '#F1E5C8'
FAM = {  # name: (dark bg, dark edge, dark ink, light bg, light edge, light ink)
 'gold (payday, opportunity)':            ('#2A2414','#C9952F','#FFD479', '#FFF0C9','#A8720C','#6E4200'),
 'red (expense), full mode':              ('#36121A','#D9463E','#FF9E92', '#FDE3DF','#B3261E','#8F1D16'),
 'sky (market, baby, charity, tax-audit)':('#0E2742','#4DA3FF','#9CCBFF', '#E1EEFB','#1A62B3','#12477F'),
 'deep amber (expense), family mode':     ('#331C0B','#D97F1F','#FFB46A', '#FBE2C4','#A3520A','#6B3300'),
}
rows=[]
for n,(db,de,di,lb,le,li) in FAM.items():
    rows += [
     ('DARK',  f'label + icon ink / tile bg — {n}', di, db, 4.5),
     ('DARK',  f'tile edge / board ground — {n} (non-text)', de, BOARD_D, 3),
     ('DARK',  f'tile edge / board ground lighter band — {n} (non-text)', de, BOARD_D2, 3),
     ('LIGHT', f'label + icon ink / tile bg — {n}', li, lb, 4.5),
     ('LIGHT', f'tile edge / board ground — {n} (non-text)', le, BOARD_L, 3),
    ]
# current-tile ring (2px) against the 2px ground gap it sits on, and the legend/caption text
rows += [
 ('DARK',  'current ring gold-400 / board ground (non-text)', '#F2B53A', BOARD_D, 3),
 ('DARK',  'current ring gold-400 / lighter band (non-text)', '#F2B53A', BOARD_D2, 3),
 ('LIGHT', 'current ring gold-700 #8A5A00 / paper ground (non-text)', '#8A5A00', BOARD_L, 3),
 ('DARK',  'deal badge A ink / A tint', '#0B3D27', '#7FE3B8', 4.5),
 ('DARK',  'deal badge B ink / B tint', '#3A2600', '#F5C55A', 4.5),
 ('DARK',  'deal badge C ink / C tint (full)', '#FFFFFF', '#A8322B', 4.5),
 ('DARK',  'deal badge C ink / C tint (family)', '#3A1C00', '#E59A4C', 4.5),
 ('CARD',  'deal badge A ink / A tint (on cream)', '#FFFFFF', '#0B6B43', 4.5),
 ('CARD',  'deal badge B ink / B tint (on cream)', '#2A1700', '#E8A317', 4.5),
 ('CARD',  'deal badge C ink / C tint full (on cream)', '#FFFFFF', '#B42318', 4.5),
 ('CARD',  'deal badge C ink / C tint family (on cream)', '#FFFFFF', '#8A4B00', 4.5),
 ('CARD',  'badge A fill / cream (non-text)', '#0B6B43', '#FFF6E3', 3),
 ('CARD',  'badge B 1.5px border #6B4300 / cream (non-text; the B fill alone is 2.0:1)', '#6B4300', '#FFF6E3', 3),
 ('DARK',  'badge A fill / surface #182238 (statement list, non-text)', '#7FE3B8', '#182238', 3),
 ('DARK',  'badge B fill / surface (non-text)', '#F5C55A', '#182238', 3),
 ('DARK',  'badge C full 1px border / surface (non-text; fill #A8322B)', '#FF9E92', '#182238', 3),
 ('DARK',  'badge C family fill / surface (non-text)', '#E59A4C', '#182238', 3),
 ('CARD',  'badge C full fill / cream (non-text)', '#B42318', '#FFF6E3', 3),
 ('CARD',  'badge C family fill / cream (non-text)', '#8A4B00', '#FFF6E3', 3),
 ('DARK',  'fox bubble text / smoked glass (solid fallback #141C30)', '#F5F7FC', '#141C30', 4.5),
 ('DARK',  'fox bubble muted / smoked glass', '#A9B5D0', '#141C30', 4.5),
 ('LIGHT', 'fox bubble text / light glass (solid fallback #FFFDF7)', '#0F172A', '#FFFDF7', 4.5),
 ('DARK',  'die result number text / plaza', '#F5F7FC', '#0F172A', 4.5),
 ('LIGHT', 'die result number text / plaza', '#0F172A', '#FBF3E1', 4.5),
]
fails=[r for r in rows if cr(r[2],r[3])<r[4]]
if '--md' in sys.argv:
    print('| Theme | Pair | FG | BG | Ratio | Need | Pass |\n|---|---|---|---|---|---|---|')
    for t,n,f,b,m in rows: print(f'| {t} | {n} | `{f}` | `{b}` | {cr(f,b):.2f}:1 | {m} | {"yes" if cr(f,b)>=m else "NO"} |')
else:
    for t,n,f,b,m in rows: print(f'{t:5} {cr(f,b):5.2f} {"ok" if cr(f,b)>=m else "FAIL"}  {n}')
sys.exit(1 if fails else 0)
