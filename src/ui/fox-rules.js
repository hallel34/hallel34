// Pure fox rules (no DOM): which reaction goes where, and when family-mode tips appear. See design/fox-usage.md.

/** Reaction crops (512px circle crops with a baked navy background). */
export const REACTIONS = ['think', 'celebrate', 'worried', 'ponder'];

/** Which crop a card category gets in the modal banner. */
export const CARD_REACTION = { opportunity: 'think', expense: 'worried', baby: 'worried', market: 'ponder', charity: 'celebrate' };

/** Board reaction for the square the pawn landed on (shown briefly before its card opens). */
export const LAND_REACTION = { opportunity: 'think', expense: 'worried', market: 'ponder', baby: 'worried', charity: 'think' };

/** Number of tip strings (fox.tip1..fox.tipN in the locale files). */
export const TIP_COUNT = 6;

/** Family-mode tip schedule: turns 1, 2, 3, then every 5th turn (8, 13, 18...). Returns the tip index, or -1 for no tip. */
export function tipIndexForTurn(turn) {
  if (turn >= 1 && turn <= 3) return turn - 1;
  if (turn > 3 && (turn - 3) % 5 === 0) return (2 + (turn - 3) / 5) % TIP_COUNT;
  return -1;
}
