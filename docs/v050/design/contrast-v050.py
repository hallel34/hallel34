#!/usr/bin/env python3
"""WCAG AA audit for the 0.5.0 career screens (docs/v050/design/career-spec.md section 11).
Same helpers as docs/v051/design/contrast-v051.py. Alpha tints are composited on the surface they sit on.
Run: python3 docs/v050/design/contrast-v050.py [--md]. Exit 1 on any failure."""
import sys
def h(c): c=c.lstrip('#'); return tuple(int(c[i:i+2],16) for i in (0,2,4))
def L(c):
    f=lambda v:(v/255/12.92) if v/255<=.03928 else ((v/255+.055)/1.055)**2.4
    r,g,b=map(f,h(c)); return .2126*r+.7152*g+.0722*b
def cr(a,b):
    la,lb=L(a),L(b)
    if la<lb: la,lb=lb,la
    return (la+.05)/(lb+.05)
def mix(fg,a,bg):
    f,b=h(fg),h(bg); return '#'+''.join(f'{round(f[i]*a+b[i]*(1-a)):02X}' for i in range(3))

# existing tokens (src/styles/tokens.css)
D=dict(bg='#0F172A',surface='#182238',s2='#212D48',text='#F5F7FC',muted='#A9B5D0',income='#5FE0AE',
       bstrong='#8A97B8',btnb='#7C89AB',amber='#FFD27A',track=mix('#FFFFFF',.10,'#182238'),sel='#F5F7FC')
Lt=dict(bg='#FBF3E1',surface='#FFFFFF',s2='#FFF9EC',text='#0F172A',muted='#3F4C78',income='#0B6B43',
        bstrong='#6F7899',btnb='#6F7899',amber='#6E4200',track=mix('#0F1E46',.14,'#FFFFFF'),sel='#0F172A')
# NEW 0.5.0 tokens (section 10)
CAREER = {'DARK':'#F59A5B','LIGHT':'#A84E0B'}        # --career: rank glyphs, "+XP" text, x2 marker, kicker
CFILL  = {'DARK':'#E8702A','LIGHT':'#C2571A'}        # --career-fill: the XP bar fill (non-text)
CTINT  = {'DARK':(.14,'#F59A5B'),'LIGHT':(.10,'#A84E0B')}   # --career-tint
# the promotion card is the cream decision card in both themes (theme independent)
CREAM='#FFF6E3'; WHITE='#FFFFFF'; INK='#0F172A'; INKM='#46527E'
KEEP='#0B6B43'; SPEND_FULL='#B42318'; SPEND_FAM='#6E4200'
rows=[]
for th,T in (('DARK',D),('LIGHT',Lt)):
    c=CAREER[th]; f=CFILL[th]; a,base=CTINT[th]
    for sn in ('bg','surface','s2'):
        rows.append((th,f'--career text/glyph on {sn}',c,T[sn],4.5))
    tint=mix(base,a,T['surface'])
    rows += [
     (th,'--career on --career-tint (x2 marker, banner icon)',c,tint,4.5),
     (th,'--text on --career-tint (promo-week banner)',T['text'],tint,4.5),
     (th,'--text-muted on --career-tint',T['muted'],tint,4.5),
     (th,'XP bar fill --career-fill / track on surface (non-text)',f,T['track'],3),
     (th,'XP bar fill --career-fill / surface (non-text)',f,T['surface'],3),
     (th,'XP bar fill --career-fill / surface-2 (non-text, sheet)',f,T['s2'],3),
     (th,'promo-week card outline --career / surface (non-text)',c,T['surface'],3),
     (th,'rank glyph ring --career / surface (non-text)',c,T['surface'],3),
     (th,'locked / history dashed ring --border-strong / surface (non-text)',T['bstrong'],T['surface'],3),
     (th,'locked glyph --text-muted / surface',T['muted'],T['surface'],4.5),
     (th,'locked achievement label --text-muted / bg',T['muted'],T['bg'],4.5),
     (th,'hatched "before" bar --border-strong / track (non-text)',T['bstrong'],T['track'],3),
     (th,'warning chip text --amber-ink on --amber-fill (on surface)',T['amber'],mix({'DARK':'#F6C453','LIGHT':'#F2B53A'}[th],{'DARK':.16,'LIGHT':.30}[th],T['surface']),4.5),
     (th,'warning sentence --amber-ink / bg (home)',T['amber'],T['bg'],4.5),
     (th,'seniority kept chip text --text / surface-2',T['text'],T['s2'],4.5),
     (th,'week day today ring --sel-ring / surface (non-text)',T['sel'],T['surface'],3),
     (th,'played-day check --career on --career-tint',c,tint,4.5),
     (th,'rank chip selected ring --sel-ring / surface-2 (non-text)',T['sel'],T['s2'],3),
     (th,'rank chip border (--btn-secondary-border) / surface-2 (non-text)',T['btnb'],T['s2'],3),
     (th,'"+XP" gain text --career / surface-2',c,T['s2'],4.5),
     (th,'ghost button border / bg (non-text)',T['btnb'],T['bg'],3),
     (th,'income check (return screen) --income / bg',T['income'],T['bg'],4.5),
    ]
# the cream promotion card
rows += [
 ('BOTH','card ink on cream',INK,CREAM,4.5),
 ('BOTH','card muted (#46527E) on cream',INKM,CREAM,4.5),
 ('BOTH','card muted on white option tile',INKM,WHITE,4.5),
 ('BOTH','option money ink on white',INK,WHITE,4.5),
 ('BOTH','"keep" bar and legend swatch #0B6B43 / white (non-text)',KEEP,WHITE,3),
 ('BOTH','"spend" hatched bar edge, full #B42318 / white (non-text)',SPEND_FULL,WHITE,3),
 ('BOTH','"spend" hatched bar edge, family amber-ink #6E4200 / white (non-text)',SPEND_FAM,WHITE,3),
 ('BOTH','card chip ink #6E4200 on #FFF0C9',SPEND_FAM,'#FFF0C9',4.5),
 ('BOTH','card chip edge #A8720C / cream (non-text)','#A8720C',CREAM,3),
 ('BOTH','card option button border #6B7596 / white (non-text)','#6B7596',WHITE,3),
 ('BOTH','card focus ring #0F172A / cream (non-text)',INK,CREAM,3),
 ('BOTH','gold primary label #2A1700 / #F2B53A','#2A1700','#F2B53A',4.5),
]
bad=0; md='--md' in sys.argv
if md: print('| Theme | Pair | Ratio | Need |\n|---|---|---|---|')
for th,n,a,b,need in rows:
    r=cr(a,b); ok=r>=need; bad+=not ok
    print(f'| {th} | {n} | {r:.1f}:1 | {need} |' if md else f'{"OK " if ok else "BAD"} {th:5} {r:5.1f} (>= {need}) {n}  [{a} on {b}]')
print(f'\n{len(rows)} pairs, {bad} failing'); sys.exit(1 if bad else 0)
