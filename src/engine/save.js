// Save/load: JSON with schemaVersion and migrations. Storage itself is the UI's job.
// Schema 2 saves a whole match (1-4 players). Schema 1 saves were one bare game state: they load as a one-player match.
import { SCHEMA_VERSION } from './config.js';
import { matchFromState } from './match.js';

const migrations = {
  1: (s) => matchFromState(s),
};

export function serialize(match) {
  return JSON.stringify({ ...match, schemaVersion: SCHEMA_VERSION });
}

/** Returns a match, or null for corrupt / too-new / unknown saves. */
export function deserialize(json) {
  let s;
  try { s = JSON.parse(json); } catch { return null; }
  if (!s || typeof s !== 'object' || typeof s.schemaVersion !== 'number') return null;
  if (s.schemaVersion > SCHEMA_VERSION) return null;
  while (s.schemaVersion < SCHEMA_VERSION) {
    const m = migrations[s.schemaVersion];
    if (!m) return null;
    s = m(s);
  }
  if (!Array.isArray(s.players) || !s.players.length || s.players.some((p) => !p?.state?.profession)) return null;
  return s;
}
