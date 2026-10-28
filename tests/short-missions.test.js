import { describe, it, expect } from 'vitest';
import { loadData } from '../src/data/index.js';
import { createEngine, currentState, serialize, deserialize, rematch } from '../src/engine/index.js';
import { newFirstAsset } from '../src/engine/first-asset.js';
import { newShortMission, resolveShortMission, continueShortMission, validShortMission, practiceSlot, REPAY_MISSION, BUFFER_MISSION } from '../src/engine/short-missions.js';
import { slotOf, createMatchStore } from '../src/services/match-store.js';

const engine = createEngine(loadData('he'));
describe('short financial practice', () => {
  it.each([REPAY_MISSION, BUFFER_MISSION])('starts %s without extra money or mutated original data', (id) => {
    const before = JSON.stringify(engine.data);
    const m = newShortMission(engine, id);
    expect(currentState(m).cash).toBe(9000);
    expect(currentState(m).profession.id).toBe('teacher');
    expect(validShortMission(engine, m, id)).toBe(true);
    expect(JSON.stringify(engine.data)).toBe(before);
    expect(newShortMission(engine, id)).toEqual(m);
  });
  it('repays only the original credit-card debt using the actual engine', () => {
    const m = newShortMission(engine, REPAY_MISSION);
    const original = serialize(m);
    const next = resolveShortMission(engine, m, 'repay');
    expect(serialize(m)).toBe(original);
    expect(currentState(next).cash).toBe(4000);
    expect(currentState(next).liabilities.map((l) => l.id)).toEqual(['car']);
    expect(next.mission.feedback.after).toEqual({ cash: 4000, debt: 18000, flow: 1640, payment: 360 });
    expect(next.mission.feedback.netChange).toBe(150);
    expect(currentState(next).assets).toEqual([]);
  });
  it('allows keeping the cash without changing any financial state', () => {
    const m = newShortMission(engine, REPAY_MISSION);
    const next = resolveShortMission(engine, m, 'keep');
    expect(currentState(next)).toEqual(currentState(m));
    expect(next.mission.feedback.netChange).toBe(0);
    expect(next.mission.feedback.after.cash).toBe(9000);
  });
  it('pays the actual 4,500 expense once from cash with no new loan', () => {
    const next = resolveShortMission(engine, newShortMission(engine, BUFFER_MISSION), 'cash');
    expect(next.mission.feedback.after).toEqual({ cash: 4500, debt: 23000, flow: 1490, payment: 510 });
    expect(currentState(next).pending).toBeNull();
    expect(currentState(next).stats.expensesPaid).toBe(1);
    expect(currentState(next).stats.totalPaid).toBe(4500);
    expect(currentState(next).stats.loansTaken).toBe(0);
  });
  it('finances the same expense with real loan steps and interest, not free cash', () => {
    const next = resolveShortMission(engine, newShortMission(engine, BUFFER_MISSION), 'loan');
    expect(next.mission.feedback.after).toEqual({ cash: 9500, debt: 28000, flow: 1440, payment: 560 });
    expect(next.mission.feedback.netChange).toBe(-50);
    expect(currentState(next).stats.loansTaken).toBe(1);
    expect(currentState(next).stats.expensesPaid).toBe(1);
    expect(currentState(next).liabilities.find((l) => l.kind === 'loan').principal).toBe(5000);
  });
  it.each([[REPAY_MISSION, 'repay'], [REPAY_MISSION, 'keep'], [BUFFER_MISSION, 'cash'], [BUFFER_MISSION, 'loan']])(
    'saves %s/%s without replay and continues with the identical balance sheet', (id, choice) => {
      const next = resolveShortMission(engine, newShortMission(engine, id), choice);
      const restored = deserialize(serialize(next));
      expect(validShortMission(engine, restored, id)).toBe(true);
      expect(() => resolveShortMission(engine, restored, choice)).toThrow();
      expect(currentState(continueShortMission(restored))).toEqual(currentState(restored));
      expect(slotOf(continueShortMission(restored))).toBe(practiceSlot(id));
    },
  );
  it('rejects invalid ids, choices, cross-slot saves and corrupt feedback', () => {
    expect(() => newShortMission(engine, 'unknown')).toThrow();
    expect(() => practiceSlot('unknown')).toThrow();
    const m = newShortMission(engine, REPAY_MISSION);
    expect(() => resolveShortMission(engine, m, 'loan')).toThrow();
    expect(() => continueShortMission(m)).toThrow();
    expect(validShortMission(engine, m, BUFFER_MISSION)).toBe(false);
    expect(validShortMission(engine, {}, REPAY_MISSION)).toBe(false);
    const done = resolveShortMission(engine, m, 'repay');
    delete done.mission.feedback.after;
    expect(validShortMission(engine, done, REPAY_MISSION)).toBe(false);
  });
  it('does not confuse a short scenario with the original mission slot', () => {
    const slots = new Map([['save', 'normal'], ['dailySave', 'daily']]);
    const store = createMatchStore({ serialize, write: (k, v) => { slots.set(k, v); return true; }, remove: (k) => slots.delete(k) });
    const first = newFirstAsset(engine);
    const repay = newShortMission(engine, REPAY_MISSION);
    const buffer = newShortMission(engine, BUFFER_MISSION);
    [first, repay, buffer].forEach(store.save);
    expect(slots.size).toBe(5);
    store.clear(repay);
    expect(slots.get('save')).toBe('normal');
    expect(slots.get('dailySave')).toBe('daily');
    expect(slots.has('missionSave')).toBe(true);
    expect(slots.has(practiceSlot(BUFFER_MISSION))).toBe(true);
  });
  it.each([REPAY_MISSION, BUFFER_MISSION])('permits a %s freeplay rematch in the same slot', (id) => {
    const base = newShortMission(engine, id);
    const again = { ...rematch(engine, base, 1800), mission: { id, stage: 'freeplay' } };
    expect(validShortMission(engine, again, id)).toBe(true);
    expect(slotOf(again)).toBe(practiceSlot(id));
  });
});
