// 0.5.0 in-game promotion card (docs/v050/design/career-spec.md section 5): a decision card with two equal options, "keep your lifestyle"
// (the whole raise stays free cash) and "upgrade" (80% of the raise becomes a new monthly expense, the fox gets an accessory, no cash).
// Neither is nudged: both are stacked ghost buttons, keep first. The numbers are the engine's (pending.raise / pending.upgradeCost).
import '../../styles/career.css';
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { money, tn, coinScale } from '../format.js';
import { cardShell } from '../modals.js';
import { animate } from '../fx.js';
import { motionOK } from '../prefs.js';
import { PAYDAY_MONTHS } from '../../engine/config.js';

/** What a choice does, as the engine will do it: { raise, upgradeCost, kept, perSummary }. */
export const promotionFigures = (pending) => ({
  raise: pending.raise, upgradeCost: pending.upgradeCost, kept: pending.raise - pending.upgradeCost, perSummary: pending.raise * PAYDAY_MONTHS,
});

const word = (key) => (coinScale() && t(`${key}Junior`) !== `${key}Junior` ? t(`${key}Junior`) : t(key)); // the kid sibling of a key, else the plain one

/** Opens the pending promotion. Resolves { action: 'keep' | 'upgrade' } (or null when closed by a debug force). */
export function promotionModal(state) {
  const f = promotionFigures(state.pending);
  const slots = { raise: money(f.raise), upgradeCost: money(f.upgradeCost), kept: money(f.kept), perSummary: money(f.perSummary) };
  const bar = (segments) => h('span', { class: 'rbar', 'aria-hidden': 'true' }, segments.map((s) => h('i', { class: s.spend ? 'is-spend' : '', style: `--w:${s.pct}%` })));
  const keepPct = 100;
  const spendPct = Math.round((100 * f.upgradeCost) / f.raise);
  const option = (id, label, consequence, monthly, bars, legend) => h('li', { class: 'dec-row promo-row', 'data-option': id },
    h('span', { class: 'dec-label' }, label),
    h('span', { class: 'dec-nums' },
      h('span', { class: 'dec-num', 'data-num': 'cash' }, h('span', { class: 'dec-num-label' }, t('decision.cash')), ' ', t('decision.none')),
      h('span', { class: 'dec-num', 'data-num': 'monthly' }, h('span', { class: 'dec-num-label' }, t('decision.monthly')), ' ', money(monthly, { sign: true }))),
    bars, h('span', { class: 'rbar-legend' }, legend),
    h('span', { class: 'dec-reason' }, tn(consequence, slots)));
  const keepRow = option('keep', word('promotion.keep'), coinScale() ? 'promotion.keepConsequenceJunior' : 'promotion.keepConsequence', f.raise,
    bar([{ pct: keepPct }]), h('span', null, word('promotion.legendKeep')));
  const upRow = option('upgrade', word('promotion.upgrade'), coinScale() ? 'promotion.upgradeConsequenceJunior' : 'promotion.upgradeConsequence', f.kept,
    bar([{ pct: spendPct, spend: true }, { pct: 100 - spendPct }]),
    [h('span', null, tn('promotion.legendStays', { amount: money(f.kept) })), h('span', null, tn(coinScale() ? 'promotion.legendNewJunior' : 'promotion.legendNew', { amount: money(f.upgradeCost) }))]);
  const teaches = h('div', { class: 'banner banner-info dec-teaches' }, h('span', null, h('b', null, `${t('promotion.teachesTitle')}: `), word('promotion.teaches'), ' ', word('promotion.simplificationPace')));
  const rows = h('ul', { class: 'dec-list', role: 'list' }, keepRow, upRow);
  const modal = cardShell({
    type: 'payday', kind: t('promotion.kicker'), headChip: null, title: word('promotion.title'), text: tn(coinScale() ? 'promotion.offerJunior' : 'promotion.offer', slots),
    body: [h('p', { class: 'dec-choose' }, t('decision.choose')), rows, teaches],
    // two equal ghost buttons, keep first; 'pass' is the free option's action id on every decision card (scripted players know it)
    actions: [
      { id: 'pass', option: 'keep', cls: 'btn-option', variant: 'secondary', label: word('promotion.keep'), value: { action: 'keep' } },
      { id: 'option-upgrade', option: 'upgrade', cls: 'btn-option', variant: 'secondary', label: word('promotion.upgrade'), value: { action: 'upgrade' } },
    ],
    data: { promotion: 'offer' },
  });
  // the bars grow once from the inline-start, 80ms apart
  requestAnimationFrame(() => {
    if (!motionOK()) return;
    document.querySelectorAll('.promo-row .rbar > i').forEach((el, i) => animate(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, delay: 80 * i, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  });
  return modal;
}

/** The fox line and the log line after the choice (neutral facts, never praise or warning). */
export function promotionLines(choice, state) {
  const p = state.promotion;
  const slots = { raise: money(p.raise), upgradeCost: money(p.upgradeCost), kept: money(p.raise - p.upgradeCost), perSummary: money(p.raise * PAYDAY_MONTHS) };
  const key = choice === 'upgrade' ? 'Upgrade' : 'Keep';
  const feedback = coinScale() && t(`promotion.feedback${key}Junior`) !== `promotion.feedback${key}Junior` ? `promotion.feedback${key}Junior` : `promotion.feedback${key}`;
  return { log: tn(`promotion.log.${choice}`, slots), body: tn(feedback, slots), months: tp('promotion.plural.months', 1) };
}
