// Owner bug report 2026-11-01: a roll that CROSSES 'סיכום שנתי' must not halt the pawn there. In a real browser (360x800):
// the pawn hops the whole path without a pause, a "+₪X" (coins in junior) float rises from the crossed tile while it moves, the
// itemised summary card opens only once the pawn stands on its landing square (one card per crossed payday), the cash is counted
// once, and landing ON payday still opens the card at once. Motion on and reduced motion.
// Run: npm run build && node tests/e2e/payday-pass-smoke.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize, currentState, BOARD } from '../../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const PORT = Number(process.env.SMOKE_PORT || 4186);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
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

const withState = (base, patch) => ({ ...base, players: base.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, ...patch } })) });
/** The first seed whose next roll (from `patch`) satisfies `want(move, paydays)`: the page replays the same seeded roll. */
function scenario({ mode, age, patch, want }) {
  for (let seed = 1; seed < 400; seed++) {
    const m = withState(newMatch(engine, { mode, players: [{ name: 'דנה', professionId: 'teacher', ...(age ? { age } : {}) }], seed }), patch);
    const before = currentState(m);
    const next = engine.roll(before);
    const move = next.events.find((e) => e.type === 'move');
    const pds = next.events.filter((e) => e.type === 'payday');
    if (want(move, pds, next)) return { m, before, next, move, pds };
  }
  throw new Error('no seed found');
}
const crossed = (move) => move.path.slice(0, -1).filter((i) => BOARD[i] === 'payday').length;

async function open(browser, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'he-IL', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}
async function resume(page, match) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate((j) => { localStorage.setItem('passivo.save', j); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true })); }, serialize(match));
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
}
/** Records every pawn move (tile index + time), every float (text, coins, where the pawn was) and every summary card opening. */
async function record(page) {
  await page.evaluate(() => {
    const rec = { hops: [], floats: [], cards: [] };
    window.__rec = rec;
    const idx = () => Number(document.querySelector('.pawn-slot.is-active')?.closest('[data-i]')?.dataset.i);
    const cashText = () => document.querySelector('.hud .cash-num')?.textContent ?? '';
    let last = idx();
    let cardOpen = false;
    const tick = () => {
      const i = idx();
      if (i !== last) { rec.hops.push({ i, t: performance.now(), card: cardOpen }); last = i; }
      const open = !!document.querySelector('#modal-root .summary-card');
      if (open && !cardOpen) rec.cards.push({ at: i, t: performance.now(), amount: Number(document.querySelector('#modal-root .summary-card').dataset.amount) });
      cardOpen = open;
    };
    new MutationObserver((list) => {
      for (const mu of list) for (const n of mu.addedNodes) {
        if (n.nodeType === 1 && n.matches?.('[data-float]')) rec.floats.push({ text: n.textContent, coins: !!n.querySelector('.is-coins'), at: idx(), tiles: [...document.querySelectorAll('[data-paid]')].map((x) => Number(x.dataset.i)), t: performance.now(), card: !!document.querySelector('#modal-root .summary-card') });
      }
      tick();
    }).observe(document.body, { childList: true, subtree: true });
    rec.cashAt = () => cashText();
  });
}
const digits = (s) => Number(String(s).replace(/[^\d]/g, ''));

async function passCase(browser, { label, mode = 'full', age = null, reduced = false }) {
  // 2 dice (charity) from square 3: always crosses square 4; land on an opportunity (no cash change before its card)
  const sc = scenario({ mode, age, patch: { position: 3, charityTurns: 2, turn: 4 }, want: (mv) => crossed(mv) >= 1 && BOARD[mv.to] === 'opportunity' });
  const { page, ctx, errors } = await open(browser, { reduced });
  await resume(page, sc.m);
  await page.waitForSelector('[data-action="roll"]:not([disabled])');
  await sleep(400);
  const cash0 = digits(await page.evaluate(() => document.querySelector('.hud .cash-num').textContent));
  await record(page);
  await page.locator('[data-action="roll"]').click();
  await page.waitForSelector('#modal-root .summary-card', { timeout: 15000 });
  const r1 = await page.evaluate(() => ({ hops: window.__rec.hops, floats: window.__rec.floats, cards: window.__rec.cards, cash: window.__rec.cashAt() }));
  const seq = r1.hops.map((x) => x.i);
  check(JSON.stringify(seq) === JSON.stringify(sc.move.path), `${label}: the pawn hopped the whole path ${JSON.stringify(sc.move.path)} before any card (${JSON.stringify(seq)})`);
  check(r1.cards.length === 1 && r1.cards[0].at === sc.move.to, `${label}: the first summary card opened with the pawn on its landing square ${sc.move.to} (${JSON.stringify(r1.cards)})`);
  const gaps = r1.hops.slice(1).map((x, k) => Math.round(x.t - r1.hops[k].t));
  check(Math.max(0, ...gaps) < 700, `${label}: no pause on the crossed payday (hop gaps ${JSON.stringify(gaps)} ms)`);
  check(r1.hops.every((x) => !x.card), `${label}: the pawn never moved while a summary card was open`);
  const paydayFloats = r1.floats.filter((f) => !f.card);
  // v0.4 (owner decision 2026-11-02): at most one annual summary per turn, so one float / card per CREDITED payday (sc.pds)
  check(paydayFloats.length === sc.pds.length, `${label}: one float per credited payday while moving (${JSON.stringify(paydayFloats)})`);
  const crossedIdx = sc.move.path.slice(0, -1).filter((i) => BOARD[i] === 'payday').slice(0, sc.pds.length);
  check(paydayFloats.every((f, k) => f.tiles.includes(crossedIdx[k])), `${label}: each float rose from the crossed payday tile ${JSON.stringify(crossedIdx)} (${JSON.stringify(paydayFloats.map((f) => f.tiles))})`);
  if (age) check(paydayFloats.every((f) => f.coins && !/₪/.test(f.text)), `${label}: the junior float is in coins, no ₪ (${paydayFloats.map((f) => f.text).join(' | ')})`);
  else check(paydayFloats.every((f, k) => digits(f.text) === Math.abs(sc.pds[k].amount) && /₪/.test(f.text)), `${label}: the float shows the payday amount (${paydayFloats.map((f) => f.text).join(' | ')})`);
  // one card per crossed payday, each after the landing; then the landing square's card
  let cards = 1;
  for (let guard = 0; guard < 6; guard++) {
    await sleep(750); // the card's arming (MIN_OPEN_MS)
    await page.locator('#modal-root .layer:last-child [data-action="summary-ok"]').click();
    const nextUp = await Promise.race([
      page.waitForFunction((n) => window.__rec.cards.length > n, cards, { timeout: 6000 }).then(() => 'summary'),
      page.waitForSelector('#modal-root .card', { timeout: 6000 }).then(() => 'card'),
    ]).catch(() => 'none');
    if (nextUp !== 'summary') break;
    cards += 1;
  }
  check(cards === sc.pds.length, `${label}: ${sc.pds.length} summary card(s) after the landing (${cards})`);
  await page.waitForSelector('#modal-root .card', { timeout: 8000 }).catch(() => {});
  await sleep(700);
  const end = await page.evaluate(() => ({ cash: document.querySelector('.hud .cash-num').textContent, hops: window.__rec.hops.length }));
  check(end.hops === sc.move.path.length, `${label}: the pawn did not move after landing (${end.hops} moves)`);
  if (!age) {
    check(cash0 === sc.before.cash, `${label}: the HUD started at the saved cash (${cash0} / ${sc.before.cash})`);
    check(digits(end.cash) === sc.next.cash, `${label}: the cash was credited once: ${cash0} + ${sc.pds.map((p) => p.amount).join(' + ')} = ${sc.next.cash} (HUD ${end.cash})`);
  }
  check(errors.length === 0, `${label}: no page errors ${errors.join(' | ')}`);
  await ctx.close();
}

async function landCase(browser, { label, reduced = false }) {
  // one die from square 3: a 1 lands ON payday (square 4): the card opens at once, as before
  const sc = scenario({ mode: 'full', patch: { position: 3, turn: 4 }, want: (mv) => mv.to === 4 });
  const { page, ctx, errors } = await open(browser, { reduced });
  await resume(page, sc.m);
  await page.waitForSelector('[data-action="roll"]:not([disabled])');
  await sleep(400);
  await record(page);
  await page.locator('[data-action="roll"]').click();
  await page.waitForSelector('#modal-root .summary-card', { timeout: 15000 });
  const r = await page.evaluate(() => window.__rec);
  check(r.cards.length === 1 && r.cards[0].at === 4 && r.cards[0].amount === sc.pds[0].amount, `${label}: landing on payday opens its summary card at once (${JSON.stringify(r.cards)})`);
  check(r.floats.filter((f) => !f.card).length === 0, `${label}: no passing float when the pawn lands on the payday`);
  await sleep(750);
  await page.locator('#modal-root .layer:last-child [data-action="summary-ok"]').click();
  await page.waitForSelector('#modal-root .summary-card', { state: 'detached', timeout: 4000 }).catch(() => {});
  await sleep(900);
  const cash = digits(await page.evaluate(() => document.querySelector('.hud .cash-num').textContent));
  check(cash === sc.next.cash, `${label}: the landing payday reaches the cash once (${cash} / ${sc.next.cash})`);
  check(errors.length === 0, `${label}: no page errors ${errors.join(' | ')}`);
  await ctx.close();
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    await passCase(browser, { label: 'full, pass' });
    await passCase(browser, { label: 'full, pass, reduced motion', reduced: true });
    await passCase(browser, { label: 'family, pass', mode: 'family' });
    await passCase(browser, { label: 'junior, pass', mode: 'family', age: 'upTo10' });
    await landCase(browser, { label: 'full, land' });
    await landCase(browser, { label: 'full, land, reduced motion', reduced: true });
  } finally { await browser.close(); server?.kill(); }
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nPAYDAY PASS SMOKE PASSED');
}
main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
