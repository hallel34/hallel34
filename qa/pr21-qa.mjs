// Independent QA probe for PR21 review fixes (save overwrite dialog + tip bubble). Not product code.
// Run: CHROMIUM_PATH=... AXE_PATH=... SMOKE_PORT=4500 node qa/pr21-qa.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createEngine, newMatch, serialize, playMatch } from '../src/engine/index.js';
import { dayKey } from '../src/daily/calendar.js';
import { launchOptions, previewServer } from '../tests/e2e/env.mjs';

const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const OUT = new URL('./screens/pr21/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const AXE = process.env.AXE_PATH ? readFileSync(process.env.AXE_PATH, 'utf8') : null;
const SKIP = { seenIntro: '1', tutorial: JSON.stringify({ storyDone: true, helpOn: false, quizDone: true }) };
const NOSTORY = { seenIntro: '1', tutorial: JSON.stringify({ storyDone: false, helpOn: false, quizDone: true }) };
const full1 = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const fam2 = serialize(newMatch(engine, { mode: 'family', seed: 7, players: [{ name: 'דנה', professionId: 'teacher' }, { name: 'אורי', professionId: 'nurse' }] }));
const fam2bot = serialize(newMatch(engine, { mode: 'family', seed: 8, players: [{ name: 'דנה', professionId: 'teacher' }, { professionId: 'nurse', bot: 'sensible' }] }));
const daily = serialize(newMatch(engine, { mode: 'family', seed: 101, players: [{ professionId: 'teacher' }], daily: { date: dayKey() } }));
const fin = (mode, players, want) => { for (let s = 1; s < 400; s++) { const m = playMatch(engine, newMatch(engine, { mode, seed: s, players }), ['sensible', 'always-buy', 'cautious'].slice(0, 1), 3000); if (m.status === want) return serialize(m); } return null; };
const lost = fin('full', [{ professionId: 'teacher' }], 'lost') || fin('family', [{ professionId: 'driver' }], 'lost');
const won2 = (() => { for (let s = 1; s < 300; s++) { const m = playMatch(engine, newMatch(engine, { mode: 'family', seed: s, players: [{ name: 'א', professionId: 'teacher' }, { name: 'ב', professionId: 'nurse' }] }), ['sensible'], 4000); if (m.status === 'won') return serialize(m); } return null; })();

const server = await previewServer({ port: Number(process.env.SMOKE_PORT || 4500) });
const browser = await chromium.launch(launchOptions());
const results = []; const log = (ok, msg) => { results.push({ ok, msg }); console.log(ok ? 'PASS' : 'FAIL', msg); };
const ls = (p, k) => p.evaluate((x) => localStorage.getItem(`passivo.${x}`), k);

async function open(storage, { w = 390, h = 844, theme = 'dark', rm = false, url = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'he-IL', reducedMotion: rm ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.addInitScript((s) => { if (!sessionStorage.__s) { sessionStorage.__s = '1'; for (const [k, v] of Object.entries(s)) localStorage.setItem(`passivo.${k}`, v); } }, { ...SKIP, theme: JSON.stringify(theme), ...storage });
  await page.goto(`${server.url}?theme=${theme}${url}`); await page.waitForSelector('[data-screen="start"]');
  return { ctx, page };
}
const dlg = (p) => p.locator('.overwrite-sheet');
async function toPick(page, { mode = 'family', count = 1, bots = [] } = {}) {
  await page.locator(`.mode-card[data-mode="${mode}"]`).click();
  await page.locator('[data-action="start"]').click();
  for (let i = 1; i < count; i++) await page.locator('[aria-label="שחקן נוסף"]').click();
  for (const b of bots) await page.locator(`[data-bot-seat="${b}"] [data-seat="bot"]`).check({ force: true });
  await page.locator('[data-action="players-next"]').click();
}
async function pickAll(page, ids) {
  for (const id of ids) { await page.waitForSelector('[data-screen="pick"]'); await page.locator(`[data-prof="${id}"]`).click(); await page.locator('[data-action="go"]').click(); await page.waitForTimeout(150); }
}
async function measure(page) {
  return page.evaluate(() => {
    const d = document.querySelector('.overwrite-sheet'); const r = d.getBoundingClientRect();
    const btns = [...d.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return { a: b.dataset.action, w: Math.round(q.width), h: Math.round(q.height), clip: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 }; });
    const txt = [...d.querySelectorAll('h2,p')].map((e) => e.scrollWidth > e.clientWidth + 1);
    return { hscroll: document.documentElement.scrollWidth > innerWidth, sheet: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, vh: innerHeight }, btns, txtClip: txt, focus: document.activeElement?.dataset?.action, dir: getComputedStyle(d).direction, text: d.innerText };
  });
}
async function axe(page) {
  if (!AXE) return null; await page.evaluate(AXE);
  return page.evaluate(async () => (await axe.run('.overwrite-sheet', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => `${v.id}:${v.nodes.length}`));
}

try {
  // 1. layout matrix
  for (const [w, h] of [[360, 800], [390, 844], [430, 932], [1280, 800]]) for (const theme of ['dark', 'light']) for (const rm of [false, true]) {
    if (rm && !(w === 360 && theme === 'dark') && !(w === 1280)) continue;
    const { ctx, page } = await open({ save: full1, mode: 'full' }, { w, h, theme, rm });
    await toPick(page); await pickAll(page, ['teacher']); await dlg(page).waitFor(); await page.waitForTimeout(rm ? 100 : 800);
    const m = await measure(page); const ax = await axe(page); const tag = `${w}x${h} ${theme}${rm ? ' reduced-motion' : ''}`;
    const small = m.btns.filter((b) => b.h < 48 || b.w < 48);
    log(!m.hscroll, `${tag}: no horizontal scroll`);
    log(small.length === 0 && m.btns.every((b) => !b.clip), `${tag}: buttons >=48px, no clipped label ${JSON.stringify(m.btns)}`);
    log(m.sheet.left >= 0 && m.sheet.right <= m.sheet.vw && m.sheet.bottom <= m.sheet.vh + 1 && m.sheet.top >= 0, `${tag}: sheet inside viewport ${JSON.stringify(m.sheet)}`);
    log(m.focus === 'overwrite-keep' && m.dir === 'rtl' && !m.txtClip.some(Boolean), `${tag}: focus=${m.focus} dir=${m.dir} text-not-clipped`);
    log(!ax || ax.length === 0, `${tag}: axe ${JSON.stringify(ax)}`);
    log(page.errors.length === 0, `${tag}: no console errors ${page.errors.join('|')}`);
    await page.screenshot({ path: `${OUT}/dialog-${w}x${h}-${theme}${rm ? '-rm' : ''}.png` });
    if (w === 390 && theme === 'dark' && !rm) console.log('DIALOG TEXT:', JSON.stringify(m.text));
    await ctx.close();
  }

  // 2. dismissal: scrim, Escape, Back; save byte-identical
  for (const how of ['scrim', 'escape', 'back']) {
    const { ctx, page } = await open({ save: full1, mode: 'full', ...NOSTORY });
    await toPick(page); await pickAll(page, ['teacher']); await dlg(page).waitFor(); await page.waitForTimeout(700);
    if (how === 'scrim') await page.mouse.click(195, 40);
    else if (how === 'escape') await page.keyboard.press('Escape');
    else await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
    if (how === 'back') { const left = page.url(); await page.goto(server.url); const kept = (await ls(page, 'save')) === full1 && JSON.parse(await ls(page, 'tutorial')).storyDone === false; log(kept, `dismiss by back: page went to ${left} (dialog is NOT closed by Back: the app is left), save identical after reopen, story flag untouched`); await ctx.close(); continue; }
    const gone = (await dlg(page).count()) === 0;
    log(gone && (await ls(page, 'save')) === full1, `dismiss by ${how}: dialog closed (${gone}), save identical, url=${page.url().slice(-20)}, screen=${await page.evaluate(() => document.querySelector('#app,[data-screen]')?.dataset?.screen || document.body.innerHTML.match(/data-screen="(\w+)"/)?.[1])}`);
    log(JSON.parse(await ls(page, 'tutorial')).storyDone === false, `dismiss by ${how}: story flag untouched`);
    await ctx.close();
  }

  // 3. 2 players / bots: existing save kinds vs new setups
  for (const [name, save, mode, newCount, bots, ids] of [
    ['hot-seat 2p save, new 1p', fam2, 'family', 1, [], ['teacher']],
    ['2p+bot save, new 1p', fam2bot, 'family', 1, [], ['teacher']],
    ['1p save, new 2p', full1, 'full', 2, [], ['teacher', 'nurse']],
    ['1p save, new 2p with bot', full1, 'full', 2, [1], ['teacher']],
  ]) {
    const { ctx, page } = await open({ save, mode });
    await toPick(page, { mode: 'family', count: newCount, bots }); await pickAll(page, ids.slice(0, ids.length - 1));
    // last pick triggers the dialog
    await page.waitForSelector('[data-screen="pick"]'); await page.locator(`[data-prof="${ids.at(-1)}"]`).click(); await page.locator('[data-action="go"]').click();
    await dlg(page).waitFor(); const t1 = await dlg(page).innerText();
    await page.locator('[data-action="overwrite-keep"]').click(); await page.waitForTimeout(500);
    const screen = await page.evaluate(() => [...document.querySelectorAll('[data-screen]')].map((e) => e.dataset.screen).join(','));
    log((await ls(page, 'save')) === save && /pick|players/.test(screen), `${name}: cancel -> ${screen}, save identical. dialog="${t1.replace(/\n/g, ' / ')}"`);
    if (/pick/.test(screen)) { await page.locator(`[data-prof="${ids.at(-1) ?? 'teacher'}"]`).click().catch(() => {}); await page.locator('[data-action="go"]').click().catch(() => {}); await dlg(page).waitFor(); await page.locator('[data-action="overwrite-confirm"]').click(); await page.waitForSelector('[data-screen="board"]'); log((await ls(page, 'save')) !== save, `${name}: confirm replaces`); }
    await ctx.close();
  }

  // 4. end-screen play again: loss, 2-player win
  for (const [name, save] of [['loss', lost], ['2-player win', won2]]) {
    if (!save) { log(false, `${name}: could not fabricate a finished save`); continue; }
    const { ctx, page } = await open({ save });
    await page.locator('[data-action="resume"]').click(); await page.waitForSelector('[data-screen="win"],[data-screen="over"],[data-screen="lose"]');
    const cleared = (await ls(page, 'save')) === null;
    await page.locator('[data-action="again"],[data-action="retry"]').first().click(); await page.waitForTimeout(1200);
    log(cleared && (await dlg(page).count()) === 0 && (await page.locator('[data-screen="board"]').count()) >= 1, `${name}: end screen cleared slot=${cleared}; play again: no dialog, board shown`);
    await ctx.close();
  }
  // end screen, then a DIFFERENT game started from home must not ask (slot empty) and again over other tab's playing save asks
  // 5. daily end with a normal playing save present: save untouched, no dialog anywhere
  {
    const { ctx, page } = await open({ save: full1, mode: 'full' }, { url: '&debug=1' });
    await page.locator('[data-action="daily"]').click(); await page.waitForTimeout(800);
    const hasDlg = await dlg(page).count();
    await page.locator('[data-action="debug-win"]').click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const sc = await page.evaluate(() => [...document.querySelectorAll('[data-screen]')].map((e) => e.dataset.screen).join(','));
    log(hasDlg === 0 && (await ls(page, 'save')) === full1 && (await dlg(page).count()) === 0, `daily start+end with normal save present: no dialog, passivo.save identical (screen ${sc}, again buttons ${await page.locator('[data-action="again"]').count()})`);
    await page.locator('[data-action="menu"]').click().catch(() => {}); await page.waitForTimeout(500);
    log((await page.locator('[data-action="resume"]').count()) === 1, 'after daily end, home still offers resume of the normal game');
    await ctx.close();
  }
  // 6. malformed / v1 / future saves
  for (const [name, bad] of [['garbage', '{not json'], ['v1', JSON.stringify({ schemaVersion: 1 })], ['future', JSON.stringify({ schemaVersion: 999, status: 'playing', players: [] })], ['playing-but-no-players', JSON.stringify({ schemaVersion: 3, status: 'playing', mode: 'full' })], ['empty obj', '{}'], ['null', 'null']]) {
    const { ctx, page } = await open({ save: bad });
    const resume = await page.locator('[data-action="resume"]').count();
    await toPick(page); await pickAll(page, ['teacher']); await page.waitForTimeout(800);
    log(page.errors.length === 0 && (await page.locator('[data-screen="board"]').count()) >= 1, `malformed save "${name}": resume offered=${resume}, new game starts, no errors ${page.errors.join('|')}; save after=${(await ls(page, 'save'))?.slice(0, 30)}`);
    await ctx.close();
  }
  // 7. double tap on keep and on confirm
  for (const act of ['overwrite-keep', 'overwrite-confirm']) {
    const { ctx, page } = await open({ save: full1, mode: 'full' });
    await toPick(page); await pickAll(page, ['teacher']); await dlg(page).waitFor(); await page.waitForTimeout(800);
    await page.locator(`[data-action="${act}"]`).dblclick({ force: true }); await page.waitForTimeout(1500);
    const sc = await page.evaluate(() => [...document.querySelectorAll('[data-screen]')].map((e) => e.dataset.screen).join(','));
    log(page.errors.length === 0 && (await dlg(page).count()) === 0, `double tap ${act}: screen ${sc}, errors ${page.errors.join('|')}, save ${(await ls(page, 'save')) === full1 ? 'kept' : 'replaced'}`);
    await ctx.close();
  }
  // 8. home: start with no choice other entry (resume still silent), second "start" press while dialog open
  {
    const { ctx, page } = await open({ save: full1, mode: 'full' });
    await toPick(page); await page.locator('[data-prof="teacher"]').click(); await page.locator('[data-action="go"]').dblclick();
    await page.waitForTimeout(900);
    log((await dlg(page).count()) === 1, 'double tap on pick go: exactly one dialog, count=' + await dlg(page).count() + ' layers=' + await page.locator('.layer-home').count());
    await ctx.close();
  }
} finally { await browser.close(); server.stop(); }
const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} passed`); bad.forEach((b) => console.log('FAILED:', b.msg));
