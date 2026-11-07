// v0.5 replay fuzz (docs/RNG.md): 500 random seeds, random legal actions. Each game's log is encoded to a link string,
// decoded, and replayed from (seed, config); the replayed state must deep-equal the played one and hash the same.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, encodeActionLog, decodeActionLog, stateHash, DAILY_RNG_V2_FROM, EngineError } from '../src/engine/index.js';
import { REFUSED_IN_LINKS } from '../src/engine/actionlog.js';
import { mulberry, playRandom } from './support/legal-moves.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const GAMES = 500;

/** Game i's setup: family / full / junior / a daily on either side of the v2 boundary. */
function configOf(i, rnd) {
  const professionId = data.professions[Math.floor(rnd() * data.professions.length)].id;
  const kind = i % 10;
  if (kind === 8) return { mode: 'family', professionId, daily: { date: '2026-11-03' } };
  if (kind === 9) return { mode: 'family', professionId, daily: { date: DAILY_RNG_V2_FROM } };
  if (kind === 7) return { mode: 'family', professionId, junior: true };
  return { mode: kind % 2 ? 'full' : 'family', professionId };
}

describe('replay fuzz: 500 random legal games replay exactly from their encoded log', () => {
  it(`${GAMES}/${GAMES} games: deep-equal and the same state hash`, () => {
    let ok = 0; let actions = 0; const kinds = new Set();
    for (let i = 0; i < GAMES; i++) {
      const rnd = mulberry(0xC0FFEE + i * 7919);
      const seed = 1 + Math.floor(rnd() * 0xFFFFFFFE);
      const config = configOf(i, rnd);
      const played = playRandom(engine, engine.newGame({ ...config, seed }), rnd);
      const link = encodeActionLog({ rngVersion: played.rngVersion, seed, config, actions: played.log });
      const decoded = decodeActionLog(link);
      expect(decoded.actions).toEqual(played.log);
      const replayed = engine.replay(decoded.seed, decoded.config, decoded.actions);
      expect(replayed).toEqual(played);
      expect(stateHash(replayed)).toBe(stateHash(played));
      ok += 1; actions += played.log.length;
      for (const a of played.log) kinds.add(a.type);
    }
    expect(ok).toBe(GAMES);
    expect(actions / GAMES).toBeGreaterThan(30);
    // the generator reached every action a link may carry (not the QA force, not the hot-seat auction actions)
    for (const t of engine.ACTION_TYPES.filter((x) => !REFUSED_IN_LINKS.includes(x))) expect(kinds, t).toContain(t);
  }, 240000);
  it('a replay of a different log is a different game, and an illegal action in a log is refused', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 7 });
    const a = engine.replay(7, { mode: 'full', professionId: 'teacher' }, [{ type: 'roll' }]);
    expect(a.turn).toBe(1);
    expect(stateHash(a)).not.toBe(stateHash(s));
    expect(() => engine.replay(7, { mode: 'full', professionId: 'teacher' }, [{ type: 'buy', qty: 1 }])).toThrow(EngineError);
    expect(() => engine.dispatch(s, { type: 'nope' })).toThrow(EngineError);
    expect(() => engine.dispatch(s, { type: 'roll', dice: [6] })).toThrow(EngineError); // a log can never choose its dice
  });
});
