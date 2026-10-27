// Daily challenge (v2.5), pure. Everyone who plays on the same calendar date gets the same profession, the same dice and
// the same card draws, whatever they choose to buy, pass or borrow. That needs streams that do not depend on the rng state:
//   die k of turn i       = f(seed, 'die', i, k)
//   card drawn at turn i  = f(seed, deck, i)   (picks an eligible card of that deck)
// Opt-in: a game created with `daily` uses these; every normal game keeps its seeded rng exactly as before.
import { EngineError } from './engine.js';
import { netWorth } from './selectors.js';

/** Turn 40 resolved without financial freedom = the day's challenge is over ("not this time"). */
export const DAILY_TURN_CAP = 40;
export const DAILY_MODE = 'family';

/** FNV-1a 32 bit over the UTF-16 code units, finished with a murmur-style avalanche. Stable across platforms. */
export function hashString(str) {
  let h = 0x811C9DC5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Seed of a local calendar date 'YYYY-MM-DD' (always a positive 32 bit integer). */
export function dailySeed(dateKey) {
  if (!isDateKey(dateKey)) throw new EngineError(`bad date key ${dateKey}`);
  return hashString(`passivo-daily|${dateKey}`) || 1;
}

const unit = (seed, tag, i, k) => hashString(`${seed}|${tag}|${i}|${k}`) / 4294967296;

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

const APPLY = {
  roll: (e, s) => e.roll(s),
  buy: (e, s, qty) => e.buy(s, qty),
  pass: (e, s) => e.pass(s),
  acceptOffer: (e, s) => e.acceptOffer(s),
  declineOffer: (e, s) => e.declineOffer(s),
  donate: (e, s) => e.donate(s),
  declineCharity: (e, s) => e.declineCharity(s),
  takeLoan: (e, s, amount) => e.takeLoan(s, amount),
  repayLoan: (e, s, id, amount) => e.repayLoan(s, id, amount),
  sellAsset: (e, s, id, qty) => e.sellAsset(s, id, qty),
  forfeit: (e, s) => e.forfeit(s),
  decide: (e, s, optionId) => e.decide(s, optionId),
  answerAudit: (e, s, answer) => e.answerAudit(s, answer),
  renovate: (e, s, assetId, level, style) => e.renovate(s, assetId, style ?? undefined),
  auctionWin: (e, s, card, price) => e.auctionWin(s, card, price),
};

/** Re-runs a daily game from its date and action log. The server-side check of a score is exactly this. */
export function replayDaily(engine, { date, actionsLog }) {
  let s = newDailyGame(engine, date);
  for (const [name, ...args] of actionsLog) {
    const fn = APPLY[name];
    if (!fn) throw new EngineError(`unknown action ${name}`);
    s = fn(engine, s, ...args);
  }
  return s;
}
