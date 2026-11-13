// PR #20 live-QA findings F3-F6 (the seeded smokes missed them): the headline copy, the end feedback group, the glossary and the projected debt.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, purchasePlan, projectedDebt, balanceSheet, passiveIncome, totalExpenses } from '../src/engine/index.js';
import { feedbackForEnd } from '../src/learn/feedback.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8'));
const he = read('i18n/he.json');
const cards = read('data/cards.he.json');
const engine = createEngine({ professions: read('data/professions.he.json'), cards });

describe('F3: a short finish never says freedom was reached', () => {
  it('has its own title, text and share text; the freedom strings stay for a real win', () => {
    expect(he.win.title).toBe('חופש כלכלי!');
    expect(he.win.shortTitle).not.toMatch(/חופש כלכלי!/);
    for (const k of ['shortTitle', 'shortText', 'shortTextJunior', 'shortShareText']) expect(he.win[k], k).toBeTruthy();
    expect(he.win.shortText).toMatch(/עוד לא הגעתם לחופש/);
    expect(he.win.shortShareText).not.toMatch(/הגעתי לחופש/);
    expect(he.win.shortShareText).toMatch(/\{rounds\}.*\{passive\}.*\{expenses\}/);
  });
  it('the engine only marks a player won when passive income beats the monthly expenses (the headline condition)', () => {
    const s = engine.newGame({ professionId: 'teacher', mode: 'full', seed: 5 });
    expect(s.status).toBe('playing');
    expect(passiveIncome(s)).toBeLessThanOrEqual(totalExpenses(s));
  });
});

describe('F4: the end feedback group', () => {
  const st = (status) => ({ ...engine.newGame({ professionId: 'teacher', mode: 'full', seed: 5 }), status });
  it('won -> win, lost -> lose, a short finish that nobody won -> end.rounds (solo or hot-seat), a multiplayer win by someone else -> end.neutral', () => {
    expect(feedbackForEnd(st('won')).group).toBe('win');
    expect(feedbackForEnd(st('lost')).group).toBe('lose');
    expect(feedbackForEnd(st('playing'), { shortFinish: true }).group).toBe('end.rounds');
    expect(feedbackForEnd(st('playing')).group).toBe('end.neutral');
  });
  it('end.rounds lines never name someone else, in family and full', () => {
    const find = (o) => (o && typeof o === 'object' ? (o['end.rounds'] ?? Object.values(o).map(find).find(Boolean)) : undefined);
    const g = find(read('data/learn/feedback.he.json'));
    const all = [...(g.family ?? []), ...(g.full ?? [])];
    expect(all.length).toBe(6);
    for (const line of all) expect(line).not.toMatch(/מישהו אחר|שחקן אחר|סיים ראשון|אחרים/);
  });
});

describe('F5: yield and ROI are two different definitions', () => {
  const g = read('data/learn/glossary.he.json').concepts;
  const y = g.find((c) => c.id === 'yield');
  const r = g.find((c) => c.id === 'roi');
  it('the short text, why and family why differ, and each says what it is about', () => {
    expect(y.short).not.toBe(r.short);
    expect(y.why).not.toBe(r.why);
    expect(y.family.why).not.toBe(r.family.why);
    expect(y.short).toMatch(/כמה נכס מכניס בשנה/);
    expect(r.short).toMatch(/מהכסף שלכם עצמכם/);
  });
});

describe('F6: the projected debt of a deal card adds up', () => {
  const coffee = cards.find((c) => c.id === 'opp-biz-002');
  const base = engine.newGame({ professionId: 'teacher', mode: 'full', seed: 1 });
  it('reproduces the live figure: 23,000 starting debts + 80,000 business loan + the bank loan for the down payment', () => {
    const s = { ...base, cash: 62640 };
    const plan = purchasePlan(s, coffee.downPayment);
    expect([plan.status, plan.need, plan.loanAmount]).toEqual(['loan', 17360, 18000]);
    expect(balanceSheet(s).liabilitiesTotal).toBe(23000); // the starting debts are part of "today's debts"
    const d = projectedDebt(s, coffee, plan);
    expect(d).toEqual({ now: 23000, deal: 80000, bank: 18000, total: 121000 }); // the old figure was 120,360 (the bare need)
  });
  it('the loan the buy flow opens (the dialog starts at the need rounded up to the step) is what the total contains', () => {
    for (const cash of [62640, 44760, 70001, 79999]) {
      const s = { ...base, cash };
      const plan = purchasePlan(s, coffee.downPayment);
      expect(projectedDebt(s, coffee, plan).total).toBe(23000 + 80000 + Math.ceil((80000 - cash) / 1000) * 1000);
    }
  });
  it('no bank loan row when cash covers the down payment', () => {
    expect(projectedDebt({ ...base, cash: 90000 }, coffee).bank).toBe(0);
  });
});

describe('F2: no producer hands a null to a native DOM call', () => {
  it('the pick sheet filters its optional blocks before replaceChildren (a null argument becomes the text "null")', () => {
    const src = readFileSync(new URL('../src/ui/screens/pick.js', import.meta.url), 'utf8');
    expect(src).toMatch(/scroll\.replaceChildren\(\.\.\.\[/);
    expect(src).toMatch(/\]\.filter\(Boolean\)\);/);
  });
});
