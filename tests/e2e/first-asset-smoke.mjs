// Against Vite dev/preview or a deployed PR: MISSION_URL=... npm run smoke:mission.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../../src/engine/index.js';

const base = process.env.MISSION_URL || 'http://127.0.0.1:5173/';
const readData = (name) => JSON.parse(readFileSync(new URL(`../../src/data/${name}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: readData('professions'), cards: readData('cards') });
const normalSave = serialize(newMatch(engine, { mode: 'full', seed: 100, players: [{ professionId: 'engineer' }] }));
const dailySave = serialize(newMatch(engine, { mode: 'family', seed: 101, players: [{ professionId: 'teacher' }], daily: { date: '2026-10-28' } }));
const out = 'test-results/first-asset';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
});
const errors = [];
const checkFit = async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
};
const openMission = async (page) => {
  await page.locator('[data-action="first-asset"]').click();
  await page.locator('[data-mission="first-asset-v1"]').click();
};
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('passivo.missionSave')));
try {
  for (const width of [375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const url = new URL(base);
    url.searchParams.set('debug', '1');
    await page.goto(url.href);
    await page.evaluate(({ normalSave, dailySave }) => {
      localStorage.setItem('passivo.save', normalSave);
      localStorage.setItem('passivo.dailySave', dailySave);
      localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, quizDone: true, helpOn: false }));
    }, { normalSave, dailySave });
    await page.reload();
    await checkFit(page);
    await openMission(page);
    assert.match(await page.locator('body').innerText(), /₪590 בחודש/);
    assert.match(await page.locator('body').innerText(), /₪31,000/);
    await checkFit(page);
    await page.screenshot({ path: `${out}/offer-${width}.png`, fullPage: true });
    await page.reload();
    await openMission(page);
    assert.equal((await save(page)).mission.stage, 'offer');
    await page.locator('[data-action="mission-buy"]').dblclick();
    assert.match(await page.locator('h1').innerText(), /קניתם את הנכס הראשון/);
    const bought = await save(page);
    assert.equal(bought.players[0].state.stats.dealsBought, 1);
    assert.equal(bought.players[0].state.stats.loansTaken, 1);
    assert.equal(bought.mission.feedback.netChange, 590);
    await page.reload();
    await openMission(page);
    assert.equal((await save(page)).players[0].state.assets.length, 1);
    await page.screenshot({ path: `${out}/complete-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'שומרים ויוצאים לתפריט', exact: true }).click();
    assert.equal(await page.locator('.mission-home-badge').count(), 1);
    const preserved = await page.evaluate(() => ({
      normal: localStorage.getItem('passivo.save'), daily: localStorage.getItem('passivo.dailySave'),
    }));
    assert.equal(preserved.normal, normalSave);
    assert.equal(preserved.daily, dailySave);
    await page.screenshot({ path: `${out}/home-${width}.png`, fullPage: true });
    await openMission(page);
    await page.locator('[data-action="mission-continue"]').click();
    await page.locator('.screen-board').waitFor();
    assert.equal((await save(page)).mission.stage, 'freeplay');
    assert.match(await page.locator('.screen-board').innerText(), /900/);
    await checkFit(page);
    await page.reload();
    await openMission(page);
    await page.locator('.screen-board').waitFor();
    assert.equal((await save(page)).players[0].state.stats.dealsBought, 1);
    await page.locator('[data-action="debug-win"]').click();
    await page.locator('[data-action="again"]').click();
    await page.locator('.screen-board').waitFor();
    assert.equal((await save(page)).mission.stage, 'freeplay');
    assert.equal(await page.evaluate(() => localStorage.getItem('passivo.save')), normalSave);
    await context.close();
    console.log(`PASS ${width}px: offer, financing preview, double-click, reload, badge, freeplay, isolated saves`);
  }
  // Refusal, retry, and no unearned badge.
  const c = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  await openMission(p);
  await p.getByRole('button', { name: 'לא קונים הפעם', exact: true }).click();
  assert.equal((await save(p)).players[0].state.cash, 9000);
  assert.equal((await save(p)).mission.stage, 'declined');
  assert.equal(await p.evaluate(() => localStorage.getItem('passivo.learn.badges')), null);
  assert.equal(await p.getByRole('button', { name: 'ממשיכים לשחק חופשי בלי לקנות', exact: true }).count(), 1);
  await p.getByRole('button', { name: 'מנסים שוב את התרגול', exact: true }).click();
  assert.equal((await save(p)).mission.stage, 'offer');
  await p.getByRole('button', { name: 'שומרים ויוצאים לתפריט', exact: true }).click();
  // Corrupt saves are ignored rather than crashing home.
  await p.evaluate(() => localStorage.setItem('passivo.missionSave', '{invalid'));
  await p.reload();
  await openMission(p);
  assert.equal((await save(p)).mission.stage, 'offer');
  await c.close();
  console.log('PASS refusal, retry, no unearned badge, corrupt-save recovery');

  // The extra mission entry must not displace Start after a daily result on
  // the smallest supported viewport. Keep this cheap regression in CI.
  const small = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  const sp = await small.newPage();
  await sp.goto(base);
  await sp.evaluate(() => {
    const d = new Date();
    const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    localStorage.setItem('passivo.dailyResults', JSON.stringify({
      v: 1, byDate: { [key]: {
        record: { date: key, turns: 20, professionId: 'teacher', netWorth: 200000 },
        outcome: 'won',
      } },
    }));
  });
  await sp.reload();
  const geometry = await sp.locator('[data-action="start"]').boundingBox();
  assert.ok(geometry.y + geometry.height <= 568, 'Start stays visible after a daily result at 320×568');
  const logo = await sp.locator('.brand-logo').boundingBox();
  const modes = await sp.locator('.mode-grid').boundingBox();
  assert.ok(logo.y + logo.height <= modes.y, 'logo does not overlap modes');
  await checkFit(sp);
  await sp.screenshot({ path: `${out}/small-daily-result.png`, fullPage: true });
  await small.close();
  console.log('PASS 320×568: daily-result home Start stays visible');

  const blocked = await browser.newContext({ reducedMotion: 'reduce' });
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); };
  });
  const b = await blocked.newPage();
  b.on('pageerror', (e) => errors.push(e.message));
  await b.goto(base);
  await openMission(b);
  assert.match(await b.locator('[role="status"]').innerText(), /לא הצליח לשמור/);
  await b.locator('[data-action="mission-buy"]').click();
  assert.match(await b.locator('h1').innerText(), /קניתם/);
  assert.match(await b.locator('.mission-content').innerText(), /לא הצליח לשמור אותו/);
  await b.getByRole('button', { name: 'שומרים ויוצאים לתפריט', exact: true }).click();
  assert.equal(await b.locator('.screen-mission').count(), 1, 'failed save does not pretend success');
  await b.getByRole('button', { name: 'יציאה בלי שמירה', exact: true }).click();
  await b.locator('.screen-start').waitFor();
  await openMission(b);
  await b.locator('[data-action="mission-buy"]').click();
  await b.getByRole('button', { name: 'ממשיכים לשחק בלי שמירה', exact: true }).click();
  await b.locator('.screen-board').waitFor();
  assert.match(await b.locator('.screen-board').innerText(), /900/);
  await blocked.close();
  console.log('PASS blocked storage: honest error, explicit unsaved exit and freeplay');
  assert.deepEqual(errors, [], 'no JS errors');
  console.log('FIRST ASSET SMOKE PASSED');
} finally { await browser.close(); }
