import {chromium}from'playwright';import{spawn}from'node:child_process';import{mkdirSync,writeFileSync}from'node:fs';
let srv=spawn('npx',['vite','--port','4191','--host','127.0.0.1'],{stdio:'ignore'});
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4191')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 let b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});mkdirSync('shots/premium',{recursive:true});
 for(let theme of ['dark','light']){
 let p=await b.newPage({viewport:{width:320,height:568},deviceScaleFactor:2});p.on('pageerror',e=>console.log('ERROR',e.message));
 await p.goto('http://127.0.0.1:4191/?theme='+theme);await p.locator('[data-action="start"]').waitFor();await p.screenshot({path:`shots/premium/small-home-${theme}.png`});
 await p.locator('[data-mode="full"]').click();await p.locator('[data-action="start"]').click();console.log((await p.locator('body').innerText()).slice(0,500));
 await p.getByRole('button',{name:'בחירת מקצוע',exact:true}).click();await p.locator('[data-prof="teacher"]').waitFor();await p.waitForTimeout(800);await p.screenshot({path:`shots/premium/small-pick-${theme}.png`});
 await p.locator('[data-prof="teacher"]').click();console.log('PICK', (await p.locator('body').innerText()).slice(-1000));
 await p.locator('.st-toggle').click();await p.screenshot({path:`shots/premium/small-profession-details-${theme}.png`});
 await p.locator('[data-action="go"]').click();await p.locator('.screen-board').waitFor();await p.waitForTimeout(1500);
 console.log('BOARD',await p.locator('.board').evaluate(e=>({w:e.offsetWidth,h:e.offsetHeight})));await p.screenshot({path:`shots/premium/small-board-${theme}.png`});
 writeFileSync(`shots/premium/small-board-${theme}.txt`,await p.locator('body').innerText());await p.close();
 }
 await b.close();
}finally{srv.kill();}
