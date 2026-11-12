// 0.5.0 in-game promotion card (docs/v050/design/career-spec.md section 5): a decision card with two equal options, "keep your lifestyle"
// (the whole raise stays free cash) and "upgrade" (80% of the raise becomes a new monthly expense; no cash perk, nothing else).
// Neither is nudged: both are stacked ghost buttons, keep first. The numbers are the engine's (pending.raise / pending.upgradeCost).
import '../../styles/career.css';
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { money, tn, coinScale } from '../format.js';
import { cardShell } from '../modals.js';
import { animate } from '../fx.js';
import { motionOK } from '../prefs.js';
import { PAYDAY_MONTHS } from '../../engine/config.js';

/**
 * The slot values of one sentence. money() returns a DOM node and a node sits in the DOM once, so every sentence gets its own set: sharing one
 * set between two tn() calls moved the amounts out of the first sentence (QA 0.5.0 P1-2).
 */
export const promotionSlots = (f) => ({ raise: money(f.raise), upgradeCost: money(f.upgradeCost), kept: money(f.kept), perSummary: money(f.perSummary) });

/** What a choice does, as the engine will do it: { raise, upgradeCost, kept, perSummary }. */
export const promotionFigures = (pending) => ({
  raise: pending.raise, upgradeCost: pending.upgradeCost, kept: pending.raise - pending.upgradeCost, perSummary: pending.raise * PAYDAY_MONTHS,
});

/** The card's buttons ignore taps for this long after it opens. */
const PROMOTION_SETTLE_MS = 450;

const word = (key) => (coinScale() && t(`${key}Junior`) !== `${key}Junior` ? t(`${key}Junior`) : t(key)); // the kid sibling of a key, else the plain one

/** Opens the pending promotion. Resolves { action: 'keep' | 'upgrade' } (or null when closed by a debug force). */
export function promotionModal(state) {
  const f = promotionFigures(state.pending);
  const bar = (segments) => h('span', { class: 'rbar', 'aria-hidden': 'true' }, segments.map((s) => h('i', { class: s.spend ? 'is-spend' : '', style: `--w:${s.pct}%` })));
  const keepPct = 100;
  const spendPct = Math.round((100 * f.upgradeCost) / f.raise);
  const option = (id, label, consequence, monthly, bars, legend) => h('li', { class: 'dec-row promo-row', 'data-option': id },
    h('span', { class: 'dec-label' }, label),
    h('span', { class: 'dec-nums' },
      h('span', { class: 'dec-num', 'data-num': 'cash' }, h('span', { class: 'dec-num-label' }, t('decision.cash')), ' ', t('decision.none')),
      h('span', { class: 'dec-num', 'data-num': 'monthly' }, h('span', { class: 'dec-num-label' }, t('decision.monthly')), ' ', money(monthly, { sign: true }))),
    bars, h('span', { class: 'rbar-legend' }, legend),
    h('span', { class: 'dec-reason' }, tn(consequence, promotionSlots(f))));
  const keepRow = option('keep', word('promotion.keep'), coinScale() ? 'promotion.keepConsequenceJunior' : 'promotion.keepConsequence', f.raise,
    bar([{ pct: keepPct }]), h('span', null, word('promotion.legendKeep')));
  const upRow = option('upgrade', word('promotion.upgrade'), coinScale() ? 'promotion.upgradeConsequenceJunior' : 'promotion.upgradeConsequence', f.kept,
    bar([{ pct: spendPct, spend: true }, { pct: 100 - spendPct }]),
    [h('span', null, tn('promotion.legendStays', { amount: money(f.kept) })), h('span', null, tn(coinScale() ? 'promotion.legendNewJunior' : 'promotion.legendNew', { amount: money(f.upgradeCost) }))]);
  // one short lesson line (educator review); the long teaching and the pace note come with the feedback after the choice
  const teaches = h('div', { class: 'banner banner-info dec-teaches' }, h('span', null, h('b', null, `${t('promotion.teachesTitle')}: `), word('promotion.lesson')));
  const rows = h('ul', { class: 'dec-list', role: 'list' }, keepRow, upRow);
  const ctl = {};
  const modal = cardShell({
    type: 'payday', kind: t('promotion.kicker'), headChip: null, title: word('promotion.title'), text: tn(coinScale() ? 'promotion.offerJunior' : 'promotion.offer', promotionSlots(f)),
    body: [h('p', { class: 'dec-choose' }, t('decision.choose')), rows, teaches],
    // two equal ghost buttons, keep first. Their action ids are the promotion's own (never 'pass' / 'buy'): a tap or a script aimed at the card
    // that closed a moment ago cannot answer this one (QA 0.5.0 delta P1)
    actions: [
      { id: 'promotion-keep', option: 'keep', cls: 'btn-option', variant: 'secondary', label: word('promotion.keep'), value: { action: 'keep' } },
      { id: 'promotion-upgrade', option: 'upgrade', cls: 'btn-option', variant: 'secondary', label: word('promotion.upgrade'), value: { action: 'upgrade' } },
    ],
    data: { promotion: 'offer' },
    ctl,
  });
  // a fast double-tap on the previous card must not land on this one: the buttons wake up after the card has settled
  const buttons = [...ctl.card.querySelectorAll('.card-actions button')];
  buttons.forEach((b) => { b.disabled = true; });
  setTimeout(() => buttons.forEach((b) => { b.disabled = false; }), PROMOTION_SETTLE_MS);
  // the bars grow once from the inline-start, 80ms apart
  requestAnimationFrame(() => {
    if (!motionOK()) return;
    document.querySelectorAll('.promo-row .rbar > i').forEach((el, i) => animate(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, delay: 80 * i, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  });
  return modal;
}

/** The fox line and the log line after the choice (neutral facts, never praise or warning). Each sentence gets fresh amount nodes. */
export function promotionLines(choice, state) {
  const p = state.promotion;
  const f = promotionFigures({ raise: p.raise, upgradeCost: p.upgradeCost });
  const key = choice === 'upgrade' ? 'Upgrade' : 'Keep';
  const feedback = coinScale() && t(`promotion.feedback${key}Junior`) !== `promotion.feedback${key}Junior` ? `promotion.feedback${key}Junior` : `promotion.feedback${key}`;
  const body = tn(feedback, promotionSlots(f));
  // the lesson in full comes after the choice, where the numbers are already in front of the player
  body.append(' ', word('promotion.teaches'), ' ', word('promotion.simplificationPace'));
  return { log: tn(`promotion.log.${choice}`, promotionSlots(f)), body, months: tp('promotion.plural.months', 1) };
}
