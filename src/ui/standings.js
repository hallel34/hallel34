// Final standings list (hot-seat): each player's passive income, expenses, net worth and turns. Winner highlighted.
import { h } from './dom.js';
import { t, tp } from '../i18n/index.js';
import { icon } from './icons.js';
import { money, moneyIsolated, moneyText, numberText, coinScale } from './format.js';
import { playerToken, playerName, nameBdi } from './players.js';
import { standings } from '../engine/index.js';

const cell = (label, value) => h('div', { class: 'stand-cell' }, h('span', { class: 'stand-label' }, label), h('span', { class: 'stand-value' }, value));

export function standingsList(match) {
  const rows = standings(match);
  const list = h('ol', { class: 'standings', 'aria-label': t('standings.title') });
  for (const r of rows) {
    const name = playerName(match.players[r.index], r.index);
    list.append(h('li', {
      class: `stand-row${r.winner ? ' is-winner' : ''}${r.status === 'lost' ? ' is-out' : ''}`, 'data-player': String(r.index), 'data-place': String(r.place),
      'data-winner': String(r.winner),
    },
    h('div', { class: 'stand-head' },
      h('span', { class: 'stand-place' }, r.winner ? icon('star', { size: 18, width: 2.4 }) : numberText(r.place)),
      playerToken(r.color),
      h('strong', { class: 'stand-name' }, nameBdi(name)),
      r.status === 'lost' ? h('span', { class: 'stand-tag' }, t('standings.out')) : null,
      h('span', { class: 'stand-turns' }, tp('plural.turns', r.turns))),
    h('div', { class: 'stand-nums' },
      cell(t('standings.passive'), money(r.passive)),
      cell(t('standings.expenses'), money(r.expenses)),
      coinScale() ? null : cell(t('standings.netWorth'), money(r.netWorth))))); // 'צעירים': no net worth
    list.lastChild.setAttribute('aria-label', t(coinScale() ? 'standings.rowJunior' : 'standings.row', { name, place: r.place, passive: moneyIsolated(r.passive), expenses: moneyIsolated(r.expenses), net: moneyIsolated(r.netWorth), turns: tp('plural.turns', r.turns) }));
  }
  return list;
}
