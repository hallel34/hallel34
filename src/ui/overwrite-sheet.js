// "Start a new game?" bottom sheet (PR21 review, task 1): shown only before a new normal game would erase a game in progress. Same sheet pattern as the
// home confirm; the SAFE choice (keep the saved game) is the focused one. Resolves true = erase and start, false = keep.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { button, arm } from './widgets.js';
import { holdBack } from './history.js';
import { openLayer } from './modal.js';
import { haptic } from './fx.js';

const RLI = '\u2067'; const PDI = '\u2069';
/** The details are Hebrew text that contains a slash ("מהנדס/ת") and a dot separator: an RTL isolate keeps them in order inside the sentence. */
const isolate = (x) => `${RLI}${x}${PDI}`;

/** Taps are ignored this long after the sheet appears: a second tap aimed at the screen underneath (the profession's "go" button, 60-800 ms after the
 *  first) lands on whatever the sliding sheet put at that spot. Both buttons are really `disabled` (no click event at all), not just styled. */
export const OVERWRITE_ARM_MS = 900;

export function overwriteSaveSheet({ details }) {
  let layer;
  let decided = false; // a double tap on a button must not act twice
  const keepBtn = button(t('menu.overwriteKeep'), { variant: 'primary', size: 'lg', 'data-action': 'overwrite-keep', 'data-autofocus': '', onClick: () => { if (decided) return; decided = true; layer.close(false); } });
  const confirmBtn = button(t('menu.overwriteConfirm'), { variant: 'secondary', 'data-action': 'overwrite-confirm', onClick: () => { if (decided) return; decided = true; haptic('tap'); layer.close(true); } });
  const content = h('div', { class: 'sheet home-sheet overwrite-sheet', 'data-dialog': 'overwrite-save' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('menu.overwriteTitle')),
      h('p', { class: 'dialog-text' }, t('menu.overwriteText', { details: isolate(details) }))),
    h('div', { class: 'sheet-cta home-actions' },
      // The destructive button sits ABOVE; the safe, primary, focused one is at the bottom, exactly where the profession sheet's "go" button was, so a stray
      // second tap on that spot can only ever hit "keep".
      confirmBtn, keepBtn));
  layer = openLayer(content, { kind: 'sheet', label: t('menu.overwriteTitle'), dismissable: true, cls: 'layer-home' });
  const armer = arm([keepBtn, confirmBtn], OVERWRITE_ARM_MS, { focus: false });
  keepBtn.focus?.({ preventScroll: true }); // focus the safe choice at once (a disabled button cannot hold it, so re-focus when armed)
  armer.done.then((armed) => { if (armed) keepBtn.focus?.({ preventScroll: true }); });
  // the system Back button closes the sheet as KEEP (scoped to this sheet: released when it is gone)
  const release = holdBack('overwrite-save', () => { if (!decided) { decided = true; layer.close(false); } });
  layer.closed.then(() => { armer.cancel(); release(); });
  return layer.closed.then((v) => v === true); // the scrim / Escape / Back button = keep
}
