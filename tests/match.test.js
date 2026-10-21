import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, EngineError, newMatch, act, currentState, currentPlayer, canEndTurn, endTurn, standings, rematch,
  setCurrentState, serialize, deserialize, playMatch, isMultiplayer, activeCount, liabilityReport, purchasePlan,
  statement, monthlyCashFlow, passiveIncome, totalExpenses, maxLoan, BOARD, NAME_MAX,
} from '../src/engine/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const four = ['teacher', 'engineer', 'nurse', 'driver'].map((professionId, i) => ({ name: `ש${i + 1}`, professionId }));

/** Plays the current player's turn to the point where it can end (passes every offer; loans when forced). */
function playTurn(m) {
  m = act(m, (s) => engine.roll(s));
  for (let i = 0; i < 20 && !canEndTurn(m) && m.status === 'playing'; i++) {
    m = act(m, (s) => {
      const k = s.pending?.kind;
      if (k === 'opportunity') return engine.pass(s);
      if (k === 'charity') return engine.declineCharity(s);
      if (k === 'offer') return engine.declineOffer(s);
      if (k === 'expense' || k === 'shortfall') return engine.takeLoan(s, 1000);
      throw new Error(`stuck ${s.phase} ${k}`);
    });
  }
  return m;
}

describe('match: setup', () => {
  it('creates 1-4 players, each with their own profession, state and seed', () => {
    const m = newMatch(engine, { mode: 'family', players: four, seed: 50 });
    expect(m.players).toHaveLength(4);
    expect(m.players.map((p) => p.state.profession.id)).toEqual(['teacher', 'engineer', 'nurse', 'driver']);
    expect(new Set(m.players.map((p) => p.state.seed)).size).toBe(4);
    expect(m.players.map((p) => p.color)).toEqual([1, 2, 3, 4]);
    expect(m.status).toBe('playing');
    expect(isMultiplayer(m)).toBe(true);
  });
  it('the first player keeps the match seed (single player is identical to a plain game)', () => {
    const m = newMatch(engine, { mode: 'full', players: [{ professionId: 'teacher' }], seed: 77 });
    expect(currentState(m)).toEqual(engine.newGame({ mode: 'full', professionId: 'teacher', seed: 77 }));
    expect(isMultiplayer(m)).toBe(false);
  });
  it('rejects 0 or 5 players and trims names to 12 characters', () => {
    expect(() => newMatch(engine, { players: [] })).toThrow(EngineError);
    expect(() => newMatch(engine, { players: Array(5).fill({ professionId: 'teacher' }) })).toThrow(EngineError);
    const m = newMatch(engine, { players: [{ name: '  אבגדהוזחטיכלמנסעפ  ', professionId: 'teacher' }, { name: '   ', professionId: 'nurse' }] });
    expect(m.players[0].name).toHaveLength(NAME_MAX);
    expect(m.players[1].name).toBe('');
  });
  it('allows the same profession for several players', () => {
    const m = newMatch(engine, { players: [{ professionId: 'nurse' }, { professionId: 'nurse' }] });
    expect(m.players[0].state.profession.id).toBe(m.players[1].state.profession.id);
    expect(m.players[0].state.decks).not.toEqual(m.players[1].state.decks); // different seeds, different decks
  });
});

describe('match: turns', () => {
  it('actions only touch the current player; the turn passes in order and wraps', () => {
    let m = newMatch(engine, { mode: 'family', players: four, seed: 9 });
    const before = m.players.map((p) => p.state);
    expect(canEndTurn(m)).toBe(false); // has not rolled yet
    expect(() => endTurn(m)).toThrow(EngineError);
    m = playTurn(m);
    expect(m.players[0].state.turn).toBe(1);
    expect(m.players.slice(1).map((p) => p.state)).toEqual(before.slice(1));
    expect(m.currentIndex).toBe(0); // not advanced until endTurn (the UI shows "continue" first)
    m = endTurn(m);
    expect(m.currentIndex).toBe(1);
    for (let i = 0; i < 3; i++) m = endTurn(playTurn(m));
    expect(m.currentIndex).toBe(0); // wrapped: 1 -> 2 -> 3 -> 0
    expect(m.turns).toBe(4);
  });
  it('a one-player match keeps the same player when the turn ends', () => {
    let m = newMatch(engine, { mode: 'family', players: [{ professionId: 'teacher' }], seed: 3 });
    m = endTurn(playTurn(m));
    expect(m.currentIndex).toBe(0);
    expect(canEndTurn(m)).toBe(false);
  });
  it('per-player state stays per player: kids, loans and charity bonus', () => {
    let m = newMatch(engine, { mode: 'full', players: four, seed: 4 });
    m = act(m, (s) => engine.takeLoan(s, 2000));
    m = setCurrentState(m, { ...currentState(m), kids: 2, charityTurns: 3 });
    expect(m.players[0].state.liabilities.some((l) => l.kind === 'loan')).toBe(true);
    for (const p of m.players.slice(1)) {
      expect(p.state.kids).toBe(0);
      expect(p.state.charityTurns).toBe(0);
      expect(p.state.liabilities.some((l) => l.kind === 'loan')).toBe(false);
    }
  });
  it('first player to win ends the match with that player as winner', () => {
    let m = newMatch(engine, { mode: 'family', players: four, seed: 4 });
    m = endTurn(playTurn(m));
    expect(currentPlayer(m).id).toBe('p2');
    m = act(m, (s) => engine.debugForce(s, 'win'));
    expect(m.status).toBe('won');
    expect(m.winnerIndex).toBe(1);
    expect(() => act(m, (s) => engine.roll(s))).toThrow(EngineError);
    const rows = standings(m);
    expect(rows[0]).toMatchObject({ index: 1, winner: true, place: 1 });
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r).toMatchObject({ passive: expect.any(Number), expenses: expect.any(Number), netWorth: expect.any(Number), turns: expect.any(Number) });
  });
  it('a player who hits game over is out and skipped; the others carry on', () => {
    let m = newMatch(engine, { mode: 'family', players: four, seed: 4 });
    m = setCurrentState(m, { ...currentState(m), status: 'lost', phase: 'ended' });
    expect(m.status).toBe('playing');
    expect(canEndTurn(m)).toBe(true); // nothing left to do for the player who is out
    m = endTurn(m);
    expect(m.currentIndex).toBe(1);
    expect(activeCount(m)).toBe(3);
    // everyone else goes around and skips player 0
    m = endTurn(playTurn(m)); m = endTurn(playTurn(m)); m = endTurn(playTurn(m));
    expect(m.currentIndex).toBe(1);
  });
  it('when every player is out the match is lost', () => {
    let m = newMatch(engine, { mode: 'family', players: four.slice(0, 2), seed: 4 });
    m = setCurrentState(m, { ...currentState(m), status: 'lost', phase: 'ended' });
    m = endTurn(m);
    expect(m.status).toBe('playing');
    m = setCurrentState(m, { ...currentState(m), status: 'lost', phase: 'ended' });
    expect(m.status).toBe('lost');
    const single = setCurrentState(newMatch(engine, { players: [{ professionId: 'teacher' }] }), { ...engine.newGame({ professionId: 'teacher' }), status: 'lost', phase: 'ended' });
    expect(single.status).toBe('lost');
  });
  it('standings put players still playing above those who are out, ordered by progress', () => {
    let m = newMatch(engine, { mode: 'family', players: four, seed: 4 });
    m = setCurrentState(m, { ...currentState(m), status: 'lost', phase: 'ended' });
    const rows = standings(m);
    expect(rows[3]).toMatchObject({ index: 0, status: 'lost' });
    const progress = rows.slice(0, 3).map((r) => r.progress);
    expect([...progress].sort((a, b) => b - a)).toEqual(progress);
  });
});

describe('match: determinism, save and rematch', () => {
  it('the same seed and the same choices give the same match', () => {
    const run = () => { let m = newMatch(engine, { mode: 'full', players: four, seed: 321 }); for (let i = 0; i < 12; i++) m = endTurn(playTurn(m)); return m; };
    expect(run()).toEqual(run());
  });
  it('a saved match resumes identically mid-match', () => {
    let m = newMatch(engine, { mode: 'full', players: four, seed: 321 });
    for (let i = 0; i < 6; i++) m = endTurn(playTurn(m));
    const loaded = deserialize(serialize(m));
    expect(loaded).toEqual(m);
    expect(endTurn(playTurn(loaded))).toEqual(endTurn(playTurn(m)));
  });
  it('a save made in the middle of a decision resumes with the same pending card', () => {
    let m = newMatch(engine, { mode: 'full', players: four, seed: 321 });
    for (let i = 0; i < 40 && !currentState(m).pending; i++) m = currentState(m).phase === 'roll' && canEndTurn(m) ? endTurn(m) : act(m, (s) => engine.roll(s));
    expect(currentState(m).pending).toBeTruthy();
    expect(currentState(deserialize(serialize(m))).pending).toEqual(currentState(m).pending);
  });
  it('rematch keeps players, names, mode and professions but uses a new seed', () => {
    const m = newMatch(engine, { mode: 'family', players: four, seed: 5 });
    const r = rematch(engine, m, 6);
    expect(r.mode).toBe('family');
    expect(r.players.map((p) => [p.name, p.professionId])).toEqual(m.players.map((p) => [p.name, p.professionId]));
    expect(r.players[0].state.decks).not.toEqual(m.players[0].state.decks);
    expect(r.turns).toBe(0);
  });
});

describe('match: bots (multiplayer simulation)', () => {
  it.each([['family'], ['full']])('4 sensible bots finish a %s match with a winner (2000-turn cap)', (mode) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const players = ['teacher', 'engineer', 'nurse', 'driver'].map((professionId, i) => ({ name: `P${i}`, professionId }));
      const m = playMatch(engine, newMatch(engine, { mode, players, seed: seed * 1013 }), ['sensible', 'sensible', 'sensible', 'sensible'], 2000);
      expect(m.status, `${mode} seed ${seed}`).toBe('won');
      expect(m.turns).toBeLessThan(2000);
      const w = m.players[m.winnerIndex].state;
      expect(passiveIncome(w)).toBeGreaterThan(totalExpenses(w));
      expect(standings(m)[0].winner).toBe(true);
    }
  });
});

describe('statement: all liabilities', () => {
  const buyFirst = (mode = 'full') => {
    for (let seed = 1; seed < 200; seed++) {
      let s = engine.newGame({ mode, professionId: 'engineer', seed });
      s = { ...s, cash: 900000 };
      for (let i = 0; i < 30 && s.status === 'playing'; i++) {
        if (s.phase === 'roll') s = engine.roll(s);
        else if (s.pending?.kind === 'opportunity' && s.pending.card.type !== 'stock') { s = engine.buy(s); if (s.assets.length >= 2) return s; }
        else if (s.pending?.kind === 'opportunity') s = engine.pass(s);
        else if (s.pending?.kind === 'charity') s = engine.declineCharity(s);
        else if (s.pending?.kind === 'offer') s = engine.declineOffer(s);
        else break;
      }
    }
    throw new Error('no purchase found');
  };
  it('lists starting debts, bank loans and the mortgage of every bought asset with balance and payment', () => {
    let s = buyFirst();
    const amount = Math.min(3000, maxLoan(s));
    expect(amount).toBeGreaterThan(0);
    s = engine.takeLoan(s, amount);
    const r = liabilityReport(s);
    const kinds = r.items.map((x) => x.kind);
    expect(kinds.filter((k) => k === 'mortgage')).toHaveLength(s.assets.filter((a) => a.mortgage > 0).length);
    expect(kinds).toContain('loan');
    for (const a of s.assets.filter((x) => x.mortgage > 0)) {
      const item = r.items.find((x) => x.assetId === a.id);
      expect(item).toMatchObject({ kind: 'mortgage', principal: a.mortgage, includedInAssets: true, assetTitle: a.title });
      expect(item.monthlyPayment).toBeGreaterThan(0);
    }
    const loan = r.items.find((x) => x.kind === 'loan');
    expect(loan).toMatchObject({ principal: amount, monthlyPayment: amount / 10, includedInAssets: false });
    expect(r.totals.principal).toBe(r.items.reduce((a, x) => a + x.principal, 0));
    expect(r.totals.monthlyPayments).toBe(r.totals.paidFromCashFlow + r.totals.includedInAssets);
  });
  it('the numbers add up to the monthly cash flow shown', () => {
    for (const mode of ['family', 'full']) {
      const b = buyFirst(mode);
      const s = engine.takeLoan(b, Math.min(2000, maxLoan(b)));
      const st = statement(s);
      // cash flow = salary + net passive - fixed expenses - children - payments that are NOT already inside asset flows
      const fixed = st.expenseItems.reduce((a, e) => a + e.amount, 0);
      expect(st.salary + st.passiveIncome - fixed - st.childExpenses - st.liabilities.totals.paidFromCashFlow).toBe(monthlyCashFlow(s));
      expect(st.liabilities.totals.paidFromCashFlow).toBe(st.loanPayments);
    }
  });
  it('a game with no purchases lists just the starting debts', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher' });
    const r = liabilityReport(s);
    expect(r.items.every((x) => x.kind === 'base')).toBe(true);
    expect(r.totals.includedInAssets).toBe(0);
    expect(r.totals.monthlyPayments).toBe(r.totals.paidFromCashFlow);
  });
});

describe('purchase plan (the buy button)', () => {
  const s0 = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 1 });
  it('ok when cash covers the cost', () => {
    expect(purchasePlan({ ...s0, cash: 50000 }, 40000)).toMatchObject({ status: 'ok', need: 0, loanAmount: 0 });
  });
  it('loan when one loan covers the gap, with the smallest sufficient loan', () => {
    const s = { ...s0, cash: 10000 };
    const room = maxLoan(s);
    expect(room).toBeGreaterThan(2000);
    const p = purchasePlan(s, 12500);
    expect(p).toMatchObject({ status: 'loan', need: 2500, loanAmount: 3000 });
    expect(p.loanAmount).toBeLessThanOrEqual(room);
    expect(engine.takeLoan(s, p.loanAmount).cash).toBeGreaterThanOrEqual(12500);
  });
  it('blocked when even the maximum loan is not enough (or the limit is reached)', () => {
    const s = { ...s0, cash: 0 };
    const room = maxLoan(s);
    expect(purchasePlan(s, room + 1)).toMatchObject({ status: 'blocked' });
    expect(purchasePlan(s, room)).toMatchObject({ status: 'loan' });
    const maxed = engine.takeLoan(s, room);
    expect(maxLoan(maxed)).toBe(0);
    expect(purchasePlan({ ...maxed, cash: 100 }, 5000).status).toBe('blocked');
  });
});

describe('board sanity for multiplayer', () => {
  it('has 24 squares (pawns of several players share tiles)', () => expect(BOARD).toHaveLength(24));
});
