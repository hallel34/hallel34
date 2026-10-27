// Device-level progress of 'המשחק הראשון עם מקסי' in localStorage (one key): { storyDone, quizDone, hintsSeen: { id: turn }, helpOn }.
// Hints are shown once per device (also in hot-seat: the first player who triggers one). 'helpOn' is the settings switch.
import { readJSON, writeJSON, readRaw } from '../services/storage.js';

const KEY = 'tutorial';

const normalise = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seen = r.hintsSeen && typeof r.hintsSeen === 'object' && !Array.isArray(r.hintsSeen) ? r.hintsSeen : {};
  return {
    storyDone: r.storyDone === true,
    quizDone: r.quizDone === true,
    hintsSeen: Object.fromEntries(Object.entries(seen).filter(([, v]) => Number.isFinite(v))),
    helpOn: r.helpOn !== false,
    hintsFrom: Number.isFinite(r.hintsFrom) && r.hintsFrom > 0 ? Math.floor(r.hintsFrom) : 0, // finished games when the hints were last re-armed
  };
};

export const loadTutorial = () => normalise(readJSON(KEY, {}));
const update = (fn) => { const next = fn(loadTutorial()); writeJSON(KEY, next); return next; };

export const markStoryDone = () => update((s) => ({ ...s, storyDone: true }));
export const markQuizDone = () => update((s) => ({ ...s, quizDone: true }));
export const markHintSeen = (id, turn = 0) => update((s) => ({ ...s, hintsSeen: { ...s.hintsSeen, [id]: turn } }));
/** 'הפעילו שוב את הרמזים': every hint may show again (the story flag is untouched). */
export const resetHints = () => update((s) => ({ ...s, hintsSeen: {}, helpOn: true, hintsFrom: gamesFinished() }));
export const setHelpOn = (on) => update((s) => ({ ...s, helpOn: !!on }));
/** A hint that was taken but never shown goes back to 'not seen yet'. */
export const unmarkHintSeen = (id) => update((s) => { const { [id]: _drop, ...rest } = s.hintsSeen; return { ...s, hintsSeen: rest }; });
/** Finished (won or lost) games on this device: the counter behind the ad cadence and the goal line. */
export const gamesFinished = () => Math.max(0, parseInt(readRaw('gamesPlayed') || '0', 10) || 0);
