// 0.5.1 friend challenge smoke: game A -> "שלחו אתגר" link -> a fresh browser context opens it -> game B with other decisions ->
// the same dice, both results verified on the compare screen; the reply link opens compare on A's device; a tampered link gives
// the error screen; a non-comparable link the "new challenge" intro; the junior path shows coins and no name field; 360x800 and
// 320x568 layout (no horizontal scroll, 48px targets); the replay timeline and the family board. Reports the URL lengths.
// Run: npm run build && node tests/e2e/challenge-smoke.mjs   (AXE_PATH=path/to/axe.min.js adds axe on the new screens)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import {
  createEngine, decodeActionLog, encodeActionLog, replayTurns, botStep, newMatch, serialize, configOf, verifyResult,
} from '../../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4183);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = process.env.SMOKE_OUT || new URL('../../test-results/challenge/', import.meta.url).pathname;
const AXE = process.env.AXE_PATH && existsSync(process.env.AXE_PATH) ? readFileSync(process.env.AXE_PATH, 'utf8') : null;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);

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
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a[href], label.age-chip')]
    .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
    .filter((el) => !el.closest('.ch-chip')) // the HUD chip: 24px drawn, 48px hit area through ::after (spec §3)
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 }; })
    .filter((x) => x.vis && (x.w < 47.5 || x.h < 47.5)));
  check(small.length === 0, `touch targets >= 48px on ${label}${small.length ? ` (too small: ${JSON.stringify(small.slice(0, 3))})` : ''}`);
}
async function axe(page, label) {
  if (!AXE) return;
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`));
  check(res.length === 0, `axe: 0 violations on ${label}${res.length ? ` ${JSON.stringify(res)}` : ''}`);
}
async function layout(page, tag) {
  await page.waitForTimeout(350);
  await noHScroll(page, tag);
  await tapTargets(page, tag);
  await page.screenshot({ path: `${OUT}/${tag.replace(/[^\w-]+/g, '_')}.png` });
}

/** One UI action. `policy`: 'buyer' (buys sensible deals) or 'eager' (buys any affordable deal). Never donates, never arms a reroll. */
function decide(policy) {
  const q = (s, r = document) => r.querySelector(s);
  for (const s of ['win', 'over', 'compare', 'start']) if (q(`[data-screen="${s}"]`)) return { done: s };
  const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
  const top = layers[layers.length - 1];
  const board = q('.screen-board');
  const cash = Number(board?.dataset.cash || 0);
  const expenses = Number(board?.dataset.expenses || 0);
  const L = '#modal-root .layer:last-child';
  if (top) {
    const btn = (a) => q(`[data-action="${a}"]:not([disabled])`, top);
    if (q('.summary-card', top)) return { click: `${L} [data-action="summary-ok"]` };
    const card = q('.card', top);
    if (card) {
      const kind = card.dataset.card;
      if (kind === 'opportunity' && card.dataset.kind === 'choice' && btn('choose-a')) return { click: `${L} [data-action="choose-a"]` };
      if (kind === 'opportunity' && card.dataset.guess === 'ask') return { click: `${L} [data-action="guess-skip"]` };
      if (kind === 'opportunity') {
        const good = policy === 'eager' ? card.dataset.kind !== 'stock' : card.dataset.kind !== 'stock' && Number(card.dataset.payback) <= 130 && cash - Number(card.dataset.cost) >= expenses * 0.5;
        return { click: `${L} [data-action="${card.dataset.afford === 'true' && good && btn('buy') ? 'buy' : 'pass'}"]` };
      }
      if (kind === 'expense') for (const a of ['pay', 'loan', 'sell']) if (btn(a)) return { click: `${L} [data-action="${a}"]` };
      if (kind === 'charity') return { click: `${L} [data-action="skip"]` };
      if (kind === 'market' && btn('accept') && policy === 'buyer') return { click: `${L} [data-action="accept"]` };
      const opt = q('.btn-option:not([disabled])', top);
      if (opt) return { clickEl: true };
      if (btn('ok')) return { click: `${L} [data-action="ok"]` };
      if (btn('decline')) return { click: `${L} [data-action="decline"]` };
      const ans = q('.audit-opt:not([disabled])', top);
      if (ans) return { click: `${L} .audit-opt` };
    }
    if (btn('take')) return { click: `${L} [data-action="take"]` };
    if (q('.sell-row [data-action="sell"]', top)) return { click: `${L} .sell-row [data-action="sell"]` };
    if (btn('cancel')) return { click: `${L} [data-action="cancel"]` };
    return { wait: true };
  }
  if (q('[data-action="reroll"]:not([hidden])')) return { reroll: true };
  if (q('[data-action="roll"]:not([disabled])')) return { click: '[data-action="roll"]' };
  return { wait: true };
}
async function playToEnd(page, policy, budgetMs = Number(process.env.SMOKE_GAME_MS || 300000)) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  let rerollSeen = false;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide, policy);
    if (d.done) return { done: d.done, rolls, rerollSeen };
    if (d.reroll) rerollSeen = true;
    if (d.clickEl) await page.locator('#modal-root .layer:last-child .btn-option:not([disabled])').last().click({ timeout: 3000, force: true }).catch(() => {});
    else if (d.click) {
      if (d.click === '[data-action="roll"]') rolls += 1;
      await page.locator(d.click).first().click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(15);
    } else if (d.reroll) {
      await page.locator('[data-action="roll"]:not([disabled])').first().click({ timeout: 3000 }).catch(() => {});
      rolls += 1;
    } else await page.waitForTimeout(40);
  }
  const last = await page.evaluate(() => ({ screen: document.querySelector('[data-screen]')?.dataset.screen, layer: document.querySelector('#modal-root .layer:last-child')?.innerHTML.slice(0, 600) }));
  console.log(`timeout state: ${JSON.stringify(last)}`);
  await page.screenshot({ path: `${OUT}/timeout-${policy}.png` });
  return { done: 'timeout', rolls, rerollSeen };
}

const SKIP_STORY = { seenIntro: '1', tutorial: { storyDone: true, helpOn: false, quizDone: true } };
const newCtx = (browser, { w = 360, h = 800 } = {}) => browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem',
  reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'],
});
async function open(ctx, { path = '', storage = SKIP_STORY, waitFor = '[data-screen]' } = {}) {
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(`passivo.${k}`, typeof v === 'string' ? v : JSON.stringify(v));
    }
    // no system share sheet: the link goes to the clipboard, which the test reads
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  }, storage);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.errors = errors;
  await page.goto(`${URL_BASE}${path}`);
  await page.waitForSelector(waitFor);
  await page.waitForTimeout(400);
  return page;
}
const ls = (page, key) => page.evaluate((k) => localStorage.getItem(`passivo.${k}`), key);
const hashOf = (url) => /#([cr])=([A-Za-z0-9_-]+)$/.exec(url);

/** Sends the challenge (or the reply) from the open sheet; returns the URL that was copied. */
async function sendFromSheet(page, { name = null, tag }) {
  await page.waitForSelector('[data-ch-sheet]');
  await page.waitForTimeout(300);
  if (name !== null) await page.locator('[data-ch-name]').fill(name);
  await layout(page, `${tag}-sheet`);
  await axe(page, `${tag} sheet`);
  const preview = await page.locator('[data-ch-preview]').innerText();
  await page.locator('[data-action="ch-send"]').click();
  await page.waitForSelector('[data-ch-sheet] .ch-status:not([hidden])');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === preview.replace(/[⁦-⁩]/g, '') || clip.includes(hashOf(clip)?.[2] ?? '§'), `${tag}: the copied text is the preview (${clip.length} chars)`);
  await page.locator('[data-action="ch-close"]').click();
  const url = /(https?:\/\/\S+#[cr]=[A-Za-z0-9_-]+)/.exec(clip)?.[1];
  check(!!url, `${tag}: the message carries a link (${url?.slice(0, 60)}…)`);
  return { url, text: clip };
}

/** Per-turn squares of a decoded log (the dice decide them in a challenge). */
const squaresOf = (log) => replayTurns(engine, log).turns.map((t) => t.square);
const diceOf = (log) => {
  let s = engine.newGame({ ...log.config, seed: log.seed });
  const out = [];
  for (const a of log.actions) { s = engine.dispatch(s, a); if (a.type === 'roll') out.push(s.lastRoll.dice.join('+')); }
  return out;
};

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const urls = [];

  // ================= game A (the creator), 360x800 =================
  const ctxA = await newCtx(browser);
  const A = await open(ctxA, { path: '?seed=4242', waitFor: '[data-screen="start"]' });
  check(await A.locator('[data-action="family-board"]').count() === 1, 'home has the family board icon');
  await layout(A, 'home-360x800');
  await A.locator('.mode-card[data-mode="family"]').click();
  await A.locator('[data-action="start"]').click();
  await A.waitForSelector('[data-screen="players"]');
  await A.locator('[data-action="players-next"]').click();
  await A.waitForSelector('[data-screen="pick"]');
  await A.locator('.prof-card').first().click();
  await A.locator('[data-action="go"]').click();
  await A.waitForSelector('[data-screen="board"]');
  check(await A.locator('.ch-chip').count() === 0, 'a normal game has no challenge chip');
  const endA = await playToEnd(A, 'buyer');
  check(endA.done === 'win' || endA.done === 'over', `game A ended (${endA.done}, ${endA.rolls} rolls)`);
  await A.waitForTimeout(600);
  const chBtn = A.locator('[data-action="challenge"]');
  check(await chBtn.count() === 1, `the ${endA.done} screen offers "שלחו אתגר"`);
  if (endA.done === 'win') {
    const primary = await A.evaluate(() => document.querySelector('[data-action="challenge"]').classList.contains('btn-primary'));
    check(primary && await A.locator('[data-action="share"]').count() === 0, 'win: "שלחו אתגר" is the gold primary and replaces the plain share');
    check(await A.locator('.end-row [data-action="again"]').count() === 1, 'win: "שחקו שוב" is a ghost in the row');
  } else {
    check(await A.evaluate(() => document.querySelector('[data-action="retry"]').classList.contains('btn-primary')), 'game over keeps "ננסה שוב" as the primary');
  }
  await layout(A, `end-${endA.done}-360x800`);
  await chBtn.click();
  const sentA = await sendFromSheet(A, { name: 'נועה', tag: 'create' });
  urls.push(sentA.url.length);
  const hashA = hashOf(sentA.url);
  const logA = decodeActionLog(hashA[2]);
  check(hashA[1] === 'c' && logA.name === 'נועה' && !logA.config.challenge, 'the link is #c= with the name; A was a normal game');
  const vA = verifyResult(engine, hashA[2]);
  check(vA.ok && vA.comparable, `A's link verifies in node (${vA.status}, ${vA.turns} turns, ${vA.freedomPct}%)`);
  const sent = JSON.parse(await ls(A, 'challenges'));
  check(sent.entries.some((e) => e.role === 'sent' && e.me?.sentLink === hashA[2]), 'the sent challenge is stored in passivo.challenges');

  // ================= game B (the receiver), fresh context, 360x800 =================
  const ctxB = await newCtx(browser);
  const B = await open(ctxB, { path: `#c=${hashA[2]}`, waitFor: '[data-screen="challenge"]' });
  check(await B.evaluate(() => location.hash) === '', 'the hash is cleared after reading');
  const intro = await B.locator('section[data-screen="challenge"]').innerText();
  check(intro.includes('נועה') && await B.locator('.ch-result [data-verified="true"]').count() === 1, 'intro: the creator\'s name and a verified result');
  check(await B.locator('[data-ch-rules]').count() === 1, 'intro: the two challenge rules');
  await layout(B, 'intro-360x800');
  await axe(B, 'intro');
  await B.locator('[data-action="ch-play"]').click();
  await B.waitForSelector('[data-screen="board"]');
  check(await B.locator('.ch-chip').count() === 1, 'the board shows the challenge chip');
  await B.locator('.ch-chip').click();
  await B.waitForSelector('[data-ch-pop]');
  check((await B.locator('[data-ch-pop]').innerText()).includes('גלגול שוב'), 'the chip opens the rules popover');
  await layout(B, 'board-chip-360x800');
  await B.keyboard.press('Escape');
  check(await ls(B, 'challengeSave') !== null && await ls(B, 'save') === null, 'the challenge saves in challengeSave, never in the normal slot');
  const endB = await playToEnd(B, 'eager');
  check(endB.done === 'compare', `game B ends on the compare screen (${endB.done}, ${endB.rolls} rolls)`);
  check(!endB.rerollSeen, 'no reroll button in a challenge');
  await B.waitForTimeout(600);
  const badges = await B.locator('.cmp-head [data-verified]').evaluateAll((els) => els.map((e) => e.dataset.verified));
  check(badges.length === 2 && badges.every((x) => x === 'true'), `compare: both results verified (${badges})`);
  await layout(B, 'compare-360x800');
  await axe(B, 'compare');
  const storeB = JSON.parse(await ls(B, 'challenges'));
  const recB = storeB.entries.find((e) => e.role === 'received');
  const logB = decodeActionLog(recB.me.link);
  check(logB.config.challenge === true && logB.seed === logA.seed, 'B played the same seed under the challenge rules');
  const dA = diceOf(logA); const dB = diceOf(logB);
  const n = Math.min(dA.length, dB.length);
  check(n > 5 && dA.slice(0, n).join() === dB.slice(0, n).join(), `the dice are identical turn by turn (${n} turns)`);
  check(squaresOf(logA).slice(0, n).join() === squaresOf(logB).slice(0, n).join(), 'the squares are identical turn by turn');
  check(JSON.stringify(logA.actions) !== JSON.stringify(logB.actions), 'B decided differently from A');
  check(await ls(B, 'challengeSave') === null, 'the challenge save is cleared at the end');

  // replay timeline
  await B.locator('[data-action="ch-replay"]').click();
  await B.waitForSelector('[data-screen="timeline"]');
  const rows = await B.locator('.tl-row').count();
  check(rows >= n, `the timeline lists every turn (${rows})`);
  check(await B.locator('.tl-row.is-split').count() > 0, 'the timeline marks the split turns');
  await layout(B, 'timeline-360x800');
  await axe(B, 'timeline');
  await B.locator('.tl-row').first().click();
  await B.waitForSelector('[data-sheet="turn"]');
  await layout(B, 'timeline-turn-360x800');
  await B.keyboard.press('Escape');
  await B.waitForTimeout(300);
  await B.locator('[data-action="tl-back"]').click();
  await B.waitForSelector('[data-screen="compare"]');

  // reply
  await B.locator('[data-action="ch-reply"]').click();
  const reply = await sendFromSheet(B, { name: 'יואב', tag: 'reply' });
  urls.push(reply.url.length);
  check(hashOf(reply.url)?.[1] === 'r', 'the reply is a #r= link');

  // family board on B
  await B.locator('[data-action="ch-board"]').click();
  await B.waitForSelector('[data-screen="family-board"]');
  const boardText = await B.locator('section[data-screen="family-board"]').innerText();
  check(boardText.includes('נועה') && boardText.includes('אתם'), 'the family board ranks the creator and me');
  await layout(B, 'board-360x800');
  await axe(B, 'family board');

  // ================= the reply opens compare on A =================
  await A.goto(`${URL_BASE}#r=${hashOf(reply.url)[2]}`);
  await A.waitForSelector('[data-screen="compare"]');
  check(await A.evaluate(() => document.querySelector('section[data-screen="compare"]').dataset.variant) === 'reply', 'the reply link opens compare (reply received) on the creator\'s device');
  check((await A.locator('section[data-screen="compare"]').innerText()).includes('יואב'), 'compare shows the replier\'s name');
  await layout(A, 'compare-reply-360x800');
  // my own link on my device: home + toast
  await A.goto(`${URL_BASE}#c=${hashA[2]}`);
  await A.waitForSelector('[data-screen="start"]');
  check(true, 'my own challenge link opens home');

  // ================= tampered / invalid / old-version links =================
  const t = hashA[2];
  const flipped = t.slice(0, 30) + (t[30] === 'A' ? 'B' : 'A') + t.slice(31);
  const C = await open(ctxB, { path: `#c=${flipped}`, waitFor: '[data-screen="challenge-error"]' });
  check(await C.evaluate(() => document.querySelector('section[data-screen="challenge-error"]').dataset.variant) === 'tampered', 'a tampered link gives the "something changed" error');
  await layout(C, 'error-tampered-360x800');
  await axe(C, 'error');
  await C.goto(`${URL_BASE}#c=${t.slice(0, 12)}`);
  await C.waitForSelector('[data-screen="challenge-error"]');
  check(true, 'a truncated link gives the error screen');
  await C.close();

  // ================= a log that decodes but does not replay to an end: playable, "לא אומת" =================
  const cut = encodeActionLog({ ...logA, actions: logA.actions.slice(0, 6) });
  const U = await open(ctxB, { path: `#c=${cut}`, waitFor: '[data-screen="challenge"]' });
  check(await U.locator('.ch-result [data-verified="false"]').count() === 1 && await U.locator('[data-action="ch-play"]').count() === 1, 'an unfinished log is playable and shows the neutral "לא אומת" badge');
  await layout(U, 'intro-unverified-360x800');
  await U.close();

  // ================= a non-comparable link: "new challenge, same game" =================
  let donor = engine.newGame({ mode: 'family', professionId: 'nurse', seed: 515 });
  for (let i = 0; i < 2000 && donor.status === 'playing'; i++) donor = donor.pending?.kind === 'charity' && donor.cash >= donor.pending.cost ? engine.dispatch(donor, { type: 'donate' }) : botStep(engine, donor, 'sensible');
  const fresh = encodeActionLog({ rngVersion: 2, seed: 515, config: configOf(donor), actions: donor.log });
  check(!verifyResult(engine, fresh).comparable, 'the node-built donor log is not comparable');
  const F = await open(ctxB, { path: `#c=${fresh}`, waitFor: '[data-screen="challenge"]' });
  check(await F.evaluate(() => document.querySelector('section[data-screen="challenge"]').dataset.fresh) === 'true' && await F.locator('[data-ch-fresh]').count() === 1, 'a non-comparable link opens the "new challenge" intro with no creator result');
  await layout(F, 'intro-fresh-360x800');
  await F.close();

  // ================= junior =================
  // the receiver: a junior link, a 10-year-old's device -> coins chip, kid words, and no name field at the end
  let jr = engine.newGame({ mode: 'family', professionId: 'cook', seed: 777, junior: true });
  for (let i = 0; i < 2000 && jr.status === 'playing'; i++) jr = jr.pending?.kind === 'charity' ? engine.dispatch(jr, { type: 'declineCharity' }) : botStep(engine, jr, 'sensible');
  const jLink = encodeActionLog({ rngVersion: 2, seed: 777, config: configOf(jr), actions: jr.log, name: 'סבתא' });
  urls.push(`${URL_BASE}#c=${jLink}`.length);
  const ctxJ = await newCtx(browser);
  const J = await open(ctxJ, { path: `#c=${jLink}`, storage: { ...SKIP_STORY, lastAge: 'upTo10' }, waitFor: '[data-screen="challenge"]' });
  check(await J.locator('[data-junior] img').count() === 1, 'junior intro: the "צעירים" chip with the coin');
  check((await J.locator('[data-action="ch-play"]').innerText()).includes('בואו נשחק'), 'junior intro: the kid CTA "בואו נשחק"');
  const bigNums = async (page) => page.evaluate(() => (document.querySelector('[data-screen]').innerText.match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replace(/,/g, ''))).filter((x) => x > 999));
  check((await bigNums(J)).length === 0, 'junior intro: no number over 999');
  await layout(J, 'intro-junior-360x800');
  await J.locator('[data-action="ch-play"]').click();
  await J.waitForSelector('[data-screen="board"]');
  check(await J.evaluate(() => document.documentElement.hasAttribute('data-coins')), 'junior challenge board plays in coins');
  const endJ = await playToEnd(J, 'buyer');
  check(endJ.done === 'compare', `junior challenge ends on compare (${endJ.done})`);
  await J.waitForTimeout(500);
  check((await bigNums(J)).length === 0, `junior compare: no number over 999 (${await bigNums(J)})`);
  check((await J.locator('section[data-screen="compare"]').innerText()).includes('תורות עד החופש'), 'junior compare: kid labels');
  await layout(J, 'compare-junior-360x800');
  await J.locator('[data-action="ch-reply"]').click();
  await J.waitForSelector('[data-ch-sheet]');
  check(await J.locator('[data-ch-name]').count() === 0, 'junior: no name field in the share sheet');
  await J.keyboard.press('Escape');
  await ctxJ.close();

  // the creator side of junior: a finished junior game resumes on its win screen; "שלחו אתגר" has no name field
  const jm = newMatch(engine, { mode: 'family', seed: 777, players: [{ name: '', professionId: 'cook', age: 'upTo10' }] });
  const finished = { ...jm, status: jr.status, winnerIndex: jr.status === 'won' ? 0 : null, players: [{ ...jm.players[0], state: jr }] };
  const ctxK = await newCtx(browser);
  const K = await open(ctxK, { storage: { ...SKIP_STORY, lastAge: 'upTo10', save: serialize(finished) }, waitFor: '[data-screen="start"]' });
  await K.locator('[data-action="resume"]').click();
  await K.waitForSelector('[data-action="challenge"]');
  await K.locator('[data-action="challenge"]').click();
  await K.waitForSelector('[data-ch-sheet]');
  check(await K.locator('[data-ch-name]').count() === 0, 'junior creator: no name field');
  check(!(await K.locator('[data-ch-preview]').innerText()).includes('₪'), 'junior creator: the message has no shekel sign');
  await ctxK.close();

  // ================= 320x568 layout =================
  const ctxS = await newCtx(browser, { w: 320, h: 568 });
  const S = await open(ctxS, { path: `#c=${hashA[2]}`, waitFor: '[data-screen="challenge"]' });
  await layout(S, 'intro-320x568');
  const pinned = await S.evaluate(() => { const b = document.querySelector('[data-action="ch-play"]').getBoundingClientRect(); return b.bottom <= innerHeight + 0.5 && b.top >= 0; });
  check(pinned, '320x568: the intro CTA is pinned inside the viewport');
  await S.goto(`${URL_BASE}#c=${flipped}`);
  await S.waitForSelector('[data-screen="challenge-error"]');
  await layout(S, 'error-320x568');
  await S.goto(`${URL_BASE}#c=${fresh}`);
  await S.waitForSelector('[data-screen="challenge"]');
  await layout(S, 'intro-fresh-320x568');
  // compare / timeline / board at 320 from B's stored results
  await S.evaluate((st) => localStorage.setItem('passivo.challenges', st), JSON.stringify(storeB));
  await S.goto(URL_BASE);
  await S.waitForSelector('[data-screen="start"]');
  await layout(S, 'home-320x568');
  await S.locator('[data-action="family-board"]').click();
  await S.waitForSelector('[data-screen="family-board"]');
  await layout(S, 'board-320x568');
  await S.locator('[data-board-row]').first().click();
  await S.waitForSelector('[data-screen="compare"]');
  await layout(S, 'compare-320x568');
  const keyRow = await S.evaluate(() => { const r = document.querySelector('.cmp-key').getBoundingClientRect(); const f = document.querySelector('.ch-foot').getBoundingClientRect(); return r.bottom <= f.top + 1; });
  check(keyRow, '320x568: the key row stays above the pinned footer');
  await S.locator('[data-action="ch-replay"]').click();
  await S.waitForSelector('[data-screen="timeline"]');
  await layout(S, 'timeline-320x568');
  await ctxS.close();

  // ================= errors + URL lengths =================
  for (const [name, p] of [['A', A], ['B', B]]) check(p.errors.length === 0, `no page errors on ${name}${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 3))}` : ''}`);
  console.log(`URL lengths with the hash (this run): ${urls.join(', ')}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
  console.log('\nchallenge smoke: all checks passed');
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
