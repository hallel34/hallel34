// Profession pick: 2-column grid, tap opens a bottom-sheet preview with a pinned primary CTA.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { money, tn } from '../format.js';
import { button, iconButton } from '../widgets.js';
import { openLayer } from '../modal.js';
import { avatarColor } from '../layout.js';
import { statement } from '../../engine/index.js';
import { haptic, pulse } from '../fx.js';

export function createPick({ engine, mode, onBack, onGo }) {
  const professions = engine.data.professions;
  const ids = professions.map((p) => p.id);

  function preview(p) {
    const s = engine.newGame({ mode, professionId: p.id, seed: 1 });
    const st = statement(s);
    let layer;
    const row = (l, v, tone = '') => h('div', { class: `st-row${tone ? ` st-${tone}` : ''}` }, h('span', { class: 'st-label' }, l), h('span', { class: 'st-value' }, v));
    const content = h('div', { class: 'sheet pick-sheet' },
      h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i')),
      h('div', { class: 'sheet-scroll' },
        h('div', { class: 'pick-head' },
          h('div', { class: 'avatar avatar-lg', style: `background:${avatarColor(p.id, ids)}`, 'aria-hidden': 'true' }, p.title.trim()[0]),
          h('div', null, h('h2', { class: 'dialog-title' }, p.title), h('p', { class: 'muted' }, tn('pick.perMonth', { amount: money(p.salary) })))),
        h('section', { class: 'st-section st-sec-income' },
          row(t('pick.salary'), money(p.salary), 'income'),
          row(t('pick.savings'), money(p.savings))),
        h('section', { class: 'st-section st-sec-expense' },
          h('h3', { class: 'st-title' }, t('pick.expenses')),
          ...p.expenses.map((e) => row(e.label, money(e.amount))),
          row(t('statement.totalExpenses'), money(st.totalExpenses), 'total')),
        p.liabilities.length ? h('section', { class: 'st-section st-sec-liability' },
          h('h3', { class: 'st-title' }, t('pick.liabilities')),
          ...p.liabilities.map((l) => row(l.label, money(l.principal)))) : null,
        row(t('pick.cashflow'), money(st.monthlyCashFlow, { sign: true }), 'total'),
        h('div', { class: 'banner banner-info' }, icon('star', { size: 24 }), h('span', null, t('pick.goal')))),
      h('div', { class: 'sheet-cta' }, button(t('pick.go'), { variant: 'primary', size: 'lg', 'data-action': 'go', 'data-autofocus': '', onClick: () => { layer.close(); onGo(p.id); } })));
    layer = openLayer(content, { kind: 'sheet', label: p.title });
  }

  const cards = professions.map((p, i) => {
    const b = h('button', {
      type: 'button', class: 'prof-card', 'data-prof': p.id, vars: { '--i': i },
      onClick: () => { haptic('tap'); pulse(b, 1.06); preview(p); },
    },
    h('span', { class: 'avatar avatar-lg', style: `background:${avatarColor(p.id, ids)}`, 'aria-hidden': 'true' }, p.title.trim()[0]),
    h('span', { class: 'prof-name' }, p.title),
    h('span', { class: 'prof-salary' }, money(p.salary)));
    return b;
  });

  return h('section', { class: 'screen screen-pick', 'data-screen': 'pick' },
    h('div', { class: 'pick-top' },
      iconButton('arrow', t('pick.back'), onBack, 'icon-btn-glass'),
      h('div', null, h('h1', { class: 'screen-title' }, t('pick.title')), h('p', { class: 'muted' }, t('pick.subtitle')))),
    h('div', { class: 'prof-grid' }, cards));
}
