// PR21 review, task 1: when does starting a new normal game DESTROY something? Only when the single normal slot (`passivo.save`) holds a game that is
// still being played. A finished (won / lost) save only resumes to its end screen, so replacing it loses no progress. The daily, friend-challenge and
// mission slots are separate keys (match-store.js) and are never touched by a normal start, so they never ask.
import { SLOT_NORMAL, slotOf } from './match-store.js';
import { SCHEMA_VERSION } from '../engine/config.js';

/** @param existing the match loaded from the normal slot (app.js loadSave()), or null */
export const needsOverwriteConfirm = (existing) => !!existing && existing.status === 'playing' && slotOf(existing) === SLOT_NORMAL;

/**
 * A save written by a NEWER version of the app: this build cannot read it (deserialize returns null), so it is an UNKNOWN game in progress, and starting a
 * new game would silently destroy it. Garbage, `{}`, an old v1 shell or a shape without a schemaVersion stay silent: they are not recognisably a game.
 * @param raw the raw string of the normal slot
 */
export function isUnreadableNewerSave(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let s;
  try { s = JSON.parse(raw); } catch { return false; }
  return !!s && typeof s === 'object' && Number.isInteger(s.schemaVersion) && s.schemaVersion > SCHEMA_VERSION && Array.isArray(s.players) && s.players.length > 0;
}
