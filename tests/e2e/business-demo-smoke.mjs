import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base=process.env.DEMO_URL||'http://localhost:4180/business-demo.html';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180','--strictPort'],{stdio:'ignore'});
let browser;
try {
for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const width of [320,393,480])for(const style of ['terrace','takeaway']){
 const page=await browser.newPage({viewport:{width,height:755},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('passivo.qa-demo-sentinel','unchanged');});
 await page.goto(base);await page.waitForSelector('.cafe-scene');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
 let builds=0;
 for(let i=0;i<30;i++){
   const action=await page.locator('.primary').getAttribute('data-action');
   if(action==='restart')break;
   if(action==='build'){
     if(builds===1){await page.locator('.primary').click();await page.locator('dialog').waitFor({state:'visible'});await page.locator('.cancel').click();assert.equal(await page.locator('dialog').isVisible(),false);await page.locator('.primary').click();await page.locator(`[data-style="${style}"]`).click();}
     else await page.locator('.primary').click();
     builds++;
   }else {await page.locator('.primary').click();await page.locator('.primary:not(:disabled)').waitFor();}
 }
 assert.equal(builds,3,'all builds reached');assert.equal(errors.length,0,errors.join('\n'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('passivo.qa-demo-sentinel')),'unchanged');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('.compare').getAttribute('href'),'./index.html');
 await page.locator('.primary').click();assert.equal(await page.locator('.primary').getAttribute('data-action'),'roll');
 console.log(`PASS ${width}px ${style}: ending, replay, cancel, no overflow, no JS errors, saves isolated`);await page.close();
}
// Normal-motion double-tap protection: a second tap cannot award a second outcome.
const page=await browser.newPage();await page.goto(base);await page.locator('.primary').dblclick({force:true});await page.locator('.primary:not(:disabled)').waitFor();assert.equal(await page.locator('.event strong').count(),1);await page.close();
console.log('BUSINESS DEMO SMOKE PASSED');
} finally {await browser?.close();if(server){server.kill('SIGTERM');await new Promise(r=>server.once('close',r));}}
