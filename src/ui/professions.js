// Profession avatars (spec 3.3): one treatment for all eight professions, a line glyph in a neutral circle (no letters, no hue).
import { html } from './dom.js';
import { icon } from './icons.js';

const GLYPHS = import.meta.glob('../assets/profession/*.svg', { eager: true, query: '?raw', import: 'default' });

/** The profession's line glyph (stroke = currentColor), aria-hidden; the neutral person-less fallback is the 'statement' icon. */
export function professionGlyph(id) {
  const raw = GLYPHS[`../assets/profession/${id}.svg`];
  const el = raw ? html(raw) : icon('statement', { size: 24, width: 2 });
  el.removeAttribute('width'); el.removeAttribute('height');
  el.setAttribute('aria-hidden', 'true'); el.setAttribute('focusable', 'false');
  return el;
}
export const hasProfessionGlyph = (id) => !!GLYPHS[`../assets/profession/${id}.svg`];
