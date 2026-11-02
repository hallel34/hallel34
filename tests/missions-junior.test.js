// QA round 22 (CEO 2026-11-02): the practice missions (PRs 13/14) follow the player's age band. 'עד 10' plays a junior variant of
// each mission (the same scenario on the junior round rules), so every figure is whole coins and the texts name them in coins;
// the family vocabulary layer covers the mission strings; and the variants keep separate save slots.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, currentState, JUNIOR_AGE, JUNIOR_LOAN_STEP, COIN_VALUE, seesCoins } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';
import { newFirstAsset, firstAssetPurchase } from '../src/engine/first-asset.js';
import { newShortMission, resolveShortMission, shortMissionFacts, validShortMission, REPAY_MISSION, BUFFER_MISSION, practiceSlot } from '../src/engine/short-missions.js';
import { slotOf } from '../src/services/match-store.js';
import { moneyIsolated, setCoinScale } from '../src/ui/format.js';
import { t } from '../src/i18n/index.js';
import { setLearnMode } from '../src/learn/context.js';
import { learnContent } from '../src/learn/content.js';

const engine = createEngine(loadData('he'));
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const junior = { age: JUNIOR_AGE };
const whole = (v) => Number.isFinite(v) && v % COIN_VALUE === 0;
const coins = (v) => Math.abs(v) / COIN_VALUE;
const plain = (s) => s.replace(/[⁦-⁩]/g, '');
const big = (s) => [...plain(s).matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)].map((m) => Number(m[0].replace(/,/g, ''))).filter((n) => n > 999);
const leaves = (o, p = []) => (typeof o === 'string' ? [p.join('.')] : Object.entries(o).flatMap(([k, v]) => leaves(v, [...p, k])));

afterEach(() => setCoinScale(false));

describe('practice missions: the junior variant (age band "עד 10")', () => {
  it('the variant follows the age band: junior only for "עד 10", the other bands and none play in shekels', () => {
    for (const make of [(a) => newFirstAsset(engine, a), (a) => newShortMission(engine, REPAY_MISSION, a), (a) => newShortMission(engine, BUFFER_MISSION, a)]) {
      const j = make(junior);
      expect(j.junior).toBe(true);
      expect(seesCoins(j, j.players[0])).toBe(true);
      for (const age of [null, '11to13', '14plus']) expect(make({ age }).junior, String(age)).toBeUndefined();
    }
    expect(newFirstAsset(engine)).toEqual(newFirstAsset(engine, { age: null })); // the default stays the PR's shekel scenario
  });
  it('first asset: every card and feedback figure is whole coins, at most 999 coins', () => {
    const m = newFirstAsset(engine, junior);
    const card = currentState(m).pending.card;
    for (const k of ['price', 'downPayment', 'mortgage', 'profit', 'loanPayment', 'monthlyCashFlow']) expect(whole(card[k]), k).toBe(true);
    const done = firstAssetPurchase(engine, m);
    const f = done.mission.feedback;
    for (const k of ['gross', 'businessPayment', 'assetNet', 'bankLoan', 'bankPayment', 'netChange', 'beforeFlow', 'afterFlow']) {
      expect(whole(f[k]), k).toBe(true);
      expect(coins(f[k]), k).toBeLessThanOrEqual(999);
    }
    expect(f.bankLoan % JUNIOR_LOAN_STEP).toBe(0);
    expect(whole(currentState(done).cash)).toBe(true);
    expect(coins(card.downPayment)).toBeLessThanOrEqual(999);
  });
  it.each([[REPAY_MISSION, ['repay', 'keep']], [BUFFER_MISSION, ['cash', 'loan']]])('%s: both choices end on whole coins (real engine)', (id, choices) => {
    const m = newShortMission(engine, id, junior);
    expect(validShortMission(engine, m, id)).toBe(true);
    for (const c of choices) {
      const f = resolveShortMission(engine, m, c).mission.feedback;
      for (const side of ['before', 'after']) for (const k of ['cash', 'debt', 'flow', 'payment']) {
        expect(whole(f[side][k]), `${c} ${side}.${k}`).toBe(true);
        expect(coins(f[side][k]), `${c} ${side}.${k}`).toBeLessThanOrEqual(999);
      }
    }
    for (const [k, v] of Object.entries(shortMissionFacts(engine, m))) expect(whole(v), k).toBe(true);
  });
  it('the buffer mission borrows one junior loan step (10,000) instead of 5,000', () => {
    expect(shortMissionFacts(engine, newShortMission(engine, BUFFER_MISSION, junior))).toMatchObject({ step: JUNIOR_LOAN_STEP, loan: JUNIOR_LOAN_STEP, cost: 4500 });
  });
  it('the shekel facts are the figures the PR texts named (the texts are unchanged for the other ages)', () => {
    expect(shortMissionFacts(engine, newShortMission(engine, REPAY_MISSION))).toEqual({ cash: 9000, debt: 5000, payment: 150, left: 4000 });
    expect(shortMissionFacts(engine, newShortMission(engine, BUFFER_MISSION))).toEqual({ cost: 4500, step: 1000, loan: 5000, cashLeft: 4500, loanCash: 9500, interest: 50 });
  });
  it('a junior variant has its own save slot; the shekel slots are unchanged', () => {
    expect(slotOf(newFirstAsset(engine))).toBe('missionSave');
    expect(slotOf(newFirstAsset(engine, junior))).toBe('missionSave.junior');
    for (const id of [REPAY_MISSION, BUFFER_MISSION]) {
      expect(slotOf(newShortMission(engine, id))).toBe(practiceSlot(id));
      expect(slotOf(newShortMission(engine, id, junior))).toBe(`${practiceSlot(id)}.junior`);
    }
  });
  it('every mission string, filled with the junior facts in coins, has no ₪ and no number over 999', () => {
    learnContent();
    setLearnMode('family');
    setCoinScale(true);
    const facts = {
      ...shortMissionFacts(engine, newShortMission(engine, REPAY_MISSION, junior)),
      ...shortMissionFacts(engine, newShortMission(engine, BUFFER_MISSION, junior)),
    };
    const args = Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, moneyIsolated(v)]));
    const f = firstAssetPurchase(engine, newFirstAsset(engine, junior)).mission.feedback;
    args.amount = moneyIsolated(f.netChange);
    args.before = f.beforeProgress.toFixed(1);
    args.after = f.afterProgress.toFixed(1);
    const bad = [];
    for (const g of ['mission', 'missions']) {
      for (const key of leaves(he[g], [g])) {
        const s = t(key, args);
        if (/₪/.test(s) || big(s).length || /\{\w+\}/.test(s)) bad.push(`${key}: ${plain(s)}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
