from PIL import Image, ImageDraw, ImageFont
F='node_modules/@fontsource/rubik/files/rubik-latin-500-normal.woff'
f=ImageFont.truetype(F,15)
sheet=Image.new('RGB',(1500,1130),(40,44,52)); d=ImageDraw.Draw(sheet)
def lab(x,y,t): d.text((x,y),t,font=f,fill=(230,230,230))
def mask(im,kind):
    s=im.size[0]; m=Image.new('L',im.size,0); md=ImageDraw.Draw(m)
    if kind=='circle': md.ellipse((0,0,s-1,s-1),fill=255)
    elif kind=='squircle': md.rounded_rectangle((0,0,s-1,s-1),radius=int(s*0.2237),fill=255)
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.paste(im.convert('RGBA'),(0,0),m); return out
I=lambda p: Image.open(p).convert('RGBA')
x=20; y=20
i512=I('public/icons/icon-512.png'); sheet.paste(i512.resize((256,256)),(x,y)); lab(x,y+262,'icon-512 (any) @50%')
sheet.paste(I('public/icons/icon-192.png'),(300,y)); lab(300,y+198,'icon-192 1:1')
a=I('public/icons/apple-touch-icon.png'); sheet.paste(mask(a,'squircle'),(520,y),mask(a,'squircle')); lab(520,y+186,'apple-touch 180, iOS mask')
mk=I('public/icons/icon-maskable-512.png').resize((256,256))
sheet.paste(mk,(730,y)); d.ellipse((730+25.6,y+25.6,730+230.4,y+230.4),outline=(255,0,255),width=2); lab(730,y+262,'maskable, 80% safe zone')
c=mask(mk,'circle'); sheet.paste(c,(1000,y),c); lab(1000,y+262,'maskable, circle mask')
sq=mask(mk.resize((256,256)),'squircle'); sheet.paste(sq,(1260,y),sq); lab(1260,y+262,'maskable, squircle')
# adaptive foreground over navy bg layer, 72dp visible window circle
y2=330
fgimg=I('design/brand/android-foreground-432.png')
layer=Image.new('RGBA',(432,432),(10,28,58,255)); layer.alpha_composite(fgimg)
vis=layer.crop((24,24,408,408)).resize((256,256))   # 72dp of 108dp
cv=mask(vis,'circle'); sheet.paste(cv,(20,y2),cv); lab(20,y2+262,'adaptive fg+navy, circle')
chk=Image.new('RGBA',(256,256),(200,200,200,255)); cd=ImageDraw.Draw(chk)
for i in range(0,256,16):
    for j in range(0,256,16):
        if (i+j)//16%2: cd.rectangle((i,j,i+15,j+15),fill=(255,255,255,255))
chk.alpha_composite(fgimg.resize((256,256))); sheet.paste(chk,(300,y2))
d.ellipse((300+256*(54-33)/108,y2+256*(54-33)/108,300+256*(54+33)/108,y2+256*(54+33)/108),outline=(255,0,255),width=2)
lab(300,y2+262,'adaptive fg alpha, 66dp safe')
# favicon tests
fav=I('public/icons/favicon-32.png')
for k,(bg,name) in enumerate((((222,225,230),'light tab'),((53,54,58),'dark tab'))):
    bx=600+k*200; d.rectangle((bx,y2,bx+180,y2+44),fill=bg); sheet.paste(fav.resize((16,16),Image.LANCZOS),(bx+10,y2+14)); sheet.paste(fav,(bx+40,y2+6))
    lab(bx,y2+50,name+' 16 / 32')
sheet.paste(fav.resize((256,256),Image.NEAREST),(1000,y2)); lab(1000,y2+262,'favicon-32 x8 nearest')
# launcher grid mock at real size (48dp ~ 48px css)
y3=650; d.rectangle((20,y3,700,y3+130),fill=(235,238,242))
for k,s in enumerate((48,64,96)):
    im=mask(mk.resize((s,s),Image.LANCZOS),'circle'); sheet.paste(im,(40+k*140,y3+15),im)
lab(20,y3+136,'launcher sizes 48/64/96 (maskable, circle)')
# home logo on both themes
y4=820
for k,(bg,name) in enumerate((((15,23,42),'#0F172A dark'),((251,243,225),'#FBF3E1 light'))):
    bx=750+k*370; d.rectangle((bx,y3,bx+340,y3+440),fill=bg)
    lg=I('design/brand/maxifox-logo-alpha-2x.webp').resize((240,261),Image.LANCZOS); sheet.paste(lg,(bx+50,y3+20),lg)
    op=I('design/brand/maxifox-logo-1x.webp').resize((120,131)); sheet.paste(op,(bx+110,y3+290))
    lab(bx,y3+445,name+': alpha / opaque')
sheet.save('design/brand/icons-contact-sheet.png',optimize=True)
