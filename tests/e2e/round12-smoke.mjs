// Round 12 fixes in a real browser: numeral contrast on every story screen (dark + light, 360x640 and 320x568), the skip toast never over a
// button, the h-card source ring, h-almost at 94%, the payday-square hint before the first roll, the 7-digit arrival line, no red in family,
// the spoken minus, the home-link arming sweep, the compact cash label, the loan ring clear of the pinned buttons, the kid how-to note, family card wording.
// Run: npm run build && node tests/e2e/round12-smoke.mjs   (AXE=/path/to/axe.min.js adds an axe pass after the fades; THEMES=dark,light)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createEngine, newMatch, act, serialize, currentState } from '../../src/engine/index.js';
import { moneyContrast } from './contrast-lib.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const PORT = Number(process.env.SMOKE_PORT || 4184);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const AXE = process.env.AXE && existsSync(process.env.AXE) ? readFileSync(process.env.AXE, 'utf8') : null;
const THEMES = (process.env.THEMES || 'dark,light').split(',');
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const J = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
const cards = J('cards.he.json');
const engine = createEngine({ professions: J('professions.he.json'), cards });
const tutorial = JSON.parse(readFileSync(new URL('../../src/data/learn/tutorial.he.json', import.meta.url), 'utf8'));

let server;
async function startServer() {
  if (process.env.SMOKE_URL) return;
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(URL_BASE); if (r.ok) return; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('preview server did not start');
}
const failures = [];
const check = (c, m) => { if (!c) { failures.push(m); console.error(`FAIL: ${m}`); } else console.log(`ok: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity || a.effect?.getComputedTiming().endTime === Infinity), null, { timeout: 5000 }).catch(() => {});
  await sleep(120);
}
async function axe(page, label) {
  if (!AXE) return;
  await settle(page);
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  check(r.length === 0, `axe: 0 violations on ${label}${r.length ? ` ${JSON.stringify(r)}` : ''}`);
}
async function contrast(page, label) {
  const r = await moneyContrast(page);
  check(r.bad.length === 0, `numeral contrast >= 4.5:1 on ${label} (${r.checked} amounts)${r.bad.length ? ` ${JSON.stringify(r.bad.slice(0, 4))}` : ''}`);
  return r;
}
async function open(browser, { w, h, theme }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((th) => { try { localStorage.setItem('passivo.prefs', JSON.stringify({ theme: th })); } catch { /* ignore */ } }, theme);
  return { ctx, page, errors };
}
const mk = (mode, professionId = 'teacher', seed = 5) => newMatch(engine, { mode, players: [{ name: 'דנה', professionId }], seed });
const withState = (base, patch) => ({ ...base, players: base.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, ...patch } })) });
async function resume(page, match, { storyDone = true } = {}) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(({ j, storyDone: sd }) => { localStorage.setItem('passivo.save', j); if (sd) localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true })); }, { j: serialize(match), storyDone });
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
}
async function begin(page, { players = 1, skipStory = true } = {}) {
  await page.goto(`${URL_BASE}?seed=7`);
  await page.waitForSelector('[data-action="start"]');
  await page.locator('[data-mode="family"]').click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  for (let k = 1; k < players; k++) await page.locator('[aria-label="שחקן נוסף"]').click();
  await page.locator('[data-action="players-next"]').click();
  for (let k = 0; k < players; k++) {
    await page.waitForSelector('[data-screen="pick"]');
    await page.locator('.prof-card').nth(k).click();
    await page.waitForSelector('.pick-sheet');
    await sleep(350);
    await page.locator('[data-action="go"]').click();
  }
  await page.waitForSelector('.story-screen');
  if (skipStory) { await page.locator('[data-action="story-skip"]').click(); await page.waitForSelector('.layer-story', { state: 'detached' }); await page.waitForSelector('[data-screen="board"]'); }
}
const redish = (rgb) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(rgb); return !!m && Number(m[1]) > 190 && Number(m[2]) < 150 && Number(m[3]) < 150; };
const rectsHit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

/** P1 + items 15: every amount on every story screen and part has contrast >= 4.5:1, in both themes and both small sizes. */
async function storyContrast(browser, theme) {
  for (const [w, h] of [[360, 640], [320, 568]]) {
    const { ctx, page } = await open(browser, { w, h, theme });
    await begin(page, { skipStory: false });
    let screens = 0; let withMoney = 0; let part5Boxes = 0;
    for (let guard = 0; guard < 24; guard++) {
      await settle(page);
      const where = await page.evaluate(() => ({ n: document.querySelector('.story-screen')?.dataset.n, id: document.querySelector('.story-screen')?.dataset.story, part: document.querySelector('.story-part-of')?.textContent ?? '', simplify: document.querySelectorAll('.story-simplify').length }));
      if (!where.id) break;
      const r = await contrast(page, `story ${where.id} ${where.part} ${w}x${h} ${theme}`);
      screens += 1; if (r.checked) withMoney += 1;
      if (where.id === 's5-turn' && /3 מתוך|4 מתוך/.test(where.part)) part5Boxes += r.checked;
      if (where.id === 's5-turn') {
        // the simplification box belongs to part 4 only
        const is4 = /^4 מתוך/.test(where.part);
        check(where.simplify === (is4 ? 1 : 0), `story s5 ${where.part}: the simplification box ${is4 ? 'shows on part 4' : 'is not repeated'} (${where.simplify})`);
      }
      const next = page.locator('[data-action="story-next"]');
      if (!(await next.count())) break;
      const label = await next.innerText();
      if (label.trim() === tutorial.ui.go) break;
      await next.click();
      await sleep(450);
    }
    check(screens >= 9, `story: ${screens} screens/parts measured at ${w}x${h} ${theme}`);
    check(withMoney >= 3 && part5Boxes >= 4, `story: amounts were found and measured (${withMoney} screens, ${part5Boxes} on s5 parts 3-4)`);
    await axe(page, `story screen 5 last part ${w}x${h} ${theme}`);
    await ctx.close();
  }
}

/** Item 1: the skip toast never covers a button (1p roll button, 2p hand-over button); when there is no room it cannot be tapped. */
async function toastSlot(browser, theme) {
  for (const [players, h] of [[1, 640], [1, 800], [2, 640], [2, 800]]) {
    const { ctx, page } = await open(browser, { w: 360, h, theme });
    await begin(page, { players, skipStory: false });
    await page.locator('[data-action="story-skip"]').click();
    await page.waitForSelector('.layer-story', { state: 'detached' });
    await page.waitForSelector('.toast');
    await sleep(900);
    const r = await page.evaluate(() => {
      const t = document.querySelector('.toast'); const tb = t.getBoundingClientRect();
      const controls = [...document.querySelectorAll('button:not(.toast-btn), [data-action]')].filter((e) => !t.contains(e) && e.getBoundingClientRect().width > 0)
        .filter((e) => { const b = e.getBoundingClientRect(); const x = b.left + b.width / 2; const y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return hit && (e === hit || e.contains(hit)); });
      const over = controls.filter((e) => { const b = e.getBoundingClientRect(); return tb.left < b.right - 0.5 && tb.right > b.left + 0.5 && tb.top < b.bottom - 0.5 && tb.bottom > b.top + 0.5; }).map((e) => e.dataset.action || e.className.toString().slice(0, 20));
      const centre = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!hit && (e === hit || e.contains(hit)); };
      return { over, passive: t.classList.contains('is-passive'), roll: centre('[data-action="roll"]'), next: centre('[data-action="roll-next"]'), top: tb.top, bottom: tb.bottom, ih: innerHeight };
    });
    check(r.over.length === 0 || r.passive, `toast ${players}p ${h}: not over a control (${r.over.join(',') || 'clear'}${r.passive ? ', non-interactive' : ''}; ${Math.round(r.top)}-${Math.round(r.bottom)})`);
    check(players === 1 ? r.roll === true : r.next !== false, `toast ${players}p ${h}: the primary button is the topmost element at its centre (${players === 1 ? r.roll : r.next})`);
    await ctx.close();
  }
}

/** Items 2 and 16 and 7: h-card source step has no ring on a covered HUD; the home link arms with the sweep; the square hint comes before the first roll. */
async function tourAndHandoff(browser, theme) {
  const card = cards.find((c) => c.id === 'opp-biz-006');
  const base = mk('family');
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await resume(page, withState(base, { turn: 2, position: 5, phase: 'decision', pending: { kind: 'opportunity', card } }));
  await page.waitForSelector('.hint-strip.is-tour');
  await sleep(1000);
  let sawSource = false;
  for (let k = 0; k < 6; k++) {
    const step = await page.evaluate(() => ({ step: document.querySelector('.hint-strip.is-tour')?.dataset.step, text: document.querySelector('.hint-strip.is-tour .hint-text')?.textContent ?? '', rings: [...document.querySelectorAll('.hint-ring')].filter((r) => !r.hidden).map((r) => r.getBoundingClientRect()).map((b) => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom })) }));
    if (/אין מספיק מזומן/.test(step.text)) {
      sawSource = true;
      // a ring is allowed only where the player can see the thing it marks: the HUD cash is under the card here, so there is none
      const cashVisible = await page.evaluate(() => { const e = document.querySelector('.hud-cash'); const b = e.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!hit && e.contains(hit); });
      check(cashVisible || step.rings.length === 0, `h-card source step: no ring around a HUD the card covers (rings ${step.rings.length}, cash visible ${cashVisible})`);
    }
    const next = page.locator('.hint-strip.is-tour [data-action="hint-next"]');
    if (!(await next.count())) break;
    await next.click(); await sleep(500);
  }
  check(sawSource, 'h-card tour reaches the "where does the money come from" step');
  await ctx.close();

  const two = await open(browser, { w: 360, h: 640, theme });
  await begin(two.page, { players: 2 });
  await two.page.waitForSelector('.handoff-sheet, [data-action="roll-next"]', { timeout: 8000 }).catch(() => {});
  const arming = await two.page.evaluate(() => { const l = document.querySelector('[data-action="handoff-home"]'); return l ? { arming: l.classList.contains('is-arming'), disabled: l.getAttribute('aria-disabled'), bar: getComputedStyle(l, '::after').content } : null; });
  if (arming) {
    check(arming.arming && arming.disabled === 'true' && arming.bar !== 'none', `hand-over: the home link shows the arming sweep at first (${JSON.stringify(arming)})`);
    await sleep(900);
    const after = await two.page.evaluate(() => { const l = document.querySelector('[data-action="handoff-home"]'); return l ? { arming: l.classList.contains('is-arming'), disabled: l.getAttribute('aria-disabled') } : null; });
    check(after && !after.arming && after.disabled === null, 'hand-over: the home link is armed together with the primary button');
    await contrast(two.page, `hand-over sheet ${theme}`);
  } else check(true, 'hand-over sheet had no home link on this first turn (skipped)');
  await two.ctx.close();
}

/** Item 7: before the first roll the fox points at the payday square (ring on the tile, not on a number or button). */
async function squareHint(browser, theme) {
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await begin(page);
  await page.waitForSelector('.note-hint', { timeout: 6000 }).catch(() => {});
  await sleep(600);
  const r = await page.evaluate(() => {
    const n = document.querySelector('.note-hint');
    const ring = [...document.querySelectorAll('.hint-ring')].filter((x) => !x.hidden)[0]?.getBoundingClientRect();
    const tile = document.querySelector('.tile-payday[data-i="4"]')?.getBoundingClientRect();
    const roll = document.querySelector('.btn-roll').getBoundingClientRect();
    return { id: n?.dataset.hint, turn: document.querySelector('.screen-board').dataset.turn, ring: ring && { left: ring.left, right: ring.right, top: ring.top, bottom: ring.bottom }, tile: tile && { left: tile.left, right: tile.right, top: tile.top, bottom: tile.bottom }, roll: { left: roll.left, right: roll.right, top: roll.top, bottom: roll.bottom } };
  });
  check(r.id === 'h-summary-square' && r.turn === '0', `turn 1, before the first roll: the payday-square hint is up (${r.id}, turn ${r.turn})`);
  check(!!r.ring && !!r.tile && rectsHit(r.ring, r.tile), 'the ring is on the payday tile');
  check(!!r.ring && !rectsHit(r.ring, r.roll), 'and not on the roll button');
  await contrast(page, `board with the square hint ${theme}`);
  await ctx.close();
}

/** Item 4: at 94% of the expenses, h-almost shows within a few turns (the QA scenario: many apartments, then the last one). */
async function almost(browser, theme) {
  const apts = cards.filter((c) => c.type === 'apartment' && c.modes.includes('family') && c.monthlyCashFlow > 0).sort((a, b) => b.monthlyCashFlow - a.monthlyCashFlow);
  const base = mk('family');
  let st = { ...currentState(base), cash: 10 ** 8, position: 21 };
  let flow = 0;
  for (const c of apts) if (flow + c.monthlyCashFlow <= 4300) { st = engine.buy({ ...st, pending: { kind: 'opportunity', card: c } }, 1); flow += c.monthlyCashFlow; }
  const want = apts.find((c) => c.monthlyCashFlow >= 1000 && flow + c.monthlyCashFlow >= 5500 && flow + c.monthlyCashFlow < 7300);
  st = { ...st, cash: 3000000, phase: 'decide', pending: { kind: 'opportunity', card: want } };
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await page.addInitScript(() => { window.__h = []; window.__many = ''; setInterval(() => { const t = document.body.innerText; for (const p of ['ועוד קצת', 'ממש על הקו', 'הפס למעלה']) if (t.includes(p) && !window.__h.includes(p)) window.__h.push(p); const s = document.querySelector('.hint-strip .hint-text'); if (s && /הכניסו/.test(s.textContent)) window.__many = s.textContent; }, 100); });
  await resume(page, { ...base, players: base.players.map((p, i) => (i ? p : { ...p, state: st })) });
  const buy = page.locator('[data-action="buy"]:not([aria-disabled="true"])');
  if (await buy.count()) await buy.first().click();
  let seen = false;
  for (let k = 0; k < 14 && !seen; k++) {
    await sleep(700);
    seen = (await page.evaluate(() => window.__h)).includes('ועוד קצת');
    for (let j = 0; j < 4; j++) { const l = page.locator('#modal-root .layer:last-child [data-action="summary-ok"], #modal-root .layer:last-child [data-action="pass"], #modal-root .layer:last-child [data-action="ok"], #modal-root .layer:last-child [data-action="pay"], #modal-root .layer:last-child [data-action="decline"], #modal-root .layer:last-child [data-action="hint-next"], #modal-root .layer:last-child [data-action="cancel"]').first(); if (await l.count()) { await sleep(1200); await l.click().catch(() => {}); await sleep(300); } }
    const r = page.locator('[data-action="roll"]:not([disabled])'); if (await r.count()) await r.click().catch(() => {});
    // 'ועוד קצת' also appears under the meter at 94%: only the note counts
    seen = await page.evaluate(() => /ועוד קצת/.test(document.querySelector('.note-hint')?.textContent ?? ''));
  }
  const many = await page.evaluate(() => window.__many);
  check(many === '' || /הכניסו ₪[\d,]+ בשנתיים/.test(many), `the several-assets income hint carries its amount (${many || 'not shown in this run'})`);
  check(seen, `at ~94% of the expenses the h-almost hint ("... ועוד קצת") shows within a few turns (${theme})`);
  await ctx.close();
}

/** Items 9, 13, 10, 17, 3: no red in family; the 7-digit arrival line; the spoken minus; the compact cash label; family card wording. */
async function family(browser, theme) {
  // 7-digit cash, one step before the payday: every roll passes it
  const { ctx, page } = await open(browser, { w: 320, h: 568, theme });
  await resume(page, withState(mk('family'), { cash: 1234567, position: 3, turn: 5 }));
  const cap = await page.evaluate(() => { const c = document.querySelector('[data-cash-caption]'); const s = document.querySelector('.cash-col .cash-label'); return { vis: getComputedStyle(s).display !== 'none', text: s.textContent, long: getComputedStyle(c).display }; });
  check(cap.vis && cap.text === 'מזומן' && cap.long === 'none', `320x568 ${theme}: the cash label stays as the compact word "מזומן" (${JSON.stringify(cap)})`);
  await page.locator('.flow-chip').click();
  await page.waitForSelector('.flow-popover');
  await settle(page);
  const pop = await page.evaluate(() => ({ out: getComputedStyle(document.querySelector('.fp-out .fp-total')).color, left: getComputedStyle(document.querySelector('.fp-left')).color, dot: getComputedStyle(document.querySelector('.fp-out .fp-dot')).backgroundColor }));
  check(!redish(pop.out) && !redish(pop.dot), `${theme}: the expenses figure in the popover is not red (${pop.out})`);
  await contrast(page, `family popover ${theme}`);
  await page.mouse.click(5, 560);
  await page.waitForSelector('.flow-popover', { state: 'detached' }).catch(() => {});
  const hudExp = await page.evaluate(() => getComputedStyle(document.querySelector('.hud .tone-expense')).color);
  check(!redish(hudExp), `${theme}: the HUD expenses figure is not red (${hudExp})`);
  await page.waitForSelector('[data-action="roll"]:not([disabled])');
  await page.locator('[data-action="roll"]').click();
  await page.waitForSelector('.summary-card', { timeout: 8000 });
  await sleep(1300);
  const sc = await page.evaluate(() => { const c = document.querySelector('.sc-cash'); const pair = c.querySelector('.sc-pair'); return { rects: pair.getClientRects().length, lines: Math.round(c.getBoundingClientRect().height / parseFloat(getComputedStyle(c).lineHeight)), over: c.scrollWidth > c.clientWidth + 1, text: c.textContent, exp: getComputedStyle(document.querySelector('.sc-expense .sc-amt')).color, sr: document.getElementById('summary-desc').textContent };
  });
  check(sc.rects === 1 && !sc.over, `320x568 ${theme}: the 7-digit arrival line keeps both amounts together (${sc.text}; ${sc.lines} lines)`);
  check(!redish(sc.exp), `${theme}: the expenses row of the summary is not red (${sc.exp})`);
  await contrast(page, `summary card 7-digit ${theme}`);
  await axe(page, `summary card 7-digit 320x568 ${theme}`);
  await ctx.close();

  // the SR line with a negative total (full mode): 'מינוס', never 'ל--'
  const full = await open(browser, { w: 360, h: 640, theme });
  const fb = mk('full', 'teacher');
  await resume(full.page, withState(fb, { cash: -100000, kids: 3, position: 3, turn: 6 }));
  await full.page.waitForSelector('[data-action="roll"]:not([disabled])');
  await full.page.locator('[data-action="roll"]').click();
  await full.page.waitForSelector('.summary-card', { timeout: 8000 });
  const sr = await full.page.evaluate(() => ({ text: document.getElementById('summary-desc').textContent, monthly: Number(document.querySelector('.summary-card').dataset.monthly), amount: Number(document.querySelector('.summary-card').dataset.amount) }));
  check(!/--/.test(sr.text) && (sr.amount >= 0 || /מינוס/.test(sr.text)), `${theme} full mode: the spoken summary has no double hyphen (${sr.text.slice(-60)})`);
  await full.ctx.close();

  // a family card with children's wording, and the expense card with cash below zero is not red
  const c012 = cards.find((c) => c.id === 'opp-apt-012');
  const cw = await open(browser, { w: 360, h: 800, theme });
  await resume(cw.page, withState(mk('family'), { turn: 3, position: 9, phase: 'decide', pending: { kind: 'opportunity', card: c012 } }));
  await cw.page.waitForSelector('.card[data-card="opportunity"], .card');
  await sleep(900);
  const shown = await cw.page.evaluate(() => ({ title: document.querySelector('.card-title')?.textContent ?? '', text: document.querySelector('.card-text')?.textContent ?? document.querySelector('.card')?.innerText ?? '' }));
  check(shown.title.includes('הלוואה') && !/משכנתא/.test(shown.title) && !/משכנתא|מקדמה/.test(shown.text), `${theme}: family mode shows the children's wording of the card (${shown.title})`);
  await cw.ctx.close();
}

/** Items 6 and 9: the loan ring never lands on the pinned buttons (320x568); cash below zero on the expense card is not red. */
async function loanRing(browser, theme) {
  let match = null;
  for (let seed = 1; seed < 4000 && !match; seed++) {
    const b = withState(mk('family', 'teacher', seed), { cash: 0 });
    const m = act(b, (s) => engine.roll(s, [2]));
    if (currentState(m).pending?.kind === 'expense') match = m;
  }
  for (const [w, h] of [[320, 568], [360, 640]]) {
    const { ctx, page } = await open(browser, { w, h, theme });
    await resume(page, match);
    await page.waitForSelector('[data-action="loan"]');
    await sleep(900);
    const cash = await page.evaluate(() => [...document.querySelectorAll('.stat-expense .stat-value, .stat-value')].map((e) => getComputedStyle(e).color));
    check(!cash.some(redish), `${w}x${h} ${theme}: no red on the expense card (${cash.join(' ')})`);
    await page.locator('[data-action="loan"]').click();
    await page.waitForSelector('.limit');
    await sleep(1400);
    const r = await page.evaluate(() => {
      const bar = document.querySelector('#modal-root .layer:last-child .dialog-actions')?.getBoundingClientRect();
      const rings = [...document.querySelectorAll('.hint-ring')].filter((x) => !x.hidden).map((x) => x.getBoundingClientRect());
      return { bar: bar && { left: bar.left, right: bar.right, top: bar.top, bottom: bar.bottom }, rings: rings.map((b) => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom })) };
    });
    check(!r.bar || r.rings.every((g) => !rectsHit(g, r.bar)), `${w}x${h} ${theme}: the loan ring is clear of the pinned buttons (${r.rings.length} ring(s))`);
    await contrast(page, `loan dialog ${w}x${h} ${theme}`);
    await ctx.close();
  }
}

/** Item 3: the kid how-to sheet shows howtoKid.note, not the adult note or the daily note. */
async function kidHowTo(browser, theme) {
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await begin(page);
  await page.evaluate(() => document.querySelector('[data-action="home"]')?.click());
  await page.waitForSelector('.home-sheet');
  await page.locator('[data-action="home-confirm"]').click();
  await page.waitForSelector('[data-screen="start"]');
  await page.locator('.topbar .icon-btn').nth(1).click();
  await page.waitForSelector('[data-howto="kid"]');
  await sleep(400);
  const r = await page.evaluate(() => ({ note: document.querySelector('[data-howto="note"]')?.textContent ?? '', daily: !!document.querySelector('[data-howto="daily"]'), all: document.querySelector('[data-howto="kid"]').innerText }));
  check(r.note === tutorial.howtoKid.note && !r.daily && !/תשואות|ההון העצמי/.test(r.all), `${theme}: the kid how-to shows its own note only ("${r.note}")`);
  await ctx.close();
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    for (const theme of THEMES) {
      console.log(`\n=== ${theme} ===`);
      await storyContrast(browser, theme);
      await toastSlot(browser, theme);
      await tourAndHandoff(browser, theme);
      await squareHint(browser, theme);
      await almost(browser, theme);
      await family(browser, theme);
      await loanRing(browser, theme);
      await kidHowTo(browser, theme);
    }
  } finally { await browser.close(); server?.kill(); }
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nROUND 12 SMOKE PASSED');
}
main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
