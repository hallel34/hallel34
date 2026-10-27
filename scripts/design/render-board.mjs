import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const server=spawn('python3',['-m','http.server','4188','--bind','127.0.0.1'],{stdio:'ignore'});
try {
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4188/')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1400,height:1400}});
 await page.goto('http://127.0.0.1:4188/scripts/design/board-scene.html');
 await page.waitForFunction(()=>window.__ready===true);
 await page.evaluate(()=>window.renderBoard());
 const geo=await page.evaluate(()=>window.__geo());
 await page.locator('canvas').screenshot({path:'/tmp/board-raw.png',omitBackground:true});
 writeFileSync('/tmp/board-raw-geo.json',JSON.stringify(geo));
 await browser.close();
 execFileSync('python3',['scripts/design/finish-board.py'],{stdio:'inherit'});
}finally{server.kill();}
