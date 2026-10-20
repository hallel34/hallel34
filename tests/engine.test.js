import { describe, it, expect } from 'vitest';
import {
  createEngine, EngineError, BOARD, serialize, deserialize, SCHEMA_VERSION,
  PAYDAY_MONTHS, loanPaydayImpact, paybackYears, paybackTier, monthlyCashFlow, passiveIncome, totalExpenses, totalIncome, maxLoan, statement,
} from '../src/engine/index.js';

const profession = {
  id: 'test', title: 'בדיקה', salary: 10000, savings: 5000, perChild: 500,
  expenses: [{ id: 'housing', label: 'דירה', amount: 5000 }],
  liabilities: [],
};
const apt = {
  id: 'opp-apt', deck: 'opportunity', type: 'apartment', modes: ['family', 'full'],
  title: 'דירה', text: 't', price: 500000, downPayment: 20000, mortgage: 480000, monthlyCashFlow: 1000,
};
const stock = {
  id: 'opp-stk', deck: 'opportunity', type: 'stock', modes: ['full'], title: 'מניה', text: 't',
  symbol: 'AAA', price: 10, dividend: 1, maxQty: 100,
};
const expense = { id: 'exp', deck: 'expense', modes: ['family', 'full'], title: 'תיקון', text: 't', amount: 1500 };
const cashEvt = { id: 'mkt-cash', deck: 'market', modes: ['family', 'full'], effect: 'cash', title: 'בונוס', text: 't', amount: 700 };
const offerEvt = {
  id: 'mkt-offer', deck: 'market', modes: ['full'], effect: 'offer', targetType: 'apartment',
  offerPct: 1.2, title: 'הצעה', text: 't',
};
const famCash = { ...cashEvt, id: 'mkt-cash-fam', modes: ['family'] };
const priceEvt = {
  id: 'mkt-price', deck: 'market', modes: ['full'], effect: 'stockPrice', symbol: 'AAA', newPrice: 25,
  title: 'עליה', text: 't',
};

function mk(cards, prof = profession) {
  return createEngine({ professions: [prof], cards });
}
const BASE = [apt, expense, cashEvt];
const idx = (type, nth = 0) => BOARD.map((t, i) => (t === type ? i : -1)).filter((i) => i >= 0)[nth];
const at = (s, position) => ({ ...s, position });
const withState = (s, patch) => ({ ...s, ...patch });

// roll so that the pawn lands exactly on `square` (one die only)
function landOn(e, s, square) {
  const target = idx(square);
  return e.roll(at(s, target - 1), [1]); // one step: crosses no payday
}

describe('setup and determinism', () => {
  it('starts with profession values, no mutation of inputs', () => {
    const e = mk(BASE);
    const s = e.newGame({ mode: 'full', professionId: 'test', seed: 5 });
    expect(s.cash).toBe(5000);
    expect(monthlyCashFlow(s)).toBe(5000);
    expect(s.status).toBe('playing');
    expect(s.phase).toBe('roll');
    const frozen = JSON.stringify(s);
    e.roll(s);
    expect(JSON.stringify(s)).toBe(frozen);
  });
  it('is reproducible from the same seed', () => {
    const e = mk(BASE);
    const run = () => {
      let s = e.newGame({ mode: 'full', professionId: 'test', seed: 99 });
      const out = [];
      for (let i = 0; i < 8; i++) {
        s = e.roll(s);
        out.push(s.lastRoll.dice[0]);
        if (s.pending?.kind === 'opportunity') s = e.pass(s);
        if (s.pending?.kind === 'charity') s = e.declineCharity(s);
        if (s.status !== 'playing') break;
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
  it('has a 24-square board containing all required square types', () => {
    expect(BOARD).toHaveLength(24);
    for (const t of ['opportunity', 'expense', 'market', 'baby', 'charity', 'payday']) {
      expect(BOARD).toContain(t);
    }
  });
  it('rejects invalid data loudly', () => {
    expect(() => createEngine({ professions: [profession], cards: [{ ...apt, price: 1 }] })).toThrow(/price must equal/);
    expect(() => createEngine({ professions: [profession], cards: [apt, expense] })).toThrow(/no market/);
  });
});

describe('payday', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  const payday1 = idx('payday', 1);

  it('pays monthly cash flow when landing on payday', () => {
    const s = e.roll(at(s0, payday1 - 3), [3]);
    expect(s.cash).toBe(5000 + 5000 * PAYDAY_MONTHS);
    expect(s.stats.paydays).toBe(1);
  });
  it('pays when passing a payday square', () => {
    const s = e.roll(at(s0, payday1 - 1), [3]);
    expect(s.cash).toBe(5000 + 5000 * PAYDAY_MONTHS);
  });
  it('pays once per payday square crossed and wraps around the board', () => {
    const s = e.roll(at(s0, 22), [4]); // passes 22->23,0(payday),1,2
    expect(s.stats.paydays).toBe(1);
    const s2 = e.roll(at(s0, 3), [5]); // 4 (payday) .. 7 (payday) -> two paydays
    expect(s2.stats.paydays).toBe(2);
    expect(s2.cash).toBe(5000 + 2 * 5000 * PAYDAY_MONTHS);
  });
  it('does not pay when not crossing a payday', () => {
    const s = e.roll(at(s0, 1), [1]); // lands on expense square 2
    expect(s.stats.paydays).toBe(0);
  });
  it('payday includes passive income and subtracts liabilities', () => {
    let s = at(s0, 3);
    s = { ...s, assets: [{ id: 'a', type: 'apartment', price: 1, mortgage: 0, monthlyCashFlow: 700 }] };
    s = withState(s, { liabilities: [{ id: 'l', kind: 'loan', principal: 2000, monthlyPayment: 200 }] });
    expect(monthlyCashFlow(s)).toBe(10000 + 700 - 5000 - 200);
    const r = e.roll(s, [1]);
    expect(r.cash).toBe(5000 + 5500 * PAYDAY_MONTHS);
  });
});

describe('payday scale and debug helper', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('a payday settles PAYDAY_MONTHS months of cash flow and reports it', () => {
    const s = e.roll(at(s0, idx('payday', 1) - 1), [1]);
    const ev = s.events.find((x) => x.type === 'payday');
    expect(ev.months).toBe(PAYDAY_MONTHS);
    expect(ev.amount).toBe(5000 * PAYDAY_MONTHS);
  });
  it('debugForce ends the game as won or lost without mutating the input', () => {
    const frozen = JSON.stringify(s0);
    const w = e.debugForce(s0, 'win');
    expect(w.status).toBe('won');
    expect(w.phase).toBe('ended');
    expect(e.debugForce(s0, 'lose').status).toBe('lost');
    expect(JSON.stringify(s0)).toBe(frozen);
    expect(() => e.debugForce(w, 'win')).toThrow(); // game already over
    expect(() => e.debugForce(s0, 'nope')).toThrow(/unknown outcome/);
  });
});

describe('opportunities', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('buy: cash decreases by down payment exactly', () => {
    const s = landOn(e, withState(s0, { cash: 30000 }), 'opportunity');
    const before = s.cash;
    const b = e.buy(s);
    expect(b.cash).toBe(before - 20000);
    expect(b.assets).toHaveLength(1);
    expect(passiveIncome(b)).toBe(1000);
    expect(b.phase).toBe('roll');
    expect(b.pending).toBeNull();
  });
  it('cannot buy without enough cash; pass leaves state intact', () => {
    const s = landOn(e, withState(s0, { cash: 100 }), 'opportunity');
    expect(() => e.buy(s)).toThrow(EngineError);
    const p = e.pass(s);
    expect(p.assets).toHaveLength(0);
    expect(p.phase).toBe('roll');
  });
  it('stocks: quantity picker, merges holdings, respects maxQty', () => {
    const es = mk([stock, expense, cashEvt, apt]);
    const g = es.newGame({ mode: 'full', professionId: 'test' });
    let s = landOn(es, withState(g, { cash: 5000 }), 'opportunity');
    // deck order is shuffled; keep rolling the stock card is the only full-mode stock
    while (s.pending.card.type !== 'stock') {
      s = es.pass(s);
      s = landOn(es, s, 'opportunity');
    }
    expect(() => es.buy(s, 101)).toThrow(/limit/);
    expect(() => es.buy(s, 0)).toThrow();
    s = es.buy(s, 40);
    expect(s.assets[0].qty).toBe(40);
    expect(passiveIncome(s)).toBe(40);
  });
  it('family mode never draws stocks', () => {
    const es = mk([stock, expense, cashEvt, apt]);
    let s = es.newGame({ mode: 'family', professionId: 'test' });
    for (let i = 0; i < 10; i++) {
      s = landOn(es, withState(s, { cash: 9999999 }), 'opportunity');
      expect(s.pending.card.type).not.toBe('stock');
      s = es.pass(s);
    }
  });
});

describe('unexpected expense', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('is paid automatically when cash suffices', () => {
    const s = landOn(e, s0, 'expense');
    expect(s.cash).toBe(5000 - 1500);
    expect(s.phase).toBe('roll');
    expect(s.pending).toBeNull();
  });
  it('asks for a loan when cash is short, then pays once covered', () => {
    let s = landOn(e, withState(s0, { cash: 100 }), 'expense');
    expect(s.phase).toBe('mustPay');
    expect(s.pending.kind).toBe('expense');
    expect(() => e.roll(s)).toThrow();
    s = e.takeLoan(s, 1000); // 1100 < 1500
    expect(s.phase).toBe('mustPay');
    s = e.takeLoan(s, 1000); // 2100 >= 1500
    expect(s.pending).toBeNull();
    expect(s.phase).toBe('roll');
    expect(s.cash).toBe(600);
  });
});

describe('baby', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('adds a child and a monthly expense', () => {
    const s = landOn(e, s0, 'baby');
    expect(s.kids).toBe(1);
    expect(totalExpenses(s)).toBe(5500);
  });
  it('is capped at 3 children', () => {
    let s = s0;
    for (let i = 0; i < 5; i++) s = landOn(e, withState(s, { cash: 1e6 }), 'baby');
    expect(s.kids).toBe(3);
    expect(totalExpenses(s)).toBe(5000 + 3 * 500);
    expect(s.events.some((ev) => ev.type === 'babyMax')).toBe(true);
  });
});

describe('charity', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  const resolve = (s) => {
    if (s.pending?.kind === 'opportunity') return e.pass(s);
    if (s.pending?.kind === 'charity') return e.declineCharity(s);
    if (s.pending?.kind === 'offer') return e.declineOffer(s);
    return s;
  };
  it('offers 10% of total income', () => {
    const s = landOn(e, s0, 'charity');
    expect(s.pending).toEqual({ kind: 'charity', cost: Math.round(totalIncome(s) * 0.1) });
    expect(s.pending.cost).toBe(1000);
  });
  it('donating costs the money and gives 2 dice for exactly 3 turns', () => {
    let s = landOn(e, s0, 'charity');
    const cash = s.cash;
    s = e.donate(s);
    expect(s.cash).toBe(cash - 1000);
    expect(s.charityTurns).toBe(3);
    const lens = [];
    for (let i = 0; i < 4; i++) {
      s = resolve(e.roll(s));
      lens.push(s.lastRoll.dice.length);
    }
    expect(lens).toEqual([2, 2, 2, 1]);
    expect(s.charityTurns).toBe(0);
  });
  it('declining changes nothing; cannot donate without cash', () => {
    const s = landOn(e, s0, 'charity');
    const d = e.declineCharity(s);
    expect(d.cash).toBe(s.cash);
    expect(d.charityTurns).toBe(0);
    expect(() => e.donate({ ...s, cash: 10 })).toThrow(/cash/);
  });
});

describe('market events', () => {
  it('cash effect applies immediately', () => {
    const e = mk(BASE);
    const s0 = e.newGame({ mode: 'family', professionId: 'test' });
    const s = landOn(e, s0, 'market');
    expect(s.cash).toBe(5700);
  });
  it('offer to buy one of your assets: proceeds = offer - mortgage', () => {
    const e = mk([apt, expense, offerEvt, famCash]);
    const s0 = e.newGame({ mode: 'full', professionId: 'test' });
    const owned = { id: 'asset-9', cardId: 'x', type: 'apartment', title: 'דירה', price: 500000, downPayment: 20000, mortgage: 480000, monthlyCashFlow: 1000 };
    let s = landOn(e, withState(s0, { assets: [owned] }), 'market');
    expect(s.pending.kind).toBe('offer');
    expect(s.pending.offerPrice).toBe(600000);
    expect(s.pending.proceeds).toBe(120000);
    const cash = s.cash;
    s = e.acceptOffer(s);
    expect(s.assets).toHaveLength(0);
    expect(s.cash).toBe(cash + 120000);
    // decline keeps the asset
    s = landOn(e, withState(s0, { assets: [owned] }), 'market');
    expect(e.declineOffer(s).assets).toHaveLength(1);
  });
  it('offer without a matching asset is ignored', () => {
    const e = mk([apt, expense, offerEvt, famCash]);
    const s = landOn(e, e.newGame({ mode: 'full', professionId: 'test' }), 'market');
    expect(s.pending).toBeNull();
  });
  it('stock price events change the stock value', () => {
    const e = mk([apt, stock, expense, priceEvt, famCash]);
    const owned = { id: 'a1', type: 'stock', symbol: 'AAA', title: 'מניה', qty: 10, avgCost: 10, dividend: 1, monthlyCashFlow: 10 };
    let s = landOn(e, withState(e.newGame({ mode: 'full', professionId: 'test' }), { assets: [owned] }), 'market');
    expect(s.stockPrices.AAA).toBe(25);
    const before = s.cash;
    s = e.sellAsset(s, 'a1');
    expect(s.cash).toBe(before + 250);
  });
  it('family mode: no offers, selling or repayment', () => {
    const e = mk([apt, expense, offerEvt, famCash]);
    const s0 = e.newGame({ mode: 'family', professionId: 'test' });
    const owned = { id: 'a1', type: 'apartment', price: 100, mortgage: 0, monthlyCashFlow: 1 };
    expect(() => e.sellAsset(withState(s0, { assets: [owned] }), 'a1')).toThrow(/full/);
    const l = withState(s0, { liabilities: [{ id: 'x', kind: 'loan', principal: 1000, monthlyPayment: 100 }] });
    expect(() => e.repayLoan(l, 'x', 1000)).toThrow(/full/);
  });
});

describe('bank loans', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('only in multiples of 1,000, monthly payment 10% of principal', () => {
    expect(() => e.takeLoan(s0, 1500)).toThrow(/multiple/);
    expect(() => e.takeLoan(s0, 0)).toThrow();
    expect(() => e.takeLoan(s0, -1000)).toThrow();
    const s = e.takeLoan(s0, 3000);
    expect(s.cash).toBe(8000);
    const loan = s.liabilities.find((l) => l.kind === 'loan');
    expect(loan.principal).toBe(3000);
    expect(loan.monthlyPayment).toBe(300);
    expect(monthlyCashFlow(s)).toBe(5000 - 300);
    expect(s.stats.loansTaken).toBe(1);
  });
  it('is limited so cash flow stays above -20% of salary', () => {
    expect(maxLoan(s0)).toBe(70000); // (5000 + 2000) / 100 payment per 1000
    expect(() => e.takeLoan(s0, 71000)).toThrow(/limit/);
    const s = e.takeLoan(s0, 70000);
    expect(monthlyCashFlow(s)).toBe(-2000);
    expect(maxLoan(s)).toBe(0);
    expect(() => e.takeLoan(s, 1000)).toThrow(/limit/);
  });
  it('reports the payday impact of a loan and flags an unaffordable settlement', () => {
    const small = loanPaydayImpact(s0, 3000);
    expect(small.flow).toBe(4700);
    expect(small.payday).toBe(4700 * PAYDAY_MONTHS);
    expect(small.risky).toBe(false);
    const max = loanPaydayImpact(s0, maxLoan(s0));
    expect(max.flow).toBe(-2000);
    expect(max.payday).toBe(-2000 * PAYDAY_MONTHS);
    expect(max.cashAfter).toBe(s0.cash + 70000 - 2000 * PAYDAY_MONTHS);
    expect(loanPaydayImpact(withState(s0, { cash: 0 }), 1000).risky).toBe(false);
    expect(loanPaydayImpact(withState(s0, { cash: 0 }), 70000).risky).toBe(false); // the money is still in hand
    // the loan pays for a purchase: cash after = cash + loan - spend, then the (negative) payday lands
    const bought = loanPaydayImpact(withState(s0, { cash: 0 }), 70000, 70000);
    expect(bought.cashAfter).toBe(-2000 * PAYDAY_MONTHS);
    expect(bought.risky).toBe(true);
  });
  it('can be repaid in full mode and the payment shrinks', () => {
    let s = e.takeLoan(s0, 4000);
    const id = s.liabilities.find((l) => l.kind === 'loan').id;
    s = e.repayLoan(s, id, 1000);
    const loan = s.liabilities.find((l) => l.id === id);
    expect(loan.principal).toBe(3000);
    expect(loan.monthlyPayment).toBe(300);
    s = e.repayLoan(s, id, 3000);
    expect(s.liabilities.find((l) => l.id === id)).toBeUndefined();
    expect(monthlyCashFlow(s)).toBe(5000);
    expect(() => e.repayLoan(s0, 'nope', 1000)).toThrow();
  });
});

describe('game over', () => {
  const e = mk(BASE);
  const broke = (s) => withState(s, {
    cash: 0, profession: { ...s.profession, salary: 1000 }, // cash flow -4000, no loan room
  });
  const s0 = e.newGame({ mode: 'full', professionId: 'test' });
  it('negative cash flow + no cash + loan limit reached = game over', () => {
    const s = broke(s0);
    expect(monthlyCashFlow(s)).toBeLessThan(0);
    expect(maxLoan(s)).toBe(0);
    const r = landOn(e, s, 'expense');
    expect(r.status).toBe('lost');
    expect(r.phase).toBe('ended');
    expect(() => e.roll(r)).toThrow(/over/);
  });
  it('is not game over while a loan is still available', () => {
    const r = landOn(e, withState(s0, { cash: 0 }), 'expense'); // cash flow positive
    expect(r.status).toBe('playing');
    expect(r.phase).toBe('mustPay');
    expect(maxLoan(r)).toBeGreaterThan(0);
  });
  it('is not game over when cash covers the expense', () => {
    const r = landOn(e, withState(broke(s0), { cash: 5000 }), 'expense');
    expect(r.status).toBe('playing');
  });
  it('negative payday that drains cash with no loan room ends the game', () => {
    const r = e.roll(at(broke(s0), idx('payday', 1) - 3), [3]);
    expect(r.cash).toBeLessThan(0);
    expect(r.status).toBe('lost');
  });
  it('full mode: owning something sellable avoids game over, family mode does not', () => {
    const owned = { id: 'a1', type: 'apartment', price: 100000, mortgage: 0, monthlyCashFlow: 0 };
    const s = landOn(e, withState(broke(s0), { assets: [owned] }), 'expense');
    expect(s.status).toBe('playing');
    const ef = mk(BASE);
    const f0 = ef.newGame({ mode: 'family', professionId: 'test' });
    const f = landOn(ef, withState(broke(f0), { assets: [owned] }), 'expense');
    expect(f.status).toBe('lost');
  });
});

describe('win condition', () => {
  const e = mk(BASE);
  const s0 = e.newGame({ mode: 'full', professionId: 'test', seed: 3 });
  const owned = (cf) => ({ id: 'a0', type: 'business', price: 1, mortgage: 0, downPayment: 1, monthlyCashFlow: cf });
  it('wins when passive income is strictly greater than total expenses', () => {
    const s = landOn(e, withState(s0, { cash: 30000, assets: [owned(4500)] }), 'opportunity');
    expect(s.status).toBe('playing');
    const w = e.buy(s); // +1000 passive => 5500 > 5000
    expect(passiveIncome(w)).toBe(5500);
    expect(w.status).toBe('won');
    expect(w.phase).toBe('ended');
    expect(w.winTurn).toBe(w.turn);
    expect(() => e.roll(w)).toThrow();
  });
  it('equal passive income and expenses is not a win', () => {
    const s = landOn(e, withState(s0, { cash: 30000, assets: [owned(4000)] }), 'opportunity');
    const b = e.buy(s); // 5000 == 5000
    expect(passiveIncome(b)).toBe(5000);
    expect(b.status).toBe('playing');
  });
  it('a baby (higher expenses) can undo being close to winning', () => {
    const s = landOn(e, withState(s0, { assets: [owned(5200)] }), 'baby');
    expect(s.kids).toBe(1);
    expect(s.status).toBe('playing'); // 5200 < 5500
  });
  it('statement exposes the numbers the UI needs', () => {
    const st = statement(e.newGame({ mode: 'full', professionId: 'test' }));
    expect(st).toMatchObject({ salary: 10000, totalExpenses: 5000, monthlyCashFlow: 5000, cash: 5000 });
  });
});

describe('save / load', () => {
  const e = mk(BASE);
  it('round-trips and resumes identically', () => {
    let s = e.newGame({ mode: 'full', professionId: 'test', seed: 11 });
    s = e.roll(s);
    const loaded = deserialize(serialize(s));
    expect(loaded).toEqual(s);
    if (!s.pending) expect(e.roll(loaded)).toEqual(e.roll(s));
  });
  it('rejects corrupt or too-new saves', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    expect(deserialize(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))).toBeNull();
  });
});

describe('payback helpers', () => {
  it('computes years and tiers', () => {
    expect(paybackYears(12000, 1000)).toBe(1);
    expect(paybackYears(12000, 0)).toBe(Infinity);
    expect(paybackYears(12000, -5)).toBe(Infinity);
    expect(paybackTier(8)).toBe('ok');
    expect(paybackTier(8.1)).toBe('slow');
    expect(paybackTier(14)).toBe('slow');
    expect(paybackTier(14.1)).toBe('bad');
    expect(paybackTier(Infinity)).toBe('bad');
  });
});
