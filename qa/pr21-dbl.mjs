import { chromium } from 'playwright'; import { readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../src/engine/index.js';
import { launchOptions, previewServer } from '../tests/e2e/env.mjs';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const full1 = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const server = await previewServer({ port: 4510 }); const b = await chromium.launch(launchOptions());
for (const delay of [0, 60, 150, 400, 800]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', hasTouch: true }); const p = await ctx.newPage();
  await p.addInitScript((s) => { if (!sessionStorage.x) { sessionStorage.x = 1; for (const [k, v] of Object.entries(s)) localStorage.setItem('passivo.' + k, v); } }, { seenIntro: '1', tutorial: JSON.stringify({ storyDone: true, helpOn: false, quizDone: true }), save: full1, mode: 'full' });
  await p.goto(server.url); await p.waitForSelector('[data-screen="start"]');
  await p.locator('.mode-card[data-mode="family"]').click(); await p.locator('[data-action="start"]').click(); await p.locator('[data-action="players-next"]').click();
  await p.waitForSelector('[data-screen="pick"]'); await p.locator('[data-prof="teacher"]').click(); await p.waitForTimeout(500);
  const box = await p.locator('[data-action="go"]').boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.touchscreen.tap(x, y); if (delay) await p.waitForTimeout(delay); const hit = await p.evaluate(([a,c]) => { const e = document.elementFromPoint(a,c); return (e?.closest('button')?.dataset.action) || e?.className || e?.tagName; }, [x,y]); console.log('  second tap lands on', hit, 'at y', Math.round(y)); await p.touchscreen.tap(x, y);
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => ({ dlg: document.querySelectorAll('.overwrite-sheet').length, screen: document.querySelector('[data-screen]').dataset.screen, hasSave: localStorage.getItem('passivo.save') }));
  console.log('delay', delay, 'dialogs', st.dlg, 'screen', st.screen, 'save kept', st.hasSave === full1);
  await ctx.close();
}
await b.close(); server.stop();
