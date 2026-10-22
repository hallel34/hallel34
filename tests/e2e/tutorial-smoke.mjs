// 'המשחק הראשון עם פסיבו' end to end: story (skip, replay), the first turns with their guided hints, the summary card, the family
// HUD, the hot-seat one-tap hand-over. Optional axe pass on every new state (AXE=/path/to/axe.min.js, installed outside the repo).
// Run: npm run build && SMOKE_H=640 node tests/e2e/tutorial-smoke.mjs   (PLAYERS=1|2, SMOKE_H=640|800|568 SMOKE_W=360|320)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { moneyContrast } from './contrast-lib.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4181);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const W = Number(process.env.SMOKE_W || 360);
const H = Number(process.env.SMOKE_H || 640);
const PLAYERS = Number(process.env.PLAYERS || 1);
const THEME = process.env.THEME || 'dark'; // dark | light (the numerals are measured in both, see contrast())
const AXE = process.env.AXE && existsSync(process.env.AXE) ? readFileSync(process.env.AXE, 'utf8') : null;
const OUT = new URL('../../qa/screens/tutorial/', import.meta.url).pathname;
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
const tag = `${W}x${H}${PLAYERS > 1 ? '-2p' : ''}`;

const axed = new Set();
/** Every amount on screen reads at 4.5:1 or better against what is really behind it (gradients included). */
async function contrast(page, key) {
  const r = await moneyContrast(page);
  check(r.bad.length === 0, `numeral contrast >= 4.5:1 on ${key} (${THEME}, ${tag}, ${r.checked} amounts)${r.bad.length ? ` ${JSON.stringify(r.bad.slice(0, 4))}` : ''}`);
}
async function axe(page, key) {
  if (axed.has(key)) return;
  axed.add(key);
  await contrast(page, key);
  if (!AXE) return;
  // axe must never run mid-fade: wait until every finite animation has ended
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(0, 2).join(' / ')) }));
  });
  check(r.length === 0, `axe: no WCAG A/AA violations on ${key} (${tag})${r.length ? ` ${JSON.stringify(r)}` : ''}`);
}
async function noHScroll(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(r.sw <= r.cw, `no horizontal scroll on ${label} (${r.sw}/${r.cw})`);
}
async function tapTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert]'); })
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: el.className.toString().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((x) => (x.w < 47.5 || x.h < 47.5) && !/term/.test(x.cls)));
  check(small.length === 0, `touch targets >= 48px on ${label}${small.length ? ` (${JSON.stringify(small.slice(0, 3))})` : ''}`);
}
async function shot(page, name) { await page.screenshot({ path: `${OUT}${name}-${tag}.png` }); }

const OBSERVER = () => {
  window.__hints = [];
  const start = () => {
    const root = document.getElementById('app');
    if (!root) { setTimeout(start, 50); return; }
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (!(n instanceof Element) || !n.classList.contains('note-hint')) continue;
        const turn = document.querySelector('.screen-board')?.dataset.turn;
        setTimeout(() => {
          const r = n.getBoundingClientRect();
          const hit = (sel) => { const e = document.querySelector(sel); if (!e) return false; const b = e.getBoundingClientRect(); return r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5; };
          window.__hints.push({ id: n.dataset.hint, turn, text: n.textContent.trim(), roll: hit('.btn-roll'), hud: hit('.hud'), dice: hit('.dice'), board: hit('.board'), status: hit('.board-status'), inVp: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && r.top >= 0 });
        }, 500);
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
  document.addEventListener('DOMContentLoaded', start);
};

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
    await page.waitForTimeout(350);
    await page.locator('[data-action="go"]').click();
  }
  await page.waitForSelector('.story-screen');
  if (skipStory) {
    await page.locator('[data-action="story-skip"]').click();
    await page.waitForSelector('.layer-story', { state: 'detached' });
    await page.waitForSelector('[data-screen="board"]');
  }
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.addInitScript((th) => { try { localStorage.setItem('passivo.prefs', JSON.stringify({ theme: th })); } catch { /* ignore */ } }, THEME);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(OBSERVER);

  // ---- 1. the story: opens after the family start, skippable, flag + toast ----
  await begin(page, { players: PLAYERS, skipStory: false });
  await axe(page, 'story screen 1');
  await page.locator('[data-action="story-next"]').click();
  await page.waitForTimeout(500);
  await axe(page, 'story screen 2');
  await page.locator('[data-action="story-skip"]').click();
  await page.waitForSelector('.layer-story', { state: 'detached' });
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('passivo.tutorial')).storyDone === true), 'skipping the story saves the flag (it will not nag again)');
  check(await page.locator('.toast').count() >= 1 || await page.evaluate(() => /בהגדרות/.test(document.getElementById('toast-layer').textContent)), 'skip shows the "see it again in the settings" toast');

  await page.waitForSelector('[data-screen="board"]');
  await page.waitForSelector('.toast', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  await noHScroll(page, 'family board (first game)');
  await tapTargets(page, 'family board (first game)');
  const hud = await page.evaluate(() => ({
    chip: document.querySelector('.flow-chip')?.textContent.replace(/\s+/g, ' ').trim(), goal: document.querySelector('.goal-line:not([hidden])')?.textContent, free: document.querySelector('.free-line:not([hidden])')?.textContent,
    chipH: document.querySelector('.flow-chip')?.getBoundingClientRect().height, expense: getComputedStyle(document.querySelector('.flow-chip')).color,
  }));
  check(/נשאר בחודש/.test(hud.chip) && /₪/.test(hud.chip), `family HUD chip reads "נשאר בחודש +₪X" (${hud.chip})`);
  check(hud.chipH >= 47.5, `flow chip is a 48px target (${hud.chipH})`);
  // the goal line is never hidden: the full sentence, a short form at <= 640 and a minimal one-liner at <= 600
  check(/המטרה: /.test(hud.goal ?? ''), `goal line shown to first-timers at every height (${hud.goal ?? 'HIDDEN'})`);
  check(H > 640 ? /שהכסף שעובד בשבילכם יהיה גדול מההוצאות/.test(hud.goal ?? '') : true, 'tall screens: the full goal sentence');
  check(H > 640 || H <= 600 || /כסף שעובד מעל ההוצאות/.test(hud.goal ?? ''), 'at 640 the short goal line');
  check(H > 600 || /המטרה: מעל ההוצאות/.test(hud.goal ?? ''), 'at <= 600 the minimal one-liner');
  check(/עוד ₪[\d,]+ ועוד קצת בחודש לחופש/.test(hud.free ?? ''), `"עוד ₪X ועוד קצת בחודש לחופש" under the meter: winning needs strictly more (${hud.free})`);
  await shot(page, 'board-first-game');
  await axe(page, 'family board with hint');

  // popover
  if (PLAYERS === 1) {
    await page.locator('.flow-chip').click();
    await page.waitForSelector('.flow-popover');
    await page.waitForTimeout(350);
    const pop = await page.evaluate(() => { const p = document.querySelector('.flow-popover').getBoundingClientRect(); const r = document.querySelector('.btn-roll').getBoundingClientRect(); const cash = document.querySelector('.hud-cash').getBoundingClientRect(); return { bottom: p.bottom, rollTop: r.top, top: p.top, cashBottom: cash.bottom, text: document.querySelector('.flow-popover').innerText.replace(/\s+/g, ' '), expanded: document.querySelector('.flow-chip').getAttribute('aria-expanded') }; });
    check(pop.bottom <= pop.rollTop && pop.top >= pop.cashBottom, `popover sits under the cash and clear of the roll button (${Math.round(pop.top)}-${Math.round(pop.bottom)} / ${Math.round(pop.rollTop)})`);
    check(/כסף שנכנס/.test(pop.text) && /הוצאות/.test(pop.text) && /נשאר בחודש/.test(pop.text) && pop.expanded === 'true', 'popover shows money in, money out and what is left');
    await shot(page, 'hud-popover');
    await axe(page, 'HUD popover open');
    await page.mouse.click(5, H - 5);
    await page.waitForSelector('.flow-popover', { state: 'detached' });
  }

  // ---- 2. play the first turns ----
  const logTurns = [];
  let turnsSeen = 0;
  let tour = 0; let guessIntro = false; let summarySeen = { plain: false, income: false }; let firstDealNoGuess = null; let secondDealGuess = null; let dealCount = 0;
  let lastKey = '';
  const deadline = Date.now() + Number(process.env.SMOKE_GAME_MS || 120000);
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
      const top = layers[layers.length - 1];
      const b = document.querySelector('.screen-board');
      if (!b) return { done: true };
      const base = { turn: Number(b.dataset.turn), cash: Number(b.dataset.cash), exp: Number(b.dataset.expenses), btn: b.dataset.btn, assets: Number(b.dataset.assets) };
      if (!top) return { ...base, kind: document.querySelector('.note-hint') ? 'note-hint' : document.querySelector('.note') ? 'note' : 'board' };
      if (top.querySelector('.summary-card')) { const c = top.querySelector('.summary-card'); return { ...base, kind: 'summary', neg: c.dataset.summary, strip: !!c.querySelector('.hint-strip'), income: !!c.querySelector('.hint-ring, .sc-passive.has-income') }; }
      if (top.querySelector('.handoff-sheet')) return { ...base, kind: 'handoff', recap: !!top.querySelector('[data-recap]'), extra: !!top.querySelector('.hint-strip') };
      const card = top.querySelector('.card');
      if (card) return { ...base, kind: `card-${card.dataset.card}`, guess: card.dataset.guess, strip: !!card.querySelector('.hint-strip'), step: card.querySelector('.hint-strip')?.dataset.step, afford: card.dataset.afford, payback: Number(card.dataset.payback), cost: Number(card.dataset.cost), ctype: card.dataset.kind };
      if (top.querySelector('.limit')) return { ...base, kind: 'loan', strip: !!top.querySelector('.hint-strip') };
      return { ...base, kind: 'layer' };
    });
    if (st.done) break;
    if (st.turn > turnsSeen) { turnsSeen = st.turn; }
    const need = PLAYERS > 1 ? 8 : 7;
    if (turnsSeen >= need && st.kind === 'board') break;
    const key = `${st.kind}${st.strip ? '+strip' : ''}${st.step ? `#${st.step}` : ''}${st.guess ? `:${st.guess}` : ''}${st.neg ? `:${st.neg}` : ''}`;
    if (key !== lastKey) {
      lastKey = key;
      if (/strip|hint|handoff|summary|loan|card-opportunity/.test(key)) {
        await page.waitForTimeout(1300);
        await noHScroll(page, key);
        await shot(page, `state-${key.replace(/[^\w+#:-]/g, '_')}-t${st.turn}`);
        await axe(page, key);
        if (/card|loan|summary|handoff/.test(st.kind)) await tapTargets(page, key);
        // a strip must sit between the numbers and the buttons: never over a button
        const over = await page.evaluate(() => { const s = document.querySelector('#modal-root .hint-strip'); if (!s) return null; const r = s.getBoundingClientRect(); return [...document.querySelectorAll('#modal-root .btn, #modal-root [data-action]')].filter((e) => !s.contains(e)).some((e) => { const b = e.getBoundingClientRect(); return b.width && r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5; }); });
        if (over !== null) check(!over, `hint strip never covers a button (${key})`);
        if (st.kind.startsWith('card') || st.kind === 'loan' || st.kind === 'summary') await page.evaluate(() => { const s = document.querySelector('#modal-root .hint-strip'); if (s) { const r = s.getBoundingClientRect(); window.__stripVp = r.bottom <= innerHeight + 0.5 && r.top >= 0; } });
        if (st.strip) check(await page.evaluate(() => window.__stripVp !== false), `hint strip is inside the viewport (${key})`);
      }
      logTurns.push(key + `@${st.turn}`);
    }
    const click = async (sel) => { const l = page.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 2500 }).catch(() => {}); return true; } return false; };
    const L = '#modal-root .layer:last-child ';
    if (st.kind === 'summary') {
      if (st.strip) summarySeen[st.income ? 'income' : 'plain'] = true;
      await click(`${L}[data-action="summary-ok"]`);
    } else if (st.kind === 'handoff') {
      await click(`${L}[data-action="roll-next"]`);
    } else if (st.kind === 'card-opportunity') {
      if (st.strip && st.guess === 'off' && st.step === '1') { tour += 1; if (dealCount === 0 && firstDealNoGuess === null) firstDealNoGuess = true; }
      if (st.guess === 'ask') { if (dealCount >= 1) secondDealGuess = true; guessIntro = guessIntro || st.strip; await click(`${L}[data-action="guess-${st.payback <= 96 ? 'good' : 'bad'}"]`); await page.waitForTimeout(300); continue; }
      if (st.strip && st.step && Number(st.step) < 5) { await click(`${L}[data-action="hint-next"]`); await page.waitForTimeout(450); continue; }
      if (st.strip && st.step === '5') { await click(`${L}[data-action="hint-next"]`); await page.waitForTimeout(300); continue; }
      dealCount += 1;
      const afford = st.afford === 'true' && st.ctype !== 'stock' && st.cash - st.cost >= st.exp * 0.3;
      if (!(afford && await click(`${L}[data-action="buy"]:not([disabled])`))) await click(`${L}[data-action="pass"]`);
    } else if (st.kind.startsWith('card')) {
      (await click(`${L}[data-action="pay"]`)) || (await click(`${L}[data-action="ok"]`)) || (await click(`${L}[data-action="skip"]`)) || (await click(`${L}[data-action="loan"]`)) || (await click(`${L}[data-action="decline"]`));
    } else if (st.kind === 'loan') {
      await click(`${L}[data-action="take"]`);
    } else if (st.kind === 'layer') {
      (await click(`${L}[data-action="cancel"]`)) || (await click(`${L}[data-action="ok"]`));
    } else if (st.btn !== 'rolling' && st.btn !== 'working') {
      await click('[data-action="roll"]:not([disabled])');
    }
    await page.waitForTimeout(220);
  }

  console.log('states:', logTurns.join(' '));
  const hints = await page.evaluate(() => window.__hints);
  const ids = hints.map((x) => x.id);
  check(new Set(ids).size === ids.length, `each floating hint shows once (${ids.join(', ')})`);
  const perTurn = {};
  for (const x of hints) perTurn[x.turn] = (perTurn[x.turn] ?? 0) + 1;
  check(Object.values(perTurn).every((n) => n <= 1), `at most one floating hint per turn (${JSON.stringify(perTurn)})`);
  check(hints.every((x) => !x.roll && !x.hud && !x.dice && !x.status && x.inVp), `floating hints never cover the roll button, HUD, die or status and stay on screen (${JSON.stringify(hints.map((x) => [x.id, x.roll, x.hud, x.dice, x.status, x.inVp]))})`);
  check(hints.every((x) => (x.text || '').length <= 200), 'hint bubbles are short');
  if (PLAYERS === 1) {
    check(hints.some((x) => x.id === 'h-summary-square' && x.turn === '0'), 'the payday-square hint shows before the first roll (the next payday is within the roll)');
    check(firstDealNoGuess === true || tour === 0, `the first apartment/business card has the tour and no guess window (tours ${tour})`);
    check(tour <= 1, 'the card tour shows once');
    check(summarySeen.plain || summarySeen.income, 'a summary hint appeared at the first summary');
  } else {
    check(true, `hot-seat first turns: ${logTurns.length} states`);
  }
  check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);

  // ---- 3. replay from settings and the help button; parent card; kid how-to ----
  if (PLAYERS === 1) {
    await page.evaluate(() => { document.querySelector('[data-action="home"]')?.click(); });
    await page.waitForSelector('.home-sheet');
    await page.locator('[data-action="home-confirm"]').click();
    await page.waitForSelector('[data-screen="start"]');
    await page.locator('.topbar .icon-btn').nth(1).click(); // help
    await page.waitForSelector('[data-howto="kid"]');
    await page.waitForTimeout(400);
    check(await page.locator('[data-action="howto-story"]').count() === 1 && await page.locator('.howto li').count() === 5, 'family how-to: story row, dictionary row and five short rules');
    await noHScroll(page, 'kid how-to');
    await shot(page, 'howto-kid');
    await axe(page, 'kid how-to');
    await page.locator('[data-action="howto-parent"]').click();
    await page.waitForSelector('[data-parent-card]');
    await page.waitForTimeout(400);
    check(await page.locator('.parent-steps li').count() === 3 && await page.locator('.parent-q').count() === 3, 'parent card: 3 sentences, 3 questions');
    await shot(page, 'parent-card');
    await axe(page, 'parent card');
    await page.keyboard.press('Escape');
    await page.locator('[data-action="howto-story"]').click();
    await page.waitForSelector('.story-screen');
    check(await page.locator('.story-screen').count() === 1, 'the help sheet replays the story');
    await page.locator('[data-action="story-skip"]').click();
    await page.waitForSelector('.layer-story', { state: 'detached' });
    await page.keyboard.press('Escape');
    // dictionary shows the kid name with the real term underneath
    await page.locator('.topbar .icon-btn').first().click();
    await page.waitForSelector('.dict-item');
    const dict = await page.locator('.dict-list').innerText();
    check(/כסף שעובד בשבילכם/.test(dict) && /המילה המקצועית: הכנסה פסיבית/.test(dict), 'dictionary (family): kid name with the real term underneath');
    await shot(page, 'dictionary-family');
    await axe(page, 'dictionary family');
    await page.keyboard.press('Escape');
    // settings: family rows
    await page.locator('.topbar .icon-btn').last().click();
    await page.waitForSelector('[data-action="replay-story"]');
    await page.waitForTimeout(300);
    check(await page.locator('[data-action="replay-hints"]').count() === 1 && await page.locator('#pref-helpOn').count() === 1, 'settings (family): help switch, replay story, replay hints');
    await shot(page, 'settings-family');
    await axe(page, 'settings family');
    await tapTargets(page, 'settings family');
    await page.locator('[data-action="replay-story"]').click();
    await page.waitForSelector('.story-screen');
    for (let i = 0; i < 4; i++) await page.locator('.story-next').click();
    await page.waitForTimeout(500);
    await axe(page, 'story screen 5');
    // screen 5 is five short parts ('הבא' x4), then the last button goes on
    for (let i = 0; i < 4; i++) { await page.locator('.story-next').click(); await page.waitForTimeout(350); }
    await axe(page, 'story screen 5 last part');
    await page.locator('.story-next').click();
    await page.waitForSelector('[data-story="offer"]');
    await axe(page, 'check offer');
    await page.locator('[data-action="check-yes"]').click();
    await page.waitForSelector('[data-story="quiz"]');
    await page.waitForTimeout(400);
    await axe(page, 'check question');
    await page.locator('.quiz-option[data-correct="false"]').first().click();
    await page.waitForSelector('.quiz-hint');
    await axe(page, 'check retry');
    await page.locator('[data-action="quiz-showme"]').click();
    await page.waitForSelector('.quiz-explain');
    await axe(page, 'check explanation');
    await page.locator('[data-action="quiz-next"]').click();
    await page.locator('[data-action="quiz-showme"]').click();
    await page.locator('[data-action="quiz-next"]').click();
    await page.locator('[data-action="quiz-showme"]').click();
    await page.locator('[data-action="quiz-next"]').click();
    await page.waitForSelector('[data-story="result"]');
    await page.waitForTimeout(400);
    check(await page.locator('[data-action="quiz-replay"]').count() === 1, 'check result links back to the screen of a missed question');
    await shot(page, 'check-result-some');
    await axe(page, 'check result');
    await page.locator('[data-action="quiz-replay"]').click();
    await page.waitForSelector('[data-action="story-back-to"]');
    await page.waitForTimeout(600);
    await axe(page, 'story single replay');
    await page.locator('[data-action="story-back-to"]').click();
    await page.locator('[data-action="check-go"]').click();
  }
  check(errors.length === 0, `no console/page errors at the end${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nTUTORIAL SMOKE PASSED');
}
main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
