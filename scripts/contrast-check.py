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
 # payday float: dark pill rgba(10,21,51,.86) over the worst-case tile (cream in light, gold in dark)
 ('float income / pill over gold tile','#5FE0AE','#%02x%02x%02x'%over(h('0A1533'),.86,h('F2B53A')),4.5),
 ('float expense / pill over gold tile','#FFB3A7','#%02x%02x%02x'%over(h('0A1533'),.86,h('F2B53A')),4.5),
 ('card text / breakdown tile (white)','#0F1E46','#FFFFFF',4.5),
 # v2 phase B (learning layer): fox note, traffic light, investor-eye chip, dictionary, report
 ('note kicker (card-muted) / cream bubble','#46527E','#FFF6E3',4.5),('note text / cream bubble','#0F1E46','#FFF6E3',4.5),
 ('light green text / green tint','#0B6B43','#E1F8EC',4.5),('light yellow text / yellow tint','#6B4300','#FFF1D0',4.5),('light red text / red tint','#7A1810','#FFE9E5',4.5),
 ('lamp green icon / lit green','#032A1A','#4FD6A0',3),('lamp yellow icon / lit gold','#2A1700','#F2B53A',3),('lamp red icon / lit coral','#3A0600','#FF8E80',3),
 ('lit lamp ring / navy pill (non-text)','#FFFFFF','#0F1E46',3),('lit green lamp / navy pill (non-text)','#4FD6A0','#0F1E46',3),
 ('lit yellow lamp / navy pill (non-text)','#F2B53A','#0F1E46',3),('lit red lamp / navy pill (non-text)','#FF8E80','#0F1E46',3),
 ('eye chip gold / navy','#FFD479','#0F1E46',4.5),('dictionary "new" badge ink / gold','#2A1700','#F2B53A',4.5),
 ('report guess line (gold-300) / glass','#FFD479','#%02x%02x%02x'%glass_dark,4.5),
 ('real-world disclaimer (card-muted) / white tile','#46527E','#FFFFFF',4.5),('guess hint (card-muted) / white tile','#46527E','#FFFFFF',4.5),
 ('guess skip / white tile','#0F1E46','#FFFFFF',4.5),('guess-bad button text / coral','#2E0502','#FF8A78',4.5),
 ('term underline target: text / card cream','#0F1E46','#FFF6E3',4.5),
 # round 11: a negative result is never red (family chip / popover result / summary result): neutral amber
 ('amber ink / bg','#FFD27A','#0F1E46',4.5),('amber ink / amber fill over bg','#FFD27A','#%02x%02x%02x'%over(h('F6C453'),.16,NAVY),4.5),
 ('amber ink / amber fill over surface-2 (popover)','#FFD27A','#%02x%02x%02x'%over(h('F6C453'),.16,h('1D3573')),4.5),
 ('summary result (amber) / navy band','#FFD27A','#0F1E46',4.5),('summary amber ink / amber fill (cream card)','#6E4200','#FFEBC2',4.5),
 ('toast action ink / gold','#2A1700','#E3A020',4.5),
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
 ('amber ink / bg (light)','#6E4200','#FBF3E1',4.5),('amber ink / amber fill over bg (light)','#6E4200','#%02x%02x%02x'%over(h('F2B53A'),.30,h('FBF3E1')),4.5),
 ('amber ink / amber fill over surface-2 (light popover)','#6E4200','#%02x%02x%02x'%over(h('F2B53A'),.30,h('FFF9EC')),4.5),
 ('others-panel cash / cream panel','#7A4A00','#FFFBF2',4.5),
 ('float income / pill over cream tile','#5FE0AE','#%02x%02x%02x'%over(h('0A1533'),.86,h('FBF3E1')),4.5),
 ('float expense / pill over cream tile','#FFB3A7','#%02x%02x%02x'%over(h('0A1533'),.86,h('FBF3E1')),4.5),
 ('card text / breakdown tile (white)','#0F1E46','#FFFFFF',4.5),
 ('report guess line (fox-ink) / glass','#B3501A','#%02x%02x%02x'%glass_light,4.5),
 ('dictionary section text / glass','#0F1E46','#%02x%02x%02x'%glass_light,4.5),('dictionary muted / glass','#3F4C78','#%02x%02x%02x'%glass_light,4.5),
 ('settings help (text-muted) / surface','#3F4C78','#FFFFFF',4.5),
 ('note kicker (card-muted) / cream bubble','#46527E','#FFF6E3',4.5),
 ('eye chip gold / navy','#FFD479','#0F1E46',4.5),
 ('tutorial: summary passive amount / income tint','#0A7560','#E1F8EC',4.5),('tutorial: summary salary / cream','#0F1E46','#FFF6E3',4.5),
 ('tutorial: summary expense amount / cream','#B3261E','#FFF6E3',4.5),('tutorial: summary left (income-ink) / cream','#0B6B43','#FFF6E3',4.5),
 ('tutorial: summary muted caption / cream','#46527E','#FFF6E3',4.5),('tutorial: summary result gold / navy band','#F6C453','#0F1E46',4.5),
 ('tutorial: summary negative result amber / navy band','#FFD27A','#0F1E46',4.5),('tutorial: popover left pill (positive)','#032A1A','#4FD6A0',4.5),
 ('tutorial: popover left pill (negative, amber ink on amber fill over cream card)','#6E4200','#FFEBC2',4.5),('tutorial: hint strip text / navy','#FFFFFF','#0F1E46',4.5),
 ('tutorial: hint strip number gold / navy','#FFD479','#0F1E46',4.5),('tutorial: story title gold / night','#F2B53A','#091330',4.5),
 ('tutorial: story card muted / cream','#46527E','#FFF6E3',4.5),
 # round 12: story numerals follow their background (light on the night story, ink in the cream card); family mode has no red (amber)
 ('tutorial: story numeral white / night (bottom of the gradient)','#FFFFFF','#1B3068',4.5),('tutorial: story numeral ink / cream card','#0F1E46','#FFF6E3',4.5),
 ('family: expense amber / bg','#FFD27A','#0F1E46',4.5),('family: expense amber / surface','#FFD27A','#16295E',4.5),('family: expense amber ink / cream card','#6E4200','#FFF6E3',4.5),('tutorial: highlight ring gold-700 on cream (non-text)','#A56A0A','#FFF6E3',3),('tutorial: highlight ring gold-300 on navy (non-text)','#FFD479','#0F1E46',3),
]
# v3.1 + v4 (developer): the new navy family, flat buttons, the disabled Buy on cream, verdict pills, hint strip, net worth
dark += [
 ('v3.1 text / bg','#F5F7FC','#0F172A',4.5),('v3.1 muted / surface-2','#A9B5D0','#212D48',4.5),('v3.1 negative / surface-2','#E57373','#212D48',4.5),
 ('v3.1 income / surface-2','#5FE0AE','#212D48',4.5),('v4 primary text / gold','#2A1700','#F2B53A',4.5),('v4 ghost outline / bg (non-text)','#7C89AB','#0F172A',3),
 ('v4 disabled Buy label (לא זמין) / muted fill on cream','#46527E','#E4D9C0',4.5),('v4 disabled Buy outline vs cream card (non-text)','#6B7596','#FFF6E3',3),
 ('v3.1 verdict green pill','#0B6B43','#E1F8EC',4.5),('v3.1 verdict yellow pill','#6B4300','#FFF1D0',4.5),('v3.1 verdict red pill','#7A1810','#FFE9E5',4.5),
 ('v3.1 family slow pill','#6E4200','#FFEBC2',4.5),('v3.1 hint strip text / surface-2','#F5F7FC','#212D48',4.5),('v3.1 negative ink / cream','#B42318','#FFF6E3',4.5),
 ('v3.1 debt (liability ink) / cream','#55508A','#FFF6E3',4.5),('v3.1 card ghost outline / cream (non-text)','#6B7596','#FFF6E3',3),
]
light += [
 ('v3.1 light hint strip text / surface-2','#0F172A','#FFF9EC',4.5),('v3.1 light text / bg','#0F172A','#FBF3E1',4.5),
]
bad=0; md='--md' in sys.argv
for name,rows in (('DARK',dark),('LIGHT',light)):
    print(f'\n### {name}' if md else f'== {name} =='); 
    if md: print('| Pair | Ratio | Need | Pass |\n|---|---|---|---|')
    for lab,f,b,m in rows:
        r=cr(h(f),h(b)); ok=r>=m; bad+=not ok
        print((f'| {lab} (`{f}` on `{b}`) | {r:.2f}:1 | {m} | {"yes" if ok else "**NO**"} |') if md else f'{"ok " if ok else "FAIL"} {r:5.2f} (>={m})  {lab}  {f} on {b}')
sys.exit(1 if bad else 0)
