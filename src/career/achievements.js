// Learning achievements (0.5.0): the 16 conditions of src/career/achievements.he.json (the educator's plain-word conditions, ids, params and
// texts) as pure functions over a finished game's final state and its action log. Nothing here reads a clock or a store.
//   evaluateGame(...)       the ids a finished game earns (and the profile counters it moves)
//   evaluateRankBased(...)  the two ladder achievements, judged after the XP landed
//   gameTimeline(...)       the facts only a replay of the log can tell (a milestone's turn, a debt repaid before the first asset, ...)
// An achievement is earned once per profile and never taken away. Practice missions, the daily challenge, bots and the other hot-seat
// seats never earn one (the caller passes only a one-player game of the profile's own player; recordOf() returns null for the rest).
import ACHIEVEMENT_DATA from './achievements.he.json';
import { assetCashFlow, PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS } from '../engine/index.js';
import { configOf } from '../engine/challenge.js';
import { stateHashSafe } from './util.js';

export const ACHIEVEMENTS = ACHIEVEMENT_DATA.achievements;
export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id) ?? null;
const param = (id, key) => achievementById(id).params[key];

/** Whether an achievement can be earned in a game of this kind: { full, family, junior } flags from its `suits`. */
export const suitsGame = (a, { mode, junior }) => (junior ? a.suits.junior : mode === 'full' ? a.suits.full : a.suits.family);

const decisionsOf = (state) => state?.learn?.decisions ?? [];

/**
 * What a replay of the game's log shows. All false / null for a game that cannot be replayed (rngVersion 1, or no log): those games
 * simply cannot earn the log-based achievements.
 * @returns { replayed, milestone25Turn, debtBeforeAsset, threeKinds, repaidBankLoan }
 */
export function gameTimeline(engine, state) {
  const out = { replayed: false, milestone25Turn: null, debtBeforeAsset: false, threeKinds: false, repaidBankLoan: false };
  if (!state || state.rngVersion !== 2 || !Array.isArray(state.log) || !state.log.length) return out;
  let s;
  try { s = engine.newGame({ ...configOf(state), seed: state.seed }); } catch { return out; }
  const start = s.liabilities.filter((l) => l.kind === 'base');
  // the 'expensive' starting debt: the highest monthly payment per shekel owed (card, else car, else student)
  const dear = [...start].sort((a, b) => b.monthlyPayment / b.principal - a.monthlyPayment / a.principal)[0] ?? null;
  const kinds = (st) => { const t = new Set(st.assets.map((a) => a.type)); return t.has('apartment') && t.has('business') && t.has('stock'); };
  try {
    for (const a of state.log) {
      const prev = s;
      s = engine.dispatch(prev, a);
      if (out.milestone25Turn === null && s.events.some((e) => e.type === 'milestone' && e.pct === 25)) out.milestone25Turn = s.turn;
      // the first asset of the game: was the dearest starting debt already repaid in full?
      if (prev.stats.dealsBought === 0 && s.stats.dealsBought > 0 && dear && !prev.liabilities.some((l) => l.id === dear.id)) out.debtBeforeAsset = true;
      if (kinds(s)) out.threeKinds = true;
      // a bank loan that was there and is gone: repaid in full (nothing else removes one)
      const loansBefore = prev.liabilities.filter((l) => l.kind === 'loan').map((l) => l.id);
      if (loansBefore.some((id) => !s.liabilities.some((l) => l.id === id))) out.repaidBankLoan = true;
    }
  } catch { return out; }
  out.replayed = stateHashSafe(s) === stateHashSafe(state); // a log that does not rebuild this state proves nothing
  return out;
}

/** The profile counters after a finished game (bad passes, challenge streak, wins, professions won). */
export function updateCounters(counters, record, state) {
  const bad = decisionsOf(state).filter((d) => d.kind === 'pass' && (d.type === 'apartment' || d.type === 'business') && (d.tier === 'bad' || d.tier === 'trap') && d.afford === true).length;
  const wonProfessions = record.won ? [...new Set([...counters.wonProfessions, record.professionId])] : counters.wonProfessions;
  return {
    badPasses: counters.badPasses + bad,
    challengeStreak: record.challenge ? (record.won ? counters.challengeStreak + 1 : 0) : counters.challengeStreak,
    wins: counters.wins + (record.won ? 1 : 0),
    wonProfessions,
  };
}

/**
 * The ids of the achievements a finished game earns.
 * @param profile      the profile BEFORE the game (its achievements and counters)
 * @param promoProfessionId the promotion-week profession of the week the game ended in
 * @returns { earned: [id], counters } — counters is the profile's counters after the game (the caller stores them)
 */
export function evaluateGame({ engine, state, record, profile, promoProfessionId = null }) {
  const counters = updateCounters(profile.counters, record, state);
  if (!record) return { earned: [], counters: profile.counters };
  const decisions = decisionsOf(state);
  const raw = gameTimeline(engine, state);
  // a log that does not rebuild the final state proves nothing: the log-based achievements are then not earned
  const tl = raw.replayed ? raw : { ...raw, milestone25Turn: null, debtBeforeAsset: false, threeKinds: false, repaidBankLoan: false };
  const ctx = {
    decisions, tl, counters,
    won: record.won,
    firstWin: record.won && profile.counters.wins === 0,
  };
  const checks = {
    'spot-bad-deals': () => counters.badPasses >= param('spot-bad-deals', 'count'),
    'win-no-bank-loan': () => ctx.won && state.stats.loansTaken === 0,
    'debt-before-asset': () => tl.debtBeforeAsset,
    'quarter-early': () => tl.milestone25Turn !== null && tl.milestone25Turn < param('quarter-early', 'beforeTurn'),
    'fast-payback': () => decisions.some((d) => d.kind === 'buy' && (d.type === 'apartment' || d.type === 'business') && d.tier === 'good'),
    'promo-keep': () => decisions.some((d) => d.kind === 'promotion' && d.choice === 'keep'),
    'expenses-from-cash': () => {
      const ex = decisions.filter((d) => d.kind === 'expense');
      return ex.length >= param('expenses-from-cash', 'count') && !ex.some((d) => d.viaLoan === true || d.viaSale === true);
    },
    'all-assets-earn': () => ctx.won && state.assets.length >= param('all-assets-earn', 'minAssets') && state.assets.every((a) => assetCashFlow(state, a) > 0),
    'three-kinds': () => tl.threeKinds,
    'repaid-bank-loan': () => tl.repaidBankLoan,
    'first-freedom': () => ctx.firstWin,
    'challenge-streak-3': () => counters.challengeStreak >= param('challenge-streak-3', 'count'),
    'all-professions': () => counters.wonProfessions.length >= param('all-professions', 'professions'),
    'promo-week-freedom': () => ctx.won && promoProfessionId !== null && record.professionId === promoProfessionId,
  };
  const earned = ACHIEVEMENTS
    .filter((a) => checks[a.id] && !(a.id in profile.achievements) && suitsGame(a, record))
    .filter((a) => checks[a.id]())
    .map((a) => a.id);
  return { earned, counters };
}

/** The ladder achievements (first rank up, top rank), judged on the profile after the XP landed. */
export function evaluateRankBased(profile) {
  const peaks = Object.values(profile.peak ?? {});
  return ACHIEVEMENTS.filter((a) => !(a.id in profile.achievements) && ((a.id === 'first-rank-up' && peaks.some((r) => r >= 1)) || (a.id === 'top-rank' && peaks.some((r) => r >= 3)))).map((a) => a.id);
}

export { PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS };
