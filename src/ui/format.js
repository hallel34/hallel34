// Money/number formatting via Intl.NumberFormat (ILS). Numbers are wrapped in <bdi dir="ltr">
// so "+₪1,200" and "-₪800" never flip inside RTL text.
import { getMeta } from '../i18n/index.js';
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

/** <bdi class="money"> element. */
export function money(n, opts = {}) {
  return h('bdi', { class: `money${opts.class ? ` ${opts.class}` : ''}`, dir: 'ltr' }, moneyText(n, opts));
}

export const numberText = (n) => new Intl.NumberFormat(getMeta().numberLocale).format(n);

/** Rich translation: {param} values that are DOM nodes (e.g. money()) are inserted as nodes. */
import { t } from '../i18n/index.js';
export function tn(key, params = {}) {
  const frag = document.createDocumentFragment();
  for (const part of t(key).split(/(\{\w+\})/)) {
    const m = part.match(/^\{(\w+)\}$/);
    if (m && m[1] in params) {
      const v = params[m[1]];
      frag.append(v?.nodeType ? v : String(v));
    } else if (part) frag.append(part);
  }
  return frag;
}

/** The one formatter for +/- amounts in messages: sign and digits stay glued inside a <bdi dir="ltr">. */
export const signedMoney = (n) => money(n, { sign: true });

/** "₪2,100 × 24 חודשים = ₪50,400" as DOM nodes (every amount isolated), for the log, status line, statement and float text. */
export function paydayCalc(monthly, months, amount, key = 'game.paydayCalc') {
  return tn(key, { monthly: money(monthly), months: numberText(months), amount: signedMoney(amount) });
}
