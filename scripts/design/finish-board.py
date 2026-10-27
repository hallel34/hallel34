from PIL import Image
from pathlib import Path
import json
im=Image.open('/tmp/board-raw.png')
a=im.getbbox(); box=(a[0]-8,a[1]-8,a[2]+8,a[3]+8)
im.crop(box).save('src/assets/board-premium.webp',quality=94)
g=json.load(open('/tmp/board-raw-geo.json'));x,y,r,b=box;w=r-x;h=b-y
out={'aspect':round(w/h,4),'tiles':[{'i':t['i'],'x':round((t['cx']-x)/w,4),'y':round((t['cy']-y)/h,4),'w':round(t['w']/w,4),'h':round(t['h']/h,4)}for t in g['tiles']]}
Path('src/ui/board-geo.js').write_text('// Generated camera projection at subpixel precision.\nexport const BOARD_GEO = '+json.dumps(out)+';\n')
