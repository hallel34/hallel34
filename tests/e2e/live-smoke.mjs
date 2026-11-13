// Live-play smoke (PR #20 live QA): NOT seeded. Real games are played through the UI with random dice, the way a person plays, because the
// seeded smokes missed six issues that only show in live play. It covers: a DOM text scan for the literals "null" / "undefined" / "NaN" on
// every profession x rank x screen (F2); a short one-player game played to "rounds over" at 320x568 (F3 headline, F4 recap, F1: the current
// career behaviour of that ending, no console error); a real win and a real loss with the career block, the profile prompt and a relaunch with
// the profile; a junior short game; a two-player hot-seat short game; and full mode.
// Run: npm run build && node tests/e2e/live-smoke.mjs   (LIVE_ONLY=scan,short,win,loss,junior,two,full picks parts; SMOKE_URL=... uses a running server)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4186);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = process.env.SMOKE_OUT || new URL('../../test-results/live/', import.meta.url).pathname;
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const ONLY = (process.env.LIVE_ONLY || 'scan,short,win,loss,junior,two,full').split(',');
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
const SKIP_STORY = { seenIntro: '1', tutorial: { storyDone: true, helpOn: false, quizDone: true } };
const newCtx = (browser, { w = 360, h = 800 } = {}) => browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem',
  reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'],
});
async function open(ctx, { storage = {}, path = '' } = {}) {
  const page = await ctx.newPage();
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
  await page.waitForSelector('[data-screen]');
  await page.waitForTimeout(400);
  return page;
}
const stored = async (page, key) => JSON.parse((await page.evaluate((k) => localStorage.getItem(`passivo.${k}`), key)) ?? 'null');
const screenOf = (page) => page.evaluate(() => document.querySelector('section[data-screen]')?.dataset.screen ?? null);
const noHScroll = async (page, label) => { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); check(r.sw <= r.cw, `no horizontal scroll on ${label} (${r.sw}/${r.cw})`); };

/** Every text node, aria-label, alt and title on the page that reads like a leaked value. */
const LEAK = /(^|[^\p{L}\p{N}_])(null|undefined|NaN|\[object Object\])([^\p{L}\p{N}_]|$)/u;
async function scanLeaks(page, label) {
  const found = await page.evaluate((src) => {
    const re = new RegExp(src, 'u');
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (re.test(n.nodeValue)) out.push(`${n.parentElement?.className || n.parentElement?.tagName}: ${n.nodeValue.trim().slice(0, 60)}`);
    for (const e of document.querySelectorAll('[alt],[aria-label],[title]')) {
      const v = `${e.getAttribute('alt') ?? ''} ${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`;
      if (re.test(v)) out.push(`attr ${e.tagName}: ${v.trim().slice(0, 60)}`);
    }
    return out;
  }, LEAK.source);
  check(found.length === 0, `no leaked null/undefined/NaN on ${label}${found.length ? ` ${JSON.stringify(found.slice(0, 3))}` : ''}`);
}

// ---------- one player's move, judged and clicked in ONE page task ----------
function decide({ policy, answerPromotion }) {
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
    if (q('.handoff-sheet', top)) return { click: `${L} [data-action="roll-next"]` };
    if (q('.summary-card', top)) return { click: `${L} [data-action="summary-ok"]` };
    const card = q('.card', top);
    if (card) {
      const kind = card.dataset.card;
      if (card.dataset.promotion) return { click: `${L} [data-promotion] [data-action="${answerPromotion}"]`, promotion: true };
      if (kind === 'opportunity' && card.dataset.kind === 'choice' && btn('choose-a')) return { click: `${L} [data-action="choose-a"]` };
      if (kind === 'opportunity' && card.dataset.guess === 'ask') return { click: `${L} [data-action="guess-skip"]` };
      if (kind === 'opportunity') {
        // F6: the projected-debt ledger on the card (rows that add up), read in the same task as the decision
        const led = q('.debt-ledger', card);
        const ledger = led ? [...led.querySelectorAll('.dl-value')].map((e) => Number(e.textContent.replace(/[^\d]/g, ''))) : null;
        const withLedger = (d) => (ledger ? { ...d, ledger, ledgerTotal: Number(led.dataset.debtAfter) } : d);
        // 'buyer' buys sensible deals, 'reckless' buys everything it can open a loan for
        if (policy === 'spendthrift') return withLedger({ click: `${L} [data-action="pass"]` });
        // 'saboteur' buys only the bad deals (a long or endless payback), with a loan when cash is short, and pays every expense by loan
        if (policy === 'saboteur') return withLedger({ click: `${L} [data-action="${card.dataset.kind !== 'stock' && !(Number(card.dataset.payback) <= 200) && btn('buy') ? 'buy' : 'pass'}"]` });
        const good = policy === 'reckless' ? card.dataset.kind !== 'stock' : card.dataset.kind !== 'stock' && Number(card.dataset.payback) <= 130 && cash - Number(card.dataset.cost) >= expenses * 0.5;
        if (good && btn('buy')) return withLedger({ click: `${L} [data-action="buy"]` });
        return withLedger({ click: `${L} [data-action="pass"]` });
      }
      // 'spendthrift' pays every unexpected expense with a bank loan and buys nothing: the debt payments eat the cash flow until the game is lost
      if (kind === 'expense') for (const a of (policy === 'spendthrift' || policy === 'saboteur' ? ['loan', 'pay', 'sell'] : ['pay', 'loan', 'sell'])) if (btn(a)) return { click: `${L} [data-action="${a}"]` };
      if (kind === 'charity') return { click: `${L} [data-action="skip"]` };
      if (kind === 'market' && btn('accept') && policy !== 'cautious') return { click: `${L} [data-action="accept"]` };
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
const STEP = `(arg) => {
  const decide = ${decide.toString()};
  const d = decide(arg);
  if (d.click) { const el = document.querySelector(d.click); d.clicked = !!el && !el.disabled; if (d.clicked) el.click(); }
  else if (d.clickEl) {
    const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
    const els = [...(layers[layers.length - 1]?.querySelectorAll('.btn-option:not([disabled])') ?? [])];
    d.clicked = els.length > 0; if (d.clicked) els[els.length - 1].click();
  }
  return d;
}`;
const STEP_FN = new Function(`return ${STEP}`)();
async function playToEnd(page, { policy = 'buyer', budgetMs = Number(process.env.SMOKE_GAME_MS || 420000) } = {}) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  const ledgers = [];
  while (Date.now() < deadline) {
    const d = await page.evaluate(STEP_FN, { policy, answerPromotion: 'promotion-keep' });
    if (d.ledger && !ledgers.some((l) => l.join() === d.ledger.join())) ledgers.push(d.ledger.concat(d.ledgerTotal));
    if (d.done) return { done: d.done, rolls, ledgers };
    if (d.clicked && /\[data-action="roll(-next)?"\]$/.test(d.click)) rolls += 1; // hot-seat: the one-tap hand-over rolls
    await page.waitForTimeout(d.clicked ? 15 : 40);
  }
  return { done: 'timeout', rolls, ledgers };
}

/** Home -> players (length, age, count) -> pick `prof` -> go. Returns on the board. */
async function startGame(page, { prof = 'teacher', mode = 'family', age = null, short = false, players = 1 } = {}) {
  await page.locator(`.mode-card[data-mode="${mode}"]`).click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  for (let k = 1; k < players; k++) await page.locator('[aria-label="שחקן נוסף"]').click();
  if (players > 1) for (let k = 0; k < players; k++) await page.locator('.name-input').nth(k).fill(`שחקן${k + 1}`);
  if (age) await page.locator(`label.age-chip:has(input[data-age="${age}"])`).first().click();
  if (short) await page.locator('label.age-chip:has(input[data-length="short"])').click();
  await page.locator('[data-action="players-next"]').click();
  for (let k = 0; k < players; k++) {
    await page.waitForSelector('[data-screen="pick"]');
    await page.locator(`.prof-card[data-prof="${k === 0 ? prof : ['cook', 'driver', 'nurse'][k - 1]}"]`).click();
    await page.waitForSelector('.pick-sheet');
    await page.waitForTimeout(300);
    await page.locator('[data-action="go"]').click();
  }
  await page.waitForSelector('section[data-screen="board"]');
}
const PROFS = ['teacher', 'engineer', 'driver', 'nurse', 'programmer', 'police', 'cook', 'lawyer'];
const career = (p) => ({ v: 1, active: p.id, profiles: [p] });
const profile = (extra = {}) => ({
  id: 'p1', name: 'נועה', age: '14plus', fox: 'teacher', since: '2026-10-01', games: 3,
  ranks: Object.fromEntries(PROFS.map((id) => [id, { rank: 3, xp: 0 }])), peak: Object.fromEntries(PROFS.map((id) => [id, 3])),
  lastPlayWeek: null, settledWeek: null, missed: 0, lastPlayDate: null, lastGame: null, achievements: {},
  counters: { badPasses: 0, challengeStreak: 0, wins: 1, wonProfessions: [] }, ...extra,
});

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const allErrors = [];

  // ================= F2: every profession x rank x screen, with and without a profile =================
  if (ONLY.includes('scan')) {
    for (const withProfile of [false, true]) {
      const ctx = await newCtx(browser);
      const p = await open(ctx, { storage: withProfile ? { career: career(profile()) } : {} });
      await p.locator('.mode-card[data-mode="family"]').click();
      await p.locator('[data-action="start"]').click();
      await p.waitForSelector('[data-screen="players"]');
      await scanLeaks(p, `players (${withProfile ? 'profile' : 'no profile'})`);
      await p.locator('[data-action="players-next"]').click();
      await p.waitForSelector('[data-screen="pick"]');
      await p.waitForTimeout(600);
      await scanLeaks(p, `profession pick (${withProfile ? 'profile' : 'no profile'})`);
      for (const id of PROFS) {
        const ranks = withProfile ? [0, 1, 2, 3] : [0];
        for (const r of ranks) {
          await p.locator(`.prof-card[data-prof="${id}"]`).click();
          await p.waitForSelector('.pick-sheet');
          if (withProfile) { await p.locator(`.rank-chip input[data-rank="${r}"]`).check({ force: true }).catch(() => {}); }
          await p.waitForTimeout(150);
          await scanLeaks(p, `preview sheet ${id} rank ${r}`);
          await p.locator('.pick-sheet .sheet-handle').click();
          await p.waitForSelector('.pick-sheet', { state: 'detached' });
        }
      }
      if (withProfile) await scanLeaks(p, 'pick rank rows');
      await ctx.close();
    }
    // the profile screen (rank rows) and the board HUD
    const ctx = await newCtx(browser);
    const p = await open(ctx, { storage: { career: career(profile()) } });
    await p.locator('[data-action="profile"]').click();
    await p.waitForSelector('[data-screen="career-profile"]');
    await p.waitForTimeout(400);
    await scanLeaks(p, 'profile screen (rank rows)');
    await p.locator('[data-action="cr-back"], .ch-back, [data-action="back"]').first().click().catch(() => {});
    await ctx.close();
    for (const id of PROFS) {
      const c2 = await newCtx(browser);
      const g = await open(c2);
      await startGame(g, { prof: id });
      await scanLeaks(g, `board HUD ${id}`);
      await c2.close();
    }
  }

  // ================= F1/F3/F4: a short one-player game played to "rounds over" at 320x568 =================
  if (ONLY.includes('short')) {
    const ctx = await newCtx(browser, { w: 320, h: 568 });
    const p = await open(ctx);
    await startGame(p, { prof: 'teacher', short: true });
    const end = await playToEnd(p, { policy: 'buyer' });
    check(end.done === 'win' || end.done === 'over', `a short game ended (${end.done}, ${end.rolls} rolls)`);
    await p.waitForTimeout(1500);
    await noHScroll(p, 'the short game end screen at 320x568');
    await scanLeaks(p, 'the short game end screen');
    const save = await stored(p, 'save');
    const info = await p.evaluate(() => ({
      screen: document.querySelector('section[data-screen]')?.dataset.screen, freedom: document.querySelector('section[data-screen]')?.dataset.freedom,
      title: document.querySelector('.end-hero h1')?.innerText ?? '', tagline: document.querySelector('.end-hero .tagline')?.innerText ?? '',
      career: !!document.querySelector('.cr-end'), prompt: !!document.querySelector('[data-career-prompt]'),
    }));
    console.log(`short end: ${JSON.stringify(info)}`);
    if (info.screen === 'win' && info.freedom === 'false') {
      check(!/חופש כלכלי!/.test(info.title) && /נגמרו הסיבובים/.test(info.title), `F3: a rounds-over end does not announce freedom ("${info.title}")`);
      check(/עוד לא הגעתם לחופש/.test(info.tagline), `F3: the text says freedom is not reached yet ("${info.tagline}")`);
      check(!info.career && !info.prompt, 'F1 (current behaviour): a rounds-over end shows no career block and no profile prompt');
      const career0 = await stored(p, 'career');
      check(career0 === null, 'F1 (current behaviour): a rounds-over end writes nothing to the career store');
      await p.locator('[data-action="report"]').click();
      await p.waitForSelector('.rep');
      const rep = await p.locator('.rep').innerText();
      check(!/מישהו אחר|שחקן אחר|סיים ראשון/.test(rep), 'F4: the solo recap never says someone else finished first');
      check(!/הגעתם לחופש כלכלי במשחק/.test(rep), 'the recap does not claim freedom was reached');
      await scanLeaks(p, 'the report sheet');
    } else if (info.screen === 'win') {
      check(/חופש כלכלי!/.test(info.title), `a real win (reached before the round limit) says freedom ("${info.title}")`);
    }
    check(p.errors.length === 0, `no console errors in the short game${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
    allErrors.push(...p.errors);
    await ctx.close();
  }

  // ================= a real win with the career: prompt -> profile -> block, then a relaunch with the profile =================
  if (ONLY.includes('win')) {
    const ctx = await newCtx(browser);
    const p = await open(ctx);
    await startGame(p, { prof: 'teacher' });
    const end = await playToEnd(p, { policy: 'buyer' });
    check(end.done === 'win' || end.done === 'over', `a normal game ended (${end.done}, ${end.rolls} rolls)`);
    await p.waitForTimeout(1500);
    if (end.done === 'win') {
      check(/חופש כלכלי!/.test(await p.locator('.end-hero h1').innerText()), 'a real win says "חופש כלכלי!"');
      check(await p.locator('[data-career-prompt]').count() === 1, 'a real win without a profile offers to create one');
      await p.locator('[data-action="cr-create"]').click();
      await p.waitForSelector('[data-sheet="profile-edit"]');
      await p.locator('[data-cr-name]').fill('דנה');
      await p.locator('[data-sheet="profile-edit"] input[data-age="14plus"]').check({ force: true });
      await p.locator('[data-action="cr-save"]').click();
      await p.waitForSelector('.cr-end:not([data-career-prompt])', { timeout: 8000 }).catch(() => {});
      const c = await stored(p, 'career');
      check(c?.profiles?.length === 1 && c.profiles[0].games === 1, `creating the profile credits the game (${c?.profiles?.[0]?.games} games)`);
      // relaunch with the existing profile
      await p.reload();
      await p.waitForSelector('[data-screen="start"]');
      check(await p.locator('.career-chip').count() === 1, 'relaunch with a profile: the home shows the career chip');
      await p.locator('.career-chip').click();
      await p.waitForSelector('[data-screen="career-profile"]');
      await scanLeaks(p, 'the profile screen after a relaunch');
    }
    check(p.errors.length === 0, `no console errors in the win run${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
    allErrors.push(...p.errors);
    await ctx.close();
  }

  // ================= a real loss (best effort: a player who buys only bad deals and pays every expense with a loan) =================
  if (ONLY.includes('loss')) {
    let lost = null;
    // A scripted UI player rarely LOSES (reckless and spendthrift policies mostly win or never end): the attempts are best effort and a missing
    // loss is reported as not covered unless LIVE_REQUIRE_LOSS=1. The loss -> career path is covered by the seeded career smoke and the unit tests.
    for (let game = 1; game <= Number(process.env.LIVE_LOSS_GAMES ?? 0) && !lost; game++) {
      const ctx = await newCtx(browser);
      const p = await open(ctx);
      await startGame(p, { prof: 'cook', mode: 'full' });
      const end = await playToEnd(p, { policy: process.env.LIVE_LOSS_POLICY || 'saboteur', budgetMs: 240000 });
      console.log(`loss attempt ${game}: ${end.done} after ${end.rolls} rolls`);
      if (end.done === 'over') { lost = p; await p.waitForTimeout(1500); } else await ctx.close();
      if (lost) {
        check(await p.locator('section[data-screen="over"]').count() === 1, 'a real loss shows the game-over screen');
        check(await p.locator('[data-career-prompt]').count() === 1, 'a real loss without a profile offers to create one (the career path runs for a loss)');
        check(!/חופש כלכלי!/.test(await p.locator('section[data-screen="over"]').innerText()), 'the game-over screen never says freedom');
        check(p.errors.length === 0, `no console errors in the loss run${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
        allErrors.push(...p.errors);
        await ctx.close();
      }
    }
    if (lost || process.env.LIVE_REQUIRE_LOSS) check(!!lost, 'a real loss was reached in live play');
    else console.log('NOT COVERED live: a real loss (set LIVE_LOSS_GAMES=n LIVE_LOSS_POLICY=saboteur to try; no scripted policy loses reliably)');
  }

  // ================= junior: a short game in coins =================
  if (ONLY.includes('junior')) {
    const ctx = await newCtx(browser);
    const p = await open(ctx);
    await startGame(p, { prof: 'teacher', age: 'upTo10', short: true });
    const end = await playToEnd(p, { policy: 'buyer' });
    check(end.done === 'win' || end.done === 'over', `a junior short game ended (${end.done})`);
    await p.waitForTimeout(1500);
    const text = await p.locator('section[data-screen]').innerText();
    check(!/₪/.test(text), 'the junior end screen reads in coins (no shekel sign)');
    await scanLeaks(p, 'the junior end screen');
    check(p.errors.length === 0, `no console errors in the junior run${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
    allErrors.push(...p.errors);
    await ctx.close();
  }

  // ================= two players, hot-seat, short =================
  if (ONLY.includes('two')) {
    const ctx = await newCtx(browser);
    const p = await open(ctx);
    await startGame(p, { mode: 'family', short: true, players: 2 });
    const end = await playToEnd(p, { policy: 'buyer' });
    check(end.done === 'win' || end.done === 'over', `a two-player short game ended (${end.done}, ${end.rolls} rolls)`);
    await p.waitForTimeout(1500);
    check(await p.locator('.stand-row').count() === 2, 'the end screen lists both players in the standings');
    await scanLeaks(p, 'the two-player end screen');
    check(p.errors.length === 0, `no console errors in the two-player run${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
    allErrors.push(...p.errors);
    await ctx.close();
  }

  // ================= full mode =================
  if (ONLY.includes('full')) {
    const ctx = await newCtx(browser);
    const p = await open(ctx);
    await startGame(p, { prof: 'engineer', mode: 'full', short: true });
    const end = await playToEnd(p, { policy: 'buyer' });
    check(end.done === 'win' || end.done === 'over', `a full-mode short game ended (${end.done}, ${end.rolls} rolls)`);
    // F6: every deal card's debt ledger adds up: today's debts (+ the deal's loan) (+ a bank loan) = the total it shows
    check(end.ledgers.length > 0, `full mode showed ${end.ledgers.length} deal cards with a debt ledger`);
    check(end.ledgers.every((l) => l.slice(0, -2).reduce((a, b) => a + b, 0) === l[l.length - 1] && l[l.length - 2] === l[l.length - 1]), `every debt ledger adds up ${JSON.stringify(end.ledgers.slice(0, 3))}`);
    await p.waitForTimeout(1500);
    await scanLeaks(p, 'the full-mode end screen');
    const info = await p.evaluate(() => ({ title: document.querySelector('.end-hero h1')?.innerText ?? '', freedom: document.querySelector('section[data-screen]')?.dataset.freedom }));
    if (info.freedom === 'false') check(!/חופש כלכלי!/.test(info.title), `full mode: a rounds-over end does not announce freedom ("${info.title}")`);
    check(p.errors.length === 0, `no console errors in the full-mode run${p.errors.length ? ` ${JSON.stringify(p.errors.slice(0, 2))}` : ''}`);
    allErrors.push(...p.errors);
    await ctx.close();
  }

  console.log(`console errors: ${allErrors.length}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
  console.log('\nlive smoke: all checks passed');
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
