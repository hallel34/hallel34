import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {createEngine,newMatch,serialize} from '../src/engine/index.js';
const data=Object.fromEntries(['professions','cards'].map(k=>[k,JSON.parse(readFileSync(new URL(`../src/data/${k}.he.json`,import.meta.url)))]));
const server=spawn('npx',['vite','--host','127.0.0.1','--port','4192'],{stdio:'ignore'});
let browser;
try {
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4192')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:755}});
let failures=0;
await page.route('**/board-premium.webp*',route=>{if(route.request().resourceType()!=='image')return route.continue();failures++;return route.abort();});
const m=newMatch(createEngine(data),{mode:'full',seed:11,players:[{name:'דוד',professionId:'teacher'},{name:'יוסי',professionId:'engineer'}]});
await page.goto('http://127.0.0.1:4192/');
await page.evaluate(j=>localStorage.setItem('passivo.save',j),serialize(m));await page.reload();
await page.locator('[data-action="resume"]').click();
await page.waitForTimeout(200);
if(await page.locator('.screen-board').count())throw Error('Partial board mounted on image failure');
if(await page.locator('[data-action="resume"]').count()!==1)throw Error('Retry control stranded');
if(await page.evaluate(()=>!localStorage.getItem('passivo.save')))throw Error('Save lost');
await page.unroute('**/board-premium.webp*');await page.locator('[data-action="resume"]').click();
await page.locator('.screen-board').waitFor();
if(!await page.evaluate(()=>document.querySelector('.board').getBoundingClientRect().width>0))throw Error('Board absent after retry');
console.log('PASS image failure preserves start/save and retry mounts board',failures);
}finally{await browser?.close();server.kill();}
