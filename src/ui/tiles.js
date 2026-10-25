// v4 board tiles (docs/v4/design/board-spec.md sections 1, 3 and 4): ONE table maps a square type to its monoline glyph, its
// Hebrew label and its colour family. Colour means money direction (gain / loss / info), the glyph means the type; the CSS turns
// `data-family` into --t-bg / --t-edge / --t-ink (family mode swaps loss to deep amber in tokens.css), so a type never names a colour.
// Adding a square type (tax-audit, a later stage) = one row here + its i18n keys.
import { h, html } from './dom.js';
import { t } from '../i18n/index.js';

const RAW = import.meta.glob('../assets/tile/*.svg', { eager: true, query: '?raw', import: 'default' });
// Owner override 2026-10-24: the BOARD squares are the glossy 3D raster tiles (src/assets/tile3d/<name>.webp + <name>@2x.webp).
// The monoline glyphs stay for the legend, the chips, the landing caption and "you are here". A missing file falls back to the
// monoline tile, so the board never breaks while the art is being cut.
const TILE3D = import.meta.glob('../assets/tile3d/*.webp', { eager: true, query: '?url', import: 'default' });

/**
 * type (BOARD id) -> { icon (file in src/assets/tile), family, label (i18n key), legend (i18n key of the one-line explanation),
 * onBoard (false = registered for a later stage: never drawn and hidden in the legend) }.
 */
export const TILE_META = {
  payday: { icon: 'payday', family: 'gain', label: 'square.payday', legend: 'legend.payday', onBoard: true },
  opportunity: { icon: 'opportunity', family: 'gain', label: 'square.opportunity', legend: 'legend.opportunity', onBoard: true },
  expense: { icon: 'expense', family: 'loss', label: 'square.expense', legend: 'legend.expense', onBoard: true },
  market: { icon: 'market', family: 'info', label: 'square.market', legend: 'legend.market', onBoard: true },
  baby: { icon: 'baby', family: 'info', label: 'square.baby', legend: 'legend.baby', onBoard: true },
  charity: { icon: 'charity', family: 'info', label: 'square.charity', legend: 'legend.charity', onBoard: true },
  taxAudit: { icon: 'tax-audit', family: 'info', label: 'square.taxAudit', legend: 'legend.taxAudit', onBoard: true }, // v4 stage 4: on the board (square 12)
};

// the BOARD id of the later stage may be spelled like its file; both names reach the same row
Object.defineProperty(TILE_META, 'tax-audit', { value: TILE_META.taxAudit, enumerable: false });

/** The three families in legend order, each with its group header key. */
export const FAMILIES = [
  { id: 'gain', header: 'legend.gain' },
  { id: 'loss', header: 'legend.loss' },
  { id: 'info', header: 'legend.info' },
];

const meta = (type) => TILE_META[type] ?? TILE_META.opportunity;
export const tileFamily = (type) => meta(type).family;
export const tileLabel = (type) => t(meta(type).label);

/** The inner markup of a glyph file (everything between the <svg> tags). */
function inner(name) {
  const src = RAW[`../assets/tile/${name}.svg`] ?? '';
  return src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

/** The <symbol> sprite (7 paths for the whole board), injected once into the document so `<use>` keeps currentColor. */
export function ensureTileSprite(doc = globalThis.document) {
  if (!doc || doc.getElementById('tile-sprite')) return;
  const symbols = Object.values(TILE_META).map((m) => `<symbol id="tile-${m.icon}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner(m.icon)}</symbol>`).join('');
  const sprite = html(`<svg id="tile-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;inline-size:0;block-size:0;overflow:hidden">${symbols}</svg>`);
  doc.body.prepend(sprite);
}

/** The tile glyph as an inline <svg><use/></svg> (decorative: the label always sits next to it or in the aria text). */
export function tileIcon(type, { size = 24, cls = '' } = {}) {
  ensureTileSprite();
  return html(`<svg class="tile-icon${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false" width="${size}" height="${size}" viewBox="0 0 24 24"><use href="#tile-${meta(type).icon}"/></svg>`);
}

/** The 3D art name of a type per mode: family mode never shows red, so its expense tile is the amber 'expense-family'. */
export const tile3dName = (type, mode = 'full') => {
  const icon = meta(type).icon;
  return icon === 'expense' && mode === 'family' ? 'expense-family' : icon;
};
/** { src, srcset } of the 3D tile, or null while the file does not exist (then the monoline tile is drawn). */
export function tile3dUrls(type, mode = 'full') {
  const name = tile3dName(type, mode);
  const x1 = TILE3D[`../assets/tile3d/${name}.webp`] ?? TILE3D[`../assets/tile3d/${name}@1x.webp`];
  if (!x1) return null;
  const x2 = TILE3D[`../assets/tile3d/${name}@2x.webp`];
  return { src: x1, srcset: x2 ? `${x1} 1x, ${x2} 2x` : null };
}
/** spec 13.1: preload only these two @2x files (14 of the 24 squares); the other five come with the board. */
export const TILE3D_PRELOAD = ['opportunity', 'payday'];
export function tile3dPreloads() {
  return TILE3D_PRELOAD.map((name) => TILE3D[`../assets/tile3d/${name}@2x.webp`]).filter((u) => u && !u.startsWith('data:'));
}

/**
 * Preloads them once the first screen has painted (idle time, <link rel="preload" as="image">), so the board (the main screen)
 * draws its squares from the cache without taking bandwidth from the home screen's LCP image.
 */
export function preloadTiles(doc = globalThis.document) {
  if (!doc) return;
  const run = () => {
    for (const href of tile3dPreloads()) {
      if (doc.head.querySelector(`link[data-tile3d="${href}"]`)) continue;
      const l = doc.createElement('link');
      l.rel = 'preload'; l.as = 'image'; l.href = href; l.dataset.tile3d = href;
      doc.head.append(l);
    }
  };
  if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 2500 }); else setTimeout(run, 1200);
}

/** A board square: the 3D raster tile when its art exists (alt '' : the board's aria-label names the square), else the monoline tile. */
export function boardTile(type, { mode = 'full', cls = '', attrs = {} } = {}) {
  const u = tile3dUrls(type, mode);
  if (!u) return tileFace(type, { size: 24, cls, attrs });
  return h('div', { class: `tile has-3d${cls ? ` ${cls}` : ''}`, 'data-family': tileFamily(type), 'data-type': type, ...attrs },
    h('img', { class: 'tile-3d', src: u.src, srcset: u.srcset, alt: '', width: 60, height: 72, decoding: 'async', draggable: 'false' }));
}

/** A board tile render (also used at 40px in the legend): smoked fill, 1px family edge, coloured glyph. */
export function tileFace(type, { size = 24, cls = '', attrs = {} } = {}) {
  return h('div', { class: `tile${cls ? ` ${cls}` : ''}`, 'data-family': tileFamily(type), 'data-type': type, ...attrs }, tileIcon(type, { size }));
}

/** Icon + full label pill in the family colours (landing caption, "you are here", the card header chip). */
export function tileLabelChip(type, { size = 24, cls = '', text = null } = {}) {
  return h('span', { class: `tile-label${cls ? ` ${cls}` : ''}`, 'data-family': tileFamily(type), 'data-type': type },
    tileIcon(type, { size }), h('span', { class: 'tile-label-text' }, text ?? tileLabel(type)));
}
