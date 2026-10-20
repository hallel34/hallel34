// localStorage wrapper that never throws (private mode, quota, disabled storage).
const PREFIX = 'passivo.';
const LEGACY_PREFIX = 'etr.';

/** One-time migration: move saves/prefs from the pre-rebrand key prefix. Never overwrites new keys. */
export function migrateLegacyKeys() {
  try {
    const old = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_PREFIX)) old.push(k);
    }
    for (const k of old) {
      const nk = PREFIX + k.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
migrateLegacyKeys();

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
export function readRaw(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}
export function writeRaw(key, value) {
  try { localStorage.setItem(PREFIX + key, value); return true; } catch { return false; }
}
export function writeJSON(key, value) { return writeRaw(key, JSON.stringify(value)); }
export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}
