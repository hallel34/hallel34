// localStorage side of the daily challenge. Keys: passivo.dailyResults, passivo.dailyStreak, passivo.dailySave (in app.js).
import { readJSON, writeJSON, remove } from '../services/storage.js';
import { parseResults, completeAttempt } from './attempt.js';
import { parseStreak } from './streak.js';

export const loadResults = () => parseResults(readJSON('dailyResults'));
export const loadStreak = () => parseStreak(readJSON('dailyStreak'));
export const resultFor = (date) => loadResults().byDate[date] ?? null;

/** Stores the finished daily game (once per day) and the streak. Returns completeAttempt()'s answer. */
export function finishDailyGame(state) {
  const out = completeAttempt({ results: loadResults(), streak: loadStreak() }, state);
  if (out.fresh) { writeJSON('dailyResults', out.results); writeJSON('dailyStreak', out.streak); }
  return out;
}

/**
 * The ordered end of a daily game: the RESULT is written first, then the streak, and only then the save slot is cleared
 * (clearSave). A reload at any instant keeps the attempt: before the result a save still exists, after it the day is 'done'.
 */
export function endDailyGame(state, clearSave = () => {}) {
  const out = finishDailyGame(state);
  clearSave();
  return out;
}

/** ?debug=1 only: forget today's result so the day can be played again (the streak and older days stay). */
export function resetDay(date) {
  const r = loadResults();
  delete r.byDate[date];
  writeJSON('dailyResults', r);
  remove('dailySave');
}
