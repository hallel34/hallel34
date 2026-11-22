// "Start a new game?" bottom sheet (PR21 review, task 1): shown only before a new normal game would erase a game in progress. Same sheet pattern as the
// home confirm; the SAFE choice (keep the saved game) is the focused one. Resolves true = erase and start, false = keep.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { button } from './widgets.js';
import { openLayer } from './modal.js';
import { haptic } from './fx.js';

const RLI = '\u2067'; const PDI = '\u2069';
/** The details are Hebrew text that contains a slash ("מהנדס/ת") and a dot separator: an RTL isolate keeps them in order inside the sentence. */
const isolate = (x) => `${RLI}${x}${PDI}`;

export function overwriteSaveSheet({ details }) {
  let layer;
  let decided = false; // a double tap on a button must not act twice
  const content = h('div', { class: 'sheet home-sheet overwrite-sheet', 'data-dialog': 'overwrite-save' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('menu.overwriteTitle')),
      h('p', { class: 'dialog-text' }, t('menu.overwriteText', { details: isolate(details) }))),
    h('div', { class: 'sheet-cta home-actions' },
      // the SAFE choice is the primary (gold, focused) one; erasing is the quiet secondary button. The scrim / Escape / Back button = keep.
      button(t('menu.overwriteKeep'), { variant: 'primary', size: 'lg', 'data-action': 'overwrite-keep', 'data-autofocus': '', onClick: () => { if (decided) return; decided = true; layer.close(false); } }),
      button(t('menu.overwriteConfirm'), { variant: 'secondary', 'data-action': 'overwrite-confirm', onClick: () => { if (decided) return; decided = true; haptic('tap'); layer.close(true); } })));
  layer = openLayer(content, { kind: 'sheet', label: t('menu.overwriteTitle'), dismissable: true, cls: 'layer-home' });
  return layer.closed.then((v) => v === true); // the scrim / Escape / Back button = keep
}
