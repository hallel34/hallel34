// Full-flow smoke test: plays a game start -> win at 360x800 against the built app.
// Run: npm run build && npm run smoke   (starts `vite preview`; or set SMOKE_URL to test a deployed URL)
// Uses the pre-installed Chromium (CHROMIUM_PATH) or Playwright's default browser.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = Number(process.env.SMOKE_PORT || 4179);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const OUT = process.env.SMOKE_OUT || new URL('../../test-results/', import.meta.url).pathname;
const MODE = process.env.SMOKE_MODE || 'family';
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

/** Decides the next UI action with a simple "sensible" policy. Returns a selector to click, or null. */
function decide(policy) {
  const q = (s, r = document) => r.querySelector(s);
  if (q('[data-screen="win"]')) return { done: 'won' };
  if (q('[data-screen="over"]')) return { done: 'over' };
  const layers = [...document.querySelectorAll('#modal-root .layer')].filter((l) => !l.hasAttribute('data-closing'));
  const top = layers[layers.length - 1];
  const board = q('.screen-board');
  let shot = null;
  const out = (o) => ({ ...o, shot });
  const cash = Number(board?.dataset.cash || 0);
  const expenses = Number(board?.dataset.expenses || 0);
  if (top) {
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
  const roll = q('[data-action="roll"]:not([disabled])');
  if (roll) return { click: '[data-action="roll"]' };
  return { wait: true };
}

const shots = new Set();
async function playGame(page, tag, budgetMs = Number(process.env.SMOKE_GAME_MS || 150000)) {
  const deadline = Date.now() + budgetMs;
  let rolls = 0;
  let resumed = false;
  while (Date.now() < deadline) {
    const d = await page.evaluate(decide, process.env.SMOKE_POLICY || 'sensible');
    if (d.done) return { result: d.done, rolls };
    if (d.shot && !shots.has(d.shot)) {
      shots.add(d.shot);
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/${d.shot}.png` });
      await noHScroll(page, d.shot);
      await tapTargets(page, d.shot);
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
  await resume.click();
  await page.waitForSelector('[data-screen="board"]');
  const after = await page.evaluate(() => ({ turn: document.querySelector('.screen-board')?.dataset.turn, cash: document.querySelector('.screen-board')?.dataset.cash }));
  check(before.turn === after.turn, `resumed same turn (${before.turn} -> ${after.turn})`);
}

async function main() {
  await startServer();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
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
  await page.screenshot({ path: `${OUT}/01-start.png` });

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
  await page.waitForSelector('[data-screen="pick"]');
  await noHScroll(page, 'profession pick');
  await tapTargets(page, 'profession pick');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-pick.png` });
  await page.locator('.prof-card').first().click();
  await page.waitForSelector('.pick-sheet');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/04-pick-sheet.png` });
  await page.locator('[data-action="go"]').click();
  await page.waitForSelector('[data-screen="board"]');
  await noHScroll(page, 'board');
  await tapTargets(page, 'board');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/05-board.png` });

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

  // Play games until one is won (new seed each retry).
  let won = false;
  for (let g = 1; g <= 8 && !won; g++) {
    const r = await playGame(page, `game ${g}`);
    console.log(`game ${g}: ${r.result} after ${r.rolls} rolls`);
    if (r.result === 'won') {
      await page.waitForTimeout(500);
      await noHScroll(page, 'win');
      await page.screenshot({ path: `${OUT}/07-win.png` });
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
    await page.waitForSelector('[data-screen="start"]');
    check(await page.locator('[data-action="resume"]').count() === 0, 'no resume button after a finished game');
  }

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
