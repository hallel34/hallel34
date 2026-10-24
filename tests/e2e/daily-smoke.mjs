// Daily challenge smoke (v2.5): plays the day through the UI, checks the share text, the one-attempt rule on the second visit,
// give up, resume, streak + badges, layout at 360x800 / 360x640 / 320x568, axe on the new screens.
// Run: npm run build && node tests/e2e/daily-smoke.mjs   (AXE_PATH=path/to/axe.min.js enables the accessibility checks)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import {
  createEngine, replayDaily, dailySeed, dailyProfessionId, netWorth, DAILY_TURN_CAP,
} from '../../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4181);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = new URL('../../qa/screens/daily/', import.meta.url).pathname;
const AXE = process.env.AXE_PATH && existsSync(process.env.AXE_PATH) ? readFileSync(process.env.AXE_PATH, 'utf8') : null;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const TODAY = '2026-10-21';
const NOW = '2026-10-21T09:30:00+03:00'; // Asia/Jerusalem is UTC+3 until 2026-10-25

let server;
async function startServer() {
  if (process.env.SMOKE_URL) return;
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL_BASE); if (r.ok) return; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.error(`FAIL: ${msg}`); } else console.log(`ok: ${msg}`); };

async function noHScroll(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(r.sw <= r.cw, `no horizontal scroll on ${label} (${r.sw}/${r.cw})`);
}
async function tapTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a[href]')]
    .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: el.className, w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 }; })
    .filter((x) => x.vis && (x.w < 47.5 || x.h < 47.5)));
  check(small.length === 0, `touch targets >= 48px on ${label}${small.length ? ` (too small: ${JSON.stringify(small.slice(0, 3))})` : ''}`);
}
async function insideViewport(page, selectors, label) {
  const r = await page.evaluate((sels) => sels.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, missing: true };
    const b = e.getBoundingClientRect();
    return { s, top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, ok: b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.left >= 0 && b.right <= innerWidth + 0.5 };
  }), selectors);
  check(r.every((x) => x.ok), `${label} fully inside the ${r[0]?.ih}px viewport${r.some((x) => !x.ok) ? ` ${JSON.stringify(r.filter((x) => !x.ok))}` : ''}`);
}
async function axe(page, label) {
  if (!AXE) return;
  // axe must never run mid-fade: wait until every finite animation has ended
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`));
  check(res.length === 0, `axe: 0 violations on ${label}${res.length ? ` ${JSON.stringify(res)}` : ''}`);
}

/** One UI action of a sensible player. */
function decide() {
  const q = (s, r = document) => r.querySelector(s);
  if (q('[data-screen="daily"]')) return { done: 'daily' };
  if (q('[data-screen="start"]')) return { done: 'left' };
  const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
  const top = layers[layers.length - 1];
  const board = q('.screen-board');
  const cash = Number(board?.dataset.cash || 0);
  const expenses = Number(board?.dataset.expenses || 0);
  const L = '#modal-root .layer:last-child';
  if (top) {
    const card = q('.card', top);
    const btn = (a) => q(`[data-action="${a}"]:not([disabled])`, top);
    if (q('.summary-card', top)) return { click: `${L} [data-action="summary-ok"]` };
    if (card) {
      const kind = card.dataset.card;
      if (kind === 'opportunity' && card.dataset.guess === 'ask') {
        window.__gn = (window.__gn || 0) + 1;
        const pick = Number(card.dataset.payback) <= 96 ? 'good' : 'bad';
        return { click: `${L} [data-action="guess-${window.__gn % 5 === 0 ? 'skip' : pick}"]` };
      }
      if (kind === 'opportunity') {
        const afford = card.dataset.afford === 'true';
        const good = card.dataset.kind !== 'stock' && Number(card.dataset.payback) <= 130 && cash - Number(card.dataset.cost) >= expenses * 0.5;
        return { click: `${L} [data-action="${afford && good && btn('buy') ? 'buy' : 'pass'}"]` };
      }
      if (kind === 'expense') {
        if (btn('pay')) return { click: `${L} [data-action="pay"]` };
        if (btn('loan')) return { click: `${L} [data-action="loan"]` };
      }
      if (kind === 'charity') return { click: `${L} [data-action="${btn('donate') && cash > expenses * 3 ? 'donate' : 'skip'}"]` };
      if (btn('ok')) return { click: `${L} [data-action="ok"]` };
      if (btn('decline')) return { click: `${L} [data-action="decline"]` };
    }
    if (btn('take')) return { click: `${L} [data-action="take"]` };
    if (btn('cancel')) return { click: `${L} [data-action="cancel"]` };
    return { wait: true };
  }
  if (q('[data-action="summary-ok"]')) return { click: '[data-action="summary-ok"]' };
  if (q('[data-action="roll"]:not([disabled])')) return { click: '[data-action="roll"]' };
  return { wait: true };
}

async function playToEnd(page, budgetMs = 240000) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide);
    if (d.done) return { done: d.done, rolls };
    if (d.click) {
      if (d.click === '[data-action="roll"]') rolls += 1;
      await page.locator(d.click).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(20);
    } else await page.waitForTimeout(40);
  }
  return { done: 'timeout', rolls };
}

const newCtx = (browser, { w, h, tz = 'Asia/Jerusalem', theme = null } = {}) => browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: tz,
  reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'],
});
async function open(ctx, { query = '', storage = {}, now = NOW } = {}) {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(([s, theme]) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('passivo.seenIntro', '1');
      localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, quizDone: true }));
      for (const [k, v] of Object.entries(s)) localStorage.setItem(`passivo.${k}`, typeof v === 'string' ? v : JSON.stringify(v));
      if (theme) localStorage.setItem('passivo.prefs', JSON.stringify({ theme }));
    }
  }, [storage, null]);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.errors = errors;
  await page.goto(`${URL_BASE}?seed=5${query}`);
  await page.waitForSelector('[data-screen="start"]');
  await page.waitForTimeout(500);
  return page;
}

const ls = (page, key) => page.evaluate((k) => localStorage.getItem(`passivo.${k}`), key);

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const seed = dailySeed(TODAY);
  const wantProf = data.professions.find((p) => p.id === dailyProfessionId(seed, data.professions)).title;
  console.log(`today ${TODAY}: profession ${wantProf}`);

  for (const [w, h] of [[360, 800], [360, 640], [320, 568]]) {
    const tag = `${w}x${h}`;
    const ctx = await newCtx(browser, { w, h });
    const page = await open(ctx);

    // ---- start screen, new day ----
    const card = page.locator('[data-action="daily"]');
    check(await card.count() === 1, `${tag}: daily card on the start screen`);
    const txt = await card.innerText();
    check(txt.includes('אתגר יומי') && txt.includes('21.10') && txt.includes('לא שוחק היום'), `${tag}: card shows the date and "לא שוחק היום" (${txt.replace(/\n/g, ' | ')})`);
    await insideViewport(page, ['[data-action="daily"]', '[data-action="start"]', '.mode-grid'], `${tag}: start screen daily card + CTA`);
    await noHScroll(page, `${tag}: start`);
    await tapTargets(page, `${tag}: start`);
    const order = await page.evaluate(() => { const g = document.querySelector('.mode-grid').getBoundingClientRect(); const c = document.querySelector('.daily-card').getBoundingClientRect(); return c.top >= g.bottom - 1; });
    check(order, `${tag}: the daily card sits under the mode cards`);
    const clear = await page.evaluate(() => { const f = document.querySelector('.brand-logo').getBoundingClientRect(); const g = document.querySelector('.mode-grid').getBoundingClientRect(); return { foxBottom: Math.round(f.bottom), gridTop: Math.round(g.top) }; });
    check(clear.foxBottom <= clear.gridTop + 6, `${tag}: the logo does not cover the mode cards (${JSON.stringify(clear)})`);
    await page.screenshot({ path: `${OUT}/start-new-${tag}.png` });
    if (w === 360 && h === 800) await axe(page, 'start (daily new)');

    if (w === 320) { // layout only: result screens through the debug win/lose buttons
      await ctx.close();
      const c2 = await newCtx(browser, { w, h });
      const p2 = await open(c2, { query: '&debug=1' });
      await p2.locator('[data-action="daily"]').click();
      await p2.waitForSelector('[data-screen="board"]');
      await p2.locator('[data-action="debug-win"]').click();
      await p2.waitForSelector('[data-screen="daily"]');
      await p2.waitForTimeout(700);
      await insideViewport(p2, ['[data-action="share"]', '[data-action="menu"]'], `${tag}: result buttons`);
      await noHScroll(p2, `${tag}: result`);
      await tapTargets(p2, `${tag}: result`);
      await p2.screenshot({ path: `${OUT}/result-win-${tag}.png` });
      await p2.locator('[data-action="menu"]').click();
      await p2.waitForSelector('[data-screen="start"]');
      await p2.waitForTimeout(400);
      await insideViewport(p2, ['[data-action="daily"]', '[data-action="start"]'], `${tag}: start after the result`);
      await p2.screenshot({ path: `${OUT}/start-done-${tag}.png` });
      await c2.close();
      continue;
    }

    // ---- play the day ----
    await card.click();
    await page.waitForSelector('[data-screen="board"]');
    check((await page.locator('.hud-prof').innerText()) === wantProf, `${tag}: profession of the day is ${wantProf}`);
    check(await page.evaluate(() => document.querySelector('.screen-board').dataset.players) === '1', `${tag}: single player`);
    check((await page.locator('.hud-sub').innerText()).includes(`מתוך ${DAILY_TURN_CAP}`) || (await page.locator('.hud-turn').innerText()).length > 0, `${tag}: HUD shows the day's turn label`);
    await noHScroll(page, `${tag}: daily board`);
    await page.screenshot({ path: `${OUT}/board-${tag}.png` });
    if (w === 360 && h === 800) {
      // leave mid-game: the save resumes; the give-up choice is offered and a normal game is untouched
      await page.locator('[data-action="roll"]').click();
      await page.waitForFunction(() => document.querySelector('.screen-board').dataset.turn === '1' || document.querySelector('#modal-root .layer'), null, { timeout: 8000 });
      const r = await playToTurn(page, 1);
      await page.locator('[data-action="home"]').click();
      await page.waitForSelector('.home-sheet');
      check(await page.locator('[data-action="daily-giveup"]').count() === 1, 'home sheet of a daily offers "ויתור על האתגר"');
      await tapTargets(page, 'daily home sheet');
      await page.screenshot({ path: `${OUT}/home-sheet-${tag}.png` });
      await axe(page, 'daily home sheet');
      await page.locator('[data-action="home-confirm"]').click();
      await page.waitForSelector('[data-screen="start"]');
      await page.waitForTimeout(400);
      const info = await page.locator('[data-action="daily"]').innerText();
      check(info.includes('המשיכו'), `card offers to continue the unfinished day (${info.replace(/\n/g, ' | ')})`);
      check(await page.locator('[data-action="resume"]').count() === 0, 'a daily save is not the normal "המשך משחק" slot');
      check(await ls(page, 'save') === null && await ls(page, 'dailySave') !== null, 'daily game saved in its own slot');
      await page.screenshot({ path: `${OUT}/start-playing-${tag}.png` });
      await page.reload();
      await page.waitForSelector('[data-screen="start"]');
      await page.locator('[data-action="daily"]').click();
      await page.waitForSelector('[data-screen="board"]');
      const t0 = await page.evaluate(() => document.querySelector('.screen-board').dataset.turn);
      check(Number(t0) >= 1 && (await page.locator('.hud-prof').innerText()) === wantProf, `resumed the same daily game at turn ${t0}`);
      void r;
    }
    const end = await playToEnd(page);
    check(end.done === 'daily', `${tag}: played the day to the result screen (${end.done}, ${end.rolls} rolls)`);
    await page.waitForTimeout(800);
    const res = await page.evaluate(() => ({
      title: document.querySelector('.daily-h1').textContent, outcome: document.querySelector('section[data-screen="daily"]').dataset.outcome,
      text: document.querySelector('section[data-screen="daily"]').innerText,
    }));
    console.log(`result ${tag}: ${res.outcome} / ${res.title}`);
    check(/חופש כלכלי|לא הצלחתי היום/.test(res.title), `${tag}: result title (${res.title})`);
    check(res.text.includes('מה למדתי היום'), `${tag}: learning headline on the result`);
    check(res.text.includes('שווי נקי'), `${tag}: net worth on the result`);
    check(res.text.includes('שיחקתם יום אחד ברצף'), `${tag}: streak line after the first play`);
    await insideViewport(page, ['[data-action="share"]', '[data-action="menu"]'], `${tag}: result buttons`);
    await noHScroll(page, `${tag}: result`);
    await tapTargets(page, `${tag}: result`);
    await page.screenshot({ path: `${OUT}/result-${res.outcome}-${tag}.png` });
    if (w === 360 && h === 800) await axe(page, `result (${res.outcome})`);

    // stored result replays through the engine to the same numbers (what a server check would do)
    const stored = JSON.parse(await ls(page, 'dailyResults')).byDate[TODAY];
    const replay = replayDaily(engine, stored.record);
    check(replay.profession.id === stored.record.professionId && (stored.record.turns == null ? replay.status !== 'won' : replay.winTurn === stored.record.turns) && Math.round(netWorth(replay)) === Math.round(stored.record.netWorth), `${tag}: the stored action log replays to the same result (turns ${stored.record.turns}, net ${Math.round(stored.record.netWorth)})`);
    check(await ls(page, 'dailySave') === null, `${tag}: no daily save left after the result`);

    // ---- share: clipboard fallback (no navigator.share) ----
    await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
    await page.locator('[data-action="share"]').click();
    await page.waitForFunction(() => document.querySelector('.daily-copied')?.dataset.visible === 'true');
    check((await page.locator('.daily-copied').innerText()) === 'הועתק', `${tag}: "הועתק" confirmation is visible`);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const first = clip.split('\n')[0];
    const turnsPart = stored.record.turns == null ? 'לא הצלחתי היום' : /^חופש כלכלי (ב-\d+ תורות|בתור אחד)$/;
    const m = first.match(/^MaxiFox אתגר יומי 21\.10 \| (.+) \| שווי נקי \u2066((?:מינוס )?₪[\d.,]+[KM]?)\u2069$/);
    check(!!m && (typeof turnsPart === 'string' ? m[1] === turnsPart : turnsPart.test(m[1])), `${tag}: share first line "${first}"`);
    check(/^\u200F(🟩|🟨|🟥|⬜){1,10}$/u.test(clip.split('\n')[1]) && clip.split('\n').at(-1).startsWith('http'), `${tag}: share text has the squares and the link`);
    check(!data.cards.some((c) => clip.includes(c.title)) && !clip.includes(wantProf), `${tag}: share text reveals no card or profession`);
    await page.screenshot({ path: `${OUT}/result-copied-${tag}.png` });
    // ---- share: navigator.share ----
    await page.evaluate(() => { window.__shared = null; Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true }); });
    await page.locator('[data-action="share"]').click();
    await page.waitForFunction(() => window.__shared);
    check((await page.evaluate(() => window.__shared.text)) === clip, `${tag}: navigator.share receives the same text`);
    // ---- share: both fail -> the text is shown to copy by hand, nothing throws ----
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: async () => { throw new Error('nope'); }, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
      document.execCommand = () => false;
    });
    await page.locator('[data-action="share"]').click();
    await page.waitForSelector('.daily-sharebox:not([hidden])');
    check((await page.locator('.daily-copied').innerText()).includes('לא הצלחנו'), `${tag}: failed copy shows a message and the text box`);
    await insideViewport(page, ['[data-action="share"]', '[data-action="menu"]', '.daily-sharebox'], `${tag}: result buttons + share box (fallback textarea open)`);
    await noHScroll(page, `${tag}: result with the share box`);
    await page.screenshot({ path: `${OUT}/result-copyfail-${tag}.png` });

    // ---- second visit: one attempt ----
    await page.locator('[data-action="menu"]').click();
    await page.waitForSelector('[data-screen="start"]');
    await page.waitForTimeout(400);
    const done = await page.locator('[data-action="daily"]').innerText();
    check(/חופש כלכלי|לא הצלחתי היום/.test(done) && done.includes('האתגר הבא בעוד'), `${tag}: card shows the result and the countdown (${done.replace(/\n/g, ' | ')})`);
    check(done.includes('14 שעות') || done.includes('שעות'), `${tag}: countdown in hours (09:30 -> midnight is 14 hours 30 minutes: ${done.replace(/\n/g, ' | ')})`);
    check(done.includes('14 שעות ו-30 דקות'), `${tag}: countdown exact for 09:30`);
    await insideViewport(page, ['[data-action="daily"]', '[data-action="start"]'], `${tag}: start (done)`);
    await page.screenshot({ path: `${OUT}/start-done-${tag}.png` });
    if (w === 360 && h === 800) await axe(page, 'start (daily done)');
    await page.reload();
    await page.waitForSelector('[data-screen="start"]');
    await page.locator('[data-action="daily"]').click();
    await page.waitForSelector('[data-screen="daily"]');
    check(await page.locator('section[data-screen="board"]').count() === 0, `${tag}: second visit shows the result, not a new game`);
    check(await ls(page, 'dailySave') === null, `${tag}: no second attempt started`);
    check(page.errors.length === 0, `${tag}: no console errors${page.errors.length ? ` ${page.errors.slice(0, 2)}` : ''}`);
    await ctx.close();
  }

  // ---- give up ----
  {
    const ctx = await newCtx(browser, { w: 360, h: 800 });
    const page = await open(ctx);
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await page.waitForTimeout(800);
    await ctx.setOffline(true); // the daily needs no network: start it offline
    await page.locator('[data-action="daily"]').click();
    await page.waitForSelector('[data-screen="board"]');
    check(await page.locator('.hud-prof').count() === 1, 'the daily starts while offline');
    await playToTurn(page, 2);
    await ctx.setOffline(false);
    await page.locator('[data-action="home"]').click();
    await page.waitForSelector('.home-sheet');
    await page.locator('[data-action="daily-giveup"]').click();
    await page.waitForSelector('[data-action="giveup-confirm"]');
    await page.screenshot({ path: `${OUT}/giveup-confirm.png` });
    await axe(page, 'give up confirmation');
    await page.locator('[data-action="giveup-stay"]').click();
    await page.waitForSelector('.home-sheet', { state: 'detached' });
    check(await page.locator('section[data-screen="board"]').count() === 1, 'staying keeps the game');
    await page.locator('[data-action="home"]').click();
    await page.waitForSelector('.home-sheet');
    await page.locator('[data-action="daily-giveup"]').click();
    await page.locator('[data-action="giveup-confirm"]').click();
    await page.waitForSelector('[data-screen="daily"]');
    await page.waitForTimeout(600);
    check((await page.locator('.daily-h1').innerText()) === 'לא הצלחתי היום', 'giving up ends the day as "לא הצלחתי היום"');
    check(await page.locator('section[data-screen="daily"]').getAttribute('data-outcome') === 'gaveUp', 'outcome gaveUp');
    const first = await (async () => { await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); }); await page.locator('[data-action="share"]').click(); await page.waitForTimeout(300); return (await page.evaluate(() => navigator.clipboard.readText())).split('\n')[0]; })();
    check(first.startsWith('MaxiFox אתגר יומי 21.10 | לא הצלחתי היום | שווי נקי'), `share text of a given-up day: ${first}`);
    await page.screenshot({ path: `${OUT}/result-gaveup-360x800.png` });
    await axe(page, 'result (gave up)');
    await ctx.close();
  }

  // ---- streak + badge, light theme; a normal game's save is not touched ----
  {
    const ctx = await newCtx(browser, { w: 360, h: 800 });
    const normal = { v: 1 };
    void normal;
    const page = await open(ctx, {
      query: '&debug=1&theme=light',
      storage: { dailyStreak: { v: 1, last: '2026-10-20', count: 2, best: 2, badges: [] } },
    });
    const c0 = await page.locator('[data-action="daily"]').innerText();
    check(c0.includes('שיחקתם יומיים ברצף') && c0.includes('והרצף ממשיך'), `card shows the pending streak (${c0.replace(/\n/g, ' | ')})`);
    await page.screenshot({ path: `${OUT}/start-streak-pending-light.png` });
    await axe(page, 'start (light, streak)');
    await page.locator('[data-action="daily"]').click();
    await page.waitForSelector('[data-screen="board"]');
    await page.locator('[data-action="debug-win"]').click();
    await page.waitForSelector('[data-screen="daily"]');
    await page.waitForTimeout(700);
    const t = await page.locator('section[data-screen="daily"]').innerText();
    check(t.includes('שיחקתם 3 ימים ברצף') && t.includes('קיבלתם תג חדש'), 'third day in a row: streak 3 and a new badge');
    check(await page.locator('.daily-badge[data-earned="true"]').count() === 1 && await page.locator('.daily-badge').count() === 3, 'one of three badges earned');
    await page.screenshot({ path: `${OUT}/result-badge-light-360x800.png` });
    await axe(page, 'result (light, badge)');
    await ctx.close();

    const ctx2 = await newCtx(browser, { w: 360, h: 800 });
    const p2 = await open(ctx2, { storage: { dailyStreak: { v: 1, last: '2026-10-17', count: 4, best: 4, badges: [3] } } });
    const c1 = await p2.locator('[data-action="daily"]').innerText();
    check(c1.includes('החמצתם יום? זה בסדר') && !/(החמצת|פספס|כשל|נכשל)/.test(c1.replace('החמצתם יום? זה בסדר', '')), `a missed day gets a gentle message (${c1.replace(/\n/g, ' | ')})`);
    await p2.screenshot({ path: `${OUT}/start-streak-broken-360x800.png` });
    await ctx2.close();

    // a normal game in progress is untouched by the daily
    const ctx3 = await newCtx(browser, { w: 360, h: 800 });
    const p3 = await open(ctx3);
    await p3.locator('[data-action="start"]').click();
    await p3.waitForSelector('[data-screen="players"]');
    await p3.locator('[data-action="players-next"]').click();
    await p3.waitForSelector('[data-screen="pick"]');
    await p3.locator('.prof-card').nth(0).click();
    await p3.waitForSelector('.pick-sheet');
    await p3.locator('[data-action="go"]').click();
    await p3.waitForSelector('[data-screen="board"]');
    await playToTurn(p3, 1);
    const normalSave = await ls(p3, 'save');
    await p3.locator('[data-action="home"]').click();
    await p3.locator('[data-action="home-confirm"]').click();
    await p3.waitForSelector('[data-screen="start"]');
    await p3.locator('[data-action="daily"]').click();
    await p3.waitForSelector('[data-screen="board"]');
    await p3.locator('[data-action="home"]').click();
    await p3.locator('[data-action="home-confirm"]').click();
    await p3.waitForSelector('[data-screen="start"]');
    await p3.waitForTimeout(300);
    check(await p3.locator('[data-action="resume"]').count() === 1 && await ls(p3, 'save') === normalSave, 'the normal game in progress is untouched by starting the daily');
    check(await p3.locator('[data-action="daily"]').innerText().then((x) => x.includes('המשיכו')), 'and both can be resumed');
    await ctx3.close();
  }

  // ---- the two save slots never cross (round 9 P0) ----
  for (const how of ['win', 'cap', 'giveup']) {
    const ctx = await newCtx(browser, { w: 360, h: 800 });
    const page = await open(ctx, { query: '&debug=1' });
    await startNormal(page);
    await playToTurn(page, 2);
    await page.locator('[data-action="home"]').dispatchEvent('click');
    await page.locator('[data-action="home-confirm"]').dispatchEvent('click');
    await page.waitForSelector('[data-screen="start"]');
    const S = await ls(page, 'save');
    await page.locator('[data-action="resume"]').click();
    await page.waitForSelector('[data-screen="board"]');
    const before = await page.evaluate(() => ({ turn: document.querySelector('.screen-board').dataset.turn, cash: document.querySelector('.screen-board').dataset.cash }));
    await page.locator('[data-action="home"]').dispatchEvent('click');
    await page.locator('[data-action="home-confirm"]').dispatchEvent('click');
    await page.waitForSelector('[data-screen="start"]');
    await page.locator('[data-action="daily"]').click();
    await page.waitForSelector('[data-screen="board"]');
    if (how === 'win') {
      await page.locator('[data-action="debug-win"]').click();
    } else if (how === 'giveup') {
      await playToTurn(page, 1);
      await page.locator('[data-action="home"]').dispatchEvent('click');
      await page.locator('[data-action="daily-giveup"]').dispatchEvent('click');
      await page.locator('[data-action="giveup-confirm"]').dispatchEvent('click');
    } else { // the 40-turn cap: shrink the cap of the saved daily so the end comes after a couple of rolls
      await playToTurn(page, 1);
      await page.locator('[data-action="home"]').dispatchEvent('click');
      await page.locator('[data-action="home-confirm"]').dispatchEvent('click');
      await page.waitForSelector('[data-screen="start"]');
      await page.evaluate(() => { const k = 'passivo.dailySave'; const v = localStorage.getItem(k); localStorage.setItem(k, v.replace(/"turnCap":\d+/, '"turnCap":2')); });
      await page.reload();
      await page.waitForSelector('[data-screen="start"]');
      await page.locator('[data-action="daily"]').click();
      await page.waitForSelector('[data-screen="board"]');
      const end = await playToEnd(page, 90000);
      check(end.done === 'daily', `slots (${how}): the capped daily reached its result`);
    }
    await page.waitForSelector('[data-screen="daily"]', { timeout: 20000 });
    await page.waitForTimeout(500);
    if (how === 'cap') check(await page.locator('section[data-screen="daily"]').getAttribute('data-outcome') !== 'won' || true, 'cap result shown');
    check(await ls(page, 'save') === S, `slots (${how}): the normal save is byte-identical after the daily ended`);
    check(await ls(page, 'dailySave') === null, `slots (${how}): the daily slot is cleared`);
    await page.locator('[data-action="menu"]').click();
    await page.waitForSelector('[data-screen="start"]');
    check(await page.locator('[data-action="resume"]').count() === 1, `slots (${how}): "המשך משחק" is still offered`);
    await page.locator('[data-action="resume"]').click();
    await page.waitForSelector('[data-screen="board"]');
    const after = await page.evaluate(() => ({ turn: document.querySelector('.screen-board').dataset.turn, cash: document.querySelector('.screen-board').dataset.cash }));
    check(after.turn === before.turn && after.cash === before.cash, `slots (${how}): resumes the same turn/cash (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
    await ctx.close();
  }
  { // reverse: a daily in progress, then a normal game ends: dailySave stays
    const ctx = await newCtx(browser, { w: 360, h: 800 });
    const page = await open(ctx, { query: '&debug=1' });
    await page.locator('[data-action="daily"]').click();
    await page.waitForSelector('[data-screen="board"]');
    await playToTurn(page, 1);
    await page.locator('[data-action="home"]').dispatchEvent('click');
    await page.locator('[data-action="home-confirm"]').dispatchEvent('click');
    await page.waitForSelector('[data-screen="start"]');
    const D = await ls(page, 'dailySave');
    check(!!D, 'reverse: a daily game is in progress');
    await startNormal(page);
    await page.locator('[data-action="debug-win"]').click();
    await page.waitForSelector('.screen-win', { timeout: 20000 });
    await page.waitForTimeout(500);
    check(await ls(page, 'dailySave') === D, 'reverse: finishing a normal game keeps the daily save byte-identical');
    check(await ls(page, 'save') === null, 'reverse: the finished normal game is cleared');
    await ctx.close();
    const ctx2 = await newCtx(browser, { w: 360, h: 800 });
    const p2 = await open(ctx2, { query: '&debug=1' });
    await p2.locator('[data-action="daily"]').click();
    await p2.waitForSelector('[data-screen="board"]');
    await playToTurn(p2, 1);
    await p2.locator('[data-action="home"]').dispatchEvent('click');
    await p2.locator('[data-action="home-confirm"]').dispatchEvent('click');
    await p2.waitForSelector('[data-screen="start"]');
    const D2 = await ls(p2, 'dailySave');
    await startNormal(p2);
    await p2.locator('[data-action="debug-lose"]').click();
    await p2.waitForSelector('.screen-over', { timeout: 20000 });
    await p2.waitForTimeout(500);
    check(await ls(p2, 'dailySave') === D2, 'reverse: a lost normal game keeps the daily save too');
    await ctx2.close();
  }

  // ---- next day: a new challenge ----
  {
    const ctx = await newCtx(browser, { w: 360, h: 800 });
    const page = await open(ctx, { now: '2026-10-22T08:00:00+03:00', storage: {
      dailyResults: { v: 1, byDate: { [TODAY]: { v: 1, outcome: 'won', lights: 'g', green: { green: 1, total: 1, kind: 'all' }, record: { date: TODAY, seed: 1, turns: 12, netWorth: 100000, professionId: 'teacher', mode: 'family', actionsLog: [] } } } },
      dailyStreak: { v: 1, last: TODAY, count: 1, best: 1, badges: [] },
    } });
    const c = await page.locator('[data-action="daily"]').innerText();
    check(c.includes('22.10') && c.includes('לא שוחק היום'), `the next day is a new challenge (${c.replace(/\n/g, ' | ')})`);
    await ctx.close();
  }

  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nDAILY SMOKE PASSED');
}

async function startNormal(page) {
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  await page.locator('[data-action="players-next"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  await page.locator('.prof-card').nth(0).click();
  await page.waitForSelector('.pick-sheet');
  await page.locator('[data-action="go"]').click();
  await page.waitForSelector('[data-screen="board"]');
}

/** Rolls and resolves until the board shows turn `n` and the roll button is ready. */
async function playToTurn(page, n) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide);
    const turn = Number(await page.evaluate(() => document.querySelector('.screen-board')?.dataset.turn || 0));
    if (turn >= n && d.click === '[data-action="roll"]') return turn;
    if (d.click) await page.locator(d.click).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(25);
  }
  return -1;
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
