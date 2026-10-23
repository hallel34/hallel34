// 'סיכום שנתיים' presentation (spec 4.9; the chip is not wired yet, see docs/v4/test-changes.md): the stacked equation, three copy variants for the chip after the summary (picked by
// turn % 3, same data, different phrasing) and the chip's popover. Pure presentation of summaryFigures(); amounts are money() nodes.
import { h } from './dom.js';
import { t, rawString } from '../i18n/index.js';
import { money, numberText } from './format.js';
import { icon } from './icons.js';
import { getLearnMode } from '../learn/context.js';

export const PAYDAY_VARIANTS = ['a', 'b', 'c'];
export const variantFor = (turn) => PAYDAY_VARIANTS[((turn % 3) + 3) % 3];

/** A payday string in the active mode: `<key>Family` when it exists and the game is in family mode, else `<key>`. */
export function paydayText(key, params) {
  const fam = `${key}Family`;
  return getLearnMode() === 'family' && rawString(fam) != null ? t(fam, params) : t(key, params);
}

/**
 * The stacked equation: a label with NO amount, then monthly / x months / rule / = total. One LTR grid, every amount its own
 * <bdi>, the lines are blocks so nothing wraps mid-equation. At <= 640px tall the months line is hidden (CSS).
 */
export function stackedEquation({ monthly, months, amount }, { label = t('payday.a.kicker') } = {}) {
  const row = (cls, op, value) => h('span', { class: `eq-row ${cls}` }, h('span', { class: 'eq-op', 'aria-hidden': op ? null : 'true' }, op), h('span', { class: 'eq-val' }, value));
  return h('div', { class: `eq${amount < 0 ? ' is-neg' : ''}`, dir: 'ltr', 'data-eq': '' },
    h('div', { class: 'eq-label', dir: 'rtl' }, label),
    row('eq-monthly', '', money(monthly, { sign: monthly < 0 })),
    row('eq-months', '×', h('bdi', { dir: 'rtl' }, t('payday.a.months', { months: numberText(months) }))),
    h('i', { class: 'eq-rule', 'aria-hidden': 'true' }),
    row('eq-total', '=', money(amount, { sign: true })));
}

/** { variant, label, amount: Node, caption } of the chip for this summary. */
export function chipModel(f, turn) {
  const v = variantFor(turn);
  if (v === 'a') return { variant: v, label: t('payday.a.kicker'), amount: money(f.monthly, { sign: true }), caption: null };
  if (v === 'b') {
    return {
      variant: v, label: paydayText(f.amount < 0 ? 'payday.b.kickerNeg' : 'payday.b.kicker'), amount: money(f.amount, { sign: true }),
      caption: paydayText('payday.b.caption', { months: numberText(f.months) }),
    };
  }
  // C: before -> after (cash), one mirrored arrow between
  return {
    variant: v, label: paydayText('payday.c.kicker'),
    amount: h('span', { class: 'pc-pair' }, h('span', { class: 'vh' }, `${t('payday.c.before')} `), money(f.cashBefore, { class: 'pc-before' }),
      icon('arrow', { size: 18, width: 2.6, cls: 'pc-arrow' }), h('span', { class: 'vh' }, ` ${t('payday.c.after')} `), money(f.cashAfter)),
    caption: paydayText('payday.c.caption'),
  };
}

/**
 * The chip that replaces the 3-line wrapped bubble: label (12) + amount (22/800) in a 2-line stack; tap toggles a popover with the
 * stacked equation. Returns the <button>. `host` = the element the popover is appended to (the roll zone).
 */
export function paydayChip(f, turn, { host }) {
  const m = chipModel(f, turn);
  let pop = null;
  const btn = h('button', {
    type: 'button', class: `payday-chip${f.amount < 0 ? ' is-neg' : ''}`, 'data-action': 'payday-chip', 'data-variant': m.variant,
    'aria-expanded': 'false', 'aria-label': `${m.label}: ${t('game.paydayChipOpen')}`,
  }, h('span', { class: 'pc-label' }, m.label), h('span', { class: 'pc-amount' }, m.amount));
  const close = () => {
    pop?.remove(); pop = null; btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e) => { if (pop && !pop.contains(e.target) && !btn.contains(e.target)) close(); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop) { close(); return; }
    pop = h('div', { class: 'payday-pop', role: 'group', 'aria-label': t('payday.label'), 'data-payday-pop': '' },
      stackedEquation(f), m.caption ? h('p', { class: 'pp-caption' }, m.caption) : null);
    host.append(pop);
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
  });
  btn.closePopover = close;
  return btn;
}
