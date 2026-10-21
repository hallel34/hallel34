// Local calendar helpers for the daily challenge. A "day" is the player's LOCAL calendar date, as 'YYYY-MM-DD'.
// Players in different time zones therefore get different days around midnight: accepted (docs/decisions.md).
// Day arithmetic goes through UTC day numbers, so a daylight-saving change (a 23 or 25 hour day) can never skip or repeat a day.
const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date of `date` as 'YYYY-MM-DD'. */
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parts = (key) => key.split('-').map(Number);

/** Whole days since 1970-01-01 of a date key (pure calendar maths, time zone free). */
export function dayNumber(key) {
  const [y, m, d] = parts(key);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Date key `n` days after `key` (n may be negative). */
export function addDays(key, n) {
  const [y, m, d] = parts(key);
  const u = new Date(Date.UTC(y, m - 1, d + n));
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;
}

/** b - a in calendar days. */
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);

/** '2026-10-21' -> '21.10' (the day and month, as shown on the card and in the share text). */
export function shortDate(key) {
  const [, m, d] = parts(key);
  return `${pad(d)}.${pad(m)}`;
}

/** Milliseconds from `now` until the next local midnight (the next challenge). Always > 0. */
export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1, next.getTime() - now.getTime());
}

/** { hours, minutes } left (minutes rounded up, so the card never shows 0:00 while the day is still running). */
export function countdownParts(ms) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}
