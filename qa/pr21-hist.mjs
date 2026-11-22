import { chromium } from 'playwright'; import { readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../src/engine/index.js';
import { launchOptions, previewServer } from '../tests/e2e/env.mjs';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
const full1 = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const server = await previewServer({ port: 4812 }); const b = await chromium.launch(launchOptions());
async function run(label, withDialog) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' }); const p = await ctx.newPage();
  await p.addInitScript((s) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('passivo.seenIntro', '1'); localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, helpOn: false, quizDone: true })); if (s) localStorage.setItem('passivo.save', s); } }, withDialog ? full1 : null);
  await p.goto('about:blank'); await p.goto(server.url); await p.waitForSelector('[data-screen="start"]');
  await p.locator('.mode-card[data-mode="family"]').click(); await p.locator('[data-action="start"]').click(); await p.locator('[data-action="players-next"]').click();
  await p.waitForSelector('[data-screen="pick"]'); await p.locator('[data-prof="teacher"]').click();
  if (withDialog) { await p.locator('[data-action="go"]').click(); await p.locator('.overwrite-sheet').waitFor(); await p.waitForTimeout(1000); await p.keyboard.press('Escape'); await p.waitForTimeout(500); }
  const trail = [];
  for (let i = 1; i <= 4; i++) { await p.goBack().catch(() => {}); await p.waitForTimeout(500); trail.push(`${p.url().slice(-14)}|${await p.evaluate(() => document.querySelector('[data-screen]')?.dataset.screen).catch(() => 'n/a')}`); }
  console.log(label, 'Back x1..4:', trail.join('  '));
  await ctx.close();
}
await run('no dialog   ', false); await run('after Escape', true);
await b.close(); server.stop();
