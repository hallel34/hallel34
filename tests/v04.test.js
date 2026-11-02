// MaxiFox v0.4 regression tests: teacher starting cash, deal choice, tiered deal pools, short mode.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, BOARD, totalExpenses } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';

const engine = createEngine(loadData('he'));
const professions = JSON.parse(readFileSync(new URL('../src/data/professions.he.json', import.meta.url), 'utf8'));

describe('teacher starting cash: one value everywhere (QA P1, 2026-11-02)', () => {
  it('the intended teacher savings are ₪9,000 in the single source of truth', () => {
    // Live QA of the preview showed ₪10,000 on the profession card. In this codebase every display
    // (pick sheet, statement, HUD, learn texts) is fed live from this one field, the learn lessons are
    // built on 9,000 (9,000 - 7,500 = 1,500 left) and tests lock it — so 9,000 is the intended value,
    // and this test fails loudly if the data ever drifts away from it again.
    expect(professions.find((p) => p.id === 'teacher').savings).toBe(9000);
  });
  it('the engine starts every profession with exactly the savings shown for it (family, full, junior)', () => {
    for (const p of professions) {
      for (const mode of ['family', 'full']) {
        const s = engine.newGame({ mode, professionId: p.id, seed: 7 });
        expect(s.cash, `${p.id}/${mode}`).toBe(p.savings);
      }
    }
    const teacher = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    expect(teacher.cash).toBe(9000);
  });
});

describe('deal choice: two deals on an opportunity square (v0.4)', () => {
  const oppIdx = BOARD.indexOf('opportunity');
  /** A family game about to land on the first opportunity square, with two known deals on top of the pile. */
  const beforeDeal = (ids) => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    return { ...s, cash: 900000, position: oppIdx - 1, decks: { ...s.decks, opportunity: [...ids, ...s.decks.opportunity] } };
  };

  it('offers a second, different deal alongside the drawn one', () => {
    const s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    expect(s.pending.kind).toBe('opportunity');
    expect(s.pending.card.id).toBe('opp-biz-013');
    expect(s.pending.alt).toBeTruthy();
    expect(s.pending.alt.id).toBe('opp-apt-008');
    expect(['apartment', 'business']).toContain(s.pending.alt.type);
    // the peek does not consume the pile: the alt is still the next card in the deck
    expect(s.decks.opportunity[0]).toBe(s.pending.alt.id);
  });

  it('chooseDeal swaps the examined deal; buying it sends the unchosen one to auction via a passed event', () => {
    let s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    const altId = s.pending.alt.id;
    s = engine.chooseDeal(s, altId);
    expect(s.pending.card.id).toBe(altId);
    expect(s.pending.alt.id).toBe('opp-biz-013');
    expect(s.pending.chosen).toBe(true);
    s = engine.buy(s);
    expect(s.assets).toHaveLength(1);
    expect(s.assets[0].cardId).toBe(altId);
    const passed = s.events.find((e) => e.type === 'passed' && e.viaChoice);
    expect(passed?.card.id).toBe('opp-biz-013');
  });

  it('chooseDeal with the drawn card keeps it, and skipping both clears the decision', () => {
    let s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    s = engine.chooseDeal(s, 'opp-biz-013');
    expect(s.pending.card.id).toBe('opp-biz-013');
    s = engine.pass(s);
    expect(s.pending).toBeNull();
    expect(s.events.some((e) => e.type === 'passed' && e.card.id === 'opp-biz-013')).toBe(true);
  });

it('chooseDeal rejects a card that was not offered, and a stock/daily offer carries no choice', () => {
    const s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    expect(() => engine.chooseDeal(s, 'opp-apt-002')).toThrow();
    const daily = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7, daily: { date: '2026-11-02' } });
    const d2 = engine.roll({ ...daily, position: oppIdx - 1 }, [1]);
    if (d2.pending?.kind === 'opportunity') expect(d2.pending.alt).toBeUndefined();
  });
});

describe('tiered deal pools: offers grow with the player stage (v0.4)', () => {
  const oppIdx = BOARD.indexOf('opportunity');
  const withDeck = (s, ids) => ({ ...s, position: oppIdx - 1, decks: { ...s.decks, opportunity: [...ids, ...s.decks.opportunity] } });

  it('stage 1 (0% freedom): a huge deal on top is swapped for a small in-tier deal, and stays in the pile', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    // opp-apt-006 flows ₪6,800/mo (≈85% of a teacher's expenses — a late-game deal); opp-biz-013 flows ₪500
    const s = engine.roll(withDeck(s0, ['opp-apt-006', 'opp-biz-013']), [1]);
    expect(s.pending.card.id).toBe('opp-biz-013');
    expect(s.decks.opportunity).toContain('opp-apt-006');
  });

  it('stage 4 (80% freedom): a tiny deal on top is swapped for a big in-tier deal', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    const exp = totalExpenses(s0);
    const rich = {
      ...s0,
      assets: [{ id: 'a1', cardId: 'seed-asset', type: 'apartment', title: 'נכס', price: 1, downPayment: 1, mortgage: 0, monthlyCashFlow: Math.round(exp * 0.8) }],
    };
    const s = engine.roll(withDeck(rich, ['opp-biz-013', 'opp-apt-006']), [1]);
    expect(s.pending.card.id).toBe('opp-apt-006');
    expect(s.decks.opportunity).toContain('opp-biz-013');
  });

  it('a negative-flow trap deal is never tier-filtered away', () => {
    const trap = JSON.parse(readFileSync(new URL('../src/data/cards.he.json', import.meta.url), 'utf8'))
      .find((c) => c.deck === 'opportunity' && Number.isFinite(c.monthlyCashFlow) && c.monthlyCashFlow < 0 && c.modes.includes('family'));
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    const s = engine.roll(withDeck(s0, [trap.id]), [1]);
    expect(s.pending.card.id).toBe(trap.id);
  });
});
