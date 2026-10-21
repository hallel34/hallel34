// Device-level learning progress in localStorage (spec 3 and 4): concepts already explained, badges earned.
// The per-game record (what the report counts) lives in the engine state (state.learn); this is what survives games.
import { readJSON, writeJSON } from '../services/storage.js';

const SEEN_KEY = 'learn.seen';
const BADGES_KEY = 'learn.badges';

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/** Concept ids explained (or opened in the dictionary) on this device. */
export const seenConcepts = () => new Set(list(readJSON(SEEN_KEY, [])));

/** Marks a concept as seen. Returns true when it was new on this device. */
export function markConceptSeen(id) {
  const seen = seenConcepts();
  if (seen.has(id)) return false;
  seen.add(id);
  writeJSON(SEEN_KEY, [...seen]);
  return true;
}

export const badges = () => {
  const b = readJSON(BADGES_KEY, {});
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
};
export const hasBadge = (id) => !!badges()[id];
/** Records a badge (count of times earned). Returns true the first time on this device. */
export function earnBadge(id) {
  const b = badges();
  const first = !b[id];
  b[id] = (b[id] ?? 0) + 1;
  writeJSON(BADGES_KEY, b);
  return first;
}
