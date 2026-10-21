// QA round 2 harness: loads REAL functions from public/index.html, mocks db + clock.
// run: node qa/round2.js
const fs=require('fs'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const js=html.slice(html.indexOf('<script>',html.indexOf('firestore-compat'))+8,html.lastIndexOf('</script>'));
const a=js.indexOf('let db, roomCode'), b=js.indexOf('function startGame');
const seg=js.slice(a,b);
let NOW=1e12; const RD=Date.now; Date.now=()=>NOW;
const mk=()=>new Function('let myId="host";const $=()=>null;const ls={get:()=>null,set(){},del(){}};const toast=()=>{};const confirm=()=>true;const document={body:{}};const renderHome=()=>{};const render=()=>{};const esc=s=>s;'+seg+';return {hostTick,leaveRoom,winnerOf,setRoom:r=>{room=r},getRoom:()=>room,setDb:d=>{db=d;roomCode="1234"},setMe:x=>{myId=x},nightMode,getBusy:()=>busy}')();
const P=o=>Object.fromEntries(Object.entries(o).map(([k,[r,al]],i)=>[k,{name:k,role:r,alive:al!==false,joinedAt:i,ready:true}]));
function game(players,extra={}){
  const L=mk(); let doc={code:'1234',hostId:'host',status:'night',round:1,settings:{discussion:60},players:P(players),night:{mafia:{},doctor:null,detective:null},votes:{},checks:{},...extra};
  const log=[];
  L.setDb({collection:()=>({doc:()=>'ref'}),runTransaction:async fn=>{await fn({get:async()=>({exists:true,data:()=>JSON.parse(JSON.stringify(doc))}),update:(r,o)=>{log.push(o);for(const[k,v]of Object.entries(o))doc[k]=v},delete(){doc=null}})}});
  const sync=()=>L.setRoom(JSON.parse(JSON.stringify(doc)));
  const tick=async(ms=500)=>{NOW+=ms;sync();await L.hostTick();sync();};
  sync();
  return {L,doc:()=>doc,tick,log,sync};
}
const R=[];const T=(n,f)=>f().then(()=>{R.push('PASS '+n)},e=>{R.push('FAIL '+n+' :: '+e.message)});
(async()=>{
await T('P0a mafia leaves in night -> town wins',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],d:['doctor']});
  await g.tick(); assert.equal(g.doc().status,'night');
  g.L.setMe('m'); await g.L.leaveRoom(); g.L.setMe('host');
  assert.equal(g.doc().status,'over'); assert.equal(g.doc().winner,'town');
});
await T('P0b hostTick win check catches stale/ghost state (no mafia alive in night)',async()=>{
  const g=game({host:['citizen'],m:['mafia',false],a:['citizen'],b:['citizen']});
  await g.tick(); assert.equal(g.doc().status,'over');assert.equal(g.doc().winner,'town');
});
await T('P0c leave making mafia>=others -> mafia wins (leaveRoom)',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen']});
  g.L.setMe('a'); await g.L.leaveRoom(); assert.equal(g.doc().winner,'mafia');
});
await T('P0d leave in reveal does not end game; host leave reassigns host',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],c:['citizen']},{status:'reveal'});
  g.L.setMe('host'); await g.L.leaveRoom(); assert.equal(g.doc().status,'reveal'); assert.equal(g.doc().hostId,'m');
});
await T('P0e mafia disagree: waits 20s then resolves, not earlier',async()=>{
  const g=game({host:['citizen'],m1:['mafia'],m2:['mafia'],a:['citizen'],b:['citizen'],c:['citizen'],e:['citizen'],doc:['doctor']});
  g.doc().night={mafia:{m1:'a',m2:'b'},doctor:'c',detective:null};
  for(let i=0;i<38;i++) await g.tick(); // 19s
  assert.equal(g.doc().status,'night');
  for(let i=0;i<6;i++) await g.tick();
  assert.equal(g.doc().status,'day');
  assert(['a','b'].includes(g.doc().dayResult.killed));
});
await T('P0f no picks at all: forced after 120s, victim is a non-mafia',async()=>{
  const g=game({host:['citizen'],m1:['mafia'],a:['citizen'],b:['citizen'],c:['citizen'],e:['citizen']});
  for(let i=0;i<236;i++) await g.tick(); assert.equal(g.doc().status,'night');
  for(let i=0;i<6;i++) await g.tick(); assert.equal(g.doc().status,'day');
  assert.notEqual(g.doc().dayResult.killed,'m1');assert(g.doc().dayResult.killed);
});
await T('P0g mafia picked, doctor missing: forced at 120s only',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],c:['citizen'],doc:['doctor']});
  g.doc().night.mafia={m:'a'};
  for(let i=0;i<200;i++) await g.tick(); assert.equal(g.doc().status,'night');
  for(let i=0;i<50;i++) await g.tick(); assert.equal(g.doc().status,'day'); assert.equal(g.doc().dayResult.killed,'a');
});
await T('P1 detective result held >=6s after last pick, then resolves once',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],det:['detective'],doc:['doctor']});
  g.doc().night={mafia:{m:'a'},doctor:'b',detective:'m'}; g.doc().checks={1:{target:'m',mafia:true}};
  g.L.setMe('host');
  for(let i=0;i<11;i++) await g.tick(); // 5.5s
  assert.equal(g.doc().status,'night');
  for(let i=0;i<3;i++) await g.tick();
  assert.equal(g.doc().status,'day'); assert.equal(g.log.length,1,'double transition');
});
await T('P1b detective picks late in night: hold counted from pick not from night start',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],det:['detective']});
  g.doc().night.mafia={m:'a'};
  for(let i=0;i<40;i++) await g.tick(); // 20s idle
  g.doc().night.detective='m'; g.doc().checks={1:{target:'m',mafia:true}};
  await g.tick(); assert.equal(g.doc().status,'night');
  for(let i=0;i<12;i++) await g.tick(); assert.equal(g.doc().status,'day');
});
await T('win via night kill ends game once',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen']});
  g.doc().night.mafia={m:'a'};
  for(let i=0;i<4;i++) await g.tick(); assert.equal(g.doc().status,'over');assert.equal(g.doc().winner,'mafia');assert.equal(g.log.length,1);
});
await T('day/vote/voteResult win check on ghost removal',async()=>{
  for(const st of ['day','vote','voteResult']){
    const g=game({host:['citizen'],m:['mafia',false],a:['citizen'],b:['citizen']},{status:st,dayEndsAt:NOW+1e6});
    await g.tick(); assert.equal(g.doc().status,'over',st);
  }
});
await T('backoff after tx failure (no hammering)',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],c:['citizen']});
  g.doc().night.mafia={m:'a'}; let calls=0;
  g.L.setDb({collection:()=>({doc:()=>'r'}),runTransaction:async()=>{calls++;throw new Error('x')}});
  const e=console.error;console.error=()=>{};
  for(let i=0;i<10;i++) await g.tick(); console.error=e; // 5s
  assert(calls<=3,'calls='+calls);
});
await T('ALL tx guard: night tx does nothing if status changed (idempotent)',async()=>{
  const g=game({host:['citizen'],m:['mafia'],a:['citizen'],b:['citizen'],c:['citizen']});
  g.doc().night.mafia={m:'a'}; g.sync(); await g.L.hostTick(); // stale room says night
  const n=g.log.length; g.doc().status='day'; await g.L.hostTick(); assert.equal(g.log.length,n);
});
console.log(R.join('\n'));
})();
