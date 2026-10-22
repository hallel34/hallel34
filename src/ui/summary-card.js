// The itemised 'סיכום שנתיים' card (spec section 3, art.md section 3): salary, money that works, expenses -> what is left a month
// x 24 = the amount that reaches the cash. Shown at EVERY summary, in every mode; blocking but quick (tap anywhere to go on),
// and its one-line form goes into the log. The figures come from summaryFigures() = the engine's own payday numbers.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { button } from './widgets.js';
import { money, moneyText } from './format.js';
import { animate, haptic } from './fx.js';
import { motionOK } from './prefs.js';
import { getLearnMode } from '../learn/context.js';
import { fillSlots } from '../learn/slots.js';
import { summaryRowModel } from '../learn/tutorial.js';
import { tut, fillNodes, hintStrip, showRing } from './hint-ui.js';

/** The label of the money-that-works row: 'כסף שעובד' in family mode, 'הכנסה פסיבית' (labelFull) in full mode. */
function passiveLabel() {
  const row = tut().summaryBreakdown.rows.find((r) => r.id === 'passive');
  return getLearnMode() === 'full' && row.labelFull ? row.labelFull : row.label;
}

/** Plain-text one-liner of a summary (toast / log / screen readers): positive and negative variants. */
export function summaryOneLine(f) {
  const sb = tut().summaryBreakdown;
  // the label of the money-that-works row follows the mode (family: 'כסף שעובד', full: 'הכנסה פסיבית')
  const oneLine = sb.oneLine.replaceAll(sb.rows.find((r) => r.id === 'passive').label, passiveLabel());
  const slots = {
    salary: moneyText(f.salary), passive: moneyText(f.passive), expenses: moneyText(f.expenses),
    monthly: moneyText(f.monthly), months: String(f.months), amount: moneyText(f.amount),
    monthlyAbs: moneyText(Math.abs(f.monthly)), amountAbs: moneyText(Math.abs(f.amount)),
  };
  if (f.negative) {
    const head = fillSlots(oneLine.split('→')[0], slots).trim();
    return `${head} → ${fillSlots(sb.negativeResult, slots)}`;
  }
  return fillSlots(oneLine, slots);
}

/** The sentence a screen reader hears when the card opens: the one-liner and where the cash goes. */
export function summarySpoken(f) {
  const sb = tut().summaryBreakdown;
  return `${summaryOneLine(f)}. ${fillSlots(sb.arrivalSr, { cashBefore: moneyText(f.cashBefore), cashAfter: moneyText(f.cashAfter) })}`;
}

const rowLabel = (id) => (id === 'passive' ? passiveLabel() : tut().summaryBreakdown.rows.find((r) => r.id === id).label);

/** A tap on the card may close it only after this long: a stray second tap from the previous card never skips the figures. */
export const MIN_OPEN_MS = 600;

/**
 * @param figures  summaryFigures(state, paydayEvent, cashBefore)
 * @param hint     optional first-time hint: { body, more, target: 'passive' | 'cash' }
 * @returns Promise<void> resolved when the card is dismissed (a tap anywhere on it, the button, Escape, or the scrim)
 */
export function summaryCard({ figures: f, hint = null }) {
  const sb = tut().summaryBreakdown;
  const neg = f.negative;
  const bigAmount = h('bdi', { class: 'sc-big money', dir: 'ltr' }, moneyText(f.monthly, { sign: true }));
  const result = h('bdi', { class: 'sc-result money', dir: 'ltr' }, moneyText(f.amount)); // the final total from the first frame (no 0 flash)
  const descId = 'summary-desc';
  const row = (cls, label, value, extra = {}) => h('li', { class: `sc-row ${cls}`, ...extra },
    h('span', { class: 'sc-label' }, label), value);
  // a money-losing asset: the real signed figure plus a neutral 'נכס מפסיד' tag, so the rows add up to the result
  const passiveCell = f.hasPassive || f.hasLoss
    ? h('bdi', { class: 'sc-amt money', dir: 'ltr' }, moneyText(f.passive, { sign: f.hasLoss }))
    : h('span', { class: 'sc-amt sc-none' }, sb.zeroShort);
  const rows = [
    row('sc-salary', rowLabel('salary'), h('bdi', { class: 'sc-amt money', dir: 'ltr' }, moneyText(f.salary))),
    row(`sc-passive${f.hasPassive ? ' has-income' : ''}${f.hasLoss ? ' has-loss' : ''}`, f.hasLoss ? [rowLabel('passive'), h('small', { class: 'sc-losstag' }, fillNodes(sb.lossAsset.template, { lossAbs: h('bdi', { class: 'money', dir: 'ltr' }, moneyText(f.lossAbs)) }))] : rowLabel('passive'), passiveCell, { 'data-row': 'passive', 'data-kind': summaryRowModel(f).rows[1].kind }),
    row('sc-expense', rowLabel('expenses'), h('bdi', { class: 'sc-amt money', dir: 'ltr' }, moneyText(-f.expenses))),
  ];
  const leftRow = h('div', { class: 'sc-left', 'data-row': 'left' },
    neg ? fillNodes(sb.negativeMonthly, { monthlyAbs: h('bdi', { class: 'sc-big money', dir: 'ltr' }, moneyText(Math.abs(f.monthly))) }) : fillNodes(sb.resultMonthly, { monthly: bigAmount }));
  const band = h('div', { class: 'sc-band', 'data-row': 'total' },
    h('span', { class: 'sc-calc' }, h('bdi', { dir: 'ltr', class: 'money' }, moneyText(f.monthly, { sign: neg })), ' × ', h('bdi', { dir: 'ltr' }, String(f.months)), ' = '), result,
    neg ? h('span', { class: 'sc-note' }, sb.negativeNote) : null);
  const [arrA, arrB] = sb.arrival.split('→');
  const caption = h('p', { class: 'sc-cash', 'data-row': 'cash' },
    fillNodes(arrA, { cashBefore: money(f.cashBefore) }), h('span', { class: 'sc-arrow', 'aria-hidden': 'true' }, '→'), fillNodes(arrB, { cashAfter: money(f.cashAfter) }));
  const strip = hint ? hintStrip({ body: hint.body, more: hint.more, cls: 'in-summary' }) : null;

  let layer;
  let ring = null;
  const openedAt = performance.now();
  const ready = () => performance.now() - openedAt >= MIN_OPEN_MS;
  const go = button(t('game.continue'), { variant: 'primary', size: 'lg', cls: 'sc-go is-arming', style: `--arm-ms:${MIN_OPEN_MS}ms`, 'aria-disabled': 'true', 'data-action': 'summary-ok', 'data-autofocus': '', onClick: (e) => { e.stopPropagation(); if (!ready()) return; haptic('tap'); layer.close(true); } });
  setTimeout(() => { go.removeAttribute('aria-disabled'); go.classList.remove('is-arming'); }, MIN_OPEN_MS);
  const card = h('div', { class: `sheet summary-card${neg ? ' is-negative' : ' is-positive'}`, 'data-summary': neg ? 'negative' : 'positive', 'data-monthly': String(f.monthly), 'data-amount': String(f.amount) },
    h('h2', { class: 'sc-title' }, t('game.paydayFloatLabel')),
    h('ul', { class: 'sc-rows' }, rows),
    h('div', { class: 'sc-divider', 'aria-hidden': 'true' }),
    leftRow, band, caption, strip,
    h('p', { id: descId, class: 'vh' }, summarySpoken(f)),
    h('div', { class: 'sc-cta' }, go));
  // tapping anywhere on the card goes on (the figures were the point; the log keeps them)
  card.addEventListener('click', () => { if (ready()) layer.close(true); });
  layer = openLayer(card, { kind: 'sheet', label: t('game.paydayFloatLabel'), dismissable: true, cls: 'layer-summary' });
  // scrim, Escape and the Back button also wait for MIN_OPEN_MS (a forced close - debug, give up - always works)
  const rawClose = layer.close;
  layer.close = (result, opts) => (opts?.force || ready() ? rawClose(result, opts) : undefined);
  layer.panel.setAttribute('aria-describedby', descId);

  // ---- entrance: three rows at 150ms steps, then the result (count-up) and the cash line; reduced motion: everything fades together ----
  const nodes = [...rows, h('i'), leftRow, band, caption];
  if (!motionOK()) {
    animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  } else {
    [rows[0], rows[1], rows[2], leftRow, band, caption].forEach((n, i) => {
      animate(n, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 150, delay: 90 + i * 150, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    if (!neg) animate(band, [{ boxShadow: 'inset 0 0 0 0 rgb(255 255 255 / 0)' }, { boxShadow: 'inset 0 0 0 3px rgb(246 196 83 / .55)', offset: 0.5 }, { boxShadow: 'inset 0 0 0 0 rgb(255 255 255 / 0)' }], { duration: 500, delay: 90 + 4 * 150 });
  }
  void nodes;

  // ---- first-time hint: the ring lands after the card has settled ----
  if (hint) {
    const settle = motionOK() ? 1100 : 250;
    setTimeout(() => {
      if (layer.done) return;
      const target = hint.target === 'cash' ? document.querySelector('.hud-cash') : card.querySelector('[data-row="passive"]');
      if (target) ring = showRing(target, { onCream: hint.target !== 'cash' });
    }, settle);
  }
  return layer.closed.then(() => { ring?.remove(); });
}
