// The part of the career the home screen needs, as small as it can be (it ships in the main bundle): the active profile read straight
// from the device store, and the chip state. The full logic (XP, seniority settling, achievements) is the lazy src/career/career.js.
import { readJSON } from '../services/storage.js';
import { weekNumber, weekDay, daysLeftInWeek } from '../daily/calendar.js';
import { keyedInt } from '../engine/rng.js';
import { AGE_BANDS, CAREER_PROTECTED_AGE, CAREER_WARN_FROM_WEEKDAY, CAREER_DEADLINE_WEEKDAY, SENIORITY_DROP_AFTER } from '../engine/config.js';

/** True when this age band never loses a rank or progress (CAREER_PROTECTED_AGE and younger, or no band at all). */
export const isProtectedAge = (age) => AGE_BANDS.indexOf(age) <= AGE_BANDS.indexOf(CAREER_PROTECTED_AGE);

/** The active profile as stored, unvalidated beyond its shape ({ id, name, age, fox, lastPlayWeek, settledWeek, missed, ranks, peak, ... }), or null. */
export function readActiveProfile(read = readJSON) {
  const c = read('career');
  if (!c || c.v !== 1 || !Array.isArray(c.profiles)) return null;
  const p = c.profiles.find((x) => x?.id === c.active) ?? c.profiles[0];
  return p && typeof p === 'object' && typeof p.id === 'string' ? p : null;
}

/** Whether a weekly settling could have something to report on `today` (a whole week ended since the last settled one). */
export const needsSettling = (p, today) => !!p && (!Number.isInteger(p.settledWeek) || weekNumber(today) - 1 > p.settledWeek);

/**
 * What the home chip shows on `today` for a profile whose weeks are settled:
 *  'waiting' (protected band), 'kept' (a game was finished this week), 'open' (not yet, before the warning day),
 *  'bonus' (after the deadline weekday, still in the week: a game finished today counts, nobody has to play: calm, never a warning),
 *  'warn' (the warning day has come: `days` left to CAREER_DEADLINE_WEEKDAY; `rank` = the next missed week drops every rank).
 */
export function chipView(p, today) {
  if (!p) return { state: 'none' };
  if (isProtectedAge(p.age)) return { state: 'waiting' };
  const cur = weekNumber(today);
  if ((p.lastPlayWeek ?? -1) >= cur) return { state: 'kept' };
  const days = daysLeftInWeek(today, CAREER_DEADLINE_WEEKDAY);
  if (p.dropped) return { state: 'open', days }; // a rank drop was applied: nothing more can be lost until a game is finished, so no warning
  // Saturday is a bonus day (owner 2026-11-11): the deadline was Friday, a game finished today still counts, and nobody has to play: a calm state, not a warning
  if (weekDay(today) > CAREER_DEADLINE_WEEKDAY) return { state: 'bonus', days: 1 };
  if (weekDay(today) >= CAREER_WARN_FROM_WEEKDAY) return { state: 'warn', days, rank: (p.missed ?? 0) + 1 >= SENIORITY_DROP_AFTER };
  return { state: 'open', days };
}

/** The profession that pays double XP in week `week`: keyed from the week number only (src/engine/rng.js), the same for everyone. */
export const promoWeekProfession = (week, professionIds) => (professionIds.length ? professionIds[keyedInt(week, 'promoWeek', 0, 0, professionIds.length)] : null);

/** How many profiles the device holds (the picker opens on launch from two). */
export function profileCount(read = readJSON) {
  const c = read('career');
  return c && c.v === 1 && Array.isArray(c.profiles) ? c.profiles.length : 0;
}
