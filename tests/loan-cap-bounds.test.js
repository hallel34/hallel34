// Loan-limit bounds (PR21 review, task 4): the offered maximum must stay inside the DOCUMENTED formula for every profession, debt level and mode.
//   byFlow = floor( (monthlyCashFlow - (-salary * 0.2)) / (step * rate) ) * step          (step 1,000; junior 10,000; rate 1% a month unless a cheap-loan card)
//   buying: capAmount = floor(salary * 12 / step) * step; byCap = floor((capAmount - bankLoanPrincipal) / step) * step; max = max(0, min(byFlow, byCap))
//   expense / shortfall / forced: no cap (a player must never get stuck): max = max(0, byFlow)
// The test recomputes this independently from the inputs; nothing is clamped to a made-up number. It also reproduces the 519,000 sighting.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, newMatch, act, currentState, loanLimits, loanCap, maxLoan, monthlyCashFlow, bankLoanPrincipal, LOAN_STEP, JUNIOR_LOAN_STEP,
  LOAN_PAYMENT_RATE, LOAN_CAP_SALARIES, LOAN_LIMIT_SALARY_PCT, loanRateNow,
} from '../src/engine/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const professions = engine.data.professions.map((p) => p.id);

const expectedMax = (s, { forced }) => {
  const step = s.junior ? JUNIOR_LOAN_STEP : LOAN_STEP;
  const rate = loanRateNow(s);
  const byFlow = Math.floor((monthlyCashFlow(s) + s.profession.salary * LOAN_LIMIT_SALARY_PCT) / (step * rate) + 1e-9) * step;
  if (forced) return Math.max(0, byFlow);
  const capAmount = Math.floor((s.profession.salary * LOAN_CAP_SALARIES) / step) * step;
  const byCap = Math.floor((capAmount - bankLoanPrincipal(s)) / step) * step;
  return Math.max(0, Math.min(byFlow, byCap));
};
const stateOf = (mode, professionId, { debt = 0, pending = null, junior = false, flowBoost = 0 } = {}) => {
  let m = newMatch(engine, { mode, seed: 3, players: [{ name: 'x', professionId, ...(junior ? { age: 'upTo10' } : {}) }] });
  m = act(m, (st) => ({
    ...st, pending,
    liabilities: debt ? [...st.liabilities, { id: 'bank-1', kind: 'loan', label: 'הלוואה', principal: debt, monthlyPayment: Math.round(debt * LOAN_PAYMENT_RATE) }] : st.liabilities,
    assets: flowBoost ? [...st.assets, { id: 'boost', type: 'business', title: 'x', price: 0, downPayment: 0, mortgage: 0, monthlyCashFlow: flowBoost }] : st.assets,
  }));
  return currentState(m);
};

describe('loan limit stays inside the documented formula', () => {
  for (const mode of ['family', 'full']) {
    for (const id of professions) {
      for (const debt of [0, 30000, 100000]) {
        it(`${mode} ${id} debt ${debt}: buy path is capped at 12 salaries, expense path is the cash-flow limit`, () => {
          const buy = stateOf(mode, id, { debt, pending: null });
          expect(loanLimits(buy).max).toBe(expectedMax(buy, { forced: false }));
          expect(loanLimits(buy).max).toBeLessThanOrEqual(loanCap(buy).total ?? Infinity);
          for (const kind of ['expense', 'shortfall']) {
            const forced = stateOf(mode, id, { debt, pending: { kind, amount: 5000 } });
            expect(loanLimits(forced).max).toBe(expectedMax(forced, { forced: true }));
            expect(loanLimits(forced).capSalaries).toBe(null); // the 12-salary cap does not apply to an expense loan, by design
          }
        });
      }
    }
  }
  it('junior games use the 10,000 step and keep every limit a multiple of it', () => {
    for (const id of professions) {
      const s = stateOf('family', id, { junior: true });
      if (!s.junior) continue;
      expect(maxLoan(s) % JUNIOR_LOAN_STEP).toBe(0);
      expect(maxLoan(s)).toBe(expectedMax(s, { forced: false }));
    }
  });
});

describe('the 519,000 sighting (hypothesis, reproduced as the documented formula)', () => {
  it('an expense loan is limited by cash flow only: 100 x (cash flow + 20% of salary) rounded down to 1,000', () => {
    // teacher, salary 8,800: floor = -1,760. A monthly cash flow of +3,430 gives (3,430 + 1,760) / 0.01 = 519,000.
    const base = stateOf('full', 'teacher', { pending: { kind: 'expense', amount: 5000 } });
    const boost = 3430 - monthlyCashFlow(base);
    const s = stateOf('full', 'teacher', { pending: { kind: 'expense', amount: 5000 }, flowBoost: boost });
    expect(monthlyCashFlow(s)).toBe(3430);
    expect(loanLimits(s).max).toBe(519000);
    // the same state asked as a PURCHASE is capped at 12 salaries (105,600 -> 105,000), the number the review saw next to it
    const buy = stateOf('full', 'teacher', { pending: null, flowBoost: boost });
    expect(loanLimits(buy).max).toBe(105000);
  });
});
