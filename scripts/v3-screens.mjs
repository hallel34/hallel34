// v3/v4 screenshot + layout check: every changed screen at 390x844, 360x800 and 320x568, in the dark AND the light theme, saved as
// WebP into qa/screens/v4-after/ (<scene>-<theme>-<w>x<h>.webp). Also asserts no horizontal scroll, touch targets >= 48px on the
// top layer and no console errors.
// Run: npm run build && node scripts/v3-screens.mjs   (starts `vite preview` on port 4190)
// Env: SCREENS_OUT (folder), SIZES (390x844,...), THEMES (dark,light), ONLY (scene keys), ALL=1 (every scene, not only the v4 set),
//      PREVIEW_OUTDIR (serve another build folder).
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import {
  createEngine, newMatch, act, serialize, currentState, maxLoan, purchasePlan, BOARD,
} from '../src/engine/index.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const PORT = 4190;
const URL_BASE = `http://localhost:${PORT}/`;
const OUT = process.env.SCREENS_OUT || new URL('../qa/screens/v4-after/', import.meta.url).pathname;
const THEMES = (process.env.THEMES || 'dark,light').split(',');
// the v4 board stage set: the board in both modes, the legend, the fox bubble, the die result, the deal cards with their badge, the win screen
const V4_SCENES = ['board', 'boardFull', 'legend', 'bubble', 'dieResult', 'fullCard', 'green', 'red', 'stockCard', 'win'];
const SIZES = (process.env.SIZES || '390x844,360x800,320x568').split(',').map((s) => s.split('x').map(Number));
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : (process.env.ALL ? null : V4_SCENES);
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
mkdirSync(OUT, { recursive: true });
const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });

const problems = [];
const note = (ok, msg) => { if (!ok) { problems.push(msg); console.error(`PROBLEM: ${msg}`); } };

function matchWithCard(mode, cardId, { cash = null, prof = 'teacher' } = {}) {
  for (let seed = 1; seed < 4000; seed++) {
    const m = act(newMatch(engine, { mode, players: [{ name: 'דנה', professionId: prof }], seed }), (st) => engine.roll(st, [1]));
    if (currentState(m).pending?.card?.id === cardId) return cash == null ? m : { ...m, players: m.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, cash } })) };
  }
  throw new Error(`no seed for ${cardId}`);
}
function matchWithStatus(mode, status) {
  for (let seed = 1; seed < 400; seed++) {
    const m = act(newMatch(engine, { mode, players: [{ professionId: 'teacher' }], seed }), (s) => engine.roll(s, [1]));
    const s = currentState(m); const c = s.pending?.card;
    if (!c || c.type === 'stock') continue;
    const room = maxLoan(s);
    const cash = status === 'blocked' ? Math.max(0, c.downPayment - room - 5000) : Math.max(0, c.downPayment - 25000);
    const m2 = { ...m, players: m.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, cash } })) };
    if (purchasePlan(currentState(m2), c.downPayment).status === status) return m2;
  }
  throw new Error(`no ${status}`);
}
/** A match that rolls next with the pawn just before a payday square (any roll passes it). */
function beforePayday(mode) {
  const m = newMatch(engine, { mode, players: [{ name: 'דנה', professionId: 'teacher' }], seed: 5 });
  const idx = BOARD.indexOf('payday', 5);
  return { ...m, players: m.players.map((p) => ({ ...p, state: { ...p.state, position: idx - 1 } })) };
}

let THEME = 'dark';
async function prep(page, { guess = true, tutorial = null, theme = THEME } = {}) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(([g, tut, th]) => {
    localStorage.clear();
    localStorage.setItem('passivo.seenIntro', '1');
    localStorage.setItem('passivo.prefs', JSON.stringify({ guessFamily: g, guessFull: false, theme: th, haptics: false, sound: false }));
    localStorage.setItem('passivo.tutorial', JSON.stringify(tut ?? { storyDone: true, helpOn: false, hintsSeen: {}, quizDone: true }));
  }, [guess, tutorial, theme]);
}
async function loadMatch(page, m, opts = {}) {
  await prep(page, opts);
  await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
  await page.goto(`${URL_BASE}?seed=3${opts.debug ? '&debug=1' : ''}`);
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
}

async function check(page, name) {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const layers = [...document.querySelectorAll('#modal-root .layer')];
    const top = layers[layers.length - 1] ?? document.getElementById('app');
    const small = [...top.querySelectorAll('button, [role="button"], a[href]')].filter((b) => {
      const s = getComputedStyle(b); if (s.visibility === 'hidden' || s.display === 'none') return false;
      const r2 = b.getBoundingClientRect(); return r2.width > 0 && r2.height > 0 && (r2.width < 47.5 || r2.height < 47.5);
    }).map((b) => `${b.className || b.tagName}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
    return { sw: de.scrollWidth, cw: de.clientWidth, small };
  });
  note(r.sw <= r.cw, `${name}: horizontal overflow ${r.sw} > ${r.cw}`);
  note(!r.small.length, `${name}: targets < 48px: ${r.small.join(', ')}`);
}
async function shot(page, name, w, hgt) {
  // INJECT_CSS reproduces an old layout for an audit 'before' shot (e.g. the D1 tour strip without its reserved room)
  if (process.env.INJECT_CSS) { await page.addStyleTag({ content: process.env.INJECT_CSS }); await page.waitForTimeout(200); }
  const png = `${OUT}${name}-${THEME}-${w}x${hgt}.png`;
  await page.screenshot({ path: png });
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${png}').save('${png.replace(/\.png$/, '.webp')}', 'WEBP', quality=80)`]);
  unlinkSync(png);
  await check(page, `${name} ${w}x${hgt}`);
}

const SCENES = {
  async home(page) { await prep(page); await page.goto(`${URL_BASE}?seed=3`); await page.waitForSelector('[data-action="start"]'); await page.waitForTimeout(900); return '01-home'; },
  async pick(page) { await prep(page); await page.goto(`${URL_BASE}?seed=3`); await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-screen="players"]'); await page.locator('[data-action="players-next"]').click(); await page.waitForSelector('.prof-card'); await page.waitForTimeout(600); return '02-profession-select'; },
  async pickSheet(page) { await SCENES.pick(page); await page.locator('.prof-card').first().click(); await page.waitForSelector('.pick-sheet'); await page.waitForTimeout(600); return '03-profession-preview'; },
  async board(page) { await loadMatch(page, newMatch(engine, { mode: 'family', players: [{ name: 'דנה', professionId: 'teacher' }], seed: 7 })); await page.waitForTimeout(800); return '04-board-family'; },
  async boardFull(page) { await loadMatch(page, newMatch(engine, { mode: 'full', players: [{ name: 'דנה', professionId: 'engineer' }], seed: 7 })); await page.waitForTimeout(800); return '04b-board-full'; },
  async guess(page) { await loadMatch(page, matchWithCard('family', 'opp-biz-006', { cash: 400000 })); await page.waitForSelector('.card'); await page.waitForTimeout(500); return '05a-deal-card-guess-prompt'; },
  async green(page) { await SCENES.guess(page); await page.locator('[data-action="guess-good"]').click(); await page.waitForSelector('.reveal'); await page.waitForTimeout(500); return '05-deal-card-GREEN-revealed'; },
  async red(page) { await loadMatch(page, matchWithCard('family', 'opp-apt-008', { cash: 400000 })); await page.waitForSelector('.card'); await page.locator('[data-action="guess-good"]').click(); await page.waitForSelector('.reveal'); await page.waitForTimeout(500); return '06-deal-card-RED-family-slow'; },
  async redBottom(page) { await SCENES.red(page); await page.evaluate(() => { const b = document.querySelector('.card-body'); b.scrollTop = b.scrollHeight; }); await page.waitForTimeout(400); return '06c-deal-card-RED-scrolled-bottom'; },
  async fullCard(page) { await loadMatch(page, matchWithCard('full', 'opp-apt-001', { cash: 400000 }), { guess: false }); await page.waitForSelector('.card'); await page.waitForTimeout(500); return '14a-FULL-deal-card'; },
  async tour(page) {
    await loadMatch(page, matchWithCard('family', 'opp-biz-006', { cash: 400000 }), { tutorial: { storyDone: true, helpOn: true, hintsSeen: {}, quizDone: true } });
    await page.waitForSelector('.card'); await page.waitForTimeout(900); return '05t-deal-card-first-game-tour';
  },
  async needsLoan(page) { await loadMatch(page, matchWithStatus('family', 'loan'), { guess: false }); await page.waitForSelector('.card'); await page.waitForTimeout(500); return '07a-deal-card-needs-loan'; },
  async blocked(page) { await loadMatch(page, matchWithStatus('family', 'blocked'), { guess: false }); await page.waitForSelector('.card'); await page.waitForTimeout(500); return '07b-deal-card-BLOCKED-buy-disabled'; },
  async loan(page) { await SCENES.needsLoan(page); await page.locator('.card [data-action="buy"]').click(); await page.waitForSelector('.layer-dialog .loan-nums'); await page.waitForTimeout(500); return '07-loan-dialog'; },
  async loanDetails(page) { await SCENES.loan(page); await page.locator('[data-action="loan-details"]').click(); await page.waitForTimeout(300); return '07c-loan-dialog-details-open'; },
  async payday(page) {
    await loadMatch(page, beforePayday('family'));
    await page.locator('[data-action="roll"]').click();
    await page.waitForSelector('.summary-card', { timeout: 15000 }); await page.waitForTimeout(200);
    const arming = await page.evaluate(() => { const b = document.querySelector('[data-action="summary-ok"]'); return { disabled: b.disabled, busy: b.getAttribute('aria-busy'), arming: b.hasAttribute('data-arming') }; });
    note(arming.disabled && arming.busy === 'true' && arming.arming, `payday summary button arms with disabled + aria-busy (${JSON.stringify(arming)})`);
    await page.waitForTimeout(1100);
    const armed = await page.evaluate(() => { const b = document.querySelector('[data-action="summary-ok"]'); return { disabled: b.disabled, focused: document.activeElement === b }; });
    note(!armed.disabled && armed.focused, `payday summary button is armed and focused after the window (${JSON.stringify(armed)})`);
    return '11a-payday-summary';
  },
  async settings(page) { await SCENES.board(page); await page.locator('.hud [aria-label="הגדרות"]').click(); await page.waitForSelector('.settings-dialog'); await page.waitForTimeout(400);
    const sc = await page.evaluate(() => { const d = document.querySelector('.settings-dialog'); const p = d.closest('.layer-panel'); return { dialogScrolls: d.scrollHeight > d.clientHeight, panelScrolls: p.scrollHeight > p.clientHeight + 1 }; });
    note(!sc.panelScrolls, `settings: only one scroll container (${JSON.stringify(sc)})`);
    return '16-settings-dialog'; },
  async statement(page) { await SCENES.board(page); await page.locator('[data-action="statement"]').click(); await page.waitForSelector('.statement-body'); await page.waitForTimeout(800); return '09-statement'; },
  async legend(page) {
    await SCENES.boardFull(page);
    await page.locator('[data-action="legend"]').click();
    await page.waitForSelector('.legend-sheet'); await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ rows: document.querySelectorAll('.legend-row').length, focus: document.activeElement?.id, groups: [...document.querySelectorAll('.legend-head')].map((x) => x.textContent) }));
    note(r.rows === 6 && r.focus === 'legend-title' && r.groups.length === 3, `legend: 6 rows in 3 named groups, focus on the title (${JSON.stringify(r)})`);
    return '20-legend-sheet';
  },
  async bubble(page) {
    // family turn 1: the tip bubble beside the corner fox
    await SCENES.board(page);
    await page.waitForSelector('.fox-strip .note', { timeout: 6000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const hit = (a, b) => a && b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
      const bub = box('.fox-strip .note-bubble'); const fox = box('.fox-guide');
      return { bub: !!bub, fox: !!fox, overFox: hit(bub, fox), hud: hit(bub, box('.hud')), board: hit(bub, box('.board')), roll: hit(bub, box('.btn-roll')), foxBoard: hit(fox, box('.board')), foxRoll: hit(fox, box('.btn-roll')) };
    });
    note(r.bub && r.fox && !r.overFox && !r.hud && !r.board && !r.roll && !r.foxBoard && !r.foxRoll, `bubble + fox stay in the fox strip (${JSON.stringify(r)})`);
    return '21-fox-bubble';
  },
  async dieResult(page) {
    await loadMatch(page, newMatch(engine, { mode: 'full', players: [{ name: 'דנה', professionId: 'engineer' }], seed: 7 }));
    await page.waitForTimeout(400);
    await page.locator('[data-action="roll"]').click();
    await page.waitForSelector('.die-result:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(150);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const r = await page.evaluate(() => ({ num: document.querySelector('.die-result-num')?.textContent, label: document.querySelector('.dice')?.getAttribute('aria-label') }));
    note(/^\d+$/.test(r.num ?? '') && r.label?.includes(r.num), `die result: a big number that matches the die's aria-label (${JSON.stringify(r)})`);
    return '22-die-result';
  },
  async stockCard(page) { await loadMatch(page, matchWithCard('full', 'opp-stk-002', { cash: 50000 }), { guess: false }); await page.waitForSelector('.card'); await page.waitForTimeout(500); return '14b-FULL-stock-card'; },
  async win(page) { await loadMatch(page, newMatch(engine, { mode: 'family', players: [{ name: 'דנה', professionId: 'teacher' }], seed: 7 }), { debug: true }); await page.locator('[data-action="debug-win"]').click(); await page.waitForSelector('[data-screen="win"]', { timeout: 8000 }); await page.waitForTimeout(1500); return '13-win'; },
  async over(page) { await loadMatch(page, newMatch(engine, { mode: 'full', players: [{ name: 'דנה', professionId: 'teacher' }], seed: 7 }), { debug: true }); await page.locator('[data-action="debug-lose"]').click(); await page.waitForSelector('[data-screen="over"]', { timeout: 8000 }); await page.waitForTimeout(1200); return '13c-game-over'; },
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', ...(process.env.PREVIEW_OUTDIR ? ['--outDir', process.env.PREVIEW_OUTDIR] : [])], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_BASE)).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 250)); }
const browser = await chromium.launch({ executablePath: exe });
try {
  for (const theme of THEMES) for (const [w, hgt] of SIZES) {
    THEME = theme;
    for (const [key, scene] of Object.entries(SCENES)) {
      if (ONLY && !ONLY.includes(key)) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, locale: 'he-IL', reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        const name = await scene(page);
        await shot(page, name, w, hgt);
        console.log(`ok ${name} ${theme} ${w}x${hgt}`);
      } catch (e) { note(false, `${key} ${theme} ${w}x${hgt}: ${String(e.message).split('\n')[0]}`); }
      note(!errors.length, `${key} ${theme} ${w}x${hgt}: console errors ${errors.join(' | ')}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); server.kill(); }
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nALL SCREENS OK');
process.exit(problems.length ? 1 : 0);
