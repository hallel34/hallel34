// User preferences (sound, haptics, theme, motion), persisted in localStorage.
import { readJSON, writeJSON } from '../services/storage.js';

const DEFAULTS = { sound: true, haptics: true, theme: 'dark', reduceMotion: false, locale: 'he' };
let prefs = { ...DEFAULTS, ...(readJSON('prefs', {}) || {}) };
const listeners = new Set();
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

export const getPrefs = () => prefs;
export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  writeJSON('prefs', prefs);
  applyPrefs();
  listeners.forEach((fn) => fn(prefs));
}
export const onPrefs = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function systemReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/** True when animations (not just fades) are allowed. */
export const motionOK = () => !prefs.reduceMotion && !systemReducedMotion();

export function applyPrefs() {
  const root = document.documentElement;
  const theme = prefs.theme === 'auto' ? (mq?.matches ? 'light' : 'dark') : prefs.theme;
  root.dataset.theme = theme;
  if (prefs.reduceMotion) root.dataset.motion = 'reduced'; else delete root.dataset.motion;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#FBF3E1' : '#0F1E46');
}
mq?.addEventListener?.('change', () => { if (prefs.theme === 'auto') applyPrefs(); });
