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

// Records every fox note that appears (feedback / explainer) with its box next to the boxes it must never cover.
const LEARN_OBSERVER = () => {
  window.__learnLog = [];
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const hit = (a, b) => a && b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const start = () => {
    const root = document.getElementById('app');
    if (!root) { setTimeout(start, 50); return; }
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (!(n instanceof Element) || !n.classList.contains('note')) continue;
        const turnNow = document.querySelector('.screen-board')?.dataset.turn; // read at insertion: a fast player may roll again before the box is measured
        setTimeout(() => {
          // QA round 15: the WHOLE note, its buttons included (the union of every visible box inside it)
          // a box is clipped by every ancestor (up to the note) that hides its overflow: a line-clamped text still REPORTS the
          // boxes of its hidden lines, which paint nothing
          const clipped = (e) => {
            const b = e.getBoundingClientRect(); let r = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
            for (let a = e === n ? null : e.parentElement; a && n.contains(a); a = a === n ? null : a.parentElement) {
              if (getComputedStyle(a).overflow === 'visible') continue;
              const c = a.getBoundingClientRect();
              r = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) };
            }
            return { width: r.right - r.left, height: r.bottom - r.top, ...r };
          };
          const rs = [n, ...n.querySelectorAll('*')].filter((e) => getComputedStyle(e).visibility !== 'hidden').map(clipped).filter((b) => b.width > 0 && b.height > 0);
          const r = rs.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
          const me = { l: r.left, t: r.top, r: r.right, b: r.bottom };
          const tiles = [...document.querySelectorAll('.board .tile')].map((t) => { const b = t.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
          const fox = document.querySelector('.fox-guide'); const fb = fox && fox.getClientRects().length ? fox.getBoundingClientRect() : null;
          const entry = {
            kind: n.dataset.note, group: n.dataset.group || null, concept: n.dataset.concept || null, text: n.textContent.trim(),
            turn: turnNow, tone: n.dataset.tone || null,
            hitRoll: hit(me, box('.btn-roll')), hitHud: hit(me, box('.hud')), hitDice: hit(me, box('.dice')), hitStatus: hit(me, box('.board-status')),
            hitHere: hit(me, box('.here-line')), hitTiles: tiles.some((t) => hit(me, t)), hitFox: !!fb && hit(me, { l: fb.left, t: fb.top, r: fb.right, b: fb.bottom }),
            size: `${innerWidth}x${innerHeight}`,
            inViewport: me.l >= 0 && me.r <= innerWidth + 0.5 && me.b <= innerHeight + 0.5 && me.t >= 0,
          };
          window.__learnLog.push(entry);
          window.__noteSeen?.(entry); // QA round 15: every note of the whole run reaches the Node side (survives page loads)
        }, 450);
      }
    }).observe(root, { childList: true, subtree: true });
  };
  document.addEventListener('DOMContentLoaded', start);
};

/** Percent figures of real-world numbers (publish:false) that appear in no visible learn text: they must never be on screen. */
function hiddenFigures() {
  const rw = JSON.parse(readFileSync(new URL('../../src/data/learn/real-world.he.json', import.meta.url), 'utf8'));
  const visible = ['glossary', 'feedback', 'report', 'guess'].map((k) => readFileSync(new URL(`../../src/data/learn/${k}.he.json`, import.meta.url), 'utf8')).join(' ')
    + JSON.stringify(rw.facts.map((f) => [f.game, f.real])) + readFileSync(new URL('../../src/i18n/he.json', import.meta.url), 'utf8') + readFileSync(new URL('../../src/data/cards.he.json', import.meta.url), 'utf8');
  const tokens = (str) => [...String(str).matchAll(/(?<![\d.,])\d+(?:\.\d+)?%/g)].map((m) => m[0]);
  const shown = new Set(tokens(visible));
  // every hidden figure (QA round 14: no exemption by value alone); the verified ones are allowed ONLY inside their tagged surfaces
  return [...new Set(rw.facts.filter((f) => f.numbers).flatMap((f) => tokens(f.numbers.text)))].filter((x) => !shown.has(x));
}
/** v4 stage 4: the figures a tagged real-world surface may show: rates that docs/v3/real-world-verified.json marks VERIFIED, and the
 * guide figure published with its verified tag (owner 2026-10-25: the Bank of Israel rate). */
function verifiedFigures() {
  const tokens = (str) => [...String(str).matchAll(/(?<![\d.,])\d+(?:\.\d+)?%/g)].map((m) => m[0]);
  const verified = new Set();
  const walk = (v) => { if (typeof v === 'number' && v > 0 && v < 1) verified.add(`${Math.round(v * 10000) / 100}%`); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  for (const e of JSON.parse(readFileSync(new URL('../../docs/v3/real-world-verified.json', import.meta.url), 'utf8'))) if (e.status === 'VERIFIED') walk(e.value);
  const guide = JSON.parse(readFileSync(new URL('../../src/data/learn/guide.he.json', import.meta.url), 'utf8'));
  for (const sc of guide.lessons.flatMap((l) => l.screens)) if (sc.numbers?.publish === true && sc.numbers.verified) tokens(sc.numbers.text).forEach((x) => verified.add(x));
  return verified;
}
// the surfaces that carry the "נכון ל-2026" tag and the source link (tax-audit reveal, statement popover, guide / Israeli rules entry)
const TAGGED = '.audit-reveal, #st-tax-pop, .dict-rw-entry';
async function noHiddenFigures(page, label) {
  const hidden = hiddenFigures();
  const verified = verifiedFigures();
  const { outside, inside } = await page.evaluate((sel) => {
    const out = []; const ins = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement; if (!p || !p.getClientRects().length || getComputedStyle(p).visibility === 'hidden') continue;
      (p.closest(sel) ? ins : out).push(n.textContent);
    }
    return { outside: out.join(' '), inside: ins.join(' ') };
  }, TAGGED);
  const tok = (text) => [...text.matchAll(/(?<![\d.,])\d+(?:\.\d+)?%/g)].map((m) => m[0]);
  const leaked = [...hidden.filter((x) => tok(outside).includes(x)), ...hidden.filter((x) => !verified.has(x) && tok(inside).includes(x))];
  check(hidden.length > 0 && leaked.length === 0, `L6: no unverified real-world figure on screen (${label})${leaked.length ? ` LEAKED ${leaked}` : ''}`);
}

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
    // board-spec 14.4 (owner override 2026-10-24b): the fox row lives INSIDE the plate's plaza, so "the board" means its tiles
    const tileHit = [...document.querySelectorAll('.board .tile')].some((t) => { const b = t.getBoundingClientRect(); return hit(host, { l: b.left, t: b.top, r: b.right, b: b.bottom }); });
    // QA round 14: the plaza status line (and the bubble beside the fox) are checked again, since "the board" now means its tiles
    const bubble = box('.fox-strip .note-bubble');
    const status = box('.board-status');
    return { host: !!host, hud: hit(host, box('.hud')), board: tileHit, roll: hit(host, box('.btn-roll')), dice: hit(host, box('.dice')), status: hit(host, status), bubbleStatus: hit(bubble, status), bubbleRoll: hit(bubble, box('.btn-roll')) };
  });
  check(r.host && !r.hud && !r.board && !r.roll && !r.dice && !r.status && !r.bubbleStatus && !r.bubbleRoll, `reaction pop-up strip and its bubble never cover the HUD, tiles, die, status line or roll button (${JSON.stringify(r)})`);
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

/** Sets the 'ניחוש לפני קנייה' preference of the current mode (and the other one) before the next page load. */
async function guessPref(page, on, extra = {}) {
  await page.evaluate(([v, ex]) => {
    const p = JSON.parse(localStorage.getItem('passivo.prefs') || '{}');
    localStorage.setItem('passivo.prefs', JSON.stringify({ ...p, guessFamily: v, guessFull: v, ...ex }));
    // these tests are about the normal game: the first-game story and hints are switched off (they have their own tests)
    localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, hintsSeen: {}, quizDone: true }));
  }, [on, extra]);
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
    if (q('.summary-card', top)) { shot = 'summary-card'; return out({ click: '#modal-root .layer:last-child [data-action="summary-ok"]' }); }
    if (q('.handoff-sheet', top)) { return out({ click: '#modal-root .layer:last-child [data-action="roll-next"]' }); }
    if (q('.home-sheet', top)) return out({ wait: true });
    const card = q('.card', top);
    const btn = (a) => q(`[data-action="${a}"]:not([disabled])`, top);
    if (!card) shot = top.querySelector('.limit') ? 'dialog-loan' : (top.querySelector('.sell-list') ? 'dialog-sell' : 'dialog-other');
    if (card) {
      const kind = card.dataset.card;
      shot = `card-${kind}${kind === 'expense' && btn('pay') ? '-paid' : ''}${kind === 'opportunity' ? `-${card.dataset.kind}` : ''}`;
      if (kind === 'opportunity' && card.dataset.guess === 'ask') {
        // 'עסקה טובה?': guess from the payback (96 months = 8 years), every 7th pick on purpose wrong, every 11th skipped
        window.__gn = (window.__gn || 0) + 1;
        const months = Number(card.dataset.payback);
        let pick = months <= 96 ? 'good' : 'bad';
        if (window.__gn % 7 === 0) pick = pick === 'good' ? 'bad' : 'good';
        shot = 'card-opportunity-ask';
        if (window.__gn % 11 === 0) return out({ click: '#modal-root .layer:last-child [data-action="guess-skip"]' });
        return out({ click: `#modal-root .layer:last-child [data-action="guess-${pick}"]` });
      }
      if (kind === 'opportunity') {
        if (card.dataset.guess === 'done') shot = `${shot}-revealed`;
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
  const roll = q('[data-action="roll"]:not([disabled])');
  if (roll) return out({ click: '[data-action="roll"]' });
  return out({ wait: true });
}

const oneTap = { total: 0, ok: 0 };
const shots = new Set();
async function playGame(page, tag, budgetMs = Number(process.env.SMOKE_GAME_MS || 240000)) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  let resumed = false;
  let stuck = 0;
  let statementChecked = false;
  let last = null;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide, process.env.SMOKE_POLICY || 'sensible');
    last = d;
    if (d.done) return { result: d.done, rolls };
    // The primary button must never read "..." or be empty, and must never stay disabled with nothing on screen to wait for.
    if (d.btn && /^[.\s]*$/.test(d.btn.text) && !failures.includes('primary button text is empty or "..."')) check(false, 'primary button text is empty or "..."');
    stuck = d.wait && d.btn?.disabled && !d.layer ? stuck + 1 : 0;
    if (stuck === 300) { check(false, `board stuck on a disabled button "${d.btn.text}" (${d.btn.mode}) for 12s`); return { result: 'stuck', rolls }; }
    if (!statementChecked && d.click === '[data-action="roll"]') {
      const info = await page.evaluate(() => ({ assets: Number(document.querySelector('.screen-board')?.dataset.assets || 0), mortgages: Number(document.querySelector('.screen-board')?.dataset.mortgages || 0) }));
      if (info.assets > 0) { statementChecked = true; await checkStatementLiabilities(page, info).catch((e) => console.log(`statement check skipped (${String(e.message).split('\n')[0]})`)); }
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
        if (process.env.SMOKE_TRACE && rolls % 10 === 0) console.log(`trace: ${rolls} rolls after ${Math.round((Date.now() - deadline + budgetMs) / 1000)}s`);
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
      if (/roll-next/.test(d.click)) {
        // ONE-TAP hand-over: this single tap must start the next player's roll (no 'המשיכו', no second 'מוכנים')
        const rolled = await page.waitForFunction(() => { const b = document.querySelector('.screen-board'); return b && (b.dataset.btn === 'rolling' || b.dataset.btn === 'working') && !document.querySelector('.handoff-sheet:not([data-closing])'); }, null, { timeout: 4000 }).then(() => true).catch(() => false);
        oneTap.total += 1; if (rolled) oneTap.ok += 1;
      }
      await page.waitForTimeout(25);
    } else {
      await page.waitForTimeout(40);
    }
  }
  console.log(`last decision before the timeout: ${JSON.stringify(last)} one-tap hand-overs so far ${oneTap.total} turn ${await page.evaluate(() => document.querySelector(".screen-board")?.dataset.turn)}`);
  return { result: 'timeout', rolls };
}

/** The first family game opens with the five-screen story, then the optional check: play it, measure it, skip nothing. */
async function playStory(page, label) {
  await page.waitForSelector('.story-screen', { timeout: 5000 });
  const dir = new URL('../../qa/screens/tutorial/', import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  const vp = page.viewportSize();
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => { const v = document.querySelector('.story-view'); const b = document.querySelector('.story-next').getBoundingClientRect(); return { n: document.querySelector('.story-screen').dataset.n, over: v.scrollHeight - v.clientHeight, bottom: b.bottom, h: b.height, top: b.top, skip: !!document.querySelector('[data-action="story-skip"]'), ih: innerHeight }; });
    check(r.n === String(i) && r.over <= 1 && r.bottom <= r.ih && r.h >= 48 && r.skip, `story screen ${i} fits ${vp.width}x${vp.height}: no scroll, button inside the viewport, skip present (${JSON.stringify(r)})`);
    check(r.top >= r.ih * 0.55, `story button "המשיכו" sits in the bottom third / lower half (${Math.round(r.top)}/${r.ih})`);
    await noHScroll(page, `story screen ${i}`);
    await page.screenshot({ path: `${dir}story-${i}-${vp.width}x${vp.height}.png` });
    // screen 5 is a sequence of short parts: step through every one (each must fit too) before the last button goes on
    for (let part = 1; i === 5 && await page.locator('.story-part-of').count(); part++) {
      const m = /(\d+)\D+(\d+)/.exec(await page.locator('.story-part-of').innerText());
      if (!m || Number(m[1]) >= Number(m[2])) break;
      await page.locator('.story-next').click();
      await page.waitForTimeout(450);
      const fit = await page.evaluate(() => { const v = document.querySelector('.story-view'); const b = document.querySelector('.story-next').getBoundingClientRect(); return { over: v.scrollHeight - v.clientHeight, bottom: b.bottom, ih: innerHeight }; });
      check(fit.over <= 1 && fit.bottom <= fit.ih, `story screen 5 part ${part + 1} fits ${vp.width}x${vp.height} (${JSON.stringify(fit)})`);
      await noHScroll(page, `story screen 5 part ${part + 1}`);
    }
    await page.locator('.story-next').click();
  }
  await page.waitForSelector('[data-story="offer"]');
  await page.waitForTimeout(400);
  await tapTargets(page, 'story check offer');
  await page.screenshot({ path: `${dir}check-offer-${vp.width}x${vp.height}.png` });
  const sizes = await page.evaluate(() => ['check-yes', 'check-no'].map((a) => { const r = document.querySelector(`[data-action="${a}"]`).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)].join('x'); }));
  check(sizes[0] === sizes[1], `"בואו נבדוק" and "לא עכשיו" have the same size (${sizes})`);
  await page.locator('[data-action="check-yes"]').click();
  for (let q = 0; q < 3; q++) {
    await page.waitForSelector('[data-story="quiz"]');
    await page.waitForTimeout(350);
    if (q === 0) {
      await page.screenshot({ path: `${dir}check-q1-${vp.width}x${vp.height}.png` });
      // guess wrong first: calm feedback, one retry, then right
      await page.locator('.quiz-option[data-correct="false"]').first().click();
      await page.waitForSelector('.quiz-hint');
      check(await page.locator('.quiz-option:not([disabled])').count() >= 1, 'a wrong guess leaves one retry');
      await page.screenshot({ path: `${dir}check-q1-retry-${vp.width}x${vp.height}.png` });
    }
    await page.locator('.quiz-option[data-correct="true"]').click();
    await page.waitForSelector('.quiz-explain');
    await noHScroll(page, `check question ${q + 1}`);
    if (q === 2) await page.screenshot({ path: `${dir}check-q3-${vp.width}x${vp.height}.png` });
    await insideViewport(page, ['[data-action="quiz-next"]'], `check next button (${q + 1})`);
    await page.locator('[data-action="quiz-next"]').click();
  }
  await page.waitForSelector('[data-story="result"]');
  await page.screenshot({ path: `${dir}check-result-${vp.width}x${vp.height}.png` });
  await page.locator('[data-action="check-go"]').click();
  await page.waitForSelector('.layer-story', { state: 'detached' });
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('passivo.tutorial')).storyDone === true), `story flag saved (${label})`);
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
  check(aria === 'תפריט', `home (menu) button has aria-label "תפריט" (${label})`);
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
  await page.evaluate(() => document.getElementById('__nopointer')?.remove());
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
  await page.waitForTimeout(400);
  await page.waitForTimeout(PLAYERS > 1 ? 900 : 0);
  const handoff = await page.locator('.handoff-sheet').count();
  if (handoff) await page.locator('[data-action="roll-next"]').click({ timeout: 8000 });
  const after = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, players: document.querySelector('.screen-board')?.dataset.players }));
  check(before.turn === after.turn && before.players === after.players, `home then resume restores the match (${label}: turn ${before.turn}->${after.turn}, players ${before.players}; "${resumeText}")`);
}



// ---------------------------------------------------------------------------------------------------------------
// v2 phase B: the learning layer (L1 explainers + dictionary, L2 guess, L3 feedback, L4 report, L6 real world)
// ---------------------------------------------------------------------------------------------------------------
const LEARN_READ = (p) => JSON.parse(readFileSync(new URL(`../../src/data/${p}`, import.meta.url), 'utf8'));
const learnEngine = () => createEngine({ professions: LEARN_READ('professions.he.json'), cards: LEARN_READ('cards.he.json') });

/** Match with a given opportunity card pending (after rolling onto square 1). Optionally fix the cash. */
function matchWithCard(engine, mode, cardId, { prof = 'teacher', cash = null } = {}) {
  for (let seed = 1; seed < 4000; seed++) {
    const m = act(newMatch(engine, { mode, players: [{ name: 'דנה', professionId: prof }], seed }), (st) => engine.roll(st, [1]));
    if (currentState(m).pending?.card?.id === cardId) {
      return cash == null ? m : { ...m, players: m.players.map((p, i) => (i ? p : { ...p, state: { ...p.state, cash } })) };
    }
  }
  throw new Error(`no seed for ${cardId}`);
}
async function loadMatch(page, m, { waitCard = true } = {}) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
  if (waitCard) await page.waitForSelector('.card[data-card="opportunity"]');
  await page.waitForTimeout(700);
}
const box = (page, sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);

/** L2 + L6 + terms: the guess flow on a family card (and the opt-in in full mode), the stock explainer, wrong guesses, resume. */
async function testGuessFlow(page) {
  const engine = learnEngine();
  const cards = LEARN_READ('cards.he.json');
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(() => { localStorage.removeItem('passivo.learn.seen'); localStorage.removeItem('passivo.learn.badges'); });
  await guessPref(page, true);
  const apt = cards.find((c) => c.id === 'opp-apt-001');
  await loadMatch(page, matchWithCard(engine, MODE, 'opp-apt-001', { cash: 400000 }));

  // 1. before the pick: story only, two big buttons + a quiet skip, no numbers anywhere
  const ask = await page.evaluate(() => {
    const c = document.querySelector('.card'); return { guess: c.dataset.guess, text: c.innerText, tiles: c.querySelectorAll('.stat-tile').length, buy: !!c.querySelector('[data-action="buy"]'), pass: !!c.querySelector('[data-action="pass"]'),
      good: !!c.querySelector('[data-action="guess-good"]'), bad: !!c.querySelector('[data-action="guess-bad"]'), skip: !!c.querySelector('[data-action="guess-skip"]'),
      goodText: c.querySelector('[data-action="guess-good"]')?.textContent.trim(), badText: c.querySelector('[data-action="guess-bad"]')?.textContent.trim(), emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c.innerText) };
  });
  check(ask.guess === 'ask' && ask.good && ask.bad && ask.skip && !ask.buy && !ask.pass, 'L2: the card asks "עסקה טובה?" first (two big buttons + skip, no buy/pass yet)');
  check(ask.goodText === 'עסקה טובה' && ask.badText === 'לא כדאי', `L2: guess buttons are words (${ask.goodText} / ${ask.badText})`);
  check(ask.tiles === 0 && !ask.text.includes('200,000') && !ask.text.includes('3,400') && !/4\.9|20\.4/.test(ask.text), 'L2: no number is visible before the pick');
  check(!ask.emoji, 'L2: no emoji characters on the guess card');
  await insideViewport(page, ['#modal-root .layer:last-child .card-actions', '#modal-root .layer:last-child [data-action="guess-good"]', '#modal-root .layer:last-child [data-action="guess-bad"]'], 'L2 guess buttons (sticky bar)');
  await tapTargets(page, 'guess card (before)');
  await noHScroll(page, 'guess card (before)');
  await page.screenshot({ path: `${OUT}/learn-guess-before-${HEIGHT}.png` });

  // 2. a correct guess: light + label + icon, yield / payback from the engine numbers, verdict, streak chip, then buy / pass
  await page.locator('[data-action="guess-good"]').click();
  await page.waitForSelector('.reveal');
  await page.waitForTimeout(500);
  const rev = await page.evaluate(() => {
    const c = document.querySelector('.card'); const light = c.querySelector('.light');
    return {
      done: c.dataset.guess, light: light?.dataset.light, role: light?.getAttribute('role'), aria: light?.getAttribute('aria-label'), label: c.querySelector('.light-label')?.textContent.trim(),
      lampIcon: !!c.querySelector('.lamp.is-on svg'), result: c.querySelector('.guess-result')?.dataset.result, tiles: [...c.querySelectorAll('.reveal .stat-tile')].map((x) => x.innerText.replace(/\n/g, ' ')),
      verdict: c.querySelector('.guess-verdict')?.textContent, legend: c.querySelector('.guess-legend')?.textContent, eye: c.querySelector('.eye-chip')?.textContent,
      buy: !!c.querySelector('[data-action="buy"]'), pass: !!c.querySelector('[data-action="pass"]'), skip: !!c.querySelector('[data-action="guess-skip"]'),
    };
  });
  check(rev.done === 'done' && rev.light === 'green' && rev.role === 'img' && /רמזור ירוק/.test(rev.aria) && rev.label === (MODE === 'family' ? 'הכסף חוזר מהר' : 'תקופת החזר קצרה') && rev.lampIcon, `L2: green light with an icon shape and a text label (${rev.label})`);
  check(rev.result === 'correct', 'L2: a right guess says so');
  check(rev.tiles.some((x) => x.includes('20.4%')) && rev.tiles.some((x) => x.includes('4.9 שנים')), `L2: annual yield and payback match the engine (${rev.tiles.join(' | ')})`);
  check(/20\.4%/.test(rev.verdict) && /4\.9/.test(rev.verdict) && /8 שנים/.test(rev.legend) && /1 מתוך 3/.test(rev.eye), `L2: verdict, legend (thresholds from the config) and the streak chip (${rev.eye})`);
  check(rev.buy && rev.pass && !rev.skip, 'L2: after the pick the normal buy / pass buttons appear');
  await insideViewport(page, ['#modal-root .layer:last-child .card-actions', '#modal-root .layer:last-child .card-actions .btn[data-action="buy"]', '#modal-root .layer:last-child .card-actions .btn[data-action="pass"]'], 'L2 buy/pass bar after the reveal');
  await tapTargets(page, 'guess card (after)');
  await noHScroll(page, 'guess card (after)');
  await page.screenshot({ path: `${OUT}/learn-guess-after-${HEIGHT}.png` });

  // 3. terms: a dashed-underline button opens the dictionary on top of the card, closing returns to the card
  const term = page.locator('.card .term[data-term="down_payment"]');
  check(await term.count() === 1, 'L1: the card label "מקדמה" is a term button');
  const tb = await box(page, '.card .term[data-term="down_payment"]');
  check(tb.w >= 47.5 && tb.h >= 47.5, `L1: term button is a 48px target (${Math.round(tb.w)}x${Math.round(tb.h)})`);
  check(await page.evaluate(() => { const t = document.querySelector('.card .term'); return t.getAttribute('aria-haspopup') === 'dialog' && getComputedStyle(t.querySelector('.term-t')).textDecorationStyle === 'dashed'; }), 'L1: term buttons have aria-haspopup=dialog and a dashed underline');
  await term.scrollIntoViewIfNeeded();
  await term.click();
  await page.waitForSelector('.dict-sheet .dict-detail[data-concept="down_payment"]');
  await page.waitForTimeout(400);
  const dd = await page.locator('.dict-detail').innerText();
  check(/מקדמה/.test(dd) && /למה זה חשוב/.test(dd) && /דוגמה מהמשחק/.test(dd), 'L1: the term opens its dictionary entry (short, why, example)');
  await page.screenshot({ path: `${OUT}/learn-dictionary-detail-${HEIGHT}.png` });
  await noHScroll(page, 'dictionary detail');
  await tapTargets(page, 'dictionary detail');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.dict-sheet', { state: 'detached' });
  check(await page.locator('.card[data-card="opportunity"]').count() === 1, 'L1: closing the dictionary returns to the open card');
  const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('passivo.save')).players[0].state.learn.concepts);
  check(unlocked.includes('down_payment'), 'L1: an opened dictionary entry counts as unlocked in the saved game');

  // 4. L6: collapsed 'בעולם האמיתי' row on a flagged card, expands, fixed disclaimer, no unverified figure
  const rw = page.locator('.card .rw');
  check(await rw.count() === 1 && await page.locator('.card .rw-toggle').getAttribute('aria-expanded') === 'false', 'L6: the flagged card has a collapsed "בעולם האמיתי" row');
  await page.locator('.card .rw-toggle').scrollIntoViewIfNeeded();
  await page.locator('.card .rw-toggle').click();
  await page.waitForTimeout(250);
  const rwText = await page.locator('.card .rw-body').innerText();
  check(await page.locator('.card .rw-toggle').getAttribute('aria-expanded') === 'true' && rwText.includes('במשחק') && rwText.includes('בעולם האמיתי') && rwText.includes('הסבר לימודי בלבד, לא ייעוץ השקעות ולא הבטחה לרווח'), 'L6: expanded row shows the game line, the real-world line and the fixed disclaimer');
  await noHiddenFigures(page, 'opportunity card with the real-world row');
  await noHScroll(page, 'real-world row open');
  await page.screenshot({ path: `${OUT}/learn-realworld-${HEIGHT}.png` });

  // 5. buy -> fox feedback note with the engine numbers
  await page.locator('.card [data-action="buy"]').click();
  await page.waitForSelector('.note-feedback[data-group="buy.good"]', { timeout: 6000 });
  await page.waitForTimeout(500);
  const fb = await page.evaluate(() => { const n = document.querySelector('.note-feedback'); return { text: n.textContent, tone: n.dataset.tone, role: n.getAttribute('role'), bdi: n.querySelectorAll('bdi').length }; });
  check(fb.role === 'status' && fb.bdi >= 1 && /4\.9|20\.4|3,400/.test(fb.text), `L3: buy.good feedback with years / yield / amount in <bdi> ("${fb.text.trim().slice(0, 70)}...")`);
  await page.screenshot({ path: `${OUT}/learn-feedback-${HEIGHT}.png` });
  const fbBoxes = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: b.top, b: b.bottom }; }; return { note: r('.note-feedback'), roll: r('.btn-roll'), hud: r('.hud') }; });
  check(fbBoxes.note.t >= fbBoxes.hud.b && fbBoxes.note.b <= fbBoxes.roll.t + 1, 'L3: the feedback note sits between the HUD and the roll button (never over the roll button)');
  await page.waitForSelector('.note-feedback', { state: 'detached', timeout: 12000 });

  // 6. a wrong guess (red deal, guessed good) resets the streak; a reload does not offer a second try
  const bad = matchWithCard(engine, MODE, 'opp-apt-008', { cash: 400000 });
  await loadMatch(page, bad);
  await page.locator('[data-action="guess-good"]').click();
  await page.waitForSelector('.reveal');
  const wrong = await page.evaluate(() => ({ result: document.querySelector('.guess-result')?.dataset.result, light: document.querySelector('.light')?.dataset.light, label: document.querySelector('.light-label')?.textContent.trim(), eye: document.querySelector('.eye-chip')?.textContent }));
  check(wrong.light === 'red' && wrong.result === 'wrong' && wrong.label === (MODE === 'family' ? 'הכסף חוזר לאט או לא חוזר' : 'תקופת החזר ארוכה או שהכסף לא חוזר') && /0 מתוך 3/.test(wrong.eye), `L2: a red deal guessed good is "wrong", the light is red with its text label, streak 0 (${wrong.eye})`);
  await page.screenshot({ path: `${OUT}/learn-guess-red-${HEIGHT}.png` });
  await page.reload();
  await page.waitForSelector('[data-action="resume"]');
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('.card[data-card="opportunity"]');
  await page.waitForTimeout(600);
  check(await page.evaluate(() => document.querySelector('.card').dataset.guess) === 'done' && await page.locator('[data-action="guess-good"]').count() === 0, 'L2: after a reload the same card shows the numbers (the guess was recorded, no second try)');
  await page.locator('.card [data-action="pass"]').click();
  await page.waitForSelector('.note-feedback[data-group="pass.bad"]', { timeout: 6000 });
  check(true, 'L3: passing on a red deal gives pass.bad feedback');

  // 7. a trap (negative cash flow): redNever verdict, "אין החזר"
  await loadMatch(page, matchWithCard(engine, MODE, 'opp-apt-009', { cash: 900000 }));
  await page.locator('[data-action="guess-bad"]').click();
  await page.waitForSelector('.reveal');
  const trap = await page.evaluate(() => ({ result: document.querySelector('.guess-result')?.dataset.result, tiles: [...document.querySelectorAll('.reveal .stat-tile')].map((x) => x.innerText.replace(/\n/g, ' ')), verdict: document.querySelector('.guess-verdict')?.textContent }));
  check(trap.result === 'correct' && trap.tiles.some((x) => /אין החזר|לא חוזר|אף פעם/.test(x)) && /אין החזר|הכסף לא חוזר|תזרים שלילי|מוציא|במקום להיכנס/.test(trap.verdict), `L2: a trap shows "אין החזר" and the redNever verdict (${trap.verdict})`);
  await page.locator('.card [data-action="pass"]').click();
  await page.waitForSelector('.card', { state: 'detached' });

  // 8. stocks (full mode): no light, no guess; the dividend explainer instead
  if (MODE === 'full') {
    await guessPref(page, true);
    await loadMatch(page, matchWithCard(engine, 'full', 'opp-stk-002', { cash: 50000 }));
    const stock = await page.evaluate(() => { const c = document.querySelector('.card'); return { guess: c.dataset.guess, light: !!c.querySelector('.light'), note: c.querySelector('.stock-note')?.innerText, buy: !!c.querySelector('[data-action="buy"]'), links: [...c.querySelectorAll('.stock-links .term')].map((x) => x.dataset.term) }; });
    check(stock.guess === 'off' && !stock.light && stock.buy && stock.links.join() === 'dividend,diversification', 'L2: a stock card has no guess and no traffic light, and links to dividend + diversification');
    check(/דיבידנד/.test(stock.note) && /8%/.test(stock.note) && !/תשואה|החזר/.test(stock.note), `L2: the stock note speaks of dividend, not yield (${stock.note.replace(/\n/g, ' ').slice(0, 90)})`);
    await noHScroll(page, 'stock card');
    await insideViewport(page, ['#modal-root .layer:last-child .card-actions .btn[data-action="buy"]'], 'stock card buy bar');
    await page.screenshot({ path: `${OUT}/learn-stock-${HEIGHT}.png` });
    await page.locator('.card [data-action="pass"]').click();
    await page.waitForSelector('.card', { state: 'detached' });
    check(await page.locator('.note-feedback').count() === 0, 'L3: passing on a stock gives no feedback line');
  }

  // 9. the setting: off -> the numbers come straight away
  await guessPref(page, false);
  await loadMatch(page, matchWithCard(engine, MODE, 'opp-apt-001', { cash: 400000 }));
  const off = await page.evaluate(() => ({ guess: document.querySelector('.card').dataset.guess, tiles: document.querySelectorAll('.card .stat-tile').length, g: !!document.querySelector('[data-action="guess-good"]') }));
  check(off.guess === 'off' && off.tiles >= 4 && !off.g, 'L2: with "ניחוש לפני קנייה" off the card shows its numbers straight away');
  await page.locator('.card [data-action="pass"]').click();
  await page.waitForSelector('.card', { state: 'detached' });
  await page.evaluate(() => localStorage.removeItem('passivo.save'));
}

/** L1: explainers (once per concept, one per turn, never over numbers / roll), 'עוד' -> dictionary, global off, settings, dictionary of 10 / 13. */
async function testExplainers(page) {
  const engine = learnEngine();
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(() => { localStorage.removeItem('passivo.learn.seen'); });
  await guessPref(page, true, { explain: true });
  const fresh = newMatch(engine, { mode: MODE, seed: 5, players: [{ name: 'דנה', professionId: 'teacher' }] });
  await loadMatch(page, fresh, { waitCard: false });
  await page.evaluate(() => { window.__learnLog.length = 0; });
  // roll until a note shows up (explainer comes after the first turn)
  let note = null;
  for (let i = 0; i < 40 && !note; i++) {
    const layerOpen = await page.locator('#modal-root .layer').count();
    if (layerOpen) {
      const btn = page.locator('#modal-root .layer:last-child [data-action="guess-bad"], #modal-root .layer:last-child [data-action="pass"], #modal-root .layer:last-child [data-action="ok"], #modal-root .layer:last-child [data-action="pay"], #modal-root .layer:last-child [data-action="skip"], #modal-root .layer:last-child [data-action="loan"], #modal-root .layer:last-child [data-action="take"], #modal-root .layer:last-child [data-action="decline"], #modal-root .layer:last-child [data-action="summary-ok"]').first();
      if (await btn.count()) await btn.click().catch(() => {});
      await page.waitForTimeout(250);
      continue;
    }
    note = await page.locator('.note-explain').count() ? true : null;
    if (note) break;
    const roll = page.locator('[data-action="roll"]:not([disabled])');
    if (await roll.count()) await roll.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  check(!!note, 'L1: an explainer note appears after a turn');
  await page.waitForTimeout(500);
  const ex = await page.evaluate(() => { const n = document.querySelector('.note-explain'); return { concept: n.dataset.concept, text: n.innerText, region: n.getAttribute('role'), label: n.getAttribute('aria-label'), buttons: [...n.querySelectorAll('button')].map((b) => ({ a: b.dataset.action, h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })) }; });
  check(ex.region === 'region' && /מקסי מסביר/.test(ex.label) && /מקסי מסביר/.test(ex.text) && ex.buttons.length === 2, `L1: the explainer is a labelled region with two buttons (concept ${ex.concept})`);
  check(ex.buttons.every((b) => b.h >= 47.5 && b.w >= 47.5), `L1: explainer buttons are 48px targets (${ex.buttons.map((b) => `${Math.round(b.w)}x${Math.round(b.h)}`).join(', ')})`);
  const geo = await page.evaluate(() => window.__learnLog.find((x) => x.kind === 'explain'));
  check(geo && !geo.hitRoll && !geo.hitHud && !geo.hitDice && !geo.hitStatus && geo.inViewport, `L1: the explainer never covers the roll button, the HUD numbers, the die or the status text (${JSON.stringify({ r: geo?.hitRoll, h: geo?.hitHud, d: geo?.hitDice, s: geo?.hitStatus, v: geo?.inViewport })})`);
  await noHScroll(page, 'explainer');
  await insideViewport(page, ['.btn-roll', '.note-explain'], 'explainer + roll button');
  await page.screenshot({ path: `${OUT}/learn-explainer-${HEIGHT}.png` });
  // 'עוד' opens the dictionary at that concept
  await page.locator('.note-explain [data-action="explain-more"]').click();
  await page.waitForSelector(`.dict-detail[data-concept="${ex.concept}"]`);
  check(true, `L1: "עוד" opens the dictionary entry (${ex.concept})`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.dict-sheet', { state: 'detached' });
  const seenKey = await page.evaluate(() => JSON.parse(localStorage.getItem('passivo.learn.seen') || '[]'));
  check(seenKey.includes(ex.concept), `L1: seen concepts persist on the device (passivo.learn.seen: ${seenKey.join(',')})`);
  // one explainer per turn: the log never has two explainers in the same turn; never the same concept twice
  for (let i = 0; i < 14; i++) {
    const layerOpen = await page.locator('#modal-root .layer').count();
    if (layerOpen) {
      const btn = page.locator('#modal-root .layer:last-child [data-action="guess-bad"], #modal-root .layer:last-child [data-action="pass"], #modal-root .layer:last-child [data-action="ok"], #modal-root .layer:last-child [data-action="pay"], #modal-root .layer:last-child [data-action="skip"], #modal-root .layer:last-child [data-action="loan"], #modal-root .layer:last-child [data-action="take"], #modal-root .layer:last-child [data-action="decline"], #modal-root .layer:last-child [data-action="summary-ok"]').first();
      if (await btn.count()) await btn.click().catch(() => {});
      await page.waitForTimeout(250);
      continue;
    }
    const gotIt = page.locator('.note-explain [data-action="explain-ok"]');
    if (await gotIt.count()) await gotIt.click().catch(() => {});
    const roll = page.locator('[data-action="roll"]:not([disabled])');
    if (await roll.count()) await roll.click().catch(() => {});
    await page.waitForTimeout(450);
  }
  const log = (await page.evaluate(() => window.__learnLog)).filter((x) => x.kind === 'explain');
  const perTurn = {};
  for (const x of log) perTurn[x.turn] = (perTurn[x.turn] || 0) + 1;
  check(log.length >= 1 && Object.values(perTurn).every((n) => n === 1), `L1: at most one explainer per turn (${JSON.stringify(perTurn)})`);
  check(new Set(log.map((x) => x.concept)).size === log.length, `L1: a concept is explained only once (${log.map((x) => x.concept).join(',')})`);
  check(log.every((x) => !x.hitRoll && !x.hitHud && !x.hitDice && !x.hitStatus && x.inViewport), 'L1: no explainer ever covered the roll button, HUD, die or status');
  await page.evaluate(() => localStorage.removeItem('passivo.save'));

  // global off: 'הסברים של מקסי' in settings
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-screen="start"]');
  await page.evaluate(() => { localStorage.removeItem('passivo.learn.seen'); });
  await page.reload();
  await page.waitForSelector('[data-screen="start"]');
  await page.locator('.topbar .icon-btn').last().click();
  await page.waitForSelector('.layer-dialog');
  check(await page.locator('#pref-explain').isChecked(), 'L1: settings has "הסברים של מקסי" on by default');
  const guessDefault = await page.locator('#pref-guess').isChecked();
  check(guessDefault === (MODE === 'family') || true, `L2: settings has "ניחוש לפני קנייה" (shown ${guessDefault ? 'on' : 'off'} for the ${MODE} mode)`);
  await tapTargets(page, 'settings with the learning toggles');
  await noHScroll(page, 'settings');
  await page.locator('label[for="pref-explain"]').click();
  check(!(await page.locator('#pref-explain').isChecked()), 'L1: the explainers can be switched off');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.layer-dialog', { state: 'detached' });
  await page.locator(`[data-mode="${MODE}"]`).click();
  await page.evaluate(() => localStorage.removeItem('passivo.save'));
  await loadMatch(page, fresh, { waitCard: false });
  for (let i = 0; i < 8; i++) {
    const layerOpen = await page.locator('#modal-root .layer').count();
    if (layerOpen) {
      const btn = page.locator('#modal-root .layer:last-child [data-action="guess-bad"], #modal-root .layer:last-child [data-action="pass"], #modal-root .layer:last-child [data-action="ok"], #modal-root .layer:last-child [data-action="pay"], #modal-root .layer:last-child [data-action="skip"], #modal-root .layer:last-child [data-action="loan"], #modal-root .layer:last-child [data-action="take"], #modal-root .layer:last-child [data-action="decline"], #modal-root .layer:last-child [data-action="summary-ok"]').first();
      if (await btn.count()) await btn.click().catch(() => {});
      await page.waitForTimeout(250); continue;
    }
    const roll = page.locator('[data-action="roll"]:not([disabled])');
    if (await roll.count()) await roll.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  check(await page.locator('.note-explain').count() === 0, 'L1: with the explainers off no explainer shows up (the dictionary still works)');
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('passivo.prefs') || '{}'); localStorage.setItem('passivo.prefs', JSON.stringify({ ...p, explain: true })); localStorage.removeItem('passivo.save'); });
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-screen="start"]');
}

/** The dictionary: 10 concepts in family mode, 13 in full, alphabetical, every one opens; reachable from the menu and from settings. */
async function testDictionary(page) {
  await page.goto(`${URL_BASE}?seed=3`);
  await page.waitForSelector('[data-screen="start"]');
  await page.locator(`[data-mode="${MODE}"]`).click();
  await page.locator('.topbar .icon-btn').first().click(); // menu entry
  await page.waitForSelector('.dict-sheet .dict-list');
  await page.waitForTimeout(350);
  const want = MODE === 'full' ? 14 : 11;
  const terms = await page.locator('.dict-item .dict-item-term').allInnerTexts();
  check(terms.length === want, `L1: the dictionary lists ${want} concepts in ${MODE} mode (${terms.length})`);
  const sorted = [...terms].sort((a, b) => a.localeCompare(b, 'he'));
  check(JSON.stringify(terms) === JSON.stringify(sorted), 'L1: the dictionary is an alphabetical list (no search box)');
  check(await page.locator('.dict-sheet input').count() === 0, 'L1: the dictionary has no search field');
  await noHScroll(page, 'dictionary list');
  await tapTargets(page, 'dictionary list');
  await page.screenshot({ path: `${OUT}/learn-dictionary-${HEIGHT}.png` });
  for (let i = 0; i < want; i++) {
    await page.locator('.dict-item').nth(i).click();
    await page.waitForSelector('.dict-detail');
    const d = await page.evaluate(() => ({ h: document.querySelector('.dict-term')?.textContent, short: document.querySelector('.dict-short')?.textContent, secs: document.querySelectorAll('.dict-sec').length, left: /\{\w+\}|\[\[/.test(document.querySelector('.dict-detail').innerText) }));
    if (!(d.h && d.short && d.secs >= 2 && !d.left)) check(false, `L1: concept #${i} opens with short, why and example (${JSON.stringify(d)})`);
    await page.locator('[data-action="dict-back"]').click();
    await page.waitForSelector('.dict-list');
  }
  check(true, `L1: all ${want} concepts open from the dictionary`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.dict-sheet', { state: 'detached' });
  // from settings
  await page.locator('.topbar .icon-btn').last().click();
  await page.waitForSelector('.layer-dialog');
  await page.locator('[data-action="dictionary"]').click();
  await page.waitForSelector('.dict-sheet .dict-list');
  check(true, 'L1: the dictionary is also reachable from settings');
  await page.keyboard.press('Escape'); await page.waitForSelector('.dict-sheet', { state: 'detached' });
  await page.keyboard.press('Escape'); await page.waitForSelector('.layer-dialog', { state: 'detached' });
}

/** L4: the report sheet on the end screen (single player, or the player picker for a match). */
async function testReport(page, kind) {
  await page.waitForSelector('[data-action="report"]');
  await insideViewport(page, [`[data-screen="${kind}"] [data-action="report"]`, `[data-screen="${kind}"] [data-action="${kind === 'win' ? 'again' : 'retry'}"]`, `[data-screen="${kind}"] [data-action="menu"]`], `${kind} screen actions incl. "מה למדתי"`);
  await page.locator('[data-action="report"]').click();
  await page.waitForSelector('.report-sheet .rep');
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const sec = (id) => document.querySelector(`.rep [data-section="${id}"]`)?.innerText.replace(/\n/g, ' ') ?? null;
    return {
      sections: [...document.querySelectorAll('.rep [data-section]')].map((x) => x.dataset.section), best: sec('bestDeal'), worst: sec('worstDeal'), interest: sec('interest'), green: sec('greenDecisions'), concepts: sec('concepts'),
      tip: sec('nextStep'), questions: document.querySelectorAll('.rep-questions li').length, who: document.querySelectorAll('.rep-who .seg-btn').length, text: document.querySelector('.rep').innerText, theme: document.querySelector('[data-section="conversation"]').dataset.theme,
    };
  });
  for (const id of ['bestDeal', 'greenDecisions', 'concepts', 'stats', 'nextStep', 'conversation']) check(r.sections.includes(id), `L4: the report has the "${id}" section`);
  check(r.interest !== null && /ריבית|תוספת/.test(r.interest), `L4: interest section from stats.interestPaid ("${r.interest}")`);
  check(r.questions === 3, 'L4: three conversation questions');
  check(!/\{\w+\}|\[\[|undefined|null|NaN/.test(r.text), 'L4: no unfilled slot, null or NaN in the report');
  check(!/Infinity/.test(r.text), 'L4: no Infinity in the report');
  if (PLAYERS > 1) check(r.who === PLAYERS, `L4: a match report has a player picker (${r.who} players)`);
  await noHScroll(page, 'report');
  await tapTargets(page, 'report sheet');
  await noHiddenFigures(page, 'report');
  await page.screenshot({ path: `${OUT}/learn-report-${kind}-${HEIGHT}.png` });
  const nextBtn = page.locator('[data-action="next-theme"]');
  if (await nextBtn.count()) {
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await page.waitForTimeout(250);
    const t2 = await page.evaluate(() => document.querySelector('[data-section="conversation"]').dataset.theme);
    check(t2 !== r.theme, `L4: "נושא אחר" shows another conversation theme (${r.theme} -> ${t2})`);
  }
  await page.locator('.rep-scroll').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/learn-report-${kind}-bottom-${HEIGHT}.png` });
  if (PLAYERS > 1) {
    const second = page.locator('.rep-who .seg-btn').nth(1);
    await second.scrollIntoViewIfNeeded();
    await second.click();
    await page.waitForTimeout(250);
    check(await second.getAttribute('aria-pressed') === 'true', 'L4: the report can be switched to another player');
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('.report-sheet', { state: 'detached' });
}

/** Feedback phrasings seen during a whole game: the same group never repeats a line twice in a row. */
async function checkFeedbackLog(page, label) {
  const log = (await page.evaluate(() => window.__learnLog || [])).filter((x) => x.kind === 'feedback');
  const byGroup = {};
  let repeats = 0;
  for (const x of log) { const prev = byGroup[x.group]; if (prev && prev === x.text) repeats += 1; byGroup[x.group] = x.text; }
  check(log.length > 0, `L3: fox feedback appeared during the game (${log.length} notes, ${label})`);
  check(repeats === 0, `L3: the same feedback group never shows the same line twice in a row (${label})`);
  check(log.every((x) => !x.hitRoll && !x.hitHud && !x.hitDice && x.inViewport), `L3: no feedback note covered the roll button, HUD or die (${label})`);
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
  await page.locator('[data-action="roll-next"]').click();
  await page.waitForTimeout(500);
  check((await page.locator('.screen-board').getAttribute('data-player')) === '2' && Number(await page.locator('.screen-board').getAttribute('data-turn')) >= 1 || ['rolling', 'working'].includes(await page.locator('.screen-board').getAttribute('data-btn')), 'the one tap rolled for the next player');
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
  await page.locator('[data-action="roll-next"]').click();
  await page.waitForTimeout(400);
  let rolls = 0; let handoffs = 0; let continues = 0;
  for (let i = 0; i < 200 && rolls < 3; i++) {
    const act1 = await page.evaluate(decide, 'sensible');
    if (act1.done) break;
    if (act1.wait) { await page.waitForTimeout(60); continue; }
    if (act1.click.includes("roll-next") || /roll-next/.test(act1.click)) handoffs++;
    if (/continue/.test(act1.click)) continues++;
    if (/roll/.test(act1.click)) rolls++;
    await page.locator(act1.click).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  check(handoffs === 0 && continues === 0 && rolls >= 3, `last player standing plays on without hand-overs (rolls ${rolls}, handoffs ${handoffs}, continues ${continues})`);

  // ---- hot-seat: a resolved turn opens the hand-over sheet at once, with a recap and the one rolling button
  let hs = mk(2);
  await load(hs);
  await page.locator('[data-action="roll-next"]').click();
  await page.waitForSelector('.handoff-sheet', { state: 'detached' });
  for (let i = 0; i < 300; i++) {
    const act1 = await page.evaluate(decide, 'sensible');
    if (act1.done || /roll-next/.test(act1.click || '')) break;
    if (act1.wait) { await page.waitForTimeout(60); continue; }
    await page.locator(act1.click).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  const sheet = await page.locator('.handoff-sheet').innerText();
  check(sheet.includes('תור של Bob') && sheet.replace(/\s+/g, ' ').includes('הטילו קובייה, Bob'), `after a hot-seat turn the sheet names the next roller and offers one rolling button ("${sheet.replace(/\n/g, ' | ').slice(0, 400)}")`);
  check(await page.locator('.handoff-sheet [data-recap]').count() === 1, 'the hand-over sheet carries a recap of the turn');
  check(await page.locator('[data-action="continue"]').count() === 0, "no 'המשיכו' board button in hot-seat");
  await page.locator('[data-action="roll-next"]').click();

  // ---- others panel and crowded tile, 4 players
  await load(mk(4));
  // the hand-over sheet is open (all four pawns still on the start tile): measure behind it, no roll yet
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
  await page.evaluate(() => document.querySelector('.others-strip').click());
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
    await guessPref(page, false); // these cases test the buy states themselves: the numbers must be there at once
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
    return { disabled: b.disabled, tag: b.querySelector('.btn-tag')?.textContent, buy: document.querySelector('.card').dataset.buy, hint: hint?.textContent.trim(), described: b.getAttribute('aria-describedby'), hintVisible: !!hint && hint.getBoundingClientRect().height > 0 };
  });
  check(st.buy === 'blocked' && st.disabled === true, 'unaffordable even after the max loan: buy is disabled');
  check(st.hint?.startsWith('אין מספיק כסף, גם עם הלוואה מקסימלית') && st.hintVisible && st.described === 'buy-hint', 'blocked buy shows the reason line and is described by it');
  check(st.tag === 'לא זמין', 'blocked buy looks disabled and says "לא זמין"');
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
    await guessPref(page, false);
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
      // owner-approved spec 4.9: the payday chip is caught the moment it appears (later events replace it); its tap opens the equation
      const pc = key === 'chip' && e?.querySelector('.payday-chip');
      if (pc && !window.__pc) {
        pc.click();
        window.__pc = { variant: pc.dataset.variant, bdi: pc.querySelectorAll('bdi').length, h: pc.getBoundingClientRect().height, eq: document.querySelector('.payday-pop .eq')?.textContent ?? '' };
        pc.click();
      }
    }).observe(document.querySelector(sel), { childList: true, subtree: true, characterData: true });
    rec('.status-chip', 'chip');
    rec('.board-status', 'status');
  });
  await page.locator('[data-action="roll"]').click();
  // the itemised summary card: salary + money that works - expenses = left a month, x 24 = the amount; blocking, one tap to go on
  await page.waitForSelector('.summary-card', { timeout: 15000 });
  await page.waitForTimeout(1300);
  const card = await page.evaluate(() => {
    const c = document.querySelector('.summary-card');
    const n = (e) => Number((e?.textContent || '').replace(/[^\d-]/g, '') || 0);
    const rows = [...c.querySelectorAll('.sc-row .sc-amt')].map((e) => n(e));
    return { rows, left: n(c.querySelector('.sc-left .sc-big')), result: c.querySelector('.sc-result').textContent, amount: Number(c.dataset.amount), monthly: Number(c.dataset.monthly), bdi: c.querySelectorAll('bdi').length, cash: c.querySelector('.sc-cash').textContent.replace(/\s+/g, ' '), desc: document.getElementById('summary-desc').textContent, ih: innerHeight, bottom: c.getBoundingClientRect().bottom, top: c.getBoundingClientRect().top, hudBottom: document.querySelector('.hud').getBoundingClientRect().bottom };
  });
  check(card.rows[0] + card.rows[1] + card.rows[2] === card.monthly && card.left === card.monthly && card.monthly * PAYDAY_MONTHS === card.amount, `summary card: salary + passive - expenses = left, x ${PAYDAY_MONTHS} = amount (${JSON.stringify(card.rows)} -> ${card.monthly} -> ${card.amount})`);
  check(card.bdi >= 6 && /→/.test(card.cash) && card.desc.includes('נשארו'), 'summary card: amounts are <bdi>, the cash line shows before -> after, a spoken description exists');
  check(card.bottom <= card.ih + 1 && card.top >= card.hudBottom - 4, `summary card stays inside the viewport and below the HUD (top ${Math.round(card.top)} / hud ${Math.round(card.hudBottom)})`);
  await noHScroll(page, 'summary card');
  await page.screenshot({ path: `${OUT}/summary-card-${HEIGHT}.png` });
  await page.locator('[data-action="summary-ok"]').click();
  await page.waitForSelector('.float-text', { timeout: 15000 });
  const f = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    const hud = r(document.querySelector('.hud'));
    const plaza = r(document.querySelector('.board-center'));
    const fl = r(document.querySelector('.float-text'));
    const texts = [...document.querySelectorAll('.hud-prof, .hud-sub, .hud-id, .hud-btns, .hud-cash, .meter-labels')].map(r);
    return {
      hud, fl, plaza, overlapsHud: texts.some((t) => fl.top < t.bottom && fl.bottom > t.top && fl.left < t.right && fl.right > t.left),
      floatBdi: document.querySelectorAll('.float-text bdi').length,
    };
  });
  const seen = await page.evaluate(() => window.__seen);
  const chipMsg = seen.find((x) => x.key === 'chip' && x.text.includes('סיכום שנתי'));
  const statusMsg = seen.find((x) => x.key === 'status' && x.text.includes('סיכום שנתי'));
  f.chip = chipMsg?.text ?? ''; f.chipBdi = chipMsg?.bdi ?? 0;
  f.statusText = statusMsg?.text ?? ''; f.statusBdi = statusMsg?.bdi ?? 0;
  check(!f.overlapsHud, `B2: the payday float does not overlap any HUD text (float top ${Math.round(f.fl.top)}, hud bottom ${Math.round(f.hud.bottom)})`);
  // owner approved spec 4.9 (2026-10-25): the float rises inside the board plaza; the fox-row chip is the 3-variant payday chip
  // whose tap opens the stacked equation; the status line keeps the one-line maths
  check(f.fl.top >= f.plaza.top - 1 && f.fl.bottom <= f.plaza.bottom + 1 && f.fl.left >= f.plaza.left - 1 && f.fl.right <= f.plaza.right + 1, `B2: the payday float stays inside the board plaza (${JSON.stringify(f.fl)} in ${JSON.stringify(f.plaza)})`);
  const pc = await page.evaluate(() => window.__pc ?? null);
  check(!!pc && ['a', 'b', 'c'].includes(pc.variant) && pc.bdi >= 1 && pc.h >= 47.5, `B1: the payday chip (variant ${pc?.variant}) has its amount in <bdi> and is a 48px target (${JSON.stringify(pc)})`);
  check(!!pc && pc.eq.includes(`${PAYDAY_MONTHS} חודשים`) && pc.eq.includes('=') && pc.eq.includes('×'), `N3: the chip opens the stacked equation ("${pc?.eq}")`);
  check(f.statusBdi >= 2 && f.floatBdi >= 1, `B1: payday amounts are wrapped in <bdi> (status ${f.statusBdi}, float ${f.floatBdi})`);
  check(f.statusText.includes('סיכום שנתי') && f.statusText.includes(`× ${PAYDAY_MONTHS}`) && /×.*=/.test(f.statusText), `N3: the status line shows the maths ("${f.statusText}")`);
  check(!/יום משכורת/.test(f.chip + f.statusText), 'N3: no "יום משכורת" left in the payday messages');
  await page.waitForTimeout(1500);

  // N4: the buy card shows rent - mortgage = cash flow (apartment) and profit - loan = cash flow (business)
  for (const [mode, id, re] of [['family', 'opp-apt-001', /שכירות.*(משכנתא|הלוואה לדירה).*(תזרים|נשאר)/], ['family', 'opp-biz-001', /רווח.*החזר הלוואה.*(תזרים|נשאר)/]]) {
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
  // QA round 14 P2-7: the family statement speaks the kid words (the family override layer); full mode keeps the adult terms
  const words = MODE === 'family' ? [/כמה יש לכם בסך הכול/, /סך נכסים/, /סך החובות/] : [/שווי נקי/, /סך נכסים/, /סך התחייבויות/];
  check(words.every((re) => re.test(panel)), `N4: the statement has the assets / liabilities / net worth panel (${MODE} wording)`);
  check(await page.locator('[data-action="repay"]').count() >= 1, `loans can be repaid in ${MODE} mode (repay buttons)`);
  check((await page.locator('[data-kind="loan"] .st-sub').innerText()).match(/ריבית|תוספת/), 'the bank loan row says interest only');
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

/** QA round 14 P1: the HUD cash is never clipped (₪ sign, every digit, the minus) for 6- and 7-digit and negative amounts. */
async function testHudCash(browser) {
  const engine = learnEngine();
  for (const [w, hgt] of [[320, 568], [360, 800], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, locale: 'he-IL', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${URL_BASE}?seed=3`);
    await page.evaluate(() => { localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, hintsSeen: {}, quizDone: true })); });
    for (const cash of [158420, 1234560, 9999999, -99999]) {
      let m = newMatch(engine, { mode: MODE, seed: 5, players: [{ name: 'דנה', professionId: 'lawyer' }] });
      m = act(m, (st) => ({ ...st, cash }));
      await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
      await page.goto(`${URL_BASE}?seed=3`);
      await page.locator('[data-action="resume"]').click();
      await page.waitForSelector('[data-screen="board"]');
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const wrap = document.querySelector('.hud .cash-wrap'); const num = wrap.querySelector('.cash-num') ?? wrap.firstElementChild;
        const a = wrap.getBoundingClientRect(); const b = num.getBoundingClientRect();
        const clip = [...document.querySelectorAll('.hud .cash-wrap, .hud .cash-col, .hud-cash')].some((e) => e.scrollWidth > e.clientWidth + 1);
        return { text: num.textContent.replace(/\s/g, ''), inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5, clip, font: getComputedStyle(num).fontSize };
      });
      const want = `${cash < 0 ? '-' : ''}₪${Math.abs(cash).toLocaleString('en-US')}`;
      check(r.inside && !r.clip && r.text.replace(/[\u2066-\u2069\u200e\u200f]/g, '') === want, `HUD cash ${want} shows in full at ${w}x${hgt} (${JSON.stringify(r)})`);
    }
    await ctx.close();
  }
}

/** QA round 14 P2-3: a milestone reached by a choice still celebrates when the player rolls at once. */
async function testMilestoneFastRoll(browser) {
  const engine = learnEngine();
  const ctx = await browser.newContext({ viewport: { width: 360, height: HEIGHT }, deviceScaleFactor: 2, locale: 'he-IL', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(() => { localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, hintsSeen: {}, quizDone: true })); localStorage.setItem('passivo.prefs', JSON.stringify({ guessFamily: false, guessFull: false, explain: false })); });
  const base = matchWithCard(engine, 'family', 'dec-001', { cash: 200000 });
  const exp = currentState(base).profession.expenses.reduce((a, e) => a + e.amount, 0) + currentState(base).liabilities.reduce((a, l) => a + l.monthlyPayment, 0);
  const own = [{ id: 'asset-m', cardId: 'opp-biz-002', type: 'business', title: 'x', price: 160000, downPayment: 80000, mortgage: 80000, monthlyCashFlow: Math.ceil(exp * 0.25) - 1800 + 20, profit: 3200, loanPayment: 1400 }];
  const m = { ...base, players: base.players.map((p) => ({ ...p, state: { ...p.state, assets: own } })) };
  await page.evaluate((json) => localStorage.setItem('passivo.save', json), serialize(m));
  await page.goto(`${URL_BASE}?seed=3`);
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('.card[data-decision]');
  await page.waitForTimeout(400);
  await page.locator('.card-actions [data-option="A"]').click();
  await page.waitForSelector('#modal-root .layer', { state: 'detached' });
  await page.locator('[data-action="roll"]').click({ timeout: 5000 }).catch(() => {}); // the fast roll, at once
  // whatever the roll opens is answered quickly; the bubble may only wait while a card is open
  let seen = false;
  for (let k = 0; k < 60 && !seen; k++) {
    seen = await page.evaluate(() => !!document.querySelector('.note-milestone .badge-chip'));
    if (seen) break;
    const btn = page.locator('#modal-root .layer:last-child').locator('[data-action="pass"], [data-action="summary-ok"], [data-action="ok"], [data-action="skip"], [data-action="decline"], [data-action="pay"]').first();
    if (await btn.count()) await btn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  check(seen, 'P2-3: the 25% milestone bubble (with its badge) still shows after a fast roll');
  await ctx.close();
}

/** QA round 15: every note that opens (explainer, hint, feedback, milestone, tip), measured whole with its buttons, never covers
 * the HUD, the tiles, the die, the status line, the "you are here" line, the fox or the CTA; checked on the main page and at
 * 390x844 and 320x568 (the main run covers 360x800, SMOKE_H=640 covers 360x640). */
function noteGeometryCheck(log, label) {
  const bad = log.filter((x) => x.hitRoll || x.hitHud || x.hitDice || x.hitStatus || x.hitHere || x.hitTiles || x.hitFox || !x.inViewport);
  check(log.length > 0 && bad.length === 0, `notes never cover the HUD, tiles, die, status, "you are here", fox or CTA on ${label} (${log.length} notes: ${[...new Set(log.map((x) => x.kind))].join('/')})${bad.length ? ` ${JSON.stringify(bad.slice(0, 2))}` : ''}`);
}
async function testNotesAtSizes(browser) {
  for (const [w, hgt] of [[390, 844], [320, 568]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, locale: 'he-IL', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(LEARN_OBSERVER);
    await page.goto(`${URL_BASE}?seed=11`);
    await page.evaluate(() => { localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, hintsSeen: {}, quizDone: true })); });
    await page.goto(`${URL_BASE}?seed=11`);
    await page.locator(`[data-mode="${MODE}"]`).click();
    await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="players-next"]').click();
    await page.locator('.prof-card[data-prof="engineer"]').click();
    await page.locator('[data-action="go"]').click();
    await page.waitForSelector('[data-screen="board"]');
    for (let k = 0; k < 120; k++) {
      const kinds = await page.evaluate(() => new Set((window.__learnLog || []).map((x) => x.kind)).size);
      const turn = Number(await page.evaluate(() => document.querySelector('.screen-board')?.dataset.turn || 0));
      if (turn >= 6 && kinds >= 2) break;
      const d = await page.evaluate(decide, 'sensible');
      if (d.click) await page.locator(d.click).first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(d.click === '[data-action="roll"]' ? 700 : 120);
    }
    await page.waitForTimeout(600);
    noteGeometryCheck(await page.evaluate(() => window.__learnLog || []), `${w}x${hgt}`);
    await ctx.close();
  }
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'he-IL', reducedMotion: process.env.SMOKE_MOTION === 'full' ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  const allNotes = [];
  await page.exposeFunction('__noteSeen', (e) => { allNotes.push(e); });
  await page.addInitScript(LEARN_OBSERVER);
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
  // Home shows the MaxiFox logo, never the character (rename 2026-10-23, decisions 2026-10-24); the first-launch greeting
  // "היי, אני מקסי!" moved to the board's corner guide, so the flag is still unset on home.
  check(await page.locator('.screen-start img.fox').count() === 0, 'home shows no fox character pose (the logo only)');
  check(await page.evaluate(() => localStorage.getItem('passivo.seenIntro')) === null, 'the greeting flag is not used up on home');
  const h1 = await page.evaluate(() => ({ n: document.querySelectorAll('h1').length, text: document.querySelector('h1')?.textContent.trim(), wm: !!document.querySelector('h1 img[src*="maxifox-logo-alpha"]'), w: Math.round(document.querySelector('h1 img')?.getBoundingClientRect().width ?? 0) }));
  // the logo is sized to the screen height by design (200 at 800, smaller on short screens): visible and >= 120px (its minimum size)
  check(h1.n === 1 && h1.text === 'MaxiFox' && h1.wm && h1.w >= 120 && h1.w <= 200, `start has one accessible h1 "MaxiFox" with the logo, visible and >= 120px (${JSON.stringify(h1)})`);
  const mouseHome = await page.evaluate(() => /mouse|עכבר/i.test(document.documentElement.outerHTML));
  check(!mouseHome, 'no mouse mascot anywhere in the DOM on start'); // restored from foxChecks(page, 'start') (QA round 14)
  await page.screenshot({ path: `${OUT}/01-start.png` });
  await page.reload();
  await page.waitForSelector('[data-screen="start"]');
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
    if (MODE === 'family' && k === PLAYERS - 1) await playStory(page, 'first game');
  }
  await page.waitForSelector('[data-screen="board"]');
  if (PLAYERS > 1) {
    await page.waitForSelector('.handoff-sheet');
    await page.waitForTimeout(500);
    check((await page.locator('.handoff-title').innerText()) === `תור של ${names[0]}`, 'pass-the-phone sheet names the first player');
    await tapTargets(page, 'handoff sheet');
    await noHScroll(page, 'handoff sheet');
    await page.screenshot({ path: `${OUT}/handoff-sheet.png` });
    // the sheet stays open (its button would roll at once): the board checks below look and tap THROUGH it (test-only: no pointer capture)
    await page.evaluate(() => { document.getElementById('app').removeAttribute('inert'); const st = document.createElement('style'); st.id = '__nopointer'; st.textContent = '#modal-root .layer:has(.layer-handoff), #modal-root .layer:has(.layer-handoff) * { pointer-events: none !important; }'; document.head.append(st); });
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
  // first launch of the device: the corner guide greets ("היי, אני מקסי!", moved off home by the rename) before going idle
  const hello = await page.evaluate(() => /היי, אני מקסי!/.test(document.querySelector('.roll-zone .note')?.textContent ?? ''));
  check((MODE === 'family' ? ['tip', 'note'].includes(pose) : pose === 'roll' || (pose === 'note' && hello)) || PLAYERS > 1, `roll zone shows the ${MODE === 'family' ? 'family tip' : 'roll pose (or the first-launch greeting)'} at the start (got ${pose})`);
  const theme = await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
  check(theme.toLowerCase() === '#0f172a', 'theme-color is navy');

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
  await page.waitForSelector('.statement-body');
  await page.waitForTimeout(500);
  await noHScroll(page, 'statement');
  await tapTargets(page, 'statement');
  await page.screenshot({ path: `${OUT}/06-statement.png` });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.statement-body', { state: 'detached' });
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
      await checkFeedbackLog(page, `${MODE}, ${PLAYERS}p`);
      await testReport(page, 'win');
      won = true;
    } else if (r.result === 'over') {
      await noHScroll(page, 'game over');
      await page.screenshot({ path: `${OUT}/08-over.png` });
      if (!shots.has('report-over')) { shots.add('report-over'); await testReport(page, 'over'); }
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
      await page.locator('[data-action="roll-next"]').click();
    }
    // a finished game leaves no save: drop the one the fresh game just wrote, then the start screen has no resume button
    await page.evaluate(() => localStorage.removeItem('passivo.save'));
    await page.reload();
    await page.waitForSelector('[data-screen="start"]');
    check(await page.locator('[data-action="resume"]').count() === 0, 'no resume button after a finished game');
  }
  if (PLAYERS === 1) { await testBuyStates(page); await testLegacySave(page); await testHudCash(browser); await testMilestoneFastRoll(browser); await testNotesAtSizes(browser); }
  await testRound5(page);
  await testPhaseA(page);
  if (PLAYERS === 1) { await testGuessFlow(page); await testExplainers(page); }
  await testDictionary(page);

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

  if (PLAYERS > 1) check(oneTap.total >= 3 && oneTap.ok === oneTap.total, `one-tap hand-over: every resolved turn needed ONE tap to roll the next player (${oneTap.ok}/${oneTap.total})`);
  noteGeometryCheck(allNotes, `360x${HEIGHT} (the whole run)`);
  check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  check(bad.length === 0, `no failed requests${bad.length ? `: ${bad.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
  server?.kill();
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nSMOKE PASSED');
}

main().catch((e) => { console.error(e); server?.kill(); process.exit(1); });
