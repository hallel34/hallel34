// Local multiplayer (hot-seat) match layer. Pure and serializable: a match holds 1-4 players, each with their own
// engine state (own profession, cash, deck, rng). Actions are applied to the current player's state; the turn passes
// with endTurn(). A one-player match behaves exactly like the plain single-player game.
import { EngineError } from './engine.js';
import { SCHEMA_VERSION, MIN_PLAYERS, MAX_PLAYERS, NAME_MAX } from './config.js';
import { passiveIncome, totalExpenses, monthlyCashFlow, netWorth } from './selectors.js';

const SEED_STEP = 7919; // player i plays with seed + i * SEED_STEP (player 0 keeps the match seed)
const fail = (msg) => { throw new EngineError(msg); };

export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

/**
 * Makes typed names unique (case-insensitive): a repeat gets " 2", " 3"... Empty names stay empty (the UI shows a default label).
 * ['דנה','דנה','דנה'] -> ['דנה','דנה 2','דנה 3']
 */
export function uniqueNames(names) {
  const seen = new Set();
  const key = (n) => n.toLocaleLowerCase();
  return names.map((raw) => {
    const name = cleanName(raw);
    if (!name) return '';
    let out = name;
    for (let k = 2; seen.has(key(out)); k++) {
      const suffix = ` ${k}`;
      out = `${name.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    }
    seen.add(key(out));
    return out;
  });
}

/**
 * @param engine createEngine(...) result
 * @param players [{ name?, professionId }] 1-4 entries; an empty name means "use the default label" (UI side)
 */
export function newMatch(engine, { mode = 'full', players, seed = 1, daily = null } = {}) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    fail(`a match needs ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  const names = uniqueNames(players.map((p) => p.name));
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'match',
    mode,
    seed,
    ...(daily ? { daily: { date: String(daily.date) } } : {}), // a daily challenge (one player); normal matches carry no such field
    players: players.map((p, i) => ({
      id: `p${i + 1}`,
      name: names[i],
      color: i + 1, // 1-4: token colour and number badge
      professionId: p.professionId,
      state: engine.newGame({ mode, professionId: p.professionId, seed: seed + i * SEED_STEP, ...(daily ? { daily } : {}) }),
    })),
    currentIndex: 0,
    turns: 0, // completed turns across all players
    turnMark: 0, // the current player's state.turn when their turn began (rolled = state.turn > turnMark)
    status: 'playing', // playing | won | lost
    winnerIndex: null,
  };
}

export const isMultiplayer = (m) => m.players.length > 1;
export const currentPlayer = (m) => m.players[m.currentIndex];
export const currentState = (m) => currentPlayer(m).state;
export const activeCount = (m) => m.players.filter((p) => p.state.status === 'playing').length;

/** Replaces the current player's state (e.g. after an engine action). Detects the winner / a lost match. */
export function setCurrentState(m, state) {
  const next = {
    ...m,
    players: m.players.map((p, i) => (i === m.currentIndex ? { ...p, state } : p)),
  };
  if (state.status === 'won') {
    next.status = 'won';
    next.winnerIndex = m.currentIndex;
  } else if (next.players.every((p) => p.state.status !== 'playing')) {
    next.status = 'lost';
  }
  return next;
}

/** Applies an engine action to the current player: act(match, (s) => engine.roll(s)). */
export function act(m, fn) {
  if (m.status !== 'playing') fail('match is over');
  return setCurrentState(m, fn(currentState(m)));
}

/** True when the current player rolled this turn and everything is resolved (or they just went out). */
export function canEndTurn(m) {
  if (m.status !== 'playing') return false;
  const s = currentState(m);
  if (s.status === 'lost') return true;
  return s.status === 'playing' && s.phase === 'roll' && s.turn > m.turnMark;
}

/**
 * What the screen must do when a (new or resumed) match is shown:
 *  'finish'  the match is over (won / everyone out)      -> go to the end screen
 *  'out'     the current player is already out          -> run the out flow (announce, hand over, or end the match)
 *  'resolve' the current player has an open decision    -> reopen it
 *  'settle'  the current player rolled and resolved     -> wait for "continue" (or close the turn)
 *  'ready'   a fresh turn                               -> roll (hot-seat: confirm whose turn it is first)
 */
export function resumePlan(m) {
  if (m.status !== 'playing') return 'finish';
  const s = currentState(m);
  if (s.status === 'lost') return 'out';
  if (s.status !== 'playing') return 'finish';
  if (s.pending) return 'resolve';
  if (canEndTurn(m)) return 'settle';
  return 'ready';
}

/** Hot-seat with a single player left in the game: they play on without any pass-the-phone steps. */
export const lastPlayerStanding = (m) => m.players.length > 1 && activeCount(m) === 1;

/** Index of the next player still in the game after `from` (cyclic), or -1. */
export function nextActiveIndex(m, from = m.currentIndex) {
  for (let step = 1; step <= m.players.length; step++) {
    const i = (from + step) % m.players.length;
    if (m.players[i].state.status === 'playing') return i;
  }
  return -1;
}

/** Hands the turn to the next player still playing. A single player simply keeps going. */
export function endTurn(m) {
  if (!canEndTurn(m)) fail('turn is not finished');
  const i = nextActiveIndex(m);
  if (i < 0) return { ...m, status: 'lost' };
  return { ...m, turns: m.turns + 1, currentIndex: i, turnMark: m.players[i].state.turn };
}

/** Per-player summary, best first (winner, then closest to freedom). */
export function standings(m) {
  const rows = m.players.map((p, index) => {
    const s = p.state;
    const passive = passiveIncome(s);
    const expenses = totalExpenses(s);
    return {
      index, id: p.id, name: p.name, color: p.color, professionId: p.professionId, status: s.status,
      winner: m.winnerIndex === index, passive, expenses, cashFlow: monthlyCashFlow(s), cash: s.cash,
      netWorth: netWorth(s), turns: s.turn, progress: expenses > 0 ? passive / expenses : 0,
    };
  });
  const rank = (r) => (r.winner ? 3 : r.status === 'lost' ? 0 : r.status === 'playing' ? 1 : 2);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(b.r) - rank(a.r) || b.r.progress - a.r.progress || b.r.netWorth - a.r.netWorth || a.i - b.i)
    .map(({ r }, place) => ({ ...r, place: place + 1 }));
}

/** Same players, mode and professions; a new seed. */
export function rematch(engine, m, seed) {
  return newMatch(engine, {
    mode: m.mode, seed,
    players: m.players.map((p) => ({ name: p.name, professionId: p.professionId })),
  });
}

/** Wraps a pre-match single-player state (save schema 1) into a one-player match. */
export function matchFromState(state) {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'match',
    mode: state.mode,
    seed: state.seed,
    players: [{ id: 'p1', name: '', color: 1, professionId: state.profession?.id, state: { ...state, schemaVersion: SCHEMA_VERSION } }],
    currentIndex: 0,
    turns: 0,
    turnMark: state.phase === 'roll' ? state.turn : Math.max(0, state.turn - 1),
    status: state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'playing',
    winnerIndex: state.status === 'won' ? 0 : null,
  };
}
