// The device side of the career: `passivo.career` (schema-versioned; corrupt or unknown data starts over, never crashes).
// Same shape as src/daily/store.js: thin reads and writes around the pure logic of career.js.
import { readJSON, writeJSON } from '../services/storage.js';
import { parseCareer, activeProfile, withProfile, createProfile, setActive, removeProfile, syncSeniority, setAge, editProfile } from './career.js';

export const CAREER_KEY = 'career';

export const loadCareer = (read = readJSON) => parseCareer(read(CAREER_KEY));
export const saveCareer = (career, write = writeJSON) => write(CAREER_KEY, career);

/** Settles seniority for the active profile on `today` and stores it. Returns { career, profile, events } (events: reset / drop, shown once). */
export function syncActive(today, { read = readJSON, write = writeJSON } = {}) {
  const career = loadCareer(read);
  const p = activeProfile(career);
  if (!p) return { career, profile: null, events: [] };
  const { profile, events } = syncSeniority(p, today);
  const next = withProfile(career, profile);
  if (events.length || profile !== p) saveCareer(next, write);
  return { career: next, profile, events };
}

/** Creates a profile (the age band is required) and stores it. */
export function addProfile(fields, today, { read = readJSON, write = writeJSON } = {}) {
  const out = createProfile(loadCareer(read), fields, today);
  if (out.profile) saveCareer(out.career, write);
  return out;
}

/** Stores the career after `change(career)`. Returns what change returned. */
export function updateCareer(change, { read = readJSON, write = writeJSON } = {}) {
  const career = loadCareer(read);
  const next = change(career);
  saveCareer(next, write);
  return next;
}

export { activeProfile, setActive, removeProfile, setAge, editProfile, withProfile };
