// PR21 review, task 1: when does starting a new normal game DESTROY something? Only when the single normal slot (`passivo.save`) holds a game that is
// still being played. A finished (won / lost) save only resumes to its end screen, so replacing it loses no progress. The daily, friend-challenge and
// mission slots are separate keys (match-store.js) and are never touched by a normal start, so they never ask.
import { SLOT_NORMAL, slotOf } from './match-store.js';

/** @param existing the match loaded from the normal slot (app.js loadSave()), or null */
export const needsOverwriteConfirm = (existing) => !!existing && existing.status === 'playing' && slotOf(existing) === SLOT_NORMAL;
