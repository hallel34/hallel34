// The WhatsApp text of a daily result (D2). Pure. No names, no card titles, no choices: only the day, the outcome, the net
// worth and a row of coloured squares (one per turn, by traffic-light tier of what happened in it).
import { t, tp } from '../i18n/index.js';
import { shortDate } from './calendar.js';

/** 1234567 -> '₪1.2M', 850000 -> '₪850K', 900 -> '₪900', -300 -> 'מינוס ₪300'. Rounded, never a fake decimal. */
export function compactMoney(n) {
  // 'מינוס ₪24K' in words: a trailing or leading '-' flips next to Hebrew text in RTL
  const sign = n < 0 ? `${t('daily.shareLines.minus')} ` : '';
  const a = Math.abs(Math.round(n));
  const num = (x) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(x);
  const cur = t('common.currency');
  if (a >= 1e6) return `${sign}${cur}${t('daily.shareLines.millions', { n: num(Math.round(a / 1e5) / 10) })}`;
  if (a >= 1e4) return `${sign}${cur}${t('daily.shareLines.thousands', { n: num(Math.round(a / 1e3)) })}`;
  return `${sign}${cur}${new Intl.NumberFormat('en').format(a)}`;
}

/** 'gyrn' -> emoji blocks, `perRow` per line. */
export const RLM = '\u200F';
export const LRI = '\u2066'; // isolates the amount: K / M stay attached even in a bubble forced to LTR
export const PDI = '\u2069';

export function squaresRows(lights, perRow = 10) {
  const sym = { g: t('daily.shareLines.green'), y: t('daily.shareLines.yellow'), r: t('daily.shareLines.red'), n: t('daily.shareLines.none') };
  const cells = [...lights].map((c) => sym[c] ?? sym.n);
  const rows = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(RLM + cells.slice(i, i + perRow).join(''));
  return rows;
}

/** @param entry the stored daily entry ({ record, lights }), @param url the link to the game */
export function buildShareText(entry, url) {
  const { record, lights } = entry;
  const outcome = record.turns == null ? t('daily.shareLines.notToday') : t('daily.shareLines.freedom', { turns: tp('plural.turnsIn', record.turns) });
  const head = t('daily.shareLines.head', { date: shortDate(record.date), outcome, net: `${LRI}${compactMoney(record.netWorth)}${PDI}` });
  return [head, ...squaresRows(lights), url].filter(Boolean).join('\n');
}
