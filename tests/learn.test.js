// Learning layer, phase B (docs/v2/learn/spec.md): ratings, decision records, guesses, concepts, feedback, report, markup,
// traffic-light thresholds, the real-world guard and the save migration.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  createEngine, loadData as _unused, serialize, deserialize, newMatch, SCHEMA_VERSION, LOAN_COSTLY_PAYMENT_SHARE, INVESTOR_EYE_STREAK,
  PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS, loanTerms, monthlyCashFlow, playGame, BOTS,
} from '../src/engine/index.js';
import {
  dealMetrics, loanRating, recordGuess, guessCorrect, investorStreak, guessForCard, buildReport, conversationOrder, unlockConcept,
  markShown, hasShown, diversifyKey, assetKinds, emptyLearn, guessTotals, largestSensibleLoan,
} from '../src/engine/learn.js';
import { loadData } from '../src/data/index.js';
import { parseMarkup, stripMarkup, termIds, hasMarkup } from '../src/i18n/markup.js';
import { t, tRaw, tp } from '../src/i18n/index.js';
import { learnContent, conceptList, conceptById, conceptsForMode, dictionaryOrder } from '../src/learn/content.js';
import { yearsValue, yearsPhrase, pctText, loanSlots, fillSlots, glossarySlots } from '../src/learn/slots.js';
import {
  GROUP_SLOTS, linesFor, pickLineIndex, renderFeedback, feedbackForChange, feedbackForEvent,
} from '../src/learn/feedback.js';
import { conceptsForTrigger, nextExplainer, enqueue } from '../src/learn/triggers.js';
import { revealModel, resultModel, eyeModel, guessOffered, stockNoteModel } from '../src/learn/guess.js';
import { reportView } from '../src/learn/report.js';
import { realWorldView, factForCard, factsForConcept } from '../src/learn/rw.js';
import { validateLearn } from '../src/learn/validate.js';
import { moneyText } from '../src/ui/format.js';

const data = loadData('he');
const engine = createEngine(data);
const card = (id) => structuredClone(data.cards.find((c) => c.id === id));
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const content = learnContent();

/** A teacher game with `cash` and the given opportunity card pending (the engine's own buy / pass / takeLoan then record). */
function withCard(id, { cash = 1_000_000, mode = 'family', seed = 5 } = {}) {
  const s = engine.newGame({ mode, professionId: 'teacher', seed });
  return { ...s, cash, pending: { kind: 'opportunity', card: card(id) }, phase: 'decision' };
}

describe('deal rating (spec section 2) and the numbers table of section 4', () => {
  const want = {
    'opp-apt-001': ['good', 4.9], 'opp-apt-003': ['good', 5.4], 'opp-apt-004': ['good', 4.5], 'opp-biz-006': ['good', 3.7],
    'opp-biz-007': ['good', 6.2], 'opp-biz-015': ['good', 7.4], 'opp-biz-012': ['bad', 17.9], 'opp-apt-012': ['bad', 22.2],
    'opp-apt-008': ['bad', 29.6], 'opp-apt-013': ['bad', 32.1], 'opp-apt-009': ['trap', null],
  };
  for (const [id, [tier, years]] of Object.entries(want)) {
    it(`${id} is ${tier}${years ? ` (${years} years)` : ''}`, () => {
      const m = dealMetrics(card(id));
      expect(m.tier).toBe(tier);
      expect(m.light).toBe({ good: 'green', ok: 'yellow', bad: 'red', trap: 'red' }[tier]);
      if (years) expect(Math.round(m.years * 10) / 10).toBe(years);
      else expect(m.years).toBe(Infinity);
    });
  }
  it('yield = cash flow x 12 / down payment, payback = down payment / (cash flow x 12)', () => {
    const c = card('opp-apt-001');
    const m = dealMetrics(c);
    expect(m.yieldPct).toBeCloseTo((c.monthlyCashFlow * 12 / c.downPayment) * 100, 9);
    expect(m.years).toBeCloseTo(c.downPayment / (c.monthlyCashFlow * 12), 9);
  });
  it('the yellow tier exists between the two thresholds', () => {
    const c = { downPayment: 100000, monthlyCashFlow: Math.round(100000 / (10 * 12)) }; // ~10 years
    expect(dealMetrics(c).tier).toBe('ok');
    expect(dealMetrics(c).light).toBe('yellow');
  });
});

describe('loan rating (spec 2.2): named config LOAN_COSTLY_PAYMENT_SHARE', () => {
  it('the share is a named parameter', () => expect(LOAN_COSTLY_PAYMENT_SHARE).toBe(0.5));
  const rich = (id) => withCard(id);
  it('apt-001 borrowing the whole down payment is costly, 100,000 is sensible', () => {
    const s = rich('opp-apt-001');
    const c = s.pending.card;
    expect(loanTerms(200000).monthly).toBe(2000);
    expect(loanRating(s, 200000, { card: c, spend: c.downPayment })).toBe('costly');
    expect(loanRating(s, 100000, { card: c, spend: c.downPayment })).toBe('sensible');
    // the largest sensible principal = share x F / rate = 50 x F
    expect(largestSensibleLoan(c.monthlyCashFlow, 0.01)).toBeCloseTo(170000, 6);
    expect(loanRating(s, 170000, { card: c, spend: c.downPayment })).toBe('sensible');
    expect(loanRating(s, 171000, { card: c, spend: c.downPayment })).toBe('costly');
  });
  it('biz-006 (F=900) borrowing the whole 40,000 is sensible (400 <= 450)', () => {
    const s = rich('opp-biz-006');
    expect(loanRating(s, 40000, { card: s.pending.card, spend: 40000 })).toBe('sensible');
  });
  it('apt-004 (F=2,600) borrowing the whole 140,000 is costly (1,400 > 1,300)', () => {
    const s = rich('opp-apt-004');
    expect(loanRating(s, 140000, { card: s.pending.card, spend: 140000 })).toBe('costly');
  });
  it('apt-008 (tier bad) is costly for any loan', () => {
    const s = rich('opp-apt-008');
    expect(loanRating(s, 1000, { card: s.pending.card, spend: s.pending.card.downPayment })).toBe('costly');
    expect(loanRating(s, 300000, { card: s.pending.card, spend: s.pending.card.downPayment })).toBe('costly');
  });
  it('a trap (negative cash flow) is costly', () => {
    const s = rich('opp-apt-009');
    expect(loanRating(s, 1000, { card: s.pending.card, spend: 1000 })).toBe('costly');
  });
  it('a loan whose next summary would end below zero is costly (risky)', () => {
    const s = { ...rich('opp-apt-001'), cash: 0 };
    const c = s.pending.card;
    expect(loanRating(s, 100000, { card: c, spend: c.downPayment })).toBe('costly'); // cash - spend is -100,000 and one summary cannot cover it
  });
  it('a voluntary loan: costly when the payment is more than half the positive cash flow, else sensible', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 2 });
    const cf = monthlyCashFlow(s); // 1,490
    expect(loanRating({ ...s, cash: 50000 }, 5000)).toBe('sensible'); // 50 <= 745
    expect(loanRating({ ...s, cash: 50000 }, 80000)).toBe('costly'); // 800 > 745
    expect(cf).toBeGreaterThan(0);
  });
});

describe('the engine records every decision (state.learn)', () => {
  it('a new game has an empty learn record', () => {
    expect(engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 }).learn).toEqual(emptyLearn());
  });
  it('buying a good deal: tier good, green; the record is JSON-safe', () => {
    const s = engine.buy(withCard('opp-apt-001'));
    const d = s.learn.decisions.at(-1);
    expect(d).toMatchObject({ kind: 'buy', cardId: 'opp-apt-001', type: 'apartment', tier: 'good', green: true, cf: 3400 });
    expect(d.years).toBeCloseTo(4.9, 1);
    expect(JSON.parse(JSON.stringify(s.learn))).toEqual(s.learn);
  });
  it('buying a trap stores years as null (Infinity is not JSON) and is not green', () => {
    const s = engine.buy(withCard('opp-apt-009'));
    const d = s.learn.decisions.at(-1);
    expect(d).toMatchObject({ tier: 'trap', years: null, green: false });
  });
  it('buy ok / bad: not green', () => {
    expect(engine.buy(withCard('opp-apt-008')).learn.decisions.at(-1)).toMatchObject({ tier: 'bad', green: false });
  });
  it('pass: green on a bad / trap deal, not green on a good one, not rated on an ok one; cash short = not rated', () => {
    expect(engine.pass(withCard('opp-apt-008')).learn.decisions.at(-1)).toMatchObject({ kind: 'pass', tier: 'bad', green: true });
    expect(engine.pass(withCard('opp-apt-009')).learn.decisions.at(-1)).toMatchObject({ tier: 'trap', green: true });
    expect(engine.pass(withCard('opp-apt-001')).learn.decisions.at(-1)).toMatchObject({ tier: 'good', green: false, afford: true });
    expect(engine.pass(withCard('opp-apt-001', { cash: 100 })).learn.decisions.at(-1)).toMatchObject({ tier: 'good', green: null, afford: false });
    const okCard = withCard('opp-apt-001');
    okCard.pending.card = { ...okCard.pending.card, downPayment: 100000, mortgage: 1700000, monthlyCashFlow: 833 }; // ~10 years
    expect(engine.pass(okCard).learn.decisions.at(-1)).toMatchObject({ tier: 'ok', green: null });
  });
  it('stocks: recorded with tier null and green null (never rated)', () => {
    const s = engine.buy(withCard('opp-stk-002', { mode: 'full' }), 10);
    expect(s.learn.decisions.at(-1)).toMatchObject({ kind: 'buy', type: 'stock', tier: null, green: null, qty: 10, symbol: 'MAV' });
    const p = engine.pass(withCard('opp-stk-002', { mode: 'full' }));
    expect(p.learn.decisions.at(-1)).toMatchObject({ kind: 'pass', type: 'stock', green: null });
  });
  it('a loan taken to buy an asset is rated and linked to the card; a voluntary loan is rated; a forced loan is not', () => {
    const c = card('opp-apt-001');
    const buyState = { ...withCard('opp-apt-001', { cash: 100000 }) };
    const s1 = engine.takeLoan(buyState, 100000); // within the cap of 12 salaries
    expect(s1.learn.decisions.at(-1)).toMatchObject({ kind: 'loan', purpose: 'purchase', cardId: c.id, rating: 'sensible', green: true });
    const bad = { ...withCard('opp-apt-008', { cash: 100000 }) };
    expect(engine.takeLoan(bad, 50000).learn.decisions.at(-1)).toMatchObject({ purpose: 'purchase', rating: 'costly', green: false });
    const v = engine.takeLoan({ ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), cash: 50000 }, 5000);
    expect(v.learn.decisions.at(-1)).toMatchObject({ purpose: 'voluntary', rating: 'sensible', green: true });
    const exp = { ...engine.newGame({ mode: 'family', professionId: 'cook', seed: 3 }), cash: 0 };
    const withExpense = { ...exp, pending: { kind: 'expense', card: card('exp-002'), amount: 7500 }, phase: 'mustPay' };
    const paid = engine.takeLoan(withExpense, 8000);
    const [loanDecision, expenseDecision] = paid.learn.decisions.slice(-2);
    expect(loanDecision).toMatchObject({ kind: 'loan', purpose: 'forced', rating: null, green: null });
    expect(expenseDecision).toMatchObject({ kind: 'expense', viaLoan: true, loanAmount: 8000, green: false });
  });
  it('an expense paid from cash is green (cushion)', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 9 });
    s = { ...s, cash: 500000 };
    let found = null;
    for (let i = 0; i < 80 && !found && s.status === 'playing'; i++) {
      if (s.phase === 'roll') s = engine.roll(s);
      else if (s.pending?.kind === 'opportunity') s = engine.pass(s);
      else if (s.pending?.kind === 'charity') s = engine.declineCharity(s);
      else break;
      found = s.learn.decisions.find((d) => d.kind === 'expense');
    }
    expect(found).toMatchObject({ kind: 'expense', viaLoan: false, green: true });
  });
  it('a repayment event carries the monthly payment that disappears', () => {
    const s = engine.takeLoan({ ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), cash: 50000 }, 5000);
    const id = s.liabilities.find((l) => l.kind === 'loan').id;
    const r = engine.repayLoan(s, id, 2000);
    expect(r.events.find((e) => e.type === 'repaid')).toMatchObject({ amount: 2000, saved: 20 });
  });
  it('multiplayer: every player keeps their own learn record', () => {
    let m = newMatch(engine, { mode: 'family', seed: 3, players: [{ professionId: 'teacher' }, { professionId: 'cook' }] });
    expect(m.players.map((p) => p.state.learn)).toEqual([emptyLearn(), emptyLearn()]);
    const a = engine.pass(withCard('opp-apt-008'));
    m = { ...m, players: [{ ...m.players[0], state: a }, m.players[1]] };
    expect(m.players[0].state.learn.decisions).toHaveLength(1);
    expect(m.players[1].state.learn.decisions).toHaveLength(0);
  });
  it('bots ignore the learning layer: the same seed plays the same game, and decisions are recorded without changing it', () => {
    const run = () => playGame(engine, engine.newGame({ mode: 'full', professionId: 'engineer', seed: 21 }), 'sensible');
    const a = run();
    const b = run();
    const strip = (s) => { const { learn, ...rest } = s; return rest; };
    expect(strip(a)).toEqual(strip(b));
    expect(a.learn.decisions.length).toBeGreaterThan(0);
  });
});

describe('save schema 3 and migration', () => {
  it('the schema is 3 and a round trip keeps the learn record', () => {
    expect(SCHEMA_VERSION).toBe(3);
    let m = newMatch(engine, { mode: 'family', seed: 3, players: [{ professionId: 'teacher' }] });
    m = { ...m, players: [{ ...m.players[0], state: unlockConcept(markShown(engine.buy(withCard('opp-apt-001')), 'x'), 'yield') }] };
    const back = deserialize(serialize(m));
    expect(back.players[0].state.learn.decisions).toHaveLength(1);
    expect(back.players[0].state.learn.concepts).toEqual(['yield']);
    expect(back.players[0].state.learn.shown).toEqual(['x']);
  });
  it('a schema 2 save (no learn) loads with an empty record, per player', () => {
    const m = newMatch(engine, { mode: 'family', seed: 3, players: [{ professionId: 'teacher' }, { professionId: 'cook' }] });
    const old = JSON.parse(serialize(m));
    old.schemaVersion = 2;
    for (const p of old.players) { delete p.state.learn; p.state.schemaVersion = 2; }
    const back = deserialize(JSON.stringify(old));
    expect(back.schemaVersion).toBe(3);
    expect(back.players.map((p) => p.state.learn)).toEqual([emptyLearn(), emptyLearn()]);
    expect(back.players[0].state.profession.id).toBe('teacher');
  });
  it('a schema 1 save (a bare state) migrates through 2 to 3', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 4 });
    const v1 = { ...s, schemaVersion: 1 };
    delete v1.learn;
    const back = deserialize(JSON.stringify(v1));
    expect(back.schemaVersion).toBe(3);
    expect(back.players[0].state.learn).toEqual(emptyLearn());
  });
  it('an old game that has no interestPaid still reports without that section', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 4 });
    delete s.stats.interestPaid;
    expect(buildReport(s).interest.available).toBe(false);
  });
});

describe('guesses: correct / wrong / yellow / skipped and the investor-eye streak', () => {
  it('green -> good is right, red -> bad is right, yellow and skipped count for nothing', () => {
    expect(guessCorrect('green', 'good')).toBe(true);
    expect(guessCorrect('green', 'bad')).toBe(false);
    expect(guessCorrect('red', 'bad')).toBe(true);
    expect(guessCorrect('red', 'good')).toBe(false);
    expect(guessCorrect('yellow', 'good')).toBeNull();
    expect(guessCorrect('yellow', 'bad')).toBeNull();
    expect(guessCorrect('green', 'skip')).toBeNull();
  });
  it('streak: wrong resets it, yellow and skipped leave it, INVESTOR_EYE_STREAK in a row earns the badge', () => {
    const g = (correct) => ({ correct });
    expect(investorStreak([g(true), g(true), g(null), g(true)])).toBe(3);
    expect(investorStreak([g(true), g(true), g(false), g(true)])).toBe(1);
    expect(INVESTOR_EYE_STREAK).toBe(3);
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    for (let i = 0; i < 3; i++) s = recordGuess(s, { cardId: `c${i}`, light: 'green', guess: 'good' });
    const eye = eyeModel(s.learn.guesses);
    expect(eye).toMatchObject({ streak: 3, earned: true, justEarned: true });
    expect(eyeModel(s.learn.guesses, { wasEarned: true }).justEarned).toBe(false);
    expect(guessTotals(s.learn.guesses)).toEqual({ right: 3, of: 3 });
  });
  it('a guess is per open card: a reload finds the guess already made (no second try)', () => {
    let s = { ...withCard('opp-apt-001') };
    expect(guessForCard(s, 'opp-apt-001')).toBeNull();
    s = recordGuess(s, { cardId: 'opp-apt-001', light: 'green', guess: 'good' });
    expect(guessForCard(s, 'opp-apt-001')).toMatchObject({ guess: 'good', correct: true });
    expect(guessForCard(s, 'opp-apt-002')).toBeNull();
  });
  it('the guess is offered for apartments and businesses only, never stocks, and only when the setting is on', () => {
    expect(guessOffered(card('opp-apt-001'), true)).toBe(true);
    expect(guessOffered(card('opp-biz-006'), true)).toBe(true);
    expect(guessOffered(card('opp-stk-001'), true)).toBe(false);
    expect(guessOffered(card('opp-apt-001'), false)).toBe(false);
  });
  it('every red / trap card gets verdict.red or verdict.redNever; stock cards never get a light', () => {
    for (const c of data.cards.filter((x) => x.deck === 'opportunity' && x.type !== 'stock')) {
      const m = dealMetrics(c);
      const r = revealModel(c, { seed: 1 });
      expect(r.light, c.id).toBe(m.light);
      if (m.tier === 'trap') expect(content.guess.verdict.redNever, c.id).toContain(r.verdict);
      else if (m.light === 'red') expect(r.verdict, c.id).not.toContain('{');
      expect(r.legend, c.id).not.toMatch(/\{\w+\}/);
    }
    for (const c of data.cards.filter((x) => x.type === 'stock')) expect(guessOffered(c, true), c.id).toBe(false);
  });
  it('the reveal shows the engine numbers (yield %, payback years) and the light has a text label', () => {
    const r = revealModel(card('opp-apt-001'), { seed: 1 });
    expect(r.yieldText).toBe('18.4%'.replace('18.4', '20.4'));
    expect(r.paybackText).toBe('4.9 שנים');
    expect(r.light).toBe('green');
    expect(r.label).toBe(content.guess.lights.green.label);
    expect(r.a11y).toBe(content.guess.lights.green.a11y);
    expect(r.legend).toContain(yearsPhrase(PAYBACK_OK_YEARS));
  });
  it('result lines: correct / wrong / yellowAny / skipped come from guess.he.json', () => {
    expect(resultModel('green', 'good', { seed: 1 }).kind).toBe('correct');
    expect(resultModel('green', 'bad', { seed: 1 }).kind).toBe('wrong');
    expect(resultModel('yellow', 'good', { seed: 1 }).kind).toBe('yellowAny');
    expect(resultModel('red', 'skip', { seed: 1 }).kind).toBe('skipped');
    expect(content.guess.guessResult.correct).toContain(resultModel('red', 'bad', { seed: 7 }).text);
  });
});

describe('traffic-light thresholds come from the config (no typed numbers)', () => {
  beforeEach(() => { vi.resetModules(); });
  it('changing PAYBACK_OK_YEARS / PAYBACK_SLOW_YEARS changes the light of a fixed card and the legend text', async () => {
    const real = await import('../src/engine/config.js');
    vi.doMock('../src/engine/config.js', () => ({ ...real, PAYBACK_OK_YEARS: 3, PAYBACK_SLOW_YEARS: 5 }));
    const g = await import('../src/learn/guess.js');
    const m = await import('../src/engine/learn.js');
    const c = structuredClone(data.cards.find((x) => x.id === 'opp-apt-001')); // 4.9 years
    expect(m.dealMetrics(c).light).toBe('yellow');
    const r = g.revealModel(c, { seed: 1 });
    expect(r.light).toBe('yellow');
    expect(r.legend).toContain('3 שנים');
    expect(r.legend).toContain('5 שנים');
    vi.doUnmock('../src/engine/config.js');
    vi.resetModules();
    const g2 = await import('../src/learn/guess.js');
    const r2 = g2.revealModel(c, { seed: 1 });
    expect(r2.light).toBe('green');
    expect(r2.legend).toContain(`${PAYBACK_OK_YEARS} שנים`);
    expect(r2.legend).not.toBe(r.legend);
  });
  it('no learn text types a threshold or a rate (only {okYears} {slowYears} {rate} ... slots)', () => {
    for (const l of Object.values(content.guess.lights)) expect(`${l.label} ${l.legend}`).not.toMatch(/\d/);
    for (const g of ['loan.sensible', 'loan.costly', 'expense.loan']) for (const line of Object.values(content.feedback.lines[g]).flat()) expect(line, g).not.toMatch(/\d/);
  });
});

describe('years and percent slots', () => {
  it('years: one decimal, plural phrase, never crossing a light threshold', () => {
    expect(yearsPhrase(1)).toBe('שנה אחת');
    expect(yearsPhrase(2)).toBe('שנתיים');
    expect(yearsPhrase(4.9019)).toBe('4.9 שנים');
    expect(yearsPhrase(8.04)).toBe('8.1 שנים'); // yellow, so it can never read "8"
    expect(yearsValue(8)).toBe(8);
    expect(yearsPhrase(14.02)).toBe('14.1 שנים');
    expect(yearsPhrase(29.6)).toBe('29.6 שנים');
  });
  it('percent: one decimal at most', () => {
    expect(pctText(20.4)).toBe('20.4%');
    expect(pctText(12)).toBe('12%');
    expect(pctText(3.6)).toBe('3.6%');
  });
});

describe('slot rendering (spec 2.1)', () => {
  it('loan slots are loanTerms(): monthly, interest per summary, total only if repaid at the summary, nominal rate', () => {
    const s5 = loanSlots(5000);
    expect(s5).toEqual({ amount: '₪5,000', loanAmount: '₪5,000', monthlyPayment: '₪50', interest: '₪1,200', total: '₪6,200', rate: '12%' });
    const s1 = loanSlots(1000);
    expect([s1.monthlyPayment, s1.interest, s1.total]).toEqual(['₪10', '₪240', '₪1,240']);
    const exp = loanSlots(8000, { amount: 7500 });
    expect(exp.amount).toBe('₪7,500');
    expect(exp.loanAmount).toBe('₪8,000');
  });
  it('every sentence that shows {total} says "אם תפרעו" / "אם מחזירים" and the next summary', () => {
    for (const [g, v] of Object.entries(content.feedback.lines)) {
      for (const line of Object.values(v).flat()) {
        if (!line.includes('{total}')) continue;
        expect(/אם (תפרעו|מחזירים|תחזירו)/.test(line), `${g}: ${line}`).toBe(true);
        expect(line.includes('בסיכום הקרוב') || line.includes('הסיכום הבא'), `${g}: ${line}`).toBe(true);
      }
    }
  });
  it('every text of every group only uses slots its caller provides, for every mode', () => {
    for (const [group, v] of Object.entries(content.feedback.lines)) {
      const provided = new Set(GROUP_SLOTS[group]);
      for (const [variant, lines] of Object.entries(v)) for (const line of lines) {
        for (const m of line.matchAll(/\{(\w+)\}/g)) expect(provided.has(m[1]), `${group}.${variant}: {${m[1]}} is not provided`).toBe(true);
      }
    }
  });
  it('a filled line has no {slot} left', () => {
    const slots = { title: 'דירה', years: '4.9 שנים', yield: '20.4%', monthly: '₪3,400', loss: '₪500', qty: '10', symbol: 'MAV', ...loanSlots(5000), cashLeft: '₪1,500', saved: '₪10', over: '25%', price: '₪300', passive: '₪1', expenses: '₪2' };
    for (const [group, v] of Object.entries(content.feedback.lines)) {
      for (const mode of ['family', 'full']) {
        const r = renderFeedback(content.feedback, { group, slots }, { mode, seed: 3, counter: 0 });
        if (!r) { expect(mode === 'family' && !v.family && !v.all, `${group}.${mode} has no lines`).toBe(true); continue; } // stock / market groups are full-mode only
        expect(r.text, `${group}.${mode}`).not.toMatch(/\{\w+\}/);
      }
    }
    expect(fillSlots('a {x} b', { x: 'ok' })).toBe('a ok b');
  });
  it('no learn text uses a hard-coded unit that should be a slot, and the old payday name is gone', () => {
    expect(JSON.stringify(content)).not.toContain('יום משכורת');
  });
});

describe('fallbacks and the deterministic rotation of phrasings', () => {
  it('lines[group][mode], else .all, else .family', () => {
    expect(linesFor(content.feedback, 'buy.good', 'full')).toEqual(content.feedback.lines['buy.good'].full);
    expect(linesFor(content.feedback, 'charity.donate', 'full')).toEqual(content.feedback.lines['charity.donate'].all);
    expect(linesFor(content.feedback, 'buy.stock', 'family')).toEqual(content.feedback.lines['buy.stock'].full === undefined ? [] : linesFor(content.feedback, 'buy.stock', 'family'));
    expect(linesFor({ lines: { x: { family: ['a'] } } }, 'x', 'full')).toEqual(['a']);
  });
  it('three phrasings rotate, never the same line twice in a row, and the same seed always gives the same sequence', () => {
    const seq = (seed) => Array.from({ length: 9 }, (_, i) => pickLineIndex(3, seed, 'buy.good', i));
    for (const seed of [1, 2, 99, 123456]) {
      const a = seq(seed);
      expect(a).toEqual(seq(seed));
      for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
      expect(new Set(a.slice(0, 3)).size).toBe(3);
    }
    expect(pickLineIndex(1, 5, 'x', 7)).toBe(0);
  });
  it('the engine and learn modules never call Math.random', () => {
    for (const f of ['src/engine/learn.js', 'src/engine/engine.js', 'src/learn/feedback.js', 'src/learn/guess.js', 'src/learn/report.js']) {
      const code = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.random/);
    }
  });
});

describe('feedback requests from what changed', () => {
  const run = (before, fn) => { const after = fn(before); return { before, after, req: feedbackForChange(before, after) }; };
  it('buy good -> buy.good with title, years, yield, monthly', () => {
    const { req } = run(withCard('opp-apt-001'), (s) => engine.buy(s));
    expect(req[0]).toMatchObject({ group: 'buy.good', pose: 'celebrate' });
    expect(req[0].slots).toMatchObject({ years: '4.9 שנים', yield: '20.4%', monthly: '₪3,400' });
  });
  it('buy bad / trap, pass good / neutral / bad / trap / cantAfford', () => {
    expect(run(withCard('opp-apt-008'), (s) => engine.buy(s)).req[0].group).toBe('buy.bad');
    expect(run(withCard('opp-apt-009'), (s) => engine.buy(s)).req[0]).toMatchObject({ group: 'buy.trap', pose: 'worried' });
    expect(run(withCard('opp-apt-001'), (s) => engine.pass(s)).req[0]).toMatchObject({ group: 'pass.goodDeal', pose: 'think' });
    expect(run(withCard('opp-apt-008'), (s) => engine.pass(s)).req[0].group).toBe('pass.bad');
    expect(run(withCard('opp-apt-009'), (s) => engine.pass(s)).req[0].group).toBe('pass.trap');
    expect(run(withCard('opp-apt-001', { cash: 10 }), (s) => engine.pass(s)).req[0].group).toBe('pass.cantAfford');
    expect(run(withCard('opp-stk-001', { mode: 'full' }), (s) => engine.pass(s)).req).toEqual([]);
  });
  it('buy stock -> buy.stock; loans -> loan.sensible / loan.costly; a forced loan says nothing, the expense says expense.loan', () => {
    expect(run(withCard('opp-stk-002', { mode: 'full' }), (s) => engine.buy(s, 10)).req[0]).toMatchObject({ group: 'buy.stock', slots: { qty: '10', symbol: 'MAV', monthly: '₪20' } });
    const s = { ...withCard('opp-apt-001', { cash: 100000 }) };
    expect(run(s, (x) => engine.takeLoan(x, 100000)).req[0].group).toBe('loan.sensible'); // the cap is 12 salaries
    expect(run({ ...withCard('opp-apt-008', { cash: 100000 }) }, (x) => engine.takeLoan(x, 50000)).req[0].group).toBe('loan.costly');
    const cook = { ...engine.newGame({ mode: 'family', professionId: 'cook', seed: 3 }), cash: 0 };
    const ex = { ...cook, pending: { kind: 'expense', card: card('exp-002'), amount: 7500 }, phase: 'mustPay' };
    const r = run(ex, (x) => engine.takeLoan(x, 8000));
    expect(r.req.map((q) => q.group)).toEqual(['expense.loan']);
    expect(r.req[0].slots).toMatchObject({ amount: '₪7,500', loanAmount: '₪8,000', monthlyPayment: '₪80', interest: '₪1,920', total: '₪9,920' });
  });
  it('repay, charity and a market offer', () => {
    const base = engine.takeLoan({ ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), cash: 50000 }, 5000);
    const id = base.liabilities.find((l) => l.kind === 'loan').id;
    expect(run(base, (x) => engine.repayLoan(x, id, 2000)).req[0]).toMatchObject({ group: 'loan.repaid', slots: { amount: '₪2,000', saved: '₪20' } });
    const ch = { ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), pending: { kind: 'charity', cost: 880 }, phase: 'decision' };
    expect(run(ch, (x) => engine.donate(x)).req[0].group).toBe('charity.donate');
    expect(run(ch, (x) => engine.declineCharity(x)).req[0].group).toBe('charity.skip');
  });
  it('diversification: a second kind of asset adds buy.diversify once per combination (the UI marks it shown)', () => {
    let s = engine.buy(withCard('opp-apt-001', { mode: 'full' }));
    const second = { ...s, pending: { kind: 'opportunity', card: card('opp-biz-006') }, phase: 'decision' };
    const after = engine.buy(second);
    const r = feedbackForChange(second, after);
    expect(r.map((q) => q.group)).toEqual(['buy.good', 'buy.diversify']);
    const key = r[1].mark;
    expect(key).toBe(diversifyKey(after));
    expect(assetKinds(after)).toEqual(['apartment', 'business']);
    const marked = markShown(after, key);
    expect(feedbackForChange(second, marked).map((q) => q.group)).toEqual(['buy.good']);
    expect(hasShown(marked, key)).toBe(true);
  });
  it('events of a roll: expense paid, baby, market cash and stock price', () => {
    const st = { cash: 1500 };
    expect(feedbackForEvent({ type: 'expensePaid', amount: 7500 }, st)[0]).toMatchObject({ group: 'expense.cushion', slots: { amount: '₪7,500', cashLeft: '₪1,500' } });
    expect(feedbackForEvent({ type: 'baby', extra: 700 }, st)[0].group).toBe('baby');
    expect(feedbackForEvent({ type: 'babyMax' }, st)[0].group).toBe('baby.max');
    expect(feedbackForEvent({ type: 'market', card: { effect: 'cash', amount: -300 } }, st)[0]).toMatchObject({ group: 'market.cashBad', slots: { amount: '₪300' } });
    expect(feedbackForEvent({ type: 'market', card: { effect: 'stockPrice', symbol: 'ELM', newPrice: 380 } }, st, { priorPrice: 500 })[0].group).toBe('market.priceDown');
    expect(feedbackForEvent({ type: 'market', card: { effect: 'stockPrice', symbol: 'ELM', newPrice: 600 } }, st, { priorPrice: 500 })[0].group).toBe('market.priceUp');
  });
});

describe('concepts: first-seen logic (spec 3)', () => {
  it('family mode knows 10 concepts, full mode 13; dividend, net worth and diversification are full only', () => {
    expect(conceptList()).toHaveLength(13);
    expect(conceptsForMode('family')).toHaveLength(10);
    expect(conceptsForMode('full')).toHaveLength(13);
    expect(conceptsForMode('family').map((c) => c.id)).not.toEqual(expect.arrayContaining(['dividend']));
    expect(conceptsForMode('full').filter((c) => c.level === 'full').map((c) => c.id).sort()).toEqual(['diversification', 'dividend', 'net_worth']);
  });
  it('the dictionary lists the mode concepts alphabetically', () => {
    const terms = dictionaryOrder('full').map((c) => c.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'he')));
  });
  it('triggers bring up the concepts of the spec table, in order', () => {
    expect(conceptsForTrigger('start', { mode: 'family' })).toEqual(['liability']);
    expect(conceptsForTrigger('statement', { mode: 'family' })).toEqual(['cashflow']);
    expect(conceptsForTrigger('statement', { mode: 'full' })).toEqual(['cashflow', 'net_worth']);
    expect(conceptsForTrigger('opportunity', { mode: 'family', card: card('opp-apt-001') })).toEqual(['passive_income', 'down_payment', 'mortgage']);
    expect(conceptsForTrigger('opportunity', { mode: 'full', card: card('opp-stk-001') })).toEqual(['passive_income', 'dividend']);
    expect(conceptsForTrigger('opportunity', { mode: 'family', card: card('opp-stk-001') })).toEqual(['passive_income']);
    expect(conceptsForTrigger('reveal', { mode: 'family' })).toEqual(['yield', 'payback']);
    expect(conceptsForTrigger('purchase', { mode: 'family' })).toEqual(['asset']);
    expect(conceptsForTrigger('expense', { mode: 'family' })).toEqual(['cushion']);
    expect(conceptsForTrigger('loan', { mode: 'family' })).toEqual(['interest']);
    expect(conceptsForTrigger('stockDrop', { mode: 'full' })).toEqual(['diversification']);
    expect(conceptsForTrigger('stockDrop', { mode: 'family' })).toEqual([]);
  });
  it('once per concept: seen concepts are skipped, one comes up at a time, in the order they were triggered', () => {
    const seen = new Set();
    let q = enqueue([], conceptsForTrigger('opportunity', { mode: 'family', card: card('opp-apt-001') }), seen);
    q = enqueue(q, conceptsForTrigger('reveal', { mode: 'family' }), seen);
    expect(q).toEqual(['passive_income', 'down_payment', 'mortgage', 'yield', 'payback']);
    const order = [];
    for (let turn = 0; turn < 6; turn++) {
      const id = nextExplainer(q, seen, 'family');
      if (!id) break;
      order.push(id); seen.add(id); q = q.filter((x) => x !== id);
    }
    expect(order).toEqual(['passive_income', 'down_payment', 'mortgage', 'yield', 'payback']);
    expect(enqueue([], ['yield'], new Set(['yield']))).toEqual([]); // never again on this device
    expect(nextExplainer(['dividend'], new Set(), 'family')).toBeNull(); // a full-only concept never shows in family mode
  });
  it('seen concepts persist on the device (passivo.learn.seen) and in the game state (learn.concepts)', async () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
    try {
      const { seenConcepts, markConceptSeen, earnBadge, hasBadge } = await import('../src/learn/store.js');
      expect(seenConcepts().size).toBe(0);
      expect(markConceptSeen('yield')).toBe(true);
      expect(markConceptSeen('yield')).toBe(false);
      expect(JSON.parse(store.get('passivo.learn.seen'))).toEqual(['yield']);
      expect(seenConcepts().has('yield')).toBe(true);
      expect(hasBadge('investor_eye')).toBe(false);
      expect(earnBadge('investor_eye')).toBe(true);
      expect(JSON.parse(store.get('passivo.learn.badges'))).toEqual({ investor_eye: 1 });
    } finally { delete globalThis.localStorage; }
    const s = unlockConcept(unlockConcept(engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 }), 'asset'), 'asset');
    expect(s.learn.concepts).toEqual(['asset']);
  });
  it('every concept has a short, a why and an example; examples render with no slot left', () => {
    for (const c of conceptList()) {
      expect(c.short.length, c.id).toBeGreaterThan(10);
      expect(c.why.length, c.id).toBeGreaterThan(10);
      const slots = glossarySlots(c);
      expect(fillSlots(c.example.text, slots), c.id).not.toMatch(/\{\w+\}/);
      if (c.gameSimplification) expect(fillSlots(c.gameSimplification, slots), c.id).not.toMatch(/\{\w+\}/);
    }
    expect(fillSlots(conceptById('interest').example.text, glossarySlots(conceptById('interest')))).toContain('₪6,200');
  });
});

describe('glossary markup [[term:id|display]]', () => {
  it('parses text, terms with and without a display, and several terms', () => {
    expect(parseMarkup('נכס שמכניס [[term:yield|תשואה]] טובה')).toEqual([{ text: 'נכס שמכניס ' }, { term: 'yield', display: 'תשואה' }, { text: ' טובה' }]);
    expect(parseMarkup('[[term:yield]]')).toEqual([{ term: 'yield', display: '' }]);
    expect(parseMarkup('a [[term:asset|נכס]] b [[term:mortgage|משכנתא]]').filter((p) => p.term).map((p) => p.term)).toEqual(['asset', 'mortgage']);
    expect(parseMarkup('plain')).toEqual([{ text: 'plain' }]);
    expect(hasMarkup('x [[term:a|b]]')).toBe(true);
    expect(termIds('[[term:cashflow|x]] and [[term:yield]]')).toEqual(['cashflow', 'yield']);
  });
  it('strips to the display text (or the glossary term when there is no display)', () => {
    expect(stripMarkup('שכירות − [[term:mortgage|משכנתא]] = [[term:cashflow|תזרים]]')).toBe('שכירות − משכנתא = תזרים');
    expect(stripMarkup('[[term:yield]]', (id) => `<${id}>`)).toBe('<yield>');
  });
  it('t() hands out plain text, tRaw() keeps the markup, plurals are stripped too', () => {
    expect(t('card.downPayment')).toBe('מקדמה');
    expect(tRaw('card.downPayment')).toBe('[[term:down_payment|מקדמה]]');
    expect(t('card.rentLine', { gross: 1, payment: 2, flow: 3 })).toBe('שכירות 1 − משכנתא 2 = תזרים 3');
    expect(tp('plural.years', 2)).toBe('שנתיים');
  });
  it('every [[term:id]] in the UI strings and the card data resolves to a glossary id', () => {
    const ids = new Set(conceptList().map((c) => c.id));
    const found = termIds(JSON.stringify(he)).concat(termIds(JSON.stringify(data.cards)), termIds(JSON.stringify(data.professions)));
    expect(found.length).toBeGreaterThan(10);
    for (const id of found) expect(ids.has(id), id).toBe(true);
  });
  it('markup is only in the strings meant for rich rendering, and every marked string still reads well as plain text', () => {
    const marked = [];
    const walk = (o, path) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') { if (hasMarkup(v)) marked.push([`${path}${k}`, v]); } else if (v && typeof v === 'object') walk(v, `${path}${k}.`); } };
    walk(he, '');
    for (const [key, v] of marked) { const plain = stripMarkup(v); expect(plain, key).not.toMatch(/\[\[|\]\]|term:/); }
    expect(marked.map(([k]) => k)).toEqual(expect.arrayContaining(['card.downPayment', 'card.mortgage', 'card.monthlyCashFlow', 'card.rentLine', 'statement.assets', 'statement.liabilities', 'loan.rateLine']));
  });
});

describe('report (L4)', () => {
  const dec = (over) => ({ turn: 1, kind: 'buy', cardId: 'x', title: 'נכס', type: 'apartment', tier: 'good', years: 4.9, yieldPct: 20.4, cf: 3400, green: true, ...over });
  const stateWith = (decisions, extra = {}) => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 2 });
    return { ...s, ...extra, learn: { ...emptyLearn(), decisions } };
  };
  it('best = shortest payback, worst = longest or negative; stocks are excluded', () => {
    const r = buildReport(stateWith([dec({ title: 'A', years: 4.9 }), dec({ title: 'B', years: 22, tier: 'bad', green: false }), dec({ title: 'C', years: 7, tier: 'good' }), dec({ type: 'stock', title: 'S', tier: null, years: undefined, green: null })]));
    expect(r.bestDeal.title).toBe('A');
    expect(r.worstDeal.title).toBe('B');
    expect(r.worstKind).toBe('slow');
    expect(r.dealCount).toBe(3);
  });
  it('a negative cash flow is the worst deal (negative template); one deal shows only the best; a good worst is "none"', () => {
    const neg = buildReport(stateWith([dec({ title: 'A' }), dec({ title: 'T', tier: 'trap', years: null, cf: -6000, green: false })]));
    expect(neg.worstDeal.title).toBe('T');
    expect(neg.worstKind).toBe('negative');
    const one = buildReport(stateWith([dec({})]));
    expect(one.worstDeal).toBeNull();
    expect(one.worstEmpty).toBe(false);
    const two = buildReport(stateWith([dec({ years: 4 }), dec({ years: 6 })]));
    expect(two.worstDeal).toBeNull();
    expect(two.worstEmpty).toBe(true);
    expect(buildReport(stateWith([])).bestDeal).toBeNull();
  });
  it('green decisions: all / none / some / noData', () => {
    expect(buildReport(stateWith([dec({}), dec({})])).green).toMatchObject({ kind: 'all', green: 2, total: 2 });
    expect(buildReport(stateWith([dec({ green: false })])).green.kind).toBe('none');
    expect(buildReport(stateWith([dec({}), dec({ green: false })])).green).toMatchObject({ kind: 'some', green: 1, total: 2 });
    expect(buildReport(stateWith([dec({ green: null })])).green.kind).toBe('noData');
    expect(buildReport(stateWith([])).green.kind).toBe('noData');
  });
  it('interest: stats.interestPaid, zero when no bank loan was ever taken', () => {
    expect(buildReport(stateWith([], { stats: { ...engine.newGame({ mode: 'family', professionId: 'teacher', seed: 2 }).stats, interestPaid: 4800, loansTaken: 1 } })).interest).toEqual({ available: true, amount: 4800, loansTaken: 1, none: false });
    expect(buildReport(stateWith([])).interest).toMatchObject({ available: true, amount: 0, none: true });
  });
  it('the tip follows the priority: highInterest > noCushion > manyRed > noDiversify > allGood > fallback', () => {
    const st = (decisions, stats = {}, extra = {}) => stateWith(decisions, { stats: { ...engine.newGame({ mode: 'family', professionId: 'teacher', seed: 2 }).stats, ...stats }, ...extra });
    expect(buildReport(st([], { interestPaid: 99999, loansTaken: 1 })).tip).toBe('highInterest'); // above one salary (8,800)
    expect(buildReport(st([], { loansTaken: 3 })).tip).toBe('highInterest');
    expect(buildReport(st([{ turn: 1, kind: 'expense', viaLoan: true, green: false }])).tip).toBe('noCushion');
    expect(buildReport(st([dec({ tier: 'bad', green: false }), dec({ tier: 'trap', green: false })])).tip).toBe('manyRed');
    const assets = [1, 2, 3].map((i) => ({ id: `a${i}`, type: 'apartment', monthlyCashFlow: 1 }));
    expect(buildReport(st([dec({})], {}, { mode: 'full', assets })).tip).toBe('noDiversify');
    expect(buildReport(st([dec({}), dec({}), dec({}), dec({}), dec({ green: false })])).tip).toBe('allGood'); // 80%
    expect(buildReport(st([dec({ green: false }), dec({})])).tip).toBe('fallback');
  });
  it('conversation: the theme follows the tip, the rest rotate by the seed, deterministically', () => {
    const themes = Object.keys(content.report.conversation.family);
    expect(conversationOrder('family', 'highInterest', themes, 0)[0]).toBe('borrow');
    expect(conversationOrder('family', 'noCushion', themes, 0)[0]).toBe('safety');
    expect(conversationOrder('family', 'fallback', themes, 0)[0]).toBe('flow');
    const fullThemes = Object.keys(content.report.conversation.full);
    expect(conversationOrder('full', 'noDiversify', fullThemes, 0)[0]).toBe('invest');
    expect(conversationOrder('full', 'manyRed', fullThemes, 0)[0]).toBe('realWorld');
    expect(conversationOrder('full', 'fallback', fullThemes, 0)[0]).toBe('strategy');
    expect(conversationOrder('family', 'fallback', themes, 7)).toEqual(conversationOrder('family', 'fallback', themes, 7));
    expect(new Set(conversationOrder('family', 'fallback', themes, 1))).toEqual(new Set(themes));
  });
  it('the view model: texts are filled, family gets 3 questions, concepts come from the game + device', () => {
    const s = stateWith([dec({ title: 'סטודיו', years: 4.9, yieldPct: 20.4 })], { status: 'won' });
    s.learn.concepts = ['asset'];
    const v = reportView(s, { seen: ['yield'], seed: 4 });
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/\{\w+\}/);
    expect(v.sections.find((x) => x.id === 'bestDeal').text).toBe('סטודיו: החזר תוך 4.9 שנים, תשואה של 20.4% בשנה.');
    expect(v.sections.find((x) => x.id === 'interest').text).toBe(content.report.sections.interest.zero);
    expect(v.sections.find((x) => x.id === 'concepts').unlocked.sort()).toEqual(['asset', 'yield']);
    expect(v.conversation.questions).toHaveLength(3);
    expect(v.subtitle).toBe(content.report.subtitle.win);
    expect(v.fox.text).toBeTruthy();
    const lost = reportView({ ...s, status: 'lost' }, { seed: 4 });
    expect(lost.subtitle).toBe(content.report.subtitle.lose);
  });
  it('a full-mode report also shows concepts unlocked in full only, and a different mode count', () => {
    const s = { ...stateWith([]), mode: 'full', status: 'won' };
    s.learn.concepts = ['dividend'];
    const v = reportView(s, { seed: 1 });
    expect(v.sections.find((x) => x.id === 'concepts').text).toContain('13');
    const f = reportView({ ...stateWith([]), status: 'won' }, { seed: 1 });
    expect(f.sections.find((x) => x.id === 'concepts').text).toContain(content.report.sections.concepts.none);
  });
});

describe('real world (L6): no unverified figure is ever shown', () => {
  const facts = content.realWorld.facts;
  const clean = (o) => JSON.stringify(o, (k, v) => (['numbers', 'sources', 'needs_review', 'notes', 'computed', 'status'].includes(k) ? undefined : v));
  const visibleText = clean({ g: content.glossary, f: content.feedback, r: content.report, q: content.guess, ui: content.realWorld.ui, facts: facts.map((f) => ({ game: f.game, real: f.real })) })
    + JSON.stringify(he) + JSON.stringify(data.cards);
  const tokens = (s) => [...String(s).matchAll(/(?<![\d.,])\d+(?:\.\d+)?%/g)].map((m) => m[0]);
  const hidden = [...new Set(facts.filter((f) => f.numbers).flatMap((f) => tokens(f.numbers.text)))].filter((x) => !tokens(visibleText).includes(x));

  it('there are hidden figures to guard (otherwise this test guards nothing)', () => {
    expect(hidden).toEqual(expect.arrayContaining(['2.5%', '8.2%', '3.25%', '4.75%']));
  });
  it('the view model of every fact is game + real + labels + disclaimer, never numbers (publish:false)', () => {
    for (const f of facts) {
      const v = realWorldView(f);
      const out = JSON.stringify(v);
      if (f.numbers) {
        expect(f.numbers.publish, f.id).toBe(false);
        expect(v.figure, f.id).toBeUndefined();
        expect(out, f.id).not.toContain(f.numbers.text);
        for (const x of tokens(f.numbers.text).filter((y) => hidden.includes(y))) expect(tokens(out), `${f.id} ${x}`).not.toContain(x);
      }
    }
    // the guard is real: flipping publish exposes the figure, so a test must keep failing the day someone does it by accident
    const flipped = realWorldView({ ...facts.find((f) => f.numbers), numbers: { ...facts.find((f) => f.numbers).numbers, publish: true } });
    expect(flipped.figure).toBeTruthy();
  });
  it('no visible UI text (strings, card data, learn texts, dictionary entries) contains a hidden figure', () => {
    for (const x of hidden) expect(tokens(visibleText), x).not.toContain(x);
    for (const c of conceptList()) {
      const entry = JSON.stringify([c.short, c.why, c.example.text, c.gameSimplification, ...factsForConcept(c.id).map(realWorldView)]);
      for (const x of hidden) expect(tokens(entry), `${c.id} ${x}`).not.toContain(x);
    }
  });
  it('only src/learn/rw.js reads the `numbers` field of a fact; no UI file does', () => {
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const root = new URL('../src/', import.meta.url).pathname;
    const offenders = walk(root).filter((f) => f.endsWith('.js') && !f.endsWith('learn/rw.js') && !f.endsWith('learn/validate.js')).filter((f) => /\.numbers\b|\bnumbers\.(text|publish)/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(root, ''))).toEqual([]);
  });
  it('every flagged card resolves to a fact, and unflagged cards do not', () => {
    for (const c of data.cards.filter((x) => x.realWorld)) expect(factForCard(c.id), c.id).toBeTruthy();
    expect(factForCard('opp-apt-002')).toBeNull();
  });
});

describe('learning content validation and hygiene', () => {
  it('the shipped content is valid', () => {
    expect(validateLearn(content, { cards: data.cards })).toEqual([]);
  });
  it('a broken file is rejected loudly (unknown group, undeclared slot, unknown term, missing concept field)', () => {
    const bad = structuredClone(content);
    bad.feedback.lines['no.such'] = { all: ['x'] };
    bad.feedback.lines['buy.good'].family[0] = 'a {mystery} b';
    bad.glossary.concepts[0].short = '';
    bad.realWorld.facts[0].concept = 'nope';
    const errs = validateLearn(bad, { cards: data.cards }).join('\n');
    expect(errs).toContain('unknown group no.such');
    expect(errs).toContain('undeclared slot {mystery}');
    expect(errs).toContain('short');
    expect(errs).toContain('not a glossary id');
  });
  it('no hard-coded Hebrew in engine and learn code (all text comes from JSON / i18n)', () => {
    const root = new URL('../src/', import.meta.url).pathname;
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const offenders = walk(root).filter((f) => /\/(engine|learn)\//.test(f) && f.endsWith('.js')).filter((f) => {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
      return /[֐-׿]/.test(code);
    });
    expect(offenders.map((f) => f.replace(root, ''))).toEqual([]);
  });
  it('stock cards never get a light, a guess, or a rated decision', () => {
    const stock = card('opp-stk-001');
    expect(guessOffered(stock, true)).toBe(false);
    const m = stockNoteModel(stock, { dividendText: '₪2', yieldText: '4.8%' });
    expect(m.dividend).toContain('₪2');
    expect(m.dividend).toContain('4.8%');
    expect(m.dividend).not.toMatch(/תשואה|החזר/);
    const s = engine.buy(withCard('opp-stk-001', { mode: 'full' }), 1);
    const d = s.learn.decisions.at(-1);
    expect([d.tier, d.green]).toEqual([null, null]);
    expect(buildReport(s).green.total).toBe(0);
  });
  it('simulation: bots finish games with the learn record filled and no engine error', () => {
    for (const bot of ['sensible', 'alwaysBuy']) {
      const s = playGame(engine, engine.newGame({ mode: 'family', professionId: 'nurse', seed: 31 }), bot);
      expect(s.status).not.toBe('playing');
      expect(Array.isArray(s.learn.decisions)).toBe(true);
    }
    expect(Object.keys(BOTS)).toContain('sensible');
  });
});

describe('money formatting inside slots', () => {
  it('amounts keep the symbol first with an explicit sign only where asked', () => {
    expect(moneyText(3400)).toBe('₪3,400');
    expect(loanSlots(2000).monthlyPayment).toBe('₪20');
  });
});
