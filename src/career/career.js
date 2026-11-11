// Career (0.5.0): profiles, XP and ranks per profession, and seniority (ותק). Pure logic like src/daily/streak.js: no DOM, no clock
// (the caller passes today's local date key), nothing is stored here (src/career/store.js reads and writes the device record).
//
// Device record `passivo.career` (schema CAREER_SCHEMA): { v, active, profiles: [ profile ] }
// profile = { id, name, age, fox, since, games, ranks: { [professionId]: { rank, xp } }, peak: { [professionId]: rank },
//   lastPlayWeek, settledWeek, missed, achievements: { [id]: dateKey }, counters: { badPasses, challengeStreak, wonProfessions } }
//
// Seniority, in short (docs/decisions.md 2026-11-10 / 2026-11-11):
//  - Any finished game (a win or a game over; quitting does not count) keeps the week (Sunday to Saturday, local time).
//  - A full week without one resets the progress to the next rank in every profession; the second week in a row drops every
//    profession above rank 0 by one rank; the count then restarts at SENIORITY_COUNT_AFTER_DROP (1 = a drop per further week).
//  - A profile whose age band is protected (CAREER_PROTECTED_AGE and younger, or no band at all) never loses anything: the career waits.
//  - Clock guards as in streak.js: a clock moved back restores nothing; a date absurdly far ahead is ignored.
import { dayKey, weekNumber } from '../daily/calendar.js';
import { chipView, isProtectedAge, promoWeekProfession } from './lite.js';
import {
  AGE_BANDS, CAREER_PROTECTED_AGE, MAX_RANK, XP_WIN, XP_LOSS, XP_ACHIEVEMENT, XP_LOWER_RANK_SHARE, PROMO_WEEK_XP_MULTIPLIER, RANK_XP_NEEDED,
  SENIORITY_RESET_AFTER, SENIORITY_DROP_AFTER, SENIORITY_COUNT_AFTER_DROP, CAREER_MAX_DROPS_PER_RETURN, CAREER_MAX_WEEK_JUMP, MAX_PROFILES,
  PROFILE_NAME_MAX, CAREER_WARN_FROM_WEEKDAY, CAREER_DEADLINE_WEEKDAY,
} from '../engine/config.js';

export const CAREER_SCHEMA = 1;
export const emptyCareer = () => ({ v: CAREER_SCHEMA, active: null, profiles: [] });

// ---------- the age guard (src/career/lite.js: it ships on home) ----------
export { isProtectedAge };

// ---------- the promotion week ----------
export { promoWeekProfession };

// ---------- XP and ranks ----------
/** XP needed to leave `rank` (Infinity at the top). */
export const xpNeeded = (rank) => (rank >= MAX_RANK ? Infinity : RANK_XP_NEEDED[rank] ?? Infinity);
const clampInt = (n, lo, hi) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : lo);

/** { rank, xp, need } of a profession in a profile (a profession never played is rank 0 with no XP). */
export function standing(profile, professionId) {
  const r = profile?.ranks?.[professionId] ?? { rank: 0, xp: 0 };
  return { rank: r.rank, xp: r.xp, need: xpNeeded(r.rank) };
}

/**
 * XP a finished game pays: XP_WIN for a win, XP_LOSS otherwise; a game started below the profession's current rank pays
 * XP_LOWER_RANK_SHARE of it (so easy games cannot be farmed); the promotion week's profession pays PROMO_WEEK_XP_MULTIPLIER times.
 */
export function gameXp({ won, gameRank = 0, careerRank = 0, doubled = false }) {
  let xp = won ? XP_WIN : XP_LOSS;
  if (gameRank < careerRank) xp = Math.floor(xp * XP_LOWER_RANK_SHARE);
  return doubled ? xp * PROMO_WEEK_XP_MULTIPLIER : xp;
}

// ---------- reading what was stored ----------
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

function parseRanks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, r] of Object.entries(raw)) {
    if (!r || typeof r !== 'object') continue;
    const rank = clampInt(r.rank, 0, MAX_RANK);
    out[id] = { rank, xp: rank >= MAX_RANK ? 0 : clampInt(r.xp, 0, xpNeeded(rank) - 1) };
  }
  return out;
}

/** One profile from whatever was stored; null when it is not a profile at all. */
export function parseProfile(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const week = (w) => (Number.isInteger(w) && w >= 0 ? w : null);
  const ranks = parseRanks(raw.ranks);
  const peak = {};
  for (const [id, r] of Object.entries(raw.peak && typeof raw.peak === 'object' ? raw.peak : {})) peak[id] = clampInt(r, 0, MAX_RANK);
  for (const [id, r] of Object.entries(ranks)) peak[id] = Math.max(peak[id] ?? 0, r.rank); // the history never trails the rank
  const ach = {};
  for (const [id, d] of Object.entries(raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {})) if (isKey(d)) ach[id] = d;
  const c = raw.counters && typeof raw.counters === 'object' ? raw.counters : {};
  return {
    id: raw.id,
    name: cleanProfileName(raw.name),
    age: AGE_BANDS.includes(raw.age) ? raw.age : null,
    fox: typeof raw.fox === 'string' ? raw.fox.slice(0, 24) : null,
    since: isKey(raw.since) ? raw.since : null,
    games: clampInt(raw.games, 0, 99999),
    ranks, peak,
    lastPlayWeek: week(raw.lastPlayWeek), settledWeek: week(raw.settledWeek),
    lastPlayDate: isKey(raw.lastPlayDate) ? raw.lastPlayDate : null, // the day of the last finished game (the profile's week strip)
    lastGame: typeof raw.lastGame === 'string' ? raw.lastGame.slice(0, 64) : null, // the id of the last credited game: a game is credited once
    missed: clampInt(raw.missed, 0, 99),
    achievements: ach,
    counters: {
      badPasses: clampInt(c.badPasses, 0, 99999),
      challengeStreak: clampInt(c.challengeStreak, 0, 99999),
      wins: clampInt(c.wins, 0, 99999),
      wonProfessions: Array.isArray(c.wonProfessions) ? [...new Set(c.wonProfessions.filter((x) => typeof x === 'string'))] : [],
    },
  };
}

/** Anything that is not a valid v1 record starts over (never crashes); a profile that is not valid is dropped, at most MAX_PROFILES kept. */
export function parseCareer(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== CAREER_SCHEMA || !Array.isArray(raw.profiles)) return emptyCareer();
  const seen = new Set();
  const profiles = [];
  for (const p of raw.profiles) {
    const q = parseProfile(p);
    if (q && !seen.has(q.id) && profiles.length < MAX_PROFILES) { seen.add(q.id); profiles.push(q); }
  }
  return { v: CAREER_SCHEMA, active: profiles.some((p) => p.id === raw.active) ? raw.active : profiles[0]?.id ?? null, profiles };
}

export const cleanProfileName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, PROFILE_NAME_MAX);

// ---------- profiles ----------
/** A new profile. The age band is required (CEO 2026-11-11): without a valid band nothing is created. */
export function createProfile(career, { name, age, fox = null }, today) {
  const c = parseCareer(career);
  if (c.profiles.length >= MAX_PROFILES) return { career: c, profile: null, error: 'full' };
  if (!AGE_BANDS.includes(age)) return { career: c, profile: null, error: 'age' };
  let n = c.profiles.length + 1;
  while (c.profiles.some((p) => p.id === `p${n}`)) n += 1;
  const cur = weekNumber(today);
  const profile = parseProfile({
    id: `p${n}`, name: cleanProfileName(name), age, fox, since: today, games: 0, ranks: {}, peak: {},
    // the creation week counts as played: a new profile never starts with a debt
    lastPlayWeek: cur, settledWeek: cur - 1, missed: 0, achievements: {}, counters: {},
  });
  return { career: { ...c, active: profile.id, profiles: [...c.profiles, profile] }, profile, error: null };
}

/** Replaces one profile (by id) in a career record. */
export const withProfile = (career, profile) => ({ ...career, profiles: career.profiles.map((p) => (p.id === profile.id ? profile : p)) });

export function removeProfile(career, id) {
  const c = parseCareer(career);
  const profiles = c.profiles.filter((p) => p.id !== id);
  return { ...c, profiles, active: profiles.some((p) => p.id === c.active) ? c.active : profiles[0]?.id ?? null };
}
export function setActive(career, id) {
  const c = parseCareer(career);
  return c.profiles.some((p) => p.id === id) ? { ...c, active: id } : c;
}
export const activeProfile = (career) => career?.profiles?.find((p) => p.id === career.active) ?? null;

/** Edits the name and / or the favourite fox. */
export function editProfile(profile, { name, fox }) {
  return { ...profile, ...(name !== undefined ? { name: cleanProfileName(name) } : {}), ...(fox !== undefined ? { fox: typeof fox === 'string' ? fox.slice(0, 24) : null } : {}) };
}

/**
 * Changes the age band (free to edit, CEO 2026-11-11). Seniority is settled first under the old band. A profile that stops being protected
 * gets the current week as a grace week (it counts as played), so growing up never starts with a loss (educator: rules.fromAge11);
 * one that becomes protected forgets its missed-week count.
 */
export function setAge(profile, age, today) {
  if (!AGE_BANDS.includes(age) || age === profile.age) return { profile, events: [] };
  const synced = syncSeniority(profile, today);
  let p = { ...synced.profile, age };
  const cur = weekNumber(today);
  if (isProtectedAge(profile.age) && !isProtectedAge(age)) p = { ...p, lastPlayWeek: cur, settledWeek: Math.max(p.settledWeek ?? cur - 1, cur - 1), missed: 0 };
  if (!isProtectedAge(profile.age) && isProtectedAge(age)) p = { ...p, missed: 0 };
  return { profile: p, events: synced.events };
}

// ---------- seniority ----------
/**
 * The week a date counts as, for this profile: its real week, except that a date more than CAREER_MAX_WEEK_JUMP weeks past the settled
 * week cannot be a real clock and is read as the week right after it (nothing settles, nothing is lost or kept by it).
 */
export function effectiveWeek(profile, today) {
  const cur = weekNumber(today);
  if (profile?.settledWeek != null && cur - 1 - profile.settledWeek > CAREER_MAX_WEEK_JUMP) return profile.settledWeek + 1;
  return cur;
}

/**
 * Settles every week that ended before `today`'s week. Returns { profile, events } where events are
 *   { type: 'reset', week }                             the progress to the next rank started over, in every profession
 *   { type: 'drop', week, drops: [{ professionId, from, to }] }   every profession above rank 0 dropped one rank
 * A protected profile never loses anything: its weeks are settled and the only event is { type: 'waited', weeks } (shown as "the career waited"). A date before the settled week (a clock moved back) changes nothing,
 * and one more than CAREER_MAX_WEEK_JUMP weeks ahead of it is ignored (effectiveWeek).
 */
export function syncSeniority(profile, today) {
  const cur = effectiveWeek(profile, today);
  if (profile.settledWeek == null || profile.lastPlayWeek == null) {
    // no play yet (an older record without weeks): the current week is the first one, nothing to settle
    return { profile: { ...profile, lastPlayWeek: profile.lastPlayWeek ?? cur, settledWeek: cur - 1, missed: 0 }, events: [] };
  }
  if (cur - 1 <= profile.settledWeek) return { profile, events: [] }; // the same week, or a clock moved back: nothing is restored
  const guarded = isProtectedAge(profile.age);
  let { missed } = profile;
  let ranks = profile.ranks;
  const events = [];
  let drops = 0;
  let waited = 0;
  for (let w = profile.settledWeek + 1; w <= cur - 1; w++) {
    if (w === profile.lastPlayWeek) { missed = 0; continue; } // a game was finished in this week
    if (w < profile.lastPlayWeek) continue; // before the last play (already settled by an earlier sync)
    if (guarded) { waited += 1; continue; } // the career waits
    missed += 1;
    if (missed >= SENIORITY_DROP_AFTER) {
      if (drops < CAREER_MAX_DROPS_PER_RETURN) {
        const dropped = [];
        ranks = Object.fromEntries(Object.entries(ranks).map(([id, r]) => {
          if (r.rank > 0) { dropped.push({ professionId: id, from: r.rank, to: r.rank - 1 }); return [id, { rank: r.rank - 1, xp: 0 }]; }
          return [id, { rank: 0, xp: 0 }];
        }));
        drops += 1;
        if (dropped.length) events.push({ type: 'drop', week: w, drops: dropped });
        missed = SENIORITY_COUNT_AFTER_DROP;
      }
    } else if (missed >= SENIORITY_RESET_AFTER) {
      ranks = Object.fromEntries(Object.entries(ranks).map(([id, r]) => [id, { rank: r.rank, xp: 0 }]));
      events.push({ type: 'reset', week: w });
    }
  }
  // a protected profile that was away says so once, in kind words: the career waited (the junior return screen)
  if (waited) events.push({ type: 'waited', weeks: waited });
  return { profile: { ...profile, ranks, missed, settledWeek: cur - 1 }, events };
}

/**
 * What the home chip shows on `today` (spec: seniority chip):
 *  state 'kept'    a game was finished this week
 *  state 'open'    not yet, before the warning starts
 *  state 'warn'    not yet, and the warning weekday has come: `days` left (to CAREER_DEADLINE_WEEKDAY), `rank` true when the missed-week
 *                  count means the next missed week drops every rank (otherwise it resets the progress)
 *  state 'waiting' a protected profile: the career waits (never a loss word)
 *  state 'none'    no profile
 */
export function seniorityView(profile, today) {
  if (!profile) return { state: 'none' };
  return chipView(syncSeniority(profile, today).profile, today);
}

// ---------- a finished game ----------
/**
 * A finished game's record, from its final state (null for anything that does not count: the daily challenge, a practice mission,
 * a game that is still playing). Only a win or a game over counts (quitting from the menu never reaches an end state).
 */
export function recordOf(state, { mission = false } = {}) {
  if (!state || mission || state.daily || (state.status !== 'won' && state.status !== 'lost')) return null;
  return {
    professionId: state.profession.id, rank: state.rank ?? 0, won: state.status === 'won', mode: state.mode, junior: !!state.junior,
    challenge: !!state.challenge, turns: state.turn,
  };
}

const bump = (ranks, professionId, xp) => {
  let { rank, xp: have } = ranks[professionId] ?? { rank: 0, xp: 0 };
  const ups = [];
  have += xp;
  while (rank < MAX_RANK && have >= xpNeeded(rank)) { have -= xpNeeded(rank); ups.push({ professionId, from: rank, to: rank + 1 }); rank += 1; }
  return { ranks: { ...ranks, [professionId]: { rank, xp: rank >= MAX_RANK ? 0 : have } }, ups };
};

/**
 * Credits a finished game to a profile: settles seniority (events: reset / drop), marks the week played, pays the game's XP (and, via
 * `earned`, each new achievement's XP, once) into the game's profession, and raises ranks. `earned` = the ids of achievements this game
 * newly earned (src/career/achievements.js decides; they are recorded here with today's date). `professionIds` feeds the promotion week.
 * @returns { profile, events, xp: { game, achievements, doubled }, rankUps: [{ professionId, from, to }] }
 */
export function awardGame(profile, record, { today, earned = [], professionIds = [] }) {
  const synced = syncSeniority(profile, today);
  const week = effectiveWeek(synced.profile, today);
  // the last play never moves back (a clock set back restores nothing); a play always counts for the newest week seen
  let p = { ...synced.profile, lastPlayWeek: Math.max(synced.profile.lastPlayWeek ?? week, week), missed: 0, games: synced.profile.games + 1, lastPlayDate: today };
  const doubled = promoWeekProfession(week, professionIds) === record.professionId;
  const careerRank = standing(p, record.professionId).rank;
  const game = gameXp({ won: record.won, gameRank: record.rank, careerRank, doubled });
  const fresh = earned.filter((id) => !(id in p.achievements));
  const achievements = fresh.length * XP_ACHIEVEMENT * (doubled ? PROMO_WEEK_XP_MULTIPLIER : 1);
  const { ranks, ups } = bump(p.ranks, record.professionId, game + achievements);
  const peak = { ...p.peak };
  for (const u of ups) peak[u.professionId] = Math.max(peak[u.professionId] ?? 0, u.to);
  const ach = { ...p.achievements };
  for (const id of fresh) ach[id] = today;
  p = { ...p, ranks, peak, achievements: ach };
  return { profile: p, events: synced.events, xp: { game, achievements, doubled }, rankUps: ups, firstOfWeek: synced.profile.lastPlayWeek !== week };
}

/** Credits achievements earned outside a game's end (a rank-based one, found after the XP landed): their XP goes to `professionId`. */
export function awardAchievements(profile, ids, { today, professionId, doubled = false }) {
  const fresh = ids.filter((id) => !(id in profile.achievements));
  if (!fresh.length) return { profile, xp: 0, rankUps: [] };
  const xp = fresh.length * XP_ACHIEVEMENT * (doubled ? PROMO_WEEK_XP_MULTIPLIER : 1);
  const { ranks, ups } = bump(profile.ranks, professionId, xp);
  const peak = { ...profile.peak };
  for (const u of ups) peak[u.professionId] = Math.max(peak[u.professionId] ?? 0, u.to);
  const ach = { ...profile.achievements };
  for (const id of fresh) ach[id] = today;
  return { profile: { ...profile, ranks, peak, achievements: ach }, xp, rankUps: ups };
}

/** The ranks a profile can start a game at in `professionId`: its current rank and every lower one (the top rank last). */
export const startableRanks = (profile, professionId) => Array.from({ length: standing(profile, professionId).rank + 1 }, (_, i) => i);

export { dayKey };
