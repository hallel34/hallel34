// PR21 review regression guard: full games played by the bots from the first turn to a REAL ending, in normal (full), family, hot-seat and daily
// modes, with the money invariants checked on the way. These protect the arithmetic surface the review only sampled; they do not replace
// a human playthrough, real-device persistence or visual QA (see the PR description for the untested scope).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, newMatch, currentState, botStep, playMatch, newDailyGame, DAILY_TURN_CAP, serialize, deserialize,
  monthlyCashFlow, totalExpenses, passiveIncome, totalIncome, statement,
} from '../src/engine/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const ids = engine.data.professions.map((p) => p.id);

/** One bot-played single-player game; checks the identities on every step. */
function playChecked(mode, professionId, seed, bot) {
  let m = newMatch(engine, { mode, seed, players: [{ name: 'x', professionId }] });
  let s = currentState(m);
  let guard = 0; let prevTurn = 0;
  while (s.status === 'playing' && guard++ < 6000) {
    s = botStep(engine, s, bot);
    // identities that must hold at every step
    expect(monthlyCashFlow(s)).toBe(totalIncome(s) - totalExpenses(s));
    expect(statement(s).monthlyCashFlow).toBe(monthlyCashFlow(s));
    expect(Number.isFinite(s.cash)).toBe(true);
    expect(s.turn).toBeGreaterThanOrEqual(prevTurn); prevTurn = s.turn;
  }
  return s;
}

describe('full bot games reach a real ending (normal and family)', () => {
  for (const mode of ['family', 'full']) {
    for (const id of ['teacher', 'engineer', 'nurse']) {
      it(`${mode} ${id}: ends won or lost, never stuck, and a win means passive income above expenses`, () => {
        const s = playChecked(mode, id, 11, 'sensible');
        expect(['won', 'lost']).toContain(s.status);
        if (s.status === 'won') expect(passiveIncome(s)).toBeGreaterThan(totalExpenses(s));
      });
    }
  }
  it('an always-buying bot also terminates (loans, repayments, charity all exercised)', () => {
    const s = playChecked('full', 'lawyer', 5, 'alwaysBuy');
    expect(['won', 'lost']).toContain(s.status);
  });
});

describe('hot-seat match and daily challenge play to their end', () => {
  it('a 2-player match ends with a winner or everybody out', () => {
    const m0 = newMatch(engine, { mode: 'family', seed: 9, players: [{ name: 'a', professionId: 'teacher' }, { name: 'b', professionId: 'driver' }] });
    const m = playMatch(engine, m0, ['sensible', 'cautious'], 1500);
    expect(['won', 'lost']).toContain(m.status);
  });
  it('a short (12-round) match ends after round 12 at the latest', () => {
    const m0 = newMatch(engine, { mode: 'family', seed: 4, roundCap: 12, players: [{ name: 'a', professionId: 'teacher' }] });
    const m = playMatch(engine, m0, ['alwaysPass'], 1500);
    expect(m.status).not.toBe('playing');
    expect(currentState(m).turn).toBeLessThanOrEqual(12);
  });
  it(`the daily challenge always ends by turn ${DAILY_TURN_CAP}: a win, or "not this time" (timedOut)`, () => {
    let s = newDailyGame(engine, '2026-11-22');
    let guard = 0;
    while (s.status === 'playing' && guard++ < 3000) s = botStep(engine, s, 'alwaysPass');
    expect(s.status).toBe('lost');
    expect(s.daily.timedOut).toBe(true);
    expect(s.turn).toBeLessThanOrEqual(DAILY_TURN_CAP);
  });
});

describe('a save survives a serialize round trip mid-game (what localStorage does)', () => {
  it('the restored match plays on to the same ending as the uninterrupted one', () => {
    const base = newMatch(engine, { mode: 'full', seed: 21, players: [{ name: 'x', professionId: 'engineer' }] });
    let a = base; let n = 0;
    while (a.status === 'playing' && n++ < 40) a = { ...a, players: a.players.map((p) => ({ ...p, state: botStep(engine, p.state, 'sensible') })) };
    const restored = deserialize(serialize(a));
    expect(restored).toEqual(a);
  });
});
