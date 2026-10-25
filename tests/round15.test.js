// QA round 15: the loan window's 'בעולם האמיתי' row uses the live bank rate (P3-2), the kid scan covers overridden full-only keys.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { factForPlace, realWorldView } from '../src/learn/rw.js';
import { learnContent, familyOverrideMap } from '../src/learn/content.js';
import { setLearnMode } from '../src/learn/context.js';
import { LOAN_PAYMENT_RATE } from '../src/engine/config.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));

describe('round 15: real-world loan row follows the live rate', () => {
  for (const mode of ['full', 'family']) {
    it(`${mode}: no typed rate, no unfilled slot; the cheap-loan rate changes the figures`, () => {
      setLearnMode(mode);
      const fact = factForPlace('loan-window');
      expect(fact).toBeTruthy();
      const normal = realWorldView(fact, { rate: LOAN_PAYMENT_RATE }).game;
      const cheap = realWorldView(fact, { rate: LOAN_PAYMENT_RATE / 2 }).game;
      expect(normal).not.toMatch(/\{\w+\}/);
      expect(normal).toContain('₪10');
      expect(cheap).toContain('₪5');
      expect(cheap).not.toContain('₪10 ');
      expect(realWorldView(fact).game).toBe(normal); // default = the standing rate (dictionary)
    });
  }
  it('the raw texts carry slots, not figures', () => {
    setLearnMode('full');
    const raw = JSON.parse(readFileSync(new URL('../src/data/learn/real-world.he.json', import.meta.url), 'utf8'));
    const f = (raw.facts ?? raw.realWorld?.facts).find((x) => x.id === 'rw-loan-rate');
    for (const k of ['game', 'gameFamily']) expect(f[k]).not.toMatch(/₪10 |₪120|1%|12%/);
  });
  it('family override exists for statement.netWorthTitle (so the kid scan reads it)', () => {
    setLearnMode('family');
    const map = familyOverrideMap(learnContent().tutorial);
    expect(he.statement.netWorthTitle).toBeTruthy();
    expect('statement.netWorthTitle' in map).toBe(true);
  });
});
