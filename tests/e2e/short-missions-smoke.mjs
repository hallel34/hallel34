import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { createEngine, newMatch, serialize } from '../../src/engine/index.js';
import { newFirstAsset } from '../../src/engine/first-asset.js';

const base = process.env.MISSION_URL || 'http://127.0.0.1:5173/';
const readData = (name) => JSON.parse(readFileSync(new URL(`../../src/data/${name}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: readData('professions'), cards: readData('cards') });
const repayId = 'repay-debt-v1', bufferId = 'cash-buffer-v1';
const normal = serialize(newMatch(engine, { mode: 'full', seed: 11, players: [{ professionId: 'engineer' }] }));
const daily = serialize(newMatch(engine, { mode: 'family', seed: 12, players: [{ professionId: 'teacher' }], daily: { date: '2026-10-28' } }));
const first = serialize(newFirstAsset(engine));
const out = 'test-results/short-missions';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
});
const errors = [];
const openHub = async (p) => { await p.locator('[data-action=first-asset]').click(); await p.locator('.screen-mission[data-screen=missions]').waitFor(); };
const enter = (p, id) => p.locator(`[data-mission="${id}"]`).click();
const back = (p) => p.getByRole('button', { name: 'שומרים וחוזרים למשימות', exact: true }).click();
const saved = (p, id) => p.evaluate((id) => JSON.parse(localStorage.getItem(`passivo.missionSave.${id}`)), id);
const fit = async (p) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
const preserved = async (p) => {
  const v = await p.evaluate(() => ['save', 'dailySave', 'missionSave'].map((k) => localStorage.getItem(`passivo.${k}`)));
  assert.deepEqual(v, [normal, daily, first], 'ordinary, daily and first-asset saves are byte-identical');
};
const restart = async (p, id) => {
  await p.locator(`[data-restart="${id}"]`).click();
  await p.locator('[data-action=confirm-restart]').click();
  await p.locator('.screen-mission[data-screen=short-mission]').waitFor();
};
try {
  for (const width of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const url = new URL(base); url.searchParams.set('debug', '1');
    await p.goto(url.href);
    await p.evaluate(({ normal, daily, first }) => {
      localStorage.setItem('passivo.save', normal);
      localStorage.setItem('passivo.dailySave', daily);
      localStorage.setItem('passivo.missionSave', first);
      localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true, quizDone: true, helpOn: false }));
    }, { normal, daily, first });
    await p.reload();
    await openHub(p);
    assert.equal(await p.locator('[data-mission]').count(), 3);
    await fit(p);
    await p.screenshot({ path: `${out}/hub-${width}.png`, fullPage: true });
    await enter(p, repayId);
    await p.screenshot({ path: `${out}/repay-offer-${width}.png`, fullPage: true });
    await p.reload();
    await openHub(p); await enter(p, repayId);
    await p.locator('[data-choice=repay]').dblclick();
    assert.match(await p.locator('h1').innerText(), /מה השתנה/);
    assert.equal((await saved(p, repayId)).mission.feedback.after.cash, 4000);
    assert.equal((await saved(p, repayId)).mission.feedback.netChange, 150);
    assert.equal(await p.evaluate(() => localStorage.getItem('passivo.learn.badges')), null, 'no new reward mechanism');
    await fit(p);
    await p.screenshot({ path: `${out}/repay-result-${width}.png`, fullPage: true });
    await p.reload();
    await openHub(p); await enter(p, repayId);
    assert.match(await p.locator('.screen-mission').innerText(), /₪150/);
    const repayment = JSON.stringify(await saved(p, repayId));
    await back(p); await enter(p, bufferId);
    assert.match(await p.locator('.screen-mission').innerText(), /₪50/);
    await p.screenshot({ path: `${out}/buffer-offer-${width}.png`, fullPage: true });
    await p.locator('[data-choice=loan]').dblclick();
    assert.equal((await saved(p, bufferId)).mission.feedback.after.cash, 9500);
    assert.equal((await saved(p, bufferId)).mission.feedback.after.debt, 28000);
    assert.equal((await saved(p, bufferId)).mission.feedback.netChange, -50);
    assert.equal((await saved(p, bufferId)).players[0].state.stats.expensesPaid, 1);
    assert.equal((await saved(p, bufferId)).players[0].state.stats.loansTaken, 1);
    assert.equal(JSON.stringify(await saved(p, repayId)), repayment);
    await preserved(p);
    await fit(p);
    await p.screenshot({ path: `${out}/buffer-result-${width}.png`, fullPage: true });
    await p.reload();
    await openHub(p); await enter(p, bufferId);
    assert.equal(await p.locator('[data-choice]').count(), 0, 'completed expense is not offered again after reload');
    await p.locator('[data-action=short-continue]').click();
    await p.locator('.screen-board').waitFor();
    assert.equal((await saved(p, bufferId)).mission.stage, 'freeplay');
    await p.locator('[data-action=debug-win]').click();
    await p.locator('[data-action=again]').click();
    await p.locator('.screen-board').waitFor();
    assert.equal((await saved(p, bufferId)).mission.id, bufferId);
    await preserved(p);
    await p.locator('[data-action=home]').click();
    await p.locator('[data-action=home-confirm]').click();
    await openHub(p);
    await p.locator(`[data-restart="${repayId}"]`).click();
    await p.locator('[data-action=cancel-restart]').click();
    assert.equal(JSON.stringify(await saved(p, repayId)), repayment, 'cancelled restart preserves exact save');
    await restart(p, repayId);
    await p.locator('[data-choice=keep]').click();
    assert.equal((await saved(p, repayId)).mission.feedback.netChange, 0);
    assert.equal((await saved(p, repayId)).mission.feedback.after.cash, 9000);
    await back(p);
    await restart(p, bufferId);
    await p.locator('[data-choice=cash]').click();
    assert.equal((await saved(p, bufferId)).mission.feedback.after.cash, 4500);
    assert.equal((await saved(p, bufferId)).players[0].state.stats.loansTaken, 0);
    await preserved(p);
    assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('passivo.learn.missions')).sort()), [repayId, bufferId].sort());
    // Invalid persisted metadata must not crash the chooser or other slots.
    await p.evaluate((id) => {
      const k = `passivo.missionSave.${id}`;
      const m = JSON.parse(localStorage.getItem(k));
      delete m.mission.feedback.after;
      localStorage.setItem(k, JSON.stringify(m));
    }, repayId);
    await p.reload(); await openHub(p); await enter(p, repayId);
    assert.equal((await saved(p, repayId)).mission.stage, 'offer');
    await preserved(p);
    await ctx.close();
    console.log(`PASS ${width}px: all choices, draft/result reload, double click, five isolated saves, freeplay/rematch, replay confirmation, history, invalid save`);
  }
  for (const id of [repayId, bufferId]) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); }; });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base); await openHub(p); await enter(p, id);
    assert.match(await p.locator('[role=status]').innerText(), /לא הצליח לשמור/);
    await p.locator(`[data-choice=${id === repayId ? 'repay' : 'loan'}]`).click();
    assert.match(await p.locator('.screen-mission').innerText(), /לא הצליח לרשום/);
    await back(p);
    assert.equal(await p.locator('.screen-mission[data-screen=short-mission]').count(), 1, 'failed save is not claimed successful');
    await p.getByRole('button', { name: 'ממשיכים לשחק בלי שמירה', exact: true }).click();
    await p.locator('.screen-board').waitFor();
    await ctx.close();
    console.log(`PASS ${id}: blocked storage and explicit unsaved freeplay`);
  }
  assert.deepEqual(errors, [], 'no JS errors');
  console.log('SHORT MISSIONS SMOKE PASSED');
} finally { await browser.close(); }
