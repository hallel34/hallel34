// Profession pick: 2-column grid, tap opens a bottom-sheet preview with a pinned primary CTA.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { money, tn } from '../format.js';
import { createTermScope } from '../rich.js';
import { button, iconButton } from '../widgets.js';
import { openLayer } from '../modal.js';
import { professionFox } from '../professions.js';
import { statement } from '../../engine/index.js';
import { haptic } from '../fx.js';
import { playerToken } from '../players.js';

export function createPick({ engine, mode, onBack, onGo, player = null, junior = false }) {
  // a junior game (owner 2026-10-26) starts from the profession on round rules: the pick shows THOSE numbers (in coins)
  const start = (id) => engine.newGame({ mode, professionId: id, seed: 1, ...(junior ? { junior: true } : {}) });
  const professions = engine.data.professions.map((p) => {
    if (!junior) return p;
    const s = start(p.id);
    return { ...p, salary: s.profession.salary, perChild: s.profession.perChild, expenses: s.profession.expenses, savings: s.cash, liabilities: s.liabilities };
  });
  // the grid and the preview sheet show the SAME numbers: one statement() per profession (loans included), computed once
  const figures = Object.fromEntries(professions.map((p) => [p.id, statement(start(p.id))]));

  function preview(p) {
    const scope = createTermScope();
    const st = figures[p.id];
    let layer;
    const row = (l, v, tone = '') => h('div', { class: `st-row${tone ? ` st-${tone}` : ''}` }, h('span', { class: 'st-label' }, l), h('span', { class: 'st-value' }, v));
    // Expenses are itemised behind a tertiary text toggle (no fox on the sheet: spec 4.2 / 5).
    const expenseRows = h('div', { class: 'st-rows', id: 'pick-expense-rows', hidden: true },
      ...p.expenses.map((e) => row(e.label, money(e.amount))),
      ...p.liabilities.map((l) => row(l.label, money(l.monthlyPayment))));
    const toggle = h('button', { type: 'button', class: 'st-toggle', 'aria-expanded': 'false', 'aria-controls': 'pick-expense-rows' },
      h('span', null, t('pick.showExpenses')), icon('plus', { size: 20, width: 3 }));
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.firstChild.textContent = open ? t('pick.hideExpenses') : t('pick.showExpenses');
      toggle.lastChild.replaceWith(icon(open ? 'minus' : 'plus', { size: 20, width: 3 }));
      expenseRows.hidden = !open;
    });
    const content = h('div', { class: 'sheet pick-sheet' },
      h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i')),
      h('div', { class: 'sheet-scroll', tabindex: '0', role: 'region', 'aria-label': t('pick.previewTitle', { profession: p.title }) },
        h('div', { class: 'pick-head' },
          h('span', { class: 'pick-fox', 'aria-hidden': 'true' }, professionFox(p.id, { width: 104, eager: true })),
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
    layer = openLayer(content, { kind: 'sheet', label: p.title });
  }

  // owner override 2026-10-24b (docs/v4/design/professions.md 2): art well with the profession fox on a hairline floor, the name,
  // salary and expenses on two lines, and the "נשאר בכיס" pill (the same statement() as the preview sheet)
  const cards = professions.map((p, i) => {
    // owner reference (design/character/professions-ref/owner-pick-screen-ref.jpg): the big fox at the top, the name, "שכר ₪X •",
    // "הוצאות ₪Y", and the full-width "נשאר בכיס ₪Z" pill. Every number comes from the live data (the same statement() as the sheet).
    const well = h('span', { class: 'prof-well', 'aria-hidden': 'true' });
    well.append(professionFox(p.id, { width: 108, fallbackHost: well, eager: i < 4 }));
    const flow = figures[p.id].monthlyCashFlow;
    const b = h('button', {
      type: 'button', class: 'prof-card', 'data-prof': p.id, vars: { '--i': i },
      onClick: () => { haptic('tap'); preview(p); },
    },
    well,
    h('span', { class: 'prof-name' }, p.title),
    h('span', { class: 'prof-rows' },
      h('span', { class: 'prof-row prof-row--salary prof-salary' }, h('span', { class: 'prof-row-label' }, t('pick.cardSalary')), money(p.salary), h('span', { class: 'prof-sep', 'aria-hidden': 'true' }, '•')),
      h('span', { class: 'prof-row prof-row--expenses' }, h('span', { class: 'prof-row-label' }, t('pick.cardExpenses')), money(figures[p.id].totalExpenses))),
    h('span', { class: `prof-pocket${flow < 0 ? ' is-neg' : ''}` }, tn('pick.cardLeftPocket', { amount: money(flow) })));
    return b;
  });

  return h('section', { class: 'screen screen-pick', 'data-screen': 'pick' },
    h('div', { class: 'pick-top' },
      player ? playerToken(player.color, { cls: 'ptoken-lg' }) : null,
      h('div', { class: 'pick-heading' },
        h('h1', { class: 'screen-title' }, player ? t('players.pickTitle', { name: player.name }) : t('pick.title')),
        h('p', { class: 'muted' }, player ? t('players.pickStep', { n: player.n, total: player.total }) : t('pick.subtitleFox'))),
      // the back button at the inline-end (left in RTL), a 48px round ghost centred with the title
      iconButton('arrow', t('pick.back'), onBack, 'icon-btn-glass pick-back')),
    h('div', { class: 'prof-grid' }, cards));
}
