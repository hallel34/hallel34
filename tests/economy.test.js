// v3 phase 3 economy: PAYDAY_MONTHS, lap-based price inflation of NEW deals (never in the daily challenge), the family market deck
// with timed effects, the 2026 tax lines and the schema 3 -> 4 save migration (docs/decisions.md 2026-10-23).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, BOARD, PAYDAY_MONTHS, PRICE_INFLATION_PER_LAP, EXPENSE_INFLATION_PER_LAP, DAILY_INFLATION_FACTOR,
  INFLATION_PRICE_ROUND, INFLATION_FLOW_ROUND, LOAN_PAYMENT_RATE, TIMED_EFFECT_KINDS, SCHEMA_VERSION,
  priceFactor, passiveIncome, netWorth, balanceSheet, maxLoan, loanRateNow, loanTerms, monthlyCashFlow, loanLimits,
  validateCards, serialize, deserialize, currentState, act, canEndTurn, endTurn, botStep, newDailyGame,
} from '../src/engine/index.js';
import { inflateDeal } from '../src/engine/engine.js';
import { loadData } from '../src/data/index.js';

const data = loadData('he');
const engine = createEngine(data);
const card = (id) => data.cards.find((c) => c.id === id);
const idx = (type, nth = 0) => BOARD.map((t, i) => (t === type ? i : -1)).filter((i) => i >= 0)[nth];
const FAMILY_MARKET = data.cards.filter((c) => c.deck === 'market' && TIMED_EFFECT_KINDS.includes(c.effect));

/** A family game standing just before a square, with chosen cards on top of the decks. */
function before(square, { mode = 'family', professionId = 'teacher', market, opportunity, lap = 0, nth = 0 } = {}) {
  const s = engine.newGame({ mode, professionId, seed: 7 });
  const decks = { ...s.decks };
  if (market) decks.market = [...market, ...decks.market];
  if (opportunity) decks.opportunity = [...opportunity, ...decks.opportunity];
  return { ...s, position: idx(square, nth) - 1, decks, lap };
}
const roll1 = (s) => engine.roll(s, [1]);
/** Rolls a die of 1 from a square that is not before a payday, resolving whatever comes up, `n` times. */
function quietTurns(s, n) {
  let d = s;
  for (let i = 0; i < n; i++) {
    d = { ...d, position: idx('charity', 0) - 2 }; // square 5 (opportunity) -> 6 (charity): no payday crossed
    d = roll1(d);
    if (d.pending?.kind === 'opportunity') d = engine.pass(d);
    if (d.pending?.kind === 'charity') d = engine.declineCharity(d);
  }
  return d;
}

describe('economy constants (config)', () => {
  it('a payday settles 12 months; prices inflate 8% a lap; expense cards do not inflate', () => {
    expect(PAYDAY_MONTHS).toBe(12);
    expect(PRICE_INFLATION_PER_LAP).toBe(1.08);
    expect(EXPENSE_INFLATION_PER_LAP).toBe(1.0);
    expect(DAILY_INFLATION_FACTOR).toBe(1.0);
    expect(SCHEMA_VERSION).toBe(5);
  });
  it('a payday pays monthly cash flow x 12', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 3 });
    const r = engine.roll({ ...s, position: idx('payday', 1) - 1 }, [1]);
    const ev = r.events.find((e) => e.type === 'payday');
    expect(ev).toMatchObject({ months: 12, amount: monthlyCashFlow(s) * 12 });
  });
});

describe('laps and price inflation of new deals', () => {
  it('lap counts the passes of square 0; a new game starts at lap 0', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 1 });
    expect(s.lap).toBe(0);
    const r = engine.roll({ ...s, position: BOARD.length - 2 }, [3]); // 22 -> 23 -> 0 -> 1
    expect(r.lap).toBe(1);
    expect(priceFactor(r)).toBeCloseTo(1.08, 10);
    expect(priceFactor({ ...r, lap: 3 })).toBeCloseTo(1.08 ** 3, 10);
  });
  it('a deal drawn at lap 2 shows inflated, rounded numbers whose breakdown still adds up', () => {
    const r = roll1(before('opportunity', { opportunity: ['opp-apt-004'], lap: 2 }));
    const c = r.pending.card;
    const base = card('opp-apt-004');
    const f = 1.08 ** 2;
    expect(c.price).toBe(Math.round((base.price * f) / 1000) * 1000);
    expect(c.downPayment).toBe(Math.round((base.downPayment * f) / 1000) * 1000);
    expect(c.mortgage).toBe(c.price - c.downPayment);
    expect(c.rent).toBe(Math.round((base.rent * f) / 10) * 10);
    expect(c.loanPayment).toBe(Math.round((base.loanPayment * f) / 10) * 10);
    expect(c.monthlyCashFlow).toBe(c.rent - c.loanPayment);
    expect(c.monthlyCashFlow).toBeGreaterThan(base.monthlyCashFlow);
    expect(base.price).toBe(1400000); // the card data itself is never touched
  });
  it('lap 0 deals are the card numbers exactly', () => {
    const r = roll1(before('opportunity', { opportunity: ['opp-biz-006'] }));
    const { inflation, ...c } = r.pending.card;
    expect(inflation).toBeUndefined();
    expect(c).toMatchObject({ price: 80000, downPayment: 40000, mortgage: 40000, monthlyCashFlow: 900, profit: 1600, loanPayment: 700 });
  });
  it('every shipped deal stays valid and round (₪1,000 prices, ₪10 flows) at laps 1-8', () => {
    for (let lap = 1; lap <= 8; lap++) {
      const f = PRICE_INFLATION_PER_LAP ** lap;
      const inflated = data.cards.map((c) => (c.deck === 'opportunity' ? inflateDeal(structuredClone(c), f) : c));
      expect(validateCards(inflated), `lap ${lap}`).toEqual([]);
      for (const c of inflated.filter((x) => x.deck === 'opportunity' && x.type !== 'stock')) {
        expect(c.price % INFLATION_PRICE_ROUND, c.id).toBe(0);
        expect(c.downPayment % INFLATION_PRICE_ROUND, c.id).toBe(0);
        expect(Math.abs(c.monthlyCashFlow) % INFLATION_FLOW_ROUND, c.id).toBe(0);
      }
    }
  });
  it('stocks are not inflated (market cards set their price)', () => {
    const c = structuredClone(card('opp-stk-001'));
    expect(inflateDeal(c, 1.5)).toEqual(card('opp-stk-001'));
  });
  it('assets already owned keep their numbers when later laps inflate new deals', () => {
    let s = before('opportunity', { opportunity: ['opp-biz-006'] });
    s = engine.buy(roll1({ ...s, cash: 500000 }));
    const owned = structuredClone(s.assets[0]);
    s = engine.roll({ ...s, position: BOARD.length - 1 }, [1]); // pass square 0
    s = { ...s, lap: 5, phase: 'roll', pending: null };
    s = roll1({ ...s, position: idx('opportunity') - 1, decks: { ...s.decks, opportunity: ['opp-biz-006', ...s.decks.opportunity] } });
    expect(s.pending.card.price).toBeGreaterThan(owned.price);
    expect(s.assets[0]).toEqual(owned);
  });
  it('expense cards are not inflated (factor 1.0)', () => {
    const s = before('expense', { lap: 4 });
    const top = s.decks.expense[0];
    const r = roll1({ ...s, cash: 500000 });
    expect(r.events.find((e) => e.type === 'expensePaid').amount).toBe(card(top).amount);
  });
});

describe('daily challenge: no inflation, the same prices for everyone', () => {
  it('the price factor is 1 in a daily at any lap', () => {
    const s = newDailyGame(engine, '2026-10-23');
    expect(priceFactor({ ...s, lap: 6 })).toBe(1);
  });
  it('a donating player and a never-donating player see the same deal numbers on every shared turn', () => {
    for (const date of ['2026-10-23', '2026-11-02', '2027-01-15']) {
      const seen = {};
      for (const bot of ['sensible', 'alwaysPass']) {
        let s = newDailyGame(engine, date);
        const cards = {};
        let guard = 0;
        while (s.status === 'playing' && guard++ < 3000) {
          s = botStep(engine, s, bot);
          if (s.pending?.kind === 'opportunity') cards[s.turn] = s.pending.card;
        }
        seen[bot] = { cards, laps: s.lap };
      }
      const a = seen.sensible.cards;
      const b = seen.alwaysPass.cards;
      for (const t of Object.keys(a).filter((k) => k in b)) {
        if (a[t].id !== b[t].id) continue; // same card, same turn
        expect(a[t], `${date} turn ${t}`).toEqual(b[t]);
        expect(a[t].inflation).toBeUndefined();
      }
    }
  });
});

describe('family market deck (timed effects)', () => {
  it('has the three kinds, family only, each with a teaches line', () => {
    expect(new Set(FAMILY_MARKET.map((c) => c.effect))).toEqual(new Set(['propertyValue', 'cheapLoan', 'rentChange']));
    for (const c of FAMILY_MARKET) {
      expect(c.modes, c.id).toEqual(['family']);
      expect(c.teaches.length, c.id).toBeGreaterThan(20);
      expect(c.turns, c.id).toBe(3);
    }
    const pv = FAMILY_MARKET.filter((c) => c.effect === 'propertyValue').map((c) => Math.abs(c.pct));
    expect(pv.every((p) => p >= 0.1 && p <= 0.2)).toBe(true);
    expect(FAMILY_MARKET.find((c) => c.effect === 'cheapLoan').rate).toBe(0.005);
    expect(FAMILY_MARKET.find((c) => c.effect === 'rentChange').pct).toBe(-0.1);
  });
  it('the text quotes the card\'s own percentage', () => {
    for (const c of FAMILY_MARKET.filter((x) => x.effect !== 'cheapLoan')) expect(c.text, c.id).toContain(`${Math.round(Math.abs(c.pct) * 100)}%`);
  });
  it('uses no adult money word (the family vocabulary list)', () => {
    const src = readFileSync(new URL('./kid-vocabulary.test.js', import.meta.url), 'utf8');
    const list = JSON.parse(src.match(/export const FORBIDDEN = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
    expect(list).toContain('ריבית');
    for (const c of FAMILY_MARKET) for (const k of ['title', 'text', 'teaches']) for (const w of list) expect(c[k].includes(w), `${c.id}.${k}: ${w}`).toBe(false);
  });
  it('a full game never draws them; a family game does', () => {
    const fam = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    const full = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 1 });
    expect(fam.decks.market.filter((id) => id.startsWith('fmkt-'))).toHaveLength(FAMILY_MARKET.length);
    expect(full.decks.market.some((id) => id.startsWith('fmkt-'))).toBe(false);
  });
  it('the schema rejects a timed card without turns, a bad pct or rate, a missing teaches line, and a family offer card', () => {
    const ok = card('fmkt-001');
    expect(validateCards([ok])).not.toContain(expect.stringContaining('fmkt-001'));
    const errs = (c) => validateCards([c]).filter((e) => e.startsWith(`card ${c.id}`));
    expect(errs({ ...ok, turns: 0 })).not.toEqual([]);
    expect(errs({ ...ok, pct: 0.9 })).not.toEqual([]);
    expect(errs({ ...ok, teaches: undefined })).not.toEqual([]);
    expect(errs({ ...card('fmkt-003'), rate: LOAN_PAYMENT_RATE })).not.toEqual([]);
    expect(errs({ ...card('mkt-001'), modes: ['family', 'full'] })).not.toEqual([]);
  });
});

describe('timed effects in the engine', () => {
  const draw = (id, opts = {}) => roll1(before('market', { market: [id], ...opts }));
  it('a market card starts an effect that lasts the draw turn and the next 2 turns, then ends with an event', () => {
    let s = draw('fmkt-003');
    expect(s.effects).toEqual([{ kind: 'cheapLoan', turnsLeft: 3, cardId: 'fmkt-003', rate: 0.005 }]);
    expect(s.events.find((e) => e.type === 'effectStarted')).toMatchObject({ kind: 'cheapLoan', turnsLeft: 3 });
    s = quietTurns(s, 1);
    expect(loanRateNow(s)).toBe(0.005);
    s = quietTurns(s, 1);
    expect(loanRateNow(s)).toBe(0.005);
    s = roll1({ ...s, position: idx('charity', 0) - 2 });
    expect(s.effects).toEqual([]);
    expect(s.events.some((e) => e.type === 'effectEnded' && e.cardId === 'fmkt-003')).toBe(true);
    expect(loanRateNow(s)).toBe(LOAN_PAYMENT_RATE);
  });
  it('cheap loan: a loan taken in the window keeps 0.5% a month until repaid; the dialog figures and the limit use it', () => {
    let s = draw('fmkt-003');
    expect(loanTerms(10000, loanRateNow(s)).monthly).toBe(50);
    const normalRoom = loanLimits({ ...s, effects: [] }).byFlow;
    expect(loanLimits(s).byFlow).toBeGreaterThan(normalRoom);
    s = engine.takeLoan(s, 10000);
    const l = s.liabilities.find((x) => x.kind === 'loan');
    expect(l).toMatchObject({ principal: 10000, monthlyPayment: 50, rate: 0.005 });
    s = quietTurns(s, 3);
    expect(s.effects).toEqual([]);
    expect(s.liabilities.find((x) => x.kind === 'loan')).toMatchObject({ monthlyPayment: 50, rate: 0.005 });
    s = engine.takeLoan(s, 10000);
    expect(s.liabilities.filter((x) => x.kind === 'loan').at(-1)).toMatchObject({ monthlyPayment: 100, rate: LOAN_PAYMENT_RATE });
    const back = deserialize(serialize({ kind: 'match', players: [{ state: s }], schemaVersion: SCHEMA_VERSION }));
    expect(back.players[0].state.liabilities.find((x) => x.kind === 'loan').rate).toBe(0.005);
  });
  it('rent change: an apartment earns rent x -10% less (the bank payment stays), in the win check and at payday, for 3 turns', () => {
    let s = before('opportunity', { opportunity: ['opp-apt-004'] });
    s = engine.buy(roll1({ ...s, cash: 500000 }));
    expect(s.assets[0].rent).toBe(9500);
    const passive = passiveIncome(s);
    s = roll1({ ...s, position: idx('market') - 1, decks: { ...s.decks, market: ['fmkt-004', ...s.decks.market] } });
    expect(passiveIncome(s)).toBe(passive - 950);
    const flow = monthlyCashFlow(s);
    const paid = engine.roll({ ...s, position: idx('payday', 1) - 1 }, [1]).events.find((e) => e.type === 'payday');
    expect(paid.amount).toBe(flow * PAYDAY_MONTHS);
    s = quietTurns(s, 3);
    expect(passiveIncome(s)).toBe(passive);
  });
  it('property value: apartments are worth +15% / -15% on the balance sheet for 3 turns; cash and monthly money do not change', () => {
    let s = before('opportunity', { opportunity: ['opp-apt-004'] });
    s = engine.buy(roll1({ ...s, cash: 500000 }));
    const worth = netWorth(s);
    const cash = s.cash;
    const flow = monthlyCashFlow(s);
    const up = roll1({ ...s, position: idx('market') - 1, decks: { ...s.decks, market: ['fmkt-001', ...s.decks.market] } });
    expect(netWorth(up) - (up.cash - cash)).toBe(worth + 210000); // 1,400,000 x 15%
    expect(balanceSheet(up).items[0].value).toBe(1610000);
    expect(monthlyCashFlow(up)).toBe(flow);
    const down = roll1({ ...s, position: idx('market') - 1, decks: { ...s.decks, market: ['fmkt-002', ...s.decks.market] } });
    expect(balanceSheet(down).items[0].value).toBe(1190000);
    expect(balanceSheet(quietTurns(up, 3)).items[0].value).toBe(1400000);
  });
  it('a second card of the same kind replaces the running one (no stacking)', () => {
    let s = draw('fmkt-001');
    s = quietTurns(s, 1);
    s = roll1({ ...s, position: idx('market') - 1, decks: { ...s.decks, market: ['fmkt-002', ...s.decks.market] } });
    expect(s.effects).toEqual([{ kind: 'propertyValue', turnsLeft: 3, cardId: 'fmkt-002', pct: -0.15 }]);
  });
  it('family offer cards do not exist, so a family market square never opens an offer', () => {
    expect(data.cards.filter((c) => c.effect === 'offer' && c.modes.includes('family'))).toEqual([]);
    for (let seed = 1; seed <= 20; seed++) {
      let s = engine.newGame({ mode: 'family', professionId: 'nurse', seed });
      let guard = 0;
      while (s.status === 'playing' && s.turn < 60 && guard++ < 3000) {
        s = botStep(engine, s, 'alwaysBuy');
        expect(s.pending?.kind).not.toBe('offer');
      }
    }
  });
});

describe('profession tax lines (2026, docs/v3/real-world-verified.md)', () => {
  const tax = (id) => data.professions.find((p) => p.id === id).expenses.find((e) => e.id === 'tax').amount;
  const guide = JSON.parse(readFileSync(new URL('../src/data/learn/guide.he.json', import.meta.url), 'utf8'));
  const rows = guide.statementPopover?.profession?.rows ?? Object.values(guide).find((v) => v?.profession?.rows)?.profession.rows;
  it('engineer and programmer up, cook and driver down, round numbers; the teacher line quoted by the lessons stays 900', () => {
    expect([tax('engineer'), tax('programmer'), tax('cook'), tax('driver'), tax('teacher')]).toEqual([1950, 2300, 600, 700, 900]);
    for (const p of data.professions) expect(tax(p.id) % 50, p.id).toBe(0);
  });
  it('the changed lines are within 3% of the real 2026 income tax + national insurance', () => {
    for (const id of ['engineer', 'programmer', 'cook', 'driver']) {
      const real = rows[id].realTaxPlusNi;
      expect(Math.abs(tax(id) - real) / real, id).toBeLessThan(0.03);
    }
  });
});

describe('save schema 4: a v2.5 save (schema 3) loads and plays on', () => {
  const fixture = readFileSync(new URL('./fixtures/save-v2.5-schema3.json', import.meta.url), 'utf8');
  it('migrates 3 -> 4: lap 0 and no effects for every player, everything else kept', () => {
    const old = JSON.parse(fixture);
    expect(old.schemaVersion).toBe(3);
    const m = deserialize(fixture);
    expect(m.schemaVersion).toBe(5);
    m.players.forEach((p, i) => {
      expect(p.state.schemaVersion).toBe(5);
      expect(p.state.lap).toBe(0);
      expect(p.state.effects).toEqual([]);
      const { lap, effects, schemaVersion, milestones, taxAudit, ...rest } = p.state;
      const { schemaVersion: oldVersion, ...oldRest } = old.players[i].state;
      expect(rest).toEqual(oldRest);
    });
    // the old loan keeps its own 1% rate; an old asset has no rent field and simply ignores a rent card
    const loan = m.players[0].state.liabilities.find((l) => l.kind === 'loan');
    expect(loan.rate).toBe(0.01);
    expect(maxLoan(m.players[0].state)).toBeGreaterThanOrEqual(0);
  });
  it('plays on for 40 more turns with bots, and saves / loads again as schema 4', () => {
    let m = deserialize(fixture);
    const start = m.turns;
    let guard = 0;
    while (m.status === 'playing' && m.turns < start + 40 && guard++ < 5000) {
      if (canEndTurn(m)) { m = endTurn(m); continue; }
      m = act(m, (s) => botStep(engine, s, 'sensible'));
    }
    expect(m.turns > start || m.status !== 'playing').toBe(true);
    const back = deserialize(serialize(m));
    expect(back.schemaVersion).toBe(5);
    expect(currentState(back)).toEqual(currentState(m));
    expect(m.players.some((p) => p.state.lap > 0)).toBe(true);
  });
});

