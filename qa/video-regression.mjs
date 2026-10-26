import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createEngine,newMatch,serialize} from '../src/engine/index.js';
import {readFileSync} from 'node:fs';
const loadData=()=>Object.fromEntries(['professions','cards'].map(k=>[k,JSON.parse(readFileSync(new URL(`../src/data/${k}.he.json`,import.meta.url)))]));
import {mkdirSync} from 'node:fs';
const out=process.env.VISUAL_OUT || '/tmp/maxifox-visual';mkdirSync(out,{recursive:true});
const server=spawn('npx',['vite','--host','127.0.0.1','--port','4188'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4188')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 for(const [width,height] of [[393,755],[320,568]]) {
 const page=await browser.newPage({viewport:{width,height}});
 const engine=createEngine(loadData('he')); const m=newMatch(engine,{mode:'family',seed:11,players:[{name:'נצח',professionId:'teacher',age:'upTo10'},{name:'רוני',professionId:'lawyer',age:'11to13'}]});
 // Prepared fixture: a charity turn uses two dice; passing yearly square exercises summary transition.
 m.players[0].state.position=23;m.players[0].state.charityTurns=3;
 await page.goto('http://127.0.0.1:4188/?theme=dark');
 await page.evaluate(json=>{localStorage.setItem('passivo.save',json);localStorage.setItem('passivo.tutorial',JSON.stringify({storyDone:true,helpOn:false,hintsSeen:{},quizDone:true}));localStorage.setItem('passivo.prefs',JSON.stringify({theme:'dark',guessFamily:false,explain:false}));},serialize(m));
 await page.reload();await page.locator('[data-action="resume"]').click();
 const beforeHome=await page.evaluate(()=>localStorage.getItem('passivo.save'));
 await page.locator('[data-action="handoff-home"]').click();await page.locator('[data-action="resume"]').waitFor();
 if(await page.locator('.menu-sheet').count())throw Error('Home opened menu');
 if(await page.evaluate(()=>localStorage.getItem('passivo.save'))!==beforeHome)throw Error('Home changed save');
 console.log('PASS direct home and unchanged save',width,height);
 await page.locator('[data-action="resume"]').click();await page.locator('[data-action="roll-next"]').click();
 await page.locator('[data-summary]').waitFor({timeout:15000});
 await page.screenshot({path:`${out}/summary-${width}.png`});
 const opacity=await page.locator('.sc-band').evaluate(e=>getComputedStyle(e).opacity);
 if(opacity!=='1')throw Error('Summary figures still hidden');
 console.log('PASS summary figures visible immediately',width,height);
 await page.locator('[data-action="summary-ok"]').click();
 await page.locator('[data-summary]').waitFor({state:'hidden'});
 await page.screenshot({path:`${out}/transition-${width}.png`});
 const label=await page.locator('.btn-roll').innerText();
 if(label.includes('מתגלגלת'))throw Error('Stale rolling label');
 const overlap=await page.evaluate(()=>{const a=document.querySelector('.dice').getBoundingClientRect(),b=document.querySelector('.chip-charity').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
 if(overlap)throw Error('Charity badge overlaps dice');
 if(await page.locator('[data-float]').count())throw Error('Duplicate money float over board');
 console.log('PASS advancing phase and no dice/charity/float overlap',width,height);
 await page.waitForTimeout(1800);await page.screenshot({path:`${out}/after-${width}.png`});
 await page.close();
 }
}finally{await browser?.close();server.kill();await new Promise(r=>server.once('exit',r));}
