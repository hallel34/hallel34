// Save/load: JSON with schemaVersion and migrations. Storage itself is the UI's job.
import { SCHEMA_VERSION } from './config.js';

const migrations = {
  // 1: (s) => s  -> example: migrations[n] upgrades from version n to n+1
};

export function serialize(state) {
  return JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION });
}

export function deserialize(json) {
  let s;
  try { s = JSON.parse(json); } catch { return null; }
  if (!s || typeof s !== 'object' || typeof s.schemaVersion !== 'number') return null;
  if (s.schemaVersion > SCHEMA_VERSION) return null;
  while (s.schemaVersion < SCHEMA_VERSION) {
    const m = migrations[s.schemaVersion];
    if (!m) return null;
    s = m(s);
    s.schemaVersion += 1;
  }
  return s;
}
