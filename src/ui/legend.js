// "מה יש על הלוח?" (docs/v4/design/board-spec.md 3.4): the legend sheet behind the 48px "?" in the plaza. Three groups named in text
// (a family dot + a word), each row a real tile render (40px) + the full label + one line. Rows come from TILE_META, so a new
// square type appears here with its i18n keys only; a type that is not on the board yet (tax-audit) stays hidden.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { icon } from './icons.js';
import { openLayer } from './modal.js';
import { TILE_META, FAMILIES, tileFace } from './tiles.js';

/** The legend rows per family (pure: types in TILE_META order; `all` also lists the types that are not on the board yet). */
export function legendGroups({ all = false } = {}) {
  return FAMILIES.map((f) => ({
    ...f,
    types: Object.entries(TILE_META).filter(([, m]) => m.family === f.id && (all || m.onBoard)).map(([type]) => type),
  })).filter((g) => g.types.length);
}

/** Opens the sheet. Focus goes to the title; on close it returns to the opener (openLayer restores the previous focus). */
export function openLegend() {
  let layer;
  const titleId = 'legend-title';
  const title = h('h2', { class: 'sheet-title legend-title', id: titleId, tabindex: '-1' }, t('legend.title'));
  const groups = legendGroups().map((g) => h('section', { class: 'legend-group', 'data-family': g.id, 'aria-labelledby': `legend-${g.id}` },
    h('h3', { class: 'legend-head', id: `legend-${g.id}` }, h('i', { class: 'legend-dot', 'data-family': g.id, 'aria-hidden': 'true' }), t(g.header)),
    h('ul', { class: 'legend-list' }, g.types.map((type) => h('li', { class: 'legend-row', 'data-type': type },
      tileFace(type, { size: 24, cls: 'legend-tile', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'legend-text' },
        h('strong', { class: 'legend-label' }, t(TILE_META[type].label)),
        h('span', { class: 'legend-line' }, t(TILE_META[type].legend))))))));
  const close = h('button', { type: 'button', class: 'icon-btn legend-close', 'aria-label': t('legend.close'), 'data-action': 'legend-close', onClick: () => layer.close() }, icon('close', { size: 22 }));
  const content = h('div', { class: 'sheet legend-sheet', 'data-sheet': 'legend', 'aria-labelledby': titleId },
    h('div', { class: 'sheet-head legend-sheet-head' }, title, close),
    h('div', { class: 'sheet-scroll legend-scroll' }, groups));
  layer = openLayer(content, { kind: 'sheet', label: t('legend.title'), cls: 'layer-legend' });
  queueMicrotask(() => queueMicrotask(() => title.focus({ preventScroll: true })));
  return layer;
}
