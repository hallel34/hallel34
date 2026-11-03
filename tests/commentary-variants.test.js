import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCommentaryPicker, commentaryVariants } from '../src/ui/commentary.js';
import { GROUP_SLOTS } from '../src/learn/feedback.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), he);
const groups = Object.keys(he.commentary).filter((k) => !/_\d+$/.test(k)).map((k) => (k === 'baby_max' ? 'baby.max' : k.replace('_', '.')));

describe('round 19 L3: terse full-mode commentary never repeats the last line', () => {
  it('every commentary group has at least 3 short variants that only use its slots', () => {
    for (const g of groups) {
      const v = commentaryVariants(g, lookup);
      expect(v.length, g).toBeGreaterThanOrEqual(3);
      expect(new Set(v).size, g).toBe(v.length);
      for (const s of v) {
        expect(s.length, s).toBeLessThanOrEqual(70);
        for (const [, slot] of s.matchAll(/\{(\w+)\}/g)) expect(GROUP_SLOTS[g], `${g}: {${slot}}`).toContain(slot);
      }
    }
  });
  it('the picker never shows the same filled line twice in a row for a group', () => {
    const pick = createCommentaryPicker();
    const v = commentaryVariants('pass.cantAfford', lookup);
    let prev = null;
    for (let i = 0; i < 12; i++) { const s = pick('pass.cantAfford', v, (x) => x); expect(s).not.toBe(prev); prev = s; }
  });
  it('skips a variant whose filled text equals the last one, and a single line stays allowed', () => {
    const pick = createCommentaryPicker();
    const fill = (x) => x.replace('{a}', '1');
    expect(pick('g', ['x {a}', 'x 1', 'y'], fill)).toBe('x {a}');
    expect(pick('g', ['x {a}', 'x 1', 'y'], fill)).toBe('y');
    expect(pick('solo', ['only'], (x) => x)).toBe('only');
    expect(pick('none', [], (x) => x)).toBeNull();
  });
});

describe('v0.5 QA L3 (2p): the decision fox line never repeats twice in a row', () => {
  it('the pass line has at least 3 distinct short variants in he.json', () => {
    const v = Object.keys(he.decision).filter((k) => /^passFox(_\d+)?$/.test(k)).map((k) => he.decision[k]);
    expect(v.length).toBeGreaterThanOrEqual(3);
    expect(new Set(v).size).toBe(v.length);
    for (const s of v) expect(s.length).toBeLessThanOrEqual(70);
  });
  it('play.js rotates the decision lines and drops a line that would repeat the last one', () => {
    const play = readFileSync(new URL('../src/ui/play.js', import.meta.url), 'utf8');
    expect(play).toMatch(/pickDecisionLine\('decision', decisionFoxVariants\(/);
    expect(play).toMatch(/if \(text && text !== lastDecisionLine\) flow\.notes\.push/);
    const dec = readFileSync(new URL('../src/ui/decision.js', import.meta.url), 'utf8');
    expect(dec).toMatch(/decision\.passFox_\$\{i\}/);
  });
  it('three passes in a row with the picker: three different lines', () => {
    const pick = createCommentaryPicker();
    const v = Object.keys(he.decision).filter((k) => /^passFox(_\d+)?$/.test(k)).map((k) => he.decision[k]);
    const seen = [0, 1, 2].map(() => pick('decision', v, (x) => x));
    expect(new Set(seen).size).toBe(3);
  });
});
