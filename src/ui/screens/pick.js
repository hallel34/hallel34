// Profession pick: 2-column grid, tap opens a bottom-sheet preview with a pinned primary CTA.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { money, tn } from '../format.js';
import { createTermScope } from '../rich.js';
import { button, iconButton } from '../widgets.js';
import { openLayer } from '../modal.js';
import { avatarColor } from '../layout.js';
import { statement } from '../../engine/index.js';
import { haptic, pulse, animate } from '../fx.js';
import { foxImg } from '../fox.js';
import { motionOK } from '../prefs.js';
import { playerToken } from '../players.js';

export function createPick({ engine, mode, onBack, onGo, player = null }) {
  const professions = engine.data.professions;
  const ids = professions.map((p) => p.id);

  function preview(p) {
    const scope = createTermScope();
    const s = engine.newGame({ mode, professionId: p.id, seed: 1 });
    const st = statement(s);
    let layer;
    const row = (l, v, tone = '') => h('div', { class: `st-row${tone ? ` st-${tone}` : ''}` }, h('span', { class: 'st-label' }, l), h('span', { class: 'st-value' }, v));
    // Expenses are itemised behind a toggle; the fox ponders, and swaps to "think" when the list is opened.
    const expenseRows = h('div', { class: 'st-rows', id: 'pick-expense-rows', hidden: true },
      ...p.expenses.map((e) => row(e.label, money(e.amount))));
    const foxPop = h('div', { class: 'fox-pop fox-sheet', 'aria-hidden': 'true' }, foxImg('ponder', { size: 56 }));
    foxPop.style.setProperty('--pop', '56px');
    const toggle = h('button', { type: 'button', class: 'st-toggle', 'aria-expanded': 'false', 'aria-controls': 'pick-expense-rows' },
      h('span', null, t('pick.showExpenses')), icon('plus', { size: 20, width: 3 }));
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.firstChild.textContent = open ? t('pick.hideExpenses') : t('pick.showExpenses');
      toggle.lastChild.replaceWith(icon(open ? 'minus' : 'plus', { size: 20, width: 3 }));
      expenseRows.hidden = !open;
      foxPop.replaceChildren(foxImg(open ? 'think' : 'ponder', { size: 56 }));
      if (motionOK()) animate(foxPop, [{ transform: 'scale(.85)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    });
    const content = h('div', { class: 'sheet pick-sheet' },
      foxPop,
      h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i')),
      h('div', { class: 'sheet-scroll', tabindex: '0', role: 'region', 'aria-label': t('pick.previewTitle', { profession: p.title }) },
        h('div', { class: 'pick-head' },
          h('div', { class: 'avatar avatar-lg', style: `background:${avatarColor(p.id, ids)}`, 'aria-hidden': 'true' }, p.title.trim()[0]),
          h('div', null, h('h2', { class: 'dialog-title' }, p.title), h('p', { class: 'muted' }, tn('pick.perMonth', { amount: money(p.salary) })))),
        h('section', { class: 'st-section st-sec-income' },
          row(t('pick.salary'), money(p.salary), 'income'),
          row(t('pick.savings'), money(p.savings))),
        h('section', { class: 'st-section st-sec-expense' },
          h('h3', { class: 'st-title' }, t('pick.expenses')),
          toggle, expenseRows,
          row(t('statement.totalExpenses'), money(st.totalExpenses), 'total')),
        p.liabilities.length ? h('section', { class: 'st-section st-sec-liability' },
          h('h3', { class: 'st-title' }, tn('pick.liabilities', {}, { scope })),
          ...p.liabilities.map((l) => row(l.label, money(l.principal)))) : null,
        row(tn('pick.cashflow', {}, { scope }), money(st.monthlyCashFlow, { sign: true }), 'total'),
        h('div', { class: 'banner banner-info' }, icon('star', { size: 24 }), h('span', null, tn('pick.goal', {}, { scope })))),
      h('div', { class: 'sheet-cta' }, button(t('pick.go'), { variant: 'primary', size: 'lg', 'data-action': 'go', 'data-autofocus': '', onClick: () => { layer.close(); onGo(p.id); } })));
    // Pop-in when the sheet opens (the sheet itself slides up over --dur-base).
    animate(foxPop, motionOK() ? [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: motionOK() ? 200 : 0, easing: 'cubic-bezier(.34,1.56,.64,1)' });
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
      player ? playerToken(player.color, { cls: 'ptoken-lg' }) : null,
      h('div', { class: 'pick-heading' },
        h('h1', { class: 'screen-title' }, player ? t('players.pickTitle', { name: player.name }) : t('pick.title')),
        h('p', { class: 'muted' }, player ? t('players.pickStep', { n: player.n, total: player.total }) : t('pick.subtitle')))),
    h('div', { class: 'prof-grid' }, cards));
}
