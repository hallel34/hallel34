// Rule tests that need a chosen card on a square (v0.5, QA P2-3): one helper for both engine RNG versions.
// The test files run twice: as they are (rngVersion 1, the v1 deck arrays every old save keeps) and through a `*.v2.test.js`
// twin that sets globalThis.__TEST_RNG = 2 before importing them (rngVersion 2, what every new game uses).
//  - v1: the ids go on top of `state.decks[square]` (the pile);
//  - v2: there is no pile. The turn is moved to one whose keyed pile (v2DeckOrder(seed, square, turn)) starts with exactly
//    these ids, so the very same v1 pile rules (requires to the bottom, tier swap, deal-choice peek) run on the same top cards.
import { v2DeckOrder, juniorSkips } from '../../src/engine/index.js';

export const TEST_RNG = globalThis.__TEST_RNG === 2 ? 2 : 1;

/** The engine with `newGame` defaulting to this run's RNG version (an explicit rngVersion still wins). */
export function withTestRng(engine) {
  const newGame = engine.newGame;
  engine.newGame = (opts = {}) => newGame({ rngVersion: TEST_RNG, ...opts });
  return engine;
}

const eligibleIds = (engine, s, square) => engine.data.cards
  .filter((c) => (c.deck === square || (c.deck === 'decision' && c.square === square)) && c.modes.includes(s.mode) && !(s.junior && juniorSkips(c)))
  .map((c) => c.id);

/** `s` with `ids` on top of the `square` pile for its next roll (v1: the deck array; v2: the turn whose keyed pile starts so). */
export function stack(engine, s, square, ids) {
  if ((s.rngVersion ?? 1) !== 2) {
    const rest = (s.decks?.[square] ?? []).filter((x) => !ids.includes(x));
    return { ...s, decks: { ...s.decks, [square]: [...ids, ...rest] } };
  }
  const all = eligibleIds(engine, s, square);
  for (const id of ids) if (!all.includes(id)) throw new Error(`${id} is not in the ${square} pile of this game`);
  for (let t = 1; t < 400000; t++) {
    const order = v2DeckOrder(s.seed, square, t, all);
    if (ids.every((id, k) => order[k] === id)) return { ...s, turn: t - 1 }; // the roll makes it turn t
  }
  throw new Error(`no turn with ${ids.join(', ')} on top of the ${square} pile`);
}

/** The card on top of the `square` pile for the next roll (v1: the deck array; v2: the keyed pile of the next turn). */
export function topOf(engine, s, square) {
  if ((s.rngVersion ?? 1) !== 2) return s.decks[square][0];
  return v2DeckOrder(s.seed, square, s.turn + 1, eligibleIds(engine, s, square))[0];
}
