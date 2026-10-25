// L6 'בעולם האמיתי': the fact cards behind the real-world row. The view model holds ONLY the texts that may be shown:
// `game` (the game's own figures) and `real` (qualitative claims). `numbers` (real-world figures) are never exposed
// while numbers.publish is false (spec 8): they are not part of any view model.
import { learnContent } from './content.js';
import { fillSlots, rateSlots } from './slots.js';
import { LOAN_PAYMENT_RATE } from '../engine/config.js';

const visible = (f) => f.status !== 'hidden';

/** The fact card for an opportunity / market card id (flagged realWorld in the cards file), or null. */
export const factForCard = (cardId) => learnContent().realWorld.facts.find((f) => visible(f) && f.cardIds.includes(cardId)) ?? null;
/** Facts attached to a concept (shown inside the dictionary entry). */
export const DICTIONARY_MAX_FACTS = 2;
export const factsForConcept = (conceptId) => learnContent().realWorld.facts
  .filter((f) => visible(f) && f.concept === conceptId && f.dictionary !== false).slice(0, DICTIONARY_MAX_FACTS);
/** The general fact of a place (`appliesTo`), e.g. 'loan-window'. */
export const factForPlace = (place) => learnContent().realWorld.facts.find((f) => visible(f) && f.appliesTo === place) ?? null;

/** What the UI may print for a fact. Numbers with publish:false are left out on purpose. */
/** `rate` = the monthly bank rate in force (loanRateNow(state)); the game's own figures are filled from it, never typed. */
export function realWorldView(fact, { rate } = {}) {
  const ui = learnContent().realWorld.ui;
  const slots = rateSlots(rate);
  // QA round 16 P3-b: while a cheap-loan card runs, the text does not call the rate 'high on purpose'
  const cheap = Number.isFinite(rate) && rate < LOAN_PAYMENT_RATE;
  const out = { id: fact.id, title: ui.title, gameLabel: ui.gameLabel, realLabel: ui.realLabel, game: fillSlots(cheap && fact.gameCheap ? fact.gameCheap : fact.game, slots), real: fillSlots(fact.real, slots), disclaimer: ui.disclaimer };
  // A figure becomes visible only after finance flips publish to true (source + date). Until then it stays out.
  if (fact.numbers && fact.numbers.publish === true) out.figure = fact.numbers.text;
  return out;
}

/** v4 stage 4: a guide screen's published figure ({ text, verified } or null). Only figures with publish: true ever reach a screen. */
export function publishedFigure(screen) {
  const n = screen?.numbers;
  return n?.publish === true && n.text ? { text: n.text, verified: n.verified ?? null } : null;
}
