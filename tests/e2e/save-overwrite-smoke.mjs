// PR21 review, task 1: starting a new normal game warns ONLY when it would erase a game in progress.
// Run: npm run build && npm run smoke:save   (serves dist on SMOKE_PORT, default 4195; SHOTS=dir saves the dialog screenshots)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createEngine, newMatch, serialize, deserialize, playMatch } from '../../src/engine/index.js';
import { dayKey } from '../../src/daily/calendar.js';
import { launchOptions, previewServer } from './env.mjs';

const readData = (name) => JSON.parse(readFileSync(new URL(`../../src/data/${name}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: readData('professions'), cards: readData('cards') });
const fullSave = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const dailySave = serialize(newMatch(engine, { mode: 'family', seed: 101, players: [{ professionId: 'teacher' }], daily: { date: dayKey() } }));
const SKIP = { seenIntro: '1', tutorial: JSON.stringify({ storyDone: true, helpOn: false, quizDone: true }) };
const NO_STORY = { seenIntro: '1', tutorial: JSON.stringify({ storyDone: false, helpOn: false, quizDone: true }) }; // the first-game story has not been seen
// a finished one-player normal game (a real win) to open the end screen with: the first seed the sensible bot wins
let wonSave = null;
for (let seed = 1; seed < 60 && !wonSave; seed++) {
  const m = playMatch(engine, newMatch(engine, { mode: 'family', seed, players: [{ professionId: 'teacher' }] }), ['sensible'], 2000);
  if (m.status === 'won') wonSave = serialize(m);
}
assert.ok(wonSave, 'a won game for the end-screen test');
const SHOTS = process.env.SHOTS; if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await previewServer({ url: process.env.SMOKE_URL || '', port: Number(process.env.SMOKE_PORT || 4195) });
const browser = await chromium.launch(launchOptions());
const ls = (page, k) => page.evaluate((key) => localStorage.getItem(`passivo.${key}`), k);
async function open(storage, { w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((s) => { if (!sessionStorage.__seeded) { sessionStorage.__seeded = '1'; for (const [k, v] of Object.entries(s)) localStorage.setItem(`passivo.${k}`, v); } }, { ...SKIP, ...storage });
  await page.goto(server.url); await page.waitForSelector('[data-screen="start"]');
  page.errors = errors;
  return { ctx, page };
}
/** Home -> choose the family mode -> Start -> players -> pick the teacher -> "go": the moment a new game would be written. */
async function startFamilyTeacher(page) {
  await page.locator('.mode-card[data-mode="family"]').click();
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="players-next"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  await page.locator('[data-prof="teacher"]').click();
  await page.locator('[data-action="go"]').click();
}
const dialog = (page) => page.locator('.overwrite-sheet');

try {
  // (a) a full-mode game in progress + a new family game -> the dialog, in Hebrew, naming what is erased
  let { ctx, page } = await open({ save: fullSave, mode: 'full' });
  await startFamilyTeacher(page);
  await dialog(page).waitFor();
  const text = await dialog(page).innerText();
  assert.match(text, /יימחק/, 'the dialog says the saved game will be erased');
  assert.ok(text.includes('מלא') && text.includes('מהנדס'), 'it names the saved game (mode and profession)');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-action')), 'overwrite-keep', 'the safe choice (keep) has the focus');
  assert.ok(text.includes('מצב מלא'), 'the mode reads "מצב מלא", not a bare "מלא"');
  assert.equal(await page.locator('[data-action="overwrite-keep"]').evaluate((e) => e.classList.contains('btn-primary')), true, 'keep is the primary button');
  assert.equal(await page.locator('[data-action="overwrite-confirm"]').evaluate((e) => e.classList.contains('btn-secondary')), true, 'erasing is the secondary button');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: `${SHOTS}/save-dialog-390x844.png` }); }
  console.log('PASS (a) destructive replacement shows the dialog');

  // (b) keep: the save is byte-identical, we are back on the pick, resume still works
  await page.locator('[data-action="overwrite-keep"]').click();
  await page.waitForSelector('.overwrite-sheet', { state: 'detached' });
  assert.equal(await ls(page, 'save'), fullSave, 'cancel keeps the saved game byte for byte');
  await page.waitForSelector('[data-screen="pick"]');
  console.log('PASS (b) cancel keeps the data');

  // (b2) Escape (dismiss) = keep, and the first-game story flag is never marked by a cancelled start
  await page.locator('[data-prof="teacher"]').click();
  await page.locator('[data-action="go"]').click();
  await dialog(page).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForSelector('.overwrite-sheet', { state: 'detached' });
  assert.equal(await ls(page, 'save'), fullSave, 'dismissing the dialog keeps the save');
  console.log('PASS (b2) dismiss = keep');

  // (c) confirm: the save is replaced by the new family game
  await page.locator('[data-prof="teacher"]').click();
  await page.locator('[data-action="go"]').click();
  await dialog(page).waitFor();
  await page.locator('[data-action="overwrite-confirm"]').click();
  await page.waitForSelector('[data-screen="board"]');
  const now = deserialize(await ls(page, 'save'));
  assert.equal(now.mode, 'family'); assert.equal(now.players[0].state.profession.id, 'teacher');
  assert.notEqual(await ls(page, 'save'), fullSave);
  console.log('PASS (c) confirm overwrites');
  assert.deepEqual(page.errors, []); await ctx.close();

  // (d) plain resume of the saved game: no dialog
  ({ ctx, page } = await open({ save: fullSave, mode: 'full' }));
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="board"]');
  assert.equal(await dialog(page).count(), 0, 'resume never asks');
  assert.equal(await ls(page, 'save'), fullSave);
  console.log('PASS (d) plain resume shows nothing'); await ctx.close();

  // (e) only an independent daily save exists: a normal start shows nothing and leaves the daily save alone
  ({ ctx, page } = await open({ dailySave }));
  await startFamilyTeacher(page);
  await page.waitForSelector('[data-screen="board"]');
  assert.equal(await dialog(page).count(), 0, 'a daily save is a separate slot: no warning');
  assert.equal(await ls(page, 'dailySave'), dailySave, 'the daily save is untouched');
  console.log('PASS (e) independent daily save: no dialog'); await ctx.close();

  // (f) no save at all: no dialog
  ({ ctx, page } = await open({}));
  await startFamilyTeacher(page);
  await page.waitForSelector('[data-screen="board"]');
  assert.equal(await dialog(page).count(), 0);
  console.log('PASS (f) no save: no dialog'); await ctx.close();

  // (g) cancelling must not mark the first-game story as done (the story would run before the new game; a cancelled start never reaches it)
  ({ ctx, page } = await open({ save: fullSave, mode: 'full', ...NO_STORY }));
  await startFamilyTeacher(page); await dialog(page).waitFor();
  await page.locator('[data-action="overwrite-keep"]').click();
  await page.waitForSelector('[data-screen="pick"]');
  assert.equal(JSON.parse(await ls(page, 'tutorial')).storyDone, false, 'cancel leaves the story flag untouched');
  assert.equal(await ls(page, 'save'), fullSave);
  console.log('PASS (g) cancel does not mark the story as seen'); await ctx.close();

  // (h) a double tap on confirm acts once: one new game, no errors
  ({ ctx, page } = await open({ save: fullSave, mode: 'full' }));
  await startFamilyTeacher(page); await dialog(page).waitFor();
  await page.waitForTimeout(600); // the sheet has finished sliding in
  await page.locator('[data-action="overwrite-confirm"]').dblclick({ force: true });
  await page.waitForSelector('[data-screen="board"]');
  assert.equal(deserialize(await ls(page, 'save')).mode, 'family');
  assert.deepEqual(page.errors, []);
  console.log('PASS (h) double tap on confirm acts once'); await ctx.close();

  // (i) a malformed normal save is not a game in progress: no dialog, no crash
  for (const bad of ['{not json', JSON.stringify({ schemaVersion: 1 }), JSON.stringify({ schemaVersion: 999, players: [] })]) {
    ({ ctx, page } = await open({ save: bad }));
    await startFamilyTeacher(page); await page.waitForSelector('[data-screen="board"]');
    assert.equal(await dialog(page).count(), 0, `a malformed save never asks (${bad.slice(0, 20)})`);
    assert.deepEqual(page.errors, []); await ctx.close();
  }
  console.log('PASS (i) malformed or old saves: no dialog, no crash');

  // (j) end screen "play again": the finished game's slot is empty, so no dialog; if a game in progress appeared meanwhile (another tab) it asks
  ({ ctx, page } = await open({ save: wonSave }));
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="win"]');
  assert.equal(await ls(page, 'save'), null, 'the end screen cleared the finished game from the normal slot');
  await page.locator('[data-action="again"]').first().click();
  await page.waitForSelector('[data-screen="board"]');
  assert.equal(await dialog(page).count(), 0, 'play again with an empty normal slot never asks');
  await ctx.close();
  ({ ctx, page } = await open({ save: wonSave }));
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('[data-screen="win"]');
  await page.evaluate((j) => localStorage.setItem('passivo.save', j), fullSave); // a game in progress written elsewhere
  await page.locator('[data-action="again"]').first().click();
  await dialog(page).waitFor();
  await page.locator('[data-action="overwrite-keep"]').click();
  assert.equal(await ls(page, 'save'), fullSave, 'cancel on the end screen keeps the other game');
  assert.equal(await page.locator('[data-screen="win"]').count() > 0, true, 'and stays on the end screen');
  console.log('PASS (j) play again: empty slot silent, a foreign game in progress asks'); await ctx.close();

  // desktop screenshot of the dialog
  if (SHOTS) {
    ({ ctx, page } = await open({ save: fullSave, mode: 'full' }, { w: 1280, h: 800 }));
    await startFamilyTeacher(page); await dialog(page).waitFor(); await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/save-dialog-1280x800.png` }); await ctx.close();
  }
  console.log('SAVE OVERWRITE SMOKE PASSED');
} finally { await browser.close(); server.stop(); }
