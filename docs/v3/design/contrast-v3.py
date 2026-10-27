#!/usr/bin/env python3
"""WCAG AA pairs for the v3.1 'quiet navy' tokens. Same conventions as scripts/contrast-check.py (h/L/cr/over, rows = (label, fg, bg, min)).
Run: python3 docs/v3/design/contrast-v3.py [--md]   Exit 1 on any failure.
HOW TO MERGE: copy the `dark_v31` / `light_v31` rows into scripts/contrast-check.py (replace the rows that name the old hexes
#0F1E46 #16295E #1D3573 #0A1533 #C4D0F0 #FF9C8C #FFFFFF-text and the old gradient button stops), keep the rest."""
import sys
def h(c): c=c.lstrip('#'); return tuple(int(c[i:i+2],16) for i in (0,2,4))
def over(fg,a,bg): return tuple(round(fg[i]*a+bg[i]*(1-a)) for i in range(3))
def L(c):
    f=lambda v:(v/255/12.92) if v/255<=.03928 else ((v/255+.055)/1.055)**2.4
    r,g,b=map(f,c); return .2126*r+.7152*g+.0722*b
def cr(a,b):
    la,lb=L(a),L(b)
    if la<lb: la,lb=lb,la
    return (la+.05)/(lb+.05)
x=lambda t:'#%02x%02x%02x'%t
BG,SF,S2,SK='#0F172A','#182238','#212D48','#0A1020'
CREAM,WHITE='#FFF6E3','#FFFFFF'
amber_pill_dark=x(over(h('F6C453'),.16,h(BG)))
dark_v31=[
 ('text / bg','#F5F7FC',BG,4.5),('text / surface','#F5F7FC',SF,4.5),('text / surface-2','#F5F7FC',S2,4.5),
 ('text-muted / bg','#A9B5D0',BG,4.5),('text-muted / surface','#A9B5D0',SF,4.5),('text-muted / surface-2','#A9B5D0',S2,4.5),('text-muted / sunken','#A9B5D0',SK,4.5),
 ('text-soft / bg','#FFE6BD',BG,4.5),
 ('income / bg','#5FE0AE',BG,4.5),('income / surface','#5FE0AE',SF,4.5),('income / surface-2','#5FE0AE',S2,4.5),
 ('negative (expense) / bg','#E57373',BG,4.5),('negative / surface','#E57373',SF,4.5),('negative / surface-2','#E57373',S2,4.5),
 ('asset gold / bg','#F2B53A',BG,4.5),('asset gold / surface-2','#F2B53A',S2,4.5),
 ('liability / bg','#C3BDF0',BG,4.5),('liability / surface-2','#C3BDF0',S2,4.5),
 ('passive / bg','#35D6B0',BG,4.5),('passive / surface-2','#35D6B0',S2,4.5),
 ('amber-ink / bg','#FFD27A',BG,4.5),('amber-ink / amber pill over bg','#FFD27A',amber_pill_dark,4.5),('amber-ink / surface-2','#FFD27A',S2,4.5),
 ('btn-primary text / gold','#2A1700','#F2B53A',4.5),('btn-primary text / pressed gold','#2A1700','#E3A020',4.5),
 ('btn-danger text / red','#2E0502','#E57373',4.5),
 ('btn-secondary text / bg','#F5F7FC',BG,4.5),('btn-secondary text / surface-2','#F5F7FC',S2,4.5),
 ('btn-text (tertiary) / bg','#F5F7FC',BG,4.5),
 ('btn-secondary border / bg (non-text)','#7C89AB',BG,3),('btn-secondary border / surface (non-text)','#7C89AB',SF,3),('btn-secondary border / surface-2 (non-text)','#7C89AB',S2,3),
 ('border-strong / bg (non-text)','#8A97B8',BG,3),('border-strong / surface-2 (non-text)','#8A97B8',S2,3),
 ('arming bar gold-300 / bg (non-text)','#FFD479',BG,3),
 ('selected ring (text white) / bg (non-text)','#F5F7FC',BG,3),
 ('focus ring gold-300 / bg (non-text)','#FFD479',BG,3),('focus ring gold-300 / surface-2 (non-text)','#FFD479',S2,3),
 # cards (cream, always)
 ('card text / cream','#0F172A',CREAM,4.5),('card-muted / cream','#46527E',CREAM,4.5),('card-muted / white tile','#46527E',WHITE,4.5),
 ('negative-ink / cream','#B42318',CREAM,4.5),('negative-ink / white tile','#B42318',WHITE,4.5),
 ('income-ink / cream','#0B6B43',CREAM,4.5),('income-ink / income tint','#0B6B43','#E1F8EC',4.5),
 ('focus ring card (navy) / cream (non-text)','#0F172A',CREAM,3),('focus ring card (navy) / gold button (non-text)','#0F172A','#F2B53A',3),
 ('verdict green pill: ink / tint','#0B6B43','#E1F8EC',4.5),('verdict yellow pill: ink / tint','#6B4300','#FFF1D0',4.5),('verdict red pill: ink / tint','#7A1810','#FFE9E5',4.5),
 ('family slow pill: amber ink / amber tint','#6E4200','#FFEBC2',4.5),
 ('ribbon green / scrim-side navy (non-text)','#1FAE76',BG,3),('ribbon yellow / navy (non-text)','#E8A317',BG,3),('ribbon red / navy (non-text)','#D94A42',BG,3),('ribbon family-slow / navy (non-text)','#D98A1C',BG,3),
 ('card ghost button border / cream (non-text)','#6B7596',CREAM,3),('card ghost button border / white tile (non-text)','#6B7596',WHITE,3),
 ('card warn text / card warn bg','#7A1810','#FFE9E5',4.5),('family card warn text / bg','#6E4200','#FFEBC2',4.5),
 ('warn banner text / warn bg over surface-2','#F5F7FC',x(over(h('E57373'),.14,h(S2))),4.5),('warn banner icon (negative) / warn bg over surface-2 (non-text)','#E57373',x(over(h('E57373'),.14,h(S2))),3),
 ('family warn banner text / amber warn bg over surface-2','#F5F7FC',x(over(h('F2B53A'),.14,h(S2))),4.5),
 ('card scroll chevron (card-muted) / cream (non-text)','#46527E',CREAM,3),
 # categories
]+[ (f'cat {k} on surface-2 (icon, non-text)',d,S2,3) for k,(d,l) in {
 'apartment':('#A9B8DA','#4A5C94'),'coffee':('#C79A6B','#7A5230'),'food-stand':('#B9D95C','#55700F'),'snack-cart':('#FF8FB8','#B0265E'),'retail':('#4FD1D9','#0B6B78'),
 'franchise':('#A78BFA','#5B3FC4'),'service':('#E879F9','#9A1FB0'),'leisure':('#FFA45C','#A84E0B'),'stock':('#4DA3FF','#1A62B3')}.items()
]+[ (f'cat-ink {k} on cream (icon, non-text)',l,CREAM,3) for k,(d,l) in {
 'apartment':('#A9B8DA','#4A5C94'),'coffee':('#C79A6B','#7A5230'),'food-stand':('#B9D95C','#55700F'),'snack-cart':('#FF8FB8','#B0265E'),'retail':('#4FD1D9','#0B6B78'),
 'franchise':('#A78BFA','#5B3FC4'),'service':('#E879F9','#9A1FB0'),'leisure':('#FFA45C','#A84E0B'),'stock':('#4DA3FF','#1A62B3')}.items()
]+[
 ('cat label text (cat-ink) on cream, apartment (weakest ink)','#4A5C94',CREAM,4.5),('cat label text franchise ink on cream','#5B3FC4',CREAM,4.5),
 ('profession glyph (text) / prof chip (surface-2)','#F5F7FC',S2,3),
 ('tile icon ink / payday','#0F172A','#F2B53A',3),('tile icon ink / opp','#0F172A','#4FD6A0',3),('tile icon ink / expense','#0F172A','#F0524A',3),
 ('tile icon ink / market','#0F172A','#4DA3FF',3),('tile icon ink / baby','#0F172A','#FF9CCB',3),('tile icon ink / charity','#0F172A','#9B7BFF',3),
 ('tile payday / bg (non-text)','#F2B53A',BG,3),('tile expense / bg (non-text)','#F0524A',BG,3),('tile charity / bg (non-text)','#9B7BFF',BG,3),
 ('toast chip: text / surface-2 (payday chip)','#F5F7FC',S2,4.5),('payday chip equation total (income) / surface-2','#5FE0AE',S2,4.5),
 ('net-worth panel: negative / surface','#E57373',SF,4.5),
 ('fox note bubble: card text / cream','#0F172A',CREAM,4.5),
 ('disabled button text (exempt, info only)','#8E9AB8','#263250',3),
]
LB,LS='#FBF3E1','#FFFFFF'
light_v31=[
 ('text / bg','#0F172A',LB,4.5),('text / surface','#0F172A',LS,4.5),('text-muted / bg','#3F4C78',LB,4.5),
 ('negative / bg','#B3261E',LB,4.5),('negative / surface','#B3261E',LS,4.5),('income / bg','#0B6B43',LB,4.5),
 ('btn-secondary border / bg (non-text)','#6F7899',LB,3),('btn-danger text / red','#FFFFFF','#B42318',4.5),('btn-primary text / gold','#2A1700','#F2B53A',4.5),
 ('focus ring / bg (non-text)','#0F172A',LB,3),('arming bar / bg (non-text)','#0F172A',LB,3),
 ('cat-ink coffee on paper bg (non-text)','#7A5230',LB,3),('cat-ink food-stand on paper (non-text)','#55700F',LB,3),('cat-ink leisure on paper (non-text)','#A84E0B',LB,3),
 ('family amber (light) / bg','#6E4200',LB,4.5),
]
bad=0; md='--md' in sys.argv
for name,rows in (('DARK v3.1',dark_v31),('LIGHT v3.1',light_v31)):
    print(f'\n### {name}' if md else f'== {name} ==')
    if md: print('| Pair | Ratio | Need | Pass |\n|---|---|---|---|')
    for lab,f,b,m in rows:
        r=cr(h(f),h(b)); ok=r>=m; bad+=not ok
        print((f'| {lab} (`{f}` on `{b}`) | {r:.2f}:1 | {m} | {"yes" if ok else "**NO**"} |') if md else f'{"ok " if ok else "FAIL"} {r:5.2f} (>={m})  {lab}  {f} on {b}')
sys.exit(1 if bad else 0)
