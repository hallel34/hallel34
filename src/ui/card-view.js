// Display wording of a card per mode. A card may carry `titleFamily` / `textFamily` (children's wording without adult terms);
// family mode shows them when present, full mode always shows `title` / `text`. Display only: the engine never reads these.
import { getLearnMode } from '../learn/context.js';
import { cardView } from '../engine/card-view.js';
import { getEngine } from './session.js';

const familyOn = (mode) => (mode ?? getLearnMode()) === 'family';
export const cardTitle = (card, mode) => (card ? cardView(card, familyOn(mode) ? 'family' : 'full').title : '');
export const cardText = (card, mode) => (card ? cardView(card, familyOn(mode) ? 'family' : 'full').text : '');
/** The title of a bought asset: its card's family wording when there is one (assets store the plain card title). */
export function assetTitle(asset, mode, cards = getEngine()?.data?.cards ?? []) {
  const card = cards.find((c) => c.id === asset?.cardId);
  return card ? cardTitle(card, mode) : asset?.title ?? '';
}
