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
for(const [name,url] of [['before','https://hallel34.github.io/hallel34/pr-preview/pr-8/'],['after','http://127.0.0.1:4192/']]){
const context=await browser.newContext({viewport:{width:393,height:755},recordVideo:{dir:`/tmp/arming-${name}`,size:{width:393,height:755}}});const page=await context.newPage();
const m=newMatch(createEngine(data),{mode:'full',seed:11,players:[{name:'דוד',professionId:'teacher'},{name:'יוסי',professionId:'engineer'}]});
await page.goto(url);await page.evaluate(j=>{localStorage.setItem('passivo.save',j);localStorage.setItem('passivo.prefs',JSON.stringify({theme:'dark',guessFull:false,explain:false}));},serialize(m));await page.reload();await page.locator('[data-action="resume"]').click();
await page.locator('[data-action="roll-next"]').waitFor();
const frames=[];for(let i=0;i<5;i++){frames.push(await page.locator('[data-action="roll-next"]').evaluate(e=>({disabled:e.disabled,busy:e.getAttribute('aria-busy'),background:getComputedStyle(e).backgroundColor,bar:getComputedStyle(e,'::after').content})));await page.waitForTimeout(200);}
console.log(name,frames);
await page.screenshot({path:`/tmp/arming-${name}.png`});const video=page.video();await context.close();console.log('VIDEO',name,await video.path());
}
}finally{await browser?.close();server.kill();}
