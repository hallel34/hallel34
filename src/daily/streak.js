// Day streak (D4): consecutive local calendar days on which the daily challenge was played (finished or given up).
// Stored on the device only. Schema-versioned; unknown / corrupt data starts over instead of crashing.
import { dayNumber, addDays } from './calendar.js';

export const STREAK_SCHEMA = 1;
export const STREAK_BADGES = [3, 7, 30]; // streak lengths that earn a badge (kept for good once earned)

export const MAX_COUNT = 9999; // a stored count above this cannot be real: clamped
const clampCount = (n) => (Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), MAX_COUNT) : 0);

export const emptyStreak = () => ({ v: STREAK_SCHEMA, last: null, count: 0, best: 0, badges: [] });

/** Reads whatever was stored; anything that is not a valid v1 record becomes an empty streak. */
export function parseStreak(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== STREAK_SCHEMA) return emptyStreak();
  const okKey = typeof raw.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.last);
  const count = clampCount(raw.count);
  if (!okKey && raw.last != null) return emptyStreak();
  return {
    v: STREAK_SCHEMA, last: okKey ? raw.last : null, count: okKey ? count : 0,
    best: Math.max(count, clampCount(raw.best)),
    badges: Array.isArray(raw.badges) ? raw.badges.filter((b) => STREAK_BADGES.includes(b)) : [],
  };
}

/** The streak after the challenge of `date` was played. The same day twice changes nothing; a gap restarts at 1. */
export function recordPlay(streak, date) {
  const s = parseStreak(streak);
  // a stored 'last' more than a day ahead of the date being played cannot be real (clock moved forward and back, or a restored
  // backup): it is ignored instead of freezing the streak. One day ahead is a clock set back a little: nothing changes then.
  if (s.last != null && dayNumber(s.last) > dayNumber(date) + 1) return recordPlay({ ...s, last: null, count: 0 }, date);
  if (s.last != null && dayNumber(date) <= dayNumber(s.last)) return s;
  const count = s.last != null && dayNumber(date) - dayNumber(s.last) === 1 ? Math.min(s.count + 1, MAX_COUNT) : 1;
  const badges = [...new Set([...s.badges, ...STREAK_BADGES.filter((b) => count >= b)])].sort((a, b) => a - b);
  return { v: STREAK_SCHEMA, last: date, count, best: Math.max(s.best, count), badges };
}

/**
 * What to show on `today`:
 *  state 'none'    never played
 *  state 'today'   played today (count = the streak, safe until tomorrow's challenge)
 *  state 'pending' played yesterday, not yet today: the streak is alive, today's play extends it
 *  state 'broken'  a streak existed and a day was missed: count is 0 now; prev = the ended streak, missed = days skipped
 */
export function streakView(streak, today) {
  const s = parseStreak(streak);
  const base = { best: s.best, badges: s.badges, newBadges: [] };
  if (s.last == null) return { ...base, state: 'none', count: 0 };
  if (s.last === today) return { ...base, state: 'today', count: s.count };
  if (s.last === addDays(today, -1)) return { ...base, state: 'pending', count: s.count };
  const ahead = dayNumber(s.last) - dayNumber(today);
  if (ahead === 1) return { ...base, state: 'today', count: s.count }; // clock set back by a day: keep what we have
  if (ahead > 1) return { ...base, state: 'none', count: 0 }; // 'last' too far in the future (tampering / restore): ignored, the streak is not frozen
  // missed = whole days skipped since the last play, prev = the streak that ended
  return { ...base, state: s.count > 0 ? 'broken' : 'none', count: 0, prev: s.count, missed: -ahead - 1 };
}

/** Badges earned by the play that turned `before` into `after`. */
export const newBadges = (before, after) => parseStreak(after).badges.filter((b) => !parseStreak(before).badges.includes(b));
