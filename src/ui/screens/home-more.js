// The home 'עוד' menu (redesign phase A, owner decision 2026-11-16): one sheet that keeps every destination the old top row had.
//   - המילון של מקסי (openDictionary), always
//   - טבלת המשפחה של השבוע (goBoard), only where the app passes onBoard (same condition as the old icon)
//   - the finished-games count (passivo.gamesPlayed: wins and game-overs of normal AND challenge games; daily games are not counted; a mission continued in free play that ends is counted too). Information only: there is NO per-game history screen, so the row is not a button.
//     A new player (0) reads a truthful empty line instead of a number.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { openLayer } from '../modal.js';
import { haptic } from '../fx.js';

/** 'סיימתם משחק אחד' / 'סיימתם N משחקים' (a separate key for the single case). */
export const gamesText = (n) => (n === 1 ? t('menu.gamesFinishedOne') : t('menu.gamesFinished', { n }));

/** The label the 'עוד' button announces: names every destination it holds (and the count when there is one). */
export function moreAriaLabel({ hasBoard, gamesPlayed }) {
  const base = hasBoard ? t('menu.moreAria') : t('menu.moreAriaNoBoard');
  return gamesPlayed > 0 ? `${base}. ${gamesText(gamesPlayed)}` : base;
}

/**
 * @param gamesPlayed finished games on this device (the raw passivo.gamesPlayed counter; see the header for what it counts)
 * @param onDictionary / onBoard  the existing destinations (onBoard null = not offered)
 * @returns the layer (its `closed` promise resolves when the sheet is gone)
 */
export function openHomeMore({ gamesPlayed = 0, onDictionary, onBoard = null }) {
  let layer;
  // the destination opens after the sheet has left: two layers never overlap and focus is restored once
  const go = (fn) => () => { haptic('tap'); layer.close(); layer.closed.then(() => fn()); };
  const row = (iconName, label, action, onClick) => h('button', { type: 'button', class: 'more-row', 'data-action': action, onClick: go(onClick) },
    h('span', { class: 'more-ico', 'aria-hidden': 'true' }, icon(iconName, { size: 22, width: 2.2 })),
    h('span', { class: 'more-label' }, label),
    icon('arrow', { size: 20, width: 3, fwd: true, cls: 'more-go' }));
  const done = gamesPlayed > 0;
  const info = h('li', { class: `more-info${done ? ' has-count' : ''}`, 'data-more': 'games' },
    h('span', { class: 'more-ico', 'aria-hidden': 'true' }, icon('check', { size: 22, width: 2.4 })),
    h('span', { class: 'more-label' }, done ? gamesText(gamesPlayed) : t('menu.gamesFinishedNone')));
  const content = h('div', { class: 'sheet more-sheet' },
    h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i')),
    h('h2', { class: 'more-title' }, t('menu.moreMenuTitle')),
    h('ul', { class: 'more-list' },
      h('li', null, row('book', t('settings.dictionary'), 'dictionary', onDictionary)),
      onBoard ? h('li', null, row('familyBoard', t('challenge.board.title'), 'family-board', onBoard)) : null,
      info));
  layer = openLayer(content, { kind: 'sheet', label: t('menu.moreMenuTitle') });
  return layer;
}
