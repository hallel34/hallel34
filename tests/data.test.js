import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, validateData, validateCards, validateProfessions, playGame, BOTS, monthlyCashFlow,
  MORTGAGE_PAYMENT_RATE, BUSINESS_LOAN_PAYMENT_RATE, BASE_DEBT_RATES, LOAN_PAYMENT_RATE,
} from '../src/engine/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const data = {
  professions: read('../src/data/professions.he.json'),
  cards: read('../src/data/cards.he.json'),
};
const he = read('../src/i18n/he.json');

describe('content data', () => {
  it('passes schema validation', () => {
    expect(validateData(data)).toBe(true);
  });
  it('meets the content minimums', () => {
    const n = (deck) => data.cards.filter((c) => c.deck === deck).length;
    expect(n('opportunity')).toBeGreaterThanOrEqual(15);
    expect(n('expense')).toBeGreaterThanOrEqual(12);
    expect(n('market')).toBeGreaterThanOrEqual(10);
    expect(data.professions.length).toBeGreaterThanOrEqual(6);
    expect(data.professions.length).toBeLessThanOrEqual(8);
  });
  it('family mode has apartments and businesses only, no stocks', () => {
    const fam = data.cards.filter((c) => c.deck === 'opportunity' && c.modes.includes('family'));
    expect(fam.length).toBeGreaterThanOrEqual(8);
    expect(fam.every((c) => c.type === 'apartment' || c.type === 'business')).toBe(true);
    expect(data.cards.some((c) => c.type === 'stock' && c.modes.includes('family'))).toBe(false);
  });
  it('starting cash flow per profession is within 300-2500', () => {
    const e = createEngine(data);
    for (const p of data.professions) {
      const cf = monthlyCashFlow(e.newGame({ professionId: p.id }));
      expect(cf).toBeGreaterThanOrEqual(300);
      expect(cf).toBeLessThanOrEqual(2500);
    }
  });
  it('cards are Hebrew text', () => {
    for (const c of data.cards) expect(c.title).toMatch(/[֐-׿]/);
  });
  it('validation catches bad cards', () => {
    expect(validateCards([{ id: 'x', deck: 'nope' }]).length).toBeGreaterThan(0);
  });
  it('i18n skeleton parses and has no empty strings', () => {
    const walk = (o) => Object.values(o).forEach((v) => (typeof v === 'object' ? walk(v) : expect(v.length).toBeGreaterThan(0)));
    walk(he);
  });
});

const deals = (mode) => data.cards.filter((c) => c.deck === 'opportunity' && c.type !== 'stock' && c.modes.includes(mode));
const paybackYears = (c) => c.downPayment / c.monthlyCashFlow / 12;
const isTrap = (c) => c.monthlyCashFlow <= 0 || paybackYears(c) > 14;

describe('deal economics', () => {
  it('good deals pay back their down payment in 3-6 years (small) or 7-12 years (big)', () => {
    for (const c of data.cards.filter((x) => x.type && x.type !== 'stock' && !isTrap(x))) {
      const y = paybackYears(c);
      expect(y, c.id).toBeGreaterThanOrEqual(3);
      expect(y, c.id).toBeLessThanOrEqual(c.downPayment >= 150000 ? 12 : 6);
    }
  });
  it('about 35-40% of the opportunity cards are traps in each mode (obvious and subtle)', () => {
    for (const mode of ['family', 'full']) {
      const all = data.cards.filter((c) => c.deck === 'opportunity' && c.modes.includes(mode));
      const traps = deals(mode).filter(isTrap);
      expect(traps.length / all.length, mode).toBeGreaterThanOrEqual(0.33);
      expect(traps.length / all.length, mode).toBeLessThanOrEqual(0.42);
      // subtle traps: positive cash flow but terrible payback
      expect(traps.some((c) => c.monthlyCashFlow > 0), mode).toBe(true);
      expect(traps.some((c) => c.monthlyCashFlow < 0), mode).toBe(true);
    }
  });
  it('family mode uses round numbers (prices 1000, down payment / mortgage 500, cash flow and loan payment 100)', () => {
    for (const c of data.cards.filter((x) => x.modes.includes('family'))) {
      if (c.deck === 'opportunity') {
        expect(c.price % 1000, c.id).toBe(0);
        expect(c.downPayment % 500, c.id).toBe(0);
        expect(c.mortgage % 500, c.id).toBe(0);
        expect(Math.abs(c.monthlyCashFlow % 100), c.id).toBe(0);
        if (c.loanPayment !== undefined) expect(c.loanPayment % 100, c.id).toBe(0);
        if (c.rent !== undefined) expect(c.rent % 100, c.id).toBe(0);
        if (c.profit !== undefined) expect(Math.abs(c.profit % 100), c.id).toBe(0);
      } else if (c.deck === 'expense' || c.effect === 'cash') {
        expect(Math.abs(c.amount % 500), c.id).toBe(0);
      }
    }
  });
  it('the three stocks differ: dividend yield 0.25-0.8% per month and distinct volatility', () => {
    const stocks = data.cards.filter((c) => c.type === 'stock');
    expect(stocks.length).toBeGreaterThanOrEqual(3);
    const yields = stocks.map((c) => c.dividend / c.price);
    for (const y of yields) { expect(y).toBeGreaterThanOrEqual(0.0025); expect(y).toBeLessThanOrEqual(0.008); }
    expect(new Set(yields.map((y) => y.toFixed(4))).size).toBe(stocks.length);
    const swing = (sym) => {
      const base = stocks.find((c) => c.symbol === sym).price;
      const moves = data.cards.filter((c) => c.effect === 'stockPrice' && c.symbol === sym).map((c) => Math.abs(c.newPrice / base - 1));
      return Math.max(...moves);
    };
    const [elm, mav, sol] = ['ELM', 'MAV', 'SOL'].map(swing);
    expect(mav).toBeLessThan(elm);
    expect(elm).toBeLessThan(sol);
  });
  it('businesses finance with a loan, not a mortgage (label), and have no stray text bugs', () => {
    expect(he.card.businessLoan).toBe('הלוואה');
    expect(he.card.businessLoan).not.toBe(he.card.mortgage);
    expect(data.cards.find((c) => c.id === 'exp-004').text).not.toContain('זה חתיכה');
  });
});

describe('v2 numbers (N2, N4, N5)', () => {
  const deal = (c) => c.deck === 'opportunity' && (c.type === 'apartment' || c.type === 'business');
  const orig = {
    // cash flow before the v2 scale (rounded to 100 after: apartments x0.85, businesses x0.9)
    'opp-apt-001': 4000, 'opp-apt-002': 6000, 'opp-apt-003': 5000, 'opp-apt-004': 3000, 'opp-apt-005': 6000, 'opp-apt-006': 8000,
    'opp-apt-007': 10000, 'opp-apt-008': 1000, 'opp-apt-011': 1500, 'opp-apt-012': 1000, 'opp-apt-013': 3000, 'opp-apt-014': 4500,
    'opp-apt-015': 7000, 'opp-apt-016': 5000, 'opp-biz-001': 3000, 'opp-biz-002': 2000, 'opp-biz-003': 2500, 'opp-biz-004': 1500,
    'opp-biz-005': 3500, 'opp-biz-006': 1000, 'opp-biz-007': 3000, 'opp-biz-008': 3000, 'opp-biz-009': 1000, 'opp-biz-012': 1500,
    'opp-biz-013': 500, 'opp-biz-014': 2000, 'opp-biz-015': 5000,
  };
  const round100 = (x) => Math.round(x / 100) * 100;
  it('positive apartments x0.85 and businesses x0.9 (rounded to 100); loss-making cards unchanged', () => {
    for (const [id, before] of Object.entries(orig)) {
      const c = data.cards.find((x) => x.id === id);
      expect(c.monthlyCashFlow, id).toBe(round100(before * (c.type === 'apartment' ? 0.85 : 0.9)));
    }
    const losses = { 'opp-apt-009': -6000, 'opp-apt-010': -5000, 'opp-biz-010': -6000, 'opp-biz-011': -8000, 'opp-biz-016': -6000 };
    for (const [id, v] of Object.entries(losses)) expect(data.cards.find((x) => x.id === id).monthlyCashFlow, id).toBe(v);
  });
  it('stock dividends: ELM 2, MAV 2 (whole shekels only), SOL 3', () => {
    const d = (sym) => data.cards.find((c) => c.symbol === sym && c.type === 'stock').dividend;
    expect([d('ELM'), d('MAV'), d('SOL')]).toEqual([2, 2, 3]);
    for (const c of data.cards.filter((x) => x.type === 'stock')) expect(Number.isInteger(c.dividend), c.id).toBe(true);
  });
  it('every apartment and business card has the breakdown: rent/profit - loanPayment = monthlyCashFlow', () => {
    for (const c of data.cards.filter(deal)) {
      const gross = c.type === 'apartment' ? c.rent : c.profit;
      expect(Number.isFinite(gross), c.id).toBe(true);
      expect(Number.isFinite(c.loanPayment), c.id).toBe(true);
      expect(gross - c.loanPayment, c.id).toBe(c.monthlyCashFlow);
    }
  });
  it('loanPayment follows the configured rates (within 50 NIS of rate x loan)', () => {
    for (const c of data.cards.filter(deal)) {
      const rate = c.type === 'apartment' ? MORTGAGE_PAYMENT_RATE : BUSINESS_LOAN_PAYMENT_RATE;
      expect(Math.abs(c.loanPayment - c.mortgage * rate), c.id).toBeLessThanOrEqual(50);
    }
  });
  it('the validator rejects a breakdown that does not add up, or half a breakdown', () => {
    const base = data.cards.find((c) => c.id === 'opp-apt-001');
    expect(validateCards([{ ...base }]).filter((e) => /rent|loanPayment/.test(e))).toEqual([]);
    expect(validateCards([{ ...base, rent: base.rent + 100 }]).some((e) => /rent - loanPayment/.test(e))).toBe(true);
    const { loanPayment, ...noLoan } = base;
    expect(validateCards([noLoan]).some((e) => /go together/.test(e))).toBe(true);
    expect(validateCards([{ ...base, profit: 1 }]).some((e) => /profit is not allowed/.test(e))).toBe(true);
    // the fields stay optional: a card without them is valid
    const { rent, loanPayment: lp, ...plain } = base;
    expect(validateCards([plain]).filter((e) => /rent|loanPayment|profit/.test(e))).toEqual([]);
  });
  it('realWorld is an optional boolean flag', () => {
    const base = data.cards.find((c) => c.id === 'opp-apt-001');
    expect(validateCards([{ ...base, realWorld: 'yes' }]).some((e) => /realWorld/.test(e))).toBe(true);
    expect(validateCards([{ ...base, realWorld: false }]).some((e) => /realWorld/.test(e))).toBe(false);
    const flagged = data.cards.filter((c) => c.realWorld === true).map((c) => c.id);
    for (const id of ['opp-apt-001', 'opp-apt-007', 'opp-apt-013', 'opp-biz-001', 'opp-biz-015', 'opp-stk-001', 'mkt-001']) expect(flagged).toContain(id);
  });
  it('opp-biz-016 is the licensed restaurant (no unlicensed bar), same numbers', () => {
    const c = data.cards.find((x) => x.id === 'opp-biz-016');
    expect(c.title).toBe('מסעדת שף עם תפריט טעימות');
    expect(c).toMatchObject({ price: 800000, downPayment: 400000, mortgage: 400000, monthlyCashFlow: -6000, modes: ['full'] });
    expect(data.cards.some((x) => /בר קוקטיילים|בלי רישיון/.test(`${x.title}${x.text}`))).toBe(false);
  });
  it('starting debts follow one model: payment = principal x the rate of its kind', () => {
    expect(BASE_DEBT_RATES).toEqual({ car: 0.02, student: 0.01, card: 0.03 });
    for (const p of data.professions) for (const l of p.liabilities) {
      expect(l.debt, `${p.id}/${l.id}`).toBeDefined();
      expect(l.monthlyPayment, `${p.id}/${l.id}`).toBe(Math.round((l.principal * BASE_DEBT_RATES[l.debt]) / 10) * 10);
      expect(l.monthlyPayment / l.principal).toBeLessThanOrEqual(0.03);
    }
    // never above the 1% bank loan by more than a car / card installment would justify, and student debt equals it
    expect(BASE_DEBT_RATES.student).toBe(LOAN_PAYMENT_RATE);
  });
  it('the profession validator flags a payment that breaks the model', () => {
    const p = structuredClone(data.professions[0]);
    p.liabilities[0].monthlyPayment += 10;
    expect(validateProfessions([p]).some((e) => /payment must be/.test(e))).toBe(true);
    p.liabilities[0].debt = 'boat';
    expect(validateProfessions([p]).some((e) => /unknown debt kind/.test(e))).toBe(true);
  });
});

describe('full games with real data', () => {
  const e = createEngine(data);
  for (const mode of ['family', 'full']) {
    it(`every profession finishes games in ${mode} mode without engine errors`, () => {
      for (const p of data.professions) {
        for (let seed = 1; seed <= 5; seed++) {
          const s = playGame(e, e.newGame({ mode, professionId: p.id, seed }), 'sensible', 300);
          expect(['won', 'lost', 'playing']).toContain(s.status);
          expect(s.turn).toBeGreaterThan(0);
        }
      }
    });
    it(`sensible bot averages roughly 12-30 turns to win in ${mode} mode`, () => {
      const turns = [];
      for (let g = 0; g < 40; g++) {
        const p = data.professions[g % data.professions.length].id;
        const s = playGame(e, e.newGame({ mode, professionId: p, seed: 500 + g }), 'sensible', 300);
        if (s.status === 'won') turns.push(s.turn);
      }
      expect(turns.length).toBeGreaterThan(30);
      const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
      expect(avg).toBeGreaterThan(12);
      expect(avg).toBeLessThan(30);
    });
  }
  it('always-buy clearly loses to the sensible bot (>=15% lost, or much slower, or >=10% lost and slower)', () => {
    const run = (bot, mode) => {
      let lost = 0; const turns = [];
      for (let g = 0; g < 80; g++) {
        const p = data.professions[g % data.professions.length].id;
        const s = playGame(e, e.newGame({ mode, professionId: p, seed: 9000 + g * 31 }), bot, 200);
        if (s.status === 'lost') lost += 1; else if (s.status === 'won') turns.push(s.turn);
      }
      return { lost: lost / 80, avg: turns.reduce((a, b) => a + b, 0) / (turns.length || 1) };
    };
    for (const mode of ['family', 'full']) {
      const sens = run('sensible', mode);
      const rec = run('alwaysBuy', mode);
      expect(sens.lost).toBeLessThan(0.1);
      // 1% loans made leverage cheaper, so the margin in full mode is narrower than in v1 (13% lost AND ~20% slower, p90 +40%)
      expect(rec.lost >= 0.15 || rec.avg > sens.avg * 1.3 || (rec.lost >= 0.1 && rec.avg > sens.avg * 1.1)).toBe(true);
    }
  });
  it('the loan cap never strands a bot: every bot finishes 120 games per mode without an engine error', () => {
    for (const mode of ['family', 'full']) {
      for (const bot of Object.keys(BOTS)) {
        for (let g = 0; g < 30; g++) {
          const p = data.professions[g % data.professions.length].id;
          const s = playGame(e, e.newGame({ mode, professionId: p, seed: 2000 + g * 17 }), bot, 120); // throws if a bot has no legal move
          expect(['won', 'lost', 'playing']).toContain(s.status);
        }
      }
    }
  });
  it('always passing never wins (no free lunch)', () => {
    const s = playGame(e, e.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), 'alwaysPass', 150);
    expect(s.status).not.toBe('won');
    expect(Object.keys(BOTS)).toContain('alwaysPass');
  });
});

describe('card text matches mechanics', () => {
  it('no card promises a balloon payment (the engine has none)', () => {
    for (const c of data.cards) expect(c.text).not.toMatch(/בלון/);
  });
  it('opp-apt-007 text agrees with its positive cash flow', () => {
    const c = data.cards.find((x) => x.id === 'opp-apt-007');
    expect(c.monthlyCashFlow).toBeGreaterThan(0);
    expect(c.text).not.toMatch(/כמעט משלמת/);
  });
});
