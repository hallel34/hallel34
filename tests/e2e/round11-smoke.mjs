// Round 11 fixes in a real browser: the hand-over button arms itself, the summary card ignores a stray tap, the first loan hint is
// visible without scrolling, the family popover stays small, the goal line is never hidden, Back steps through the story.
// Run: npm run build && node tests/e2e/round11-smoke.mjs   (AXE=/path/to/axe.min.js adds an axe pass on every touched state, after the fades)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createEngine, newMatch, act, serialize, currentState } from '../../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const PORT = Number(process.env.SMOKE_PORT || 4183);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const AXE = process.env.AXE && existsSync(process.env.AXE) ? readFileSync(process.env.AXE, 'utf8') : null;
const THEMES = (process.env.THEMES || 'dark,light').split(',');
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const J = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: J('professions.he.json'), cards: J('cards.he.json') });

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

/** Waits until every finite animation has ended (axe must never run mid-fade), then a beat for the compositor. */
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
async function open(browser, { w, h, theme }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((th) => {
    try { localStorage.setItem('passivo.prefs', JSON.stringify({ theme: th })); } catch { /* ignore */ }
    // when a hand-over sheet / summary card appeared (ms), so a tap can be timed against its age
    window.__born = {};
    document.addEventListener('DOMContentLoaded', () => new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n instanceof Element) { for (const k of ['handoff-sheet', 'summary-card']) if (n.querySelector?.(`.${k}`) || n.classList?.contains(k)) window.__born[k] = performance.now(); }
    }).observe(document.body, { childList: true, subtree: true }));
  }, theme);
  return { ctx, page, errors };
}
/** A saved family match waiting on an expense the player cannot pay (cash 0): its 'loan' button opens the first loan dialog. */
function expenseMatch() {
  for (let seed = 1; seed < 4000; seed++) {
    const base = newMatch(engine, { mode: 'family', players: [{ name: 'דנה', professionId: 'teacher' }], seed });
    const broke = { ...base, players: base.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, cash: 0 } })) };
    const m = act(broke, (s) => engine.roll(s, [2])); // square 2 is an expense card: with no cash it must be paid with a loan
    if (currentState(m).pending?.kind === 'expense') return m;
  }
  throw new Error('no expense seed');
}
async function resume(page, match) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate((j) => localStorage.setItem('passivo.save', j), serialize(match));
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
const topKind = (page) => page.evaluate(() => {
  const layers = [...document.querySelectorAll('#modal-root .layer')];
  const top = layers[layers.length - 1];
  if (!top) return 'none';
  if (top.querySelector('.summary-card')) return 'summary';
  if (top.querySelector('.handoff-sheet')) return 'handoff';
  if (top.querySelector('.card')) return 'card';
  return 'layer';
});

/** P1-3: the first loan hint strip is inside the viewport (no scrolling) and above the pinned buttons, at every size. */
async function loanStrip(browser, theme) {
  for (const [w, h] of [[360, 800], [360, 640], [320, 568]]) {
    const { ctx, page } = await open(browser, { w, h, theme });
    await resume(page, expenseMatch());
    await page.waitForSelector('[data-action="loan"]');
    await sleep(900);
    await page.locator('[data-action="loan"]').click();
    await page.waitForSelector('.limit');
    await settle(page);
    const r = await page.evaluate(() => {
      const strip = document.querySelector('#modal-root .layer:last-child .hint-strip');
      if (!strip) return null;
      const b = strip.getBoundingClientRect();
      const btn = [...document.querySelectorAll('#modal-root .layer:last-child .dialog-actions .btn, #modal-root .layer:last-child .sheet-cta .btn')].map((e) => e.getBoundingClientRect().top).sort((a, c) => a - c)[0];
      return { top: b.top, bottom: b.bottom, ih: innerHeight, btnTop: btn ?? null, text: strip.textContent.trim() };
    });
    check(!!r, `${w}x${h} ${theme}: the first loan dialog shows the hint strip`);
    if (r) {
      check(r.top >= 0 && r.bottom <= r.ih, `${w}x${h} ${theme}: the loan hint strip is inside the viewport without scrolling (${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.ih})`);
      check(r.btnTop == null || r.bottom <= r.btnTop + 0.5, `${w}x${h} ${theme}: ...and above the pinned buttons (${Math.round(r.bottom)} <= ${Math.round(r.btnTop)})`);
    }
    if (w === 360 && h === 800 || h === 568) await axe(page, `loan dialog ${w}x${h} ${theme}`);
    await ctx.close();
  }
}

/** Family HUD: goal line never hidden, popover compact (<= 40% of the board) and clear of the roll button. */
async function hud(browser, theme) {
  for (const [w, h] of [[360, 800], [360, 640], [320, 568]]) {
    const { ctx, page } = await open(browser, { w, h, theme });
    await begin(page);
    await sleep(900);
    const g = await page.evaluate(() => { const e = document.querySelector('.goal-line'); return { hidden: !e || e.hidden || getComputedStyle(e).display === 'none', text: e?.textContent ?? '', h: e?.getBoundingClientRect().height ?? 0 }; });
    check(!g.hidden && g.text.length > 4 && g.h > 0, `${w}x${h} ${theme}: the goal line is never hidden ("${g.text}")`);
    await page.locator('.flow-chip').click();
    await page.waitForSelector('.flow-popover');
    await settle(page);
    const p = await page.evaluate(() => {
      const pop = document.querySelector('.flow-popover').getBoundingClientRect(); const board = document.querySelector('.board').getBoundingClientRect(); const roll = document.querySelector('.btn-roll').getBoundingClientRect();
      const foot = document.querySelector('.fp-foot'); const nowrapOk = !foot || getComputedStyle(foot).display === 'none' || [...foot.querySelectorAll('.nowrap')].every((n) => n.getClientRects().length === 1);
      return { popH: pop.height, boardH: board.height, popBottom: pop.bottom, rollTop: roll.top, nowrapOk };
    });
    check(p.popH <= p.boardH * 0.4 + 0.5, `${w}x${h} ${theme}: the popover is at most 40% of the board (${Math.round(p.popH)} of ${Math.round(p.boardH)})`);
    check(p.popBottom <= p.rollTop, `${w}x${h} ${theme}: the popover never reaches the roll button`);
    check(p.nowrapOk, `${w}x${h} ${theme}: '× 24' stays on one line`);
    await axe(page, `family HUD popover ${w}x${h} ${theme}`);
    await ctx.close();
  }
}

/** P1-1 and summary guard: taps right after a hand-over sheet / summary card opens do nothing; deliberate taps work. */
async function guards(browser, theme) {
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await begin(page, { players: 2 });
  let sawHandoff = 0; let sawSummary = 0;
  const sel = { pass: '[data-action="pass"]', pay: '[data-action="pay"]', ok: '[data-action="ok"]', skip: '[data-action="skip"]', decline: '[data-action="decline"]' };
  for (let guard = 0; guard < 1500 && (sawHandoff < 4 || sawSummary < 1); guard++) {
    const kind = await topKind(page);
    if (kind === 'handoff') {
      const age = await page.evaluate(() => performance.now() - window.__born['handoff-sheet']);
      const go = page.locator('.layer:last-child [data-action="roll-next"]');
      if (age < 450) {
        const early = Math.max(0, [100, 250, 400][sawHandoff % 3] - age);
        await sleep(early);
        const armed0 = await go.evaluate((b) => (b.disabled ? 'true' : null)).catch(() => null);
        const at = Math.round(await page.evaluate(() => performance.now() - window.__born['handoff-sheet']));
        await go.click({ force: true, timeout: 2000 }).catch(() => {});
        await sleep(250);
        const still = await topKind(page);
        check(armed0 === 'true' && still === 'handoff', `hand-over: disabled while arming, and a tap ${at} ms after the sheet appeared does not roll (${armed0}/${still})`);
        if (sawHandoff === 0) await axe(page, `hand-over sheet ${theme}`);
        sawHandoff += 1;
      }
      await sleep(850);
      if (await topKind(page) === 'handoff') {
        check(await go.evaluate((b) => b.disabled) === false, 'hand-over: armed once the fill is done');
        await go.click();
        await page.waitForSelector('.layer-handoff', { state: 'detached', timeout: 3000 }).catch(() => {});
        check(await topKind(page) !== 'handoff', 'hand-over: a deliberate tap rolls');
      }
    } else if (kind === 'summary') {
      const age = await page.evaluate(() => performance.now() - window.__born['summary-card']);
      const t0 = Date.now() - age;
      if (age < 350) {
        await page.locator('.layer:last-child .summary-card').click({ position: { x: 20, y: 20 }, force: true });
        await sleep(150);
        check(await topKind(page) === 'summary', 'summary card: a stray tap ~200 ms after it opens does not close it');
      }
      const total = await page.locator('.sc-result').innerText();
      check(!/^₪?0$/.test(total.replace(/\s/g, '')) || await page.evaluate(() => Number(document.querySelector('.summary-card').dataset.amount) === 0), `summary card: the total never reads ₪0 first (${total})`);
      await sleep(Math.max(0, 900 - (Date.now() - t0)));
      if (sawSummary === 0) await axe(page, `summary card ${theme}`);
      await page.locator('[data-action="summary-ok"]').click();
      await page.waitForSelector('.summary-card', { state: 'detached', timeout: 3000 }).catch(() => {});
      sawSummary += 1;
    } else if (kind === 'card') {
      const top = '#modal-root .layer:last-child ';
      let done = false;
      for (const k of ['pass', 'pay', 'ok', 'skip', 'decline']) { const l = page.locator(top + sel[k]).first(); if (await l.count()) { await l.click({ timeout: 2500 }).catch(() => {}); done = true; break; } }
      if (!done) { const g = page.locator(`${top}[data-action^="guess-"]`).first(); if (await g.count()) await g.click().catch(() => {}); else await page.locator(`${top}[data-action="hint-next"]`).first().click({ timeout: 1500 }).catch(() => {}); }
    } else if (kind === 'layer') {
      await page.locator('#modal-root .layer:last-child [data-action="cancel"], #modal-root .layer:last-child [data-action="ok"]').first().click({ timeout: 1500 }).catch(() => {});
    } else if (await page.evaluate(() => document.querySelector('.screen-board')?.dataset.btn === 'roll')) {
      await page.locator('[data-action="roll"]:not([disabled])').click({ timeout: 1500 }).catch(() => {});
    }
    await sleep(25);
  }
  check(sawHandoff >= 4, `guards: ${sawHandoff} hand-over sheets checked`);
  check(sawSummary >= 1, `guards: ${sawSummary} summary card(s) checked`);
  // the hand-over sheet has a way home
  await ctx.close();
}

/** A money-losing asset: the summary card shows the real signed figure + the neutral tag (never red, never 'עוד אין') and the rows add up. */
async function lossSummary(browser, theme) {
  const card = J('cards.he.json').find((c) => c.id === 'opp-apt-009');
  const base = newMatch(engine, { mode: 'family', players: [{ name: 'דנה', professionId: 'teacher' }], seed: 5 });
  let st = { ...currentState(base), cash: 10 ** 7, position: 21, pending: { kind: 'opportunity', card } };
  st = engine.buy(st, 1);
  st = { ...st, cash: 50000, position: 21, phase: 'roll', pending: null };
  const match = { ...base, players: base.players.map((p, i) => (i ? p : { ...p, state: st })) };
  const { ctx, page } = await open(browser, { w: 360, h: 640, theme });
  await resume(page, match);
  let seen = false;
  for (let k = 0; k < 40 && !seen; k++) {
    await page.locator('[data-action="roll"]:not([disabled])').click({ timeout: 4000 }).catch(() => {});
    seen = await page.waitForSelector('.summary-card', { timeout: 4000 }).then(() => true).catch(() => false);
    if (!seen) { await sleep(800); await page.locator('#modal-root .layer:last-child [data-action="pass"], #modal-root .layer:last-child [data-action="pay"], #modal-root .layer:last-child [data-action="ok"]').first().click({ timeout: 800 }).catch(() => {}); }
  }
  check(seen, `${theme}: a summary with a money-losing asset opens`);
  if (seen) {
    await settle(page);
    const r = await page.evaluate(() => {
      const c = document.querySelector('.summary-card'); const row = c.querySelector('[data-row="passive"]');
      const num = (el) => Number((el?.textContent ?? '').replace(/[^\d-−]/g, '').replace('−', '-'));
      const amounts = [...c.querySelectorAll('.sc-row .sc-amt')].map((e) => e.textContent.replace(/[^\d−-]/g, '').replace('−', '-')).map(Number);
      return { kind: row.dataset.kind, rowText: row.textContent.replace(/\s+/g, ' '), amounts, monthly: Number(c.dataset.monthly), color: getComputedStyle(c.querySelector('.sc-result')).color, none: !!c.querySelector('.sc-none') };
    });
    check(r.kind === 'loss' && !r.none && /נכס מפסיד/.test(r.rowText), `${theme}: the passive row shows the signed figure and the 'נכס מפסיד' tag (${r.rowText})`);
    check(r.amounts.length === 3 && r.amounts[0] + r.amounts[1] + r.amounts[2] === r.monthly, `${theme}: salary + passive + (-expenses) = the monthly result (${r.amounts.join(' + ')} = ${r.monthly})`);
    const m = /rgb\((\d+), (\d+), (\d+)/.exec(r.color);
    check(!!m && !(Number(m[1]) > 200 && Number(m[2]) < 140 && Number(m[3]) < 140), `${theme}: the negative result is not red (${r.color})`);
    await axe(page, `summary card, money-losing asset, negative ${theme}`);
  }
  await ctx.close();
}

/** P2-9 and P2-17: Back steps through the story and closes it on the first screen; the skip toast stays 4 s and offers the how-to. */
async function story(browser, theme) {
  const { ctx, page } = await open(browser, { w: 360, h: 800, theme });
  await begin(page, { players: 1, skipStory: false });
  await page.locator('[data-action="story-next"]').click();
  await sleep(400);
  const n = () => page.evaluate(() => document.querySelector('.story-screen')?.dataset.n ?? null);
  check(await n() === '2', 'story: on screen 2');
  await page.goBack();
  await sleep(500);
  check(await n() === '1', 'story: the Back button steps to the previous screen instead of leaving the app');
  await page.goBack();
  await page.waitForSelector('.layer-story', { state: 'detached', timeout: 3000 });
  check(await page.evaluate(() => /localhost/.test(location.href)), 'story: Back on the first screen closes the story (the app is still there)');
  const toastT0 = Date.now();
  await page.waitForSelector('.toast');
  check(await page.locator('.toast [data-action="toast-action"]').count() === 1, 'skip toast offers the how-to entry');
  await sleep(3200);
  check(await page.locator('.toast').count() >= 1, `skip toast is still visible after 3.2 s (${Date.now() - toastT0} ms)`);
  await page.locator('[data-action="settings"], .icon-btn[aria-label="הגדרות"]').first().click().catch(() => {});
  await ctx.close();
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    for (const theme of THEMES) {
      console.log(`\n=== ${theme} ===`);
      await loanStrip(browser, theme);
      await hud(browser, theme);
      await lossSummary(browser, theme);
      await guards(browser, theme);
      if (theme === THEMES[0]) await story(browser, theme);
    }
  } finally { await browser.close(); server?.kill(); }
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nROUND 11 SMOKE PASSED');
}
main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
