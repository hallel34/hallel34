// Income statement bottom sheet. Family mode keeps it simple (no sell/repay/loan controls).
import { h } from './dom.js';
import { t, tp } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { icon } from './icons.js';
import { money, moneyText, tn } from './format.js';
import { button, meter } from './widgets.js';
import { animate } from './fx.js';
import { motionOK } from './prefs.js';
import { statement, maxLoan, PAYDAY_MONTHS } from '../engine/index.js';

export function openStatement({ getState, ops, title = t('statement.title') }) {
  let layer;
  const body = h('div', { class: 'statement-body', tabindex: '0', role: 'region', 'aria-label': title });

  const row = (label, value, tone = '', extra = null) =>
    h('div', { class: `st-row${tone ? ` st-${tone}` : ''}` }, h('span', { class: 'st-label' }, label), h('span', { class: 'st-value' }, value), extra);
  const section = (title, tone, ...rows) => h('section', { class: `st-section st-sec-${tone}` }, h('h3', { class: 'st-title' }, title), ...rows);

  function render() {
    const s = getState();
    const st = statement(s);
    const full = s.mode === 'full';
    const actionable = full && s.phase === 'roll' && s.status === 'playing';
    body.replaceChildren();

    const m = meter({ large: true });
    m.set(st.passiveIncome, st.totalExpenses, { animate: false });
    // Animate the meter fill on open.
    const track = m.el;
    body.append(h('div', { class: 'st-hero' },
      h('div', { class: 'st-hero-top' },
        h('div', null, h('span', { class: 'stat-label' }, t('statement.monthlyCashFlow')),
          h('div', { class: `st-flow ${st.monthlyCashFlow < 0 ? 'is-negative' : ''}` }, money(st.monthlyCashFlow, { sign: true }))),
        h('div', { class: 'st-cash' }, h('span', { class: 'stat-label' }, t('statement.cash')), money(st.cash))),
      track,
      h('div', { class: 'meter-labels' },
        h('span', null, t('game.passive'), ' ', h('b', { class: 'tone-income' }, money(st.passiveIncome))),
        h('span', null, t('game.expenses'), ' ', h('b', { class: 'tone-expense' }, money(st.totalExpenses)))),
      h('p', { class: 'st-goal st-payday' }, tn('statement.paydayLine', { months: PAYDAY_MONTHS, amount: money(st.monthlyCashFlow * PAYDAY_MONTHS, { sign: true }) })),
      h('p', { class: 'st-goal' }, t('statement.goalLine'))));

    body.append(section(t('statement.income'), 'income',
      row(t('statement.salary'), money(st.salary)),
      row(t('statement.passiveIncome'), money(st.passiveIncome, { sign: st.passiveIncome > 0 }), 'income'),
      row(t('statement.totalIncome'), money(st.totalIncome), 'total')));

    const expenseRows = st.expenseItems.map((e) => row(e.label, money(e.amount)));
    if (st.kids) expenseRows.push(row(t('statement.children', { n: st.kids }), money(st.childExpenses)));
    if (st.loanPayments) expenseRows.push(row(t('statement.loans'), money(st.loanPayments)));
    body.append(section(t('statement.expenses'), 'expense', ...expenseRows, row(t('statement.totalExpenses'), money(st.totalExpenses), 'total')));

    const assetRows = s.assets.length
      ? s.assets.map((a) => row(
        a.title,
        money(a.monthlyCashFlow, { sign: true }),
        'asset',
        h('span', { class: 'st-sub', 'data-asset': a.id },
          a.type === 'stock'
            ? t('statement.stockLine', { shares: tp('plural.shares', a.qty) })
            : `${t(`type.${a.type}`)}${a.mortgage > 0 ? ` · ${t('statement.assetMortgage', { amount: moneyText(a.mortgage) })}` : ''}`),
      ))
      : [h('p', { class: 'st-empty' }, t('statement.noAssets'))];
    body.append(section(t('statement.assets'), 'asset', ...assetRows));

    // Every liability in one list: starting debts, bank loans and the mortgage that came with each asset.
    const rep = st.liabilities;
    const liabRows = rep.items.length
      ? rep.items.map((l) => {
        const debt = s.liabilities.find((x) => x.id === l.id);
        const label = l.kind === 'mortgage' ? t(l.assetType === 'business' ? 'statement.businessLoanLabel' : 'statement.mortgageLabel', { asset: l.assetTitle }) : (l.label === 'loan' ? t('statement.loanLabel') : l.label);
        return h('div', { class: 'st-row st-liab', 'data-liab': l.id, 'data-kind': l.kind },
          h('span', { class: 'st-label' }, label),
          h('span', { class: 'st-value' }, tn('game.perMonth', { amount: money(l.monthlyPayment) })),
          h('span', { class: 'st-sub' }, `${t('statement.balance', { amount: moneyText(l.principal) })}${l.includedInAssets ? ` · ${t('statement.inAssetFlow')}` : ''}`),
          actionable && debt ? button(t('statement.repay'), { variant: 'secondary', size: 'sm', 'data-action': 'repay', onClick: async () => { await ops.repay(debt); render(); } }) : null);
      })
      : [h('p', { class: 'st-empty' }, t('statement.noLiabilities'))];
    if (rep.items.length) {
      liabRows.push(
        row(t('statement.totalLiabilities'), money(rep.totals.principal), 'total'),
        row(t('statement.totalPayments'), money(rep.totals.monthlyPayments), 'total'),
        row(t('statement.paidFromFlow'), money(rep.totals.paidFromCashFlow), 'sub'));
      if (rep.totals.includedInAssets > 0) {
        liabRows.push(row(t('statement.insideAssets'), money(rep.totals.includedInAssets), 'sub'), h('p', { class: 'st-empty' }, t('statement.liabilityNote')));
      }
    }
    body.append(section(t('statement.liabilities'), 'liability', ...liabRows));

    if (actionable) {
      const tools = h('div', { class: 'st-tools' });
      const atLimit = maxLoan(s) === 0;
      tools.append(button(atLimit ? t('statement.takeLoanLimit') : t('statement.takeLoan'), {
        variant: 'secondary', 'data-action': 'loan', disabled: atLimit,
        'aria-describedby': atLimit ? 'loan-limit-hint' : null,
        onClick: async () => { await ops.takeLoan(); render(); },
      }));
      if (atLimit) tools.append(h('p', { class: 'st-empty', id: 'loan-limit-hint' }, t('loan.limitHint')));
      if (s.assets.length) tools.append(button(t('sell.title'), { variant: 'secondary', 'data-action': 'sell', onClick: async () => { await ops.sell(); render(); } }));
      if (tools.children.length) body.append(tools);
    }
    if (full && !actionable && s.status === 'playing') body.append(h('p', { class: 'st-empty' }, t('statement.lockedNote')));

    if (motionOK()) {
      const fill = track.querySelector('.meter-fill');
      if (fill) animate(fill, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(var(--fill))' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    // Stagger the rows (30ms) with transforms only.
    if (motionOK()) {
      [...body.querySelectorAll('.st-row')].slice(0, 14).forEach((r, i) => animate(r, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 250, delay: 60 + i * 30, easing: 'cubic-bezier(.16,1,.3,1)' }));
    }
    // Re-rendering drops the focused button; keep keyboard focus inside the sheet.
    queueMicrotask(() => {
      const a = document.activeElement;
      if (layer && !layer.done && (!a || a === document.body || !a.isConnected)) layer.panel.focus({ preventScroll: true });
    });
  }
  render();

  const content = h('div', { class: 'sheet' },
    h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i', null)),
    h('div', { class: 'sheet-head' }, h('h2', { class: 'dialog-title' }, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), onClick: () => layer.close() }, icon('close', { size: 22 }))),
    body);
  layer = openLayer(content, { kind: 'sheet', label: title });
  layer.refresh = render;
  return layer;
}
