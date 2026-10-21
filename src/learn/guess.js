// L2: the 'עסקה טובה?' guess, as view models (spec section 4 and 5). Pure.
import { dealMetrics, isDeal, guessCorrect, investorStreak } from '../engine/learn.js';
import { INVESTOR_EYE_STREAK } from '../engine/config.js';
import { learnContent } from './content.js';
import { yearsPhrase, pctText, lightSlots, fillSlots } from './slots.js';
import { pickLineIndex } from './feedback.js';

/** The guess is offered on apartment / business cards only: stocks never get a light or a guess (spec 5.1). */
export const guessApplies = (card) => isDeal(card);

/** Should the guess be offered? `enabled`: the player's setting for this mode (family default on, full default off). */
export const guessOffered = (card, enabled) => !!enabled && guessApplies(card);

const line = (list, seed, key, counter) => list[pickLineIndex(list.length, seed, key, counter)];

/**
 * Everything the reveal shows for a deal: yield, payback, the traffic light (label + legend + screen-reader text) and the
 * verdict line. Thresholds come from the config through dealMetrics / lightSlots; no number is typed in a text.
 */
export function revealModel(card, { seed = 0, counter = 0 } = {}) {
  const { guess } = learnContent();
  const m = dealMetrics(card);
  const L = guess.lights[m.light];
  const never = m.tier === 'trap';
  const key = never ? 'redNever' : m.light;
  const slots = never ? {} : { yield: pctText(m.yieldPct), years: yearsPhrase(m.years) };
  return {
    light: m.light, tier: m.tier, never,
    yieldLabel: guess.reveal.yieldLabel, yieldText: never ? pctText(Math.min(0, m.yieldPct)) : fillSlots(guess.reveal.yieldValue, { yield: pctText(m.yieldPct) }),
    paybackLabel: guess.reveal.paybackLabel, paybackText: never ? guess.reveal.paybackNever : fillSlots(guess.reveal.paybackValue, { years: yearsPhrase(m.years) }),
    label: L.label, a11y: L.a11y, legend: fillSlots(L.legend, lightSlots()), legendTitle: guess.reveal.legendTitle,
    verdict: fillSlots(line(guess.verdict[key], seed, `verdict.${key}`, counter), slots),
    note: guess.reveal.note,
  };
}

/** Result line after the pick: kind 'correct' | 'wrong' | 'yellowAny' | 'skipped'. */
export function resultModel(light, pick, { seed = 0, counter = 0 } = {}) {
  const { guess } = learnContent();
  const ok = guessCorrect(light, pick);
  const kind = pick === 'skip' ? 'skipped' : light === 'yellow' ? 'yellowAny' : ok ? 'correct' : 'wrong';
  return { kind, correct: ok, text: line(guess.guessResult[kind], seed, `result.${kind}`, counter) };
}

/** 'עין של משקיע' progress chip after a guess, and whether the badge was just earned. */
export function eyeModel(guesses, { wasEarned = false } = {}) {
  const { guess } = learnContent();
  const streak = investorStreak(guesses);
  const earned = streak >= INVESTOR_EYE_STREAK;
  return {
    streak, goal: INVESTOR_EYE_STREAK, earned, justEarned: earned && !wasEarned,
    text: fillSlots(guess.investorEye.progress, { streak: Math.min(streak, INVESTOR_EYE_STREAK), goal: INVESTOR_EYE_STREAK }),
    earnedText: guess.investorEye.earned, badgeName: guess.investorEye.badgeName,
  };
}

/** Stock card explainer (no light, no guess): dividend line + volatility + not guaranteed. */
export function stockNoteModel(card, { dividendText, yieldText }) {
  const { guess } = learnContent();
  const S = guess.stock;
  return {
    title: S.title, dividend: fillSlots(S.dividendLine, { dividend: dividendText, dividendYield: yieldText }),
    volatility: S.volatility, notGuaranteed: S.notGuaranteed, noLight: S.noLight,
  };
}
