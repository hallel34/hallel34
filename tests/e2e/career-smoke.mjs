// 0.5.0 career smoke: the promotion card in a real game (upgrade -> the lifestyle expense), the first finished game without a profile
// (the quiet "create a profile" prompt, then the career block credits that game), a rank-up from a seeded near-threshold profile (the
// dialog, the unlocked start rank, a game at that rank), seniority by moving the clock (the warning chip, the reset, the drop, a junior
// profile that only waits), the profile / picker / edit screens, and 360x800 + 320x568 layout with axe.
// Run: npm run build && node tests/e2e/career-smoke.mjs   (AXE_PATH=path/to/axe.min.js adds the accessibility checks)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { weekNumber, addDays } from '../../src/daily/calendar.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4185);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = process.env.SMOKE_OUT || new URL('../../test-results/career/', import.meta.url).pathname;
const AXE = process.env.AXE_PATH && existsSync(process.env.AXE_PATH) ? readFileSync(process.env.AXE_PATH, 'utf8') : null;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
mkdirSync(OUT, { recursive: true });

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
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a[href], label.age-chip, label.rank-chip, label.cr-fox-cell')]
    .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
    .filter((el) => !el.closest('.ch-chip'))
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: String(el.className), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 }; })
    .filter((x) => x.vis && (x.w < 47.5 || x.h < 47.5)));
  check(small.length === 0, `touch targets >= 48px on ${label}${small.length ? ` (too small: ${JSON.stringify(small.slice(0, 3))})` : ''}`);
}
async function axe(page, label) {
  if (!AXE) return;
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`));
  check(res.length === 0, `axe: 0 violations on ${label}${res.length ? ` ${JSON.stringify(res)}` : ''}`);
}
async function layout(page, tag) {
  await page.waitForTimeout(350);
  await noHScroll(page, tag);
  await tapTargets(page, tag);
  await page.screenshot({ path: `${OUT}/${tag.replace(/[^\w-]+/g, '_')}.png` });
}

// ---- the clock: Wednesday 2026-11-11, and weeks away from it ----
const WED = '2026-11-11';
const W = weekNumber(WED);
const nowOf = (key) => `${key}T10:00:00+02:00`;
const dayKeyOf = (offsetDays) => addDays(WED, offsetDays);

const profile = (extra = {}) => ({
  id: 'p1', name: 'נועה', age: '14plus', fox: 'teacher', since: '2026-10-01', games: 3,
  ranks: { teacher: { rank: 2, xp: 50 }, nurse: { rank: 1, xp: 20 } }, peak: { teacher: 2, nurse: 1 },
  lastPlayWeek: W, settledWeek: W - 1, missed: 0, lastPlayDate: WED, lastGame: null, achievements: {},
  counters: { badPasses: 0, challengeStreak: 0, wins: 1, wonProfessions: ['teacher'] }, ...extra,
});
const career = (...profiles) => ({ v: 1, active: profiles[0]?.id ?? null, profiles });

const SKIP_STORY = { seenIntro: '1', tutorial: { storyDone: true, helpOn: false, quizDone: true } };
const newCtx = (browser, { w = 360, h = 800 } = {}) => browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem',
  reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'],
});
/** Opens the app at `at` (a date key) with the given storage. */
async function open(ctx, { at = WED, storage = {}, path = '', waitFor = '[data-screen]' } = {}) {
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(nowOf(at)));
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(`passivo.${k}`, typeof v === 'string' ? v : JSON.stringify(v));
    }
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  }, { ...SKIP_STORY, ...storage });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.errors = errors;
  await page.goto(`${URL_BASE}${path}`);
  await page.waitForSelector(waitFor);
  await page.waitForTimeout(450);
  return page;
}
const ls = (page, key) => page.evaluate((k) => localStorage.getItem(`passivo.${k}`), key);
const stored = async (page, key) => JSON.parse((await ls(page, key)) ?? 'null');
const screenOf = (page) => page.evaluate(() => document.querySelector('section[data-screen]')?.dataset.screen ?? null);

/** One UI action of a sensible player; the promotion card is answered with `promo` ('pass' = keep, 'option-upgrade' = upgrade). */
function decide({ policy, promo }) {
  const q = (s, r = document) => r.querySelector(s);
  for (const s of ['win', 'over', 'start']) if (q(`section[data-screen="${s}"]`)) return { done: s };
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
      if (card.dataset.promotion) return { click: `${L} [data-action="${promo}"]`, promotion: true };
      if (kind === 'opportunity' && card.dataset.kind === 'choice' && btn('choose-a')) return { click: `${L} [data-action="choose-a"]` };
      if (kind === 'opportunity' && card.dataset.guess === 'ask') return { click: `${L} [data-action="guess-skip"]` };
      if (kind === 'opportunity') {
        const good = card.dataset.kind !== 'stock' && Number(card.dataset.payback) <= 130 && cash - Number(card.dataset.cost) >= expenses * 0.5;
        return { click: `${L} [data-action="${card.dataset.afford === 'true' && good && btn('buy') ? 'buy' : 'pass'}"]` };
      }
      if (kind === 'expense') for (const a of ['pay', 'loan', 'sell']) if (btn(a)) return { click: `${L} [data-action="${a}"]` };
      if (kind === 'charity') return { click: `${L} [data-action="skip"]` };
      if (kind === 'market' && btn('accept') && policy === 'buyer') return { click: `${L} [data-action="accept"]` };
      if (q('.btn-option:not([disabled])', top)) return { clickEl: true };
      if (btn('ok')) return { click: `${L} [data-action="ok"]` };
      if (btn('decline')) return { click: `${L} [data-action="decline"]` };
      if (q('.audit-opt:not([disabled])', top)) return { click: `${L} .audit-opt` };
    }
    if (btn('take')) return { click: `${L} [data-action="take"]` };
    if (q('.sell-row [data-action="sell"]', top)) return { click: `${L} .sell-row [data-action="sell"]` };
    if (btn('cancel')) return { click: `${L} [data-action="cancel"]` };
    return { wait: true };
  }
  if (q('[data-action="roll"]:not([disabled])')) return { click: '[data-action="roll"]' };
  return { wait: true };
}
/**
 * The text of every promotion sentence a player can read: the card before the choice and the log / fox lines after it. A node that was
 * moved between sentences left an amount missing (QA 0.5.0 P1-2); the amounts must be in every sentence, in family, full and junior.
 */
function scanPromotionText(label, card, after) {
  const money = /₪\s?[\d,]+|\d[\d,]*\s?מטבע/g;
  const has = /₪\s?[\d,]+|\d[\d,]*\s?מטבע/;
  check((card.match(money) || []).length >= 6, `${label}: the promotion card shows its amounts in every sentence (${(card.match(money) || []).length} found)`);
  check(!/(עוד|ב-|של|נשארים|נשאר|יוצאים) {2,}\S/.test(card) && !/ב- *[,.]/.test(card), `${label}: no empty slot in the card text (${JSON.stringify(card.match(/.{14} {2,}.{10}/)?.[0] ?? '')})`);
  const lines = after.split('\n').filter((l) => /קידום בעבודה:|המשכורת עלתה|שדרגתם|מעכשיו יוצאים|נשארים לכם/.test(l));
  check(lines.length >= 1 && lines.every((l) => has.test(l)), `${label}: the log and the fox line carry their amounts (${lines.length} lines: ${JSON.stringify(lines.slice(0, 2))})`);
  check(!lines.some((l) => /ב- *[,.]|של {2,}|עוד {2,}/.test(l)), `${label}: no empty slot in the log and fox text`);
  check(!/אביזר/.test(card + after), `${label}: no accessory is promised`);
}
async function playToEnd(page, { policy = 'buyer', promo = 'pass', budgetMs = Number(process.env.SMOKE_GAME_MS || 300000), stopAfterPromotion = false } = {}) {
  const deadline = Date.now() + budgetMs;
  const seen = { promotion: 0, lifestyle: false, rolls: 0, cardText: '', afterText: '' };
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide, { policy, promo });
    if (d.done) return { done: d.done, ...seen };
    if (d.clickEl) await page.locator('#modal-root .layer:last-child .btn-option:not([disabled])').last().click({ timeout: 3000, force: true }).catch(() => {});
    else if (d.click) {
      if (d.click === '[data-action="roll"]') seen.rolls += 1;
      if (d.promotion && !seen.promotion) {
        for (let i = 0; i < 20 && !/₪|מטבע/.test(seen.cardText); i++) { // the card text can be empty while it opens
          seen.cardText = await page.evaluate(() => document.querySelector('#modal-root .layer:last-child .card')?.innerText ?? '');
          if (!/₪|מטבע/.test(seen.cardText)) await page.waitForTimeout(100);
        }
        await layout(page, `promotion-card-${page.viewportSize().width}x${page.viewportSize().height}`);
      }
      await page.locator(d.click).first().click({ timeout: 3000, force: true }).catch(() => {});
      if (d.promotion) {
        seen.promotion += 1;
        await page.waitForTimeout(400);
        if (seen.promotion === 1) {
          for (let i = 0; i < 25; i++) { // the log line and the fox line appear a moment after the choice
            seen.afterText = await page.evaluate(() => document.body.innerText);
            if (/קידום בעבודה:/.test(seen.afterText) && /המשכורת עלתה, ו|שדרגתם|מעכשיו יוצאים|נשארים לכם עוד/.test(seen.afterText)) break;
            await page.waitForTimeout(120);
          }
        }
        if (stopAfterPromotion) return { done: 'promotion', ...seen };
        const save = await stored(page, 'save');
        const st = save?.players?.[0]?.state;
        if (promo === 'option-upgrade') seen.lifestyle = !!st?.profession?.expenses?.some((e) => e.id === 'lifestyle') && st?.promotion?.status === 'upgraded';
        else seen.kept = st?.promotion?.status === 'kept';
      }
      await page.waitForTimeout(15);
    } else await page.waitForTimeout(40);
  }
  return { done: 'timeout', ...seen };
}
/** From home: start -> players -> pick `prof` -> (sheet) go. Returns after the board is up. */
async function startGame(page, { prof = 'teacher', rank = null, mode = 'family', age = null } = {}) {
  await page.locator(`.mode-card[data-mode="${mode}"]`).click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  if (age) await page.locator(`input[data-age="${age}"]`).check({ force: true });
  await page.locator('[data-action="players-next"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  await page.locator(`.prof-card[data-prof="${prof}"]`).click();
  await page.waitForSelector('.pick-sheet');
  if (rank !== null) await page.locator(`.rank-chip input[data-rank="${rank}"]`).check({ force: true });
  await page.waitForTimeout(250);
  await page.locator('[data-action="go"]').click();
  await page.waitForSelector('section[data-screen="board"]');
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

  // ================= A. no profile: the promotion in a real game, the prompt, creating the profile credits the game =================
  const ctxA = await newCtx(browser);
  const A = await open(ctxA, { path: '?seed=777', waitFor: '[data-screen="start"]' });
  check(await A.locator('.career-chip').count() === 0, 'no profile: no career chip on home');
  await layout(A, 'home-no-profile-360x800');
  await startGame(A);
  const endA = await playToEnd(A, { promo: 'option-upgrade' });
  check(endA.done === 'win' || endA.done === 'over', `game A ended (${endA.done}, ${endA.rolls} rolls)${A.errors.length ? ` errors ${JSON.stringify(A.errors.slice(0, 3))}` : ""}`);
  check(endA.promotion === 1, `the promotion card was offered exactly once (${endA.promotion})`);
  check(endA.lifestyle, 'upgrade: the lifestyle expense is in the game and the promotion record says upgraded');
  await A.waitForSelector('[data-career-prompt]', { timeout: 8000 });
  check(await A.locator('[data-action="cr-create"]').count() === 1, 'the end screen offers "create a profile" (a quiet text button)');
  const actionsInside = await A.evaluate(() => [...document.querySelectorAll('.end-actions .btn')].every((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5; }));
  check(actionsInside, 'the end screen buttons stay inside the 360x800 viewport with the prompt');
  await layout(A, `end-prompt-${endA.done}-360x800`);
  await A.locator('[data-action="cr-create"]').click();
  await A.waitForSelector('[data-sheet="profile-edit"]');
  check(await A.locator('[data-action="cr-save"]').isDisabled(), 'the age band is required: "save" is disabled until one is chosen');
  await A.locator('[data-cr-name]').fill('נועה');
  await A.locator('[data-age="14plus"]').check({ force: true });
  await A.locator('[data-fox="nurse"]').check({ force: true });
  await layout(A, 'profile-create-sheet-360x800');
  await axe(A, 'profile create sheet');
  await A.locator('[data-action="cr-save"]').click();
  await A.waitForSelector('[data-career-end]');
  const careerA = await stored(A, 'career');
  check(careerA?.profiles?.length === 1 && careerA.profiles[0].age === '14plus' && careerA.profiles[0].fox === 'nurse', 'the profile is stored with its age and fox');
  check(careerA.profiles[0].games === 1 && Object.values(careerA.profiles[0].ranks).some((r) => r.xp > 0 || r.rank > 0), 'the first game was credited to the new profile (XP in teacher)');
  const blockText = await A.locator('[data-career-end]').innerText();
  check(/ניסיון/.test(blockText), `the career block shows the XP gain (${blockText.replace(/\n/g, ' | ').slice(0, 80)})`);
  await layout(A, `end-career-block-${endA.done}-360x800`);
  await axe(A, 'end screen with the career block');
  // the rank-up dialog (a great first game can raise a rank): one dialog, closed with its button
  await A.waitForTimeout(2500);
  if (await A.locator('[data-rankup]').count()) { await layout(A, 'rank-up-first-game-360x800'); await A.locator('[data-action="cr-rankup-ok"]').click(); await A.waitForTimeout(300); }
  check(await A.locator('[data-rankup]').count() === 0, 'the rank-up dialog is one dialog and closes');
  // home now has the chip
  await A.locator('[data-action="menu"]').click();
  await A.waitForSelector('[data-screen="start"]');
  check(await A.locator('.career-chip').count() === 1, 'home shows the career chip after the profile exists');
  check(await A.locator('.career-chip').getAttribute('data-career-state') === 'kept', 'the chip says the week is kept (a game was finished)');
  await layout(A, 'home-chip-kept-360x800');
  await axe(A, 'home with the career chip');
  // the profile screen
  await A.locator('[data-action="profile"]').click();
  await A.waitForSelector('[data-screen="career-profile"]');
  check(await A.locator('.cr-rank').count() === 8, 'the profile lists a ranks row for each of the 8 professions');
  check(await A.locator('[data-ach-grid] .cr-medal').count() >= 14, 'the achievements grid is shown');
  check(await A.locator('[data-ach="first-freedom"]').getAttribute('data-earned') === (endA.done === 'win' ? 'true' : 'false'), `"first freedom" is earned exactly when the game was won (${endA.done})`);
  await layout(A, 'profile-360x800');
  await axe(A, 'profile screen');
  await A.locator('[data-ach="first-freedom"]').click();
  await A.waitForSelector('[data-sheet="achievement"]');
  await layout(A, 'achievement-sheet-360x800');
  await A.keyboard.press('Escape');
  // edit: age down to "up to 10" -> the chip turns to the name only; then delete
  await A.locator('[data-action="cr-edit"]').click();
  await A.waitForSelector('[data-sheet="profile-edit"]');
  await A.locator('[data-age="upTo10"]').check({ force: true });
  await A.locator('[data-action="cr-save"]').click();
  await A.waitForSelector('[data-screen="career-profile"]');
  check((await stored(A, 'career')).profiles[0].age === 'upTo10', 'the age can be edited freely');
  check(await A.locator('[data-sen="waiting"]').count() === 1, 'a protected profile sees the "career waits" card, no rule, no days');
  await layout(A, 'profile-junior-360x800');
  await A.locator('[data-action="cr-edit"]').click();
  await A.waitForSelector('[data-sheet="profile-edit"]');
  await A.locator('[data-action="cr-delete"]').click();
  await A.waitForSelector('[data-action="cr-delete-confirm"]');
  await A.locator('[data-action="cr-delete-confirm"]').click();
  await A.waitForSelector('[data-screen="start"]');
  check((await stored(A, 'career')).profiles.length === 0 && await A.locator('.career-chip').count() === 0, 'deleting the profile removes it and the chip');
  check(A.errors.length === 0, `no page errors on A${A.errors.length ? ` ${JSON.stringify(A.errors.slice(0, 3))}` : ''}`);
  await ctxA.close();

  // ================= B. a rank-up from a seeded profile, and a game at the new rank =================
  const ctxB = await newCtx(browser);
  const B = await open(ctxB, { path: '?seed=4242', storage: { career: career(profile({ ranks: { teacher: { rank: 0, xp: 89 } }, peak: { teacher: 0 } })) }, waitFor: '[data-screen="start"]' });
  await B.locator('.mode-card[data-mode="family"]').click();
  await B.locator('[data-action="start"]').click();
  await B.waitForSelector('[data-screen="players"]');
  await B.locator('[data-action="players-next"]').click();
  await B.waitForSelector('[data-screen="pick"]');
  check(await B.locator('.prof-card[data-prof="teacher"] .pick-rank').count() === 1, 'the pick cards show the rank row');
  await layout(B, 'pick-ranks-360x800');
  await axe(B, 'profession pick with ranks');
  await B.locator('.prof-card[data-prof="teacher"]').click();
  await B.waitForSelector('.pick-sheet');
  const chips = await B.locator('.rank-chip').evaluateAll((els) => els.map((e) => ({ locked: e.classList.contains('is-locked'), checked: !!e.querySelector('input:checked') })));
  check(chips.length === 4 && chips[0].checked && chips.slice(1).every((c) => c.locked), `the start rank chips: rank 1 chosen, ranks 2-4 locked (${JSON.stringify(chips.map((c) => (c.locked ? 'L' : c.checked ? 'X' : '-')))})`);
  await layout(B, 'pick-sheet-rank-360x800');
  await axe(B, 'pick sheet with the rank chips');
  await B.locator('[data-action="go"]').click();
  await B.waitForSelector('section[data-screen="board"]');
  const saveB1 = await stored(B, 'save');
  check(saveB1.players[0].state.rank === undefined && saveB1.promotion === true && saveB1.players[0].state.promotion?.status === 'waiting', 'a rank 0 game carries the promotion rule and no rank field');
  const endB = await playToEnd(B, { promo: 'pass' });
  check(endB.done === 'win' || endB.done === 'over', `game B ended (${endB.done})`);
  await B.waitForSelector('[data-rankup]', { timeout: 15000 });
  const rankText = await B.locator('[data-rankup]').innerText();
  check(['מחנך/ת כיתה', 'רכז/ת שכבה', 'מנהל/ת בית ספר'].some((x) => rankText.includes(x)), `the rank-up dialog names the new title (${rankText.split('\n').filter(Boolean).slice(1, 2)})`);
  await layout(B, 'rank-up-360x800');
  await axe(B, 'rank-up dialog');
  await B.locator('[data-action="cr-rankup-ok"]').click();
  const careerB = await stored(B, 'career');
  check(careerB.profiles[0].ranks.teacher.rank >= 1 && careerB.profiles[0].peak.teacher >= 1 && careerB.profiles[0].achievements['first-rank-up'], `a rank above 0 reached (rank ${careerB.profiles[0].ranks.teacher.rank}), the history and "first-rank-up" stored`);
  await B.locator('[data-action="menu"]').click();
  await B.waitForSelector('[data-screen="start"]');
  await startGame(B, { prof: 'teacher', rank: 1 });
  const saveB2 = await stored(B, 'save');
  const s2 = saveB2.players[0].state;
  check(s2.rank === 1 && s2.profession.salary === 11200 && s2.profession.rankTitle === 'מחנך/ת כיתה' && s2.dealScale > 1, `a game at rank 1: salary ${s2.profession.salary}, ${s2.profession.rankTitle}, deal scale ${s2.dealScale}`);
  check(B.errors.length === 0, `no page errors on B${B.errors.length ? ` ${JSON.stringify(B.errors.slice(0, 3))}` : ''}`);
  await ctxB.close();

  // ================= B2. the promotion sentences carry their amounts: family, full and junior, keep and upgrade =================
  for (const [label, opts, promo] of [['family', { mode: 'family' }, 'pass'], ['family upgrade', { mode: 'family' }, 'option-upgrade'], ['full', { mode: 'full' }, 'pass'], ['full upgrade', { mode: 'full' }, 'option-upgrade'], ['junior', { mode: 'family', age: 'upTo10' }, 'pass'], ['junior upgrade', { mode: 'family', age: 'upTo10' }, 'option-upgrade']]) {
    const ctxP = await newCtx(browser);
    const P = await open(ctxP, { waitFor: '[data-screen="start"]' });
    await startGame(P, opts);
    const r = await playToEnd(P, { promo, stopAfterPromotion: true });
    check(r.done === 'promotion', `${label}: the promotion card came up (${r.done})`);
    if (r.done === 'promotion') scanPromotionText(label, r.cardText, r.afterText);
    await ctxP.close();
  }

  // ================= B3. the profile screens on a launch with nothing to settle and no earlier game (QA 0.5.0 P1-1) =================
  {
    const ctxQ = await newCtx(browser);
    const Q = await open(ctxQ, { storage: { career: career(profile()) }, waitFor: '[data-screen="start"]' });
    const raw = (t) => /\b(career|profile|achievement|promotion|challenge)\.[a-zA-Z]+/.test(t);
    await Q.locator('[data-action="profile"]').click();
    await Q.waitForSelector('[data-screen="career-profile"]');
    await Q.waitForTimeout(300);
    check(!raw(await Q.locator('section[data-screen="career-profile"]').innerText()), 'the profile screen shows no raw string keys on a launch that loaded no career strings');
    await Q.locator('[data-action="cr-edit"]').click();
    await Q.waitForSelector('[data-sheet="profile-edit"]');
    check(!raw(await Q.locator('[data-sheet="profile-edit"]').innerText()), 'the edit sheet shows no raw string keys');
    await Q.keyboard.press('Escape');
    await Q.waitForTimeout(300);
    await Q.locator('[data-action="cr-switch"]').click().catch(() => {});
    await Q.waitForTimeout(500);
    if (await screenOf(Q) === 'career-picker') check(!raw(await Q.locator('section[data-screen="career-picker"]').innerText()), 'the picker shows no raw string keys');
    await ctxQ.close();
  }

  // ================= C. seniority by moving the clock =================
  const adult = career(profile());
  const show = async (label, at, storage, ctx2) => open(ctx2, { at, storage: { career: storage }, waitFor: '[data-screen]' }).then(async (p) => { console.log(`${label}: ${await screenOf(p)}`); return p; });
  const ctxC = await newCtx(browser);
  // Thursday of the played week: the chip is still green (a game was finished this week)
  let p = await show('same week', dayKeyOf(1), adult, ctxC);
  check(await screenOf(p) === 'start' && await p.locator('.career-chip').getAttribute('data-career-state') === 'kept', 'same week: no return screen, the chip says kept');
  await p.close();
  // next week, Thursday, no game yet: the warning (3 days) on the chip and the sentence on home (800px tall)
  p = await show('next week, Thursday', dayKeyOf(8), adult, ctxC);
  check(await p.locator('.career-chip').getAttribute('data-career-state') === 'warn', 'Thursday with no game this week: the chip is in the warning state');
  check((await p.locator('.career-chip-label').innerText()).includes('יומיים'), `Thursday: the deadline is Friday, so two days (the amber capsule counts them:  (${await p.locator('.career-chip-label').innerText()})`);
  check(await p.locator('[data-career-warn]').count() === 1, 'the sentence is shown on home at 800px tall');
  await layout(p, 'home-chip-warn-360x800');
  await axe(p, 'home with the warning chip');
  await p.close();
  // next week, Monday: open, no warning
  p = await show('next week, Monday', dayKeyOf(5), adult, ctxC);
  check(await p.locator('.career-chip').getAttribute('data-career-state') === 'open' && await p.locator('[data-career-warn]').count() === 0, 'Monday: no warning yet');
  await p.close();
  // one full week missed: the reset return screen; ranks stay, progress resets
  p = await show('one week missed', dayKeyOf(14), adult, ctxC);
  check(await screenOf(p) === 'career-return' && await p.locator('section[data-screen="career-return"]').getAttribute('data-variant') === 'reset', 'one missed week: the return screen, reset variant');
  let c = await stored(p, 'career');
  check(c.profiles[0].ranks.teacher.rank === 2 && c.profiles[0].ranks.teacher.xp === 0 && c.profiles[0].ranks.nurse.xp === 0, 'the progress is reset in every profession and the ranks stay');
  const bodyReset = await p.locator('section[data-screen="career-return"]').innerText();
  check(!/איבדתם|הפסדתם|נכשלתם|חבל|פספסתם/.test(bodyReset), 'the return screen uses none of the loss words');
  await layout(p, 'return-reset-360x800');
  await axe(p, 'return screen (reset)');
  await p.locator('[data-action="cr-home"]').click();
  await p.waitForSelector('[data-screen="start"]');
  await p.close();
  // two weeks missed: the drop; seen once (a reload shows home)
  p = await show('two weeks missed', dayKeyOf(21), adult, ctxC);
  check(await p.locator('section[data-screen="career-return"]').getAttribute('data-variant') === 'drop', 'two missed weeks: the drop variant');
  c = await stored(p, 'career');
  check(c.profiles[0].ranks.teacher.rank === 1 && c.profiles[0].ranks.nurse.rank === 0 && c.profiles[0].peak.teacher === 2, 'every profession dropped one rank; the titles reached stay in the history');
  check(await p.locator('.cr-row').count() === 2, 'the drop list names the professions that changed');
  await layout(p, 'return-drop-360x800');
  await axe(p, 'return screen (drop)');
  await p.reload();
  await p.waitForSelector('[data-screen]');
  check(await screenOf(p) === 'start', 'the return screen is shown once: a reload goes home');
  await p.close();
  // nine absent weeks: still exactly one drop, and after it the chip never warns, even on a Thursday
  p = await show('long absence', dayKeyOf(64), adult, ctxC); // a Thursday
  c = await stored(p, 'career');
  check(c.profiles[0].ranks.teacher.rank === 1 && c.profiles[0].ranks.nurse.rank === 0 && c.profiles[0].dropped === true, `a long absence drops one rank once (teacher ${c.profiles[0].ranks.teacher.rank}, nurse ${c.profiles[0].ranks.nurse.rank})`);
  const dropText = await p.locator('section[data-screen="career-return"]').innerText();
  check(/פעם אחת בלבד/.test(dropText), 'the return screen says the drop happens once');
  await p.locator('[data-action="cr-home"]').click();
  await p.waitForSelector('[data-screen="start"]');
  check(await p.locator('.career-chip').getAttribute('data-career-state') !== 'warn' && await p.locator('[data-career-warn]').count() === 0, 'after a drop the chip does not warn on a Thursday');
  await p.close();
  // a clock moved back restores nothing
  p = await show('clock moved back', dayKeyOf(-14), career(profile({ ranks: { teacher: { rank: 1, xp: 0 } }, lastPlayWeek: W, settledWeek: W + 1 })), ctxC);
  check(await screenOf(p) === 'start' && (await stored(p, 'career')).profiles[0].ranks.teacher.rank === 1, 'a clock moved back: nothing happens and nothing is restored');
  await p.close();
  // junior: any absence only waits
  p = await show('junior after 8 weeks', dayKeyOf(56), career(profile({ age: 'upTo10' })), ctxC);
  check(await p.locator('section[data-screen="career-return"]').getAttribute('data-variant') === 'waited', 'a junior profile: the "your career waited" variant');
  const jtext = await p.locator('section[data-screen="career-return"]').innerText();
  check(!/ותק|ירד|התאפס|שבוע/.test(jtext), 'the junior return screen has no seniority or loss word');
  check((await stored(p, 'career')).profiles[0].ranks.teacher.rank === 2, 'a junior profile keeps every rank');
  await layout(p, 'return-junior-360x800');
  await axe(p, 'return screen (junior)');
  await p.locator('[data-action="cr-home"]').click();
  await p.waitForSelector('[data-screen="start"]');
  check(await p.locator('.career-chip').getAttribute('data-career-state') === 'waiting' && (await p.locator('.career-chip-label').innerText()) === 'נועה', 'the junior chip shows the name only');
  await p.close();
  // the picker: two profiles open it on launch
  p = await show('two profiles', WED, career(profile(), profile({ id: 'p2', name: 'דני', fox: 'cook', age: '11to13' })), ctxC);
  check(await screenOf(p) === 'career-picker' && await p.locator('.cr-tile').count() === 3, 'two profiles: the "who plays?" picker opens on launch (2 tiles + "new profile")');
  await layout(p, 'picker-360x800');
  await axe(p, 'profile picker');
  await p.locator('[data-profile="p2"]').click();
  await p.waitForSelector('[data-screen="start"]');
  check((await stored(p, 'career')).active === 'p2', 'choosing a tile makes that profile the active one');
  await p.close();
  await ctxC.close();

  // ================= D0. Friday: the last day of the week for the warning; the chip name carries its visible text =================
  const ctxF = await newCtx(browser, { w: 320, h: 568 });
  p = await open(ctxF, { at: dayKeyOf(9), storage: { career: adult }, waitFor: '[data-screen="start"]' }); // a Friday
  check(await p.locator('.career-chip').getAttribute('data-career-state') === 'warn', 'Friday with no game: the chip warns');
  await axe(p, 'home with the Friday chip at 320x568');
  await p.close();
  p = await open(ctxF, { at: dayKeyOf(10), storage: { career: adult }, waitFor: '[data-screen="start"]' }); // a Saturday: a bonus day, the last day
  check(await p.locator('.career-chip').getAttribute('data-career-state') === 'warn', 'Saturday with no game: the chip still shows the last day (never 0)');
  await p.close();
  await ctxF.close();

  // ================= D. 320x568 =================
  const ctxS = await newCtx(browser, { w: 320, h: 568 });
  p = await open(ctxS, { at: dayKeyOf(8), storage: { career: adult }, waitFor: '[data-screen="start"]' });
  check(await p.locator('[data-career-warn]').count() === 0, '320x568: the warning sentence is not shown on home (the chip carries the number)');
  const chipBox = await p.locator('.career-chip').boundingBox();
  check(chipBox.width >= 47.5 && chipBox.height >= 47.5 && chipBox.x >= 0, `320x568: the compact chip is a 48px target inside the screen (${Math.round(chipBox.width)}x${Math.round(chipBox.height)})`);
  await layout(p, 'home-chip-320x568');
  await p.locator('[data-action="profile"]').click();
  await p.waitForSelector('[data-screen="career-profile"]');
  await layout(p, 'profile-320x568');
  await p.locator('[data-action="cr-edit"]').click();
  await p.waitForSelector('[data-sheet="profile-edit"]');
  await layout(p, 'profile-edit-320x568');
  await axe(p, 'profile edit sheet 320x568');
  await p.keyboard.press('Escape');
  await p.close();
  p = await open(ctxS, { at: dayKeyOf(21), storage: { career: adult }, waitFor: '[data-screen="career-return"]' });
  await layout(p, 'return-drop-320x568');
  const cta = await p.evaluate(() => { const b = document.querySelector('[data-action="cr-play"]').getBoundingClientRect(); return b.bottom <= innerHeight + 0.5; });
  check(cta, '320x568: the return screen button stays inside the viewport');
  await p.close();
  p = await open(ctxS, { storage: { career: career(profile({ ranks: { teacher: { rank: 0, xp: 89 } } })) }, waitFor: '[data-screen="start"]' });
  await p.locator('.mode-card[data-mode="family"]').click();
  await p.locator('[data-action="start"]').click();
  await p.waitForSelector('[data-screen="players"]');
  await p.locator('[data-action="players-next"]').click();
  await p.waitForSelector('[data-screen="pick"]');
  await layout(p, 'pick-ranks-320x568');
  await p.locator('.prof-card[data-prof="teacher"]').click();
  await p.waitForSelector('.pick-sheet');
  await layout(p, 'pick-sheet-rank-320x568');
  await p.close();
  await ctxS.close();

  console.log(`page errors: ${[A, B].reduce((n, x) => n + x.errors.length, 0)}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
  console.log('\ncareer smoke: all checks passed');
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
