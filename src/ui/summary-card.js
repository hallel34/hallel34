// The itemised 'סיכום שנתי' card (spec section 3, art.md section 3): salary, money that works, expenses -> what is left a month
// x 12 months = the amount that reaches the cash. Shown at EVERY summary, in every mode; blocking but quick (tap anywhere to go on),
// and its one-line form goes into the log. The figures come from summaryFigures() = the engine's own payday numbers.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { button, arm } from './widgets.js';
import { money, moneyText, moneySpoken, numberText, tn } from './format.js';
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
  return `${summaryOneLine(f)}. ${fillSlots(sb.arrivalSr, { cashBefore: moneySpoken(f.cashBefore), cashAfter: moneySpoken(f.cashAfter) })}`;
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
  // the credited total from the first frame (no 0 flash), signed: a positive credit reads '+₪17,880', a negative one keeps its minus
  const result = h('bdi', { class: 'sc-result money', dir: 'ltr' }, moneyText(f.amount, { sign: true }));
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
  // ONE centred, highlighted expression: '₪1,490 × 12 חודשים = +₪17,880' (redesign 5.7). Natural RTL flow (no dir on the container): the monthly amount
  // sits at the right, the result at the left. Every number run is its own isolate (bdi dir=ltr for amounts, bdi dir=rtl for '12 חודשים'), the
  // operators are aria-hidden spans glued to their operand by the nowrap groups: lhs = 'monthly × months', rhs = '= result'. When the whole line
  // does not fit (320px) the two groups wrap: the operands on one line, '= result' on the next, never an operator alone at an edge.
  const op = (ch) => h('span', { class: 'eq-op', 'aria-hidden': 'true' }, ch);
  const band = h('div', { class: 'sc-band', 'data-row': 'total' },
    h('div', { class: `sc-eq${neg ? ' is-neg' : ''}` },
      h('span', { class: 'sc-eq-lhs' },
        h('span', { class: 'eq-monthly' }, h('bdi', { dir: 'ltr', class: 'money' }, moneyText(f.monthly, { sign: neg }))),
        op('×'),
        h('span', { class: 'eq-months' }, h('bdi', { dir: 'rtl' }, t('payday.a.months', { months: numberText(f.months) })))),
      h('span', { class: 'sc-eq-rhs eq-total' }, op('='), result)),
    neg ? h('span', { class: 'sc-note' }, sb.negativeNote) : null);
  const [arrA, arrB] = sb.arrival.split('→');
  // the cash line: a short label, then two LABELLED balances: 'לפני' (the previous balance, at the right) and 'אחרי' (the new one, at the left), joined by
  // an arrow that points left in Hebrew (the '→' glyph is mirrored in RTL by CSS). The two boxes and the arrow never split (7-digit cash at 320px).
  const [arrLabel] = arrA.split('{cashBefore}');
  const caption = h('p', { class: 'sc-cash', 'data-row': 'cash' },
    h('span', { class: 'sc-cash-label' }, arrLabel.trim()),
    h('span', { class: 'sc-pair' },
      h('span', { class: 'sc-bal sc-bal-before' }, h('span', { class: 'sc-bal-k' }, t('payday.c.before')), money(f.cashBefore)),
      h('span', { class: 'sc-arrow', 'aria-hidden': 'true' }, '→'),
      h('span', { class: 'sc-bal sc-bal-after' }, h('span', { class: 'sc-bal-k' }, t('payday.c.after')), fillNodes(`{cashAfter}${arrB.replace('{cashAfter}', '')}`, { cashAfter: money(f.cashAfter) }))));
  // v0.4: Maxi's idle-cash mirror (figures.idle is computed by the play controller; no penalty, just the mirror)
  const idleLine = f.idle ? h('p', { class: 'sc-idle', 'data-idle': '' }, tn('payday.idle', { cash: money(f.idle.cash), gain: money(f.idle.gain, { sign: true }) })) : null;
  const strip = hint ? hintStrip({ body: hint.body, more: hint.more, cls: 'in-summary' }) : null;

  let layer;
  let ring = null;
  const openedAt = performance.now();
  const ready = () => performance.now() - openedAt >= MIN_OPEN_MS;
  const go = button(t('game.continue'), { variant: 'primary', size: 'lg', cls: 'sc-go', 'data-action': 'summary-ok', 'data-autofocus': '', onClick: (e) => { e.stopPropagation(); if (!ready()) return; haptic('tap'); layer.close(true); } });
  // a real `disabled` + aria-busy + data-arming for MIN_OPEN_MS, then the solid primary look and the focus lands on it
  const armer = arm(go, MIN_OPEN_MS);
  const card = h('div', { class: `sheet summary-card${neg ? ' is-negative' : ' is-positive'}`, 'data-summary': neg ? 'negative' : 'positive', 'data-monthly': String(f.monthly), 'data-amount': String(f.amount) },
    h('h2', { class: 'sc-title' }, t('game.paydayFloatLabel')),
    h('ul', { class: 'sc-rows' }, rows),
    h('div', { class: 'sc-divider', 'aria-hidden': 'true' }),
    leftRow, band, caption, idleLine, strip,
    h('p', { id: descId, class: 'vh' }, summarySpoken(f)),
    h('div', { class: 'sc-cta' }, go));
  // tapping anywhere on the card goes on (the figures were the point; the log keeps them)
  card.addEventListener('click', () => { if (ready()) layer.close(true); });
  layer = openLayer(card, { kind: 'sheet', label: t('game.paydayFloatLabel'), dismissable: true, cls: 'layer-summary' });
  // scrim, Escape and the Back button also wait for MIN_OPEN_MS (a forced close - debug, give up - always works)
  const rawClose = layer.close;
  layer.close = (result, opts) => (opts?.force || ready() ? rawClose(result, opts) : undefined);
  layer.panel.setAttribute('aria-describedby', descId);
  layer.closed.then(() => armer.cancel());

  // All figures are visible immediately. A short fade avoids a blank, apparently loading calculation.
  if (motionOK()) animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'none' });

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
