// The educator's verification script (was scripts/verify-learn.mjs), now part of `npm test`: recomputes every figure the
// learning texts quote from the game data and the engine config, and fails on any mismatch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loanTerms, PAYDAY_MONTHS, MORTGAGE_PAYMENT_RATE, LOAN_PAYMENT_RATE } from '../src/engine/index.js';

const J = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const cards = J('cards.he.json');
const pros = J('professions.he.json');
const gl = J('learn/glossary.he.json');
const fb = J('learn/feedback.he.json');
const rep = J('learn/report.he.json');
const gs = J('learn/guess.he.json');
const rw = J('learn/real-world.he.json');
const card = (id) => cards.find((c) => c.id === id);
const pro = (id) => pros.find((p) => p.id === id);
const r1 = (x) => Math.round(x * 10) / 10;
const g = (id) => gl.concepts.find((c) => c.id === id).example.computed;

describe('learning texts quote the real game numbers', () => {
  it('card cash flow = rent|profit - loanPayment', () => {
    for (const c of cards) if (c.loanPayment != null) expect((c.rent ?? c.profit) - c.loanPayment, c.id).toBe(c.monthlyCashFlow);
  });

  it('teacher examples (cash flow, liabilities, net worth, cushion)', () => {
    const t = pro('teacher');
    const exp = t.expenses.reduce((a, e) => a + e.amount, 0);
    const pay = t.liabilities.reduce((a, l) => a + l.monthlyPayment, 0);
    const debt = t.liabilities.reduce((a, l) => a + l.principal, 0);
    const cf = t.salary - exp - pay;
    expect(exp).toBe(g('cashflow').expenses);
    expect(pay).toBe(g('cashflow').debtPayments);
    expect(cf).toBe(g('cashflow').cashFlow);
    expect(cf * PAYDAY_MONTHS).toBe(g('cashflow').perSummary);
    expect(debt).toBe(g('liability').totalDebt);
    expect(pay).toBe(g('liability').totalPayment);
    expect(t.savings - debt).toBe(g('net_worth').netWorth);
    expect(t.savings).toBe(g('cushion').teacherSavings);
    expect(card('exp-002').amount - pro('cook').savings).toBe(g('cushion').cookShort);
    expect(t.savings - card('exp-002').amount).toBe(g('cushion').teacherLeft);
  });

  it('yield and payback examples', () => {
    const yrs = (c) => r1(c.downPayment / (c.monthlyCashFlow * 12));
    const a1 = card('opp-apt-001');
    expect(r1((a1.monthlyCashFlow * 12 / a1.downPayment) * 100)).toBe(g('yield').yieldOnDownPaymentPct);
    expect(r1((a1.rent * 12 / a1.price) * 100)).toBe(g('yield').grossRentYieldOnPricePct);
    expect(Math.round((a1.mortgage * MORTGAGE_PAYMENT_RATE) / 100) * 100).toBe(a1.loanPayment);
    expect(yrs(card('opp-biz-006'))).toBe(g('payback').biz006.paybackYears);
    expect(yrs(card('opp-apt-008'))).toBe(g('payback').apt008.paybackYears);
    expect(Math.round((card('opp-apt-003').downPayment / card('opp-apt-003').price) * 100)).toBe(g('down_payment').downPaymentSharePct);
    expect(card('opp-biz-007').monthlyCashFlow).toBe(g('passive_income').cashFlow);
    expect(card('opp-apt-004').monthlyCashFlow).toBe(g('asset').cashFlow);
  });

  it('the interest example equals loanTerms() (engine config, not a mirror)', () => {
    const lt = loanTerms(g('interest').amount);
    expect(lt.monthly).toBe(g('interest').monthlyPayment);
    expect(lt.perPayday).toBe(g('interest').interest);
    expect(lt.totalAtPayday).toBe(g('interest').total);
    expect(loanTerms(1000).perPayday).toBe(g('interest').perThousand.perSummary);
    expect(loanTerms(1000).totalAtPayday).toBe(g('interest').perThousand.total);
    expect(loanTerms(5000).aprNominal).toBe(g('interest').rateNominalPct);
    expect(LOAN_PAYMENT_RATE).toBe(0.01);
  });

  it('stock dividend examples', () => {
    for (const s of ['stk-001', 'stk-002', 'stk-003']) {
      const c = card(`opp-${s}`);
      const w = rw.facts.find((f) => f.id === 'rw-stock-dividend').computed[c.symbol];
      expect(c.price).toBe(w.price);
      expect(c.dividend).toBe(w.dividend);
      expect(r1((c.dividend * 12 / c.price) * 100)).toBe(w.dividendPctOfPrice);
    }
  });
});

describe('real-world coverage and text hygiene', () => {
  it('every realWorld card is in exactly one fact, and no fact points at an unflagged card', () => {
    const flagged = cards.filter((c) => c.realWorld).map((c) => c.id);
    const covered = rw.facts.flatMap((f) => f.cardIds);
    for (const id of flagged) expect(covered.filter((x) => x === id).length, id).toBe(1);
    for (const id of covered) expect(flagged, id).toContain(id);
  });
  const all = [gl, fb, rep, gs, rw].map((x) => JSON.stringify(x)).join('\n');
  it('no old payday name and no emoji in any learn text', () => {
    expect(all).not.toContain('יום משכורת');
    expect(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(all)).toBe(false);
  });
  it('no real-world figure is published before finance verifies it', () => {
    for (const f of rw.facts) if (f.numbers) expect(f.numbers.publish, f.id).toBe(false);
  });
  it('every feedback slot is declared, and family loan lines never use {rate}', () => {
    const declared = new Set(Object.keys(fb.notes.slots));
    for (const [grp, v] of Object.entries(fb.lines)) {
      for (const arr of Object.values(v)) for (const s of arr) for (const m of s.matchAll(/\{(\w+)\}/g)) expect(declared.has(m[1]), `${grp}: {${m[1]}}`).toBe(true);
    }
    for (const grp of ['loan.sensible', 'loan.costly']) for (const s of fb.lines[grp].family) expect(s).not.toContain('{rate}');
  });
});
