// Bounded execution of the existing smoke assertions. Source tests are not edited.
import {readFileSync,writeFileSync,unlinkSync}from'node:fs';import{spawnSync}from'node:child_process';
const part=process.argv[2];let s=readFileSync('tests/e2e/smoke.mjs','utf8');
const setup=`await startServer(); const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox']}); const ctx=await browser.newContext({viewport:{width:360,height:HEIGHT},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'he-IL',reducedMotion:'reduce'}); const page=await ctx.newPage(); await page.addInitScript(LEARN_OBSERVER); await page.goto(URL_BASE);`;
const groups={
 natural:`const engine=learnEngine();let m=newMatch(engine,{mode:MODE,seed:Number(process.env.SMOKE_SEED||11),players:Array.from({length:PLAYERS},(_,i)=>({name:'P'+(i+1),professionId:['teacher','engineer','nurse','driver'][i]}))});await page.evaluate(j=>{localStorage.setItem('passivo.save',j);localStorage.setItem('passivo.seenIntro','1');localStorage.setItem('passivo.tutorial',JSON.stringify({storyDone:true,helpOn:false,hintsSeen:{},quizDone:true}));},serialize(m));await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('.screen-board').waitFor();if(process.env.CONTINUE_GAME){const fs=await import('node:fs');if(fs.existsSync(process.env.CONTINUE_GAME)){await page.evaluate(j=>localStorage.setItem('passivo.save',j),fs.readFileSync(process.env.CONTINUE_GAME,'utf8'));await page.reload();await page.locator('[data-action="resume"]').click();}}const r=await playGame(page,'natural-'+MODE,75000);const fs=await import('node:fs');if(process.env.CONTINUE_GAME&&r.result!=='won')fs.writeFileSync(process.env.CONTINUE_GAME,await page.evaluate(()=>localStorage.getItem('passivo.save')));check(r.result==='won'||(r.result==='timeout'&&!!process.env.CONTINUE_GAME),JSON.stringify(r));`,
 buy:'await testBuyStates(page); await testLegacySave(page);',
 hud:'await testHudCash(browser); await testMilestoneFastRoll(browser);',
 notes:'await testNotesAtSizes(browser);',
 junior:'await testJunior(browser);',
 round5:'await testRound5(page);',
 phase:'await testPhaseA(page);',
 guess:'await testGuessFlow(page);',
 explain:'await testExplainers(page);',
 dict:'await testDictionary(page);'
};
if(part==='game') {s=s.replace("if (PLAYERS === 1) { await testBuyStates(page); await testLegacySave(page); await testHudCash(browser); await testMilestoneFastRoll(browser); await testNotesAtSizes(browser); if (MODE === 'family') await testJunior(browser); }",'').replace('  await testRound5(page);','').replace('  await testPhaseA(page);','').replace("  if (PLAYERS === 1) { await testGuessFlow(page); await testExplainers(page); }",'').replace('  await testDictionary(page);','');}
else {s=s.slice(0,s.indexOf('async function main()'))+`async function main(){${setup} try{${groups[part]}}finally{await browser.close();server?.kill();} if(failures.length)throw new Error(failures.join('\\n')); console.log('PART ${part} PASSED');} main().catch(e=>{console.error(e);server?.kill();process.exit(1);});`;}
if(part==='guess')s=s.replace("localStorage.removeItem('passivo.learn.seen');","localStorage.setItem('passivo.seenIntro','1');localStorage.removeItem('passivo.learn.seen');");
const path='tests/e2e/.bounded-'+part+'-'+process.pid+'.mjs';writeFileSync(path,s);let r=spawnSync(process.execPath,[path],{stdio:'inherit',env:process.env});unlinkSync(path);process.exit(r.status??1);
