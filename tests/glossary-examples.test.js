// Every number in a glossary example is recomputed from the card / profession data and the engine config
// (docs/v3/learn/glossary-fix.md section 5). Editing a card breaks this test instead of silently drifting the text.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, paybackYears, paybackTier, dealMetrics, loanTerms, PAYDAY_MONTHS, LOAN_PAYMENT_RATE, PAYBACK_OK_YEARS,
  PAYBACK_SLOW_YEARS, statement,
} from '../src/engine/index.js';
import { yearsPhrase } from '../src/learn/slots.js';
import { moneyText } from '../src/ui/format.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const cards = read('../src/data/cards.he.json');
const professions = read('../src/data/professions.he.json');
const glossary = read('../src/data/learn/glossary.he.json');
const card = (id) => cards.find((c) => c.id === id);
const prof = (id) => professions.find((p) => p.id === id);
const concept = (id) => glossary.concepts.find((c) => c.id === id);
const computed = (id) => concept(id).example.computed;
const round1 = (x) => Math.round(x * 10) / 10;
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

describe('glossary examples are recomputed from the data', () => {
  it('cashflow: teacher', () => {
    const c = computed('cashflow');
    const t = prof('teacher');
    const expenses = sum(t.expenses, (e) => e.amount);
    const debt = sum(t.liabilities, (l) => l.monthlyPayment);
    expect(c.salary).toBe(t.salary);
    expect(c.expenses).toBe(expenses);
    expect(c.debtPayments).toBe(debt);
    expect(c.cashFlow).toBe(t.salary - expenses - debt);
    expect(c.perSummary).toBe(c.cashFlow * PAYDAY_MONTHS);
    const engine = createEngine({ cards, professions });
    expect(statement(engine.newGame({ mode: 'full', professionId: 'teacher', seed: 1 })).monthlyCashFlow).toBe(c.cashFlow);
  });

  it('passive_income: opp-biz-007 profit minus loan payment is the card cash flow', () => {
    const c = computed('passive_income');
    const k = card('opp-biz-007');
    expect(c.profit).toBe(k.profit);
    expect(c.loanPayment).toBe(k.loanPayment);
    expect(c.cashFlow).toBe(k.profit - k.loanPayment);
    expect(c.cashFlow).toBe(k.monthlyCashFlow);
  });

  it('asset: opp-apt-004 rent minus loan payment is the card cash flow', () => {
    const c = computed('asset');
    const k = card('opp-apt-004');
    expect(c.rent).toBe(k.rent);
    expect(c.loanPayment).toBe(k.loanPayment);
    expect(c.cashFlow).toBe(k.rent - k.loanPayment);
    expect(c.cashFlow).toBe(k.monthlyCashFlow);
  });

  it('liability: teacher debts', () => {
    const c = computed('liability');
    const l = prof('teacher').liabilities;
    const car = l.find((x) => x.id === 'car');
    const cc = l.find((x) => x.id === 'card');
    expect([c.carPrincipal, c.carPayment, c.cardPrincipal, c.cardPayment]).toEqual([car.principal, car.monthlyPayment, cc.principal, cc.monthlyPayment]);
    expect(c.totalDebt).toBe(sum(l, (x) => x.principal));
    expect(c.totalPayment).toBe(sum(l, (x) => x.monthlyPayment));
  });

  it('down_payment: opp-apt-003', () => {
    const c = computed('down_payment');
    const k = card('opp-apt-003');
    expect([c.price, c.downPayment]).toEqual([k.price, k.downPayment]);
    expect(c.mortgage).toBe(k.price - k.downPayment);
    expect(c.downPaymentSharePct).toBe(Math.round((k.downPayment / k.price) * 100));
  });

  it('mortgage: opp-apt-001', () => {
    const c = computed('mortgage');
    const k = card('opp-apt-001');
    expect([c.price, c.downPayment, c.mortgage, c.loanPayment, c.rent]).toEqual([k.price, k.downPayment, k.mortgage, k.loanPayment, k.rent]);
    expect(c.cashFlow).toBe(k.rent - k.loanPayment);
  });

  it('yield: opp-apt-001', () => {
    const c = computed('yield');
    const k = card('opp-apt-001');
    expect(c.monthlyCashFlow).toBe(k.monthlyCashFlow);
    expect(c.yearly).toBe(k.monthlyCashFlow * 12);
    expect(c.downPayment).toBe(k.downPayment);
    expect(c.yieldOnDownPaymentPct).toBe(round1((c.yearly / k.downPayment) * 100));
    expect(c.yieldOnDownPaymentPct).toBe(round1(dealMetrics(k).yieldPct));
    expect(c.grossRentYieldOnPricePct).toBe(round1(((k.rent * 12) / k.price) * 100));
  });

  describe('payback and roi: opp-biz-006 and opp-apt-008', () => {
    const pairs = [['biz006', 'opp-biz-006'], ['apt008', 'opp-apt-008']];
    for (const [key, id] of pairs) {
      it(`${id}`, () => {
        const k = card(id);
        const p = computed('payback')[key];
        const r = computed('roi')[key];
        expect(p.downPayment).toBe(k.downPayment);
        expect(p.monthlyCashFlow).toBe(k.monthlyCashFlow);
        expect(p.yearly).toBe(k.monthlyCashFlow * 12);
        expect(p.paybackYears).toBe(round1(paybackYears(k.downPayment, k.monthlyCashFlow)));
        expect([r.downPayment, r.monthlyCashFlow, r.yearly, r.paybackYears]).toEqual([p.downPayment, p.monthlyCashFlow, p.yearly, p.paybackYears]);
        const roi = (p.yearly / k.downPayment) * 100;
        expect(r.roiPct).toBe(round1(roi));
        expect(r.roiPct).toBe(round1(dealMetrics(k).yieldPct));
        // one number, two views: years = 100 / roi% (unrounded ROI)
        expect(round1(100 / roi)).toBe(p.paybackYears);
      });
    }
    it('the texts contain the formatted figures', () => {
      const text = concept('payback').example.text;
      for (const [key, id] of pairs) {
        const p = computed('payback')[key];
        expect(text).toContain(moneyText(p.downPayment));
        expect(text).toContain(String(p.paybackYears));
      }
      expect(text).toContain(moneyText(computed('payback').biz006.yearly));
      const roiText = concept('roi').example.text;
      expect(roiText).toContain(`${computed('roi').biz006.roiPct}%`);
      expect(roiText).toContain(`${computed('roi').apt008.roiPct}%`);
    });
    it('the link sentence matches the two values it states', () => {
      const biz = computed('roi').biz006;
      const sentence = `${biz.roiPct}% בשנה = כ-${biz.paybackYears} שנים`;
      expect(concept('payback').link).toContain(sentence);
      expect(concept('roi').link).toContain(sentence);
      expect(concept('roi').family.link).toContain(sentence);
      expect(concept('payback').family.link ?? '').toContain(sentence);
    });
    it('the traffic light slots equal the config and the tiers agree', () => {
      expect([PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS]).toEqual([8, 14]);
      expect(paybackTier(paybackYears(card('opp-biz-006').downPayment, card('opp-biz-006').monthlyCashFlow))).toBe('ok');
      expect(paybackTier(paybackYears(card('opp-apt-008').downPayment, card('opp-apt-008').monthlyCashFlow))).toBe('bad');
      expect(yearsPhrase(3.7)).toContain('3.7');
    });
  });

  it('interest: loanTerms(5000) and per thousand', () => {
    const c = computed('interest');
    const t = loanTerms(c.amount);
    expect(c.monthlyPayment).toBe(t.monthly);
    expect(c.perYear).toBe(t.perYear);
    expect(c.interest).toBe(t.perPayday);
    expect(c.total).toBe(t.totalAtPayday);
    expect(c.rateNominalPct).toBe(Math.round(LOAN_PAYMENT_RATE * 12 * 100));
    const k = loanTerms(1000);
    expect(c.perThousand).toEqual({ monthly: k.monthly, perSummary: k.perPayday, total: k.totalAtPayday });
  });

  it('dividend: the three stocks', () => {
    const c = computed('dividend');
    for (const [sym, id] of [['ELM', 'opp-stk-001'], ['MAV', 'opp-stk-002'], ['SOL', 'opp-stk-003']]) {
      const k = card(id);
      expect(k.symbol).toBe(sym);
      expect([c[sym].price, c[sym].dividend]).toEqual([k.price, k.dividend]);
    }
    const m = c.MAV;
    expect(m.cost).toBe(m.qty * m.price);
    expect(m.monthly).toBe(m.qty * m.dividend);
    expect(m.yearly).toBe(m.monthly * 12);
    expect(m.dividendPctOfPrice).toBe(round1(((m.dividend * 12) / m.price) * 100));
  });

  it('cushion: exp-002 against teacher and cook savings', () => {
    const c = computed('cushion');
    const e = card('exp-002');
    expect(c.expense).toBe(e.amount);
    expect(c.teacherSavings).toBe(prof('teacher').savings);
    expect(c.teacherLeft).toBe(c.teacherSavings - c.expense);
    expect(c.cookSavings).toBe(prof('cook').savings);
    expect(c.cookShort).toBe(c.expense - c.cookSavings);
  });

  it('net_worth: teacher', () => {
    const c = computed('net_worth');
    const t = prof('teacher');
    expect(c.savings).toBe(t.savings);
    expect(c.debts).toBe(sum(t.liabilities, (l) => l.principal));
    expect(c.netWorth).toBe(c.savings - c.debts);
  });

  it('diversification: ELM before and after the rainy winter', () => {
    const c = computed('diversification');
    expect(c.ELMprice).toBe(card('opp-stk-001').price);
    expect(c.ELMafterRainyWinter).toBe(card('mkt-009').newPrice);
    expect(c.drop).toBe(c.ELMprice - c.ELMafterRainyWinter);
  });

  it('no concept uses the ROI term except roi; payback is called תקופת החזר', () => {
    expect(glossary.concepts.filter((c) => c.term === 'החזר השקעה').map((c) => c.id)).toEqual(['roi']);
    expect(concept('payback').term).toBe('תקופת החזר');
  });
});

describe('real-world facts with computed numbers', () => {
  const rw = read('../src/data/learn/real-world.he.json');
  const check = (id, c, k) => {
    if (c.paybackYears != null) expect(c.paybackYears, `${id} payback`).toBe(round1(paybackYears(k.downPayment, k.monthlyCashFlow)));
    if (c.cashFlow != null) expect(c.cashFlow, `${id} cashFlow`).toBe(k.monthlyCashFlow);
    if (c.downPayment != null) expect(c.downPayment, `${id} down`).toBe(k.downPayment);
    if (c.price != null) expect(c.price, `${id} price`).toBe(k.price);
    if (c.rent != null) expect(c.rent, `${id} rent`).toBe(k.rent);
    if (c.profit != null) expect(c.profit, `${id} profit`).toBe(k.profit);
    if (c.loanPayment != null) expect(c.loanPayment, `${id} loanPayment`).toBe(k.loanPayment);
    if (c.yearly != null) expect(c.yearly, `${id} yearly`).toBe(k.monthlyCashFlow * 12);
    if (c.rentYear != null) expect(c.rentYear, `${id} rentYear`).toBe(k.rent * 12);
    if (c.grossYieldPct != null) expect(c.grossYieldPct, `${id} grossYield`).toBe(round1(((k.rent * 12) / k.price) * 100));
    if (c.dividendPctOfPrice != null) expect(c.dividendPctOfPrice, `${id} dividend%`).toBe(round1(((k.dividend * 12) / k.price) * 100));
  };
  it('every computed block matches the card it names', () => {
    let checked = 0;
    for (const f of rw.facts) {
      const c = f.computed;
      if (!c || !f.cardIds?.length) continue;
      if (f.cardIds.length === 1) { check(f.id, c, card(f.cardIds[0])); checked += 1; continue; }
      for (const [key, sub] of Object.entries(c)) {
        const m = key.match(/^(apt|biz|stk)(\d+)$/);
        const k = m ? card(`opp-${m[1]}-${m[2]}`) : cards.find((x) => x.symbol === key);
        if (k && sub && typeof sub === 'object') { check(`${f.id}.${key}`, sub, k); checked += 1; }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });
});
