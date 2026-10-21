// L6: the collapsed 'בעולם האמיתי' row on a card (and in the loan window). Shows the fact's `game` and `real` texts as two
// labelled blocks and the fixed disclaimer. Real-world figures (numbers with publish:false) are never part of it.
import { h } from './dom.js';
import { icon } from './icons.js';
import { factForCard, factForPlace, realWorldView } from '../learn/rw.js';

let uid = 0;

/** The row for a fact, or null when there is none. */
export function realWorldRow(fact) {
  if (!fact) return null;
  const v = realWorldView(fact);
  const id = `rw-${(uid += 1)}`;
  const body = h('div', { class: 'rw-body', id, hidden: true },
    h('p', { class: 'rw-block', 'data-block': 'game' }, h('b', null, `${v.gameLabel}: `), v.game),
    h('p', { class: 'rw-block', 'data-block': 'real' }, h('b', null, `${v.realLabel}: `), v.real),
    v.figure ? h('p', { class: 'rw-block', 'data-block': 'figure' }, v.figure) : null,
    h('p', { class: 'rw-disclaimer' }, v.disclaimer));
  const toggle = h('button', {
    type: 'button', class: 'rw-toggle', 'aria-expanded': 'false', 'aria-controls': id, 'data-action': 'rw-toggle',
    onClick: () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
      toggle.querySelector('.rw-state').replaceChildren(icon(open ? 'minus' : 'plus', { size: 18, width: 3 }));
      if (open) body.scrollIntoView?.({ block: 'nearest' });
    },
  }, icon('book', { size: 20, width: 2.4 }), h('span', { class: 'rw-title' }, v.title),
  h('span', { class: 'rw-state', 'aria-hidden': 'true' }, icon('plus', { size: 18, width: 3 })));
  return h('div', { class: 'rw', 'data-rw': fact.id }, toggle, body);
}

export const realWorldForCard = (card) => (card?.realWorld ? realWorldRow(factForCard(card.id)) : null);
export const realWorldForPlace = (place) => realWorldRow(factForPlace(place));
