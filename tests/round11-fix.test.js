// Round 11 fix loop: the summary card reconciles with a money-losing asset, hints are never lost, the arming guards exist.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/index.js';
import { summaryFigures, summaryRowModel, assetKindOf, createHintScheduler } from '../src/learn/tutorial.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const read = (p) => JSON.parse(src(`src/data/${p}`));
const cards = read('cards.he.json');
const engine = createEngine({ professions: read('professions.he.json'), cards });
const LOSERS = ['opp-apt-009', 'opp-biz-010', 'opp-biz-011', 'opp-apt-010', 'opp-biz-016'];

/** The state of a family game that owns this card (bought through the engine). */
function owning(cardId, professionId = 'teacher') {
  const card = cards.find((c) => c.id === cardId);
  let s = engine.newGame({ mode: 'family', professionId, seed: 1 });
  s = { ...s, cash: 10 ** 7, pending: { kind: 'opportunity', card } };
  return engine.buy(s, 1);
}

describe('summary card rows reconcile (A + B - C = D) with a money-losing asset', () => {
  it('there are five money-losing family cards', () => {
    for (const id of LOSERS) expect(cards.find((c) => c.id === id).monthlyCashFlow, id).toBeLessThan(0);
  });
  for (const id of LOSERS) {
    it(`${id}: salary + signed passive - expenses = the monthly result, and monthly x 24 = the amount`, () => {
      for (const prof of ['teacher', 'driver', 'cook']) {
        const s = owning(id, prof);
        const f = summaryFigures(s, undefined, s.cash);
        expect(f.passive).toBeLessThan(0);
        expect(f.hasLoss).toBe(true);
        expect(f.hasPassive).toBe(false);
        const m = summaryRowModel(f);
        expect(m.rows.map((r) => r.id)).toEqual(['salary', 'passive', 'expenses']);
        expect(m.rows[1].kind).toBe('loss');
        expect(m.rows[1].value).toBe(f.passive); // the real signed figure, never 'עוד אין'
        const [A, B, C] = [m.rows[0].value, m.rows[1].value, -m.rows[2].value];
        expect(A + B - C).toBe(f.monthly);
        expect(m.reconciles).toBe(true);
        expect(f.monthly * f.months).toBe(f.amount);
      }
    });
  }
  it('no asset: the passive row is "none"; an income asset: "income"', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    expect(summaryRowModel(summaryFigures(s0)).rows[1].kind).toBe('none');
    expect(summaryRowModel(summaryFigures(owning('opp-apt-004'))).rows[1].kind).toBe('income');
  });
  it('the card paints the signed figure and the neutral tag, never red, and waits before a tap may close it', () => {
    const code = src('src/ui/summary-card.js');
    expect(code).toContain('lossAsset.template');
    expect(code).toContain('MIN_OPEN_MS');
    expect(code).not.toMatch(/countUp/); // the total is the final figure from the first frame (no ₪0 flash)
    expect(src('src/styles/tutorial.css')).not.toMatch(/\.sc-result \{[^}]*FF9C8C|is-negative \.sc-result \{ color: #FF9C8C/);
  });
});

describe('asset kind of the first-income hint', () => {
  it('one income asset names its kind; several (or a losing one next to it) are attributed to all of them', () => {
    expect(assetKindOf({ assets: [] })).toBe('apartment');
    expect(assetKindOf({ assets: [{ type: 'business', monthlyCashFlow: 5 }] })).toBe('business');
    expect(assetKindOf({ assets: [{ type: 'apartment', monthlyCashFlow: 5 }, { type: 'business', monthlyCashFlow: 5 }] })).toBe('many');
    expect(assetKindOf({ assets: [{ type: 'apartment', monthlyCashFlow: 900 }, { type: 'business', monthlyCashFlow: -300 }] })).toBe('many');
  });
});

describe('hints are never lost', () => {
  const prio = { 'h-expense-paid': 3, 'h-expense-loan': 3, 'h-meter': 5, 'h-almost': 5, 'h-roll': 6 };
  const sched = () => createHintScheduler({ priorityOf: (id) => prio[id] ?? 9 });
  it('a released hint goes back to the queue with its figures and shows next turn, ahead of the rest', () => {
    const s = sched();
    s.offer('h-expense-paid', 4, { amount: 7500, cashLeft: 1500 });
    const got = s.takeFloating(4);
    s.release(got.id, 4); // the player rolled on before the fox spoke
    s.newTurn(); s.offer('h-roll', 5);
    s.offer('h-meter', 5);
    const next = s.takeFloating(5);
    expect(next.id).toBe('h-expense-paid');
    expect(next.ctx).toEqual({ amount: 7500, cashLeft: 1500 });
  });
  it('every offered hint shows within two turns even behind a busier one', () => {
    const s = sched();
    s.offer('h-expense-paid', 2); s.offer('h-roll', 2); s.offer('h-almost', 2);
    const shownAt = {};
    for (let turn = 2; turn <= 5; turn++) { s.newTurn(); const g = s.takeFloating(turn); if (g) shownAt[g.id] = turn; }
    expect(Object.keys(shownAt).sort()).toEqual(['h-almost', 'h-expense-paid', 'h-roll']);
    expect(Math.max(...Object.values(shownAt)) - 2).toBeLessThanOrEqual(2);
  });
  it('a hint released when hints were switched off is not re-queued', () => {
    let on = true;
    const s = createHintScheduler({ active: () => on });
    s.offer('h-meter', 1); const g = s.takeFloating(1); on = false; s.release(g.id, 1);
    expect(s.pending).toEqual([]);
  });
});

describe('arming guards (source level; the browser behaviour is in the smoke tests)', () => {
  it('the hand-over button ignores taps for 700 ms and the sheet has a home link', () => {
    const code = src('src/ui/modals.js');
    expect(code).toMatch(/ARM_MS = 700/);
    expect(code).toContain('arm([');
    expect(src('src/ui/widgets.js')).toContain("b.disabled = true; b.setAttribute('data-arming', '')");
    expect(code).toContain('btn-handoff-home');
  });
  it('the story takes the Back button; the loan hint sits above the figures; the goal line is never hidden', () => {
    expect(src('src/ui/tutorial/story.js')).toContain('holdBack');
    const loan = src('src/ui/modals.js');
    expect(loan.indexOf('hintEl, // first loan window')).toBeLessThan(loan.indexOf('rateLine,\n'));
    expect(src('src/styles/tutorial.css')).not.toMatch(/\.goal-line \{ display: none; \}/);
    expect(src('src/ui/hud-family.js')).toContain('GOAL_MIN_HEIGHT = 600');
  });
});
