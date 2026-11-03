// Daily challenge (v2.5), pure. Everyone who plays on the same calendar date gets the same profession, the same dice and
// the same card draws, whatever they choose to buy, pass or borrow. That needs streams that do not depend on the rng state:
//   die k of turn i       = f(seed, 'die', i, k)
//   card drawn at turn i  = f(seed, deck, i)   (picks an eligible card of that deck)
// Opt-in: a game created with `daily` uses these; every normal game keeps its seeded rng exactly as before.
import { EngineError } from './engine.js';
import { netWorth } from './selectors.js';
import { hashString, unit } from './rng.js';
import { DAILY_RNG_V2_FROM } from './config.js';

/** Turn 40 resolved without financial freedom = the day's challenge is over ("not this time"). */
export const DAILY_TURN_CAP = 40;
export const DAILY_MODE = 'family';

// hashString / unit moved to rng.js (v0.5): the same code, re-exported so every daily value stays byte-identical.
export { hashString } from './rng.js';

export const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The engine RNG version of the daily challenge of a date: 1 before DAILY_RNG_V2_FROM (unchanged streams), 2 from it on. */
export const dailyRngVersion = (dateKey) => (String(dateKey) >= DAILY_RNG_V2_FROM ? 2 : 1);

/** Seed of a local calendar date 'YYYY-MM-DD' (always a positive 32 bit integer). */
export function dailySeed(dateKey) {
  if (!isDateKey(dateKey)) throw new EngineError(`bad date key ${dateKey}`);
  return hashString(`passivo-daily|${dateKey}`) || 1;
}

/** Die k (0 = the first, 1 = the second die of a charity turn) of turn `turn`, 1-6. */
export const dailyDie = (seed, turn, k = 0) => 1 + Math.floor(unit(seed, 'die', turn, k) * 6);

/** Index (0..n-1) of the card of `deck` drawn at turn `turn`. */
export const dailyPick = (seed, deck, turn, n) => Math.floor(unit(seed, deck, turn, 0) * n);

/** The day's profession id, from the same seed. */
export function dailyProfessionId(seed, professions) {
  return professions[Math.floor(unit(seed, 'profession', 0, 0) * professions.length)].id;
}

/** Plain list of the dice of the first `turns` turns (QA / tests / future server checks). */
export const dailyDiceSequence = (seed, turns) => Array.from({ length: turns }, (_, i) => dailyDie(seed, i + 1, 0));

/** Starts the day's game: family mode, the day's profession, the day's seed. */
export function newDailyGame(engine, dateKey) {
  const seed = dailySeed(dateKey);
  return engine.newGame({
    mode: DAILY_MODE, seed, professionId: dailyProfessionId(seed, engine.data.professions), daily: { date: dateKey },
  });
}

/**
 * The record a score submission needs (server verification can replay `actionsLog` with the same seed, see replayDaily).
 * turns = turn of financial freedom, or null when the day did not end in freedom.
 */
export function dailyResult(state) {
  if (!state.daily) throw new EngineError('not a daily game');
  return {
    date: state.daily.date,
    seed: state.seed,
    turns: state.status === 'won' ? state.winTurn : null,
    netWorth: netWorth(state),
    professionId: state.profession.id,
    mode: state.mode,
    actionsLog: state.daily.log.map((a) => [...a]),
  };
}

// v0.5: the daily's stored v2.5 log entries ([name, ...args]) map onto the engine's dispatch actions (one table for every game).
const LEGACY = {
  roll: () => ({ type: 'roll' }),
  buy: (qty) => ({ type: 'buy', qty }),
  takeLoan: (amount) => ({ type: 'takeLoan', amount }),
  repayLoan: (id, amount) => ({ type: 'repayLoan', id, amount }),
  sellAsset: (id, qty) => ({ type: 'sellAsset', id, qty }),
  decide: (option) => ({ type: 'decide', option }),
  answerAudit: (answer) => ({ type: 'answerAudit', ...(answer ?? {}) }),
  renovate: (assetId, level, style) => ({ type: 'renovate', assetId, level, style }),
  chooseDeal: (cardId) => ({ type: 'chooseDeal', cardId }),
};
const SIMPLE = ['pass', 'acceptOffer', 'declineOffer', 'donate', 'declineCharity', 'forfeit', 'armReroll'];
export const legacyAction = ([name, ...args]) => {
  if (LEGACY[name]) return LEGACY[name](...args);
  if (SIMPLE.includes(name)) return { type: name };
  throw new EngineError(`unknown action ${name}`);
};

/** Re-runs a daily game from its date and action log. The server-side check of a score is exactly this. */
export function replayDaily(engine, { date, actionsLog }) {
  let s = newDailyGame(engine, date);
  for (const entry of actionsLog) s = engine.dispatch(s, legacyAction(entry));
  return s;
}
