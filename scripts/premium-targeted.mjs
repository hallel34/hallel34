import{chromium}from'playwright';import{spawn}from'node:child_process';import{readFileSync,mkdirSync,writeFileSync}from'node:fs';import{createEngine,newMatch,serialize,act,currentState}from'../src/engine/index.js';
const engine=createEngine({professions:JSON.parse(readFileSync('src/data/professions.he.json')),cards:JSON.parse(readFileSync('src/data/cards.he.json'))});
let srv=spawn('npx',['vite','--port','4215'],{stdio:'ignore'});let result={};
try{for(let i=0;i<60;i++){try{if((await fetch('http://localhost:4215')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});let p=await b.newPage({viewport:{width:360,height:800},deviceScaleFactor:2});await p.goto('http://localhost:4215');
result.cashAnimation=await p.evaluate(async()=>{let{cashDisplay}=await import('/src/ui/widgets.js');let c=cashDisplay(9000);document.body.append(c.el);let run=c.to(8100,700);await new Promise(r=>setTimeout(r,50));c.set(14000);await run;let ok=c.el.textContent.replace(/\s/g,'')==='₪14,000';c.el.remove();return ok;});
let m=newMatch(engine,{mode:'full',seed:5,players:[{name:'A',professionId:'teacher'},{name:'B',professionId:'engineer'},{name:'C',professionId:'nurse'},{name:'D',professionId:'driver'}]});
m=act(m,s=>({...s,position:5}));m=act(m,s=>engine.roll(s,[1]));
await p.evaluate(j=>{localStorage.setItem('passivo.save',j);localStorage.setItem('passivo.seenIntro','1')},serialize(m));await p.reload();await p.locator('[data-action="resume"]').click();await p.locator('[data-action="donate"]').waitFor();await p.locator('[data-action="donate"]').click();await p.locator('.handoff-sheet').waitFor();await p.waitForTimeout(1100);
result.afterDonation={header:await p.locator('.hud .cash-num').innerText(),player:await p.locator('.hud-prof').innerText(),state:await p.locator('.screen-board').getAttribute('data-cash')};
if(result.afterDonation.state!=='14000'||!result.afterDonation.header.includes('14,000'))throw Error('stale cash after donation');
await p.screenshot({path:'shots/premium/donation-handover.png'});let fresh=newMatch(engine,{mode:'full',seed:5,players:[{name:'A',professionId:'teacher'},{name:'B',professionId:'engineer'},{name:'C',professionId:'nurse'},{name:'D',professionId:'driver'}]});await p.evaluate(j=>localStorage.setItem('passivo.save',j),serialize(fresh));await p.reload();await p.locator('[data-action="resume"]').click();await p.locator('.handoff-sheet').waitFor();await p.evaluate(()=>document.querySelector('#modal-root').style.visibility='hidden');await p.waitForTimeout(600);await p.screenshot({path:'shots/premium/multiplayer-board.png'});await p.evaluate(()=>document.querySelector('#modal-root').style.visibility='');
let stock=engine.data.cards.filter(c=>c.type==='stock').slice(0,2);
let single=newMatch(engine,{mode:'full',seed:5,players:[{name:'A',professionId:'teacher'}]});
single=act(single,s=>({...s,assets:stock.map((c,i)=>({id:'asset-'+(i+1),cardId:c.id,type:'stock',symbol:c.symbol,title:c.title,qty:10,avgCost:c.price,dividend:c.dividend,monthlyCashFlow:10*c.dividend})),stockPrices:{[stock[0].symbol]:500},seq:2}));
await p.goto('http://localhost:4215');await p.evaluate(j=>localStorage.setItem('passivo.save',j),serialize(single));await p.reload();await p.locator('[data-action="resume"]').click();await p.locator('[data-action="statement"]').click();await p.locator('[data-action="sell"]').click();await p.locator('.sell-row').first().waitFor();
result.stockLabels=await p.locator('.sell-info strong').allTextContents();result.stockSymbols=stock.map(c=>c.symbol);
await p.waitForTimeout(600);await p.screenshot({path:'shots/premium/stock-identities.png'});
const before=currentState(single).cash;await p.locator('.sell-row').first().locator('[data-action="sell"]').click();await p.waitForTimeout(900);let saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('passivo.save')));result.crashedSale={before,after:saved.players[0].state.cash,expected:before+5000};if(result.crashedSale.after!==result.crashedSale.expected)throw Error('sale price mismatch');
await p.waitForTimeout(600);await p.screenshot({path:'shots/premium/stock-after-sale.png'});
await b.close();console.log(JSON.stringify(result));writeFileSync('shots/premium/targeted.json',JSON.stringify(result,null,2));
}finally{srv.kill();}
