// MaxiFox v0.4 regression tests: teacher starting cash, deal choice, tiered deal pools, short mode.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, BOARD, totalExpenses, newMatch, playMatch, standings, rematch, serialize, deserialize, SHORT_ROUNDS, recordGuess } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';

import { TEST_RNG, withTestRng, stack, topOf } from './support/stack.js';
const engine = createEngine(loadData('he'));
// v0.5 (docs/v4/test-changes.md 20, QA P2-3): this file runs twice, on rngVersion 1 (here) and rngVersion 2 (its .v2.test.js
// twin); `stack` puts chosen cards on top of a square's pile in either version (tests/support/stack.js).
withTestRng(engine);
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
    return stack(engine, { ...s, cash: 900000, position: oppIdx - 1 }, 'opportunity', ids);
  };

  it('offers a second, different deal alongside the drawn one', () => {
    const s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    expect(s.pending.kind).toBe('opportunity');
    expect(s.pending.card.id).toBe('opp-biz-013');
    expect(s.pending.alt).toBeTruthy();
    expect(s.pending.alt.id).toBe('opp-apt-008');
    expect(['apartment', 'business']).toContain(s.pending.alt.type);
    // the peek does not consume the pile: the alt is still the next card in the deck (v1; a v2 game has no pile)
    if (TEST_RNG === 1) expect(s.decks.opportunity[0]).toBe(s.pending.alt.id);
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
  // v1 stacks any card; a v2 pile holds the game's own cards only: opp-apt-002 (₪5,100, ≈70% of a teacher's expenses) is the
  // family-mode huge deal there (opp-apt-006 is a full-mode card)
  const BIG = TEST_RNG === 1 ? 'opp-apt-006' : 'opp-apt-002';
  const withDeck = (s, ids) => stack(engine, { ...s, position: oppIdx - 1 }, 'opportunity', ids);

  it('stage 1 (0% freedom): a huge deal on top is swapped for a small in-tier deal, and stays in the pile', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    // opp-apt-006 flows ₪6,800/mo (≈85% of a teacher's expenses — a late-game deal); opp-biz-013 flows ₪500
    const s = engine.roll(withDeck(s0, [BIG, 'opp-biz-013']), [1]);
    expect(s.pending.card.id).toBe('opp-biz-013');
    if (TEST_RNG === 1) expect(s.decks.opportunity).toContain(BIG);
  });

  it('stage 4 (80% freedom): a tiny deal on top is swapped for a big in-tier deal', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    const exp = totalExpenses(s0);
    const rich = {
      ...s0,
      assets: [{ id: 'a1', cardId: 'seed-asset', type: 'apartment', title: 'נכס', price: 1, downPayment: 1, mortgage: 0, monthlyCashFlow: Math.round(exp * 0.8) }],
    };
    const s = engine.roll(withDeck(rich, ['opp-biz-013', BIG]), [1]);
    expect(s.pending.card.id).toBe(BIG);
    if (TEST_RNG === 1) expect(s.decks.opportunity).toContain('opp-biz-013');
  });

  it('a negative-flow trap deal is never tier-filtered away', () => {
    const trap = JSON.parse(readFileSync(new URL('../src/data/cards.he.json', import.meta.url), 'utf8'))
      .find((c) => c.deck === 'opportunity' && Number.isFinite(c.monthlyCashFlow) && c.monthlyCashFlow < 0 && c.modes.includes('family'));
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    const s = engine.roll(withDeck(s0, [trap.id]), [1]);
    expect(s.pending.card.id).toBe(trap.id);
  });
});

describe('short mode: 12 rounds, highest freedom % wins (v0.4)', () => {
  const twoPlayers = [{ name: 'א', professionId: 'teacher' }, { name: 'ב', professionId: 'engineer' }];

  it('SHORT_ROUNDS is 12 and a standard match carries no cap', () => {
    expect(SHORT_ROUNDS).toBe(12);
    const m = newMatch(engine, { mode: 'family', players: twoPlayers, seed: 11 });
    expect(m.roundCap).toBeUndefined();
    const short = newMatch(engine, { mode: 'family', players: twoPlayers, seed: 11, roundCap: SHORT_ROUNDS });
    expect(short.roundCap).toBe(12);
  });

  it('a short match ends after the cap round with the freedom leader as winner', () => {
    let m = newMatch(engine, { mode: 'family', players: twoPlayers, seed: 11, roundCap: 3 });
    m = playMatch(engine, m, ['sensible', 'sensible'], 500);
    expect(m.status).toBe('won');
    expect(m.shortFinish).toBe(true);
    expect(m.players.every((p) => p.state.turn <= 3)).toBe(true);
    const top = standings(m)[0];
    expect(m.winnerIndex).toBe(top.index);
  });

  it('a single-player short game also ends at the cap', () => {
    let m = newMatch(engine, { mode: 'family', players: [{ name: '', professionId: 'teacher' }], seed: 3, roundCap: 2 });
    m = playMatch(engine, m, ['sensible'], 500);
    expect(m.status).toBe('won');
    expect(m.shortFinish).toBe(true);
    expect(m.winnerIndex).toBe(0);
    expect(m.players[0].state.turn).toBeLessThanOrEqual(2);
  });

  it('rematch keeps the cap, and a schema-7 save migrates to a standard (uncapped) game', () => {
    const short = newMatch(engine, { mode: 'family', players: twoPlayers, seed: 11, roundCap: SHORT_ROUNDS });
    expect(rematch(engine, short, 99).roundCap).toBe(SHORT_ROUNDS);
    const old = JSON.parse(serialize(newMatch(engine, { mode: 'family', players: twoPlayers, seed: 11 })));
    old.schemaVersion = 7;
    for (const p of old.players) p.state.schemaVersion = 7;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.schemaVersion).toBe(10);
    expect(loaded.roundCap).toBeNull();
  });
});

describe('guess stakes: discount and reroll tokens (v0.4)', () => {
  const oppIdx = BOARD.indexOf('opportunity');
  const beforeDeal = (ids) => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    return stack(engine, { ...s, cash: 900000, position: oppIdx - 1 }, 'opportunity', ids);
  };

  it('a correct guess on the card this turn takes 10% off the down payment', () => {
    let s = engine.roll(beforeDeal(['opp-biz-013', 'opp-apt-008']), [1]);
    const card = s.pending.card;
    const withGuess = {
      ...s,
      learn: { ...s.learn, guesses: [{ turn: s.turn, cardId: card.id, light: 'green', guess: 'good', correct: true }] },
    };
    const bought = engine.buy(withGuess);
    const expectedDiscount = Math.round((card.downPayment * 0.1) / 10) * 10;
    expect(expectedDiscount).toBeGreaterThan(0);
    expect(bought.assets[0].downPayment).toBe(card.downPayment - expectedDiscount);
    expect(bought.assets[0].price).toBe(card.price - expectedDiscount);
    expect(bought.cash).toBe(withGuess.cash - (card.downPayment - expectedDiscount));
    expect(bought.events.find((e) => e.type === 'bought').discount).toBe(expectedDiscount);
    // and without the guess the same buy pays full price
    const full = engine.buy(s);
    expect(full.assets[0].downPayment).toBe(card.downPayment);
    expect(full.events.find((e) => e.type === 'bought').discount).toBeUndefined();
  });

  it('a full investor-eye streak earns a reroll token (max 2); a wrong guess breaks the streak', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    const good = (st, id) => recordGuess(st, { cardId: id, light: 'green', guess: 'good' });
    s = good(good(good(s, 'a'), 'b'), 'c');
    expect(s.rerollTokens).toBe(1);
    s = recordGuess(s, { cardId: 'd', light: 'green', guess: 'bad' }); // wrong: streak resets, no token
    expect(s.rerollTokens).toBe(1);
    s = good(good(good(s, 'e'), 'f'), 'g');
    expect(s.rerollTokens).toBe(2);
    s = good(good(good(s, 'h'), 'i'), 'j');
    expect(s.rerollTokens).toBe(2); // capped
  });

  it('an armed token is spent by the roll, which keeps the better of two sets; arming needs a token', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    expect(() => engine.armReroll(s)).toThrow();
    s = { ...s, rerollTokens: 1 };
    s = engine.armReroll(s);
    expect(s.rerollArmed).toBe(true);
    const before = s.cash;
    s = engine.roll(s, [3]);
    expect(s.rerollTokens).toBe(0);
    expect(s.rerollArmed).toBe(false);
    expect(s.events.some((e) => e.type === 'reroll')).toBe(true);
    expect(s.cash).toBeGreaterThanOrEqual(before); // a teacher's monthly flow is positive; nothing was lost by rerolling
  });
});

describe('idle-cash mirror on the annual summary (v0.4, plan §2.1)', () => {
  it('the play controller computes the mirror and the summary card renders it (no penalty anywhere)', () => {
    const play = readFileSync(new URL('../src/ui/play.js', import.meta.url), 'utf8');
    const card = readFileSync(new URL('../src/ui/summary-card.js', import.meta.url), 'utf8');
    expect(play).toContain('function attachIdleLine(f)');
    expect(play).toContain('avgYield');
    expect(card).toContain("tn('payday.idle'");
    expect(card).toContain("'data-idle': ''");
  });
});
