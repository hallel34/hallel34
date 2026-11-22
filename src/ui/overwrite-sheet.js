// "Start a new game?" bottom sheet (PR21 review, task 1): shown only before a new normal game would erase a game in progress. Same sheet pattern as the
// home confirm; the SAFE choice (keep the saved game) is the focused one. Resolves true = erase and start, false = keep.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { button } from './widgets.js';
import { openLayer } from './modal.js';
import { haptic } from './fx.js';

export function overwriteSaveSheet({ details }) {
  let layer;
  const content = h('div', { class: 'sheet home-sheet overwrite-sheet', 'data-dialog': 'overwrite-save' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('menu.overwriteTitle')),
      h('p', { class: 'dialog-text' }, t('menu.overwriteText', { details }))),
    h('div', { class: 'sheet-cta home-actions' },
      button(t('menu.overwriteConfirm'), { variant: 'primary', size: 'lg', 'data-action': 'overwrite-confirm', onClick: () => { haptic('tap'); layer.close(true); } }),
      button(t('menu.overwriteKeep'), { variant: 'secondary', 'data-action': 'overwrite-keep', 'data-autofocus': '', onClick: () => layer.close(false) })));
  layer = openLayer(content, { kind: 'sheet', label: t('menu.overwriteTitle'), dismissable: true, cls: 'layer-home' });
  return layer.closed.then((v) => v === true); // the scrim / Escape / Back button = keep
}
