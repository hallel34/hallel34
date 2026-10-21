// L6 'בעולם האמיתי': the fact cards behind the real-world row. The view model holds ONLY the texts that may be shown:
// `game` (the game's own figures) and `real` (qualitative claims). `numbers` (real-world figures) are never exposed
// while numbers.publish is false (spec 8): they are not part of any view model.
import { learnContent } from './content.js';

const visible = (f) => f.status !== 'hidden';

/** The fact card for an opportunity / market card id (flagged realWorld in the cards file), or null. */
export const factForCard = (cardId) => learnContent().realWorld.facts.find((f) => visible(f) && f.cardIds.includes(cardId)) ?? null;
/** Facts attached to a concept (shown inside the dictionary entry). */
export const factsForConcept = (conceptId) => learnContent().realWorld.facts.filter((f) => visible(f) && f.concept === conceptId);
/** The general fact of a place (`appliesTo`), e.g. 'loan-window'. */
export const factForPlace = (place) => learnContent().realWorld.facts.find((f) => visible(f) && f.appliesTo === place) ?? null;

/** What the UI may print for a fact. Numbers with publish:false are left out on purpose. */
export function realWorldView(fact) {
  const ui = learnContent().realWorld.ui;
  const out = { id: fact.id, title: ui.title, gameLabel: ui.gameLabel, realLabel: ui.realLabel, game: fact.game, real: fact.real, disclaimer: ui.disclaimer };
  // A figure becomes visible only after finance flips publish to true (source + date). Until then it stays out.
  if (fact.numbers && fact.numbers.publish === true) out.figure = fact.numbers.text;
  return out;
}
