// Renders the 0.5.1 challenge mocks (docs/v051/design/challenges-spec.md) into one contact sheet PNG.
// Static HTML mocks with the real tokens, Rubik, the profession foxes, the fox crops and the new icons in src/assets/challenge/.
// Run from the repo root:  node docs/v051/design/render-mocks.mjs   ->  docs/v051/design/challenges-contact-sheet.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const A = (p) => `file://${join(ROOT, 'src/assets', p)}`;
const svg = (name, size = 24) => readFileSync(join(ROOT, 'src/assets/challenge', `${name}.svg`), 'utf8')
  .trim().replace('width="24" height="24"', `width="${size}" height="${size}"`);
const tile = (name, size = 20) => readFileSync(join(ROOT, 'src/assets/tile', `${name}.svg`), 'utf8')
  .trim().replace('width="24" height="24"', `width="${size}" height="${size}"`);
const X = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)"><path d="M15 5l-7 7 7 7"/></svg>';
const INFO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const COIN = `<img src="${A('coin-small.svg')}" width="18" height="18" alt="" style="vertical-align:-3px">`;
const font = (w) => `@font-face{font-family:Rubik;font-weight:${w};src:url(file://${ROOT}/node_modules/@fontsource/rubik/files/rubik-hebrew-${w}-normal.woff2) format('woff2');unicode-range:U+0590-05FF,U+20AA,U+200C-2010}
@font-face{font-family:Rubik;font-weight:${w};src:url(file://${ROOT}/node_modules/@fontsource/rubik/files/rubik-latin-${w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}`;

const badge = (ok, small) => ok
  ? `<span class="badge ok${small ? ' sm' : ''}">${svg('verified', small ? 16 : 18)}אומת</span>`
  : `<span class="badge no${small ? ' sm' : ''}">${svg('unverified', small ? 16 : 18)}לא אומת</span>`;
const bust = (id, h) => `<div class="bust" style="--h:${h}px"><img src="${A(`profession-fox/${id}@2x.webp`)}" alt=""></div>`;
const head = (id, s = 44) => `<img class="head" src="${A(`profession-fox/${id}-head@2x.webp`)}" width="${s}" height="${s}" alt="">`;
const meter = (pct) => `<div class="meter"><i style="inline-size:${pct}%"></i></div>`;

function phone({ w, h, theme, label, body, cls = '' }) {
  return `<figure><div class="phone t-${theme} ${cls} ${w <= 320 ? 'is-320' : ''}" style="width:${w}px;height:${h}px">${body}</div><figcaption>${label}</figcaption></figure>`;
}

// ---------- 2. Intro ----------
function intro(o) {
  const k = o.kid;
  const title = o.name ? `אתגר מ-${o.name}` : 'קיבלתם אתגר';
  const who = o.name ? `התוצאה של ${o.name}` : (k ? 'במשחק הזה' : 'התוצאה בקישור');
  const res = o.turns
    ? `<div class="res-big"><b>${o.turns}</b><span>${k ? 'תורות עד החופש' : 'תורות עד חופש כלכלי'}</span></div>`
    : `<div class="res-big"><b>${o.pct}%</b><span>מהדרך לחופש כלכלי</span></div>${meter(o.pct)}`;
  return `
  <header class="topbar"><span class="kicker">${svg('challenge', 20)}${k ? 'אתגר' : 'אתגר מחבר'}</span><button class="iconbtn" aria-label="סגירה">${X}</button></header>
  <main class="scroll">
    <section class="card intro">
      ${bust(o.prof, o.bustH || 120)}
      <h1>${title}</h1>
      <div class="chips"><span class="chip">${o.profName}</span><span class="chip">${o.mode}</span>${o.junior ? `<span class="chip">${COIN} צעירים</span>` : ''}</div>
      <div class="result"><div class="res-label"><span>${who}</span>${badge(o.verified, true)}</div>${res}</div>
      <p class="lede">${k ? 'אותו משחק בדיוק: אותן קוביות ואותם קלפים. אתם מחליטים.' : `אותו משחק בדיוק: ${o.profName}, ${o.modeLong}, אותן קוביות ואותם קלפים. ההחלטות שלכם.`}<br><b class="cur">מה תעשו אתם?</b></p>
    </section>
    <p class="note">${INFO}<span>${k ? '<b>שני כללים באתגר:</b> תרומה לא נותנת עוד קובייה. אי אפשר לזרוק שוב.' : '<b>באתגר יש שני כללים:</b> תרומה לא נותנת קובייה נוספת. אין גלגול שוב.'}</span></p>
  </main>
  <footer class="foot"><button class="btn primary">${k ? 'בואו נשחק' : 'שחקו את האתגר'}</button><button class="btn text">לא עכשיו</button></footer>`;
}
function introError() {
  return `
  <header class="topbar"><span class="kicker">${svg('challenge', 20)}אתגר מחבר</span><button class="iconbtn" aria-label="סגירה">${X}</button></header>
  <main class="scroll center">
    <div class="err-icon">${svg('unverified', 40)}</div>
    <h1 class="err-title">הקישור לא נפתח</h1>
    <p class="lede">אולי חסר בו חלק, או שהוא נקטע בדרך. בקשו ממי ששלח לשלוח אותו שוב.</p>
    <p class="fine">קוד: FORMAT</p>
  </main>
  <footer class="foot"><button class="btn primary">לדף הבית</button><button class="btn text">למשחק רגיל</button></footer>`;
}

// ---------- 4. Compare ----------
function compare(o) {
  const k = o.kid;
  const rows = o.rows.map((r) => `
      <div class="c-row${r.key ? ' key' : ''}">
        <div class="v me ${r.best === 'me' ? 'best' : ''} ${o.verified === false ? '' : ''}">${r.best === 'me' ? CHECK : ''}<b>${r.me}</b>${r.meSub ? `<small class="sub">${r.meSub}</small>` : ''}${r.meBar != null ? meter(r.meBar) : ''}</div>
        <div class="lbl">${r.label}</div>
        <div class="v them ${r.best === 'them' ? 'best' : ''} ${o.verified === false ? 'dim' : ''}">${r.best === 'them' ? CHECK : ''}<b>${r.them}</b>${r.themSub ? `<small class="sub">${r.themSub}</small>` : ''}${r.themBar != null ? meter(r.themBar) : ''}</div>
      </div>`).join('');
  return `
  <header class="topbar"><h2 class="tb-title">ההשוואה</h2><button class="iconbtn" aria-label="חזרה לתפריט">${X}</button></header>
  <main class="scroll">
    <div class="headline"><h1>${o.headline}</h1><p>${o.sub}</p></div>
    <section class="card cmp">
      <div class="c-head">
        <div class="who">${head(o.meProf)}<b>אתם</b>${badge(true, true)}</div>
        <span class="vs">מול</span>
        <div class="who">${head(o.themProf)}<b>${o.them}</b>${badge(o.verified, true)}</div>
      </div>
      ${rows}
    </section>
    ${o.verified === false ? `<p class="note warnless">${svg('unverified', 20)}<span>לא הצלחנו לשחזר את המשחק מהקישור, ולכן התוצאה מוצגת בלי בדיקה. היא לא תיכנס לטבלת המשפחה.</span></p>` : ''}
    <div class="takeaway"><img class="crop" src="${A(`fox/${o.fox}.webp`)}" alt=""><p>${o.takeaway}</p></div>
  </main>
  <footer class="foot">
    <button class="btn primary">${o.primary || 'שלחו את התוצאה שלכם'}</button>
    <div class="row2"><button class="btn ghost" ${o.verified === false ? 'disabled' : ''}>${svg('replay', 20)}צפייה חוזרת</button><button class="btn ghost">${svg('family-board', 20)}לטבלת המשפחה</button></div>
  </footer>`;
}

// ---------- 5. Replay timeline ----------
function timeline() {
  const rows = [
    { t: 3, tile: 'payday', me: ['—', 'משכורת'], th: ['—', 'משכורת'] },
    { t: 4, tile: 'opportunity', split: true, me: ['דילוג', 'עגלת קפה'], th: ['קנייה', 'עגלת קפה'], line: 'בתור 4 העסקה ״עגלת קפה״ נקנתה אצל נועה, ואתם דילגתם' },
    { t: 5, tile: 'expense', me: ['הוצאה מהמזומן', 'טיפול שיניים'], th: ['הוצאה מהמזומן', 'טיפול שיניים'] },
    { t: 6, tile: 'opportunity', split: true, me: ['הלוואה · קנייה', 'דירת 2 חדרים'], th: ['דילוג', 'דירת 2 חדרים'], line: 'בתור 6 לקחתם הלוואה של ₪50,000, ואצל נועה לא', open: true },
    { t: 8, tile: 'charity', split: true, me: ['תרומה', '10% מההכנסה'], th: ['—', ''], line: 'בתור 8 תרמתם, ואצל נועה לא' },
    { t: 9, tile: 'market', me: ['—', 'הריבית עלתה'], th: ['—', 'הריבית עלתה'] },
    { t: 11, tile: 'opportunity', me: ['קנייה', 'מכונת שתייה'], th: ['קנייה', 'חנות פרחים'], note: 'אותו תור, קלף אחר (שלב אחר במשחק)' },
  ];
  const r = rows.map((x) => `
    <li class="tl-row${x.split ? ' split' : ''}">
      <div class="lane me"><b>${x.me[0]}</b><small>${x.me[1]}</small></div>
      <div class="spine"><span class="tn">${x.t}</span><span class="ti">${tile(x.tile, 18)}</span></div>
      <div class="lane them"><b>${x.th[0]}</b><small>${x.th[1]}</small></div>
      ${x.split ? `<p class="why">${svg('split', 16)}${x.line}</p>` : x.note ? `<p class="why muted">${x.note}</p>` : ''}
    </li>`).join('');
  const ticks = Array.from({ length: 23 }, (_, i) => `<i class="${[3, 5, 7, 10].includes(i) ? 's' : ''}"></i>`).join('');
  return `
  <header class="topbar"><button class="iconbtn" aria-label="חזרה">${BACK}</button><h2 class="tb-title grow">צפייה חוזרת</h2></header>
  <div class="tl-sum"><span>רק לצפייה: כאן רואים איפה ההחלטות נפרדו · 4 מתוך 23 תורות</span><div class="ticks" aria-hidden="true">${ticks}</div></div>
  <div class="seg" role="radiogroup"><button class="segb" aria-checked="false">רק פיצולים</button><button class="segb on" aria-checked="true">${CHECK}כל התורות</button></div>
  <div class="tl-heads"><div>${head('nurse', 32)}<b>אתם</b></div><span>תור</span><div>${head('teacher', 32)}<b>נועה</b></div></div>
  <ol class="tl">${r}</ol>`;
}

// ---------- 6. Family board ----------
function board(empty) {
  if (empty) return `
  <header class="topbar"><h2 class="tb-title">טבלת המשפחה של השבוע</h2><button class="iconbtn" aria-label="סגירה">${X}</button></header>
  <p class="week">השבוע: <bdi dir="ltr">8.11–14.11</bdi></p>
  <main class="scroll center">
    <div class="err-icon">${svg('family-board', 40)}</div>
    <h1 class="err-title">עוד אין תוצאות השבוע</h1>
    <p class="lede">שלחו אתגר למישהו מהמשפחה, והתוצאות יופיעו כאן.</p>
  </main>
  <footer class="foot"><button class="btn primary">שלחו אתגר</button></footer>`;
  const L = [
    ['1', 'teacher', 'נועה', 'מורה · משפחה', '18', 'תורות'],
    ['2', 'nurse', 'אתם', 'אח/ות · משפחה', '20', 'תורות', true],
    ['3', 'cook', 'יואב', 'טבח/ית · צעירים', '26', 'תורות'],
    ['4', 'lawyer', 'אבא', 'עורך/ת דין · מלא', '31', 'תורות'],
    ['5', 'driver', 'סבתא רותי', 'נהג/ת מונית · משפחה', '72%', 'עוד בדרך'],
  ];
  return `
  <header class="topbar"><h2 class="tb-title">טבלת המשפחה של השבוע</h2><button class="iconbtn" aria-label="סגירה">${X}</button></header>
  <p class="week">השבוע: <bdi dir="ltr">8.11–14.11</bdi> <span>ביום ראשון הטבלה מתחילה מחדש</span></p>
  <main class="scroll">
    <ol class="fb">${L.map(([n, p, name, sub, v, u, me]) => `
      <li class="${me ? 'me' : ''}"><span class="rk">${n === '1' ? STAR : ''}${n}</span>${head(p, 40)}<div class="nm"><b>${name}</b><small>${sub}</small></div><div class="rs"><b>${v}</b><small>${u}</small></div></li>`).join('')}
    </ol>
    <p class="fine">${svg('verified', 16)} מתוצאות של אתגרים שקיבלתם השבוע. רק תוצאות שנבדקו, ורק במכשיר הזה.</p>
    <p class="lede" style="text-align:center;font-size:14px">כל משחק הוא הזדמנות ללמוד. כל הכבוד לכל מי ששיחקו</p>
  </main>`;
}

// ---------- 3. HUD chip ----------
function hud(compact) {
  return `<div class="hud ${compact ? 'compact' : ''}">
    ${head('teacher', 44)}
    <div class="hud-col"><div class="hud-line">מורה · תור 7 <button class="ch-chip" aria-label="אתגר מול נועה">${svg('challenge', 16)}${compact ? '' : '<span>אתגר</span>'}</button></div>
    <div class="cash">${COIN}<b>₪12,480</b></div></div>
    <span class="grow"></span><button class="iconbtn sm">≡</button></div>
    <div class="pop"><b>${svg('challenge', 16)} משחק אתגר (מול נועה)</b><span>תרומה בלי קובייה נוספת, ואין גלגול שוב</span></div>`;
}

const CSS = `${[400, 500, 700, 900].map(font).join('\n')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#5b6170;font-family:Rubik,sans-serif;padding:24px}
h3.sec{color:#fff;font:800 22px Rubik;margin:8px 0 12px;direction:rtl}
.sheet{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;margin-block-end:24px}
figure{display:flex;flex-direction:column;gap:8px}
figcaption{color:#fff;font:500 14px Rubik;direction:ltr;max-width:390px}
.t-dark{--bg:#0F172A;--surface:#182238;--s2:#212D48;--text:#F5F7FC;--muted:#A9B5D0;--border:rgb(255 255 255/.14);--bstrong:#8A97B8;--income:#5FE0AE;--split:#7CC4FF;--split-tint:rgb(124 196 255/.14);--verified:#5FE0AE;--verified-tint:rgb(95 224 174/.14);--btnb:#7C89AB;--passive:#35D6B0;--track:rgb(255 255 255/.10);--press:rgb(255 255 255/.08)}
.t-light{--bg:#FBF3E1;--surface:#FFFFFF;--s2:#FFF9EC;--text:#0F172A;--muted:#3F4C78;--border:rgb(15 30 70/.22);--bstrong:#6F7899;--income:#0B6B43;--split:#1A62B3;--split-tint:rgb(26 98 179/.10);--verified:#0B6B43;--verified-tint:rgb(11 107 67/.10);--btnb:#6F7899;--passive:#087F66;--track:rgb(15 30 70/.14);--press:rgb(15 23 42/.06)}
.phone{direction:rtl;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;position:relative;border-radius:6px;box-shadow:0 8px 30px rgb(0 0 0/.35)}
.topbar{display:flex;align-items:center;gap:8px;padding:10px 16px 0;min-height:58px;flex:none}
.kicker{display:inline-flex;align-items:center;gap:8px;font:700 15px Rubik;color:var(--muted);flex:1}
.tb-title{font:800 22px Rubik;flex:1}
.iconbtn{inline-size:48px;block-size:48px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--muted);display:grid;place-items:center;font:700 22px Rubik;flex:none}
.scroll{flex:1;overflow:hidden;padding:8px 16px 12px;display:flex;flex-direction:column;gap:12px}
.scroll.center{align-items:center;justify-content:center;text-align:center;gap:12px;padding-inline:28px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:24px}
.intro{padding:16px 20px 18px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.bust{block-size:var(--h);display:flex;align-items:flex-end;justify-content:center;border-block-end:1px solid var(--border);inline-size:62%}
.bust img{block-size:100%;inline-size:auto;filter:drop-shadow(0 8px 12px rgb(0 0 0/.35))}
.intro h1{font:800 26px/1.2 Rubik}
.chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.chip{display:inline-flex;align-items:center;gap:6px;block-size:32px;padding:0 12px;border-radius:14px;background:var(--s2);border:1px solid var(--border);font:500 14px Rubik}
.result{inline-size:100%;background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:12px 16px;display:flex;flex-direction:column;gap:6px}
.res-label{display:flex;justify-content:space-between;align-items:center;font:500 13px Rubik;color:var(--muted)}
.res-big{display:flex;align-items:baseline;gap:10px;justify-content:center}
.res-big b{font:900 52px/1 Rubik;font-variant-numeric:tabular-nums}
.res-big span{font:700 16px Rubik}
.lede .cur{color:var(--text);font-weight:700}
.c-row .v small.sub{font:500 12px Rubik;color:var(--muted);direction:ltr}
.meter{block-size:8px;border-radius:4px;background:var(--track);overflow:hidden;inline-size:100%}
.meter i{display:block;block-size:100%;background:var(--passive);border-radius:4px}
.lede{font:400 15px/1.45 Rubik;color:var(--muted)}
.note{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);border-radius:14px;padding:10px 12px;font:500 14px/1.4 Rubik;color:var(--text)}
.note svg{flex:none;color:var(--muted);margin-block-start:1px}
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:12px;font:700 13px Rubik;padding:0 8px 0 10px;block-size:26px;white-space:nowrap}
.badge.ok{background:var(--verified-tint);color:var(--verified)}
.badge.no{border:1px dashed var(--bstrong);color:var(--muted)}
.foot{flex:none;display:flex;flex-direction:column;gap:8px;padding:8px 16px 16px;background:var(--bg)}
.btn{font:800 18px Rubik;border-radius:999px;border:0;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}
.primary{background:#F2B53A;color:#2A1700;block-size:64px}
.ghost{background:transparent;color:var(--text);box-shadow:inset 0 0 0 1.5px var(--btnb);block-size:56px;font:700 16px Rubik;flex:1}
.ghost[disabled]{opacity:.5}
.text{background:transparent;color:var(--text);block-size:48px;font:700 16px Rubik;align-self:center;padding:0 16px}
.row2{display:flex;gap:8px}
.err-icon{inline-size:80px;block-size:80px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:grid;place-items:center;color:var(--muted)}
.err-title{font:800 26px Rubik}
.fine{font:400 12px Rubik;color:var(--muted);display:flex;gap:6px;align-items:center}
.headline{text-align:center}
.headline h1{font:800 28px/1.2 Rubik}
.headline p{font:500 14px Rubik;color:var(--muted);margin-block-start:4px}
.cmp{padding:6px 12px 6px}
.c-head{display:grid;grid-template-columns:1fr 44px 1fr;align-items:center;padding:8px 0 10px;border-block-end:1px solid var(--border)}
.who{display:flex;flex-direction:column;align-items:center;gap:4px}
.who b{font:800 17px Rubik}
.head{border-radius:50%;background:var(--s2);border:1px solid var(--border)}
.vs{font:700 12px Rubik;color:var(--muted);text-align:center}
.c-row{display:grid;grid-template-columns:1fr 96px 1fr;align-items:center;min-block-size:56px;border-block-end:1px solid var(--border);gap:4px}
.c-row:last-child{border:0}
.c-row .lbl{font:500 13px/1.25 Rubik;color:var(--muted);text-align:center}
.c-row .v{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;position:relative}
.c-row .v b{font:800 24px Rubik;font-variant-numeric:tabular-nums}
.c-row.key .v b{font-size:30px}
.c-row .v.best b{color:var(--income)}
.c-row .v.best svg{position:absolute;inset-block-start:4px;inset-inline-end:8px;color:var(--income)}
.c-row .v.dim b{color:var(--muted)}
.c-row .meter{inline-size:72%;block-size:6px}
.takeaway{display:flex;gap:10px;align-items:center}
.crop{inline-size:52px;block-size:52px;border-radius:50%;border:2px solid var(--border);flex:none;object-fit:cover}
.takeaway p{background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:10px 12px;font:500 15px/1.4 Rubik}
.warnless{color:var(--muted)}
.is-320 .scroll{padding-inline:12px}
.is-320 .intro h1,.is-320 .headline h1{font-size:22px}
.is-320 .res-big b{font-size:40px}
.is-320 .primary{block-size:56px}
.is-320 .ghost{block-size:48px;font-size:15px}
.is-320 .c-row .v b{font-size:20px}.is-320 .c-row.key .v b{font-size:24px}
.is-320 .c-row{grid-template-columns:1fr 84px 1fr;min-block-size:52px}
.is-320 .tb-title{font-size:20px}
/* timeline */
.tl-sum{padding:4px 16px 0;display:flex;flex-direction:column;gap:6px;font:500 14px Rubik;color:var(--muted)}
.ticks{display:flex;gap:3px;align-items:flex-end;block-size:14px}
.ticks i{flex:1;block-size:6px;border-radius:2px;background:var(--track)}
.ticks i.s{block-size:14px;background:var(--split)}
.seg{display:flex;gap:8px;padding:10px 16px}
.segb{flex:1;block-size:48px;border-radius:14px;background:transparent;border:1px solid var(--border);color:var(--text);font:700 15px Rubik;display:flex;gap:6px;align-items:center;justify-content:center}
.segb.on{background:var(--s2);box-shadow:inset 0 0 0 2px var(--text);border-color:transparent}
.tl-heads{display:grid;grid-template-columns:1fr 64px 1fr;padding:0 16px 6px;align-items:center;text-align:center;font:700 15px Rubik}
.tl-heads div{display:flex;align-items:center;justify-content:center;gap:6px}
.tl-heads span{font:500 12px Rubik;color:var(--muted)}
.tl{list-style:none;padding:0 16px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.tl-row{display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;min-block-size:56px;border-radius:14px;position:relative;padding:4px 0}
.tl-row .lane{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;color:var(--muted)}
.tl-row .lane b{font:500 14px Rubik}
.tl-row .lane small{font:400 12px Rubik}
.tl-row.split{background:var(--split-tint);box-shadow:inset -3px 0 0 var(--split)}
.tl-row.split .lane{color:var(--text)}
.tl-row.split .lane b{font-weight:700;font-size:15px}
.tl-row .spine{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--muted)}
.tl-row .tn{font:800 17px Rubik;color:var(--text);font-variant-numeric:tabular-nums}
.tl-row .why.muted{color:var(--muted);font-weight:500}
.tl-row .why{grid-column:1/-1;display:flex;gap:6px;align-items:center;justify-content:center;font:700 13px Rubik;color:var(--split);padding:2px 0 6px}
/* family board */
.week{padding:2px 16px 8px;font:700 15px Rubik;color:var(--text)}
.week span{display:block;font:400 13px Rubik;color:var(--muted)}
.fb{list-style:none;background:var(--surface);border:1px solid var(--border);border-radius:22px;overflow:hidden}
.fb li{display:flex;align-items:center;gap:10px;min-block-size:64px;padding:8px 12px;border-block-end:1px solid var(--border)}
.fb li:last-child{border:0}
.fb li.me{background:var(--s2)}
.fb .rk{inline-size:28px;font:800 18px Rubik;display:flex;flex-direction:column;align-items:center;font-variant-numeric:tabular-nums}
.fb .rk svg{color:var(--muted);margin-block-end:-2px}
.fb .nm{flex:1;display:flex;flex-direction:column}
.fb .nm b{font:700 16px Rubik}
.fb .nm small,.fb .rs small{font:400 13px Rubik;color:var(--muted)}
.fb .rs{display:flex;flex-direction:column;align-items:center;min-inline-size:56px}
.fb .rs b{font:800 20px Rubik;font-variant-numeric:tabular-nums}
/* hud */
.hud{margin:10px 8px 0;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:8px 10px;display:flex;align-items:center;gap:8px}
.hud-col{display:flex;flex-direction:column;gap:2px}
.hud-line{display:flex;align-items:center;gap:6px;font:500 12px Rubik;color:var(--muted)}
.ch-chip{position:relative;display:inline-flex;align-items:center;gap:4px;block-size:24px;padding:0 8px;border-radius:12px;background:transparent;border:1px solid var(--bstrong);color:var(--text);font:700 12px Rubik}
.ch-chip::after{content:"";position:absolute;inset:-12px -6px}
.cash{display:flex;align-items:center;gap:6px}.cash b{font:900 26px Rubik;font-variant-numeric:tabular-nums;direction:ltr}
.compact .cash b{font-size:22px}
.grow{flex:1}
.pop{margin:8px 16px 0;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;font:400 13px/1.4 Rubik;color:var(--muted);box-shadow:0 12px 28px rgb(0 0 0/.3)}
.pop b{display:flex;gap:6px;align-items:center;font:700 14px Rubik;color:var(--text)}
`;

const introA = { name: 'נועה', prof: 'teacher', profName: 'מורה', mode: 'משפחה', modeLong: 'משחק משפחתי', turns: 23, verified: true };
const sec = (t, items) => `<h3 class="sec">${t}</h3><div class="sheet">${items.join('')}</div>`;
const rowsWin = [
  { key: 1, label: 'תורות עד חופש כלכלי', me: '20', them: '23', best: 'me' },
  { label: 'חופש כלכלי', me: '100%', them: '100%', meBar: 100, themBar: 100 },
  { label: 'עסקאות שנקנו', me: '6', them: '4' },
  { label: 'הלוואות מהבנק', me: '1', meSub: '₪50,000', them: '—', themSub: 'בלי הלוואות' },
];
const html = `<!doctype html><html lang="he"><meta charset="utf-8"><style>${CSS}</style><body>
${sec('0.5.1 challenge intro (section 2) · strings from docs/v051/challenge.he.json', [
  phone({ w: 390, h: 844, theme: 'dark', label: 'A · Intro · dark · 390x844 · named, family, won, verified', body: intro(introA) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'B · Intro · light · 360x800 · no name, full, did not finish (64%)', body: intro({ prof: 'lawyer', profName: 'עורך/ת דין', mode: 'מלא', modeLong: 'משחק מלא', pct: 64, verified: true }) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'C · Intro · dark · 360x800 · invalid link', body: introError() }),
  phone({ w: 320, h: 568, theme: 'light', label: 'D · Intro · light · 320x568 · junior (kid words, coin chip)', body: intro({ name: 'יואב', prof: 'cook', profName: 'טבח/ית', mode: 'משפחה', junior: true, turns: 26, verified: true, kid: true, bustH: 72 }) }),
])}
${sec('0.5.1 compare (section 4)', [
  phone({ w: 390, h: 844, theme: 'dark', label: 'E · Compare · dark · 390x844 · I am ahead, both verified', body: compare({ headline: 'הפעם הגעתם לחופש מהר יותר', sub: 'כל הכבוד. בצפייה החוזרת רואים מה היה שונה.', them: 'נועה', meProf: 'nurse', themProf: 'teacher', verified: true, rows: rowsWin, fox: 'celebrate', takeaway: 'בתור 6 קניתם את ״דירת 2 חדרים״: עוד ₪1,200 בחודש לתזרים. בכל סיכום שנתי זה כפול 12.' }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'F · Compare · light · 360x800 · they are ahead, I did not finish', body: compare({ headline: 'הפעם המסלול אצל נועה היה מהיר יותר', sub: 'בואו נראה איפה ההחלטות נפרדו. מכל הבדל לומדים משהו.', them: 'נועה', meProf: 'nurse', themProf: 'teacher', verified: true, fox: 'think',
    rows: [{ key: 1, label: 'תורות עד חופש כלכלי', me: 'עוד לא', them: '23', best: 'them' }, { label: 'חופש כלכלי', me: '71%', them: '100%', meBar: 71, themBar: 100 }, { label: 'עסקאות שנקנו', me: '3', them: '5' }, { label: 'הלוואות מהבנק', me: '2', meSub: '₪80,000', them: '1', themSub: '₪30,000' }],
    takeaway: 'בתור 4 דילגתם על ״עגלת קפה״. תקופת ההחזר של העסקה: 3 שנים, כלומר המקדמה חוזרת מהר יחסית.' }) }),
  phone({ w: 320, h: 568, theme: 'dark', label: 'G · Compare · dark · 320x568 · their result NOT verified', body: compare({ headline: 'הנה שתי התוצאות', sub: 'את התוצאה מהקישור לא הצלחנו לבדוק, ולכן אין כאן מנצח.', them: 'אורי', meProf: 'programmer', themProf: 'police', verified: false, fox: 'ponder',
    rows: [{ key: 1, label: 'תורות עד חופש', me: '21', them: '9' }, { label: 'חופש כלכלי', me: '100%', them: '100%', meBar: 100, themBar: 100 }, { label: 'עסקאות', me: '5', them: '?' }, { label: 'הלוואות', me: '1', them: '?' }],
    takeaway: 'במשחק המספרים מפושטים, ובאתגר המזל זהה לשניכם. בחיים אי אפשר לשחק שוב עם אותו מזל בדיוק.' }) }),
  phone({ w: 390, h: 844, theme: 'light', label: 'H · Compare · light · 390x844 · junior (kid words, coins, loans as a count only)', body: compare({ kid: true, headline: 'הגעתם לחופש מהר יותר! כל הכבוד', sub: 'כל הכבוד. בצפייה החוזרת רואים מה היה שונה.', them: 'יואב', meProf: 'driver', themProf: 'cook', verified: true, fox: 'celebrate',
    rows: [{ key: 1, label: 'תורות עד החופש', me: '24', them: '26', best: 'me' }, { label: 'כמה קרוב לחופש', me: '100%', them: '100%', meBar: 100, themBar: 100 }, { label: 'נכסים שנקנו', me: '4', them: '3' }, { label: 'הלוואות', me: '0', them: '1' }],
    takeaway: `בתור 5 קניתם את ״דוכן פלאפל״: מאז נכנסים לכם עוד ${COIN} 9 מטבעות בכל חודש.` }) }),
])}
${sec('Extras: HUD chip (3), replay (5), family board (6)', [
  phone({ w: 390, h: 200, theme: 'dark', label: 'I · HUD chip · dark · 390 · slim HUD + tap popover', body: hud(false) }),
  phone({ w: 320, h: 180, theme: 'light', label: 'J · HUD chip · light · 320 · compact, icon-only chip', body: hud(true) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'K · Replay timeline · dark · 360x800 · all turns', body: timeline() }),
  phone({ w: 360, h: 800, theme: 'light', label: 'L · Family board · light · 360x800', body: board(false) }),
  phone({ w: 320, h: 568, theme: 'dark', label: 'M · Family board · dark · 320x568 · empty', body: board(true) }),
])}
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'maxifox-mocks-'));
const file = join(dir, 'mocks.html');
writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`file://${file}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const out = process.argv[2] || 'docs/v051/design/challenges-contact-sheet.png';
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out, 'html', file);
