// QA round 16 P3-b: during the cheap-loan card the loan window's real-world row does not call the rate "high on purpose".
import { describe, it, expect } from 'vitest';
import { factForPlace, realWorldView } from '../src/learn/rw.js';
import { setLearnMode } from '../src/learn/context.js';
import { LOAN_PAYMENT_RATE } from '../src/engine/config.js';

describe('round 16: cheap-loan wording of the real-world loan row', () => {
  for (const mode of ['full', 'family']) {
    it(`${mode}: normal rate says "במכוון", the cheap rate does not and keeps its live figures`, () => {
      setLearnMode(mode);
      const fact = factForPlace('loan-window');
      const normal = realWorldView(fact, { rate: LOAN_PAYMENT_RATE }).game;
      const cheap = realWorldView(fact, { rate: LOAN_PAYMENT_RATE / 2 }).game;
      expect(normal).toContain('במכוון');
      expect(cheap).not.toContain('במכוון');
      expect(cheap).toContain('₪5');
      expect(cheap).not.toMatch(/\{\w+\}/);
    });
  }
});
