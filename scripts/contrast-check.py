#!/usr/bin/env python3
"""WCAG contrast audit for the v3 'Navy & Gold' tokens. Run: python3 scripts/contrast-check.py [--md]
Mirrors the values in src/styles/tokens.css (keep in sync). Prints a table; exits 1 on any AA failure."""
import sys
def h(c): c=c.lstrip('#'); return tuple(int(c[i:i+2],16) for i in (0,2,4))
def over(fg,a,bg): return tuple(round(fg[i]*a+bg[i]*(1-a)) for i in range(3))
def L(c):
    f=lambda v:(v/255/12.92) if v/255<=.03928 else ((v/255+.055)/1.055)**2.4
    r,g,b=map(f,c); return .2126*r+.7152*g+.0722*b
def cr(a,b):
    la,lb=L(a),L(b); 
    if la<lb: la,lb=lb,la
    return (la+.05)/(lb+.05)

NAVY=h('0F1E46')
D={'bg':'#0F1E46','surface':'#16295E','surface-2':'#1D3573','sunken':'#0A1533'}
glass_dark=over((255,255,255),.10,NAVY); glassS_dark=over(h('0A1533'),.55,NAVY)
LI={'bg':'#FBF3E1','surface':'#FFFFFF','surface-2':'#FFF9EC','sunken':'#F1E5C8'}
glass_light=over((255,255,255),.72,h('FBF3E1'))
dark=[ # (label, fg, bg, min)
 ('text / bg','#FFFFFF','#0F1E46',4.5),('text / surface','#FFFFFF','#16295E',4.5),('text / surface-2','#FFFFFF','#1D3573',4.5),
 ('text-muted / bg','#C4D0F0','#0F1E46',4.5),('text-muted / surface','#C4D0F0','#16295E',4.5),('text-muted / surface-2','#C4D0F0','#1D3573',4.5),
 ('text-soft / bg','#FFE6BD','#0F1E46',4.5),
 ('income / bg','#5FE0AE','#0F1E46',4.5),('income / surface','#5FE0AE','#16295E',4.5),
 ('expense / bg','#FF9C8C','#0F1E46',4.5),('expense / surface','#FF9C8C','#16295E',4.5),
 ('asset(gold) / bg','#F2B53A','#0F1E46',4.5),('asset / surface','#F2B53A','#16295E',4.5),
 ('liability / bg','#C3BDF0','#0F1E46',4.5),('liability / surface','#C3BDF0','#16295E',4.5),
 ('passive / bg','#35D6B0','#0F1E46',4.5),('cash-color / bg','#F6C453','#0F1E46',4.5),
 ('text / glass','#FFFFFF','#%02x%02x%02x'%glass_dark,4.5),('text-muted / glass','#C4D0F0','#%02x%02x%02x'%glass_dark,4.5),
 ('text / glass-strong','#FFFFFF','#%02x%02x%02x'%glassS_dark,4.5),
 ('btn-primary text / gold (mid)','#2A1700','#F2B53A',4.5),('btn-primary text / gold (top)','#2A1700','#FFD479',4.5),('btn-primary text / gold (bottom)','#2A1700','#E3A020',4.5),
 ('btn-buy text / mint','#032A1A','#4FD6A0',4.5),('btn-buy text / mint bottom','#032A1A','#2FB885',4.5),
 ('btn-danger text / coral','#2E0502','#FF8A78',4.5),('btn-danger text / coral bottom','#2E0502','#F0645A',4.5),
 ('btn-disabled text','#B4C0E4','#2A3A6B',4.5),
 ('card text / card-bg','#0F1E46','#FFF6E3',4.5),('card-muted / card-bg','#46527E','#FFF6E3',4.5),
 ('income-ink / card-income-bg','#0B6B43','#E1F8EC',4.5),('income-ink / card-bg','#0B6B43','#FFF6E3',4.5),('expense-ink / card-bg','#B3261E','#FFF6E3',4.5),
 ('gold-ink on fox-orange','#2A1700','#E8702A',4.5),('white on fox-orange-700','#FFFFFF','#B3501A',4.5),
 ('focus ring / bg (non-text)','#FFD479','#0F1E46',3),('border-strong / bg (non-text)','#8696C8','#0F1E46',3),
 ('tile payday / bg (non-text)','#F2B53A','#0F1E46',3),('tile opp / bg','#4FD6A0','#0F1E46',3),('tile expense / bg','#F0524A','#0F1E46',3),
 ('tile market / bg','#4DA3FF','#0F1E46',3),('tile baby / bg','#FF9CCB','#0F1E46',3),('tile charity / bg','#9B7BFF','#0F1E46',3),
 ('tile icon navy / payday','#0F1E46','#F2B53A',3),('tile icon navy / opp','#0F1E46','#4FD6A0',3),('tile icon navy / baby','#0F1E46','#FF9CCB',3),
 ('tile icon navy / market','#0F1E46','#4DA3FF',3),('tile icon navy / expense','#0F1E46','#F0524A',3),('tile icon navy / charity','#0F1E46','#9B7BFF',3),
 # hot-seat player tokens: number (navy ink) on each colour, and each colour against the board
 ('player 1 token ink / gold','#0F1E46','#F2B53A',4.5),('player 2 token ink / sky','#0F1E46','#4DA3FF',4.5),
 ('player 3 token ink / mint','#0F1E46','#4FD6A0',4.5),('player 4 token ink / pink','#0F1E46','#FF9CCB',4.5),
 ('player 1 ring / bg (non-text)','#F2B53A','#0F1E46',3),('player 2 ring / bg (non-text)','#4DA3FF','#0F1E46',3),
 ('player 3 ring / bg (non-text)','#4FD6A0','#0F1E46',3),('player 4 ring / bg (non-text)','#FF9CCB','#0F1E46',3),
 ('others-strip cash / glass-strong','#F6C453','#%02x%02x%02x'%glassS_dark,4.5),
]
light=[
 ('text / bg','#0F1E46','#FBF3E1',4.5),('text / surface','#0F1E46','#FFFFFF',4.5),('text / sunken','#0F1E46','#F1E5C8',4.5),
 ('text-muted / bg','#3F4C78','#FBF3E1',4.5),('text-muted / surface','#3F4C78','#FFFFFF',4.5),('text-muted / sunken','#3F4C78','#F1E5C8',4.5),
 ('income / bg','#0B6B43','#FBF3E1',4.5),('income / surface','#0B6B43','#FFFFFF',4.5),
 ('expense / bg','#B3261E','#FBF3E1',4.5),('expense / surface','#B3261E','#FFFFFF',4.5),
 ('asset / bg','#8A5200','#FBF3E1',4.5),('asset / surface','#8A5200','#FFFFFF',4.5),
 ('liability / bg','#55508A','#FBF3E1',4.5),('liability / surface','#55508A','#FFFFFF',4.5),
 ('passive text / bg','#0A7560','#FBF3E1',4.5),('passive text / surface','#0A7560','#FFFFFF',4.5),('cash-color / bg','#7A4A00','#FBF3E1',4.5),
 ('text / glass','#0F1E46','#%02x%02x%02x'%glass_light,4.5),
 ('btn-primary text / gold','#2A1700','#F2B53A',4.5),('btn-secondary text / white','#0F1E46','#FFFFFF',4.5),
 ('btn-disabled text','#4F4A3C','#E6DCC6',4.5),
 ('focus ring / bg (non-text)','#0F1E46','#FBF3E1',3),('border / bg (non-text)','#6F7899','#FBF3E1',3),
 ('passive fill / track (non-text)','#087F66','#E3E0DB',3),
 ('tile outline navy / bg (tiles keep a 3px navy outline in light)','#0F1E46','#FBF3E1',3),
 ('fox orange 700 text / bg','#B3501A','#FBF3E1',4.5),
 ('player token ring (navy outline in light) / bg (non-text)','#0F1E46','#FBF3E1',3),
 ('others-panel cash / cream panel','#7A4A00','#FFFBF2',4.5),
]
bad=0; md='--md' in sys.argv
for name,rows in (('DARK',dark),('LIGHT',light)):
    print(f'\n### {name}' if md else f'== {name} =='); 
    if md: print('| Pair | Ratio | Need | Pass |\n|---|---|---|---|')
    for lab,f,b,m in rows:
        r=cr(h(f),h(b)); ok=r>=m; bad+=not ok
        print((f'| {lab} (`{f}` on `{b}`) | {r:.2f}:1 | {m} | {"yes" if ok else "**NO**"} |') if md else f'{"ok " if ok else "FAIL"} {r:5.2f} (>={m})  {lab}  {f} on {b}')
sys.exit(1 if bad else 0)
