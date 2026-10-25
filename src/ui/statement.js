// Income statement bottom sheet. Family mode keeps it simple (no sell/repay/loan controls).
import { h } from './dom.js';
import { t, tp } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { icon } from './icons.js';
import { money, tn, numberText, paydayCalc } from './format.js';
import { categoryChip } from './categories.js';
import { button, meter } from './widgets.js';
import { createTermScope } from './rich.js';
import { animate } from './fx.js';
import { motionOK } from './prefs.js';
import { assetTitle } from './card-view.js';
import { statement, maxLoan, PAYDAY_MONTHS, LOAN_PAYMENT_RATE } from '../engine/index.js';
import { learnContent } from '../learn/content.js';
import { asOfLine } from './tax-audit.js';
import { stackedEquation } from './payday.js';

const textOf = (x) => (typeof x === 'string' ? x : [x].flat().map((n) => (typeof n === 'string' ? n : n?.textContent ?? '')).join(''));

/**
 * v4 stage 4: the 'מסים וביטוח לאומי' row (full mode) is a disclosure button that opens the statement popover of guide.he.json:
 * the 2026 income-tax brackets and national-insurance rates, the pension rule, this profession's real figure next to the game
 * line, the "נכון ל-2026" tag and the source link. `open` survives a re-render of the sheet.
 */
let taxOpen = false;
function taxRow(e, s) {
  const pop = learnContent().guide?.statementPopover;
  if (!pop) return null;
  const fillT = (tpl, slots) => tpl.split(/(\{\w+\})/).filter(Boolean).map((part) => { const m = part.match(/^\{(\w+)\}$/); return m && m[1] in slots ? slots[m[1]] : part; });
  const prof = pop.profession?.rows?.[s.profession.id];
  const table = (rows) => h('table', null, h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r.label), h('td', null, h('bdi', { dir: 'ltr' }, r.value))))));
  const panel = h('div', { class: 'st-tax-pop', id: 'st-tax-pop', role: 'region', 'aria-label': pop.title, hidden: !taxOpen },
    h('p', null, pop.short),
    h('h4', null, pop.incomeTax.title), h('p', null, pop.incomeTax.short), table(pop.incomeTax.rows), pop.incomeTax.rowsNote ? h('p', null, pop.incomeTax.rowsNote) : null,
    h('h4', null, pop.nationalInsurance.title), h('p', null, pop.nationalInsurance.short), table(pop.nationalInsurance.rows), pop.nationalInsurance.rowsNote ? h('p', null, pop.nationalInsurance.rowsNote) : null,
    pop.pension ? [h('h4', null, pop.pension.title), h('p', null, pop.pension.short)] : null,
    // the profession line only while the guide's figures still match the live salary (the game line is always read live)
    prof && prof.gross === s.profession.salary ? [
      h('p', null, fillT(pop.profession.template, { title: s.profession.title, gross: money(prof.gross), gameLine: money(e.amount), real: money(prof.realTaxPlusNi) })),
      pop.profession.assumption ? h('p', null, pop.profession.assumption) : null] : null,
    h('p', null, pop.gameNote),
    asOfLine(learnContent().guide.ui, pop));
  const btn = h('button', {
    type: 'button', class: 'st-tax-btn', 'aria-expanded': String(taxOpen), 'aria-controls': 'st-tax-pop', 'data-action': 'tax-row',
    onClick: () => { taxOpen = !taxOpen; panel.hidden = !taxOpen; btn.setAttribute('aria-expanded', String(taxOpen)); },
  }, h('span', { class: 'st-label' }, e.label), h('span', { class: 'st-value' }, money(e.amount)));
  return [h('div', { class: 'st-row st-row-tax' }, btn), panel];
}

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
    const scope = createTermScope(); // a term becomes a button only at its first place on the sheet
    const lab = (key, params = {}) => tn(key, params, { scope });
    const actionable = s.phase === 'roll' && s.status === 'playing'; // repay works in both modes
    const fullActions = full && actionable; // taking a voluntary loan and selling: full mode only
    body.replaceChildren();

    const m = meter({ large: true });
    m.set(st.passiveIncome, st.totalExpenses, { animate: false });
    // Animate the meter fill on open.
    const track = m.el;
    body.append(h('div', { class: 'st-hero' },
      h('div', { class: 'st-hero-top' },
        h('div', null, h('span', { class: 'stat-label' }, lab('statement.monthlyCashFlow')),
          h('div', { class: `st-flow ${st.monthlyCashFlow < 0 ? 'is-negative' : ''}` }, money(st.monthlyCashFlow, { sign: true }))),
        h('div', { class: 'st-cash' }, h('span', { class: 'stat-label' }, t('statement.cash')), money(st.cash))),
      track,
      h('div', { class: 'meter-labels' },
        h('span', null, t('game.passive'), ' ', h('b', { class: 'tone-income' }, money(st.passiveIncome))),
        h('span', null, t('game.expenses'), ' ', h('b', { class: 'tone-expense' }, money(st.totalExpenses)))),
      // spec 4.6 / 4.9 (owner approved 2026-10-25): the stacked equation in the hero (the one-line form stays as its spoken name)
      h('div', { class: 'st-goal st-payday', 'aria-label': textOf(paydayCalc(st.monthlyCashFlow, PAYDAY_MONTHS, st.monthlyCashFlow * PAYDAY_MONTHS, 'statement.paydayLine')) },
        stackedEquation({ monthly: st.monthlyCashFlow, months: PAYDAY_MONTHS, amount: st.monthlyCashFlow * PAYDAY_MONTHS }, { label: t('payday.label') })),
      h('p', { class: 'st-goal' }, t('statement.goalLine'))));

    // net-worth panel (spec 4.6): net worth, an assets-vs-liabilities bar and the two totals (family: 'חובות' wording, no red)
    const nwb = st.balance;
    const totalBoth = Math.max(1, nwb.assetsTotal + nwb.liabilitiesTotal);
    body.append(h('section', { class: 'nw', 'data-networth': String(nwb.netWorth) },
      h('div', { class: 'nw-top' }, h('span', null, lab('statement.netWorthTitle'))),
      h('div', { class: `nw-value${nwb.netWorth < 0 ? ' is-neg' : ''}` }, money(nwb.netWorth, { size: 'xl' })),
      h('div', { class: 'nw-bar', 'aria-hidden': 'true' },
        h('i', { class: 'nw-assets', style: `inline-size:${(nwb.assetsTotal / totalBoth) * 100}%` }),
        h('i', { class: 'nw-liab', style: `inline-size:${(nwb.liabilitiesTotal / totalBoth) * 100}%` })),
      h('div', { class: 'nw-cols' },
        h('div', { class: 'nw-col' }, h('span', null, t('statement.balanceAssets')), h('span', { class: 'nw-assets-v' }, money(nwb.assetsTotal))),
        h('div', { class: 'nw-col', style: 'text-align:end' }, h('span', null, t('statement.totalLiabilities')), h('span', { class: 'nw-liab-v' }, money(nwb.liabilitiesTotal))))));

    body.append(section(t('statement.income'), 'income',
      row(t('statement.salary'), money(st.salary)),
      row(lab('statement.passiveIncome'), money(st.passiveIncome, { sign: st.passiveIncome > 0 }), 'income'),
      row(t('statement.totalIncome'), money(st.totalIncome), 'total')));

    const expenseRows = st.expenseItems.flatMap((e) => (e.id === 'tax' && full ? taxRow(e, s) ?? [row(e.label, money(e.amount))] : [row(e.label, money(e.amount))]));
    if (st.kids) expenseRows.push(row(t('statement.children', { n: st.kids }), money(st.childExpenses)));
    if (st.loanPayments) expenseRows.push(row(t('statement.loans'), money(st.loanPayments)));
    body.append(section(t('statement.expenses'), 'expense', ...expenseRows, row(t('statement.totalExpenses'), money(st.totalExpenses), 'total')));

    const assetRows = s.assets.length
      ? s.assets.map((a) => h('div', { class: 'st-row st-asset st-asset-row', 'data-category': categoryChip(a, { size: 32, on: 'dark' }).dataset.category },
        categoryChip(a, { size: 32, on: 'dark' }),
        h('span', { class: 'st-label' }, assetTitle(a, s.mode)),
        h('span', { class: 'st-value' }, money(a.monthlyCashFlow, { sign: true })),
        h('span', { class: 'st-sub', 'data-asset': a.id },
          a.type === 'stock'
            ? t('statement.stockLine', { shares: tp('plural.shares', a.qty) })
            : [t(`type.${a.type}`), ...(a.mortgage > 0 ? [' · ', tn('statement.assetMortgage', { amount: money(a.mortgage) })] : [])])))
      : [h('p', { class: 'st-empty' }, t('statement.noAssets'))];
    body.append(section(lab('statement.assets'), 'asset', ...assetRows));

    // Every liability in one list: starting debts, bank loans and the mortgage that came with each asset.
    const rep = st.liabilities;
    const liabRows = rep.items.length
      ? rep.items.map((l) => {
        const debt = s.liabilities.find((x) => x.id === l.id);
        const label = l.kind === 'mortgage' ? lab('statement.mortgageLabel', { asset: l.assetTitle })
          : l.kind === 'bizloan' ? t('statement.bizLoanLabel', { asset: l.assetTitle })
            : (l.label === 'loan' ? t('statement.loanLabel') : l.label);
        const notes = [tn('statement.balance', { amount: money(l.principal) })];
        if (l.kind === 'loan') notes.push(lab('statement.interestOnly', { rate: h('bdi', { dir: 'ltr' }, numberText(Math.round((l.rate ?? LOAN_PAYMENT_RATE) * 1e4) / 100)) }));
        if (l.includedInAssets) notes.push(t('statement.inAssetFlow'));
        const sub = notes.flatMap((n, i) => (i ? [' · ', n] : [n]));
        return h('div', { class: 'st-row st-liab', 'data-liab': l.id, 'data-kind': l.kind },
          h('span', { class: 'st-label' }, label),
          h('span', { class: 'st-value' }, tn('game.perMonth', { amount: money(l.monthlyPayment) })),
          h('span', { class: 'st-sub' }, sub),
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
    body.append(section(lab('statement.liabilities'), 'liability', ...liabRows));

    // Balance sheet: what you own against what you owe.
    const bal = st.balance;
    body.append(section(lab('statement.netWorthTitle'), 'networth',
      row(t('statement.balanceCash'), money(bal.cash)),
      row(t('statement.balanceHoldings'), money(bal.assetsTotal - bal.cash)),
      row(t('statement.balanceAssets'), money(bal.assetsTotal), 'total'),
      row(t('statement.balanceLiabilities'), money(bal.liabilitiesTotal), 'total'),
      row(lab('statement.balanceNet'), money(bal.netWorth), 'total'),
      h('p', { class: 'st-empty' }, t('statement.balanceNote'))));

    if (fullActions) {
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
    if (!actionable && s.status === 'playing' && (full || s.liabilities.length)) {
      body.append(h('p', { class: 'st-empty' }, t(full ? 'statement.lockedNote' : 'statement.lockedNoteFamily')));
    }

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
