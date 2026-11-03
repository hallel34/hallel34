import { describe, it, expect } from 'vitest';
import { loadData } from '../src/data/index.js';
import { createEngine, currentState, monthlyCashFlow, serialize, deserialize } from '../src/engine/index.js';
import { newFirstAsset, firstAssetPurchase, declineFirstAsset, continueFirstAsset } from '../src/engine/first-asset.js';
import { createMatchStore, slotOf } from '../src/services/match-store.js';

const engine = createEngine(loadData('he'));

describe('first-asset practice, existing economy', () => {
  it('offers a fixed real card without rolling or granting cash', () => {
    const m = newFirstAsset(engine);
    const s = currentState(m);
    expect(s.cash).toBe(engine.newGame({ mode: 'family', professionId: 'teacher' }).cash);
    expect(s.turn).toBe(0);
    expect(s.pending.card.id).toBe('opp-biz-006');
    expect(s.pending.card.downPayment).toBe(40000);
    expect(newFirstAsset(engine)).toEqual(m);
  });
  it('uses the real loan rule and reports net income without double-counting business debt', () => {
    const m = newFirstAsset(engine);
    const original = serialize(m);
    const next = firstAssetPurchase(engine, m);
    const s = currentState(next);
    const f = next.mission.feedback;
    expect(serialize(m)).toBe(original);
    expect(s.cash).toBe(0);
    expect(s.assets).toHaveLength(1);
    expect(f.gross).toBe(1600);
    expect(f.businessPayment).toBe(700);
    expect(f.assetNet).toBe(900);
    expect(f.bankLoan).toBe(31000);
    expect(f.bankPayment).toBe(310);
    expect(f.netChange).toBe(590);
    expect(f.afterFlow - f.beforeFlow).toBe(590);
    expect(monthlyCashFlow(s) - monthlyCashFlow(currentState(m))).toBe(590);
    expect(f.afterProgress).toBeGreaterThan(f.beforeProgress);
  });
  it('rejects replaying a complete purchase, even after save/load', () => {
    const m = deserialize(serialize(firstAssetPurchase(engine, newFirstAsset(engine))));
    expect(() => firstAssetPurchase(engine, m)).toThrow();
    expect(currentState(m).assets).toHaveLength(1);
    expect(currentState(m).stats.loansTaken).toBe(1);
    expect(currentState(m).stats.dealsBought).toBe(1);
  });
  it('allows declining with no financial change or purchase feedback', () => {
    const m = newFirstAsset(engine);
    const next = declineFirstAsset(engine, m);
    expect(currentState(next).cash).toBe(currentState(m).cash);
    expect(currentState(next).liabilities).toEqual(currentState(m).liabilities);
    expect(currentState(next).assets).toEqual([]);
    expect(next.mission.stage).toBe('declined');
    expect(next.mission.feedback).toBeUndefined();
    expect(() => firstAssetPurchase(engine, next)).toThrow();
  });
  it('continues with exactly the same assets, debt and cash, in its isolated slot', () => {
    const m = firstAssetPurchase(engine, newFirstAsset(engine));
    const next = continueFirstAsset(m);
    expect(currentState(next)).toEqual(currentState(m));
    expect(next.mission.stage).toBe('freeplay');
    expect(slotOf(next)).toBe('missionSave');
    expect(() => continueFirstAsset(newFirstAsset(engine))).toThrow();
  });
  it('preserves all existing slots on save and clear, returning write failure', () => {
    const values = { save: 'normal game', dailySave: 'daily game' };
    const store = createMatchStore({
      write: (k, v) => { values[k] = v; return true; },
      remove: (k) => { delete values[k]; }, serialize,
    });
    const m = newFirstAsset(engine);
    expect(store.save(m)).toBe(true);
    expect(values.save).toBe('normal game');
    expect(values.dailySave).toBe('daily game');
    store.clear(m);
    expect(values).toEqual({ save: 'normal game', dailySave: 'daily game' });
    const failed = createMatchStore({ write: () => false, remove: () => {}, serialize });
    expect(failed.save(m)).toBe(false);
  });
});
