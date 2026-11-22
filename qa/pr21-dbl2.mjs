// Re-test of the stray-second-tap P1 (45461c5). Run: CHROMIUM_PATH=.. node qa/pr21-dbl2.mjs
import { chromium } from 'playwright'; import { readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../src/engine/index.js';
import { launchOptions, previewServer } from '../tests/e2e/env.mjs';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const full1 = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const server = await previewServer({ port: Number(process.env.SMOKE_PORT || 4800) }); const b = await chromium.launch(launchOptions());
const GAPS = [0, 30, 60, 100, 150, 300, 600, 899, 901, 1200];
const VPS = [[390, 844], [360, 640], [360, 720], [430, 932], [320, 568]];
let n = 0, bad = [];
async function setup(w, h, { touch, theme, throttle = 1, count = 1 }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'he-IL', hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  await p.addInitScript(([s, th]) => { if (!sessionStorage.x) { sessionStorage.x = 1; for (const [k, v] of Object.entries(s)) localStorage.setItem('passivo.' + k, v); } }, [{ seenIntro: '1', tutorial: JSON.stringify({ storyDone: true, helpOn: false, quizDone: true }), save: full1, mode: 'full' }, theme]);
  await p.goto(`${server.url}?theme=${theme}`); await p.waitForSelector('[data-screen="start"]');
  if (throttle > 1) { const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await p.locator('.mode-card[data-mode="family"]').click(); await p.locator('[data-action="start"]').click();
  for (let i = 1; i < count; i++) await p.locator('[aria-label="שחקן נוסף"]').click();
  await p.locator('[data-action="players-next"]').click();
  for (let i = 0; i < count - 1; i++) { await p.waitForSelector('[data-screen="pick"]'); await p.locator('[data-prof="teacher"]').click(); await p.locator('[data-action="go"]').click(); await p.waitForTimeout(300); }
  await p.waitForSelector('[data-screen="pick"]'); await p.locator('[data-prof="nurse"]').click(); await p.waitForTimeout(500);
  return { ctx, p };
}
const tap = (p, touch, x, y) => (touch ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
for (const [w, h] of VPS) for (const touch of [true, false]) for (const theme of ['dark', 'light']) {
  // reduce combinatorics: all gaps at 390 both input kinds and themes; other sizes: touch only in dark+light, mouse only dark
  if ((w !== 390) && !touch && theme === 'light') continue;
  for (const count of (w === 390 && touch && theme === 'dark' ? [1, 2] : [1])) for (const gap of GAPS) {
    const { ctx, p } = await setup(w, h, { touch, theme, count });
    const box = await p.locator('[data-action="go"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await tap(p, touch, x, y); if (gap) await p.waitForTimeout(gap);
    const hit = await p.evaluate(([a, c]) => { const e = document.elementFromPoint(a, c); return e?.closest('button')?.dataset.action || e?.className?.toString().slice(0, 20) || e?.tagName; }, [x, y]);
    await tap(p, touch, x, y); await p.waitForTimeout(1300);
    const st = await p.evaluate(() => ({ dlg: document.querySelectorAll('.overwrite-sheet').length, save: localStorage.getItem('passivo.save') }));
    n++; const ok = st.save === full1;
    if (!ok) bad.push({ w, h, touch, theme, count, gap, hit });
    if (!ok || gap === 150 || gap === 901) console.log(ok ? 'ok  ' : 'FAIL', `${w}x${h} ${touch ? 'touch' : 'mouse'} ${theme} players=${count} gap=${gap}: 2nd tap on ${hit}, dialog open=${st.dlg}, save kept=${ok}`);
    await ctx.close();
  }
}
console.log(`stray double-tap cases: ${n}, failures: ${bad.length}`); await b.close(); server.stop();
