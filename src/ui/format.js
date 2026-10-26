// Money/number formatting via Intl.NumberFormat (ILS). Numbers are wrapped in <bdi dir="ltr">
// so "+₪1,200" and "-₪800" never flip inside RTL text.
import { getMeta, t, tp } from '../i18n/index.js';
import { h } from './dom.js';
import coinUrl from '../assets/coin-small.svg?url';

// ---- 'צעירים' coin scale (owner 2026-10-26): ONE switch for every surface that formats money. While it is on (a junior player's
// turn), an amount shows as coins: 1 coin = COIN_SHEKELS, the coin icon instead of ₪ in the component, "179 מטבעות" in text.
// The engine guarantees whole coins in a junior game; anything else is rounded (never a decimal coin). ----
export const COIN_SHEKELS = 100;
let coins = false;
/** Turns the coin display on / off (play.js: per player, on every turn change; every other screen: off). */
export function setCoinScale(on) { coins = !!on; globalThis.document?.documentElement?.toggleAttribute?.('data-coins', coins); }
export const coinScale = () => coins;
/** Runs `fn` with the shekel display (real-world figures, the "1 coin = ₪100" line), whatever the current scale. */
export function inShekels(fn) { const was = coins; coins = false; try { return fn(); } finally { coins = was; } }
const toCoins = (v) => Math.round(v / COIN_SHEKELS);
const RLI_ = '\u2067';
const LRI_ = '\u2066';
const PDI_ = '\u2069';
/**
 * A coin amount as text: "מטבע אחד" / "179 מטבעות" / "-8 מטבעות" / "+9 מטבעות". The phrase is an RTL isolate (RLI...PDI) and a
 * signed number an LTR isolate inside it, so the number always reads first, also inside the <bdi dir="ltr"> of a money cell
 * (where a bare "-74 מטבעות" would lay out as "מטבעות -74").
 */
function coinPhrase(c, { sign = false } = {}) {
  const abs = Math.abs(c);
  const s = c < 0 ? '-' : (sign && c > 0 ? '+' : '');
  if (!s) return `${RLI_}${tp('coins.amount', abs)}${PDI_}`;
  const num = `${LRI_}${s}${new Intl.NumberFormat(getMeta().numberLocale).format(abs)}${PDI_}`;
  return `${RLI_}${tp('coins.signed', abs, { num })}${PDI_}`;
}

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
  if (coins) return coinPhrase(toCoins(n), { sign });
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
  if (coins) {
    const c = toCoins(n);
    return { v: c, sign: c < 0 ? MINUS : (sign && c > 0 ? '+' : ''), symbol: '', digits: new Intl.NumberFormat(getMeta().numberLocale).format(Math.abs(c)), coins: true };
  }
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
  if (p.coins) {
    // the coin icon takes the ₪'s place; the word is there for screen readers (the icon is decoration)
    if (!cur.querySelector('img')) cur.replaceChildren(h('img', { class: 'coin-ico', src: coinUrl, alt: '', width: 16, height: 16, 'aria-hidden': 'true' }));
  } else cur.textContent = p.symbol;
  num.textContent = p.digits;
  let word = el.querySelector(':scope > .coin-word');
  if (p.coins && !word) { word = h('span', { class: 'coin-word vh' }); el.append(word); }
  if (word) word.textContent = p.coins ? ` ${t('coins.word')}` : '';
  el.classList.toggle('is-coins', !!p.coins);
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
/** A typed "₪1,234" figure as the scale shows it (coins: "12 מטבעות"); a figure that is not whole coins stays in shekels. */
export function scaleTypedMoney(text) {
  if (!coins || typeof text !== 'string') return text;
  return text.replace(/([-+−]?)₪(\d{1,3}(?:,\d{3})+|\d+)(?!\.?\d)/gu, (m, sg, digits) => {
    const v = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(v) || v % COIN_SHEKELS !== 0) return m;
    return coinPhrase((sg === '-' || sg === '−' ? -1 : 1) * (v / COIN_SHEKELS), { sign: sg === '+' });
  });
}
export function isolateMoney(text) {
  if (text == null || typeof text !== 'string') return text;
  if (coins) return scaleTypedMoney(text);
  return text.split(MONEY_IN_TEXT).filter((p) => p !== '').map((p) => (MONEY_IN_TEXT.test(p) && /^[-+−]?₪/.test(p) ? h('bdi', { class: 'money', dir: 'ltr' }, p) : p));
}
