// Full-flow smoke test: plays a game start -> win at 360x800 against the built app.
// Run: npm run build && npm run smoke   (starts `vite preview`; or set SMOKE_URL to test a deployed URL)
// Uses the pre-installed Chromium (CHROMIUM_PATH) or Playwright's default browser.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import {
  createEngine, newMatch, act, serialize, purchasePlan, currentState, maxLoan, loanTerms, PAYDAY_MONTHS,
} from '../../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4179);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = process.env.SMOKE_OUT || new URL('../../test-results/', import.meta.url).pathname;
const MODE = process.env.SMOKE_MODE || 'family';
const HEIGHT = Number(process.env.SMOKE_H || 800); // 800 or 640
const PLAYERS = Number(process.env.SMOKE_PLAYERS || 1); // 1 = single player, 2-4 = hot-seat
const exe = process.env.CHROMIUM_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
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
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
  check(r.sw <= r.cw && r.bw <= r.cw, `no horizontal scroll on ${label} (${r.sw}/${r.cw})`);
}

async function tapTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"]')]
    .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
    .map((el) => { const r = el.getBoundingClientRect(); return { cls: el.className, w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 }; })
    .filter((x) => x.vis && (x.w < 47.5 || x.h < 47.5)));
  check(small.length === 0, `touch targets >= 48px on ${label}${small.length ? ` (too small: ${JSON.stringify(small.slice(0, 3))})` : ''}`);
}

/** Fox images: sized (width/height), async-decoded, decorative ones have alt="", and nothing mouse-related is shown. */
async function foxChecks(page, label) {
  await page.waitForFunction(() => [...document.querySelectorAll('img.fox')].every((i) => i.loading === 'lazy' || (i.complete && i.naturalWidth > 0)), null, { timeout: 4000 }).catch(() => {});
  const r = await page.evaluate(() => [...document.querySelectorAll('img.fox')].map((i) => ({
    pose: i.className, w: i.getAttribute('width'), h: i.getAttribute('height'), dec: i.getAttribute('decoding'), alt: i.getAttribute('alt'), hidden: i.getAttribute('aria-hidden'),
    ok: i.loading === 'lazy' || (i.complete && i.naturalWidth > 0),
  })));
  check(r.length > 0, `fox image present on ${label}`);
  check(r.every((x) => x.w && x.h && x.dec === 'async'), `fox images have width/height + decoding=async on ${label}`);
  check(r.every((x) => x.alt !== null && (x.alt !== '' || x.hidden === 'true')), `fox images have alt (or are aria-hidden decorative) on ${label}`);
  check(r.every((x) => x.ok), `fox images decoded on ${label}${r.some((x) => !x.ok) ? ` (${JSON.stringify(r.filter((x) => !x.ok))})` : ''}`);
  const mouse = await page.evaluate(() => /mouse|עכבר/i.test(document.documentElement.outerHTML));
  check(!mouse, `no mouse mascot anywhere in the DOM on ${label}`);
}

/** The reaction strip (under the board) must never overlap the HUD, the board, the die or the roll button. */
async function reactionStripClear(page) {
  const r = await page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const hit = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const host = box('.react-host');
    return { host: !!host, hud: hit(host, box('.hud')), board: hit(host, box('.board')), roll: hit(host, box('.btn-roll')), dice: hit(host, box('.dice')) };
  });
  check(r.host && !r.hud && !r.board && !r.roll && !r.dice, `reaction pop-up strip never covers the HUD, board, die or roll button (${JSON.stringify(r)})`);
}

/** Every given selector's box must lie fully inside the viewport (nothing below the fold, nothing cut off). */
async function insideViewport(page, selectors, label) {
  const r = await page.evaluate((sels) => sels.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, missing: true };
    const b = e.getBoundingClientRect();
    return { s, top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, ok: b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.left >= 0 && b.right <= innerWidth + 0.5 };
  }), selectors);
  check(r.every((x) => x.ok), `${label} fully inside the ${r[0]?.ih}px viewport${r.some((x) => !x.ok) ? ` ${JSON.stringify(r.filter((x) => !x.ok))}` : ''}`);
}

async function noVScroll(page, label) {
  const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  check(r.sh <= r.ih, `no vertical page scroll on ${label} (${r.sh}/${r.ih})`);
}

/** Decides the next UI action with a simple "sensible" policy. Returns a selector to click, or null. */
function decide(policy) {
  const q = (s, r = document) => r.querySelector(s);
  if (q('[data-screen="win"]')) return { done: 'won' };
  if (q('[data-screen="over"]')) return { done: 'over' };
  if (q('[data-screen="start"]') || q('[data-screen="players"]') || q('[data-screen="pick"]')) return { done: 'left' };
  const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
  const top = layers[layers.length - 1];
  const board = q('.screen-board');
  let shot = null;
  const rb = q('.btn-roll');
  const btn0 = rb ? { text: rb.textContent.trim(), disabled: rb.disabled, mode: board?.dataset.btn } : null;
  const out = (o) => ({ ...o, shot, btn: btn0, layer: !!top });
  const cash = Number(board?.dataset.cash || 0);
  const expenses = Number(board?.dataset.expenses || 0);
  if (top) {
    if (q('.handoff-sheet', top)) { return out({ click: '#modal-root .layer:last-child [data-action="ready"]' }); }
    if (q('.home-sheet', top)) return out({ wait: true });
    const card = q('.card', top);
    const btn = (a) => q(`[data-action="${a}"]:not([disabled])`, top);
    if (!card) shot = top.querySelector('.limit') ? 'dialog-loan' : (top.querySelector('.sell-list') ? 'dialog-sell' : 'dialog-other');
    if (card) {
      const kind = card.dataset.card;
      shot = `card-${kind}${kind === 'expense' && btn('pay') ? '-paid' : ''}${kind === 'opportunity' ? `-${card.dataset.kind}` : ''}`;
      if (kind === 'opportunity') {
        const afford = card.dataset.afford === 'true';
        const payback = Number(card.dataset.payback);
        const cost = Number(card.dataset.cost);
        const good = policy === 'reckless' ? true : card.dataset.kind !== 'stock' && payback <= 130 && cash - cost >= expenses * 0.5;
        if (afford && good && btn('buy')) return out({ click: '#modal-root .layer:last-child [data-action="buy"]' });
        return out({ click: '#modal-root .layer:last-child [data-action="pass"]' });
      }
      if (kind === 'expense') {
        if (btn('pay')) return out({ click: '#modal-root .layer:last-child [data-action="pay"]' });
        if (btn('loan')) return out({ click: '#modal-root .layer:last-child [data-action="loan"]' });
        if (btn('sell')) return out({ click: '#modal-root .layer:last-child [data-action="sell"]' });
      }
      if (kind === 'charity') {
        if (btn('donate') && cash > expenses * 3) return out({ click: '#modal-root .layer:last-child [data-action="donate"]' });
        return out({ click: '#modal-root .layer:last-child [data-action="skip"]' });
      }
      if (kind === 'market' && btn('accept')) return out({ click: '#modal-root .layer:last-child [data-action="accept"]' });
      if (btn('ok')) return out({ click: '#modal-root .layer:last-child [data-action="ok"]' });
      if (btn('decline')) return out({ click: '#modal-root .layer:last-child [data-action="decline"]' });
    }
    if (btn('take')) return out({ click: '#modal-root .layer:last-child [data-action="take"]' });
    if (q('.sell-row [data-action="sell"]', top)) return out({ click: '#modal-root .layer:last-child .sell-row [data-action="sell"]' });
    if (btn('cancel')) return out({ click: '#modal-root .layer:last-child [data-action="cancel"]' });
    return out({ wait: true });
  }
  const cont = q('[data-action="continue"]:not([disabled])');
  if (cont) { shot = 'continue'; return out({ click: '[data-action="continue"]' }); }
  const roll = q('[data-action="roll"]:not([disabled])');
  if (roll) return out({ click: '[data-action="roll"]' });
  return out({ wait: true });
}

const shots = new Set();
async function playGame(page, tag, budgetMs = Number(process.env.SMOKE_GAME_MS || 150000)) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  let resumed = false;
  let stuck = 0;
  let statementChecked = false;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide, process.env.SMOKE_POLICY || 'sensible');
    if (d.done) return { result: d.done, rolls };
    // The primary button must never read "..." or be empty, and must never stay disabled with nothing on screen to wait for.
    if (d.btn && /^[.\s]*$/.test(d.btn.text) && !failures.includes('primary button text is empty or "..."')) check(false, 'primary button text is empty or "..."');
    stuck = d.wait && d.btn?.disabled && !d.layer ? stuck + 1 : 0;
    if (stuck === 300) { check(false, `board stuck on a disabled button "${d.btn.text}" (${d.btn.mode}) for 12s`); return { result: 'stuck', rolls }; }
    if (!statementChecked && d.click === '[data-action="roll"]') {
      const info = await page.evaluate(() => ({ assets: Number(document.querySelector('.screen-board')?.dataset.assets || 0), mortgages: Number(document.querySelector('.screen-board')?.dataset.mortgages || 0) }));
      if (info.assets > 0) { statementChecked = true; await checkStatementLiabilities(page, info); }
    }
    if (d.shot && !shots.has(d.shot)) {
      shots.add(d.shot);
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/${d.shot}.png` });
      await noHScroll(page, d.shot);
      await tapTargets(page, d.shot);
      // P1: the card's sticky action bar (buy/pass etc.) must never sit below the fold, at any supported height
      if (d.shot.startsWith('card-')) await insideViewport(page, ['#modal-root .layer:last-child .card-actions', '#modal-root .layer:last-child .card-actions .btn'], `${d.shot} action bar`);
    }
    if (d.click) {
      if (d.click === '[data-action="roll"]') {
        rolls += 1;
        if (rolls === 3 && !resumed && process.env.SMOKE_RESUME !== '0') {
          resumed = true;
          await page.waitForTimeout(400);
          await testResume(page);
          continue;
        }
        if (rolls === 2) await noHScroll(page, `board after roll (${tag})`);
        if (rolls === 7 && PLAYERS > 1 && !shots.has('multi-board')) {
          shots.add('multi-board');
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${OUT}/board-multi.png` });
          await noHScroll(page, 'multiplayer board');
          await tapTargets(page, 'multiplayer board');
          await reactionStripClear(page);
          await insideViewport(page, ['.btn-roll', '.others-strip'], 'roll button + others strip');
          const pawnsBox = await page.evaluate(() => [...document.querySelectorAll('.pawn-slot')].map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; }));
          check(new Set(pawnsBox.map((b) => `${b.x},${b.y}`)).size === PLAYERS, `every pawn is visible at its own spot (${JSON.stringify(pawnsBox)})`);
          await page.locator('[data-action="others"]').click();
          await page.waitForSelector('.others-panel:not([hidden])');
          await page.waitForTimeout(300);
          const cover = await page.evaluate(() => { const p = document.querySelector('.others-panel').getBoundingClientRect(); const b = document.querySelector('.btn-roll').getBoundingClientRect(); return p.bottom <= b.top; });
          check(cover, 'expanded others panel never covers the roll button');
          await tapTargets(page, 'others panel');
          await page.screenshot({ path: `${OUT}/others-expanded.png` });
          await page.locator('.others-close').click();
          await page.waitForSelector('.others-panel', { state: 'hidden' });
        }
      }
      await page.locator(d.click).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(25);
    } else {
      await page.waitForTimeout(40);
    }
  }
  return { result: 'timeout', rolls };
}

async function testResume(page) {
  const before = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, cash: document.querySelector('.screen-board')?.dataset.cash }));
  await page.reload();
  await page.waitForSelector('[data-screen="start"]');
  const resume = page.locator('[data-action="resume"]');
  check(await resume.count() === 1, 'resume button shown after reload');
  await noVScroll(page, 'start with resume');
  await insideViewport(page, ['[data-action="start"]', '[data-action="resume"]', '.mode-grid'], 'start CTA + resume button');
  await resume.click();
  await page.waitForSelector('[data-screen="board"]');
  const after = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, cash: document.querySelector('.screen-board')?.dataset.cash }));
  check(before.turn === after.turn, `resumed same turn (${before.turn} -> ${after.turn})`);
}


/** Statement: every mortgage and loan is listed with balance + monthly payment, with totals that add up. */
async function checkStatementLiabilities(page, info) {
  await page.locator('[data-action="statement"]').click();
  await page.waitForSelector('.statement-body');
  await page.waitForTimeout(450);
  const r = await page.evaluate(() => {
    const num = (x) => Number((x || '').replace(/[^\d-]/g, '').replace(/^-$/, '0') || 0) * (/-/.test(x || '') ? -1 : 1);
    const rows = [...document.querySelectorAll('.st-liab')].map((e) => ({ kind: e.dataset.kind, pay: num(e.querySelector('.st-value')?.textContent.replace(/[^\d₪+-]/g, '')), text: e.textContent }));
    const sec = [...document.querySelectorAll('.st-sec-liability .st-row.st-total')].map((e) => num(e.querySelector('.st-value')?.textContent.replace(/[^\d-]/g, '')));
    const assets = [...document.querySelectorAll('.st-sec-asset .st-row')].length;
    return { rows, totals: sec, assets, kidsRow: !!document.querySelector('.st-sec-liability .st-empty') };
  });
  const mortgages = r.rows.filter((x) => x.kind === 'mortgage' || x.kind === 'bizloan'); // apartments: mortgage, businesses: bizloan (N6)
  check(mortgages.length === info.mortgages, `statement lists a mortgage row for every bought asset (${mortgages.length}/${info.mortgages})`);
  check(r.rows.every((x) => /₪/.test(x.text)), 'every liability row shows balance and payment in shekels');
  const payments = r.rows.reduce((a, x) => a + x.pay, 0);
  check(r.totals.length === 2 && r.totals[1] === payments, `total monthly payments (${r.totals[1]}) equals the sum of the rows (${payments})`);
  check(r.totals[0] > 0, 'total liabilities shown');
  await noHScroll(page, 'statement with liabilities');
  await page.screenshot({ path: `${OUT}/statement-liabilities.png` });
  await page.locator('.st-sec-liability').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/statement-liabilities-list.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.sheet', { state: 'detached' });
}

/** Home button: confirm sheet, stay, then really go home; the resume button appears and the match resumes. */
async function testHome(page, label) {
  await page.waitForSelector('[data-action="home"]');
  const aria = await page.locator('[data-action="home"]').getAttribute('aria-label');
  check(aria === 'חזרה לבית', `home button has aria-label "חזרה לבית" (${label})`);
  const box = await page.locator('[data-action="home"]').boundingBox();
  check(box.width >= 47.5 && box.height >= 47.5, `home button is a 48px target (${label})`);
  const before = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, players: document.querySelector('.screen-board')?.dataset.players }));
  await page.locator('[data-action="home"]').click();
  await page.waitForSelector('.home-sheet');
  await page.waitForTimeout(400);
  const txt = await page.locator('.home-sheet').innerText();
  check(txt.includes('לחזור לתפריט?') && txt.includes('המשחק נשמר ואפשר להמשיך אותו אחר כך'), `home confirm sheet text (${label})`);
  await tapTargets(page, `home confirm (${label})`);
  await noHScroll(page, `home confirm (${label})`);
  await page.screenshot({ path: `${OUT}/home-confirm-${label}.png` });
  await page.locator('[data-action="home-stay"]').click();
  await page.waitForSelector('.home-sheet', { state: 'detached' });
  check(await page.locator('section[data-screen="board"]').count() === 1, `"להמשיך לשחק" stays on the board (${label})`);
  // Android back button: opens the same sheet
  await page.goBack().catch(() => {});
  const viaBack = await page.waitForSelector('.home-sheet', { timeout: 2500 }).then(() => true, () => false);
  check(viaBack, `browser/Android back opens the home confirm (${label})`);
  if (viaBack) { await page.locator('[data-action="home-stay"]').click(); await page.waitForSelector('.home-sheet', { state: 'detached' }); }
  await page.locator('[data-action="home"]').click();
  await page.waitForSelector('.home-sheet');
  await page.waitForTimeout(350);
  await page.locator('[data-action="home-confirm"]').click();
  await page.waitForSelector('[data-screen="start"]');
  check(await page.locator('[data-action="resume"]').count() === 1, `resume button shown after "חזרה לבית" (${label})`);
  const resumeText = await page.locator('[data-action="resume"]').innerText();
  await page.screenshot({ path: `${OUT}/start-with-resume-${label}.png` });
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
  await page.waitForTimeout(400);
  const handoff = await page.locator('.handoff-sheet').count();
  if (handoff) await page.locator('[data-action="ready"]').click();
  const after = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, players: document.querySelector('.screen-board')?.dataset.players }));
  check(before.turn === after.turn && before.players === after.players, `home then resume restores the match (${label}: turn ${before.turn}->${after.turn}, players ${before.players}; "${resumeText}")`);
}


/** QA round 5 regressions: teardown on "home", resuming with an out player, others panel, crowded tile, plain-text status. */
async function testRound5(page) {
  const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
  const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
  const crew = ['דנה', 'Bob', 'יוסי', 'נועה'];
  const profs = ['teacher', 'engineer', 'driver', 'nurse'];
  const mk = (n, mode = MODE) => newMatch(engine, { mode, seed: 5, players: crew.slice(0, n).map((name, i) => ({ name, professionId: profs[i] })) });
  const bankrupt = (m, i) => {
    const st = structuredClone(m.players[i].state);
    st.cash = 100; st.liabilities.push({ id: 'x', kind: 'loan', label: 'loan', principal: 90000, monthlyPayment: 9000 });
    const lost = engine.roll(st, [2]);
    return { ...m, players: m.players.map((pl, k) => (k === i ? { ...pl, state: lost } : pl)) };
  };
  const load = async (m) => {
    await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
    await page.goto(`${URL_BASE}?seed=3`);
    await page.waitForSelector('[data-action="resume"]');
    await page.locator('[data-action="resume"]').click();
    await page.waitForSelector('[data-screen]');
    await page.waitForTimeout(700);
  };
  const layers = () => page.evaluate(() => document.querySelectorAll('#modal-root .layer').length);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('passivo.save')));

  // ---- P1-1: home (via the browser back path) with a card open leaves no orphan and does not touch the save
  let card = null;
  for (let seed = 1; seed < 200 && !card; seed++) {
    const m = act(newMatch(engine, { mode: MODE, players: [{ professionId: 'teacher' }], seed }), (s) => engine.roll(s, [1]));
    if (currentState(m).pending?.card && currentState(m).pending.card.type !== 'stock') card = m;
  }
  await load(card);
  await page.waitForSelector('.card[data-card="opportunity"]');
  const before = await saved();
  await page.goBack().catch(() => {});
  await page.waitForSelector('.home-sheet');
  await page.waitForTimeout(350);
  await page.locator('[data-action="home-confirm"]').click();
  await page.waitForSelector('[data-screen="start"]');
  await page.waitForTimeout(700);
  check(await layers() === 0, 'home tears down every layer (no orphan card on the start screen)');
  check(await page.locator('#modal-root [data-action="buy"]').count() === 0, 'no orphan buy button after home');
  const after = await saved();
  check(after.players[0].state.cash === before.players[0].state.cash && after.players[0].state.assets.length === 0 && after.players[0].state.pending?.kind === 'opportunity', 'save untouched by the closed card (still pending)');
  await page.locator('[data-action="resume"]').click({ timeout: 3000 });
  await page.waitForSelector('.card[data-card="opportunity"]');
  check(true, 'resume button is tappable after home and brings the card back');

  // statement + loan dialog open when going home
  await page.goBack().catch(() => {});
  await page.waitForSelector('.home-sheet');
  await page.locator('[data-action="home-stay"]').click();
  await page.waitForSelector('.home-sheet', { state: 'detached' });

  // ---- P1-2: resume with the current player already out
  let m3 = mk(3);
  m3 = bankrupt(m3, 0);
  await load(m3);
  let top = await page.locator('#modal-root .layer').last().innerText();
  check(top.includes('דנה – מחוץ למשחק') && !top.includes('הוצאה לא צפויה'), `resume with an out player shows the neutral out dialog ("${top.split('\n')[0]}")`);
  check(await page.locator('#modal-root .layer .out-fox img.pose-worried').count() === 1, 'out dialog uses the worried fox');
  await page.screenshot({ path: `${OUT}/r5-player-out-${HEIGHT}.png` });
  await page.locator('[data-action="ok"]').click();
  await page.waitForSelector('.handoff-sheet');
  top = await page.locator('.handoff-sheet').innerText();
  check(top.includes('תור של Bob'), 'after the out dialog the phone is handed to the next active player');
  await page.locator('[data-action="ready"]').click();
  await page.waitForTimeout(500);
  check(await page.locator('.btn-roll').isEnabled() && (await page.locator('.screen-board').getAttribute('data-player')) === '2', 'the next player can roll');
  check((await saved()).currentIndex === 1, 'save moved on to player 2');

  // all remaining players out -> all-out screen
  let m2 = bankrupt(bankrupt(mk(2), 0), 1);
  m2 = { ...m2, status: 'playing' };
  await load(m2);
  await page.locator('[data-action="ok"]').click();
  await page.waitForSelector('[data-screen="over"]', { timeout: 6000 });
  check((await page.locator('h1.title').innerText()).includes('כולם מחוץ למשחק'), 'everyone out -> all-out screen');
  await noVScroll(page, 'all-out screen');

  // only one active player left: no hand-over to themselves, no continue button
  let m3b = bankrupt(bankrupt(mk(3), 0), 1);
  await load(m3b);
  await page.locator('[data-action="ok"]').click();
  await page.waitForSelector('.handoff-sheet');
  await page.locator('[data-action="ready"]').click();
  await page.waitForTimeout(400);
  let rolls = 0; let handoffs = 0; let continues = 0;
  for (let i = 0; i < 200 && rolls < 3; i++) {
    const act1 = await page.evaluate(decide, 'sensible');
    if (act1.done) break;
    if (act1.wait) { await page.waitForTimeout(60); continue; }
    if (act1.click.includes('"ready"') || /ready/.test(act1.click)) handoffs++;
    if (/continue/.test(act1.click)) continues++;
    if (/roll/.test(act1.click)) rolls++;
    await page.locator(act1.click).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  check(handoffs === 0 && continues === 0 && rolls >= 3, `last player standing plays on without hand-overs (rolls ${rolls}, handoffs ${handoffs}, continues ${continues})`);

  // ---- hot-seat status names the next roller
  let hs = mk(2);
  await load(hs);
  await page.locator('[data-action="ready"]').click();
  for (let i = 0; i < 300; i++) {
    const act1 = await page.evaluate(decide, 'sensible');
    if (act1.done || /continue/.test(act1.click || '')) break;
    if (act1.wait) { await page.waitForTimeout(60); continue; }
    await page.locator(act1.click).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  const status = await page.locator('.board-status').innerText();
  check(status.includes('תור של Bob') && !status.includes('הקוביה מחכה'), `after a hot-seat turn the status names the next roller ("${status}")`);

  // ---- others panel and crowded tile, 4 players
  await load(mk(4));
  await page.locator('[data-action="ready"]').click();
  await page.waitForTimeout(500);
  const strip = await page.evaluate(() => [...document.querySelectorAll('.os-cash')].map((e) => ({ t: e.textContent, clipped: e.scrollWidth > e.clientWidth + 0.5 })));
  check(strip.length === 3 && strip.every((x) => !x.clipped), `compact strip shows every cash amount in full (${JSON.stringify(strip)})`);
  const crowd = await page.evaluate(() => {
    const t = document.querySelector('.tile[data-i="0"]').getBoundingClientRect();
    const bs = [...document.querySelectorAll('.tile[data-i="0"] .pawn-badge')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, in: r.left >= t.left - 0.5 && r.right <= t.right + 0.5 && r.top >= t.top - 0.5 && r.bottom <= t.bottom + 0.5, vis: getComputedStyle(e).display !== 'none' }; });
    return bs;
  });
  check(crowd.length === 4 && crowd.every((b) => b.in && b.vis && b.w >= 14), `4 pawns on one tile: four visible badges, all inside the tile (${JSON.stringify(crowd)})`);
  await page.screenshot({ path: `${OUT}/r5-crowded-tile-${HEIGHT}.png`, clip: { x: 0, y: 150, width: 360, height: 200 } });
  await page.locator('.others-strip').click();
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('#others-panel');
    return {
      names: [...document.querySelectorAll('.or-name')].map((e) => ({ t: e.textContent, w: Math.round(e.getBoundingClientRect().width), clipped: e.scrollWidth > e.clientWidth + 0.5 })),
      cash: [...document.querySelectorAll('.or-cash')].map((e) => e.getBoundingClientRect().right <= panel.getBoundingClientRect().right && e.getBoundingClientRect().left >= panel.getBoundingClientRect().left),
      fits: panel.scrollHeight <= panel.clientHeight + 1,
    };
  });
  check(rows.names.length === 3 && rows.names.every((n) => n.w >= 40 && !n.clipped), `others panel shows the full names (${JSON.stringify(rows.names)})`);
  check(rows.cash.every(Boolean) && rows.fits, `others panel: cash not clipped and all rows fit without scrolling (fits=${rows.fits})`);
  await page.screenshot({ path: `${OUT}/r5-others-panel-${HEIGHT}.png` });
  await noHScroll(page, 'others panel');

  // ---- duplicate names get numbered
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-screen="start"]');
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  await page.locator('[aria-label="שחקן נוסף"]').click();
  await page.locator('.name-input').nth(0).fill('דנה');
  await page.locator('.name-input').nth(1).fill('דנה');
  await page.locator('[data-action="players-next"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  await page.locator('.prof-card').first().click();
  await page.locator('[data-action="go"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  check((await page.locator('.screen-title').first().innerText()).includes('דנה 2'), 'second player named "דנה" becomes "דנה 2"');
  await page.goto(`${URL_BASE}?seed=3`);
}

/** Opportunity card with the three buy states, built from a hand-made save (deterministic). */
async function testBuyStates(page) {
  const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
  const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
  const make = (status, mode) => {
    for (let seed = 1; seed < 400; seed++) {
      let m = newMatch(engine, { mode, players: [{ professionId: 'teacher' }], seed });
      m = act(m, (s) => engine.roll(s, [1])); // square 1 = opportunity
      const s = currentState(m);
      const c = s.pending?.card;
      if (!c || c.type === 'stock') continue;
      const room = maxLoan(s);
      const cash = status === 'blocked' ? Math.max(0, c.downPayment - room - 5000) : status === 'loan' ? Math.max(0, c.downPayment - 2500) : c.downPayment + 100;
      if (status === 'blocked' && !(c.downPayment - cash > room)) continue;
      if (status === 'loan' && !(c.downPayment - cash > 0 && c.downPayment - cash <= room)) continue;
      const m2 = { ...m, players: m.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, cash } })) };
      if (purchasePlan(currentState(m2), c.downPayment).status !== status) continue;
      return { m: m2, card: c };
    }
    throw new Error(`no ${status} scenario found`);
  };
  const load = async (m) => {
    await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
    await page.goto(`${URL_BASE}?seed=3`);
    await page.waitForSelector('[data-action="resume"]');
    await page.locator('[data-action="resume"]').click();
    await page.waitForSelector('.card[data-card="opportunity"]');
    await page.waitForTimeout(700);
  };

  // 1. blocked: aria-disabled + reason, tapping does nothing
  let { m } = make('blocked', MODE);
  await load(m);
  let st = await page.evaluate(() => {
    const b = document.querySelector('.card [data-action="buy"]');
    const hint = document.querySelector('#buy-hint');
    const cs = getComputedStyle(b);
    return { aria: b.getAttribute('aria-disabled'), buy: document.querySelector('.card').dataset.buy, hint: hint?.textContent.trim(), described: b.getAttribute('aria-describedby'), border: cs.borderTopStyle, hintVisible: !!hint && hint.getBoundingClientRect().height > 0 };
  });
  check(st.buy === 'blocked' && st.aria === 'true', 'unaffordable even after the max loan: buy is aria-disabled');
  check(st.hint === 'אין מספיק כסף, גם עם הלוואה מקסימלית' && st.hintVisible && st.described === 'buy-hint', 'blocked buy shows the reason line and is described by it');
  check(st.border === 'dashed', 'blocked buy looks disabled (dashed outline, flat colour)');
  await insideViewport(page, ['#modal-root .layer:last-child .card-actions .btn[data-action="buy"]', '#buy-hint'], 'blocked buy + reason');
  await page.screenshot({ path: `${OUT}/buy-blocked.png` });
  await page.locator('.card [data-action="buy"]').click({ force: true });
  await page.waitForTimeout(500);
  check(await page.locator('.card[data-card="opportunity"]').count() === 1 && await page.locator('.limit').count() === 0, 'tapping a blocked buy does nothing (card stays, no dialog)');
  await page.locator('.card [data-action="pass"]').click();
  await page.waitForSelector('.card', { state: 'detached' });

  // 2. loan: tap buy -> loan dialog for the missing amount -> purchase completes
  ({ m } = make('loan', MODE));
  await load(m);
  st = await page.evaluate(() => ({ buy: document.querySelector('.card').dataset.buy, hint: document.querySelector('#buy-hint')?.textContent.trim(), aria: document.querySelector('.card [data-action="buy"]').getAttribute('aria-disabled') }));
  check(st.buy === 'loan' && st.aria === null && /חסרים לכם/.test(st.hint || ''), `short of cash but a loan covers it: buy is enabled and says so ("${st.hint}")`);
  await page.screenshot({ path: `${OUT}/buy-needs-loan.png` });
  await page.locator('.card [data-action="buy"]').click();
  await page.waitForSelector('.layer-dialog .limit');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/buy-loan-dialog.png` });
  const startAmount = await page.locator('.layer-dialog .big-amount').first().innerText();
  const before = await page.evaluate(() => document.querySelector('.screen-board').dataset.assets);
  await page.locator('.layer-dialog [data-action="take"]').click();
  await page.waitForSelector('.card', { state: 'detached', timeout: 6000 });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.querySelector('.screen-board').dataset.assets);
  check(Number(after) === Number(before) + 1, `taking the suggested loan (${startAmount}) completes the purchase (${before} -> ${after} assets)`);
  // cancelling the loan keeps the card open
  ({ m } = make('loan', MODE));
  await load(m);
  await page.locator('.card [data-action="buy"]').click();
  await page.waitForSelector('.layer-dialog .limit');
  await page.locator('.layer-dialog [data-action="cancel"]').click();
  await page.waitForSelector('.layer-dialog', { state: 'detached' });
  await page.waitForTimeout(500);
  check(await page.locator('.card[data-card="opportunity"] [data-action="buy"]').count() === 1, 'cancelling the loan dialog leaves the card open');
  await page.locator('.card [data-action="pass"]').click();
  await page.waitForSelector('.card', { state: 'detached' });
  await page.evaluate(() => localStorage.removeItem('passivo.save'));
  await page.goto(`${URL_BASE}?seed=${process.env.SMOKE_SEED || 11}`);
  await page.waitForSelector('[data-screen="start"]');
}

/** An old (schema 1) single-player save still resumes: it is migrated to a one-player match. */
async function testLegacySave(page) {
  const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
  const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
  let s = engine.newGame({ mode: 'family', professionId: 'nurse', seed: 5 });
  s = engine.roll(s, [2]);
  const v1 = { ...s, schemaVersion: 1 };
  while (v1.pending) { const k = v1.pending.kind; Object.assign(v1, k === 'opportunity' ? engine.pass(v1) : k === 'charity' ? engine.declineCharity(v1) : k === 'offer' ? engine.declineOffer(v1) : v1); if (!['opportunity', 'charity', 'offer'].includes(k)) break; }
  await page.evaluate((j) => localStorage.setItem('passivo.save', j), JSON.stringify(v1));
  await page.reload();
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('section[data-screen="board"]');
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => ({ players: document.querySelector('.screen-board').dataset.players, cash: document.querySelector('.screen-board').dataset.cash, handoff: !!document.querySelector('.handoff-sheet') }));
  check(info.players === '1' && !info.handoff, 'an old single-player save (schema 1) resumes as a one-player match');
  await page.evaluate(() => localStorage.removeItem('passivo.save'));
  await page.goto(`${URL_BASE}?seed=${process.env.SMOKE_SEED || 11}`);
  await page.waitForSelector('[data-screen="start"]');
}

/** v2 phase A (numbers + display): payday message and float, buy-card breakdown, loan terms, net-worth panel, family repay. */
async function testPhaseA(page) {
  const read = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
  const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
  const load = async (m) => {
    await page.goto(`${URL_BASE}?seed=3`);
    await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
    await page.goto(`${URL_BASE}?seed=3`);
    await page.waitForSelector('[data-action="resume"]');
    await page.locator('[data-action="resume"]').click();
    await page.waitForSelector('[data-screen="board"]');
    await page.waitForTimeout(700);
  };
  const matchWith = (mode, cardId, prof = 'teacher') => {
    for (let seed = 1; seed < 3000; seed++) {
      const m = act(newMatch(engine, { mode, players: [{ name: 'דנה', professionId: prof }], seed }), (st) => engine.roll(st, [1]));
      if (currentState(m).pending?.card?.id === cardId) return m;
    }
    throw new Error(`no seed for ${cardId}`);
  };

  // B1 + B2 + N3: the payday (summary) message and the floating number
  let m = newMatch(engine, { mode: MODE, seed: 5, players: [{ name: 'דנה', professionId: 'engineer' }] });
  m = act(m, (st) => ({ ...st, position: 3 }));
  await load(m);
  // the log/status are overwritten by later events (fast under reduced motion): record every state they pass through
  await page.evaluate(() => {
    window.__seen = [];
    const rec = (sel, key) => new MutationObserver(() => {
      const e = document.querySelector(sel);
      if (e) window.__seen.push({ key, text: e.textContent, bdi: e.querySelectorAll('bdi').length });
    }).observe(document.querySelector(sel), { childList: true, subtree: true, characterData: true });
    rec('.status-chip', 'chip');
    rec('.board-status', 'status');
  });
  await page.locator('[data-action="roll"]').click();
  await page.waitForSelector('.float-text', { timeout: 15000 });
  const f = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    const hud = r(document.querySelector('.hud'));
    const fl = r(document.querySelector('.float-text'));
    const texts = [...document.querySelectorAll('.hud-prof, .hud-sub, .hud-id, .hud-btns, .hud-cash, .meter-labels')].map(r);
    return {
      hud, fl, overlapsHud: texts.some((t) => fl.top < t.bottom && fl.bottom > t.top && fl.left < t.right && fl.right > t.left),
      floatBdi: document.querySelectorAll('.float-text bdi').length,
    };
  });
  const seen = await page.evaluate(() => window.__seen);
  const chipMsg = seen.find((x) => x.key === 'chip' && x.text.includes('סיכום שנתיים'));
  const statusMsg = seen.find((x) => x.key === 'status' && x.text.includes('סיכום שנתיים'));
  f.chip = chipMsg?.text ?? ''; f.chipBdi = chipMsg?.bdi ?? 0;
  f.statusText = statusMsg?.text ?? ''; f.statusBdi = statusMsg?.bdi ?? 0;
  check(!f.overlapsHud, `B2: the payday float does not overlap any HUD text (float top ${Math.round(f.fl.top)}, hud bottom ${Math.round(f.hud.bottom)})`);
  check(f.fl.top >= f.hud.bottom - 1 && f.fl.left >= 0 && f.fl.right <= 360, 'B2: the payday float stays under the HUD and inside the viewport');
  check(f.chipBdi >= 2 && f.statusBdi >= 2 && f.floatBdi >= 1, `B1: payday amounts are wrapped in <bdi> (chip ${f.chipBdi}, status ${f.statusBdi}, float ${f.floatBdi})`);
  check(f.chip.includes('סיכום שנתיים') && f.chip.includes(`${PAYDAY_MONTHS} חודשים`) && /×.*=/.test(f.chip), `N3: log shows the maths ("${f.chip}")`);
  check(!/יום משכורת/.test(f.chip + f.statusText), 'N3: no "יום משכורת" left in the payday messages');
  await page.waitForTimeout(1500);

  // N4: the buy card shows rent - mortgage = cash flow (apartment) and profit - loan = cash flow (business)
  for (const [mode, id, re] of [['family', 'opp-apt-001', /שכירות.*משכנתא.*תזרים/], ['family', 'opp-biz-001', /רווח.*החזר הלוואה.*תזרים/]]) {
    await load(matchWith(mode, id));
    await page.waitForSelector('[data-card]');
    const calc = await page.locator('.calc-line').innerText();
    check(re.test(calc.replace(/\n/g, ' ')), `N4: ${id} buy card shows the breakdown (${calc.replace(/\n/g, ' ')})`);
    await noHScroll(page, `buy card ${id}`);
  }

  // statement: net-worth panel; family can repay a loan; full shows loan terms
  let g = matchWith(MODE, 'opp-apt-001', 'engineer');
  g = act(g, (st) => engine.pass(st));
  g = act(g, (st) => engine.takeLoan(st, 2000));
  await load(g);
  await page.locator('[data-action="statement"]').click();
  await page.waitForSelector('.statement-body');
  const panel = await page.locator('.st-sec-networth').innerText();
  check(/שווי נקי/.test(panel) && /סך נכסים/.test(panel) && /סך התחייבויות/.test(panel), 'N4: the statement has the assets / liabilities / net worth panel');
  check(await page.locator('[data-action="repay"]').count() >= 1, `loans can be repaid in ${MODE} mode (repay buttons)`);
  check((await page.locator('[data-kind="loan"] .st-sub').innerText()).includes('ריבית'), 'the bank loan row says interest only');
  await noHScroll(page, 'statement');
  if (MODE === 'full') {
    await page.locator('[data-action="loan"]').click();
    await page.waitForSelector('.dialog');
    const t = loanTerms(1000);
    const rate = await page.locator('[data-loan="rate"]').innerText();
    check(rate.includes(`${t.aprNominal}%`) && rate.includes(`${t.monthly}`), `N1: loan dialog shows ${t.aprNominal}% a year and ${t.monthly} per 1,000 (${rate})`);
    const interest = await page.locator('[data-loan="interest"]').innerText();
    const total = await page.locator('[data-loan="total"]').innerText();
    check(interest.includes(String(t.perPayday)) && total.includes(t.totalAtPayday.toLocaleString('en-US')), `N1: loan dialog shows the cost until the next summary (${interest.replace(/\n/g, ' ')} / ${total.replace(/\n/g, ' ')})`);
    await noHScroll(page, 'loan dialog');
    await tapTargets(page, 'loan dialog');
    await page.keyboard.press('Escape');
  }
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(() => localStorage.removeItem('passivo.save'));
  await page.reload();
  await page.waitForSelector('[data-screen="start"]');
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'he-IL', reducedMotion: process.env.SMOKE_MOTION === 'full' ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${URL_BASE}?seed=${process.env.SMOKE_SEED || 11}`);
  await page.waitForSelector('[data-screen="start"]');
  const html = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
  check(html.lang === 'he' && html.dir === 'rtl', 'html lang=he dir=rtl');
  await noHScroll(page, 'start');
  await tapTargets(page, 'start');
  await page.screenshot({ path: `${OUT}/01-start-first-launch.png` });
  // First launch: the fox waves once, then settles into the tired pose; the flag keeps the intro from replaying.
  check(await page.locator('img.pose-wave').count() === 1, 'first launch shows the wave pose');
  await page.waitForFunction(() => localStorage.getItem('passivo.seenIntro') === '1');
  await page.waitForTimeout(2800);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('img.pose-tired')).opacity) === '1', 'fox crossfaded from wave to tired');
  const h1 = await page.evaluate(() => ({ n: document.querySelectorAll('h1').length, text: document.querySelector('h1')?.textContent.trim(), wm: !!document.querySelector('h1 img[src*="wordmark"]') }));
  check(h1.n === 1 && h1.text === 'פסיבו' && h1.wm, 'start has one accessible h1 "פסיבו" with the wordmark');
  await foxChecks(page, 'start');
  await page.screenshot({ path: `${OUT}/01-start.png` });
  await page.reload();
  await page.waitForSelector('[data-screen="start"]');
  check(await page.locator('img.pose-wave').count() === 0, 'wave pose does not replay after the first launch');
  await noVScroll(page, 'start (returning user)');
  await insideViewport(page, ['[data-action="start"]', '.mode-grid'], 'start CTA');

  // font check
  const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px Rubik', 'שלום'); });
  check(fontOk, 'Rubik (self-hosted) loaded for Hebrew');

  // settings dialog
  await page.locator('.topbar .icon-btn').last().click();
  await page.waitForSelector('.layer-dialog');
  await page.waitForTimeout(300);
  await tapTargets(page, 'settings');
  await page.screenshot({ path: `${OUT}/02-settings.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.layer-dialog', { state: 'detached' });

  // pick mode + profession
  await page.locator(`[data-mode="${MODE}"]`).click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  await page.waitForTimeout(300);
  check(await page.locator('.screen-players .stepper-value').innerText() === 'שחקן אחד', 'player count defaults to one player');
  check(await page.locator('.name-input').count() === 0 || !(await page.locator('.name-fields').isVisible()), 'single player has no name fields');
  await noHScroll(page, 'players setup (1)');
  await tapTargets(page, 'players setup (1)');
  await page.screenshot({ path: `${OUT}/02b-players-1.png` });
  const names = ['דנה', 'אורי', 'נועה', 'יובל'];
  if (PLAYERS > 1) {
    for (let k = 1; k < PLAYERS; k++) await page.locator('[aria-label="שחקן נוסף"]').click();
    check(await page.locator('.name-input').count() === PLAYERS, `${PLAYERS} name fields shown`);
    check(await page.locator('.name-input').first().inputValue() === 'שחקן 1', 'default name is "שחקן 1"');
    check(await page.locator('.name-input').first().getAttribute('maxlength') === '12', 'name max length is 12');
    for (let k = 0; k < PLAYERS; k++) await page.locator('.name-input').nth(k).fill(names[k]);
    await noHScroll(page, `players setup (${PLAYERS})`);
    await tapTargets(page, `players setup (${PLAYERS})`);
    await insideViewport(page, ['[data-action="players-next"]'], `players setup CTA (${PLAYERS})`);
    await page.screenshot({ path: `${OUT}/02c-players-${PLAYERS}.png` });
  }
  await page.locator('[data-action="players-next"]').click();
  for (let k = 0; k < PLAYERS; k++) {
    await page.waitForSelector('[data-screen="pick"]');
    if (PLAYERS > 1) check((await page.locator('.screen-title').innerText()).includes(names[k]), `profession pick header names player ${k + 1}`);
    if (k === 0) {
      await noHScroll(page, 'profession pick');
      await tapTargets(page, 'profession pick');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/03-pick${PLAYERS > 1 ? '-multi' : ''}.png` });
    }
    await page.locator('.prof-card').nth(k === 0 ? 0 : k + 1).click();
    await page.waitForSelector('.pick-sheet');
    await page.waitForTimeout(400);
    if (k === 0) await page.screenshot({ path: `${OUT}/04-pick-sheet.png` });
    await page.locator('[data-action="go"]').click();
  }
  await page.waitForSelector('[data-screen="board"]');
  if (PLAYERS > 1) {
    await page.waitForSelector('.handoff-sheet');
    await page.waitForTimeout(500);
    check((await page.locator('.handoff-title').innerText()) === `תור של ${names[0]}`, 'pass-the-phone sheet names the first player');
    await tapTargets(page, 'handoff sheet');
    await noHScroll(page, 'handoff sheet');
    await page.screenshot({ path: `${OUT}/handoff-sheet.png` });
    await page.locator('[data-action="ready"]').click();
    await page.waitForSelector('.handoff-sheet', { state: 'detached' });
    check(await page.locator('.pawn-slot').count() === PLAYERS, `${PLAYERS} pawns on the board`);
    check((await page.locator('.hud-prof').innerText()) === names[0], 'HUD shows the active player name');
    check(await page.locator('.others-strip .os-cell').count() === PLAYERS - 1, 'others strip lists the other players');
  } else {
    check(await page.locator('.handoff-sheet').count() === 0, 'single player: no pass-the-phone sheet');
  }
  await noHScroll(page, 'board');
  await tapTargets(page, 'board');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/05-board.png` });
  await foxChecks(page, 'board');
  await reactionStripClear(page);
  const pose = await page.evaluate(() => document.querySelector('.roll-zone')?.dataset.pose);
  check(pose === (MODE === 'family' ? 'tip' : 'roll') || PLAYERS > 1, `roll zone shows the ${MODE === 'family' ? 'family tip' : 'roll pose'} at the start (got ${pose})`);
  const theme = await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
  check(theme.toLowerCase() === '#0f1e46', 'theme-color is navy');

  // a11y wiring: named progressbar, <main> + h1 landmarks, debug helpers off without the flag
  const a11y = await page.evaluate(() => ({
    bars: [...document.querySelectorAll('[role="progressbar"]')].map((b) => !!b.getAttribute('aria-label') && b.hasAttribute('aria-valuenow')),
    main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, debug: typeof window.__passivoDebug,
  }));
  check(a11y.bars.length > 0 && a11y.bars.every(Boolean), 'progressbar has aria-label and aria-valuenow');
  check(a11y.main === 1 && a11y.h1 >= 1, 'board has one <main> and an <h1>');
  check(a11y.debug === 'undefined', 'debug helpers are absent without ?debug=1');

  // statement sheet
  await page.locator('[data-action="statement"]').click();
  await page.waitForSelector('.sheet');
  await page.waitForTimeout(500);
  await noHScroll(page, 'statement');
  await tapTargets(page, 'statement');
  await page.screenshot({ path: `${OUT}/06-statement.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.sheet', { state: 'detached' });
  await testHome(page, `${PLAYERS}p`);

  // Play games until one is won (new seed each retry).
  let won = false;
  let profBeforeWin = '';
  for (let g = 1; g <= 8 && !won; g++) {
    profBeforeWin = await page.evaluate(() => document.querySelector('.hud-prof')?.textContent);
    const r = await playGame(page, `game ${g}`);
    console.log(`game ${g}: ${r.result} after ${r.rolls} rolls`);
    if (r.result === 'won') {
      await page.waitForTimeout(500);
      await noHScroll(page, 'win');
      await page.screenshot({ path: `${OUT}/07-win${PLAYERS > 1 ? '-multi' : ''}.png` });
      await insideViewport(page, PLAYERS > 1
        ? ['[data-screen="win"] [data-action="again"]', '[data-screen="win"] [data-action="menu"]']
        : ['[data-screen="win"] [data-action="again"]', '[data-screen="win"] [data-action="menu"]', '[data-screen="win"] [data-action="share"]'], 'win actions');
      check(await page.locator('[data-action="again"].btn-primary').count() === 1 && await page.locator('[data-action="menu"].btn-secondary').count() === 1, 'win: play again is primary, change mode is secondary');
      if (PLAYERS > 1) {
        check(await page.locator('.stand-row').count() === PLAYERS, 'win screen lists every player in the standings');
        check(await page.locator('.stand-row[data-winner="true"]').count() === 1 && await page.locator('.stand-row[data-place="1"][data-winner="true"]').count() === 1, 'exactly one winner, first in the standings');
        check(await page.locator('.win-fox img.hammock').count() === 1, 'winner shown with the hammock fox');
        check((await page.locator('[data-action="menu"]').innerText()) === 'שנו הגדרות', 'multiplayer win offers "שנו הגדרות"');
        await tapTargets(page, 'standings');
      }
      won = true;
    } else if (r.result === 'over') {
      await noHScroll(page, 'game over');
      await page.screenshot({ path: `${OUT}/08-over.png` });
      await page.locator('[data-action="retry"]').click();
      await page.waitForSelector('[data-screen="board"]');
    } else {
      break;
    }
  }
  check(won, 'a full game was played from start to the win screen');

  if (won) {
    await page.locator('[data-action="again"]').click();
    await page.waitForSelector('[data-screen="board"]');
    const fresh = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, cash: document.querySelector('.screen-board')?.dataset.cash, prof: document.querySelector('.hud-prof')?.textContent }));
    check(fresh.turn === '0' || fresh.turn === '1', `play again from the win screen reaches a fresh board at turn 1 (data-turn ${fresh.turn})`);
    if (PLAYERS === 1) check(fresh.prof === profBeforeWin, `play again keeps the profession (${profBeforeWin} -> ${fresh.prof})`);
    else {
      await page.waitForSelector('.handoff-sheet');
      check(await page.evaluate(() => document.querySelector('.screen-board').dataset.players) === String(PLAYERS), 'play again keeps the same number of players');
      check((await page.locator('.handoff-title').innerText()) === `תור של ${names[0]}`, 'play again keeps the player names and starts with player 1');
      await page.locator('[data-action="ready"]').click();
    }
    // a finished game leaves no save: drop the one the fresh game just wrote, then the start screen has no resume button
    await page.evaluate(() => localStorage.removeItem('passivo.save'));
    await page.reload();
    await page.waitForSelector('[data-screen="start"]');
    check(await page.locator('[data-action="resume"]').count() === 0, 'no resume button after a finished game');
  }
  if (PLAYERS === 1) { await testBuyStates(page); await testLegacySave(page); }
  await testRound5(page);
  await testPhaseA(page);

  // light theme + start screen
  await page.locator('.topbar .icon-btn').last().click();
  await page.waitForSelector('.layer-dialog');
  await page.locator('[data-theme-opt="light"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/09-start-light.png` });
  await noHScroll(page, 'start (light)');

  // offline: service worker should serve the shell
  await page.evaluate(() => navigator.serviceWorker?.ready);
  const swOk = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
  check(swOk, 'service worker registered');
  if (swOk) {
    await page.waitForTimeout(800);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('[data-screen="start"]', { timeout: 5000 }).then(() => check(true, 'app loads offline'), () => check(false, 'app loads offline'));
    await page.waitForTimeout(600);
    check(await page.evaluate(() => [...document.querySelectorAll('img.fox')].every((i) => i.complete && i.naturalWidth > 0)), 'fox art renders offline (precached)');
    await ctx.setOffline(false);
  }

  check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  check(bad.length === 0, `no failed requests${bad.length ? `: ${bad.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nSMOKE PASSED');
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
