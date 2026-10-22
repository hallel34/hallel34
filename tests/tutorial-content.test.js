// The educator's hand-computed figures (the `computed` blocks and the sample sentences of tutorial.he.json) are recomputed here
// from the game data (professions, cards, loanTerms, config) and must match. A new `computed` block without a verifier fails too.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, loanTerms, PAYDAY_MONTHS, totalExpenses, loanPayments, passiveIncome, monthlyCashFlow, paybackYears, LOAN_PAYMENT_RATE,
} from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';
import { moneyText } from '../src/ui/format.js';
import { yearsPhrase, fillSlots } from '../src/learn/slots.js';
import { storyFigures, summaryFigures } from '../src/learn/tutorial.js';

const raw = JSON.parse(readFileSync(new URL('../src/data/learn/tutorial.he.json', import.meta.url), 'utf8'));
const data = loadData('he');
const engine = createEngine(data);
const card = (id) => data.cards.find((c) => c.id === id);
const pro = (id) => data.professions.find((p) => p.id === id);
const game = (id) => engine.newGame({ mode: 'family', professionId: id, seed: 1 });
const M = moneyText;

const teacher = game('teacher');
const T = {
  salary: pro('teacher').salary,
  fixed: pro('teacher').expenses.reduce((a, e) => a + e.amount, 0),
  debts: loanPayments(teacher),
  expenses: totalExpenses(teacher),
};
const cart = card('opp-biz-006');
const apt = card('opp-apt-004');
const flowWith = (passive) => T.salary + passive - T.expenses;
const hint = (id) => raw.hints.items.find((h) => h.id === id);

/** path of a `computed` block -> the values recomputed from the data (only the keys listed are compared). */
const VERIFY = {
  'story.screens.s1-passive.example.computed': () => ({ downPayment: cart.downPayment, profit: cart.profit, loanPayment: cart.loanPayment, monthlyCashFlow: cart.monthlyCashFlow }),
  'story.screens.s2-expenses.example.computed': () => ({ fixed: T.fixed, debts: T.debts, expenses: T.expenses, salary: T.salary, leftEachMonth: flowWith(0) }),
  'story.screens.s3-freedom.example.computed': () => ({ expenses: T.expenses, cart: cart.monthlyCashFlow, left: T.expenses - cart.monthlyCashFlow }),
  'story.screens.s4-loan.example.computed': () => { const l = loanTerms(10000); return { amount: 10000, monthly: l.monthly, perSummary: l.perPayday, totalIfRepaidAtSummary: l.totalAtPayday }; },
  'story.screens.s5-turn.example.computed': () => ({
    rent: apt.rent, loanPayment: apt.loanPayment, passive: apt.rent - apt.loanPayment, salary: T.salary, expenses: T.expenses,
    monthly: flowWith(apt.monthlyCashFlow), months: PAYDAY_MONTHS, amount: flowWith(apt.monthlyCashFlow) * PAYDAY_MONTHS,
  }),
  'terms.salary.computed': () => ({ salary: T.salary }),
  'terms.passive_income.computed': () => ({ monthlyCashFlow: cart.monthlyCashFlow }),
  'terms.expenses.computed': () => ({ expenses: T.expenses, debts: T.debts }),
  'terms.freedom.computed': () => ({ expenses: T.expenses }),
  'terms.loan.computed': () => ({ amount: 10000, monthly: loanTerms(10000).monthly }),
  'terms.interest.computed': () => ({ amount: 1000, monthly: loanTerms(1000).monthly }),
  'terms.cash.computed': () => ({ cash: pro('teacher').savings }),
  'terms.summary.computed': () => ({ monthly: flowWith(0), months: PAYDAY_MONTHS, amount: flowWith(0) * PAYDAY_MONTHS }),
  'check.questions.q-passive.computed': () => ({ cart: cart.monthlyCashFlow }),
  'check.questions.q-loan.computed': () => ({ amount: 10000, monthly: loanTerms(10000).monthly }),
  'check.questions.q-bigloan.computed': () => ({
    perThousand: loanTerms(1000).monthly, loan: 100000, monthly: loanTerms(100000).monthly, teacherFlow: flowWith(0), teacherLeft: flowWith(0) - loanTerms(100000).monthly,
    bigger150000Monthly: loanTerms(150000).monthly, bigger150000Left: flowWith(0) - loanTerms(150000).monthly,
  }),
  'hints.items.h-summary.example.computed': () => ({ monthly: flowWith(0), months: PAYDAY_MONTHS, amount: flowWith(0) * PAYDAY_MONTHS }),
  'hints.items.h-summary-income.example.computed': () => ({ passive: apt.monthlyCashFlow, months: PAYDAY_MONTHS, passiveTotal: apt.monthlyCashFlow * PAYDAY_MONTHS }),
  'hints.items.h-card.example.computed': () => ({ downPayment: cart.downPayment, monthly: cart.monthlyCashFlow, years: Math.round(paybackYears(cart.downPayment, cart.monthlyCashFlow) * 10) / 10 }),
  'hints.items.h-loan.example.computed': () => { const l = loanTerms(10000); return { amount: 10000, monthlyPayment: l.monthly, perSummary: l.perPayday, perThousandMonthly: loanTerms(1000).monthly }; },
  'hints.items.h-expense-paid.example.computed': () => ({ amount: card('exp-002').amount, cash: pro('teacher').savings, cashLeft: pro('teacher').savings - card('exp-002').amount }),
  'hints.items.h-expense-loan.example.computed': () => ({ amount: card('exp-002').amount, cash: pro('cook').savings, short: card('exp-002').amount - pro('cook').savings }),
  'hints.items.h-meter.example.computed': () => ({ passive: cart.monthlyCashFlow, expenses: T.expenses, left: T.expenses - cart.monthlyCashFlow, pct: Math.round((cart.monthlyCashFlow / T.expenses) * 100) }),
  'summaryBreakdown.example.computed': () => ({
    salary: T.salary, passive: apt.monthlyCashFlow, expenses: T.expenses, monthly: flowWith(apt.monthlyCashFlow), amount: flowWith(apt.monthlyCashFlow) * PAYDAY_MONTHS,
    noAssetMonthly: flowWith(0), noAssetAmount: flowWith(0) * PAYDAY_MONTHS,
  }),
  'hudFamily.example.computed': () => ({ income: T.salary + apt.monthlyCashFlow, out: T.expenses, monthly: flowWith(apt.monthlyCashFlow) }),
  'parentCard.computed': () => ({ loan: 10000, monthly: loanTerms(10000).monthly }),
};

function* computedPaths(v, path = []) {
  // list items are addressed by their id (adding or moving a hint / term / screen never shifts the verifiers)
  if (Array.isArray(v)) { for (const [i, x] of v.entries()) yield* computedPaths(x, [...path, typeof x?.id === 'string' ? x.id : i]); return; }
  if (!v || typeof v !== 'object') return;
  for (const [k, x] of Object.entries(v)) {
    if (k === 'notes') continue;
    if (k === 'computed') yield [[...path, k].join('.'), x];
    else yield* computedPaths(x, [...path, k]);
  }
}

describe('tutorial.he.json: the hand-computed figures equal the game data', () => {
  it('every computed block has a verifier (and every verifier a block)', () => {
    const found = [...computedPaths(raw)].map(([p]) => p).sort();
    expect(found).toEqual(Object.keys(VERIFY).sort());
  });

  for (const [path, expected] of Object.entries(VERIFY)) {
    it(`computed ${path}`, () => {
      const block = [...computedPaths(raw)].find(([p]) => p === path)?.[1];
      const want = expected();
      for (const [k, v] of Object.entries(want)) expect(block[k], `${path}.${k}`).toBe(v);
    });
  }

  it('the interest rule behind the numbers is the configured 1% a month', () => {
    expect(LOAN_PAYMENT_RATE).toBe(0.01);
    expect(loanTerms(10000)).toMatchObject({ monthly: 100, perPayday: 2400, totalAtPayday: 12400 });
    expect(T.expenses).toBe(7310);
    expect(flowWith(apt.monthlyCashFlow) * PAYDAY_MONTHS).toBe(98160);
  });

  it('card cash flow = rent|profit minus the loan payment (the 2,600 is already net of the mortgage)', () => {
    expect(apt.rent - apt.loanPayment).toBe(apt.monthlyCashFlow);
    expect(cart.profit - cart.loanPayment).toBe(cart.monthlyCashFlow);
  });
});

describe('tutorial.he.json: the sample sentences equal the templates filled with the real figures', () => {
  const money = (n) => M(n);
  const slotsStory = () => {
    const f = storyFigures(teacher, data.cards);
    return {
      profession: f.profession, expenses: money(f.expenses), debts: money(f.debts), salary: money(f.salary), monthly: money(f.monthly),
      passive: money(f.passive), months: String(f.months), amount: money(f.amount), left: money(f.left),
    };
  };
  it('story screen 2 (expenses), 3 (freedom) and 5 (when the money arrives)', () => {
    const f = slotsStory();
    const s = raw.story.screens;
    expect(fillSlots(s[1].example.text, f)).toBe(s[1].example.sampleText);
    // screen 3 quotes the cart's 900 as {monthly}
    expect(fillSlots(s[2].example.text, { ...f, monthly: money(cart.monthlyCashFlow) })).toBe(s[2].example.sampleText);
    // screen 5 is five short parts: the parts with figures equal their samples (the last two carry the sums)
    const parts = Object.fromEntries(s[4].parts.map((p) => [p.id, p]));
    expect(fillSlots(parts['p3-calc'].text, f)).toBe(parts['p3-calc'].sampleText);
    expect(fillSlots(parts['p4-times'].text, f)).toBe(parts['p4-times'].sampleText);
    expect(fillSlots(parts['p1-buy'].exampleText, f)).toBe(`${money(apt.monthlyCashFlow)} בחודש`);
  });
  it('story screens 1 and 4 quote fixed numbers that match the cart card and loanTerms(10000)', () => {
    const s = raw.story.screens;
    expect(s[0].example.text).toBe(`עגלת פופקורן ליד בית ספר: משלמים בהתחלה ${money(cart.downPayment)}, ואחר כך היא מכניסה ${money(cart.monthlyCashFlow)} בחודש.`);
    expect(s[0].example.footnote).toContain(money(cart.monthlyCashFlow));
    const l = loanTerms(10000);
    expect(s[3].example.fixed).toBe(true);
    expect(s[3].example.text).toBe(`לוקחים ${money(l.amount)}. כל חודש משלמים ${money(l.monthly)} תוספת, עד שמחזירים את ה-${money(l.amount)}. בשנתיים התוספת היא ${money(l.perPayday)}.`);
  });
  it('hint sentences', () => {
    const f = slotsStory();
    expect(fillSlots(hint('h-summary').variants.positive.text, { monthly: money(flowWith(0)), months: '24', amount: money(flowWith(0) * 24) })).toBe(hint('h-summary').example.sampleText);
    const inc = hint('h-summary-income');
    const incSlots = { passive: money(apt.monthlyCashFlow), months: '24', passiveTotal: money(apt.monthlyCashFlow * 24) };
    expect(`${inc.textAsset.apartment} ${fillSlots(inc.moreAsset.apartment, incSlots)}`).toBe(inc.example.sampleText);
    // the generic "more" line (the asset kind is unknown) reads the same figures
    expect(fillSlots(inc.more, incSlots)).toContain(money(apt.monthlyCashFlow));
    const card3 = hint('h-card');
    const y = yearsPhrase(paybackYears(cart.downPayment, cart.monthlyCashFlow));
    const slots = { downPayment: money(cart.downPayment), monthly: money(cart.monthlyCashFlow), years: y };
    // the numbered steps (the 'where does the money come from' step has no number): down payment, monthly flow, payback
    const steps = card3.steps.filter((st) => st.target !== 'hud-cash').map((st) => fillSlots(st.text, slots));
    expect(steps).toHaveLength(3);
    expect(card3.steps.map((st) => st.target)).toEqual(['downPayment', 'hud-cash', 'monthly', 'payback']);
    steps.forEach((st, i) => expect(st.startsWith(`${i + 1}. `)).toBe(true));
    expect(steps[0]).toContain(slots.downPayment);
    expect(steps[1]).toContain(slots.monthly);
    expect(steps[2]).toContain(y);
    const loan = hint('h-loan');
    const l = loanTerms(10000);
    expect(fillSlots(loan.text, { amount: money(10000), monthlyPayment: money(l.monthly) })).toBe(loan.example.sampleText);
    expect(fillSlots(loan.more, { perSummary: money(l.perPayday) })).toContain(money(l.perPayday));
    const paid = hint('h-expense-paid');
    expect(`${fillSlots(paid.text, { amount: money(7500) })} ${fillSlots('נשארו {x}.', { x: money(1500) })}`).toContain(paid.example.sampleText.split(' נשארו')[0]);
    expect(fillSlots(hint('h-meter').text, { passive: money(cart.monthlyCashFlow), expenses: money(T.expenses) })).toBe(hint('h-meter').example.sampleText.split(' עוד ')[0]);
    expect(f.left).toBe(money(T.expenses - cart.monthlyCashFlow));
  });
  it('summary card and HUD examples', () => {
    const sb = raw.summaryBreakdown;
    const withAsset = { salary: money(T.salary), passive: money(apt.monthlyCashFlow), expenses: money(T.expenses), monthly: money(flowWith(apt.monthlyCashFlow)), months: '24', amount: money(flowWith(apt.monthlyCashFlow) * 24) };
    expect(fillSlots(sb.oneLine, withAsset)).toBe(sb.example.sampleOneLine);
    expect(fillSlots(sb.oneLine, { ...withAsset, passive: money(0), monthly: money(flowWith(0)), amount: money(flowWith(0) * 24) })).toBe(sb.example.sampleNoAsset);
    const hud = raw.hudFamily;
    const sample = `כסף שנכנס בחודש: משכורת ${money(T.salary)} + כסף שעובד ${money(apt.monthlyCashFlow)} = ${money(T.salary + apt.monthlyCashFlow)}. כסף שיוצא בחודש: ${money(T.expenses)}. נשאר בחודש ${money(flowWith(apt.monthlyCashFlow))}.`;
    expect(sample).toBe(hud.example.sample);
  });
  it('the quiz explanations quote the real figures', () => {
    const q = raw.check.questions;
    expect(q[0].explain).toContain(money(cart.monthlyCashFlow));
    expect(q[1].explain).toContain(money(10000));
    expect(q[1].explain).toContain(money(loanTerms(10000).monthly));
    expect(q[2].explain).toContain(money(loanTerms(100000).monthly));
    expect(q[2].explain).toContain(money(flowWith(0)));
    expect(q[2].explain).toContain(money(flowWith(0) - loanTerms(100000).monthly));
    expect(raw.parentCard.answers[1]).toBe(`${money(loanTerms(10000).monthly)} בחודש, והחוב של ${money(10000)} נשאר עד שמחזירים אותו.`);
  });
});

describe('the figures the UI computes equal the educator\'s', () => {
  it('story figures for the teacher', () => {
    const f = storyFigures(teacher, data.cards);
    expect(f).toMatchObject({ salary: 8800, expenses: 7310, debts: 510, left: 6410, cart: 900, passive: 2600, monthly: 4090, amount: 98160 });
    expect(f.loan).toEqual({ amount: 10000, monthly: 100, perSummary: 2400, total: 12400 });
  });
  it('story figures follow the chosen profession', () => {
    for (const p of data.professions) {
      const s = game(p.id);
      const f = storyFigures(s, data.cards);
      expect(f.expenses).toBe(totalExpenses(s));
      expect(f.monthly).toBe(f.salary + 2600 - f.expenses);
      expect(f.amount).toBe(f.monthly * 24);
      expect(f.left).toBe(Math.max(0, f.expenses - 900));
    }
  });
  it('summaryFigures: salary + passive - expenses = monthly, monthly x 24 = amount', () => {
    const s = { ...teacher, assets: [{ ...apt, id: 'x', type: 'apartment' }] };
    const f = summaryFigures(s, { monthly: monthlyCashFlow(s), amount: monthlyCashFlow(s) * 24, months: 24 });
    expect(f).toMatchObject({ salary: 8800, passive: 2600, expenses: 7310, monthly: 4090, amount: 98160, check: true, negative: false, hasPassive: true });
    expect(passiveIncome(s)).toBe(2600);
  });
});
