import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
S=sys.argv[1]
im=Image.open('design/brand/maxifox-logo-source.jpg').convert('RGB')
a=np.asarray(im).astype(float)
H,W=a.shape[:2]
bg=np.array([10,28,58.])
d=np.sqrt(((a-bg)**2).sum(-1))
def ss(x,e0,e1):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
ak=ss(d,24,64)
yy,xx=np.mgrid[0:H,0:W]
cx,cy,r=624.5,590,522
disc=np.sqrt((xx-cx)**2+(yy-cy)**2)
prot=1-ss(disc,r-3,r+3)
# jacket envelope below the ring: shoulders' gold piping extremes, then straight down
g=d>120
env=np.zeros((H,W))
for y in range(895,1000):
    yr=min(y,932)
    xs=np.where(g[yr])[0]
    x0,x1=(xs.min(),xs.max())
    env[y,x0+4:x1-4]=1
env=ndi.gaussian_filter(env,2.0)
prot=np.maximum(prot,env)
prot*=1-ss(yy,940,992)
A=np.maximum(ak,prot)
cut=1-ss(yy,972,992)
def decont(A):
    al=np.clip(A,1e-3,1)[...,None]
    return np.clip((a-(1-al)*bg)/al,0,255)
for name,AA in (('full',A),('mark',A*cut)):
    rgba=np.dstack([decont(AA),AA*255]).astype(np.uint8)
    img=Image.fromarray(rgba,'RGBA'); img.save(f'{S}/{name}_rgba.png')
    for bgname,col in (('dark',(15,23,42)),('light',(251,243,225))):
        b=Image.new('RGBA',(W,H),col+(255,)); b.alpha_composite(img)
        b.convert('RGB').save(f'{S}/{name}_on_{bgname}_big.png')
        b.convert('RGB').resize((627,627),Image.LANCZOS).save(f'{S}/{name}_on_{bgname}.png')
