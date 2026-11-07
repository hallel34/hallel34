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
  it('play.js takes the decision line from the per-device picker (QA P1: it survives a re-created board)', () => {
    const play = readFileSync(new URL('../src/ui/play.js', import.meta.url), 'utf8');
    expect(play).toMatch(/nextDecisionLine\(decisionFoxVariants\(/);
    expect(play).not.toMatch(/lastDecisionLine/);
    const dec = readFileSync(new URL('../src/ui/decision.js', import.meta.url), 'utf8');
    expect(dec).toMatch(/decision\.passFox_\$\{i\}/);
    expect(dec).toMatch(/foxVariants/);
  });
  it('the per-device picker never repeats the last line, across picker uses and a new board (storage-backed)', async () => {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: () => null, length: 0 };
    const { nextDecisionLine } = await import('../src/ui/decision-lines.js');
    const one = ['גם לחכות זו החלטה.'];
    expect(nextDecisionLine(one, (x) => x).text).toBe(one[0]);
    expect(nextDecisionLine(one, (x) => x)).toBeNull(); // the same single line again: not shown
    expect(store.get('passivo.decisionLine')).toBe(one[0]); // kept on the device (a re-created board reads it)
    const three = ['a', 'b', 'c'];
    const seen = [0, 1, 2, 3, 4].map(() => nextDecisionLine(three, (x) => x).text);
    seen.forEach((x, i) => { if (i) expect(x).not.toBe(seen[i - 1]); });
    delete globalThis.localStorage;
  });
  it('every wait / pass decision option has at least 3 lines (its fox + foxVariants), family-safe', () => {
    const cards = JSON.parse(readFileSync(new URL('../src/data/cards.he.json', import.meta.url), 'utf8'));
    const waits = cards.filter((c) => c.deck === 'decision').flatMap((c) => c.options.filter((o) => !o.effects || !Object.keys(o.effects).length).map((o) => [c.id, o]));
    expect(waits.length).toBeGreaterThanOrEqual(6);
    for (const [id, o] of waits) {
      const lines = [o.fox, ...(o.foxVariants ?? [])];
      expect(lines.length, id).toBeGreaterThanOrEqual(3);
      expect(new Set(lines).size, id).toBe(lines.length);
      for (const l of lines) expect(l, id).not.toMatch(/ריבית|תזרים|מקדמה|קרן|להיפרע/);
    }
  });
  it('three passes in a row with the picker: three different lines', () => {
    const pick = createCommentaryPicker();
    const v = Object.keys(he.decision).filter((k) => /^passFox(_\d+)?$/.test(k)).map((k) => he.decision[k]);
    const seen = [0, 1, 2].map(() => pick('decision', v, (x) => x));
    expect(new Set(seen).size).toBe(3);
  });
});
