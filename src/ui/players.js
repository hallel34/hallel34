// Shared player helpers (hot-seat): default names and the numbered colour token.
import { h } from './dom.js';
import { t } from '../i18n/index.js';

/** Display name: the typed name, or "שחקן n". */
export const playerName = (player, index) => (player?.name || t('players.defaultName', { n: index + 1 }));

/** A name that keeps its own direction inside RTL text (a Latin name truncates and orders correctly). */
export const nameBdi = (name) => h('bdi', { dir: 'auto' }, name);

/** Interpolates a string with a {name} placeholder into nodes, the name isolated in a <bdi dir=auto>. */
export function withName(text, name) {
  const [a, b = ''] = text.split('{name}');
  return [a, nameBdi(name), b];
}

/** Round numbered badge in the player's colour (number + colour, so colour is never the only cue). */
export function playerToken(color, { label = '', cls = '' } = {}) {
  return h('span', { class: `ptoken pc-${color}${cls ? ` ${cls}` : ''}`, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true' }, String(color));
}
