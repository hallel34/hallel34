// Shared player helpers (hot-seat): default names and the numbered colour token.
import { h } from './dom.js';
import { t } from '../i18n/index.js';

/** Display name: the typed name, or "שחקן n". */
export const playerName = (player, index) => (player?.name || t('players.defaultName', { n: index + 1 }));

/** Round numbered badge in the player's colour (number + colour, so colour is never the only cue). */
export function playerToken(color, { label = '', cls = '' } = {}) {
  return h('span', { class: `ptoken pc-${color}${cls ? ` ${cls}` : ''}`, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true' }, String(color));
}
