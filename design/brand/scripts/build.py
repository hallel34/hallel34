import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=sys.argv[1]
NAVY=(10,28,58)          # logo navy, measured from the source
APP=(15,23,42)           # #0F172A app background
src=Image.open('design/brand/maxifox-logo-source.jpg').convert('RGB')
mark=Image.open(f'{S}/mark_rgba.png'); full=Image.open(f'{S}/full_rgba.png')
ma=np.asarray(mark)[...,3]
ys,xs=np.where(ma>128); bx0,bx1,by0,by1=xs.min(),xs.max(),ys.min(),ys.max()
print('mark bbox',bx0,by0,bx1,by1)
# minimal enclosing circle (grid search) of the opaque mark
pts=np.stack([xs[::7],ys[::7]],1).astype(float)
best=None
for cx in range(560,700,4):
    for cy in range(440,620,4):
        R=np.sqrt(((pts-[cx,cy])**2).sum(1)).max()
        if best is None or R<best[0]: best=(R,cx,cy)
R,ecx,ecy=best; print('enclosing circle',best)

def place(size,scale,cx,cy,bg):
    """scale mark so source point (cx,cy) lands in the canvas centre"""
    m=mark.resize((round(1254*scale),)*2,Image.LANCZOS)
    c=Image.new('RGBA',(size,size),bg+((255,) if bg else ()) if bg else (0,0,0,0))
    ox=round(size/2-cx*scale); oy=round(size/2-cy*scale)
    c.alpha_composite(m,(ox,oy)) if ox>=0 and oy>=0 else c.paste(m,(ox,oy),m)
    return c
def any_icon(size,fill=0.94,bg=NAVY):
    w=bx1-bx0; h=by1-by0; sc=fill*size/max(w,h)
    return place(size,sc,(bx0+bx1)/2,(by0+by1)/2,bg)
os.makedirs('public/icons',exist_ok=True)
any_icon(512).convert('RGB').save('public/icons/icon-512.png',optimize=True)
any_icon(192).convert('RGB').save('public/icons/icon-192.png',optimize=True)
any_icon(180,0.90).convert('RGB').save('public/icons/apple-touch-icon.png',optimize=True)
# maskable: key art inside the 80% safe circle (r = 204.8px); navy everywhere else
place(512,198/R,ecx,ecy,NAVY).convert('RGB').save('public/icons/icon-maskable-512.png',optimize=True)
# favicon: tighter crop on the face so the glasses read at 32px (ring partly clipped)
fx0,fy0,fx1,fy1=150,40,1100,990        # 950px square: ears to chin + jacket collar
fav=Image.new('RGBA',(1254,1254),NAVY+(255,)); fav.alpha_composite(mark)
fav=fav.crop((fx0,fy0,fx1,fy1)).resize((128,128),Image.LANCZOS).resize((32,32),Image.LANCZOS)
fav=fav.filter(ImageFilter.UnsharpMask(radius=0.6,percent=60,threshold=0))
fav.convert('RGB').save('public/icons/favicon-32.png',optimize=True)
# Android adaptive foreground: 108dp @4x = 432; safe zone 66dp circle -> r 132px
place(432,128/R,ecx,ecy,None).save('design/brand/android-foreground-432.png',optimize=True)

# ---- home logo (full, with wordmark) ----
fa=np.asarray(full)[...,3]; ys2,xs2=np.where(fa>8)
lb=(max(xs2.min()-12,0),max(ys2.min()-12,0),min(xs2.max()+12,1254),min(ys2.max()+12,1254))
print('logo bbox',lb)
sizes={}
for tag,w in (('1x',240),('2x',480)):
    h=round(w*(lb[3]-lb[1])/(lb[2]-lb[0]))
    op=src.crop(lb).resize((w,h),Image.LANCZOS)
    p=f'design/brand/maxifox-logo-{tag}.webp'; op.save(p,'WEBP',quality=75,method=6); sizes[p]=os.path.getsize(p)
    al=full.crop(lb).resize((w,h),Image.LANCZOS)
    aa=np.asarray(al).copy(); A=aa[...,3]; A[A<10]=0; A[A>245]=255; aa[A==0,:3]=0
    al=Image.fromarray(aa,'RGBA')
    p=f'design/brand/maxifox-logo-alpha-{tag}.webp'; al.save(p,'WEBP',quality=70,alpha_quality=70,method=6); sizes[p]=os.path.getsize(p)
for k,v in sizes.items(): print(k,v)
print('total',sum(sizes.values()))

# ---- feature graphic 1024x500 ----
W,H=1024,500
fg=Image.new('RGBA',(W,H),APP+(255,))
# soft gold glow behind the logo (no new artwork)
glow=Image.new('L',(W,H),0); gd=ImageDraw.Draw(glow)
gcx,gcy=770,250; gd.ellipse((gcx-250,gcy-250,gcx+250,gcy+250),fill=150)
glow=glow.filter(ImageFilter.GaussianBlur(90))
fg=Image.composite(Image.new('RGBA',(W,H),(30,58,112,255)),fg,glow)
lh=460; lw=round(lh*(lb[2]-lb[0])/(lb[3]-lb[1]))
logo=full.crop(lb).resize((lw,lh),Image.LANCZOS)
fg.alpha_composite(logo,(gcx-lw//2,(H-lh)//2))
F='node_modules/@fontsource/rubik/files/'
f900=ImageFont.truetype(F+'rubik-hebrew-900-normal.woff',96,layout_engine=ImageFont.Layout.RAQM)
f500=ImageFont.truetype(F+'rubik-hebrew-500-normal.woff',34,layout_engine=ImageFont.Layout.RAQM)
d=ImageDraw.Draw(fg)
right=500   # text block right edge (RTL: aligned to the side nearest the logo)
def rtl(y,txt,font,fill):
    bb=d.textbbox((0,0),txt,font=font,direction='rtl',language='he')
    d.text((right-bb[2],y),txt,font=font,fill=fill,direction='rtl',language='he')
    return bb
rtl(112,'הכסף עובד',f900,(251,243,225))
rtl(222,'בשבילך',f900,(242,181,58))
d.rounded_rectangle((right-120,352,right,358),radius=3,fill=(242,181,58))
rtl(378,'משחק לוח על כסף וחופש כלכלי',f500,(203,213,225))
fg.convert('RGB').save('design/brand/feature-1024x500.png',optimize=True)
