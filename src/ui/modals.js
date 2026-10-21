// Card modals and dialogs. Each function returns a Promise with the player's choice.
// They never mutate game state; the play controller applies the result via the engine.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer, closeButton } from './modal.js';
import { icon } from './icons.js';
import { cornerPop, foxImg } from './fox.js';
import { playerToken } from './players.js';
import { CARD_REACTION } from './fox-rules.js';
import { money, moneyText, tn, numberText } from './format.js';
import { button, stepper, statTile } from './widgets.js';
import { haptic, countUp, shake } from './fx.js';
import {
  monthlyCashFlow, passiveIncome, maxLoan, saleValue, canSell, loanPaydayImpact,
  paybackYears, paybackTier, PAYDAY_MONTHS, purchasePlan,
} from '../engine/index.js';
import { LOAN_STEP, LOAN_PAYMENT_RATE } from '../engine/index.js';

const BANNERS = import.meta.glob('../assets/card-*.svg', { eager: true, query: '?url', import: 'default' });
const bannerUrl = (type) => BANNERS[`../assets/card-${type}.svg`] || BANNERS['../assets/card-opportunity.svg'];

// ---------- generic cream card ----------
function cardShell({ type, art, chip, title, text, body = [], actions, flip = false, label, data = {}, foot = null }) {
  let layer;
  const done = (v) => layer.close(v);
  const bar = h('div', { class: `card-actions${actions.length === 1 ? ' single' : ''}` },
    actions.map((a) => {
      const b = button(a.label, {
        variant: a.variant, disabled: a.disabled, cls: `${a.cls || ''}${a.blocked ? ' is-blocked' : ''}`.trim(),
        'data-action': a.id, 'data-autofocus': a.autofocus ? '' : null,
        // A blocked action stays focusable and readable (aria-disabled + reason), but never does anything.
        'aria-disabled': a.blocked ? 'true' : null, 'aria-describedby': a.describedBy || null,
        onClick: () => {
          if (a.blocked) { haptic('error'); shake(b); return; }
          haptic('tap');
          done(a.getValue ? a.getValue() : a.value);
        },
      });
      return b;
    }));
  const content = h('div', { class: 'card', 'data-card': type, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) },
    h('div', { class: `card-head card-head--${type}` },
      h('img', { class: 'card-banner', src: bannerUrl(type), alt: '', width: 320, height: 140, decoding: 'async', draggable: 'false' }),
      h('span', { class: 'card-chip' }, chip),
      // The fox reacts once the flip has landed (+150ms); never over the title or the numbers grid.
      cornerPop(CARD_REACTION[type] || 'think', { size: 64, delay: (flip ? 400 : 0) + 150 })),
    h('div', { class: 'card-body', tabindex: '0', role: 'region', 'aria-label': title },
      h('div', { class: 'card-titles' }, h('h2', { class: 'card-title' }, title), text ? h('p', { class: 'card-text' }, text) : null),
      body),
    // the reason / next step for the primary action sits right above the buttons, so it never scrolls out of view
    foot ? h('div', { class: 'card-foot' }, foot, bar) : bar);
  layer = openLayer(content, { kind: 'modal', label: label || title, dismissable: false, cardFlip: flip, cls: 'layer-card' });
  return layer.closed;
}

const limitBanner = () => h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('loan.limitHint')));
const grid = (...tiles) => h('div', { class: 'stat-grid' }, tiles);
/** Whole years, rounded UP, so the shown number always agrees with the tier (8.33y is '9', amber; 8.0y is '8', neutral). */
export const paybackYearsShown = (years) => Math.max(1, Math.ceil(years - 1e-9));
function paybackBadge(years, tier) {
  const label = Number.isFinite(years)
    ? t('card.payback', { years: numberText(paybackYearsShown(years)) })
    : t('card.paybackNever');
  return h('div', { class: `payback payback-${tier}`, 'data-payback-tier': tier }, icon(tier === 'ok' ? 'check' : 'expense', { size: 20 }), h('span', null, label));
}
const banner = (node, tone = 'info') => h('div', { class: `banner banner-${tone}` }, icon('star', { size: 26 }), h('span', null, node));

// ---------- opportunity ----------
export function opportunityModal(state, { flip = true } = {}) {
  const c = state.pending.card;
  const passive = passiveIncome(state);

  if (c.type === 'stock') {
    const maxAfford = Math.floor(state.cash / c.price);
    const cap = Math.max(1, Math.min(c.maxQty || 10000, maxAfford));
    const canBuy = maxAfford >= 1;
    const total = h('bdi', { class: 'money', dir: 'ltr' });
    const gain = h('bdi', { class: 'money', dir: 'ltr' });
    const update = () => {
      total.replaceChildren(money(st.value * c.price));
      gain.replaceChildren(money(st.value * c.dividend, { sign: true }));
    };
    const st = stepper({
      min: 1, max: cap, step: 1, value: 1, render: (q) => String(q), onChange: update,
    });
    const quick = [10, 100].filter((n) => n <= cap).map((n) => h('button', { type: 'button', class: 'chip-btn', onClick: () => st.set(n) }, `×${n}`));
    update();
    const body = [
      grid(
        statTile(t('card.perShare'), money(c.price)),
        statTile(t('card.dividend'), money(c.dividend, { sign: true }), { tone: 'income' }),
      ),
      canBuy ? h('div', { class: 'stepper-wrap' }, h('span', { class: 'stat-label' }, t('card.quantity')), st.el, quick.length ? h('div', { class: 'qty-quick' }, quick) : null) : null,
      canBuy ? grid(
        statTile(t('card.total'), total, { big: true }),
        statTile(t('card.monthlyIncome'), gain, { tone: 'income', big: true })) : null,
    ].filter(Boolean);
    return finishOpportunity({ c, body, flip, qtyGetter: () => st.value, plan: purchasePlan(state, c.price) });
  }

  const years = paybackYears(c.downPayment, c.monthlyCashFlow);
  const tier = paybackTier(years);
  const body = [
    paybackBadge(years, tier),
    grid(
      statTile(t('card.downPayment'), money(c.downPayment), { big: true }),
      statTile(t('card.monthlyCashFlow'), money(c.monthlyCashFlow, { sign: true }), { tone: c.monthlyCashFlow <= 0 || tier === 'bad' ? 'expense' : (tier === 'slow' ? 'slow' : 'income'), big: true }),
      statTile(t(c.type === 'business' ? 'card.businessLoan' : 'card.mortgage'), money(c.mortgage)),
      statTile(t('card.price'), money(c.price)),
    ),
    c.monthlyCashFlow < 0
      ? h('div', { class: 'banner banner-warn' }, icon('expense', { size: 24 }), h('span', null, tn('card.negativeFlow', { amount: money(-c.monthlyCashFlow) })))
      : banner(tn('card.newPassive', { amount: money(passive + c.monthlyCashFlow) })),
  ];
  return finishOpportunity({ c, body, flip, qtyGetter: () => 1, plan: purchasePlan(state, c.downPayment) });
}

function finishOpportunity({ c, body, flip, qtyGetter, plan }) {
  // plan.status: 'ok' (cash covers it) | 'loan' (one loan covers the gap) | 'blocked' (short even after the maximum loan)
  const hintId = 'buy-hint';
  const warn = plan.status === 'blocked'
    ? h('div', { class: 'banner banner-warn', role: 'status', id: hintId, 'data-hint': 'blocked' }, icon('bank', { size: 24 }), h('span', null, t('card.noFundsMax')))
    : plan.status === 'loan'
      ? h('div', { class: 'banner banner-warn', role: 'status', id: hintId, 'data-hint': 'loan' }, icon('bank', { size: 24 }), h('span', null, t('card.needLoan', { amount: moneyText(plan.need) })))
      : null;
  const actions = [
    { id: 'pass', label: t('card.pass'), variant: 'secondary', value: { action: 'pass' } },
    {
      id: 'buy', label: t('card.buy'), variant: 'buy', autofocus: plan.status !== 'blocked',
      blocked: plan.status === 'blocked', describedBy: warn ? hintId : null,
      getValue: () => (plan.status === 'loan'
        ? { action: 'buyLoan', qty: qtyGetter(), need: plan.need }
        : { action: 'buy', qty: qtyGetter() }),
    },
  ];
  return cardShell({
    type: 'opportunity', art: c.type, chip: `${t('square.opportunity')} · ${t(`type.${c.type}`)}`, title: c.title, text: c.text,
    body, foot: warn, actions, flip,
    data: {
      afford: String(plan.status === 'ok'), buy: plan.status, kind: c.type, cost: String(plan.cost),
      payback: c.type === 'stock' ? '' : String(Math.round(c.downPayment / Math.max(1, c.monthlyCashFlow))),
      flow: String(c.type === 'stock' ? c.dividend : c.monthlyCashFlow),
    },
  });
}

// ---------- expense (paid or must-pay) ----------
export function expenseModal(state, { card, amount, paid, flip = true }) {
  const short = !paid ? amount - state.cash : 0;
  const body = [
    grid(
      statTile(t('card.amount'), money(-amount), { tone: 'expense', big: true }),
      statTile(t('card.cashNow'), money(paid ? state.cash + amount : state.cash)),
    ),
    paid
      ? h('div', { class: 'banner banner-info' }, icon('check', { size: 24 }), h('span', null, t('card.alreadyPaid')))
      : h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('card.expenseDue', { amount: moneyText(short) }))),
  ];
  const actions = paid
    ? [{ id: 'pay', label: t('card.pay'), variant: 'danger', value: { action: 'ok' }, autofocus: true }]
    : [
      ...(canSell(state) ? [{ id: 'sell', label: t('card.sellAsset'), variant: 'secondary', value: { action: 'sell' } }] : []),
      { id: 'loan', label: t('card.getLoan'), variant: 'primary', value: { action: 'loan' }, disabled: maxLoan(state) === 0, autofocus: maxLoan(state) > 0 },
    ];
  if (!paid && maxLoan(state) === 0) body.push(limitBanner());
  return cardShell({ type: 'expense', art: 'expense', chip: t('square.expense'), title: card.title, text: card.text, body, actions, flip });
}

export function shortfallModal(state, { flip = true } = {}) {
  const short = -state.cash;
  const body = [
    grid(statTile(t('card.cashNow'), money(state.cash), { tone: 'expense', big: true })),
    h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('card.shortfallText', { amount: moneyText(short) }))),
  ];
  const actions = [
    ...(canSell(state) ? [{ id: 'sell', label: t('card.sellAsset'), variant: 'secondary', value: { action: 'sell' } }] : []),
    { id: 'loan', label: t('card.getLoan'), variant: 'primary', value: { action: 'loan' }, disabled: maxLoan(state) === 0, autofocus: maxLoan(state) > 0 },
  ];
  if (maxLoan(state) === 0) body.push(limitBanner());
  return cardShell({ type: 'expense', art: 'expense', chip: t('square.expense'), title: t('card.shortfallTitle'), text: '', body, actions, flip });
}

// ---------- charity ----------
export function charityModal(state, { flip = true } = {}) {
  const cost = state.pending.cost;
  const afford = state.cash >= cost;
  const body = [
    grid(statTile(t('charity.cost'), money(cost), { big: true }), statTile(t('card.cashNow'), money(state.cash))),
    h('div', { class: 'banner banner-info' }, icon('charity', { size: 26 }), h('span', null, t('charity.boost'))),
    afford ? null : h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('card.notEnough', { amount: moneyText(cost - state.cash) }))),
  ];
  return cardShell({
    type: 'charity', art: 'charity', chip: t('square.charity'), title: t('charity.title'),
    text: t('charity.text', { amount: moneyText(cost) }), body,
    actions: [
      { id: 'skip', label: t('charity.skip'), variant: 'secondary', value: { action: 'skip' } },
      { id: 'donate', label: t('charity.donate'), variant: 'buy', disabled: !afford, value: { action: 'donate' }, autofocus: true },
    ], flip,
  });
}

// ---------- market offer ----------
export function offerModal(state, { flip = true } = {}) {
  const p = state.pending;
  const asset = state.assets.find((a) => a.id === p.assetId);
  const body = [
    grid(
      statTile(t('card.offerPrice'), money(p.offerPrice), { big: true }),
      statTile(t('card.offerProceeds'), money(p.proceeds, { sign: true }), { tone: p.proceeds >= 0 ? 'income' : 'expense', big: true }),
    ),
    h('div', { class: 'banner banner-info' }, icon('market', { size: 26 }), h('span', null, t('card.offerFor', { asset: asset?.title ?? '' }))),
  ];
  return cardShell({
    type: 'market', art: 'market', chip: t('square.market'), title: p.card.title, text: p.card.text, body,
    actions: [
      { id: 'decline', label: t('card.decline'), variant: 'secondary', value: { action: 'decline' } },
      { id: 'accept', label: t('card.accept'), variant: 'buy', value: { action: 'accept' }, autofocus: true },
    ], flip,
  });
}

// ---------- informational cards ----------
export function marketInfoModal(state, { card, noMatch, familyOffer, flip = true }) {
  const body = [];
  if (card.effect === 'cash') {
    body.push(grid(statTile(t('card.amount'), money(card.amount, { sign: true }), { tone: card.amount >= 0 ? 'income' : 'expense', big: true })));
  } else if (card.effect === 'stockPrice') {
    body.push(banner(t('market.stockPrice', { symbol: card.symbol, price: moneyText(card.newPrice) })));
    const held = state.assets.find((a) => a.type === 'stock' && a.symbol === card.symbol);
    if (held) body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.stockHeld', { qty: held.qty, symbol: card.symbol }))));
  } else if (noMatch) {
    body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.noAsset'))));
  } else if (familyOffer) {
    body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.familyNote'))));
  }
  return cardShell({
    type: 'market', art: 'market', chip: t('square.market'), title: card.title, text: card.text, body,
    actions: [{ id: 'ok', label: t('card.ok'), variant: 'primary', value: { action: 'ok' }, autofocus: true }], flip,
  });
}

export function babyModal(state, { max, extra, flip = true }) {
  const body = max ? [] : [grid(statTile(t('baby.extra'), money(-extra, { sign: true }), { tone: 'expense', big: true }))];
  return cardShell({
    type: 'baby', art: 'baby', chip: t('square.baby'), title: max ? t('baby.max') : t('baby.title'),
    text: max ? t('baby.maxText') : t('baby.text', { amount: moneyText(extra) }), body,
    actions: [{ id: 'ok', label: t('card.ok'), variant: 'primary', value: { action: 'ok' }, autofocus: true }], flip,
  });
}

// ---------- dialogs (second level) ----------
function dialogShell({ title, text, body, actions, label, fox = '' }) {
  let layer;
  const bar = h('div', { class: 'dialog-actions' }, actions.map((a) => button(a.label, {
    variant: a.variant, disabled: a.disabled, 'data-action': a.id, 'data-autofocus': a.autofocus ? '' : null,
    onClick: () => { haptic('tap'); layer.close(a.getValue ? a.getValue() : a.value); },
  })));
  const dialog = h('div', { class: `dialog${fox ? ' has-fox' : ''}` },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, title), closeButton(() => layer.close(null))),
    text ? h('p', { class: 'dialog-text' }, text) : null,
    body, bar);
  // Fox crop on the top inline-end corner, overlapping the edge by 50% (so it lives outside the scrolling .dialog).
  const content = h('div', { class: 'dialog-frame' }, dialog, fox ? cornerPop(fox, { size: 56, delay: 150, cls: 'fox-dialog' }) : null);
  layer = openLayer(content, { kind: 'modal', label: label || title, dismissable: true, cls: 'layer-dialog' });
  return { layer, promise: layer.closed.then((v) => (v === undefined ? null : v)), bar };
}

/** Loan dialog. Resolves with the amount (multiple of 1000) or null. */
export function loanDialog(state, { required = 0 } = {}) {
  const max = maxLoan(state);
  const cf = monthlyCashFlow(state);
  const start = max === 0 ? 0 : Math.min(max, Math.max(LOAN_STEP, Math.ceil(required / LOAN_STEP) * LOAN_STEP));
  const voluntary = required <= 0;
  const spend = voluntary ? 0 : state.cash + required; // what the loan is about to pay for

  const amountOut = h('bdi', { class: 'big-amount money', dir: 'ltr' });
  const payOut = h('bdi', { class: 'money', dir: 'ltr' });
  const flowOut = h('bdi', { class: 'money', dir: 'ltr' });
  const barFill = h('div', { class: 'limit-fill' });
  const usedLabel = h('span', { class: 'limit-label' });
  const flowRow = h('div', { class: 'kv' }, h('span', null, t('loan.newFlow')), flowOut);
  const paydayOut = h('bdi', { class: 'money', dir: 'ltr' });
  const paydayRow = h('div', { class: 'kv' }, h('span', null, tn('loan.paydayNext', { months: PAYDAY_MONTHS, amount: paydayOut })));
  const warnText = h('span');
  const warn = h('div', { class: 'banner banner-warn', role: 'status', 'data-risky': 'false', hidden: true }, icon('expense', { size: 24 }), warnText);
  let takeBtn = null;
  let shown = start;

  const update = (from, to) => {
    const pay = to * LOAN_PAYMENT_RATE;
    countUp(from, to, (v) => { amountOut.textContent = moneyText(v); }, 300);
    payOut.textContent = moneyText(pay);
    const nf = cf - pay;
    flowOut.textContent = moneyText(nf, { sign: true });
    flowRow.classList.toggle('is-negative', nf < 0);
    const imp = loanPaydayImpact(state, to, spend);
    paydayOut.textContent = moneyText(imp.payday, { sign: true });
    paydayRow.classList.toggle('is-negative', imp.payday < 0);
    warn.hidden = !imp.risky;
    warn.dataset.risky = String(imp.risky);
    warnText.textContent = imp.risky ? t('loan.paydayWarn', { amount: moneyText(-imp.cashAfter) }) : '';
    if (takeBtn) {
      takeBtn.textContent = imp.risky ? t('loan.takeAnyway') : t('loan.take');
      takeBtn.classList.toggle('btn-danger', imp.risky);
      takeBtn.classList.toggle('btn-primary', !imp.risky);
    }
    barFill.style.setProperty('--fill', String(max ? to / max : 0));
    usedLabel.textContent = t('loan.limitUsed', { amount: moneyText(to), max: moneyText(max) });
  };

  const st = max === 0 ? null : stepper({
    min: LOAN_STEP, max, step: LOAN_STEP, value: start,
    render: () => amountOut,
    onChange: (v, from) => { shown = v; update(from, v); },
    decLabel: t('loan.less'), incLabel: t('loan.more'),
  });
  if (st) update(start, start); else amountOut.textContent = moneyText(0);

  const body = max === 0
    ? [h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('loan.limitReached')))]
    : [
      st.el,
      h('div', { class: 'kv' }, h('span', null, tn('loan.monthlyPayment', { amount: payOut }))),
      flowRow,
      paydayRow,
      warn,
      h('div', { class: 'limit' }, h('div', { class: 'limit-bar', 'aria-hidden': 'true' }, barFill), h('div', { class: 'limit-row' }, h('span', null, t('loan.limit')), usedLabel)),
    ];
  const d = dialogShell({
    title: voluntary ? t('loan.titleVoluntary') : t('loan.title'),
    text: voluntary ? t('loan.textVoluntary', { step: moneyText(LOAN_STEP) }) : t('loan.text', { amount: moneyText(required), step: moneyText(LOAN_STEP) }),
    body,
    actions: [
      { id: 'cancel', label: t('loan.cancel'), variant: 'secondary', value: null },
      ...(max > 0 ? [{ id: 'take', label: t('loan.take'), variant: 'primary', getValue: () => shown, autofocus: true }] : []),
    ],
    label: t('loan.title'),
    fox: 'worried',
  });
  takeBtn = d.bar.querySelector('[data-action="take"]');
  if (st) update(start, start);
  return d.promise.then((v) => (typeof v === 'number' ? v : null));
}

/** Repay dialog (full mode). Resolves with the amount or null. */
export function repayDialog(state, liability) {
  const cash = state.cash;
  const options = [];
  for (let a = LOAN_STEP; a <= liability.principal; a += LOAN_STEP) options.push(a);
  if (!options.includes(liability.principal)) options.push(liability.principal);
  const affordable = options.filter((a) => a <= cash);
  let idx = 0;
  const out = h('bdi', { class: 'big-amount money', dir: 'ltr' });
  const payOut = h('bdi', { class: 'money', dir: 'ltr' });
  const left = h('bdi', { class: 'money', dir: 'ltr' });
  const show = () => {
    const a = affordable[idx];
    out.textContent = moneyText(a);
    const remaining = liability.principal - a;
    left.textContent = moneyText(remaining);
    payOut.textContent = moneyText(remaining === 0 ? 0 : (liability.monthlyPayment * remaining) / liability.principal);
    inc.disabled = idx >= affordable.length - 1;
    dec.disabled = idx <= 0;
  };
  const dec = h('button', { type: 'button', class: 'step-btn', 'aria-label': t('loan.less'), onClick: () => { idx = Math.max(0, idx - 1); haptic('tap'); show(); } }, icon('minus', { size: 26, width: 3 }));
  const inc = h('button', { type: 'button', class: 'step-btn', 'aria-label': t('loan.more'), onClick: () => { idx = Math.min(affordable.length - 1, idx + 1); haptic('tap'); show(); } }, icon('plus', { size: 26, width: 3 }));
  const body = affordable.length === 0
    ? [h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('card.notEnough', { amount: moneyText(Math.min(LOAN_STEP, liability.principal) - cash) })))]
    : [
      h('div', { class: 'stepper', dir: 'ltr' }, dec, h('output', { class: 'stepper-value' }, out), inc),
      h('div', { class: 'kv' }, h('span', null, t('loan.remaining')), left),
      h('div', { class: 'kv' }, h('span', null, tn('loan.monthlyPayment', { amount: payOut }))),
    ];
  if (affordable.length) show();
  const d = dialogShell({
    title: `${t('loan.repayTitle')} · ${liability.label === 'loan' ? t('statement.loanLabel') : liability.label}`,
    text: t('loan.repayText', { cash: moneyText(cash) }),
    body,
    actions: [
      { id: 'cancel', label: t('loan.cancel'), variant: 'secondary', value: null },
      { id: 'repay', label: t('loan.repay'), variant: 'buy', disabled: affordable.length === 0, getValue: () => affordable[idx], autofocus: true },
    ],
    fox: 'think',
  });
  return d.promise.then((v) => (typeof v === 'number' ? v : null));
}

/**
 * Sell sheet: lists assets; stocks have an inline quantity stepper.
 * `onSell(assetId, qty)` applies the sale (engine) and returns the new state; the sheet re-renders.
 * Resolves when closed or `shouldClose(state)` is true after a sale.
 */
export function sellSheet(getState, onSell, { shouldClose = () => false } = {}) {
  const list = h('div', { class: 'sell-list' });
  let layer;
  const render = () => {
    const state = getState();
    list.replaceChildren();
    if (!state.assets.length) {
      list.append(h('p', { class: 'dialog-text' }, t('sell.none')));
      return;
    }
    for (const a of state.assets) {
      let qty = a.type === 'stock' ? a.qty : 1;
      const proceeds = h('bdi', { class: 'money', dir: 'ltr' });
      const upd = () => { proceeds.replaceChildren(money(a.type === 'stock' ? saleValue(state, a, qty) : saleValue(state, a))); };
      const qtyCtl = a.type === 'stock'
        ? stepper({ min: 1, max: a.qty, step: Math.max(1, Math.round(a.qty / 10)), value: a.qty, render: (q) => String(q), onChange: (v) => { qty = v; upd(); }, decLabel: t('loan.less'), incLabel: t('loan.more') })
        : null;
      upd();
      list.append(h('div', { class: 'sell-row', 'data-asset': a.id },
        h('div', { class: 'sell-info' },
          h('strong', null, a.title),
          h('span', { class: 'muted' }, a.type === 'stock' ? t('statement.stockLine', { qty: a.qty }) : t(`type.${a.type}`)),
          h('span', null, tn('sell.proceeds', { amount: proceeds }))),
        qtyCtl?.el,
        button(t('sell.sell'), { variant: 'primary', size: 'sm', 'data-action': 'sell', onClick: () => {
          const next = onSell(a.id, a.type === 'stock' ? qty : undefined);
          render();
          if (next && shouldClose(next)) layer.close();
        } })));
    }
  };
  render();
  const content = h('div', { class: 'dialog sheet-body' },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, t('sell.title')), closeButton(() => layer.close())),
    h('p', { class: 'dialog-text' }, t('sell.text')), list);
  layer = openLayer(content, { kind: 'modal', label: t('sell.title'), cls: 'layer-dialog' });
  return layer.closed;
}


// ---------- hot-seat sheets ----------
/** Pass-the-phone sheet: "תור של <name>" with one primary button. Not dismissable; resolves when the next player is ready. */
export function handoffSheet({ name, color }) {
  let layer;
  const content = h('div', { class: 'sheet handoff-sheet', 'data-handoff': String(color) },
    h('div', { class: 'handoff-fox' }, foxImg('roll', { height: 96 })),
    playerToken(color, { cls: 'ptoken-xl' }),
    h('h2', { class: 'dialog-title handoff-title' }, t('players.handoffTitle', { name })),
    h('p', { class: 'dialog-text' }, t('players.handoffText', { name })),
    h('div', { class: 'sheet-cta' }, button(t('players.ready'), { variant: 'primary', size: 'lg', 'data-action': 'ready', 'data-autofocus': '', onClick: () => { haptic('tap'); layer.close(true); } })));
  layer = openLayer(content, { kind: 'sheet', label: t('players.handoffTitle', { name }), dismissable: false, cls: 'layer-handoff' });
  return layer.closed;
}

/** In-page confirm for "back to the start screen" (no native dialogs). Resolves 'home' or null. */
export function homeConfirmSheet() {
  let layer;
  const content = h('div', { class: 'sheet home-sheet' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('game.homeTitle')),
      h('p', { class: 'dialog-text' }, t('game.homeText'))),
    h('div', { class: 'sheet-cta home-actions' },
      button(t('game.homeConfirm'), { variant: 'primary', size: 'lg', 'data-action': 'home-confirm', onClick: () => { haptic('tap'); layer.close('home'); } }),
      button(t('game.homeStay'), { variant: 'secondary', 'data-action': 'home-stay', 'data-autofocus': '', onClick: () => layer.close(null) })));
  layer = openLayer(content, { kind: 'sheet', label: t('game.homeTitle'), dismissable: true, cls: 'layer-home' });
  return layer.closed.then((v) => v ?? null);
}

/** A player ran out of road in a hot-seat match; the others carry on. */
export function playerOutModal({ name, color }) {
  return cardShell({
    type: 'expense', art: 'expense', chip: t('square.expense'), title: t('game.outTitle', { name }), text: t('game.outText'),
    body: [h('div', { class: 'banner banner-info' }, playerToken(color), h('span', null, name))],
    actions: [{ id: 'ok', label: t('game.continue'), variant: 'primary', value: { action: 'ok' }, autofocus: true }], flip: false,
  });
}
