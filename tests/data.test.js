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
  it('always passing never wins (no free lunch)', () => {
    const s = playGame(e, e.newGame({ mode: 'full', professionId: 'teacher', seed: 3 }), 'alwaysPass', 150);
    expect(s.status).not.toBe('won');
    expect(Object.keys(BOTS)).toContain('alwaysPass');
  });
});
