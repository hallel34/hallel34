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
for(const [name,url] of [['dice-before','https://hallel34.github.io/hallel34/pr-preview/pr-8/'],['dice-after','http://127.0.0.1:4192/']]){
const context=await browser.newContext({viewport:{width:393,height:755},recordVideo:{dir:`/tmp/arming-${name}`,size:{width:393,height:755}}});const page=await context.newPage();
const m=newMatch(createEngine(data),{mode:'full',seed:11,players:[{name:'דוד',professionId:'teacher'},{name:'יוסי',professionId:'engineer'}]});
await page.goto(url);await page.evaluate(j=>{localStorage.setItem('passivo.save',j);localStorage.setItem('passivo.prefs',JSON.stringify({theme:'dark',guessFull:false,explain:false}));},serialize(m));await page.reload();await page.locator('[data-action="resume"]').click();
await page.locator('[data-action="roll-next"]').waitFor();
await page.evaluate(()=>{window.__resultTransforms=[];const watch=()=>{const e=document.querySelector('.die-result');if(e&&!e.hidden)window.__resultTransforms.push(getComputedStyle(e).transform);if(window.__resultTransforms.length<70)requestAnimationFrame(watch);};requestAnimationFrame(watch);});
await page.locator('[data-action="roll-next"]').click();
await page.locator('.die-result:not([hidden])').waitFor();
const frames=[];for(let i=0;i<6;i++){frames.push(await page.locator('.die-result').evaluate(e=>({hidden:e.hidden,transform:getComputedStyle(e).transform,opacity:getComputedStyle(e).opacity,text:e.textContent})));await page.waitForTimeout(90);}
console.log(name,frames);console.log('TRANSFORMS',name,await page.evaluate(()=>[...new Set(window.__resultTransforms)]));
await page.screenshot({path:`/tmp/arming-${name}.png`});const video=page.video();await context.close();console.log('VIDEO',name,await video.path());
}
}finally{await browser?.close();server.kill();}
