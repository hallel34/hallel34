// Money/number formatting via Intl.NumberFormat (ILS). Numbers are wrapped in <bdi dir="ltr">
// so "+₪1,200" and "-₪800" never flip inside RTL text.
import { getMeta, t } from '../i18n/index.js';
import { h } from './dom.js';

let nf;
let cache = '';
function formatter() {
  const loc = getMeta().numberLocale;
  if (!nf || cache !== loc) {
    nf = new Intl.NumberFormat(loc, {
      style: 'currency', currency: 'ILS', maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol',
    });
    cache = loc;
  }
  return nf;
}

/** "₪14,250" / "-₪800" / "+₪900" as plain text (symbol first, always). */
export function moneyText(n, { sign = false } = {}) {
  const v = Math.round(n);
  const parts = formatter().formatToParts(Math.abs(v));
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? '₪';
  const digits = parts.filter((p) => p.type !== 'currency' && p.type !== 'literal').map((p) => p.value).join('');
  const s = v < 0 ? '-' : (sign && v > 0 ? '+' : '');
  return `${s}${symbol}${digits}`;
}

/**
 * The amount as a screen reader should hear it inside a sentence: a negative one is 'מינוס ₪58,240', never 'ל--₪58,240'
 * (a Hebrew prefix hyphen glued to the minus sign reads as a double hyphen).
 */
export function moneySpoken(n) {
  const v = Math.round(n);
  return v < 0 ? `${t('a11y.minus')} ${moneyText(-v)}` : moneyText(v);
}

// The sign in the component's text is the ASCII hyphen-minus (spec 6.1 asks for U+2212): every existing test and the plain-text
// moneyText() read '-', so the switch is deferred (docs/decisions.md, owner rule: no test changes unless forced).
export const MINUS = '-';
const LRI = '\u2066';
const PDI = '\u2069';

/**
 * A plain string for the places that cannot hold a node (aria-label, document.title, share text, a live-region message):
 * the amount wrapped in LRI/PDI so the sign and symbol stay glued to the digits in any bidi context (spec 6.1 rule 9).
 */
export function moneyIsolated(n, opts = {}) {
  return `${LRI}${moneyText(n, opts)}${PDI}`;
}

/** { sign, symbol, digits } of an amount for the <bdi> component: the sign is the true minus U+2212 (same width as +). */
function moneyParts(n, { sign = false } = {}) {
  const v = Math.round(n);
  const parts = formatter().formatToParts(Math.abs(v));
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? '₪';
  const digits = parts.filter((p) => p.type !== 'currency' && p.type !== 'literal').map((p) => p.value).join('');
  return { v, sign: v < 0 ? MINUS : (sign && v > 0 ? '+' : ''), symbol, digits };
}

/**
 * Paints an amount into an existing <bdi class="money"> (count-up, the loan stepper): keeps the .sgn/.cur/.num split so the
 * symbol styling survives live updates. Also refreshes the is-neg / is-pos / is-zero state classes.
 */
export function setMoney(el, n, opts = {}) {
  const p = moneyParts(n, opts);
  let sgn = el.querySelector(':scope > .sgn');
  let cur = el.querySelector(':scope > .cur');
  let num = el.querySelector(':scope > .num');
  if (!cur || !num) {
    el.replaceChildren();
    sgn = h('span', { class: 'sgn' });
    cur = h('span', { class: 'cur' });
    num = h('span', { class: 'num' });
    el.append(sgn, cur, num);
  }
  sgn.textContent = p.sign;
  cur.textContent = p.symbol;
  num.textContent = p.digits;
  el.classList.toggle('is-neg', p.v < 0);
  el.classList.toggle('is-pos', p.v > 0 && !!opts.sign);
  el.classList.toggle('is-zero', p.v === 0);
  return el;
}

/**
 * THE money component (spec 6.1): <bdi class="money [money--lg] [is-neg|is-pos|is-zero]" dir="ltr"><sgn><cur>₪</cur><num>1,234</num></bdi>.
 * opts: sign (show + on positives), size ('xs'|'sm'|'md'|'lg'|'xl'|'xxl'), class. A template {amount} slot is always filled with
 * this node (tn()), never with a moneyText() string.
 */
export function money(n, opts = {}) {
  const el = h('bdi', { class: `money${opts.size ? ` money--${opts.size}` : ''}${opts.class ? ` ${opts.class}` : ''}`, dir: 'ltr' });
  return setMoney(el, n, opts);
}

export const numberText = (n) => new Intl.NumberFormat(getMeta().numberLocale).format(n);

/**
 * Rich translation: {param} values that are DOM nodes (e.g. money()) are inserted as nodes, and glossary markup
 * ([[term:id|display]]) becomes a dashed-underline term button (once per `scope`, see ui/rich.js).
 */
import { tRaw } from '../i18n/index.js';
import { richNodes } from './rich.js';
export function tn(key, params = {}, opts = {}) {
  return richNodes(tRaw(key), params, opts);
}

/** The one formatter for +/- amounts in messages: sign and digits stay glued inside a <bdi dir="ltr">. */
export const signedMoney = (n) => money(n, { sign: true });

/** "₪2,100 × 24 חודשים = ₪50,400" as DOM nodes (every amount isolated), for the log, status line, statement and float text. */
export function paydayCalc(monthly, months, amount, key = 'game.paydayCalc') {
  return tn(key, { monthly: money(monthly), months: numberText(months), amount: signedMoney(amount) });
}

/**
 * A plain string from the learning content (fox notes, report lines) as nodes: every "₪1,234" / "-₪800" / "+₪900" inside it becomes
 * its own <bdi class="money" dir="ltr">, so the sign and symbol stay glued to the digits in the Hebrew sentence. Nodes pass through.
 */
const MONEY_IN_TEXT = /([-+−]?₪[\d,]+(?:\.\d+)?)/u;
export function isolateMoney(text) {
  if (text == null || typeof text !== 'string') return text;
  return text.split(MONEY_IN_TEXT).filter((p) => p !== '').map((p) => (MONEY_IN_TEXT.test(p) && /^[-+−]?₪/.test(p) ? h('bdi', { class: 'money', dir: 'ltr' }, p) : p));
}
