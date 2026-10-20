// Developer/QA helpers, active only with ?debug=1 in the URL. Without the flag nothing is created.
import { h } from './dom.js';
import { t } from '../i18n/index.js';

export const debugEnabled = () => new URLSearchParams(globalThis.location?.search ?? '').get('debug') === '1';

/** Adds small force-win / force-lose buttons (and window.__passivoDebug) while a game is on screen. */
export function mountDebugTools({ forceWin, forceLose }) {
  const bar = h('aside', { class: 'debug-bar', 'aria-label': t('debug.label') },
    h('button', { type: 'button', class: 'debug-btn', 'data-action': 'debug-win', onClick: forceWin }, t('debug.win')),
    h('button', { type: 'button', class: 'debug-btn', 'data-action': 'debug-lose', onClick: forceLose }, t('debug.lose')));
  document.body.append(bar);
  window.__passivoDebug = { forceWin, forceLose };
  return { remove() { bar.remove(); delete window.__passivoDebug; } };
}
