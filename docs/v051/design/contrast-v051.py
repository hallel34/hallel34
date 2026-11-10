#!/usr/bin/env python3
"""WCAG AA audit for the 0.5.1 challenge screens (docs/v051/design/challenges-spec.md section 9).
Same helpers as docs/v3/design/contrast-v3.py. Alpha tints are composited on the surface they sit on.
Run: python3 docs/v051/design/contrast-v051.py [--md]. Exit 1 on any failure."""
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
       bstrong='#8A97B8',ghost='#7CC4FF',gold='#F2B53A',goldink='#2A1700',btnborder='#7C89AB',focus='#FFD479',amber='#FFD27A')
Lt=dict(bg='#FBF3E1',surface='#FFFFFF',s2='#FFF9EC',text='#0F172A',muted='#3F4C78',income='#0B6B43',
        bstrong='#6F7899',btnborder='#6F7899',focus='#0F172A',amber='#6E4200')
# NEW 0.5.1 tokens
SPLIT_D, SPLIT_L = '#7CC4FF', '#1A62B3'
rows=[]
for th,T,split,vt,st in (('DARK',D,SPLIT_D,.14,.14),('LIGHT',Lt,SPLIT_L,.10,.10)):
    for sname in ('bg','surface','s2'):
        s=T[sname]
        rows += [(th,f'--split text "פיצול" / {sname}',split,s,4.5),
                 (th,f'--split 3px marker bar / {sname} (non-text)',split,s,3)]
    vtint=mix(T['income'],vt,T['surface']); stint=mix(split,st,T['surface'])
    rows += [
     (th,'--verified text+icon / --verified-tint on surface',T['income'],vtint,4.5),
     (th,'--text / --verified-tint (badge label)',T['text'],vtint,4.5),
     (th,'--unverified (= --text-muted) / surface',T['muted'],T['surface'],4.5),
     (th,'--unverified dashed border (= --border-strong) / surface (non-text)',T['bstrong'],T['surface'],3),
     (th,'--text / --split-tint row on surface',T['text'],stint,4.5),
     (th,'--text-muted / --split-tint row on surface',T['muted'],stint,4.5),
     (th,'--split / --split-tint row on surface',split,stint,4.5),
     (th,'challenge chip text --text / surface (HUD)',T['text'],T['surface'],4.5),
     (th,'challenge chip border --border-strong / surface (non-text)',T['bstrong'],T['surface'],3),
     (th,'compare winner turns --income / surface-2',T['income'],T['s2'],4.5),
     (th,'compare column value --text / surface-2',T['text'],T['s2'],4.5),
     (th,'compare label --text-muted / surface-2',T['muted'],T['s2'],4.5),
     (th,'ghost button border / bg (non-text)',T['btnborder'],T['bg'],3),
     (th,'focus ring / bg (non-text)',T['focus'],T['bg'],3),
     (th,'family amber (junior compare loans) / surface',T['amber'],T['surface'],4.5),
    ]
rows += [('DARK','gold primary label / gold',D['goldink'],D['gold'],4.5),
         ('LIGHT','gold primary label / gold','#2A1700','#F2B53A',4.5),
         ('DARK','rank 1-3 numeral --text / surface-2', D['text'], D['s2'],4.5)]
bad=0; md='--md' in sys.argv
if md: print('| Theme | Pair | Ratio | Need |\n|---|---|---|---|')
for th,n,a,b,need in rows:
    r=cr(a,b); ok=r>=need; bad+=not ok
    print(f'| {th} | {n} | {r:.1f}:1 | {need} |' if md else f'{"OK " if ok else "BAD"} {th:5} {r:5.1f} (>= {need}) {n}  [{a} on {b}]')
print(f'\n{len(rows)} pairs, {bad} failing'); sys.exit(1 if bad else 0)
