// v4 stage 4: the decision card (docs/v4/decision-cards.md). The same cream card as the deals: the tile chip of its square, the
// title and text, then one row per option (what it does to cash and to the monthly money, or why it is not available now), the
// "מה זה מלמד" line, and the option buttons (two in a row at most; three or more stack). An option the player cannot take now is
// a real disabled button tagged "לא זמין" with its reason (strings-proposals O4). The numbers come from an engine dry run.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { money, tn } from './format.js';
import { cardShell } from './modals.js';
import { PASS_OPTION, decisionCanPass, isFreeOption, monthlyCashFlow, PAYDAY_MONTHS } from '../engine/index.js';

const label = (o, mode) => (mode === 'family' && o.labelFamily) || o.label;
export const foxLine = (o, mode) => (mode === 'family' && o.foxFamily) || o.fox;

/** What an option does (a dry run on the live state; with unlimited cash when it is not available, to still show its size). */
function optionDelta(engine, state, id) {
  for (const s of [state, { ...state, cash: 1e12 }]) {
    try {
      const n = engine.decide(s, id);
      const ev = n.events.find((e) => e.type === 'decided');
      return { cash: ev.cash, monthly: monthlyCashFlow(n) - monthlyCashFlow(s), n };
    } catch { /* not possible on this state */ }
  }
  return null;
}

/** The slots of a fox line ({proceeds} {monthly} {repaid} {saved} {months}) from what the choice actually did. */
export function foxSlots(before, after) {
  const sold = after.events.find((e) => e.type === 'sold');
  const repaid = after.events.find((e) => e.type === 'repaid');
  const owned = before.pending?.card?.options?.some((o) => o.effects?.sell)
    ? before.assets.filter((a) => a.type === 'apartment').reduce((a, b) => (!a || b.price > a.price ? b : a), null) : null;
  return {
    proceeds: sold ? money(sold.proceeds) : '', monthly: money(sold?.monthly ?? owned?.monthlyCashFlow ?? 0),
    repaid: money(repaid?.amount ?? 0), saved: money(repaid?.saved ?? 0), months: String(PAYDAY_MONTHS),
  };
}

/** Opens the pending decision card. Resolves { action: 'decide', option } (or null when closed by a debug force). */
export function decisionModal(state, engine) {
  const card = state.pending.card;
  const mode = state.mode;
  const status = Object.fromEntries(engine.decisionOptions(state).map((o) => [o.id, o]));
  const reasonText = (r) => t(`decision.reason.${r}`); // one wording in both modes (kid-safe; QA round 14 P3-13)
  const opts = [...card.options.map((o) => ({ id: o.id, label: label(o, mode), free: isFreeOption(o), ...status[o.id] })),
    ...(decisionCanPass(card) ? [{ id: PASS_OPTION, label: t('decision.pass'), free: true, available: true }] : [])];

  const rows = opts.map((o) => {
    const d = o.free ? null : optionDelta(engine, state, o.id);
    const nums = d
      ? h('span', { class: 'dec-nums' },
        h('span', { class: 'dec-num' }, h('span', { class: 'dec-num-label' }, t('decision.cash')), ' ', money(d.cash, { sign: true })),
        h('span', { class: 'dec-num' }, h('span', { class: 'dec-num-label' }, t('decision.monthly')), ' ', money(d.monthly, { sign: true })))
      : h('span', { class: 'dec-nums dec-none' }, t('decision.none'));
    const why = o.available ? null : h('span', { class: 'dec-reason', id: `dec-why-${o.id}` }, `${t('decision.unavailable')}: ${reasonText(o.reason)}`);
    return h('li', { class: 'dec-row', 'data-option': o.id, 'data-available': String(o.available) }, h('span', { class: 'dec-label' }, o.label), nums, why);
  });
  const teaches = (mode === 'family' && card.teachesFamily) || card.teaches;
  const body = [
    h('p', { class: 'dec-choose' }, t('decision.choose')),
    h('ul', { class: 'dec-list', role: 'list' }, rows),
    teaches ? h('div', { class: 'banner banner-info dec-teaches' }, h('span', null, h('b', null, `${t('decision.teaches')}: `), teaches.replaceAll('{months}', String(PAYDAY_MONTHS)))) : null,
  ];
  // the buttons reuse the card actions players (and scripted QA players) already know: the free choice is 'pass', on an expense
  // card paying from cash is 'pay' and borrowing the whole amount is 'loan'; the other options are 'option-<id>'
  const actionId = (o) => {
    if (o.free) return 'pass';
    const fx = card.options.find((x) => x.id === o.id)?.effects ?? {};
    if (card.square === 'expense' && !fx.loan) return 'pay';
    if (card.square === 'expense' && fx.loan === fx.pay) return 'loan';
    return `option-${o.id}`;
  };
  const actions = opts.map((o) => ({
    id: actionId(o), option: o.id, cls: 'btn-option', variant: 'secondary', disabled: !o.available, value: { action: 'decide', option: o.id },
    label: o.available ? o.label : [h('span', null, o.label), h('span', { class: 'btn-tag' }, t('decision.unavailable'))],
    describedBy: o.available ? null : `dec-why-${o.id}`,
  }));
  return cardShell({
    type: card.square, kind: t('decision.kicker'), headChip: null, title: card.title, text: card.text, body, actions,
    data: { decision: card.id },
  });
}

export const decisionLabel = (card, optionId, mode) => (optionId === PASS_OPTION ? t('decision.pass') : label(card.options.find((o) => o.id === optionId), mode));
export const decisionFox = (card, optionId, mode) => (optionId === PASS_OPTION ? t('decision.passFox') : foxLine(card.options.find((o) => o.id === optionId), mode));
export const decisionLog = (card, optionId, mode) => tn('decision.logChose', { label: decisionLabel(card, optionId, mode) });
