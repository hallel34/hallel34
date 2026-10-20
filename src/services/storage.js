// localStorage wrapper that never throws (private mode, quota, disabled storage).
const PREFIX = 'etr.';

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
