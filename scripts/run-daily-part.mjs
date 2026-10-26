import{readFileSync,writeFileSync,unlinkSync}from'node:fs';import{spawnSync}from'node:child_process';
let part=process.argv[2],s=readFileSync('tests/e2e/daily-smoke.mjs','utf8');let end=s.indexOf('  // ---- the two save slots never cross');
if(part==='slots')s=s.slice(0,s.indexOf('  for (const [w, h] of [[360, 800]'))+s.slice(end);
else{s=s.slice(0,end)+`await browser.close();server?.kill();if(failures.length)throw Error(failures.join('\\n'));console.log('DAILY ${part} PASSED');}\n`+s.slice(s.indexOf('async function startNormal'));s=s.replace('[[360, 800], [360, 640], [320, 568]]',part==='800'?'[[360,800]]':part==='640'?'[[360,640]]':'[[320,568]]');}
let p='tests/e2e/.daily-'+part+'.mjs';writeFileSync(p,s);let r=spawnSync(process.execPath,[p],{stdio:'inherit',env:process.env});unlinkSync(p);process.exit(r.status??1);
