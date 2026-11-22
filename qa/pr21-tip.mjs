// Task 2 probe: tip bubble overflow + screenshot of both builds (BASE_URL = 06e7e15 build, NEW_URL = 940b983 build)
import { chromium } from 'playwright'; import { readFileSync, mkdirSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../src/engine/index.js';
import { launchOptions } from '../tests/e2e/env.mjs';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const save = serialize(newMatch(engine, { mode: 'family', seed: 7, players: [{ name: 'דנה', professionId: 'teacher' }] }));
const OUT = new URL('./screens/pr21/tip/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const texts = JSON.parse(readFileSync('/tmp/claude-0/smk/longest.json', 'utf8'));
const cases = { short: null, mid: 'הקלף הראשון מסוג דירה או עסק במשחק. הסיור מתחיל מיד בפתיחת הקלף.', long: texts[1], longest: texts[0].slice(0, 700), nobreak: 'א'.repeat(120) };
const b = await chromium.launch(launchOptions());
const res = [];
for (const [name, url] of [['base', process.env.BASE_URL], ['new', process.env.NEW_URL]]) {
  for (const [w, h] of [[360, 800], [390, 844], [430, 932], [1280, 800]]) for (const theme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'he-IL', reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await p.addInitScript(([s, th]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, quizDone: true })); localStorage.setItem('passivo.save', s); } }, [save, theme]);
    await p.goto(`${url}?seed=3&theme=${theme}`); await p.locator('[data-action="resume"]').click();
    await p.waitForSelector('.fox-strip .note-bubble', { timeout: 15000 }); await p.waitForTimeout(500);
    for (const [cn, txt] of Object.entries(cases)) {
      if (txt) await p.evaluate((x) => { document.querySelector('.fox-strip .note-text').textContent = x; }, txt);
      const m = await p.evaluate(() => { const bb = document.querySelector('.fox-strip .note-bubble'); const cs = getComputedStyle(bb); return { ox: cs.overflowX, oy: cs.overflowY, sw: bb.scrollWidth, cw: bb.clientWidth, sh: bb.scrollHeight, ch: bb.clientHeight, hbar: bb.offsetHeight - bb.clientHeight, vscrollable: bb.scrollHeight > bb.clientHeight, doc: document.documentElement.scrollWidth > innerWidth, bg: cs.backgroundColor, br: cs.borderRadius, after: getComputedStyle(bb, '::after').backgroundColor + ' ' + getComputedStyle(bb, '::after').width, rect: (({x,y,width,height}) => [x,y,width,height].map(Math.round))(bb.getBoundingClientRect()) }; });
      res.push({ build: name, w, theme, cn, ...m });
      if (cn === 'short' || cn === 'long' || cn === 'longest') await p.screenshot({ path: `${OUT}/${name}-${cn}-${w}x${h}-${theme}.png` });
    }
    await ctx.close();
  }
}
await b.close();
import('node:fs').then(({ writeFileSync }) => writeFileSync('/tmp/claude-0/smk/tip.json', JSON.stringify(res)));
for (const r of res) console.log(r.build, r.w, r.theme, r.cn, `ox=${r.ox} oy=${r.oy} sw-cw=${r.sw - r.cw} hbar=${r.hbar} vscroll=${r.vscrollable} doc=${r.doc} rect=${r.rect} after=${r.after}`);
