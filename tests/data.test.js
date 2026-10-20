import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, validateData, validateCards, playGame, BOTS, monthlyCashFlow,
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
  it('family mode uses round numbers (multiples of 500, 1000 for prices)', () => {
    for (const c of data.cards.filter((x) => x.modes.includes('family'))) {
      if (c.deck === 'opportunity') {
        expect(c.price % 1000, c.id).toBe(0);
        expect(c.downPayment % 500, c.id).toBe(0);
        expect(c.mortgage % 500, c.id).toBe(0);
        expect(Math.abs(c.monthlyCashFlow % 500), c.id).toBe(0);
      } else if (c.deck === 'expense' || c.effect === 'cash') {
        expect(Math.abs(c.amount % 500), c.id).toBe(0);
      }
    }
  });
  it('the three stocks differ: dividend yield 0.4-0.8% per month and distinct volatility', () => {
    const stocks = data.cards.filter((c) => c.type === 'stock');
    expect(stocks.length).toBeGreaterThanOrEqual(3);
    const yields = stocks.map((c) => c.dividend / c.price);
    for (const y of yields) { expect(y).toBeGreaterThanOrEqual(0.004); expect(y).toBeLessThanOrEqual(0.008); }
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
  it('always-buy clearly loses to the sensible bot (>=15% lost or much slower)', () => {
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
      expect(rec.lost >= 0.15 || rec.avg > sens.avg * 1.3).toBe(true);
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
