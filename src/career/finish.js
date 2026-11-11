// The end of a finished game, as the career sees it: verify the end state, find the new achievements, pay the XP, move the ranks.
// Pure (the caller passes today's date key); the device store is src/career/store.js. A game that does not count (the daily challenge, a
// practice mission, a game still playing, a log that does not replay to its end) changes nothing and returns null.
import { verifyResult } from '../engine/challenge.js';
import { configOf } from '../engine/challenge.js';
import { weekNumber } from '../daily/calendar.js';
import { awardGame, awardAchievements, recordOf, promoWeekProfession, effectiveWeek } from './career.js';
import { evaluateGame, evaluateRankBased } from './achievements.js';

/** True when the game's own log replays to the end state it claims (a game with no log, e.g. an old resumed one, is taken as it is). */
export function endStateVerified(engine, state) {
  if (!Array.isArray(state.log) || !state.log.length || state.rngVersion !== 2) return true;
  const v = verifyResult(engine, { rngVersion: 2, seed: state.seed, config: configOf(state), actions: state.log });
  return !!v.ok && v.status === state.status && v.turns === state.turn;
}

/**
 * @param profile  the active profile (before the game)
 * @param state    the final engine state of the profile's own game (status 'won' or 'lost')
 * @returns null, or { profile, events, xp, rankUps, newAchievements, record } where `events` are the seniority events settled first
 *   ({ type: 'reset' | 'drop' }), `xp` = { game, achievements, doubled } and `rankUps` = [{ professionId, from, to }]
 */
export function finishGame({ engine, profile, state, today, professionIds = engine.data.professions.map((p) => p.id), mission = false }) {
  const record = recordOf(state, { mission });
  if (!record || !profile || !endStateVerified(engine, state)) return null;
  const week = effectiveWeek(profile, today);
  const promo = promoWeekProfession(week, professionIds);
  const { earned, counters } = evaluateGame({ engine, state, record, profile, promoProfessionId: promo });
  const base = { ...profile, counters };
  const first = awardGame(base, record, { today, earned, professionIds });
  let p = first.profile;
  const rankUps = [...first.rankUps];
  const newAchievements = [...earned.filter((id) => !(id in profile.achievements))];
  let xp = { ...first.xp };
  // the ladder achievements are judged after the XP landed; their own XP can raise a rank in turn (at most a few passes)
  for (let pass = 0; pass < 3; pass++) {
    const more = evaluateRankBased(p);
    if (!more.length) break;
    const r = awardAchievements(p, more, { today, professionId: record.professionId, doubled: xp.doubled });
    p = r.profile; rankUps.push(...r.rankUps); newAchievements.push(...more); xp = { ...xp, achievements: xp.achievements + r.xp };
  }
  return { profile: p, events: first.events, xp, rankUps, newAchievements, record, week: weekNumber(today) };
}
