// Renders the 0.5.0 career mocks (docs/v050/design/career-spec.md) into one contact sheet PNG.
// Static HTML mocks with the real tokens, Rubik, the profession foxes, the fox poses, the logo and the new icons in src/assets/career/.
// Run from the repo root:  node docs/v050/design/render-mocks.mjs   ->  docs/v050/design/career-contact-sheet.png
// Every Hebrew string here is a PLACEHOLDER (spec section 10): the educator replaces the words, the layout stays.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const A = (p) => `file://${join(ROOT, 'src/assets', p)}`;
const sized = (s, size) => s.trim().replace('width="24" height="24"', `width="${size}" height="${size}"`);
const cr = (name, size = 24) => sized(readFileSync(join(ROOT, 'src/assets/career', `${name}.svg`), 'utf8'), size);
const ICONS = readFileSync(join(ROOT, 'src/ui/icons.js'), 'utf8');
const ic = (name, size = 24, w = 2) => {
  const m = ICONS.match(new RegExp(`^  ${name}: '(.*)',$`, 'm'));
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${m ? m[1] : ''}</svg>`;
};
const X = ic('close', 22, 2.2);
const BACK = `<span style="display:grid;transform:scaleX(-1)">${ic('arrow', 22, 2.4)}</span>`;
const GO = ic('arrow', 22, 3);
const CHECK = ic('check', 16, 2.8);
const COIN = `<img src="${A('coin-small.svg')}" width="16" height="16" alt="" style="vertical-align:-3px">`;
const font = (w) => `@font-face{font-family:Rubik;font-weight:${w};src:url(file://${ROOT}/node_modules/@fontsource/rubik/files/rubik-hebrew-${w}-normal.woff2) format('woff2');unicode-range:U+0590-05FF,U+20AA,U+200C-2010}
@font-face{font-family:Rubik;font-weight:${w};src:url(file://${ROOT}/node_modules/@fontsource/rubik/files/rubik-latin-${w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}`;

const m = (n, sign = '') => `<bdi class="money" dir="ltr">${sign}<span class="cur">₪</span>${n.toLocaleString('en-US')}</bdi>`;
const coins = (n, sign = '') => `<bdi class="money" dir="ltr">${sign}${COIN}${n}</bdi>`;
const head = (id, s = 44, cls = '') => `<img class="head ${cls}" src="${A(`profession-fox/${id}-head@2x.webp`)}" width="${s}" height="${s}" alt="">`;
const xp = (pct, cls = '', ghost = null) => `<div class="xp ${cls}">${ghost != null ? `<u style="inline-size:${ghost}%"></u>` : ''}<i style="inline-size:${pct}%"></i></div>`;
const rank = (r, title, size = 14) => `<span class="rk">${cr(`rank-${r}`, size)}<span>${title}</span></span>`;
const x2 = `<span class="x2">${cr('promo-week', 12)}<bdi dir="ltr">×2</bdi></span>`;

function phone({ w, h, theme, label, body, cls = '' }) {
  return `<figure><div class="phone t-${theme} ${cls} ${w <= 320 ? 'is-320' : ''}" style="width:${w}px;height:${h}px">${body}</div><figcaption>${label}</figcaption></figure>`;
}

// placeholder ladder (the educator owns the titles)
const TITLES = {
  teacher: ['מורה', 'מחנך/ת כיתה', 'רכז/ת שכבה', 'מנהל/ת בית ספר'],
  engineer: ['מהנדס/ת', 'מהנדס/ת בכיר/ה', 'ראש צוות', 'מנהל/ת פרויקטים'],
  driver: ['נהג/ת מונית', 'נהג/ת ותיק/ה', 'בעל/ת מונית', 'בעל/ת תחנה'],
  nurse: ['אח/ות', 'אח/ות מוסמך/ת', 'אח/ות אחראי/ת', 'מנהל/ת סיעוד'],
  programmer: ['מפתח/ת תוכנה', 'מפתח/ת בכיר/ה', 'ראש צוות', 'ארכיטקט/ית'],
  police: ['שוטר/ת', 'סייר/ת בכיר/ה', 'מפקד/ת צוות', 'מפקד/ת תחנה'],
  cook: ['טבח/ית', 'טבח/ית קו', 'סו-שף', 'שף'],
  lawyer: ['עורך/ת דין', 'עו״ד בכיר/ה', 'שותף/ה', 'שותף/ה מנהל/ת'],
};
const NAMES = { teacher: 'מורה', engineer: 'מהנדס/ת', driver: 'נהג/ת מונית', nurse: 'אח/ות', programmer: 'מפתח/ת תוכנה', police: 'שוטר/ת', cook: 'טבח/ית', lawyer: 'עורך/ת דין' };

// ---------- a. Profession screen ----------
function pick(o) {
  const P = [
    ['teacher', 2, 62, 11400, 9300, true], ['engineer', 1, 20, 14200, 11900], ['driver', 0, 45, 8200, 7100], ['nurse', 1, 0, 11100, 8800],
    ['police', 0, 0, 9300, 7900], ['programmer', 0, 80, 13500, 11100],
  ];
  const cards = P.map(([id, r, pct, sal, exp, promo]) => `
    <div class="prof ${promo ? 'promo' : ''}">
      <div class="well">${promo ? x2 : ''}<img src="${A(`profession-fox/${id}@2x.webp`)}" alt=""></div>
      <b class="pname">${NAMES[id]}</b>
      <div class="career-row">${rank(r, TITLES[id][r])}</div>
      ${xp(pct)}
      <div class="prow"><small>שכר</small><b>${m(sal)}</b><small>•</small></div>
      <div class="prow sub"><small>הוצאות</small><b>${m(exp)}</b></div>
      <div class="pocket">נשאר בכיס ${m(sal - exp)}</div>
    </div>`).join('');
  return `
  <header class="pick-top"><div><h1>בחרו מקצוע</h1><p>השועל שלכם מתלבש בהתאם</p></div><button class="iconbtn" aria-label="חזרה">${BACK}</button></header>
  <div class="strip">
    <p>${cr('promo-week', 16)}<span>שבוע קידום: <b>מורה</b> · ניסיון כפול</span></p>
    ${o.warn ? `<p class="warn">${cr('seniority-due', 16)}<span>נשארו 3 ימים לשמור על הוותק</span></p>` : ''}
  </div>
  <div class="grid">${cards}</div>`;
}
function pickSheet(o) {
  const r = o.sel; const sal = [8800, 10200, 11400, 12900][r]; const exp = [7310, 8400, 9300, 10600][r];
  const chips = [0, 1, 2, 3].map((i) => `<button class="rchip ${i === r ? 'on' : ''} ${i > o.cur ? 'locked' : ''}" ${i > o.cur ? 'disabled' : ''}>${i > o.cur ? cr('achievement-locked', 18) : cr(`rank-${i}`, 20)}<span>דרגה ${i + 1}</span></button>`).join('');
  return `
  <div class="under">${pick({})}</div><div class="scrim"></div>
  <section class="sheet">
    <i class="handle"></i>
    <div class="sh-scroll">
      <div class="sh-head"><img src="${A('profession-fox/teacher@2x.webp')}" alt=""><div><h2>${TITLES.teacher[r]}</h2><p>${m(sal)} לחודש</p></div></div>
      <div class="rank-pick">
        <div class="rp-top"><span>דרגת פתיחה</span>${r < o.cur ? '<small>שיחקתם כבר בדרגה גבוהה יותר</small>' : '<small>הדרגה שלכם</small>'}</div>
        <div class="rchips" role="radiogroup">${chips}</div>
        <div class="rp-xp"><span>${o.cur < 3 ? `עוד <bdi dir="ltr">115</bdi> ניסיון ל${TITLES.teacher[o.cur + 1]}` : 'הדרגה הגבוהה ביותר'}</span>${xp(62, 'lg')}</div>
        <p class="rp-note">דרגה גבוהה היא התחלה קשה יותר: משכורת גבוהה יותר, וגם הוצאות ויעד גבוהים יותר.</p>
      </div>
      <p class="banner promo">${cr('promo-week', 20)}<span><b>שבוע קידום למורה.</b> השבוע כל משחק במקצוע הזה נותן ניסיון כפול.</span></p>
      <div class="st"><div class="st-row inc"><span>משכורת</span>${m(sal)}</div><div class="st-row"><span>חסכונות</span>${m(9000)}</div></div>
      <div class="st"><div class="st-row tot"><span>סך ההוצאות</span>${m(exp)}</div></div>
      <div class="st-row tot flow"><span>תזרים התחלתי</span>${m(sal - exp, '+')}</div>
    </div>
    <div class="sh-cta"><button class="btn primary">יוצאים לדרך</button></div>
  </section>`;
}

// ---------- b. Home ----------
function home(o) {
  const st = { kept: `${cr('seniority', 18)}<span>ותק</span>`, open: `<span class="mut">${cr('seniority', 18)}</span><span class="mut">ותק</span>`, warn: `<span class="days">${o.w >= 390 ? cr('seniority-due', 14) : ''}3 ימים</span>`, junior: '<span class="nm">יואב</span>' }[o.state];
  const badge = { kept: `<i class="bdg">${ic('check', 12, 3.4)}</i>`, warn: '<i class="bdg warn">3</i>' }[o.state] || '';
  const chip = o.w <= 320
    ? `<button class="cchip mini" aria-label="הפרופיל של נועה. נשארו 3 ימים לשמור על הוותק">${head(o.fox || 'teacher', 40)}${badge}</button>`
    : `<button class="cchip ${o.state}" aria-label="הפרופיל של נועה">${head(o.fox || 'teacher', 36)}${st}</button>`;
  const sky = `<svg class="sky" viewBox="0 0 360 800" preserveAspectRatio="xMidYMax slice"><g fill="currentColor" opacity=".8"><circle cx="34" cy="64" r="1.6"/><circle cx="160" cy="88" r="1.8"/><circle cx="236" cy="150" r="1.3"/><circle cx="310" cy="82" r="1.7"/><circle cx="70" cy="140" r="1.2"/></g></svg>`;
  return `${sky}
  <div class="h-top">${chip}<div class="h-actions">${['book', 'help', 'familyBoard', 'gear'].map((n) => `<button class="iconbtn">${ic(n, 24)}</button>`).join('')}</div></div>
  <div class="h-hero"><img class="logo" src="${A('brand/maxifox-logo-alpha-2x.webp')}" alt=""><p class="tagline">הכסף עובד בשבילכם. אתם רק צריכים להתחיל.</p></div>
  <div class="h-bottom">
    ${o.state === 'warn' && o.h >= 700 ? `<p class="h-warn">${cr('seniority-due', 16)}<span>נשארו 3 ימים לשמור על הוותק</span></p>` : ''}
    <div class="modes"><button class="mode on"><b>משפחה</b><small>מגיל 9 · דירות ועסקים</small><i>${CHECK}</i></button><button class="mode"><b>מלא</b><small>מניות, מכירה והלוואות</small></button></div>
    <button class="daily"><span class="d-ic">${ic('star', 22, 2.4)}</span><span class="d-tx"><b>אתגר יומי · <bdi dir="ltr">12.11</bdi></b><small>לא שוחק היום</small></span>${GO}</button>
    <button class="btn ghost h-miss">משימות קצרות · בוחרים ומתרגלים</button>
    <button class="btn primary h-start">התחילו משחק ${GO}</button>
  </div>`;
}

// ---------- c. End of game ----------
function careerBlock(o) {
  return `<section class="cblock">
    <div class="cb-main">
      <span class="cb-av">${head(o.prof, 44)}<i class="cb-rk">${cr(`rank-${o.rank}`, 14)}</i></span>
      <div class="cb-col">
        <div class="cb-line"><b>${TITLES[o.prof][o.rank]}</b><span class="gain"><bdi dir="ltr">+${o.gain}</bdi> ניסיון</span></div>
        ${xp(o.to, 'lg', o.from)}
        <div class="cb-sub"><span>${o.parts}</span>${o.promo ? x2 : ''}</div>
      </div>
    </div>
    ${o.kept ? `<p class="cb-kept">${cr('seniority', 16)}<span>${o.kept}</span></p>` : ''}
  </section>`;
}
function win(o) {
  return `
  <div class="end-hero"><img class="hammock" src="${A('fox/hammock@2x.webp')}" alt=""><h1 class="t-win">חופש כלכלי!</h1><p class="tagline">הכסף שעובד בשבילכם עקף את ההוצאות</p></div>
  <div class="end-card">
    <div class="cmpr"><div><small>כסף שעובד</small><b class="inc">${m(9650)}</b></div><div class="end"><small>הוצאות</small><b class="mid">${m(9300)}</b></div></div>
    <div class="meter"><i style="inline-size:100%"></i></div>
    <div class="stats"><div><b>21</b><small>תורות</small></div><div><b>6</b><small>נכסים</small></div><div><b>1</b><small>ילדים</small></div></div>
    ${careerBlock(o.career)}
  </div>
  <div class="end-actions"><button class="btn primary">${ic('challenge', 24)}שלחו אתגר</button><div class="row2"><button class="btn ghost">שחקו שוב</button><button class="btn ghost">${ic('book', 20, 2.4)}מה למדתי</button></div><button class="btn text">שנו מצב או מקצוע</button></div>`;
}
function over(o) {
  return `
  <div class="end-hero"><img class="tired" src="${A('fox/tired@2x.webp')}" alt=""><h1 class="t-over">הפעם זה לא הסתדר</h1><p class="tagline">קורה לכולם. בפעם הבאה תדעו יותר.</p></div>
  <div class="end-card">
    <p class="cause">ההוצאות עלו על ההכנסות, והבנק לא נותן עוד הלוואות.</p>
    <div class="stats"><div><b>17</b><small>תורות</small></div><div><b>5</b><small>משכורות</small></div><div><b>2</b><small>עסקאות</small></div></div>
    ${careerBlock(o.career)}
  </div>
  <div class="end-actions"><button class="btn primary">ננסה שוב</button><div class="row2"><button class="btn ghost">${ic('challenge', 20)}שלחו אתגר</button><button class="btn ghost">${ic('book', 20, 2.4)}מה למדתי</button></div><button class="btn text">חזרה לתפריט</button></div>`;
}
function rankUp(o) {
  return `
  <div class="under">${win({ career: { prof: 'teacher', rank: 2, from: 0, to: 12, gain: 240, parts: 'סיום משחק 100 · הישג 20', promo: true } })}</div><div class="scrim solid"></div>
  <section class="dialog">
    <div class="ru-fox"><i class="halo"></i><img src="${A('fox/celebrate.webp')}" alt=""></div>
    <p class="kick">עליתם דרגה</p>
    <h1>${TITLES.teacher[2]}</h1>
    <div class="ru-ladder">${[0, 1, 2, 3].map((i) => `<span class="${i < 2 ? 'done' : i === 2 ? 'now' : ''}">${cr(`rank-${i}`, 20)}</span>`).join('<i></i>')}</div>
    <p class="ru-text">${o.kid ? 'בדרגה החדשה מתחילים עם משכורת גדולה יותר, וגם עם יותר הוצאות. אתגר חדש!' : 'מהמשחק הבא אפשר להתחיל כאן: משכורת גבוהה יותר, וגם הוצאות ויעד גבוהים יותר. אתגר חדש, לא משחק קל יותר.'}</p>
    <button class="btn primary">מעולה</button>
  </section>`;
}

// ---------- d. Return after absence ----------
function back(o) {
  const rows = o.kind === 'reset' ? [['teacher', 2, 62], ['engineer', 1, 20], ['driver', 0, 45]].map(([id, r, was]) => `
      <li>${head(id, 40)}<div class="bk-col"><b>${NAMES[id]}</b>${rank(r, TITLES[id][r], 14)}<div class="bk-bar">${xp(0, '', was)}<small>ההתקדמות התאפסה</small></div></div></li>`).join('')
    : o.kind === 'drop' ? [['teacher', 2], ['engineer', 1], ['nurse', 1]].map(([id, r]) => `
      <li>${head(id, 40)}<div class="bk-col"><b>${NAMES[id]}</b><div class="bk-move"><span class="was">${rank(r, TITLES[id][r], 14)}</span><span class="arr">${ic('arrow', 14, 2.6)}</span>${rank(r - 1, TITLES[id][r - 1], 14)}</div></div></li>`).join('')
      : [['cook', 1, 40], ['driver', 0, 70]].map(([id, r, pct]) => `
      <li>${head(id, 40)}<div class="bk-col"><b>${NAMES[id]}</b>${rank(r, TITLES[id][r], 14)}${xp(pct)}</div></li>`).join('');
  const T = {
    reset: ['טוב שחזרתם', 'עבר שבוע שלם בלי משחק שהסתיים, ולכן ההתקדמות לדרגה הבאה התאפסה בכל המקצועות.', 'הדרגות עצמן נשארו כמו שהיו.', 'משחק אחד בשבוע שומר על הוותק.', 'שחקו עכשיו'],
    drop: ['טוב שחזרתם', 'עברו שבועיים בלי משחק שהסתיים, ולכן כל מקצוע ירד דרגה אחת, וההתקדמות התאפסה.', 'התארים שהשגתם נשארים בפרופיל שלכם.', 'משחק אחד בשבוע שומר על הוותק.', 'שחקו עכשיו'],
    junior: ['הקריירה חיכתה לכם', 'לא שיחקתם כמה זמן, והכול נשאר בדיוק כמו שהשארתם.', '', '', 'בואו נשחק'],
  }[o.kind];
  return `
  <header class="topbar"><span class="grow"></span><button class="iconbtn" aria-label="לדף הבית">${X}</button></header>
  <main class="bk">
    <img class="bk-fox" src="${A('fox/wave@2x.webp')}" alt="">
    <h1>${T[0]}</h1>
    <p class="bk-what">${T[1]}</p>
    <ul class="bk-list">${rows}</ul>
    ${o.kind === 'reset' ? '<p class="bk-more">ועוד 2 מקצועות</p>' : o.kind === 'drop' ? '<p class="bk-more">מקצועות בדרגה הראשונה נשארו במקומם</p>' : ''}
    ${T[2] ? `<p class="bk-keep">${ic('check', 16, 2.8)}<span>${T[2]}</span></p>` : ''}
  </main>
  <footer class="foot">${T[3] ? `<p class="bk-rule">${cr('seniority', 16)}<span>${T[3]}</span></p>` : ''}<button class="btn primary">${T[4]}</button></footer>`;
}

// ---------- e. Promotion card ----------
function promo(o) {
  const k = o.mode === 'junior'; const f = o.mode === 'family';
  const $ = (n, s) => (k ? coins(n / 100, s) : m(n, s));
  const raise = k || f ? 1500 : 1650; const cost = k || f ? 1200 : 1300; const perk = k || f ? 3000 : 3500;
  const opt = (label, cash, mon, bar, legend) => `
    <li class="dec"><b>${label}</b>
      <div class="nums"><span><small>מזומן</small> ${cash}</span><span><small>בחודש</small> ${mon}</span></div>
      <div class="rbar">${bar}</div><div class="rleg">${legend}</div></li>`;
  return `
  <div class="scrim solid"></div>
  <section class="pcard ${f || k ? 'fam' : ''}">
    <div class="pc-scroll">
      <div class="pc-head"><span class="tchip">${ic('payday', 18)}משכורת</span><span class="kicker2">קידום בעבודה</span></div>
      <h1>${k ? 'קיבלתם קידום!' : 'קיבלתם קידום'}</h1>
      <p class="pc-text">${k ? `המשכורת שלכם גדלה ב-${$(raise)} בכל חודש. מה עושים עם התוספת?` : `המשכורת עולה ב-${$(raise)} בחודש. מה עושים עם התוספת?`}</p>
      <p class="choose">מה בוחרים?</p>
      <ul class="decs">
        ${opt(k ? 'חיים כמו קודם' : 'ממשיכים לחיות כמו קודם', '<span class="none">בלי שינוי</span>', $(raise, '+'), '<i class="keep" style="inline-size:100%"></i>', `<span><i class="sw keep"></i>כל התוספת נשארת לכם</span>`)}
        ${opt(k ? 'קונים דברים חדשים' : 'משדרגים את רמת החיים', $(perk, '+'), $(raise - cost, '+'), `<i class="keep" style="inline-size:${Math.round((raise - cost) / raise * 100)}%"></i><i class="spend" style="flex:1"></i>`, `<span><i class="sw keep"></i>נשאר לכם ${$(raise - cost)}</span><span><i class="sw spend"></i>הוצאה חדשה ${$(cost)}</span>`)}
      </ul>
      <p class="teach"><b>מה זה מלמד:</b> ${k ? 'כשמרוויחים יותר, קל גם להוציא יותר. מה שנשאר אצלכם הוא מה שקונה נכסים.' : 'כשההכנסה עולה, קל להעלות גם את ההוצאות. מה שנשאר בכיס בכל חודש הוא מה שקונה נכסים.'}</p>
    </div>
    <div class="pc-actions"><button class="btn opt">${k ? 'חיים כמו קודם' : 'ממשיכים לחיות כמו קודם'}</button><button class="btn opt">${k ? 'קונים דברים חדשים' : 'משדרגים את רמת החיים'}</button></div>
  </section>`;
}

// ---------- f. Profiles ----------
function picker(o) {
  const L = [['teacher', 'נועה', '14+', 2], ['cook', 'יואב', 'עד 10', 1], ['programmer', 'אבא', '14+', 0]].slice(0, o.n || 3);
  return `
  <header class="topbar"><h2 class="tb-title">מי משחק?</h2><button class="iconbtn" aria-label="סגירה">${X}</button></header>
  <main class="pk">
    <div class="pk-grid">${L.map(([id, n, age, r], i) => `<button class="pk-tile ${i === 0 ? 'on' : ''}">${head(id, 72)}<b>${n}</b><span class="pk-meta"><bdi dir="ltr" class="age">${age}</bdi>${cr(`rank-${r}`, 14)}</span>${i === 0 ? `<i class="pk-check">${CHECK}</i>` : ''}</button>`).join('')}
      <button class="pk-tile add"><span class="pk-plus">${ic('plus', 28, 2.4)}</span><b>פרופיל חדש</b><span class="pk-meta">עד 4 במכשיר</span></button></div>
    <p class="fine">הפרופילים נשמרים רק במכשיר הזה.</p>
  </main>`;
}
const ACH = [['עסקה ראשונה', 1], ['ניצחון בלי הלוואה', 1], ['5 עסקאות פח זוהו', 1], ['25% חופש לפני תור 10', 0], ['חוב יקר הוחזר קודם', 1], ['החזר בפחות מ-8 שנים', 0], ['תרומה ראשונה', 1], ['3 מקצועות שונים', 0], ['קידום בלי שדרוג', 0]];
function profile(o) {
  const sen = o.junior
    ? `<section class="sen"><div class="sen-top"><span class="sen-t">${cr('seniority-wait', 20)}ותק</span></div><p class="sen-rule">אצלכם שום דבר לא הולך לאיבוד. הקריירה תמיד מחכה לכם.</p></section>`
    : `<section class="sen ${o.warn ? 'warn' : ''}">
      <div class="sen-top"><span class="sen-t">${cr(o.warn ? 'seniority-due' : 'seniority', 20)}ותק</span><span class="sen-st">${o.warn ? 'נשארו 3 ימים לשמור על הוותק' : `${ic('check', 14, 3)}נשמר השבוע`}</span></div>
      <div class="week">${['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d, i) => `<span class="${i === 4 ? 'today' : i < 4 ? 'past' : ''} ${!o.warn && i === 2 ? 'played' : ''}">${!o.warn && i === 2 ? ic('check', 14, 3) : d}</span>`).join('')}</div>
      <p class="sen-rule">משחק אחד שמסתיים בכל שבוע (ראשון עד שבת) שומר על הכול. שבוע בלי משחק: ההתקדמות לדרגה הבאה מתאפסת. שבועיים ברצף: כל מקצוע יורד דרגה אחת.</p></section>`;
  const R = [['teacher', 2, 62, 0], ['engineer', 1, 20, 2], ['driver', 0, 45, 0], ['nurse', 1, 0, 0]];
  const ranks = `<section class="sec"><div class="sec-h"><h3>דרגות</h3><small>8 מקצועות</small></div><ul class="rl">${R.slice(0, o.rows || 4).map(([id, r, pct, was]) => `
      <li>${head(id, 40)}<div class="rl-col"><div class="rl-top"><b>${NAMES[id]}</b><span class="pips">${[0, 1, 2, 3].map((i) => `<span class="${i <= r ? 'done' : i <= was ? 'hist' : ''}">${cr(`rank-${i}`, 14)}</span>`).join('')}</span></div>
        ${rank(r, TITLES[id][r], 14)}${xp(pct)}${was > r ? `<small class="hist-l">הגעתם בעבר: ${TITLES[id][was]}</small>` : ''}</div></li>`).join('')}</ul></section>`;
  const ach = `<section class="sec"><div class="sec-h"><h3>הישגים</h3><small><bdi dir="ltr">5</bdi> מתוך <bdi dir="ltr">12</bdi></small></div><div class="ag">${ACH.slice(0, o.ach || 9).map(([t, e]) => `<button class="at ${e ? 'on' : 'off'}"><span class="am">${cr(e ? 'achievement-earned' : 'achievement-locked', 26)}</span><span class="al">${t}</span></button>`).join('')}</div></section>`;
  return `
  <header class="topbar"><button class="iconbtn" aria-label="חזרה">${BACK}</button><h2 class="tb-title grow">הפרופיל</h2><button class="btn text sm">עריכה</button></header>
  <main class="pf">
    <div class="pf-head">${head(o.fox, 64)}<div><h1>${o.name}</h1><div class="chips"><span class="chip"><bdi dir="ltr">${o.age}</bdi></span><span class="chip">${COIN} <bdi dir="ltr">12</bdi> משחקים</span></div></div></div>
    ${o.order === 'ach' ? `${sen}${ach}${ranks}` : `${sen}${ranks}${ach}`}
    <button class="btn text">החלפת פרופיל</button>
  </main>`;
}
function editSheet() {
  return `
  <div class="under">${profile({ name: 'נועה', fox: 'teacher', age: '14+' })}</div><div class="scrim"></div>
  <section class="sheet tall">
    <i class="handle"></i>
    <div class="sh-scroll">
      <div class="sh-title"><h2>עריכת פרופיל</h2><button class="iconbtn" aria-label="סגירה">${X}</button></div>
      <label class="fld"><span>שם</span><div class="inp"><b>נועה</b><small><bdi dir="ltr">4/12</bdi></small></div><small>השם נשמר רק במכשיר הזה</small></label>
      <div class="fld"><span>גיל</span><div class="achips"><button class="achip"><bdi dir="ltr">עד 10</bdi></button><button class="achip"><bdi dir="ltr">11–13</bdi></button><button class="achip on"><bdi dir="ltr">14+</bdi></button></div></div>
      <div class="fld"><span>השועל שלי</span><div class="fgrid">${Object.keys(NAMES).map((id, i) => `<button class="fx ${i === 0 ? 'on' : ''}" aria-label="${NAMES[id]}">${head(id, 48)}${i === 0 ? `<i>${ic('check', 12, 3.4)}</i>` : ''}</button>`).join('')}</div></div>
    </div>
    <div class="sh-cta"><button class="btn primary">שמירה</button><button class="btn text">מחיקת הפרופיל</button></div>
  </section>`;
}
function achSheet() {
  return `
  <div class="under">${profile({ name: 'נועה', fox: 'teacher', age: '14+', order: 'ach' })}</div><div class="scrim"></div>
  <section class="sheet">
    <i class="handle"></i>
    <div class="sh-scroll ctr">
      <span class="am big off">${cr('achievement-locked', 36)}</span>
      <h2>25% חופש לפני תור 10</h2>
      <p class="lede">הגיעו לרבע מהדרך לחופש כלכלי לפני התור העשירי. נכס מוקדם עובד בשבילכם יותר זמן.</p>
      <div class="chips"><span class="chip">עוד לא הושג</span><span class="chip"><bdi dir="ltr">+40</bdi> ניסיון</span></div>
    </div>
    <div class="sh-cta"><button class="btn ghost full">סגירה</button></div>
  </section>`;
}

const CSS = `${[400, 500, 700, 800, 900].map(font).join('\n')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#5b6170;font-family:Rubik,sans-serif;padding:24px}
h3.secT{color:#fff;font:800 22px Rubik;margin:8px 0 12px}
.sheetrow{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;margin-block-end:24px}
figure{display:flex;flex-direction:column;gap:8px}
figcaption{color:#fff;font:500 14px Rubik;direction:ltr;max-width:360px}
.t-dark{--bg:#0F172A;--surface:#182238;--s2:#212D48;--text:#F5F7FC;--muted:#A9B5D0;--border:rgb(255 255 255/.14);--bstrong:#8A97B8;--income:#5FE0AE;--btnb:#7C89AB;--passive:#35D6B0;--track:rgb(255 255 255/.10);--sel:#F5F7FC;
  --career:#F59A5B;--career-fill:#E8702A;--career-tint:rgb(245 154 91/.14);--amber:#FFD27A;--amber-fill:rgb(246 196 83/.16);--scrim:rgb(4 8 20/.88);--sky:#fff;--glass:rgb(255 255 255/.05);--tgold:linear-gradient(180deg,#FFD479,#F2B53A);--expense:#E57373;--halo:rgb(242 181 58/.16)}
.t-light{--bg:#FBF3E1;--surface:#FFFFFF;--s2:#FFF9EC;--text:#0F172A;--muted:#3F4C78;--border:rgb(15 30 70/.22);--bstrong:#6F7899;--income:#0B6B43;--btnb:#6F7899;--passive:#087F66;--track:rgb(15 30 70/.14);--sel:#0F172A;
  --career:#A84E0B;--career-fill:#C2571A;--career-tint:rgb(168 78 11/.10);--amber:#6E4200;--amber-fill:rgb(242 181 58/.30);--scrim:rgb(15 23 42/.72);--sky:transparent;--glass:rgb(255 255 255/.72);--tgold:linear-gradient(180deg,#0F172A,#0F172A);--expense:#B3261E;--halo:rgb(242 181 58/.38)}
.phone{direction:rtl;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden;position:relative;border-radius:6px;box-shadow:0 8px 30px rgb(0 0 0/.35)}
.money{font-weight:900;font-variant-numeric:tabular-nums;unicode-bidi:isolate}.money .cur{font-size:.6em;font-weight:500;margin-inline-end:.12em}
.topbar{display:flex;align-items:center;gap:8px;padding:10px 16px 0;min-height:58px;flex:none}
.tb-title{font:800 22px Rubik;flex:1}.grow{flex:1}
.iconbtn{inline-size:48px;block-size:48px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--muted);display:grid;place-items:center;flex:none}
.head{border-radius:50%;background:var(--s2);border:1px solid var(--border);flex:none}
.btn{font:800 18px Rubik;border-radius:999px;border:0;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex:none}
.primary{background:#F2B53A;color:#2A1700;block-size:64px}
.ghost{background:transparent;color:var(--text);box-shadow:inset 0 0 0 1.5px var(--btnb);block-size:56px;font:700 16px Rubik;flex:1}
.ghost.full{inline-size:100%;flex:none}
.text{background:transparent;color:var(--text);block-size:48px;font:700 16px Rubik;align-self:center;padding:0 16px}
.text.sm{font-size:15px}
.row2{display:flex;gap:8px}
.foot{flex:none;display:flex;flex-direction:column;gap:10px;padding:8px 16px 16px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;block-size:30px;padding:0 12px;border-radius:14px;background:var(--s2);border:1px solid var(--border);font:500 13px Rubik}
.fine{font:400 12px Rubik;color:var(--muted);text-align:center}
.lede{font:400 15px/1.45 Rubik;color:var(--muted)}
.scrim{position:absolute;inset:0;background:var(--scrim);opacity:.8}.scrim.solid{opacity:1}
.under{position:absolute;inset:0;display:flex;flex-direction:column}
/* shared career atoms */
.xp{block-size:4px;border-radius:2px;background:var(--track);overflow:hidden;inline-size:100%;position:relative;flex:none}
.xp.lg{block-size:8px;border-radius:4px}
.xp i{display:block;block-size:100%;background:var(--career-fill);border-radius:inherit;position:relative}
.xp u{position:absolute;inset-block:0;inset-inline-start:0;border-radius:inherit;background:repeating-linear-gradient(135deg,var(--bstrong) 0 2px,transparent 2px 5px);opacity:.7}
.rk{display:inline-flex;align-items:center;gap:4px;font:700 12px Rubik;color:var(--text);min-inline-size:0}
.rk svg{color:var(--career);flex:none}.rk span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x2{display:inline-flex;align-items:center;gap:2px;block-size:18px;padding:0 6px;border-radius:9px;background:var(--career-tint);color:var(--career);font:700 11px Rubik;flex:none}
.banner{display:flex;gap:10px;align-items:flex-start;border-radius:14px;padding:10px 12px;font:400 14px/1.4 Rubik}
.banner.promo{background:var(--career-tint);color:var(--text)}.banner.promo svg{color:var(--career);flex:none;margin-block-start:1px}
/* a. pick */
.pick-top{display:flex;justify-content:space-between;align-items:center;padding:16px 16px 0;flex:none}
.pick-top h1{font:900 28px Rubik}.pick-top p{font:400 15px Rubik;color:var(--muted)}
.strip{padding:8px 16px 0;display:flex;flex-direction:column;gap:4px;flex:none}
.strip p{display:flex;gap:6px;align-items:center;font:500 13px Rubik;color:var(--muted)}
.strip p svg{color:var(--career);flex:none}.strip p b{color:var(--text);font-weight:700}
.strip p.warn{color:var(--amber);font-weight:700}.strip p.warn svg{color:var(--amber)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 16px 0}
.prof{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:2px 9px 10px;display:flex;flex-direction:column;align-items:center;min-inline-size:0;background-image:radial-gradient(ellipse at 50% 12%,rgb(242 181 58/.12),transparent 60%)}
.prof.promo{border-color:var(--career);box-shadow:inset 0 0 0 .5px var(--career)}
.well{block-size:125px;display:flex;align-items:flex-end;justify-content:center;inline-size:100%;position:relative}
.well img{block-size:125px}
.well .x2{position:absolute;inset-block-start:6px;inset-inline-end:4px;block-size:22px;padding:0 8px;font-size:12px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--career)}
.well::after{content:'';position:absolute;inset-inline:20%;inset-block-end:0;block-size:1px;background:var(--border)}
.pname{font:900 20px/1.2 Rubik;margin-block-start:6px;white-space:nowrap}
.career-row{display:flex;align-items:center;justify-content:center;gap:6px;inline-size:100%;block-size:20px;margin-block-start:1px}
.prof .xp{margin:3px 0 5px;inline-size:86%}
.prow{display:flex;gap:5px;align-items:baseline;justify-content:center}.prow small{font:400 12px Rubik;color:var(--muted)}
.prow b{font-size:18px}.prow.sub b{font-size:14px;color:var(--muted)}
.pocket{margin-block-start:8px;inline-size:100%;block-size:32px;border-radius:16px;border:1px solid var(--income);color:var(--income);background:color-mix(in srgb,var(--income) 12%,transparent);display:flex;gap:5px;align-items:center;justify-content:center;font:700 13px Rubik}
.is-320 .well,.is-320 .well img{block-size:108px}.is-320 .pname{font-size:18px}.is-320 .prow b{font-size:16px}.is-320 .pick-top h1{font-size:26px}
/* sheets */
.sheet{position:absolute;inset-inline:0;inset-block-end:0;background:var(--surface);border-radius:28px 28px 0 0;display:flex;flex-direction:column;max-block-size:92%;box-shadow:0 -12px 40px rgb(0 0 0/.4)}
.sheet.tall{max-block-size:94%}
.handle{inline-size:44px;block-size:5px;border-radius:3px;background:var(--bstrong);align-self:center;margin:10px 0 6px;flex:none}
.sh-scroll{padding:6px 16px 10px;display:flex;flex-direction:column;gap:12px;overflow:hidden;min-block-size:0}
.sh-scroll.ctr{align-items:center;text-align:center;padding-block:10px 16px}
.sh-scroll h2{font:800 22px Rubik}
.sh-head{display:flex;gap:12px;align-items:center}.sh-head img{block-size:92px}.sh-head p{font:400 15px Rubik;color:var(--muted)}
.sh-cta{padding:8px 16px 16px;display:flex;flex-direction:column;gap:4px;flex:none}.sh-cta .primary{inline-size:100%}
.sh-title{display:flex;align-items:center;justify-content:space-between}
.rank-pick{background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px}
.rp-top{display:flex;justify-content:space-between;align-items:baseline;font:700 15px Rubik}.rp-top small{font:400 12px Rubik;color:var(--muted)}
.rchips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.rchip{block-size:56px;border-radius:14px;border:1px solid var(--btnb);background:transparent;color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:700 12px Rubik}
.rchip svg{color:var(--career)}
.rchip.on{background:var(--surface);box-shadow:inset 0 0 0 2px var(--sel);border-color:transparent}
.rchip.locked{border-style:dashed;border-color:var(--bstrong);color:var(--muted)}.rchip.locked svg{color:var(--muted)}
.rp-xp{display:flex;flex-direction:column;gap:6px;font:500 13px Rubik;color:var(--muted)}
.rp-note{font:400 13px/1.4 Rubik;color:var(--muted)}
.st{border-block-start:1px solid var(--border);padding-block-start:6px;display:flex;flex-direction:column;gap:4px}
.st-row{display:flex;justify-content:space-between;align-items:baseline;font:400 15px Rubik;min-block-size:28px}.st-row .money{font-size:16px}
.st-row.inc .money{color:var(--income)}.st-row.tot{font-weight:700}.st-row.flow .money{color:var(--income);font-size:20px}
.is-320 .sh-head img{block-size:64px}.is-320 .rchip{block-size:52px}.is-320 .primary{block-size:56px}.is-320 .sh-scroll{gap:10px}
/* b. home */
.sky{position:absolute;inset:0;inline-size:100%;block-size:100%;color:var(--sky)}
.h-top{display:flex;justify-content:space-between;align-items:center;padding:16px 16px 0;position:relative;flex:none;gap:8px}
.h-actions{display:flex;gap:8px;flex:none}
.cchip{display:flex;align-items:center;gap:6px;block-size:48px;padding:0 10px 0 4px;padding-inline:4px 10px;border-radius:24px;border:1px solid var(--border);background:var(--glass);color:var(--text);font:700 12px Rubik;min-inline-size:0;max-inline-size:104px;position:relative}
.cchip svg{flex:none}.cchip .mut{color:var(--muted);display:inline-flex}
.cchip .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.cchip.warn{padding-inline-end:4px}
.cchip .days{display:inline-flex;align-items:center;gap:3px;block-size:28px;padding:0 8px;border-radius:14px;background:var(--amber-fill);color:var(--amber);white-space:nowrap}
.cchip.mini{inline-size:48px;padding:0;justify-content:center;border:0;background:transparent}
.bdg{position:absolute;inset-block-end:0;inset-inline-end:-2px;inline-size:20px;block-size:20px;border-radius:50%;background:var(--surface);border:1.5px solid var(--bg);color:var(--text);display:grid;place-items:center;font:800 11px Rubik;font-style:normal;box-shadow:0 0 0 1px var(--bstrong)}
.bdg.warn{background:color-mix(in srgb,#F2B53A 30%,var(--surface));color:var(--amber);box-shadow:0 0 0 1px var(--amber)}
.h-hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;position:relative;min-block-size:0;padding-inline:24px}
.logo{inline-size:200px;block-size:auto}.tagline{font:500 17px/1.4 Rubik;text-align:center;color:var(--text)}
.h-bottom{padding:0 16px 28px;display:flex;flex-direction:column;gap:12px;position:relative;flex:none}
.h-warn{display:flex;gap:6px;align-items:center;justify-content:center;font:700 13px Rubik;color:var(--amber);margin-block-end:-2px}
.modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mode{position:relative;block-size:72px;border-radius:22px;border:1px solid var(--border);background:var(--surface);color:var(--text);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 14px;text-align:start}
.mode b{font:800 17px Rubik}.mode small{font:400 13px Rubik;color:var(--muted);white-space:nowrap}
.mode.on{box-shadow:inset 0 0 0 2px var(--sel)}.mode i{position:absolute;inset-inline-end:12px;inset-block-start:10px;inline-size:24px;block-size:24px;border-radius:50%;background:var(--sel);color:var(--bg);display:grid;place-items:center}
.daily{block-size:64px;border-radius:22px;border:1px solid var(--border);background:var(--surface);color:var(--text);display:flex;align-items:center;gap:12px;padding:0 12px}
.d-ic{inline-size:40px;block-size:40px;border-radius:50%;background:var(--s2);display:grid;place-items:center}.d-tx{flex:1;display:flex;flex-direction:column;align-items:flex-start}
.d-tx b{font:800 16px Rubik}.d-tx small{font:500 13px Rubik;color:var(--muted)}
.h-miss{block-size:48px;flex:none;font-size:15px}.h-start{block-size:48px}
.is-320 .logo{inline-size:132px}.is-320 .tagline{font-size:13px;white-space:nowrap}.is-320 .h-hero{gap:0}.is-320 .mode{block-size:60px}.is-320 .daily{block-size:52px}.is-320 .h-bottom{gap:8px;padding-block-end:14px}.is-320 .mode small{font-size:12px}
/* c. end */
.end-hero{display:flex;flex-direction:column;align-items:center;padding:14px 16px 0;flex:none;text-align:center}
.hammock{block-size:176px}.tired{block-size:150px}
.t-win{font:900 36px/1.1 Rubik;background:var(--tgold);-webkit-background-clip:text;color:transparent;margin-block-start:2px}
.t-over{font:900 28px/1.15 Rubik}
.end-hero .tagline{font-size:15px;margin-block-start:4px;color:var(--muted)}
.end-card{margin:12px 16px 0;background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;flex:none;overflow:hidden}
.cmpr{display:flex;justify-content:space-between}.cmpr small{display:block;font:500 13px Rubik;color:var(--muted)}.cmpr .end{text-align:end}
.cmpr .inc{font-size:26px;color:var(--income)}.cmpr .mid{font-size:20px}
.meter{block-size:10px;border-radius:5px;background:var(--track);overflow:hidden;flex:none}.meter i{display:block;block-size:100%;background:var(--passive)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);text-align:center}.stats div+div{border-inline-start:1px solid var(--border)}
.stats b{display:block;font:900 22px Rubik}.stats small{font:500 13px Rubik;color:var(--muted)}
.cause{font:500 15px/1.4 Rubik}
.cblock{border-block-start:1px solid var(--border);padding-block-start:10px;display:flex;flex-direction:column;gap:8px}
.cb-main{display:flex;gap:10px;align-items:center}
.cb-av{position:relative;flex:none;display:grid}.cb-rk{position:absolute;inset-block-end:-3px;inset-inline-end:-4px;inline-size:20px;block-size:20px;border-radius:50%;background:var(--surface);box-shadow:0 0 0 1px var(--career);color:var(--career);display:grid;place-items:center}
.cb-col{flex:1;display:flex;flex-direction:column;gap:5px;min-inline-size:0}
.cb-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.cb-line b{font:800 16px Rubik;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gain{font:800 15px Rubik;color:var(--career);white-space:nowrap}
.cb-sub{display:flex;justify-content:space-between;align-items:center;gap:6px;font:400 12px Rubik;color:var(--muted)}
.cb-kept{display:flex;gap:6px;align-items:center;font:500 13px Rubik;color:var(--text)}.cb-kept svg{color:var(--muted);flex:none}
.end-actions{margin-block-start:auto;padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:none}
.is-320 .hammock{block-size:92px}.is-320 .tired{block-size:84px}.is-320 .t-win{font-size:26px}.is-320 .t-over{font-size:22px}.is-320 .end-hero .tagline{font-size:13px}.is-320 .end-hero{padding-block-start:8px}
.is-320 .end-card{margin-block-start:8px;padding:10px 12px;gap:8px}.is-320 .ghost{block-size:48px;font-size:15px}.is-320 .end-actions{padding-block:8px 10px;gap:6px}
.is-320 .end-actions .text{display:none}.is-320 .cmpr .inc{font-size:22px}.is-320 .stats b{font-size:18px}.is-320 .cb-sub span{display:none}.is-320 .cb-sub{justify-content:flex-end}
.dialog{position:absolute;inset-inline:16px;inset-block-start:50%;transform:translateY(-50%);background:var(--surface);border:1px solid var(--border);border-radius:28px;padding:20px 20px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;box-shadow:0 24px 56px rgb(0 0 0/.55)}
.ru-fox{position:relative;inline-size:168px;block-size:168px;display:grid;place-items:center}
.ru-fox img{inline-size:168px;position:relative}.halo{position:absolute;inset:-12px;border-radius:50%;background:radial-gradient(closest-side,var(--halo),transparent)}
.kick{font:700 15px Rubik;color:var(--career)}
.dialog h1{font:900 30px/1.15 Rubik}
.ru-ladder{display:flex;align-items:center;gap:6px;margin-block:4px}
.ru-ladder span{inline-size:36px;block-size:36px;border-radius:50%;display:grid;place-items:center;border:1px dashed var(--bstrong);color:var(--muted)}
.ru-ladder span.done{border:1px solid var(--career);color:var(--career)}
.ru-ladder span.now{border:0;background:var(--career-tint);color:var(--career);box-shadow:0 0 0 2px var(--career)}
.ru-ladder i{inline-size:14px;block-size:2px;background:var(--bstrong);border-radius:1px}
.ru-text{font:400 15px/1.45 Rubik;color:var(--muted);margin-block-end:8px}
.dialog .primary{inline-size:100%}
.is-320 .ru-fox,.is-320 .ru-fox img{inline-size:112px;block-size:112px}.is-320 .dialog h1{font-size:24px}.is-320 .dialog{padding:14px 16px;inset-inline:12px}.is-320 .ru-text{font-size:14px}
/* d. return */
.bk{flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 20px;min-block-size:0;overflow:hidden;text-align:center}
.bk-fox{block-size:132px;filter:drop-shadow(0 8px 12px rgb(0 0 0/.3))}
.bk h1{font:800 26px/1.2 Rubik}.bk-what{font:400 16px/1.45 Rubik;color:var(--text)}
.bk-list{list-style:none;inline-size:100%;background:var(--surface);border:1px solid var(--border);border-radius:22px;text-align:start;margin-block-start:4px}
.bk-list li{display:flex;gap:10px;align-items:center;padding:10px 12px;min-block-size:64px;border-block-end:1px solid var(--border)}.bk-list li:last-child{border:0}
.bk-col{flex:1;display:flex;flex-direction:column;gap:4px;min-inline-size:0}.bk-col>b{font:700 15px Rubik}
.bk-bar{display:flex;flex-direction:column;align-items:flex-start;gap:3px}.bk-bar small{font:400 12px Rubik;color:var(--muted)}
.bk-move{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.bk-move .was .rk{color:var(--muted);font-weight:500;text-decoration:line-through}.bk-move .was svg{color:var(--muted)}
.bk-move .arr{color:var(--muted);display:grid}
.bk-more{font:400 13px Rubik;color:var(--muted)}
.bk-keep{display:flex;gap:6px;align-items:center;font:700 14px Rubik}.bk-keep svg{color:var(--income);flex:none}
.bk-rule{display:flex;gap:6px;align-items:center;justify-content:center;font:500 13px Rubik;color:var(--muted)}
.is-320 .bk-fox{block-size:72px}.is-320 .bk h1{font-size:22px}.is-320 .bk-what{font-size:14px}.is-320 .bk{gap:6px;padding-inline:16px}.is-320 .bk-list li{min-block-size:56px;padding:6px 10px}.is-320 .topbar{min-height:50px;padding-block-start:2px}
/* e. promotion card (cream, theme-independent) */
.pcard{position:absolute;inset:20px 16px;background:#FFF6E3;color:#0F172A;border-radius:28px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 56px rgb(0 0 0/.55);border-block-start:3px solid #A8720C;
  --ink-m:#46527E;--keep:#0B6B43;--spend:#B42318}
.pcard.fam{--spend:#6E4200}
.pc-scroll{padding:16px 20px 8px;display:flex;flex-direction:column;gap:8px;flex:1;min-block-size:0;overflow:hidden}
.pc-head{display:flex;align-items:center;gap:10px}
.tchip{display:inline-flex;align-items:center;gap:6px;block-size:36px;padding:0 14px;border-radius:18px;background:#FFF0C9;border:1px solid #A8720C;color:#6E4200;font:700 14px Rubik}
.kicker2{font:500 13px Rubik;color:var(--ink-m)}
.pcard h1{font:900 26px/1.15 Rubik}.pc-text{font:400 16px/1.4 Rubik;color:var(--ink-m)}.pc-text .money{color:#0F172A}
.choose{font:700 14px Rubik;color:var(--ink-m);margin-block-start:4px}
.decs{list-style:none;display:flex;flex-direction:column;gap:8px}
.dec{background:#fff;border:1px solid #EBDDBF;border-radius:16px;padding:10px 14px 12px;display:flex;flex-direction:column;gap:6px}
.dec>b{font:700 16px Rubik}
.nums{display:flex;gap:16px;font-size:15px;flex-wrap:wrap}.nums small{font:400 13px Rubik;color:var(--ink-m)}.nums .none{font:400 13px Rubik;color:var(--ink-m)}
.rbar{display:flex;gap:2px;block-size:10px}
.rbar i{display:block;border-radius:5px}.rbar .keep{background:var(--keep)}
.rbar .spend{background:repeating-linear-gradient(135deg,var(--spend) 0 3px,#fff 3px 6px);box-shadow:inset 0 0 0 1.5px var(--spend)}
.rleg{display:flex;gap:4px 14px;flex-wrap:wrap;font:500 12px Rubik;color:var(--ink-m)}.rleg span{display:inline-flex;align-items:center;gap:5px}.rleg .money{color:#0F172A;font-weight:800}
.sw{inline-size:10px;block-size:10px;border-radius:3px}.sw.keep{background:var(--keep)}.sw.spend{background:repeating-linear-gradient(135deg,var(--spend) 0 2px,#fff 2px 4px);box-shadow:inset 0 0 0 1.5px var(--spend)}
.teach{background:#fff;border:1px solid #EBDDBF;border-radius:16px;padding:10px 14px;font:400 14px/1.4 Rubik}
.pc-actions{padding:8px 20px 16px;display:flex;flex-direction:column;gap:8px;flex:none;background:linear-gradient(180deg,rgb(255 246 227/0),#FFF6E3 14px)}
.opt{block-size:56px;background:#fff;color:#0F172A;box-shadow:inset 0 0 0 1.5px #6B7596;font:800 17px Rubik}
.is-320 .pcard{inset:10px 10px}.is-320 .pcard h1{font-size:22px}.is-320 .pc-text{font-size:14px}.is-320 .pc-scroll{padding:12px 14px 4px;gap:6px}.is-320 .opt{block-size:48px;font-size:15px}.is-320 .pc-actions{padding:6px 14px 12px;gap:6px}
.is-320 .tchip{block-size:30px;font-size:13px}.is-320 .dec{padding:8px 12px 10px;gap:4px}.is-320 .dec>b{font-size:15px}.is-320 .nums{font-size:14px}
/* f. profiles */
.pk{flex:1;padding:12px 16px;display:flex;flex-direction:column;gap:14px}
.pk-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pk-tile{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:22px;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px 14px;min-block-size:160px}
.pk-tile b{font:800 18px Rubik}.pk-meta{display:flex;gap:6px;align-items:center;font:500 13px Rubik;color:var(--muted)}.pk-meta svg{color:var(--career)}
.pk-tile.on{box-shadow:inset 0 0 0 2px var(--sel)}.pk-check{position:absolute;inset-block-start:10px;inset-inline-end:10px;inline-size:24px;block-size:24px;border-radius:50%;background:var(--sel);color:var(--bg);display:grid;place-items:center}
.pk-tile.add{background:transparent;border:1.5px dashed var(--bstrong)}.pk-plus{inline-size:72px;block-size:72px;border-radius:50%;background:var(--s2);display:grid;place-items:center;color:var(--muted)}
.is-320 .pk-tile{min-block-size:136px;padding-block:12px 10px}.is-320 .pk-tile .head,.is-320 .pk-plus{inline-size:56px;block-size:56px}.is-320 .tb-title{font-size:20px}
.pf{flex:1;padding:6px 16px 12px;display:flex;flex-direction:column;gap:12px;min-block-size:0;overflow:hidden}
.pf-head{display:flex;gap:12px;align-items:center}.pf-head h1{font:800 24px Rubik;margin-block-end:4px}
.sen{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.sen-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.sen-t{display:inline-flex;gap:6px;align-items:center;font:800 17px Rubik}.sen-t svg{color:var(--muted)}
.sen-st{display:inline-flex;gap:4px;align-items:center;block-size:28px;padding:0 10px;border-radius:14px;background:var(--s2);border:1px solid var(--border);font:700 13px Rubik;white-space:nowrap}
.sen.warn .sen-st{background:var(--amber-fill);color:var(--amber);border-color:transparent}.sen.warn .sen-t svg{color:var(--amber)}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.week span{block-size:32px;border-radius:10px;display:grid;place-items:center;font:700 13px Rubik;border:1px solid var(--border);color:var(--text)}
.week .past{color:var(--muted);background:var(--s2)}.week .today{box-shadow:inset 0 0 0 2px var(--sel);border-color:transparent}
.week .played{background:var(--career-tint);color:var(--career);border-color:var(--career)}
.sen-rule{font:400 13px/1.45 Rubik;color:var(--muted)}
.sec{display:flex;flex-direction:column;gap:8px}.sec-h{display:flex;justify-content:space-between;align-items:baseline}.sec-h h3{font:800 18px Rubik}.sec-h small{font:500 13px Rubik;color:var(--muted)}
.rl{list-style:none;background:var(--surface);border:1px solid var(--border);border-radius:22px}
.rl li{display:flex;gap:10px;align-items:center;padding:10px 12px;border-block-end:1px solid var(--border);min-block-size:64px}.rl li:last-child{border:0}
.rl-col{flex:1;display:flex;flex-direction:column;gap:4px;min-inline-size:0}.rl-top{display:flex;justify-content:space-between;align-items:center}.rl-top b{font:700 15px Rubik}
.pips{display:flex;gap:4px}.pips span{inline-size:22px;block-size:22px;border-radius:50%;display:grid;place-items:center;color:var(--muted);border:1px dashed var(--border)}
.pips .done{color:var(--career);border:1px solid var(--career)}.pips .hist{color:var(--muted);border:1px dashed var(--bstrong)}
.hist-l{font:400 12px Rubik;color:var(--muted)}
.ag{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.at{background:var(--surface);border:1px solid var(--border);border-radius:16px;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;min-block-size:104px}
.am{inline-size:48px;block-size:48px;border-radius:50%;display:grid;place-items:center;flex:none}
.at.on .am,.am.on{background:var(--career-tint);color:var(--career);box-shadow:inset 0 0 0 1px var(--career)}
.at.off .am,.am.off{border:1px dashed var(--bstrong);color:var(--muted)}
.am.big{inline-size:72px;block-size:72px}
.al{font:500 12px/1.25 Rubik;text-align:center}.at.off .al{color:var(--muted)}.at.off{background:transparent}
.fld{display:flex;flex-direction:column;gap:6px}.fld>span{font:500 13px Rubik;color:var(--muted)}.fld>small{font:400 12px Rubik;color:var(--muted)}
.inp{block-size:56px;border-radius:14px;border:1.5px solid var(--btnb);display:flex;align-items:center;justify-content:space-between;padding:0 14px}.inp b{font:500 17px Rubik}.inp small{font:400 12px Rubik;color:var(--muted)}
.achips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.achip{block-size:52px;border-radius:14px;border:1px solid var(--btnb);background:transparent;color:var(--text);font:800 16px Rubik}
.achip.on{background:var(--s2);box-shadow:inset 0 0 0 2px var(--sel);border-color:transparent}
.fgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fx{position:relative;block-size:60px;border-radius:14px;border:1px solid var(--border);background:transparent;display:grid;place-items:center}
.fx.on{background:var(--s2);box-shadow:inset 0 0 0 2px var(--sel);border-color:transparent}
.fx i{position:absolute;inset-block-start:4px;inset-inline-end:4px;inline-size:18px;block-size:18px;border-radius:50%;background:var(--sel);color:var(--bg);display:grid;place-items:center}
.is-320 .fx{block-size:54px}.is-320 .achip{block-size:48px}.is-320 .inp{block-size:52px}.is-320 .sh-cta{padding-block:4px 8px}
`;

const sec = (t, items) => `<h3 class="secT">${t}</h3><div class="sheetrow">${items.join('')}</div>`;
const html = `<!doctype html><html lang="he"><meta charset="utf-8"><style>${CSS}</style><body>
${sec('a. Profession screen (spec 1) · all copy is placeholder', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'A · Pick · dark · 360x800 · rank + XP bar per card, promo week on the teacher', body: pick({}) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'B · Pick · light · 320x568 · with the seniority warning line', body: pick({ warn: true }) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'C · Pick sheet · dark · 360x800 · start rank = current (3 of 4), rank 4 locked', body: pickSheet({ cur: 2, sel: 2 }) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'D · Pick sheet · light · 320x568 · a lower rank chosen (content scrolls under the pinned CTA)', body: pickSheet({ cur: 2, sel: 1 }) }),
])}
${sec('b. Home seniority chip (spec 2): the topbar inline-start slot, where the games chip was', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'E · Home · dark · 360x800 · normal (a game was finished this week)', body: home({ w: 360, h: 800, state: 'kept' }) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'F · Home · dark · 360x800 · warning from Thursday (chip + the sentence above the mode cards)', body: home({ w: 360, h: 800, state: 'warn' }) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'G · Home · light · 320x568 · warning, compact (avatar + day badge; no sentence under 700px tall)', body: home({ w: 320, h: 568, state: 'warn' }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'H · Home · light · 360x800 · junior (name only: nothing can be lost)', body: home({ w: 360, h: 800, state: 'junior', fox: 'cook' }) }),
])}
${sec('c. End-of-game career block and the rank-up moment (spec 3)', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'I · Win · dark · 360x800 · career block: XP gained, bar (hatched = before), promo week ×2', body: win({ career: { prof: 'teacher', rank: 1, from: 38, to: 92, gain: 240, parts: 'סיום משחק 100 · הישג 20', promo: true, kept: 'הוותק נשמר לשבוע הזה' } }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'J · Game over · light · 360x800 · the same block (finishing a game always gives XP)', body: over({ career: { prof: 'nurse', rank: 1, from: 10, to: 30, gain: 60, parts: 'סיום משחק 60', kept: 'הוותק נשמר לשבוע הזה' } }) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'K · Rank-up dialog · dark · 360x800 · celebrate art, the ladder, the honest "harder start" line', body: rankUp({}) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'L · Win · light · 320x568 · compact block (breakdown line dropped)', body: win({ career: { prof: 'teacher', rank: 1, from: 38, to: 92, gain: 240, parts: '', promo: true } }) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'L2 · Rank-up dialog · light · 320x568 · junior wording', body: rankUp({ kid: true }) }),
])}
${sec('d. Return after absence (spec 4)', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'M · Return · dark · 360x800 · one missed week: progress reset', body: back({ kind: 'reset' }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'N · Return · light · 360x800 · two missed weeks: every profession drops one rank', body: back({ kind: 'drop' }) }),
  phone({ w: 320, h: 568, theme: 'dark', label: 'O · Return · dark · 320x568 · rank drop (list scrolls, button pinned)', body: back({ kind: 'drop' }) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'P · Return · light · 320x568 · junior: the career waited', body: back({ kind: 'junior' }) }),
])}
${sec('e. Promotion card (spec 5): the existing decision-card pattern + the raise bar', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'Q · Promotion · full · 360x800', body: promo({ mode: 'full' }) }),
  phone({ w: 320, h: 568, theme: 'dark', label: 'R · Promotion · family · 320x568 (amber, not red; the card scrolls over pinned buttons)', body: promo({ mode: 'family' }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'S · Promotion · junior · 360x800 · coins', body: promo({ mode: 'junior' }) }),
])}
${sec('f. Profiles (spec 6)', [
  phone({ w: 360, h: 800, theme: 'dark', label: 'T · Profile picker · dark · 360x800', body: picker({}) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'U · Profile picker · light · 320x568', body: picker({}) }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'V · Profile · dark · 360x800 · seniority card, ranks (with a title held in the past)', body: profile({ name: 'נועה', fox: 'teacher', age: '14+', rows: 4, ach: 3 }) }),
  phone({ w: 360, h: 800, theme: 'light', label: 'W · Profile · light · 360x800 · seniority warning + achievements grid (earned / locked)', body: profile({ name: 'נועה', fox: 'teacher', age: '14+', warn: true, order: 'ach', rows: 2 }) }),
  phone({ w: 320, h: 568, theme: 'light', label: 'X · Profile edit sheet · light · 320x568', body: editSheet() }),
  phone({ w: 360, h: 800, theme: 'dark', label: 'Y · Achievement detail · dark · 360x800 · locked', body: achSheet() }),
  phone({ w: 320, h: 568, theme: 'dark', label: 'Z · Profile · dark · 320x568 · junior', body: profile({ name: 'יואב', fox: 'cook', age: 'עד 10', junior: true, rows: 2, ach: 3 }) }),
])}
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'maxifox-mocks-'));
const file = join(dir, 'mocks.html');
writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1640, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`file://${file}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const out = process.argv[2] || 'docs/v050/design/career-contact-sheet.png';
await page.screenshot({ path: out, fullPage: true });
// optional: one PNG per section for review (node render-mocks.mjs <out> <dir>)
if (process.argv[3]) {
  const rows = await page.$$('.sheetrow');
  for (let i = 0; i < rows.length; i++) await rows[i].screenshot({ path: join(process.argv[3], `row-${'abcdef'[i]}.png`) });
}
// overflow audit: any phone whose content is wider than its frame is a layout bug in the mock
const wide = await page.$$eval('.phone', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.nextElementSibling.textContent));
console.log('wrote', out, '| horizontal overflow in:', wide.length ? wide : 'none');
await browser.close();
