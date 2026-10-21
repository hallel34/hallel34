// Card modals and dialogs. Each function returns a Promise with the player's choice.
// They never mutate game state; the play controller applies the result via the engine.
import { h } from './dom.js';
import { t, tp } from '../i18n/index.js';
import { openLayer, closeButton } from './modal.js';
import { icon } from './icons.js';
import { cornerPop, foxImg } from './fox.js';
import { playerToken, withName } from './players.js';
import { hintStrip, showRing } from './hint-ui.js';
import { CARD_REACTION } from './fox-rules.js';
import { money, moneyText, tn, numberText, signedMoney } from './format.js';
import { createTermScope, termButton } from './rich.js';
import { realWorldForCard, realWorldForPlace } from './realworld.js';
import { learnContent, conceptById } from '../learn/content.js';
import { revealModel, resultModel, stockNoteModel } from '../learn/guess.js';
import { pctText, yearsPhrase, yearsValue } from '../learn/slots.js';
import { button, stepper, statTile } from './widgets.js';
import { haptic, countUp, shake } from './fx.js';
import {
  monthlyCashFlow, passiveIncome, maxLoan, loanLimits, saleValue, canSell, loanPaydayImpact,
  paybackTier, PAYDAY_MONTHS, purchasePlan, loanTerms, dealMetrics,
} from '../engine/index.js';
import { LOAN_STEP } from '../engine/index.js';

const BANNERS = import.meta.glob('../assets/card-*.svg', { eager: true, query: '?url', import: 'default' });
const bannerUrl = (type) => BANNERS[`../assets/card-${type}.svg`] || BANNERS['../assets/card-opportunity.svg'];

// ---------- generic cream card ----------
/**
 * `ctl` (optional) is filled with handles for cards that change after they open (the 'עסקה טובה?' guess):
 * ctl.body (the scrolling area), ctl.setActions(list), ctl.setFoot(node|null), ctl.layer.
 * An action with `run` does something and keeps the card open (the guess buttons); the others close it with their value.
 */
function cardShell({ type, art, chip, title, text, body = [], actions, flip = false, label, data = {}, foot = null, ctl = null }) {
  let layer;
  const done = (v) => layer.close(v);
  const bar = h('div', { class: 'card-actions' });
  const makeButton = (a) => {
    const b = button(a.label, {
      variant: a.variant, disabled: a.disabled, cls: `${a.cls || ''}${a.blocked ? ' is-blocked' : ''}`.trim(),
      'data-action': a.id, 'data-autofocus': a.autofocus ? '' : null,
      // A blocked action stays focusable and readable (aria-disabled + reason), but never does anything.
      'aria-disabled': a.blocked ? 'true' : null, 'aria-describedby': a.describedBy || null,
      onClick: () => {
        if (a.blocked) { haptic('error'); shake(b); return; }
        haptic('tap');
        if (a.run) { a.run(); return; }
        done(a.getValue ? a.getValue() : a.value);
      },
    });
    return b;
  };
  const paintBar = (list) => {
    bar.className = `card-actions${list.length === 1 ? ' single' : ''}`;
    bar.replaceChildren(...list.map(makeButton));
  };
  paintBar(actions);
  const footWrap = h('div', { class: 'card-foot' }, foot, bar);
  const cardBody = h('div', { class: 'card-body', tabindex: '0', role: 'region', 'aria-label': title },
    h('div', { class: 'card-titles' }, h('h2', { class: 'card-title' }, title), text ? h('p', { class: 'card-text' }, text) : null),
    body);
  const content = h('div', { class: 'card', 'data-card': type, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) },
    h('div', { class: `card-head card-head--${type}` },
      h('img', { class: 'card-banner', src: bannerUrl(type), alt: '', width: 320, height: 140, decoding: 'async', draggable: 'false' }),
      h('span', { class: 'card-chip' }, chip),
      // The fox reacts once the flip has landed (+150ms); never over the title or the numbers grid.
      cornerPop(CARD_REACTION[type] || 'think', { size: 64, delay: (flip ? 400 : 0) + 150 })),
    cardBody,
    // the reason / next step for the primary action sits right above the buttons, so it never scrolls out of view
    footWrap);
  layer = openLayer(content, { kind: 'modal', label: label || title, dismissable: false, cardFlip: flip, cls: 'layer-card' });
  if (ctl) {
    ctl.layer = layer;
    ctl.card = content;
    ctl.body = cardBody;
    ctl.setActions = (list) => {
      paintBar(list);
      const first = bar.querySelector('[data-autofocus]') || bar.querySelector('button');
      first?.focus?.({ preventScroll: true });
    };
    ctl.setFoot = (node) => { footWrap.replaceChildren(...(node ? [node] : []), bar); };
  }
  return layer.closed;
}

const limitBanner = () => h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('loan.limitHint')));
const grid = (...tiles) => h('div', { class: 'stat-grid' }, tiles);
/**
 * Payback years as the badge shows them: exactly the figure of the reveal (one decimal at most, never crossing a threshold:
 * 8.04y reads 8.1 and amber, 4.9y reads 4.9 and never "5"). One rounding rule for the card, the reveal, the feedback and the report.
 */
export const paybackYearsShown = yearsValue;
function paybackBadge(years, tier, scope) {
  const label = Number.isFinite(years)
    ? tn('card.payback', { years: yearsPhrase(years) }, { scope })
    : tn('card.paybackNever', {}, { scope });
  return h('div', { class: `payback payback-${tier}`, 'data-payback-tier': tier, 'data-tut': 'payback' }, icon(tier === 'ok' ? 'check' : 'expense', { size: 20 }), h('span', null, label));
}
const banner = (node, tone = 'info') => h('div', { class: `banner banner-${tone}` }, icon('star', { size: 26 }), h('span', null, node));
const ltr = (text) => h('bdi', { dir: 'ltr' }, text);

// ---------- 'עסקה טובה?' (L2): prompt, traffic light, verdict ----------
const LIGHT_ICON = { green: 'check', yellow: 'minus', red: 'close' };
const RESULT_ICON = { correct: 'check', wrong: 'minus', yellowAny: 'help', skipped: null };

/** The traffic light: three lamps, the lit one carries an icon shape, and a text label (never colour alone). */
function trafficLight(model) {
  return h('div', { class: `light light-${model.light}`, role: 'img', 'aria-label': model.a11y, 'data-light': model.light },
    h('span', { class: 'light-lamps', 'aria-hidden': 'true' },
      ['red', 'yellow', 'green'].map((c) => h('i', { class: `lamp lamp-${c}${c === model.light ? ' is-on' : ''}` }, c === model.light ? icon(LIGHT_ICON[c], { size: 18, width: 3.6 }) : null))),
    h('span', { class: 'light-label' }, model.label));
}

function guessPrompt(ui, onSkip) {
  return h('section', { class: 'guess-prompt', 'data-guess-block': 'ask' },
    h('h3', { class: 'guess-title' }, ui.title),
    h('p', { class: 'guess-sub' }, ui.subtitle),
    h('p', { class: 'guess-hint' }, ui.hint),
    button(ui.reveal, { variant: 'secondary', size: 'sm', cls: 'guess-skip', 'data-action': 'guess-skip', onClick: onSkip }));
}

/** Result of the guess + light + yield / payback + verdict + 'עין של משקיע' chip (aria-live: read out once when it appears). */
function revealBlock(model, result, eye) {
  const tone = { green: 'income', yellow: 'slow', red: 'expense' }[model.light];
  return h('section', { class: 'reveal', 'data-guess-block': 'reveal', 'data-light': model.light, role: 'status' },
    result.kind !== 'skipped'
      ? h('p', { class: `guess-result guess-${result.kind}`, 'data-result': result.kind },
        RESULT_ICON[result.kind] ? icon(RESULT_ICON[result.kind], { size: 20, width: 3 }) : null, h('span', null, result.text))
      : h('p', { class: 'guess-result guess-skipped', 'data-result': 'skipped' }, h('span', null, result.text)),
    trafficLight(model),
    grid(statTile(termButton('yield', model.yieldLabel), ltr(model.yieldText), { tone, big: true }), statTile(termButton('payback', model.paybackLabel), h('bdi', null, model.paybackText), { tone, big: true })),
    h('p', { class: 'guess-verdict' }, model.verdict),
    h('p', { class: 'guess-legend' }, h('b', null, `${model.legendTitle}: `), model.legend),
    eye && result.kind !== 'skipped'
      ? h('p', { class: `eye-chip${eye.earned ? ' is-earned' : ''}`, 'data-eye': String(eye.streak) }, icon('star', { size: 18, width: 2.8 }), h('span', null, eye.earned ? `${eye.badgeName}. ${eye.text}` : eye.text))
      : null,
    eye?.justEarned ? h('p', { class: 'banner eye-earned', role: 'status', 'data-eye-earned': 'true' }, icon('star', { size: 24 }), h('span', null, eye.earnedText)) : null);
}

/** Stock card: no light, no guess (spec 5.1). Dividend line, volatility, not guaranteed, links to the glossary. */
function stockNote(c) {
  const dividendYield = pctText((c.dividend * 12 / c.price) * 100);
  const m = stockNoteModel(c, { dividendText: moneyText(c.dividend), yieldText: dividendYield });
  return h('section', { class: 'stock-note', 'data-stock-note': c.symbol },
    h('h3', { class: 'guess-title' }, m.title),
    h('p', null, m.dividend),
    h('p', null, m.volatility),
    h('p', null, m.notGuaranteed),
    h('p', { class: 'stock-links' }, termButton('dividend', conceptById('dividend')?.term ?? ''), termButton('diversification', conceptById('diversification')?.term ?? '')));
}

// ---------- opportunity ----------
/**
 * `guess` (family default, full opt-in): { enabled, seed, prior, onGuess(pick, light) -> eye model }.
 * `prior`: the guess already made for this open card (a reload shows the numbers straight away).
 */
export function opportunityModal(state, { flip = true, guess = null, tour = null } = {}) {
  const c = state.pending.card;
  const passive = passiveIncome(state);
  const scope = createTermScope();

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
    scope.add('dividend'); // the stock note below carries the dividend link
    const body = [
      grid(
        statTile(t('card.perShare'), money(c.price)),
        statTile(tn('card.dividend', {}, { scope }), money(c.dividend, { sign: true }), { tone: 'income' }),
      ),
      canBuy ? h('div', { class: 'stepper-wrap' }, h('span', { class: 'stat-label' }, t('card.quantity')), st.el, quick.length ? h('div', { class: 'qty-quick' }, quick) : null) : null,
      canBuy ? grid(
        statTile(t('card.total'), total, { big: true }),
        statTile(t('card.monthlyIncome'), gain, { tone: 'income', big: true })) : null,
      stockNote(c),
      realWorldForCard(c),
    ].filter(Boolean);
    return finishOpportunity({ state, c, body, flip, qtyGetter: () => st.value, plan: purchasePlan(state, c.price), tour: null });
  }

  const m = dealMetrics(c);
  const years = m.years;
  const tier = paybackTier(years);
  const cardNumbers = ({ light = false } = {}) => [
    light ? null : paybackBadge(years, tier, scope),
    grid(
      statTile(tn('card.downPayment', {}, { scope }), money(c.downPayment), { big: true, tut: 'downPayment' }),
      statTile(tn('card.monthlyCashFlow', {}, { scope }), money(c.monthlyCashFlow, { sign: true }), { tone: c.monthlyCashFlow <= 0 || tier === 'bad' ? 'expense' : (tier === 'slow' ? 'slow' : 'income'), big: true, tut: 'monthly' }),
      statTile(tn(c.type === 'business' ? 'card.businessLoan' : 'card.mortgage', {}, { scope }), money(c.mortgage)),
      statTile(t('card.price'), money(c.price)),
    ),
    breakdown(c, scope),
    c.monthlyCashFlow < 0
      ? h('div', { class: 'banner banner-warn' }, icon('expense', { size: 24 }), h('span', null, tn('card.negativeFlow', { amount: money(-c.monthlyCashFlow) })))
      : banner(tn('card.newPassive', { amount: money(passive + c.monthlyCashFlow) }, { scope })),
    realWorldForCard(c),
  ].filter(Boolean);
  const plan = purchasePlan(state, c.downPayment);

  // ---- no guess: the numbers straight away (full mode default) ----
  if (!guess?.enabled) return finishOpportunity({ state, c, body: cardNumbers(), flip, qtyGetter: () => 1, plan, tour });

  // ---- the guess flow (family mode): prompt first, numbers after ----
  const { guess: ui } = learnContent();
  const ctl = {};
  const opts = finishOpportunity({ state, c, body: [], flip, qtyGetter: () => 1, plan, ctl, deferred: true, guessState: 'ask' });
  const reveal = (pick, prior = null) => {
    const eye = prior ? guess.eye?.() : guess.onGuess(pick, m.light);
    const result = resultModel(m.light, pick, { seed: guess.seed });
    const model = revealModel(c, { seed: guess.seed });
    ctl.card.dataset.guess = 'done';
    ctl.card.dataset.light = m.light;
    ctl.body.querySelector('[data-guess-block="ask"]')?.remove();
    ctl.body.append(revealBlock(model, result, eye), ...cardNumbers({ light: true }));
    ctl.setFoot(opts.warn);
    ctl.setActions(opts.normalActions);
    ctl.body.querySelector('[data-guess-block="reveal"]')?.scrollIntoView?.({ block: 'nearest' });
  };
  if (guess.prior) {
    queueMicrotask(() => reveal(guess.prior.guess, guess.prior));
  } else {
    ctl.body.append(guessPrompt(ui.prompt, () => reveal('skip')));
    const introStrip = guess.intro ? hintStrip({ body: guess.intro.body, cls: 'in-card', label: tutLabel() }) : null;
    ctl.setActions([
      { id: 'guess-bad', label: [icon('close', { size: 22, width: 3.4 }), h('span', null, ui.prompt.bad)], variant: 'danger', cls: 'btn-guess', run: () => reveal('bad') },
      { id: 'guess-good', label: [icon('check', { size: 22, width: 3.4 }), h('span', null, ui.prompt.good)], variant: 'buy', cls: 'btn-guess', autofocus: true, run: () => reveal('good') },
    ]);
    ctl.setFoot(introStrip);
  }
  return opts.promise;
}

/** "rent - mortgage = cash flow" (apartments) or "profit - loan payment = cash flow" (businesses), when the card has the fields. */
function breakdown(c, scope) {
  const gross = c.type === 'business' ? c.profit : c.rent;
  if (!Number.isFinite(gross) || !Number.isFinite(c.loanPayment)) return null;
  return h('div', { class: 'calc-line', 'data-calc': c.type },
    h('span', { class: 'stat-label' }, t('card.breakdownTitle')),
    h('p', null, tn(c.type === 'business' ? 'card.profitLine' : 'card.rentLine', {
      gross: money(gross),
      payment: money(c.loanPayment), flow: signedMoney(c.monthlyCashFlow),
    }, { scope })));
}

function finishOpportunity({ state, c, body, flip, qtyGetter, plan, ctl = null, deferred = false, guessState = 'off', tour = null }) {
  // plan.status: 'ok' (cash covers it) | 'loan' (one loan covers the gap) | 'blocked' (short even after the maximum loan)
  const hintId = 'buy-hint';
  const warn = plan.status === 'blocked'
    ? h('div', { class: 'banner banner-warn', role: 'status', id: hintId, 'data-hint': 'blocked' }, icon('bank', { size: 24 }), h('span', null, t('card.noFundsMax'), loanLimits(state).capBinds ? `. ${t('loan.capBlocked', { salaries: numberText(loanLimits(state).capSalaries) })}` : ''))
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
  const tourCtl = tour && !ctl ? {} : null;
  const tourUi = tour ? createCardTour(tour, () => (ctl ?? tourCtl).card) : null;
  const promise = cardShell({
    type: 'opportunity', art: c.type, chip: `${t('square.opportunity')} · ${t(`type.${c.type}`)}`, title: c.title, text: c.text,
    body, foot: deferred ? null : [tourUi?.strip, warn], actions: deferred ? [] : actions, flip, ctl: ctl ?? tourCtl,
    data: {
      afford: String(plan.status === 'ok'), buy: plan.status, kind: c.type, cost: String(plan.cost),
      payback: c.type === 'stock' ? '' : String(Math.round(c.downPayment / Math.max(1, c.monthlyCashFlow))),
      flow: String(c.type === 'stock' ? c.dividend : c.monthlyCashFlow),
      guess: guessState,
    },
  });
  if (tourUi) { tourUi.start(flip); promise.then(() => tourUi.stop()); }
  return deferred ? { promise, warn, normalActions: actions } : promise;
}

const tutLabel = () => learnContent().tutorial.ui.hintFoxLabel;

/**
 * The first card's 3-step tour (spec section 5): a strip between the numbers and the buttons says what the down payment, the monthly
 * amount and the payback mean, one step at a time ('הבא'), with a gold ring around the number it talks about (never over it).
 */
function createCardTour(tour, getCard) {
  let i = 0;
  let ring = null;
  let timer = 0;
  const paintStep = () => tour.steps[i].body.cloneNode(true);
  const strip = hintStrip({ body: paintStep(), cls: 'in-card is-tour', label: tutLabel(), action: { label: tour.next, onClick: () => advance() } });
  const textEl = strip.querySelector('.hint-text');
  const btn = strip.querySelector('.hint-next');
  const aim = () => {
    const card = getCard();
    const target = tour.steps[i].target ? card?.querySelector(`[data-tut="${tour.steps[i].target}"]`) : null;
    if (!target) { ring?.remove(); ring = null; return; }
    if (ring) ring.move(target, { onCream: true }); else ring = showRing(target, { onCream: true, holdMs: 120000 });
  };
  function advance() {
    haptic('tap');
    if (i >= tour.steps.length - 1) { stop(); strip.remove(); return; }
    i += 1;
    textEl.replaceChildren(paintStep());
    strip.dataset.step = String(i + 1);
    if (i === tour.steps.length - 1) btn.textContent = tour.done;
    aim();
  }
  function stop() { clearTimeout(timer); ring?.remove(); ring = null; }
  strip.dataset.step = '1';
  return {
    strip,
    // the ring waits for the card's flip to land
    start(flip) { timer = setTimeout(aim, flip ? 700 : 250); },
    stop,
  };
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
    h('div', { class: 'banner banner-info' }, icon('charity', { size: 26 }), h('span', null, t(state.daily ? 'charity.boostDaily' : 'charity.boost'))),
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
    realWorldForCard(p.card),
  ].filter(Boolean);
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
    if (held) body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.stockHeld', { shares: tp('plural.sharesOf', held.qty, { symbol: card.symbol }) }))));
  } else if (noMatch) {
    body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.noAsset'))));
  } else if (familyOffer) {
    body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 24 }), h('span', null, t('market.familyNote'))));
  }
  const rw = realWorldForCard(card);
  if (rw) body.push(rw);
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

/** Why the loan limit is what it is, when the 12-salary ceiling on borrowing to buy is the binding one (else null). */
function capNote(state) {
  const lim = loanLimits(state);
  if (!lim.capBinds) return null;
  return h('p', { class: 'limit-cap', 'data-loan': 'cap' }, t('loan.capNote', { salaries: numberText(lim.capSalaries), amount: moneyText(lim.capAmount) }));
}

/** Loan dialog. Resolves with the amount (multiple of 1000) or null. */
export function loanDialog(state, { required = 0, gain = null, hint = null } = {}) {
  const max = maxLoan(state);
  // For a purchase the figures describe the state right AFTER buying: the asset's cash flow is part of the new flow and
  // of the next summary (gain = null: the loan is not for a purchase).
  const purchase = gain != null;
  const cf = monthlyCashFlow(state) + (gain ?? 0);
  const start = max === 0 ? 0 : Math.min(max, Math.max(LOAN_STEP, Math.ceil(required / LOAN_STEP) * LOAN_STEP));
  const voluntary = required <= 0;
  const spend = voluntary ? 0 : state.cash + required; // what the loan is about to pay for

  const amountOut = h('bdi', { class: 'big-amount money', dir: 'ltr' });
  const payOut = h('bdi', { class: 'money', dir: 'ltr' });
  const flowOut = h('bdi', { class: 'money', dir: 'ltr' });
  const barFill = h('div', { class: 'limit-fill' });
  const usedLabel = h('span', { class: 'limit-label' });
  const flowRow = h('div', { class: 'kv', 'data-loan': 'flow' }, h('span', null, t(purchase ? 'loan.newFlowPurchase' : 'loan.newFlow')), flowOut);
  const interestOut = h('bdi', { class: 'money', dir: 'ltr' });
  const totalOut = h('bdi', { class: 'money', dir: 'ltr' });
  const paydayOut = h('bdi', { class: 'money', dir: 'ltr' });
  const paydayRow = h('div', { class: 'kv' }, h('span', null, tn('loan.paydayNext', { months: PAYDAY_MONTHS, amount: paydayOut })));
  const warnText = h('span');
  const warn = h('div', { class: 'banner banner-warn', role: 'status', 'data-risky': 'false', hidden: true }, icon('expense', { size: 24 }), warnText);
  let takeBtn = null;
  let shown = start;
  const scope = createTermScope();
  // first loan window of the first game: the fox says what 'תוספת' means in numbers; it follows the amount on the stepper
  const hintEl = hint ? hintStrip({ body: [], more: [], cls: 'in-loan', label: tutLabel() }) : null;
  const paintHint = (amount) => {
    const v = hint.render(amount);
    hintEl.querySelector('.hint-text').replaceChildren(v.body);
    hintEl.querySelector('.hint-more')?.replaceChildren(v.more);
  };

  // rate and "per 1,000" come from the config through loanTerms; nothing is typed into the copy
  const unit = loanTerms(LOAN_STEP);
  const rateLine = h('p', { class: 'loan-rate', 'data-loan': 'rate' }, tn('loan.rateLine', {
    apr: h('bdi', { dir: 'ltr' }, numberText(unit.aprNominal)), unit: money(LOAN_STEP), unitPay: money(unit.monthly),
  }, { scope }));

  const update = (from, to) => {
    const terms = loanTerms(to);
    const pay = terms.monthly;
    interestOut.textContent = moneyText(terms.perPayday);
    totalOut.textContent = moneyText(terms.totalAtPayday);
    countUp(from, to, (v) => { amountOut.textContent = moneyText(v); }, 300);
    payOut.textContent = moneyText(pay);
    const nf = cf - pay;
    flowOut.textContent = moneyText(nf, { sign: true });
    flowRow.classList.toggle('is-negative', nf < 0);
    const imp = loanPaydayImpact(state, to, spend, gain ?? 0);
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
    if (hintEl) paintHint(to);
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
    ? [h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 24 }), h('span', null, t('loan.limitReached'))), capNote(state)].filter(Boolean)
    : [
      st.el,
      rateLine,
      h('div', { class: 'kv' }, h('span', null, tn('loan.monthlyPayment', { amount: payOut }))),
      h('div', { class: 'kv', 'data-loan': 'interest' }, h('span', null, tn('loan.interestUntil', { months: numberText(PAYDAY_MONTHS) }, { scope })), interestOut),
      h('div', { class: 'kv', 'data-loan': 'total' }, h('span', null, t('loan.totalDue')), totalOut),
      flowRow,
      paydayRow,
      warn,
      h('div', { class: 'limit' }, h('div', { class: 'limit-bar', 'aria-hidden': 'true' }, barFill), h('div', { class: 'limit-row' }, h('span', null, t('loan.limit')), usedLabel),
        capNote(state)),
      realWorldForPlace('loan-window'),
      hintEl,
    ].filter(Boolean);
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
  if (hintEl && st) {
    let ring = null;
    const t0 = setTimeout(() => { const row = d.layer.panel.querySelector('[data-loan="interest"]'); if (row && !d.layer.done) ring = showRing(row, { holdMs: 12000 }); }, 450);
    d.layer.closed.then(() => { clearTimeout(t0); ring?.remove(); });
  }
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
          h('span', { class: 'muted' }, a.type === 'stock' ? t('statement.stockLine', { shares: tp('plural.shares', a.qty) }) : t(`type.${a.type}`)),
          h('span', null, tn('sell.proceeds', { amount: proceeds }))),
        qtyCtl?.el,
        button(t('sell.sell'), { variant: 'primary', size: 'sm', 'data-action': 'sell', onClick: () => {
          const next = onSell(a.id, a.type === 'stock' ? qty : undefined);
          // nothing left to sell in the must-pay flow: close straight away (the loan card is next), no "nothing to sell" flash
          if (next && shouldClose(next)) { layer.close(); return; }
          render();
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
/**
 * Pass-the-phone sheet, ONE tap: "תור של <name>", a short recap of what just happened, and a single primary button
 * 'זרקו קובייה, <name>' that closes the sheet and rolls at once (the caller starts the roll when the promise resolves,
 * which happens on the tap itself, not after the closing animation). Not dismissable. Safe against double taps.
 * recap: { who, lines: [text|Node], fox: text|null } of the turn that just ended, or null (first turn, resume).
 * extra: { body: Node|string, more?: Node|string, pose? } one learning line (a hint, an explainer or a tip) or null.
 * Resolves true on the tap, false when the screen was torn down with the sheet still open.
 */
export function handoffSheet({ name, color, recap = null, extra = null }) {
  let layer;
  let tapped = false;
  let resolveTap;
  const tap = new Promise((r) => { resolveTap = r; });
  const go = button(withName(t('players.rollFor', { name: '{name}' }), name), {
    variant: 'primary', size: 'lg', cls: 'btn-roll-next', 'data-action': 'roll-next', 'data-autofocus': '',
    onClick: () => {
      if (tapped) return; // a second tap on the closing sheet does nothing
      tapped = true;
      go.disabled = true;
      haptic('tap');
      resolveTap(true);
      layer.close(true);
    },
  });
  const recapBlock = recap && (recap.lines?.length || recap.fox)
    ? h('div', { class: 'handoff-recap', 'data-recap': '' },
      h('p', { class: 'hr-title' }, withName(t('players.recapTitle', { name: '{name}' }), recap.who)),
      ...(recap.lines ?? []).map((l) => h('p', { class: 'hr-line' }, l)),
      recap.fox ? h('p', { class: 'hr-fox' }, h('span', { class: 'vh' }, `${t('learn.foxSays')}: `), recap.fox) : null)
    : null;
  const extraBlock = extra ? hintStrip({ body: extra.body, more: extra.more ?? null, pose: extra.pose ?? 'tip', cls: 'in-handoff', label: extra.label }) : null;
  const content = h('div', { class: 'sheet handoff-sheet', 'data-handoff': String(color), 'data-has-recap': String(!!recapBlock) },
    h('div', { class: 'handoff-fox' }, foxImg('roll', { height: 96 })),
    playerToken(color, { cls: 'ptoken-xl' }),
    h('h2', { class: 'dialog-title handoff-title' }, withName(t('players.handoffTitle', { name: '{name}' }), name)),
    h('p', { class: 'dialog-text' }, withName(t('players.handoffText', { name: '{name}' }), name)),
    recapBlock, extraBlock,
    h('div', { class: 'sheet-cta' }, go));
  layer = openLayer(content, { kind: 'sheet', label: t('players.handoffTitle', { name }), dismissable: false, cls: 'layer-handoff' });
  // torn down with the sheet still open (home, debug): nobody tapped
  layer.closed.then(() => resolveTap(false));
  return tap;
}

/** In-page confirm for "back to the start screen" (no native dialogs). Resolves 'home' or null. */
export function homeConfirmSheet({ daily = false } = {}) {
  let layer;
  const content = h('div', { class: 'sheet home-sheet' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('game.homeTitle')),
      h('p', { class: 'dialog-text' }, t('game.homeText'))),
    h('div', { class: 'sheet-cta home-actions' },
      button(t('game.homeConfirm'), { variant: 'primary', size: 'lg', 'data-action': 'home-confirm', onClick: () => { haptic('tap'); layer.close('home'); } }),
      button(t('game.homeStay'), { variant: 'secondary', 'data-action': 'home-stay', 'data-autofocus': '', onClick: () => layer.close(null) }),
      // daily challenge: leaving keeps the game (resume later); giving up is a separate, explicit choice
      daily ? button(t('daily.giveUp'), { variant: 'text', cls: 'btn-giveup', 'data-action': 'daily-giveup', onClick: () => layer.close('giveup') }) : null));
  layer = openLayer(content, { kind: 'sheet', label: t('game.homeTitle'), dismissable: true, cls: 'layer-home' });
  return layer.closed.then((v) => v ?? null);
}

/** Second step of giving up the daily challenge: it uses up today's attempt. Resolves true / false. */
export function giveUpConfirmSheet() {
  let layer;
  const content = h('div', { class: 'sheet home-sheet' },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('daily.giveUpTitle')),
      h('p', { class: 'dialog-text' }, t('daily.giveUpText'))),
    h('div', { class: 'sheet-cta home-actions' },
      button(t('daily.giveUpStay'), { variant: 'primary', size: 'lg', 'data-action': 'giveup-stay', 'data-autofocus': '', onClick: () => layer.close(false) }),
      button(t('daily.giveUpConfirm'), { variant: 'secondary', 'data-action': 'giveup-confirm', onClick: () => { haptic('tap'); layer.close(true); } })));
  layer = openLayer(content, { kind: 'sheet', label: t('daily.giveUpTitle'), dismissable: true, cls: 'layer-home' });
  return layer.closed.then((v) => v === true);
}

/**
 * A player ran out of road in a hot-seat match; the others carry on. Neutral on purpose: not an expense card, no red,
 * no blame. The worried fox is the only art, the player's colour token says who it is.
 */
export function playerOutModal({ name, color }) {
  let layer;
  const content = h('div', { class: 'dialog out-dialog', 'data-out': String(color) },
    h('div', { class: 'fox-pop out-fox', style: '--pop:92px' }, foxImg('worried', { size: 92 })),
    h('div', { class: 'out-who' }, playerToken(color, { cls: 'ptoken-xl' })),
    h('h2', { class: 'dialog-title out-title' }, withName(t('game.outTitle', { name: '{name}' }), name)),
    h('p', { class: 'dialog-text' }, t('game.outText')),
    h('div', { class: 'dialog-actions' }, button(t('game.continue'), { variant: 'primary', size: 'lg', 'data-action': 'ok', 'data-autofocus': '', onClick: () => { haptic('tap'); layer.close({ action: 'ok' }); } })));
  layer = openLayer(content, { kind: 'modal', label: t('game.outTitle', { name }), dismissable: false, cls: 'layer-dialog layer-out' });
  return layer.closed;
}
