#!/usr/bin/env python3
"""WCAG contrast audit of the redesign phase A pairs (owner palette 2026-11-16 + the new home / pick / annual-summary surfaces).
Run: python3 docs/redesign/contrast-redesign.py   Exits 1 on any failure. Values mirror src/styles/tokens.css (redesign layer) and tutorial.css."""
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
BG,BG2,CARD,ELEV='#0B1224','#111B32','#1B2945','#243450'
GOLD,GOLD2,INK='#F5B936','#D9A441','#2A1700'
TEXT,TEXT2,SUC,DAN,DANS='#F7F8FC','#A9B5CC','#48C99A','#E87979','#EE8686'
PAPER,PAPER2,PINK,PMUTED='#EFE6D5','#E7DCC6','#0F172A','#3F4B73'
pocket=over(h(SUC),.10,h(CARD)); dpocket=over(h(DAN),.12,h(CARD))
glass=over((255,255,255),.05,h(BG)); gchip=over((255,255,255),.07,h(CARD))
rows=[ # label, fg, bg, min
 ('text / bg',TEXT,BG,4.5),('text / bg-2',TEXT,BG2,4.5),('text / card',TEXT,CARD,4.5),('text / elev',TEXT,ELEV,4.5),
 ('text-2 / bg',TEXT2,BG,4.5),('text-2 / bg-2 (missions panel)',TEXT2,BG2,4.5),('text-2 / card',TEXT2,CARD,4.5),('text-2 / elev',TEXT2,ELEV,4.5),
 ('text-2 / glass chip (mode icon tile)','#A9B5CC','#%02x%02x%02x'%gchip,3),
 ('gold / bg',GOLD,BG,4.5),('gold / card',GOLD,CARD,4.5),('gold / elev',GOLD,ELEV,4.5),('gold-2 / bg',GOLD2,BG,4.5),
 ('ink / gold (Start CTA, check, badge)',INK,GOLD,4.5),('ink / gold-2',INK,GOLD2,4.5),
 ('success / card',SUC,CARD,4.5),('success / elev',SUC,ELEV,4.5),('success / pocket strip',SUC,'#%02x%02x%02x'%pocket,4.5),
 ('danger / bg',DAN,BG,4.5),('danger / card',DAN,CARD,4.5),('danger / elev (fails: use danger-strong)',DAN,ELEV,4.5),
 ('danger-strong / elev',DANS,ELEV,4.5),('danger-strong / card',DANS,CARD,4.5),('danger-text / negative pocket strip',DANS,'#%02x%02x%02x'%dpocket,4.5),
 ('selected border gold / card (non-text)',GOLD,CARD,3),('selected border gold / elev (non-text)',GOLD,ELEV,3),
 ('check badge ring: gold / bg (non-text)',GOLD,BG,3),
 ('control boundary .36 / card (non-text)','#%02x%02x%02x'%over((255,255,255),.36,h(CARD)),CARD,3),
 ('paper ink / paper',PINK,PAPER,4.5),('paper muted / paper',PMUTED,PAPER,4.5),('paper ink / paper-2 (equation)',PINK,PAPER2,4.5),('paper muted / paper-2',PMUTED,PAPER2,4.5),
 ('income-ink / paper',"#0B6B43",PAPER,4.5),('income-ink / paper-2 (result)',"#0B6B43",PAPER2,4.5),('negative-ink / paper',"#B42318",PAPER,4.5),('negative-ink / paper-2',"#B42318",PAPER2,4.5),
 ('passive teal-ink / income row','#0A7560','#E6EFDC',4.5),('income-ink / income row','#0B6B43','#E6EFDC',4.5),('ink / income row',PINK,'#E6EFDC',4.5),
 ('amber-ink / amber row (loss asset)','#6E4200','#FFEBC2',4.5),
 ('dark frame vs paper (non-text)',PAPER,'#1B2945',3),
 ('focus ring / bg (non-text)','#FFD479',BG,3),
 ('light: wordmark / sel-gold #8A5200 on light bg','#8A5200','#FBF3E1',4.5),('light: white on #8A5200 (badge, check)','#FFFFFF','#8A5200',4.5),
 ('light: income-ink on pocket strip','#0B6B43','#%02x%02x%02x'%over(h('#0B6B43'),.09,h('#FFFFFF')),4.5),
 ('light: text-muted / bg','#3F4C78','#FBF3E1',4.5),
]
bad=0
for lab,fg,bg,mn in rows:
    f=h(fg) if isinstance(fg,str) else fg; b=h(bg) if isinstance(bg,str) else bg
    r=cr(f,b); ok=r>=mn
    expected_fail='fails' in lab
    flag='ok  ' if ok else ('known' if expected_fail else 'FAIL')
    if not ok and not expected_fail: bad+=1
    print(f'{flag} {r:5.2f} (>={mn})  {lab}  {fg} on {bg}')
sys.exit(1 if bad else 0)
