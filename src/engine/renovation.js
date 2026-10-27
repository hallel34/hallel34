// Renovation of an owned coffee business (owner idea, 2026-10-27: "קנית בית קפה, ובהזדמנות הבאה אפשר לבחור לשפץ אותו").
// When a player who owns a coffee business lands on an opportunity square, the card offers a third choice next to
// buy / pass: renovate the business they already have. Three levels, each paid in cash, each raising the business's
// monthly cash flow. Level 2 carries the demo's style choice (מרפסת או טייק אוויי); the styles play identically.
// All numbers are multiples of 1,000 / 100, so a 'צעירים' (junior) game needs no rounding of its own.
import { JUNIOR_PRICE_ROUND, JUNIOR_ROUND } from './config.js';

export const RENOVATION_CATEGORY = 'coffee';
export const RENOVATION_MAX_LEVEL = 3;
// payback = cost / gain months: 50 / 60 / 75 (4.2y / 5y / 6.25y) - a good use of cash with diminishing returns.
export const RENOVATION_LEVELS = [
  { level: 1, cost: 40000, gain: 800, style: false },
  { level: 2, cost: 60000, gain: 1000, style: true }, // the player picks terrace / takeaway
  { level: 3, cost: 90000, gain: 1200, style: false },
];
export const RENOVATION_STYLES = ['terrace', 'takeaway'];

export const renovationLevel = (asset) => asset?.renovations?.level ?? 0;

/** The level definitions with junior-round numbers (deals in a junior game round to JUNIOR_PRICE_ROUND / JUNIOR_ROUND). */
export function renovationLevelsFor(state) {
  if (!state?.junior) return RENOVATION_LEVELS;
  const r = (x, q) => Math.max(q, Math.round(x / q) * q);
  return RENOVATION_LEVELS.map((l) => ({ ...l, cost: r(l.cost, JUNIOR_PRICE_ROUND), gain: r(l.gain, JUNIOR_ROUND) }));
}

/** The business's category: stored on newer assets, recovered from its card for older saves. */
export const assetCategory = (asset, cards = []) => asset?.category ?? cards.find((c) => c.id === asset?.cardId)?.category ?? null;

/**
 * The renovation the opportunity card can offer right now, or null: the player owns a coffee business below the top
 * level (the lowest-level one renovates first) and can pay the next level in cash.
 * `cards` (the engine's card data) recovers the category of assets saved before they carried it.
 * Returns { assetId, level (the level being built), cost, gain, style (true = the build asks terrace / takeaway) }.
 */
export function renovationOption(state, cards = []) {
  const candidates = (state.assets ?? [])
    .filter((a) => assetCategory(a, cards) === RENOVATION_CATEGORY && renovationLevel(a) < RENOVATION_MAX_LEVEL)
    .sort((a, b) => renovationLevel(a) - renovationLevel(b) || b.monthlyCashFlow - a.monthlyCashFlow);
  const asset = candidates[0];
  if (!asset) return null;
  const next = renovationLevelsFor(state)[renovationLevel(asset)];
  if (!next || state.cash < next.cost) return null;
  return { assetId: asset.id, level: next.level, cost: next.cost, gain: next.gain, style: next.style };
}
