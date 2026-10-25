// v4 stage 4 (docs/decisions.md 2026-10-24/25): decision cards (docs/v4/decision-cards.md), the 25 / 50% milestones
// (docs/v4/milestones.md), the 'ביקורת רשות המסים' square and its quiz, the schema 4 -> 5 save migration, the daily challenge.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, BOARD, TAX_AUDIT_SQUARE, MILESTONES, SCHEMA_VERSION, MORTGAGE_PAYMENT_RATE, LOAN_CAP_SALARIES,
  passiveIncome, monthlyCashFlow, loanPayments, bankLoanPrincipal, totalExpenses, netWorth, validateCards,
  serialize, deserialize, newDailyGame, replayDaily, dailyResult, botStep, decisionCanPass, isFreeOption,
  FAMILY_NET_FLOOR, maxLoan, loanLimits, familyNetLimit, purchasePlan,
} from '../src/engine/index.js';
import { loadData, loadLearn } from '../src/data/index.js';
import { pruneLearn } from '../scripts/prune-learn.js';

const data = loadData('he');
const engine = createEngine(data);
const card = (id) => data.cards.find((c) => c.id === id);
const DECISIONS = data.cards.filter((c) => c.deck === 'decision');

/** A game whose pending card is decision card `id` (as the engine deals it), with the given cash and extra state. */
function withDecision(id, { mode = card(id).modes[0], cash = 1000000, ...extra } = {}) {
  const s = engine.newGame({ mode, professionId: 'teacher', seed: 5 });
  const square = card(id).square;
  const decks = { ...s.decks, [square]: [id, ...s.decks[square]] };
  const pos = BOARD.indexOf(square, 1) - 1; // never across square 0 (no payday on the way unless the square is after one)
  const ready = { ...s, cash, decks, position: pos, ...extra };
  // land with a die of 1: square `pos + 1` is the deck's square; any payday on the way is not crossed (pos + 1 is the square)
  const out = engine.roll(ready, [1]);
  return { ...out, cash }; // the test controls the cash at the decision
}
const loan = (amount, rate = 0.01) => ({ id: `loan-t${amount}`, kind: 'loan', label: 'loan', principal: amount, monthlyPayment: amount * rate, rate });

describe('decision cards: data', () => {
  it('ships the 9 cards of the doc (card 9 with its family variant), each with 2-3 options and a fox line', () => {
    expect(DECISIONS.map((c) => c.id).sort()).toEqual(['dec-001', 'dec-002', 'dec-003', 'dec-004', 'dec-005', 'dec-006', 'dec-007', 'dec-008', 'dec-009', 'dec-009f']);
    for (const c of DECISIONS) {
      expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.options.length, c.id).toBeLessThanOrEqual(3);
      for (const o of c.options) expect(o.fox && o.label, `${c.id} ${o.id}`).toBeTruthy();
    }
    expect(card('dec-003').modes).toEqual(['full']);
    expect(card('dec-007').modes).toEqual(['full']);
    expect(card('dec-009').modes).toEqual(['full']);
    expect(card('dec-009f').modes).toEqual(['family']);
    expect(card('dec-004').square).toBe('expense');
    expect(DECISIONS.filter((c) => c.square === 'opportunity').length).toBe(9);
  });
  it('every asset block recomputes from its own formula (apartments: mortgage x 0.0055; gross - loan payment = cash flow)', () => {
    for (const c of DECISIONS) {
      for (const o of c.options) {
        for (const a of o.effects.buy ?? []) {
          expect(a.price, `${c.id} ${o.id}`).toBe(a.downPayment + a.mortgage);
          if (a.type === 'apartment') {
            // mortgage x 0.0055, as the shipped cards round it (to the nearest 100 at most)
            expect(Math.abs(a.loanPayment - a.mortgage * MORTGAGE_PAYMENT_RATE), `${c.id} ${o.id}`).toBeLessThanOrEqual(50);
            expect(a.rent - a.loanPayment).toBe(a.monthlyCashFlow);
          } else expect(a.profit - a.loanPayment).toBe(a.monthlyCashFlow);
        }
      }
    }
    // the doc's own checks
    const two = card('dec-002').options[1].effects.buy;
    expect(two.reduce((x, a) => x + a.monthlyCashFlow, 0)).toBe(4800);
    expect(1700000 * MORTGAGE_PAYMENT_RATE).toBeCloseTo(9350, 6);
    expect(1600000 * MORTGAGE_PAYMENT_RATE).toBeCloseTo(8800, 6);
    expect(card('dec-006').options[1].effects.buy[0]).toMatchObject({ share: 0.5, monthlyCashFlow: 1150, downPayment: 60000 });
  });
  it('the validator rejects broken decision cards', () => {
    const ok = structuredClone(card('dec-001'));
    expect(validateCards([...data.cards])).toEqual([]);
    const bad = (patch) => validateCards([...data.cards.filter((c) => c.id !== ok.id), { ...structuredClone(ok), ...patch }]);
    expect(bad({ options: ok.options.slice(0, 1) }).join()).toMatch(/2-3 options/);
    expect(bad({ options: [...ok.options, { ...ok.options[2], id: 'D' }] }).join()).toMatch(/2-3 options/);
    expect(bad({ square: 'market' }).join()).toMatch(/square/);
    expect(bad({ type: 'business' }).join()).toMatch(/no type/);
    const broken = structuredClone(ok.options); broken[0].effects.buy[0].monthlyCashFlow = 1900;
    expect(bad({ options: broken }).join()).toMatch(/profit - loanPayment/);
    const odd = structuredClone(ok.options); odd[1].effects.loan = 80500;
    expect(bad({ options: odd }).join()).toMatch(/multiple of 1000/);
    const sellFam = structuredClone(card('dec-003')); sellFam.modes = ['family', 'full'];
    expect(validateCards([...data.cards.filter((c) => c.id !== 'dec-003'), sellFam]).join()).toMatch(/full mode only/);
  });
});

describe('decision cards: engine effects (exact, from the doc)', () => {
  it('card 1: cash / loan / wait', () => {
    const s = withDecision('dec-001', { cash: 100000 });
    expect(s.pending.kind).toBe('decision');
    const a = engine.decide(s, 'A');
    expect(a.cash - s.cash).toBe(-80000);
    expect(passiveIncome(a) - passiveIncome(s)).toBe(1800);
    const b = engine.decide(s, 'B');
    expect(b.cash - s.cash).toBe(0);
    expect(bankLoanPrincipal(b) - bankLoanPrincipal(s)).toBe(80000);
    expect(loanPayments(b) - loanPayments(s)).toBe(800);
    expect(monthlyCashFlow(b) - monthlyCashFlow(s)).toBe(1000);
    const c = engine.decide(s, 'C');
    expect([c.cash, passiveIncome(c), loanPayments(c)]).toEqual([s.cash, passiveIncome(s), loanPayments(s)]);
    expect(a.events.find((e) => e.type === 'decided')).toMatchObject({ cardId: 'dec-001', option: 'A', cash: -80000, passive: 1800 });
  });
  it('availability: not enough cash, the loan limit, the purchase cap', () => {
    const poor = withDecision('dec-001', { cash: 10000 });
    const o = Object.fromEntries(engine.decisionOptions(poor).map((x) => [x.id, x]));
    expect(o.A).toMatchObject({ available: false, reason: 'cash' });
    expect(o.C).toMatchObject({ available: true });
    // the cap: 12 salaries of bank loans to invest
    const capped = withDecision('dec-001', { cash: 100000, liabilities: [loan(Math.floor(8800 * LOAN_CAP_SALARIES / 1000) * 1000)] });
    expect(engine.decisionOptions(capped).find((x) => x.id === 'B')).toMatchObject({ available: false, reason: 'loan' });
    expect(() => engine.decide(capped, 'B')).toThrow(/not available/);
  });
  it('card 2: one big apartment or two small ones', () => {
    const s = withDecision('dec-002', { cash: 500000 });
    expect(passiveIncome(engine.decide(s, 'A')) - passiveIncome(s)).toBe(5100);
    const b = engine.decide(s, 'B');
    expect(passiveIncome(b) - passiveIncome(s)).toBe(4800);
    expect(b.assets.length - s.assets.length).toBe(2);
    expect(b.cash - s.cash).toBe(-400000);
  });
  it('card 3 (full): sell at 25% over the purchase price, or sell and repay every bank loan; skipped without an apartment', () => {
    const apt = { id: 'asset-x', cardId: 'opp-apt-001', type: 'apartment', title: 't', price: 1800000, downPayment: 200000, mortgage: 1600000, monthlyCashFlow: 3400, rent: 12200, loanPayment: 8800 };
    const s = withDecision('dec-003', { mode: 'full', cash: 0, assets: [apt], liabilities: [loan(100000)] });
    const a = engine.decide(s, 'A');
    expect(a.cash - s.cash).toBe(650000);
    expect(passiveIncome(a) - passiveIncome(s)).toBe(-3400);
    const c = engine.decide(s, 'C');
    expect(bankLoanPrincipal(c)).toBe(0);
    expect(c.cash).toBe(650000 - 100000);
    expect(loanPayments(s) - loanPayments(c)).toBe(1000);
    expect(engine.decisionOptions(withDecision('dec-003', { mode: 'full', cash: 0, assets: [apt] })).find((x) => x.id === 'C')).toMatchObject({ available: false, reason: 'bankLoan' });
    // the card is never dealt to a player without an apartment: the next card comes instead
    const base = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 5 });
    const pos = BOARD.indexOf('opportunity', 1) - 1;
    const n = engine.roll({ ...base, position: pos, decks: { ...base.decks, opportunity: ['dec-003', ...base.decks.opportunity.filter((x) => x !== 'dec-003')] } }, [1]);
    expect(n.pending.card.id).not.toBe('dec-003');
  });
  it('card 4 (expense): cash, a loan exempt from the purchase cap, or half and half; nothing possible = an ordinary expense', () => {
    const s = withDecision('dec-004', { cash: 10000 });
    expect(s.pending.kind).toBe('decision');
    expect(engine.decide(s, 'A').cash).toBe(4000);
    const b = engine.decide(s, 'B');
    expect([b.cash, loanPayments(b) - loanPayments(s)]).toEqual([10000, 60]);
    const c = engine.decide(s, 'C');
    expect([c.cash, loanPayments(c) - loanPayments(s)]).toEqual([7000, 30]);
    // at the purchase cap the loan option is still open (an expense never strands the player)
    const capped = withDecision('dec-004', { cash: 0, liabilities: [loan(Math.floor(8800 * LOAN_CAP_SALARIES / 1000) * 1000)] });
    expect(engine.decisionOptions(capped).find((x) => x.id === 'B').available).toBe(true);
    // the cushion lesson is recorded like an expense: green only when paid from cash
    expect(engine.decide(s, 'A').learn.decisions.find((d) => d.kind === 'expense')).toMatchObject({ green: true, viaLoan: false });
    expect(engine.decide(s, 'B').learn.decisions.find((d) => d.kind === 'expense')).toMatchObject({ green: false, viaLoan: true });
  });
  it('card 5: repay 40,000 (-400 a month) or buy the cart (+900); only dealt with a bank loan of 40,000 or more', () => {
    const s = withDecision('dec-005', { cash: 40000, liabilities: [loan(50000)] });
    const a = engine.decide(s, 'A');
    expect(loanPayments(s) - loanPayments(a)).toBe(400);
    expect(passiveIncome(engine.decide(s, 'B')) - passiveIncome(s)).toBe(900);
    const base = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 5 });
    const n = engine.roll({ ...base, position: BOARD.indexOf('opportunity', 1) - 1, liabilities: [loan(39000)], decks: { ...base.decks, opportunity: ['dec-005', ...base.decks.opportunity] } }, [1]);
    expect(n.pending.card.id).not.toBe('dec-005');
  });
  it('card 6 (partnership), card 7 (stocks), card 8 (down payment) and card 9 (centre or periphery)', () => {
    const s6 = withDecision('dec-006', { cash: 200000 });
    expect(passiveIncome(engine.decide(s6, 'B')) - passiveIncome(s6)).toBe(1150);
    expect(engine.decide(s6, 'B').assets.at(-1).share).toBe(0.5);
    const s7 = withDecision('dec-007', { mode: 'full', cash: 30000 });
    expect(passiveIncome(engine.decide(s7, 'A'))).toBe(passiveIncome(s7) + 200);
    expect(passiveIncome(engine.decide(s7, 'B'))).toBe(passiveIncome(s7) + 90);
    const c7 = engine.decide(s7, 'C');
    expect([passiveIncome(c7) - passiveIncome(s7), c7.cash]).toEqual([145, 0]);
    expect(decisionCanPass(card('dec-007'))).toBe(true); // every option costs: the plain pass is offered
    expect(engine.decide(s7, 'pass').cash).toBe(30000);
    const s8 = withDecision('dec-008', { cash: 400000 });
    expect(passiveIncome(engine.decide(s8, 'A')) - passiveIncome(s8)).toBe(3800);
    expect(passiveIncome(engine.decide(s8, 'B')) - passiveIncome(s8)).toBe(4900);
    expect(engine.decide(s8, 'pass').cash).toBe(400000);
    const s9 = withDecision('dec-009', { mode: 'full', cash: 300000 });
    expect(passiveIncome(engine.decide(s9, 'A')) - passiveIncome(s9)).toBe(4300);
    const f9 = withDecision('dec-009f', { mode: 'family', cash: 300000 });
    expect(passiveIncome(engine.decide(f9, 'A')) - passiveIncome(f9)).toBe(3800);
    expect(f9.cash - engine.decide(f9, 'B').cash).toBe(140000);
  });
  it('a free option exists or the pass is offered, so no decision card can strand a player', () => {
    for (const c of DECISIONS.filter((x) => x.square === 'opportunity')) expect(c.options.some(isFreeOption) || decisionCanPass(c), c.id).toBe(true);
  });
});

describe('milestones 25% / 50% (once per game, kept in the save)', () => {
  const owning = (cf) => [{ id: 'a1', cardId: 'opp-biz-002', type: 'business', title: 'x', price: 1, downPayment: 1, mortgage: 0, monthlyCashFlow: cf }];
  it('fires each milestone once, at the first crossing, and never again', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 3 });
    expect(MILESTONES).toEqual([25, 50]);
    expect(s0.milestones).toEqual([]);
    const exp = totalExpenses(s0);
    const quarter = Math.ceil(exp * 0.25);
    const s = withDecision('dec-001', { cash: 200000, assets: owning(quarter - 1800 + 10) });
    const a = engine.decide(s, 'A'); // +1,800 crosses 25%
    expect(a.events.filter((e) => e.type === 'milestone').map((e) => e.pct)).toEqual([25]);
    expect(a.milestones).toEqual([25]);
    const again = engine.decide({ ...s, milestones: [25] }, 'A');
    expect(again.events.some((e) => e.type === 'milestone')).toBe(false);
    const back = deserialize(serialize({ kind: 'match', schemaVersion: SCHEMA_VERSION, mode: 'family', seed: 3, players: [{ id: 'p1', name: '', color: 1, professionId: 'teacher', state: a }], currentIndex: 0, turns: 0, turnMark: 0, status: 'playing', winnerIndex: null }));
    expect(back.players[0].state.milestones).toEqual([25]);
  });
  it('schema 5: the v2.5 fixture (schema 3) migrates through 4 to 5 with milestones and an empty tax-audit record', () => {
    expect(SCHEMA_VERSION).toBe(5);
    const fixture = readFileSync(new URL('./fixtures/save-v2.5-schema3.json', import.meta.url), 'utf8');
    const old = JSON.parse(fixture);
    const m = deserialize(fixture);
    expect(m.schemaVersion).toBe(5);
    m.players.forEach((p, i) => {
      expect(p.state.schemaVersion).toBe(5);
      expect(p.state.taxAudit).toEqual({ points: 0, asked: [] });
      const ratio = passiveIncome(p.state) / totalExpenses(p.state);
      expect(p.state.milestones).toEqual(MILESTONES.filter((x) => ratio * 100 >= x)); // already passed = already shown
      const { lap, effects, milestones, taxAudit, schemaVersion, ...rest } = p.state;
      const { schemaVersion: v, ...oldRest } = old.players[i].state;
      expect(rest).toEqual(oldRest);
    });
    // and it plays on with the new squares and cards
    let s = m.players[0].state;
    for (let k = 0; k < 120 && s.status === 'playing'; k++) s = botStep(engine, s, 'sensible');
    expect(deserialize(serialize({ ...m, players: [{ ...m.players[0], state: s }, m.players[1]] })).players[0].state).toEqual(s);
  });
});

describe("'ביקורת רשות המסים' square", () => {
  it('replaces exactly one square of the 24-square loop (square 12, was an unexpected expense)', () => {
    expect(BOARD).toHaveLength(24);
    expect(BOARD.filter((x) => x === 'taxAudit')).toHaveLength(1);
    expect(BOARD[TAX_AUDIT_SQUARE]).toBe('taxAudit');
    const count = (t) => BOARD.filter((x) => x === t).length;
    expect([count('payday'), count('opportunity'), count('expense'), count('market'), count('baby'), count('charity')]).toEqual([5, 9, 2, 3, 2, 2]);
  });
  it('landing opens a quiz; the answer gives knowledge points only and never touches money', () => {
    const s0 = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 4 });
    const s = engine.roll({ ...s0, position: TAX_AUDIT_SQUARE - 1 }, [1]);
    expect(s.pending).toMatchObject({ kind: 'taxAudit' });
    expect(Number.isInteger(s.pending.pick)).toBe(true);
    for (const correct of [true, false, null]) {
      const a = engine.answerAudit(s, { questionId: 'tq-vat-rate', correct });
      const money = (x) => [x.cash, x.assets, x.liabilities, x.kids, monthlyCashFlow(x), netWorth(x), x.stats.totalPaid, x.stats.loansTaken];
      expect(money(a)).toEqual(money(s));
      expect(a.taxAudit.points).toBe(correct === true ? 1 : 0);
      expect(a.taxAudit.asked.at(-1)).toMatchObject({ questionId: 'tq-vat-rate', correct });
      expect(a.phase).toBe('roll');
    }
  });
  it('the daily challenge stays deterministic: the same question pick on the same turn for every player, and the log replays', () => {
    const date = '2026-10-21';
    const play = (bot) => {
      let s = newDailyGame(engine, date);
      const picks = {};
      for (let k = 0; k < 400 && s.status === 'playing'; k++) {
        if (s.pending?.kind === 'taxAudit') picks[s.turn] = s.pending.pick;
        s = botStep(engine, s, bot);
      }
      return { s, picks };
    };
    const a = play('alwaysBuy');
    const b = play('cautious');
    const shared = Object.keys(a.picks).filter((t) => t in b.picks);
    for (const t of shared) expect(a.picks[t]).toBe(b.picks[t]);
    expect(play('alwaysBuy').picks).toEqual(a.picks); // same date, same choices, same picks
    const replayed = replayDaily(engine, dailyResult(a.s));
    expect(replayed.cash).toBe(a.s.cash);
    expect(replayed.taxAudit).toEqual(a.s.taxAudit);
    // the daily deals no decision cards (the classic piles only), so its card stream is the same as before stage 4
    expect(a.s.learn.decisions.some((d) => d.kind === 'decision')).toBe(false);
  });
});

describe('the v4 learn files: loaded, validated, shipped with their as-of tag and link', () => {
  const learn = loadLearn('he');
  it('the loader validates and returns the tax quiz, the guide and the Israeli money rules', () => {
    expect(learn.quizTax.questions.length).toBeGreaterThanOrEqual(10);
    expect(learn.quizTax.questions.some((q) => q.family)).toBe(true);
    expect(learn.guide.statementPopover.title).toBe('מסים וביטוח לאומי');
    expect(learn.israel.concepts.length).toBeGreaterThan(5);
  });
  it('every question and the statement popover keep `ref` (the shown link) and `asOf` after the build prune drops `source`', () => {
    const q = pruneLearn('quiz-tax', JSON.parse(readFileSync(new URL('../src/data/learn/quiz-tax.he.json', import.meta.url), 'utf8')));
    for (const x of q.questions) {
      expect(x.source, x.id).toBeUndefined();
      expect(x.ref.url, x.id).toMatch(/^https:\/\//);
      expect(x.asOf).toBe('2026');
    }
    const g = pruneLearn('guide', JSON.parse(readFileSync(new URL('../src/data/learn/guide.he.json', import.meta.url), 'utf8')));
    expect(g.statementPopover.ref.url).toMatch(/^https:\/\//);
    expect(g.statementPopover.asOf).toBe('2026');
  });
  it('the Bank of Israel rate (3.25%) ships only in the guide figure that carries its verified tag (owner, 2026-10-25)', () => {
    for (const kind of ['quiz-tax', 'guide', 'israel']) {
      const data2 = pruneLearn(kind, JSON.parse(readFileSync(new URL(`../src/data/learn/${kind}.he.json`, import.meta.url), 'utf8')));
      const tagged = kind === 'guide' ? data2.lessons.flatMap((l) => l.screens).filter((x) => x.numbers?.verified === 'boi.policyRate') : [];
      expect(tagged.length, kind).toBe(kind === 'guide' ? 1 : 0);
      const rest = tagged.reduce((x, sc) => x.split(sc.numbers.text).join(''), JSON.stringify(data2));
      expect(rest.includes('3.25'), kind).toBe(false);
    }
    const lesson = learn.guide.lessons.find((l) => l.screens.some((x) => x.numbers?.verified));
    expect(lesson.asOf).toBe('2026');
    expect(lesson.ref.url).toMatch(/^https:\/\//);
  });
  it('no quiz reward field changes money', () => {
    expect(Object.keys(learn.quizTax.reward).sort()).toEqual(['badge', 'familyBadge', 'pointsLabel', 'pointsPerCorrect']);
  });
});

describe('family safety net (owner, 2026-10-25): no purchase loan that leaves the month in minus', () => {
  const at = (mode, cardId, extra = {}) => {
    const s = engine.newGame({ mode, professionId: 'driver', seed: 5 });
    return { ...s, cash: 0, pending: { kind: 'opportunity', card: structuredClone(card(cardId)) }, phase: 'decision', ...extra };
  };
  it('family: the largest purchase loan keeps cash flow + the deal >= FAMILY_NET_FLOOR; full mode is unchanged', () => {
    expect(FAMILY_NET_FLOOR).toBe(0);
    const fam = at('family', 'opp-apt-002'); // down payment 400,000 at 1% a month = 4,000 a month, the deal pays 5,100
    const room = monthlyCashFlow(fam) + 5100;
    expect(maxLoan(fam)).toBe(Math.min(loanLimits({ ...fam, mode: 'full' }).max, Math.floor(room / 10) * 1000));
    expect(monthlyCashFlow(fam) + 5100 - maxLoan(fam) * 0.01).toBeGreaterThanOrEqual(0);
    expect(() => engine.takeLoan(fam, maxLoan(fam) + 1000)).toThrow(/loan limit/);
    const full = at('full', 'opp-apt-002');
    expect(loanLimits(full).netBinds).toBe(false);
    expect(familyNetLimit(full)).toBe(Infinity);
  });
  // the net binds before the -20%-of-salary floor only for deals that pay less than 20% of the salary (here the 900 cart)
  const withFlow = (mode, cardId, flow, extra = {}) => {
    const base = at(mode, cardId, { liabilities: [] });
    return at(mode, cardId, { liabilities: [{ id: 'debt-t', kind: 'base', label: 'x', principal: 1000, monthlyPayment: monthlyCashFlow(base) - flow }], ...extra });
  };
  it('a blocked buy reports the net as the reason; expense and shortfall loans are never limited by it', () => {
    const s = withFlow('family', 'opp-biz-006', -800); // the cart: down 40,000 -> 400 a month, it pays 900: -800 + 900 - 400 < 0
    expect(purchasePlan(s, 40000).status).toBe('blocked');
    expect(loanLimits(s).netBinds).toBe(true);
    expect(purchasePlan({ ...s, mode: 'full' }, 40000).status).toBe('loan'); // full mode: the old rules only
    expect(familyNetLimit({ ...s, pending: { kind: 'expense', card: card('exp-001'), amount: 4500 } })).toBe(Infinity);
    expect(familyNetLimit({ ...s, pending: { kind: 'shortfall' } })).toBe(Infinity);
  });
  it('decision cards: a family loan option the net blocks is "not available" with reason "net"', () => {
    const cart = card('dec-005').options[1].effects.buy[0];
    const test = { id: 'dec-test', deck: 'decision', square: 'opportunity', modes: ['family', 'full'], title: 't', text: 't',
      options: [{ id: 'A', label: 'a', fox: 'f', effects: { loan: 40000, buy: [cart] } }, { id: 'B', label: 'b', fox: 'f', effects: {} }] };
    const e2 = createEngine({ ...data, cards: [...data.cards, test] });
    const fam = { ...withFlow('family', 'opp-biz-006', -800), pending: { kind: 'decision', card: test } };
    expect(e2.decisionOptions(fam).find((o) => o.id === 'A')).toMatchObject({ available: false, reason: 'net' });
    expect(e2.decisionOptions({ ...fam, mode: 'full' }).find((o) => o.id === 'A').available).toBe(true);
  });
});
