// v4 deal-strength badge A / B / C (docs/v4/design/board-spec.md 8.3). ONE source: paybackTier(paybackYears(...)) from the engine,
// so the badge, the v3 verdict pill (same tier, same letter), the ribbon and the feedback can never disagree.
// The badge is letter + word + icon, never colour alone. Family mode: C is deep amber with the word "איטית" and the hourglass.
import { h, html } from './dom.js';
import { t } from '../i18n/index.js';
import { icon } from './icons.js';
import { paybackYears, paybackTier } from '../engine/index.js';
import { pctText } from '../learn/slots.js';
import hourglassSvg from '../assets/verdict/hourglass.svg?raw';

export const TIER_LETTER = { ok: 'A', slow: 'B', bad: 'C' };
const TIER_ICON = { ok: 'check', slow: 'minus', bad: 'close' };

/**
 * The badge of a card (pure, no DOM): { kind: 'tier', tier, letter, years, yieldPct } or { kind: 'speculative' } for a stock that
 * pays no dividend (growth stocks are not "bad deals"). Deals: yield = annual cash flow / down payment = 1 / payback years.
 * Stocks: dividend yield = monthly dividend x 12 / price. A down payment of 0 with a positive cash flow is 0 years, so A.
 */
export function dealBadgeModel(card) {
  if (!card) return null;
  if (card.type === 'stock') {
    const div = Number(card.dividend) || 0;
    if (div <= 0) return { kind: 'speculative' };
    const years = paybackYears(card.price, div);
    return { kind: 'tier', tier: paybackTier(years), letter: TIER_LETTER[paybackTier(years)], years, yieldPct: (div * 12 * 100) / card.price };
  }
  const years = paybackYears(card.downPayment, card.monthlyCashFlow);
  const tier = paybackTier(years);
  const yieldPct = card.monthlyCashFlow > 0 && card.downPayment > 0 ? (card.monthlyCashFlow * 12 * 100) / card.downPayment : (card.monthlyCashFlow > 0 ? Infinity : 0);
  return { kind: 'tier', tier, letter: TIER_LETTER[tier], years, yieldPct };
}

/** The word of a tier per mode (family C = "איטית", never "חלשה" / red). */
export const badgeLabel = (tier, mode) => (tier === 'bad' && mode === 'family' ? t('deal.badge.cFamily') : t(`deal.badge.${TIER_LETTER[tier].toLowerCase()}`));

/** The tier glyph: check / minus / close; family C gets the hourglass (the same glyph as the family verdict pill). */
export function tierGlyph(tier, mode, size = 16) {
  if (tier === 'bad' && mode === 'family') {
    const g = html(hourglassSvg);
    g.setAttribute('width', String(size)); g.setAttribute('height', String(size));
    g.setAttribute('aria-hidden', 'true'); g.setAttribute('focusable', 'false');
    g.setAttribute('class', 'icon');
    return g;
  }
  return icon(TIER_ICON[tier], { size, width: 2.6 });
}

/** The spoken badge: "דירוג עסקה A, עסקה חזקה, תשואה 24.5% בשנה" (family wording comes from the family string layer). */
export function badgeAria(model, mode) {
  if (model.kind === 'speculative') return t('deal.speculativeAria');
  const yieldText = Number.isFinite(model.yieldPct) ? pctText(model.yieldPct) : '∞';
  return t('deal.badgeAria', { letter: model.letter, label: badgeLabel(model.tier, mode), yield: yieldText });
}

/** <span class="deal-badge"> letter square + word + icon (or the sky "ספקולטיבי" pill). `size` 28 on the card, 20 in lists. */
export function dealBadge(card, { mode = 'full', size = 28, cls = '' } = {}) {
  const model = dealBadgeModel(card);
  if (!model) return null;
  if (model.kind === 'speculative') {
    return h('span', { class: `deal-badge is-speculative${cls ? ` ${cls}` : ''}`, role: 'img', 'aria-label': badgeAria(model, mode), 'data-deal': 'speculative' },
      h('span', { class: 'db-label' }, t('deal.speculative')));
  }
  return h('span', {
    class: `deal-badge db-${model.letter.toLowerCase()}${size < 28 ? ' is-small' : ''}${cls ? ` ${cls}` : ''}`, role: 'img', 'aria-label': badgeAria(model, mode),
    'data-deal': model.letter, 'data-tier': model.tier,
  },
  h('b', { class: 'db-letter', 'aria-hidden': 'true' }, model.letter),
  h('span', { class: 'db-label', 'aria-hidden': 'true' }, badgeLabel(model.tier, mode)),
  tierGlyph(model.tier, mode, size < 28 ? 14 : 16));
}
