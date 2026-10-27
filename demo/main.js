import '../src/styles/fonts.css';
import './style.css';
import { UPGRADES, TILES, EVENTS, initialState, roll, upgrade, remaining } from './model.js';
import { scene } from './scene.js';
import fox from '../src/assets/profession-fox/cook.webp';
import celebrate from '../src/assets/fox/celebrate.webp';
const dice = Object.entries(import.meta.glob('../src/assets/die-*.svg', { eager:true, query:'?url', import:'default' })).sort(([a],[b]) => a.localeCompare(b)).map(([,url])=>url);
const root = document.querySelector('#demo');
let state = initialState(), busy = false, sound = false, audio;
const fmt = n => n.toLocaleString('he-IL');
function chime(build = false) {
  if (!sound) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); [440,554,build?880:660].forEach((f,i) => { const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09; o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.21); }); } catch {}
}
function render({ grown = false, message } = {}) {
 const complete = state.level === 3, next = UPGRADES[state.level], ready = !complete && remaining(state)===0;
 const stage = ['קיוסק קטן. חלום גדול.','כבר מרגיש כמו בית.','עכשיו זה המקום שלך.','מקיוסק קטן לקפה מקסי.'][state.level];
 root.innerHTML = `<div class="demo-shell${grown?' just-built':''}">
 <header><a href="./index.html" class="wordmark" aria-label="MaxiFox - למשחק הקיים">MAXI<span>FOX</span><small>העסק שלי</small></a><span class="demo-label">דמו למשחק</span><button class="sound" aria-label="${sound?'כיבוי':'הפעלת'} צלילים" aria-pressed="${sound}">${sound?'♪':'♪̸'}</button></header>
 <section class="intro"><div><p class="eyebrow">הפינה של מקסי</p><h1>${stage}</h1></div><span class="level">${state.level} / 3 <small>שדרוגים</small></span></section>
 <section class="scene-wrap" aria-label="העסק שלך"><div class="sky-orb"></div><span class="scene-caption">${['הכול מתחיל מקפה אחד','בית הקפה נפתח',state.style==='terrace'?'המרפסת שלך מוכנה':'הטייק אוויי שלך מוכן','קפה מקסי פתוח!'][state.level]}</span>${scene(state.level,state.style)}<img class="fox" src="${complete?celebrate:fox}" alt="מקסי השועל" width="110" height="140"><div class="scene-floor"></div>${grown?'<div class="build-burst" aria-hidden="true">✦ &nbsp; ✧ &nbsp; ✦</div>':''}</section>
 ${complete ? `<section class="finish"><span class="eyebrow">עשית את זה</span><h2>יש לך מקום משלך.</h2><p>${fmt(state.rolls)} גלגולים. שלושה שדרוגים. ${state.style==='terrace'?'ומרפסת לקפה של הבוקר.':'וחלון לקפה שבדרך.'}</p><p class="finish-note">זה סוף הדמו. אין צורך לחכות או לקנות קוביות.</p></section>` : `<section class="goal${ready?' ready':''}" aria-label="השדרוג הבא"><div class="goal-head"><div><span class="eyebrow">הבא בתור</span><h2>${next.title}</h2></div><div class="balance"><span class="spark">✦</span> <b>${fmt(state.points)}</b><span> / ${next.cost}</span></div></div><div class="meter" role="progressbar" aria-label="התקדמות לשדרוג הבא" aria-valuemin="0" aria-valuemax="${next.cost}" aria-valuenow="${Math.min(next.cost,state.points)}"><div style="width:${Math.min(100,state.points/next.cost*100)}%"></div></div><p>${ready?'מוכן לבנייה. עכשיו רואים את השינוי.':`עוד ${remaining(state)} נקודות תנופה ל${next.title === 'הפינה שלך'?'שדרוג הבא':next.title}.`} <span>${ready?'✦':next.detail}</span></p></section>
 <section class="route" aria-label="מסלול הגלגול">${TILES.map((type,i)=>`<div class="route-tile ${type}${i===state.position?' active':''}" aria-label="${EVENTS[type].title}${i===state.position?' - המיקום שלך':''}" ${i===state.position?'aria-current="step"':''}><span aria-hidden="true">${EVENTS[type].icon}</span>${i===state.position?'<i aria-hidden="true"></i>':''}</div>`).join('')}</section>
 <section class="event" aria-live="polite" aria-atomic="true"><span class="event-icon">${state.last?.icon||'✦'}</span><div><b>${message || state.last?.title || 'הגלגול הבא בונה משהו'}</b><p>${state.last?state.last.line:'כל נחיתה מוסיפה תנופה לעסק שלך.'}</p></div>${state.last?`<strong>+${state.last.points}<small>תנופה</small></strong>`:''}</section>`}
 <footer><button class="primary" ${busy?'disabled':''} data-action="${complete?'restart':ready?'build':'roll'}">${complete?'<span>לבנות שוב, קצת אחרת</span><span aria-hidden="true">↻</span>':ready?`<span>בונים ${next.title === 'הפינה שלך'?'את הפינה שלך':next.title}</span><span aria-hidden="true">✦</span>`:`<span>${busy?'הקובייה מתגלגלת…':'מגלגלים ובונים'}</span><img class="die${busy?' rolling':''}" src="${dice[state.die-1]}" alt="${state.die}" width="42" height="42">`}</button><p class="disclaimer">גלגולים חופשיים · נקודות דמו בלבד · בלי שינוי במשחק הקיים</p><a class="compare" href="./index.html">בחזרה למשחק הקיים</a></footer>
 </div><dialog id="style-choice" aria-labelledby="choice-title"><p class="eyebrow">זה העסק שלך</p><h2 id="choice-title">איך המקום יגדל?</h2><p>אותה עלות: 24 נקודות תנופה. רק האופי משתנה.</p><button data-style="terrace"><span>☂</span><b>מרפסת שכונתית</b><small>עוד שולחנות. עוד רגע ביחד.</small></button><button data-style="takeaway"><span>☕</span><b>חלון טייק אוויי</b><small>קפה קטן בדרך ליום גדול.</small></button><button class="cancel">עדיין חושבים</button></dialog>`;
 root.querySelector('.sound').addEventListener('click',()=>{sound=!sound;render();if(sound)chime();});
 root.querySelector('.primary').addEventListener('click',onAction);
 const dialog = root.querySelector('dialog');
 dialog.querySelector('.cancel').addEventListener('click',()=>dialog.close());
 dialog.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>build(b.dataset.style)));
}
function build(style) { state=upgrade(state,style);chime(true);render({grown:true}); }
async function onAction() {
 if (busy) return;
 if (state.level===3) {state=initialState(); render();return;}
 if (!remaining(state)) { if(state.level===1) root.querySelector('dialog').showModal(); else build(); return; }
 busy=true;render();
 const finalDie = crypto.getRandomValues(new Uint32Array(1))[0];
 // Rejection sampling avoids modulo bias. Animation never changes the actual outcome.
 const limit=4294967292; let random=finalDie;
 while(random>=limit) random=crypto.getRandomValues(new Uint32Array(1))[0];
 const die=(random%6)+1;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduced) await new Promise(resolve=>setTimeout(resolve,620));
 state=roll(state,die);busy=false;chime();render();
}
render();
