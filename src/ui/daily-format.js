// Texts of the daily challenge shared by the start card and the result screen. Everything comes from he.json.
import { t, tp } from '../i18n/index.js';
import { countdownParts, msUntilNextDay, shortDate } from '../daily/calendar.js';

/** 'האתגר הבא בעוד 5 שעות ו-32 דקות' (whole hours only / whole minutes only when the other part is zero). */
export function nextChallengeText(now = new Date()) {
  const { hours, minutes } = countdownParts(msUntilNextDay(now));
  const parts = [hours ? tp('plural.hours', hours) : null, minutes ? tp('plural.minutes', minutes) : null].filter(Boolean);
  const time = parts.length === 2 ? t('daily.timeBoth', { hours: parts[0], minutes: parts[1] }) : parts[0];
  return t('daily.cardNext', { time });
}

/** The streak line for a streakView(): 'שיחקתם 5 ימים ברצף', the gentle restart message, or '' (nothing to say). */
export function streakText(view) {
  if (view.state === 'broken') {
    // 'did you miss a day?' only fits a real streak (2+) that ended just now (1-3 days); otherwise a neutral welcome back
    return view.prev >= 2 && view.missed >= 1 && view.missed <= 3 ? t('daily.streakBroken') : t('daily.streakWelcomeBack');
  }
  if (view.state === 'pending' && view.count > 0) return `${tp('plural.streakDays', view.count)}. ${t('daily.streakPending')}`;
  if (view.count > 0) return tp('plural.streakDays', view.count);
  return '';
}

/** The learning headline needs at least 3 rated decisions; fewer (a short game, an early give-up) says "no data" instead of "all green". */
export const MIN_RATED_FOR_HEADLINE = 3;
export const headlineGreen = (g) => (g && g.total < MIN_RATED_FOR_HEADLINE ? { ...g, kind: 'noData' } : g);

export const badgeLabel = (days) => tp('plural.badgeDays', days);
export const outcomeText = (record) => (record.turns == null ? t('daily.cardDoneFail') : t('daily.cardDoneFreedom', { turns: tp('plural.turnsIn', record.turns) }));
export const cardTitleText = (date) => t('daily.cardTitle', { date: shortDate(date) });
