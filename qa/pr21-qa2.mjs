import { chromium } from 'playwright'; import { readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../src/engine/index.js';
import { launchOptions, previewServer } from '../tests/e2e/env.mjs';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const full1 = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const AXE = readFileSync(process.env.AXE_PATH, 'utf8');
const server = await previewServer({ port: Number(process.env.SMOKE_PORT || 4810) }); const b = await chromium.launch(launchOptions());
const res = []; const log = (ok, m) => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', m); };
async function open(save, { w = 390, h = 844, theme = 'dark', touch = false, story = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'he-IL', hasTouch: touch });
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.addInitScript(([s, st]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: st, helpOn: false, quizDone: true })); localStorage.setItem('passivo.mode', 'full'); if (s !== null) localStorage.setItem('passivo.save', s); } }, [save, story]);
  await p.goto(`${server.url}?theme=${theme}`); await p.waitForSelector('[data-screen="start"]'); return { ctx, p };
}
const toGo = async (p, prof = 'teacher') => { await p.locator('.mode-card[data-mode="family"]').click(); await p.locator('[data-action="start"]').click(); await p.locator('[data-action="players-next"]').click(); await p.waitForSelector('[data-screen="pick"]'); await p.locator(`[data-prof="${prof}"]`).click(); await p.waitForTimeout(300); };
const ls = (p) => p.evaluate(() => localStorage.getItem('passivo.save'));
const dlg = (p) => p.locator('.overwrite-sheet');
const screens = (p) => p.evaluate(() => document.querySelector('[data-screen]')?.dataset.screen);
try {
  // A. order, primary, focus, axe, layout, both themes and viewports
  for (const [w, h] of [[360, 800], [390, 844], [430, 932], [1280, 800], [320, 568]]) for (const theme of ['dark', 'light']) {
    const { ctx, p } = await open(full1, { w, h, theme }); await toGo(p); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); await p.waitForTimeout(1100);
    const m = await p.evaluate(() => { const d = document.querySelector('.overwrite-sheet'); const bs = [...d.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { a: x.dataset.action, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), dis: x.disabled, primary: x.classList.contains('btn-primary'), clip: x.scrollWidth > x.clientWidth + 1 }; }); const r = d.getBoundingClientRect(); return { bs, focus: document.activeElement?.dataset.action, hs: document.documentElement.scrollWidth > innerWidth, inVp: r.bottom <= innerHeight + 1 && r.top >= 0, dir: getComputedStyle(d).direction }; });
    await p.evaluate(AXE); const ax = await p.evaluate(async () => (await axe.run('.overwrite-sheet', { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id));
    const [c, k] = [m.bs.find((x) => x.a === 'overwrite-confirm'), m.bs.find((x) => x.a === 'overwrite-keep')];
    log(c.top < k.top && k.primary && !c.primary && !c.dis && !k.dis && m.focus === 'overwrite-keep' && c.h >= 48 && k.h >= 48 && !c.clip && !k.clip && !m.hs && m.inVp && m.dir === 'rtl' && ax.length === 0 && p.errors.length === 0, `${w}x${h} ${theme}: confirm above keep, keep primary+focused after arming, 48px, no hscroll, axe ${JSON.stringify(ax)}, errors ${p.errors.length}`);
    if ((w === 390 || w === 1280 || w === 320) ) await p.screenshot({ path: `${new URL('./screens/pr21b/', import.meta.url).pathname}dialog-${w}x${h}-${theme}.png` });
    await ctx.close();
  }
  // B. during the window both buttons are disabled; focus is on keep at once (before arming)
  { const { ctx, p } = await open(full1); await toGo(p); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); await p.waitForTimeout(100);
    const m = await p.evaluate(() => ({ dis: [...document.querySelectorAll('.overwrite-sheet button')].map((x) => x.disabled), focus: document.activeElement?.dataset.action })); log(m.dis.every(Boolean), `100ms after open both buttons disabled ${m.dis}, focus=${m.focus}`);
    await p.waitForTimeout(1000); const m2 = await p.evaluate(() => ({ dis: [...document.querySelectorAll('.overwrite-sheet button')].map((x) => x.disabled), focus: document.activeElement?.dataset.action })); log(m2.dis.every((x) => !x) && m2.focus === 'overwrite-keep', `after 1.1s armed ${m2.dis}, focus=${m2.focus}`); await ctx.close(); }
  // C. deliberate confirm: click right away is ignored, after the window it confirms (normal CPU and 6x throttle)
  for (const thr of [1, 6]) for (const touch of [false, true]) {
    const { ctx, p } = await open(full1, { touch }); await toGo(p); if (thr > 1) { const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: thr }); }
    const t0 = Date.now(); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); const early = await p.locator('[data-action="overwrite-confirm"]').boundingBox();
    if (touch) await p.touchscreen.tap(early.x + early.width / 2, early.y + early.height / 2); else await p.mouse.click(early.x + early.width / 2, early.y + early.height / 2);
    await p.waitForTimeout(200); const stillOpen = await dlg(p).count(); const keptEarly = (await ls(p)) === full1;
    let tOk = null; await p.waitForFunction(() => !document.querySelector('[data-action="overwrite-confirm"]').disabled, null, { timeout: 8000 }).then(() => { tOk = Date.now() - t0; });
    await p.locator('[data-action="overwrite-confirm"]').click(); await p.waitForSelector('[data-screen="board"]', { timeout: 15000 });
    log(stillOpen === 1 && keptEarly && (await ls(p)) !== full1 && p.errors.length === 0, `cpu x${thr} ${touch ? 'touch' : 'mouse'}: early tap on confirm ignored (dialog open, save kept); armed after ${tOk}ms wall-clock from tap; then deliberate click confirms`);
    await ctx.close();
  }
  // D. dismissal: Escape, scrim, Back; history stack
  for (const how of ['escape', 'scrim', 'back']) {
    const { ctx, p } = await open(full1, { story: false }); await toGo(p); const h0 = await p.evaluate(() => history.length); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); await p.waitForTimeout(1000);
    if (how === 'escape') await p.keyboard.press('Escape'); else if (how === 'scrim') await p.mouse.click(195, 30); else { await p.goBack(); }
    await p.waitForTimeout(600);
    const url = p.url(); const sc = await screens(p);
    log((await dlg(p).count()) === 0 && (await ls(p)) === full1 && sc === 'pick' && JSON.parse(await p.evaluate(() => localStorage.getItem('passivo.tutorial'))).storyDone === false, `${how}: dialog closed, back on ${sc}, save identical, story flag false, url ${url.slice(-18)}, history.length ${h0}->${await p.evaluate(() => history.length)}`);
    if (how === 'back') { // history state: reopen dialog, dismiss with Back again; then Back from the pick screen
      await p.locator('[data-prof="teacher"]').click(); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); await p.waitForTimeout(1000); await p.goBack(); await p.waitForTimeout(500);
      log((await dlg(p).count()) === 0 && (await screens(p)) === 'pick', 'back twice (second dialog): closes as keep again, still on pick');
      await p.goBack().catch(() => {}); await p.waitForTimeout(500); const after = p.url(); const s2 = await p.evaluate(() => document.querySelector('[data-screen]')?.dataset.screen).catch(() => 'gone');
      log(true, `Back from the pick screen (no dialog): url=${after.slice(-18)} screen=${s2} (informational: does it leave the app or stay)`);
    }
    log(p.errors.length === 0, `${how}: no console errors`); await ctx.close();
  }
  // E. Back used after confirming does not break the board
  { const { ctx, p } = await open(full1); await toGo(p); await p.locator('[data-action="go"]').click(); await dlg(p).waitFor(); await p.waitForTimeout(1000); await p.locator('[data-action="overwrite-confirm"]').click(); await p.waitForSelector('[data-screen="board"]'); await p.waitForTimeout(800);
    await p.goBack().catch(() => {}); await p.waitForTimeout(600); const sc = await p.evaluate(() => document.querySelector('[data-screen]')?.dataset.screen).catch(() => 'gone'); const sh = await p.locator('[data-dialog], .layer-home, .sheet').count().catch(() => -1);
    log(p.errors.length === 0 && (sc === 'board' || sc === 'gone' || sc === 'start'), `after confirm then Back: screen=${sc} sheets=${sh} errors=${p.errors.length}`); await ctx.close(); }
  // F. newer-schema ask; silent cases
  const players = [{ state: {} }];
  const cases = [['newer 999 + players', JSON.stringify({ schemaVersion: 999, status: 'playing', players }), true], ['newer 11 + players (just above)', JSON.stringify({ schemaVersion: 11, players }), true], ['newer, empty players', JSON.stringify({ schemaVersion: 999, players: [] }), false], ['newer, no players key', JSON.stringify({ schemaVersion: 999 }), false], ['newer, float version', JSON.stringify({ schemaVersion: 11.5, players }), false], ['newer, string version', JSON.stringify({ schemaVersion: '999', players }), false], ['garbage', '{not json', false], ['v1', JSON.stringify({ schemaVersion: 1 }), false], ['{}', '{}', false], ['null', 'null', false], ['array', '[1,2]', false], ['empty string', '', false]];
  for (const [name, save, ask] of cases) {
    const { ctx, p } = await open(save); await toGo(p); await p.locator('[data-action="go"]').click(); await p.waitForTimeout(1500);
    const asked = (await dlg(p).count()) === 1; let txt = ''; let kept = true;
    if (asked) { txt = (await dlg(p).innerText()).replace(/\n+/g, ' / '); await p.waitForTimeout(1000); await p.locator('[data-action="overwrite-keep"]').click(); await p.waitForTimeout(500); kept = (await ls(p)) === save; }
    log(asked === ask && kept && p.errors.length === 0, `${name}: asked=${asked} (want ${ask}), save kept on cancel=${kept}, errors=${p.errors.length}${txt ? ' text=' + txt : ''}`); await ctx.close();
  }
} finally { await b.close(); server.stop(); }
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
