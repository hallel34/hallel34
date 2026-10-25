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

// Profession foxes (owner override 2026-10-24b, docs/v4/design/professions.md): the waving fox in its work outfit on the
// profession cards and the preview sheet, its bust in the HUD avatar. The monoline glyph stays as the fallback while a WebP
// is missing or fails to load (same pattern as the 3D board tiles).
const FOX = import.meta.glob('../assets/profession-fox/*.webp', { eager: true, query: '?url', import: 'default' });
const foxUrl = (name) => FOX[`../assets/profession-fox/${name}.webp`] || null;
export const hasProfessionFox = (id) => !!(foxUrl(id) && foxUrl(`${id}@2x`) && foxUrl(`${id}-head`) && foxUrl(`${id}-head@2x`));

/** An <img> that swaps itself for the glyph (in `fallbackHost`, or its parent) when it fails. */
function withFallback(img, id, fallbackHost) {
  img.addEventListener('error', () => {
    const host = fallbackHost || img.parentElement;
    if (!host) return;
    host.classList.add('is-glyph');
    host.replaceChildren(professionGlyph(id));
  }, { once: true });
  return img;
}

/** Card art: 104 x 120 CSS, w-descriptor srcset (the @2x is 1.53x, the source resolution). Decorative: the name is the text. */
export function professionFox(id, { width = 104, fallbackHost = null, eager = false } = {}) {
  if (!hasProfessionFox(id)) return professionGlyph(id);
  const img = document.createElement('img');
  img.className = 'prof-fox';
  img.src = foxUrl(id);
  img.srcset = `${foxUrl(id)} 104w, ${foxUrl(`${id}@2x`)} 159w`;
  img.sizes = `${width}px`;
  img.width = width; img.height = Math.round((width * 120) / 104);
  img.alt = ''; img.decoding = 'async'; img.draggable = false;
  if (!eager) img.loading = 'lazy';
  img.setAttribute('aria-hidden', 'true');
  return withFallback(img, id, fallbackHost);
}

/** HUD avatar: the 44px bust (1x / 2x). */
export function professionBust(id, { fallbackHost = null } = {}) {
  if (!hasProfessionFox(id)) return professionGlyph(id);
  const img = document.createElement('img');
  img.className = 'prof-bust';
  img.src = foxUrl(`${id}-head`);
  img.srcset = `${foxUrl(`${id}-head`)} 1x, ${foxUrl(`${id}-head@2x`)} 2x`;
  img.width = 44; img.height = 44; img.alt = ''; img.decoding = 'async'; img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  return withFallback(img, id, fallbackHost);
}
