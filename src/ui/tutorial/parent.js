// 'למבוגר שמשחק עם ילד' (spec section 9): three sentences on how to play with a child and three questions to ask afterwards.
import { h } from '../dom.js';
import { openLayer, closeButton } from '../modal.js';
import { button } from '../widgets.js';
import { tut } from '../hint-ui.js';
import { t } from '../../i18n/index.js';
import { coinScale, inShekels, moneyText, COIN_SHEKELS } from '../format.js';

export function openParentCard() {
  const c = tut().parentCard;
  const ui = tut().ui;
  let layer;
  const content = h('div', { class: 'dialog parent-card', 'data-parent-card': '' },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, c.title), closeButton(() => layer.close())),
    // a junior game (coins): one line for the grown-up, so the coins are never a mystery
    coinScale() ? h('p', { class: 'parent-coins', 'data-parent-coins': '' }, t('coins.perCoin', { value: inShekels(() => moneyText(COIN_SHEKELS)) })) : null,
    h('ol', { class: 'parent-steps' }, c.howToExplain.map((s) => h('li', null, s))),
    h('div', { class: 'parent-qs' }, c.questions.map((q, i) => h('div', { class: 'parent-q' },
      h('p', { class: 'parent-question' }, q),
      h('p', { class: 'parent-answer' }, h('b', null, `${ui.parentCardAnswer}: `), c.answers[i])))),
    h('div', { class: 'dialog-actions' }, button(ui.close, { variant: 'primary', 'data-autofocus': '', onClick: () => layer.close() })));
  layer = openLayer(content, { kind: 'modal', label: c.title, cls: 'layer-dialog' });
  return layer.closed;
}
