// Card modals and dialogs. Each function returns a Promise with the player's choice.
// They never mutate game state; the play controller applies the result via the engine.
import { h, html } from './dom.js';
import { t, tp } from '../i18n/index.js';
import { openLayer, closeButton } from './modal.js';
import { icon } from './icons.js';
import { foxImg } from './fox.js';
import { playerToken, withName } from './players.js';
import { hintStrip, showRing } from './hint-ui.js';
import { money, moneyText, moneyIsolated, setMoney, tn, numberText, signedMoney } from './format.js';
import { createTermScope, termButton } from './rich.js';
import { realWorldForCard, realWorldForPlace } from './realworld.js';
import { learnContent, conceptById } from '../learn/content.js';
import { getLearnMode } from '../learn/context.js';
import { revealModel, resultModel, stockNoteModel } from '../learn/guess.js';
import { pctText, yearsPhrase, yearsValue } from '../learn/slots.js';
import { button, stepper, statTile, arm } from './widgets.js';
import { haptic, countUp } from './fx.js';
import { categoryOf, categoryChip, categoryIcon } from './categories.js';
import {
  monthlyCashFlow, passiveIncome, maxLoan, loanCap, loanLimits, saleValue, canSell, loanPaydayImpact,
  paybackTier, PAYDAY_MONTHS, MONTHS_PER_YEAR, purchasePlan, loanTerms, dealMetrics, balanceSheet, assetLoanPayment, loanRateNow,
} from '../engine/index.js';
import { LOAN_STEP, TIMED_EFFECT_KINDS as TIMED_EFFECTS } from '../engine/index.js';
import { cardTitle, cardText, assetTitle } from './card-view.js';
import hourglassSvg from '../assets/verdict/hourglass.svg?raw';
import { tileLabelChip } from './tiles.js';
import { dealBadge, dealBadgeModel, TIER_LETTER } from './deal-badge.js';
import { toggleRow } from './settings.js';

// ---------- generic cream card ----------
/**
 * The deal card shell (spec 3.2): a 3px ribbon on the top edge, a 40px header row (category chip + label + kind), the title and text,
 * the scrolling body, and a footer OUTSIDE the scroller (banner + actions) so the primary is always visible. No banner art, no fox.
 * `ctl` (optional) is filled with handles for cards that change after they open (the 'עסקה טובה?' guess):
 * ctl.body (the scrolling area), ctl.setActions(list), ctl.setFoot(node|null), ctl.layer.
 * An action with `run` does something and keeps the card open (the guess buttons); the others close it with their value.
 * A `blocked` / `disabled` action is a real `disabled` button (the reason is the banner above it).
 */
export function cardShell({ type, kind, headChip, headLabel = null, headVar = null, title, text, body = [], actions, label, data = {}, foot = null, ctl = null }) {
  let layer;
  const done = (v) => layer.close(v);
  const bar = h('div', { class: 'card-actions' });
  const makeButton = (a) => button(a.label, {
    variant: a.variant, disabled: !!(a.disabled || a.blocked), cls: a.cls || '',
    'data-action': a.id, 'data-autofocus': a.autofocus ? '' : null,
    'aria-describedby': a.describedBy || null, 'data-option': a.option ?? null,
    onClick: () => {
      haptic(a.haptic || 'tap');
      if (a.run) { a.run(); return; }
      done(a.getValue ? a.getValue() : a.value);
    },
  });
  const paintBar = (list) => {
    // card button rule: at most two buttons in a row; three or more (decision cards) stack, full width
    bar.className = `card-actions${list.length === 1 ? ' single' : ''}${list.length > 2 ? ' is-stacked' : ''}`;
    bar.replaceChildren(...list.map(makeButton));
  };
  paintBar(actions);
  const footWrap = h('div', { class: 'card-foot' }, foot, bar);
  const cardBody = h('div', { class: 'card-body', tabindex: '0', role: 'region', 'aria-label': title },
    h('div', { class: 'card-titles' }, h('h2', { class: 'card-title' }, title), text ? h('p', { class: 'card-text' }, text) : null),
    body);
  const more = h('span', { class: 'card-more', 'aria-hidden': 'true' }, icon('chevron', { size: 28, width: 2 }));
  // v4 3.3: the tile chip (glyph + full square label, chip colours) first; an opportunity adds its category chip + label next to it
  const header = h('div', { class: 'card-header' },
    tileLabelChip(type === 'payday' ? 'payday' : type, { size: 24, cls: 'card-tile-chip' }),
    headChip,
    headLabel ? h('span', { class: 'card-cat', style: headVar ? `--cat:var(${headVar})` : null }, headLabel) : null,
    kind ? h('span', { class: `card-kind${headLabel ? '' : ' is-first'}` }, kind) : null);
  const content = h('div', { class: 'card', 'data-card': type, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) },
    header,
    h('div', { class: 'card-scroll' }, cardBody, more),
    // the reason / next step for the primary action sits right above the buttons, so it never scrolls out of view
    footWrap);
  // scroll affordance: while more content hides below the fold the card carries data-more (a mask fade + a chevron, see components.css)
  const measure = () => {
    const hidden = cardBody.scrollTop + cardBody.clientHeight < cardBody.scrollHeight - 4;
    if (hidden) content.dataset.more = 'true'; else delete content.dataset.more;
  };
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
  cardBody.addEventListener('scroll', measure, { passive: true });
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(schedule); ro.observe(cardBody); ro.observe(content); }
  if (typeof MutationObserver !== 'undefined') new MutationObserver(schedule).observe(cardBody, { childList: true, subtree: true, characterData: true });
  layer = openLayer(content, { kind: 'modal', label: label || title, dismissable: false, cls: 'layer-card' });
  layer.closed.then(() => cancelAnimationFrame(frame));
  schedule();
  if (ctl) {
    ctl.layer = layer;
    ctl.card = content;
    ctl.body = cardBody;
    ctl.setActions = (list) => {
      paintBar(list);
      const first = bar.querySelector('[data-autofocus]:not([disabled])') || bar.querySelector('button:not([disabled])');
      first?.focus?.({ preventScroll: true });
    };
    ctl.setFoot = (node) => { footWrap.replaceChildren(...(node ? [node] : []), bar); };
  }
  return layer.closed;
}

/** v4: the non-opportunity cards carry only the tile chip (cardShell draws it from the card type); no second glyph. */
const tileChip = () => null;

const limitBanner = () => h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, t('loan.limitHint')));
/** The key numbers (spec 3.2): one white tile, a hairline between the two figures. v4 8.2: the first figure is the hero (36/900, the amount that changes this turn), the others are keys (22/900). */
const keyNumbers = (...tiles) => h('div', { class: `key-numbers is-hero${tiles.length === 1 ? ' single' : ''}`, 'data-key-numbers': '' }, tiles);
// fit-text floors: the hero never drops under 28px (36 x .78), a key never under 18px (22 x .82), so the hero stays >= 1.3x the key
const HERO_MIN = 0.78;
const KEY_MIN = 0.82;
/** The deal card's key block: the hero row (hero figure + the deal badge at its inline-end), then a 2-up row of keys. */
const dealKeys = (hero, badge, keys) => h('div', { class: 'key-numbers deal-keys', 'data-key-numbers': '' },
  h('div', { class: 'deal-hero', 'data-deal-hero': '' }, hero, badge ? h('div', { class: 'deal-hero-badge' }, badge) : null),
  h('div', { class: `key-row${keys.length === 1 ? ' single' : ''}` }, keys));
const grid = (...tiles) => h('div', { class: 'stat-grid' }, tiles);
/**
 * Payback years as the badge shows them: exactly the figure of the reveal (one decimal at most, never crossing a threshold:
 * 8.04y reads 8.1 and amber, 4.9y reads 4.9 and never "5"). One rounding rule for the card, the reveal, the feedback and the report.
 */
export const paybackYearsShown = yearsValue;
const banner = (node, tone = 'info') => h('div', { class: `banner banner-${tone}` }, icon('star', { size: 20 }), h('span', null, node));
const ltr = (text) => h('bdi', { dir: 'ltr' }, text);

// ---------- 'עסקה טובה?' (L2): prompt, verdict pill, metrics ----------
const LIGHT_ICON = { green: 'check', yellow: 'minus', red: 'close' };
const LIGHT_LETTER = { green: TIER_LETTER.ok, yellow: TIER_LETTER.slow, red: TIER_LETTER.bad };
const RESULT_ICON = { correct: 'check', wrong: 'minus', yellowAny: 'help', skipped: null };

/** The verdict pill: icon + text label on a tinted pill (never colour alone). Family 'slow / never' gets the hourglass instead of the cross. */
function verdictPill(model) {
  const slowFamily = model.light === 'red' && getLearnMode() === 'family';
  const glyph = slowFamily ? html(hourglassSvg) : icon(LIGHT_ICON[model.light], { size: 16, width: 2.6 });
  if (slowFamily) { glyph.removeAttribute('width'); glyph.removeAttribute('height'); glyph.setAttribute('aria-hidden', 'true'); glyph.setAttribute('focusable', 'false'); }
  // (class names `light` / `lamp` / `light-label` kept from the v2 traffic light: the pill IS the light indicator now)
  // v4 8.3: the A/B/C deal badge replaces the pill's leading icon (same tier, one display): letter square + the tier glyph
  const letter = LIGHT_LETTER[model.light];
  return h('div', { class: `light verdict verdict-${model.light}`, role: 'img', 'aria-label': model.a11y, 'data-light': model.light, 'data-deal': letter },
    h('i', { class: `lamp lamp-${model.light} is-on deal-badge db-${letter.toLowerCase()}`, 'aria-hidden': 'true' }, h('b', { class: 'db-letter' }, letter), glyph), h('span', { class: 'light-label' }, model.label));
}

function guessPrompt(ui) {
  return h('section', { class: 'guess-prompt', 'data-guess-block': 'ask' },
    h('h3', { class: 'guess-title' }, ui.title),
    h('p', { class: 'guess-sub' }, ui.subtitle),
    h('p', { class: 'guess-hint' }, ui.hint));
}

/** Result of the guess + verdict pill + sentence + yield / payback + legend + 'עין של משקיע' chip (aria-live: read out once when it appears). */
function revealBlock(model, result, eye) {
  return h('section', { class: 'reveal', 'data-guess-block': 'reveal', 'data-light': model.light, role: 'status' },
    result.kind !== 'skipped'
      ? h('p', { class: `guess-result guess-${result.kind}`, 'data-result': result.kind },
        RESULT_ICON[result.kind] ? icon(RESULT_ICON[result.kind], { size: 20, width: 3 }) : null, h('span', null, result.text))
      : h('p', { class: 'guess-result guess-skipped', 'data-result': 'skipped' }, h('span', null, result.text)),
    verdictPill(model),
    h('p', { class: 'guess-verdict' }, model.verdict),
    // two quiet inline metrics (no tinted boxes)
    h('div', { class: 'metrics' },
      statTile(termButton('yield', model.yieldLabel), ltr(model.yieldText)),
      statTile(termButton('payback', model.paybackLabel), h('bdi', null, model.paybackText))),
    h('p', { class: 'guess-legend' }, h('b', null, `${model.legendTitle}: `), model.legend),
    eye && result.kind !== 'skipped'
      ? h('p', { class: `eye-chip${eye.earned ? ' is-earned' : ''}`, 'data-eye': String(eye.streak) }, icon('star', { size: 18, width: 2.8 }), h('span', null, eye.earned ? `${eye.badgeName}. ${eye.text}` : eye.text))
      : null,
    eye?.justEarned ? h('p', { class: 'banner eye-earned', role: 'status', 'data-eye-earned': 'true' }, icon('star', { size: 20 }), h('span', null, eye.earnedText)) : null);
}

/** Stock card: no verdict, no guess (spec 5.1). Dividend line, volatility, not guaranteed, links to the glossary. */
function stockNote(c) {
  const dividendYield = pctText((c.dividend * 12 / c.price) * 100);
  const m = stockNoteModel(c, { dividendText: moneyIsolated(c.dividend), yieldText: dividendYield });
  return h('section', { class: 'stock-note', 'data-stock-note': c.symbol },
    h('h3', { class: 'guess-title' }, m.title),
    h('p', null, m.dividend),
    h('p', null, m.volatility),
    h('p', null, m.notGuaranteed),
    h('p', { class: 'stock-links' }, termButton('dividend', conceptById('dividend')?.term ?? ''), termButton('diversification', conceptById('diversification')?.term ?? '')));
}

// ---------- opportunity ----------
/** 'down payment + loan = price' as three label/value columns: the debt that comes with the deal stays visible. */
function priceEquation(c, scope) {
  const cell = (cls, label, value) => { const tile = statTile(label, value); tile.classList.add('pe-cell', cls); return tile; };
  return h('div', { class: 'price-eq', 'data-price-eq': '' },
    cell('pe-down', tn('card.downPayment', {}, { scope }), money(c.downPayment)),
    h('span', { class: 'pe-op', 'aria-hidden': 'true' }, '+'),
    cell('pe-debt', tn(c.type === 'business' ? 'card.businessLoan' : 'card.mortgage', {}, { scope }), money(c.mortgage)),
    h('span', { class: 'pe-op', 'aria-hidden': 'true' }, '='),
    cell('pe-price', t('card.price'), money(c.price)));
}

/**
 * `guess` (family default, full opt-in): { enabled, seed, prior, onGuess(pick, light) -> eye model }.
 * `prior`: the guess already made for this open card (a reload shows the numbers straight away).
 * (`flip` is accepted for the callers and ignored: the card fades in, there is no flip any more.)
 */
export function opportunityModal(state, { guess = null, tour = null } = {}) {
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
      setMoney(total, st.value * c.price);
      setMoney(gain, st.value * c.dividend, { sign: true });
    };
    const st = stepper({
      min: 1, max: cap, step: 1, value: 1, render: (q) => String(q), onChange: update,
    });
    const quick = [10, 100].filter((n) => n <= cap).map((n) => h('button', { type: 'button', class: 'chip-btn', onClick: () => st.set(n) }, `×${n}`));
    update();
    scope.add('dividend'); // the stock note below carries the dividend link
    const body = [
      canBuy ? dealKeys(
        statTile(t('deal.dividendMonthly'), gain, { tone: 'income', big: true, caption: t('card.perMonthCaption'), cls: 'stat-hero', minScale: HERO_MIN }),
        dealBadge(c, { mode: state.mode }),
        [statTile(t('deal.cost'), total, { big: true, cls: 'stat-key', minScale: KEY_MIN })]) : h('div', { class: 'deal-badge-row' }, dealBadge(c, { mode: state.mode })),
      canBuy ? h('div', { class: 'stepper-wrap' }, h('span', { class: 'stat-label' }, t('card.quantity')), st.el, quick.length ? h('div', { class: 'qty-quick' }, quick) : null) : null,
      h('div', { class: 'metrics' },
        h('div', { class: 'metric' }, h('span', { class: 'metric-label' }, t('card.perShare')), h('span', { class: 'metric-value' }, money(c.price))),
        h('div', { class: 'metric' }, h('span', { class: 'metric-label' }, tn('card.dividend', {}, { scope })), h('span', { class: 'metric-value' }, money(c.dividend, { sign: true })))),
      stockNote(c),
      realWorldForCard(c),
    ].filter(Boolean);
    return finishOpportunity({ state, c, body, qtyGetter: () => st.value, plan: purchasePlan(state, c.price), tour: null, tier: dealBadgeModel(c)?.tier ?? 'speculative' });
  }

  const m = dealMetrics(c);
  const years = m.years;
  const tier = paybackTier(years);
  // the card's numbers, split so the reveal can slot the verdict between the key numbers and the quiet details
  const cardNumbers = () => {
    const flowTone = c.monthlyCashFlow <= 0 || tier === 'bad' ? 'expense' : (tier === 'slow' ? 'slow' : 'income');
    // v4 8.2: the monthly cash flow is the hero (36/900, full width, the A/B/C badge at its inline-end); down payment and payback
    // are the 22/900 second row; everything else is quiet (16px or smaller)
    const paybackText = Number.isFinite(years) ? yearsPhrase(years) : t('deal.paybackNever');
    const paybackTile = statTile(t('deal.payback'), h('bdi', null, paybackText), { big: true, tut: 'payback', cls: 'stat-key', minScale: KEY_MIN });
    paybackTile.dataset.paybackTier = tier;
    const key = dealKeys(
      statTile(t('card.monthlyCashFlow'), money(c.monthlyCashFlow, { sign: true }), { tone: flowTone, big: true, tut: 'monthly', caption: t('card.perMonthCaption'), cls: 'stat-hero', minScale: HERO_MIN }),
      dealBadge(c, { mode: state.mode }),
      [statTile(t('card.downPayment'), money(c.downPayment), { big: true, tut: 'downPayment', cls: 'stat-key', minScale: KEY_MIN }), paybackTile]);
    const debt = balanceSheet(state).liabilitiesTotal + c.mortgage + (plan.status === 'loan' ? plan.need : 0);
    const quiet = [
      priceEquation(c, scope),
      h('p', { class: 'debt-after', 'data-debt-after': String(debt) }, tn('card.debtAfter', { debt: money(debt) })),
      breakdown(c, scope),
      c.monthlyCashFlow < 0
        ? h('div', { class: 'banner banner-warn' }, icon('expense', { size: 20 }), h('span', null, tn('card.negativeFlow', { amount: money(-c.monthlyCashFlow) })))
        : banner(tn('card.newPassive', { amount: money(passive + c.monthlyCashFlow) }, { scope })),
      realWorldForCard(c),
    ].filter(Boolean);
    return { key, quiet };
  };
  const plan = purchasePlan(state, c.downPayment);

  // ---- no guess: the numbers straight away (full mode default) ----
  if (!guess?.enabled) {
    const n = cardNumbers();
    return finishOpportunity({ state, c, body: [n.key, ...n.quiet], qtyGetter: () => 1, plan, tour, tier });
  }

  // ---- the guess flow (family mode): prompt first, numbers after ----
  const { guess: ui } = learnContent();
  const ctl = {};
  const opts = finishOpportunity({ state, c, body: [], qtyGetter: () => 1, plan, ctl, deferred: true, guessState: 'ask' });
  const reveal = (pick, prior = null) => {
    const eye = prior ? guess.eye?.() : guess.onGuess(pick, m.light);
    const result = resultModel(m.light, pick, { seed: guess.seed });
    const model = revealModel(c, { seed: guess.seed });
    ctl.card.dataset.guess = 'done';
    ctl.card.dataset.light = m.light;
    ctl.card.dataset.tier = tier;
    ctl.body.querySelector('[data-guess-block="ask"]')?.remove();
    const n = cardNumbers({ light: true });
    ctl.body.append(n.key, revealBlock(model, result, eye), ...n.quiet);
    ctl.setFoot(opts.warn);
    ctl.setActions(opts.normalActions);
    // v4: the hero row (cash flow + the A/B/C badge, the answer) is what the player reads first, so the card shows it from its top
    // edge (or from the intro strip above it), never cut half under the header; the reveal text follows below
    const top = ctl.body.querySelector('.hint-strip') ?? n.key;
    const delta = top.getBoundingClientRect().top - ctl.body.getBoundingClientRect().top;
    ctl.body.scrollTop = Math.max(0, ctl.body.scrollTop + delta - 4);
  };
  if (guess.prior) {
    queueMicrotask(() => reveal(guess.prior.guess, guess.prior));
  } else {
    // the intro strip scrolls with the card (above the question), so it never sits over the guess buttons
    const introStrip = guess.intro ? hintStrip({ body: guess.intro.body, cls: 'in-card in-body', label: tutLabel() }) : null;
    ctl.body.append(...(introStrip ? [introStrip] : []), guessPrompt(ui.prompt));
    // two EQUAL ghost buttons (no red / green / gold): the guess is a choice, not the next step. 'Show me the numbers' is a text button above them.
    ctl.setActions([
      { id: 'guess-bad', label: [icon('close', { size: 22, width: 3 }), h('span', null, ui.prompt.bad)], variant: 'secondary', cls: 'btn-guess', run: () => reveal('bad') },
      { id: 'guess-good', label: [icon('check', { size: 22, width: 3 }), h('span', null, ui.prompt.good)], variant: 'secondary', cls: 'btn-guess', autofocus: true, run: () => reveal('good') },
    ]);
    ctl.setFoot(button(ui.prompt.reveal, { variant: 'text', cls: 'guess-skip', 'data-action': 'guess-skip', onClick: () => { haptic('tap'); reveal('skip'); } }));
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

function finishOpportunity({ state, c, body, qtyGetter, plan, ctl = null, deferred = false, guessState = 'off', tour = null, tier = null }) {
  // plan.status: 'ok' (cash covers it) | 'loan' (one loan covers the gap) | 'blocked' (short even after the maximum loan)
  const hintId = 'buy-hint';
  const cap = loanCap(state);
  // family safety net: the loan this deal needs would make the month end in minus, so Buy is "לא זמין" and מקסי says why
  const net = plan.status === 'blocked' && loanLimits(state).netBinds;
  const warn = net
    ? h('div', { class: 'banner banner-warn banner-fox', role: 'status', id: hintId, 'data-hint': 'family-net' }, foxImg('worried', { size: 32 }), h('span', null, t('card.familyNet')))
    : plan.status === 'blocked'
    ? h('div', { class: 'banner banner-warn', role: 'status', id: hintId, 'data-hint': 'blocked' }, icon('bank', { size: 20 }),
      h('span', null, t('card.noFundsMax'), cap.capBinds ? [' ', tn('loan.capBlocked', { salaries: ltr(numberText(cap.salaries)) })] : ''))
    : plan.status === 'loan'
      ? h('div', { class: 'banner banner-warn', role: 'status', id: hintId, 'data-hint': 'loan' }, icon('bank', { size: 20 }), h('span', null, tn('card.needLoan', { amount: money(plan.need) })))
      : null;
  const actions = [
    { id: 'pass', label: t('card.pass'), variant: 'secondary', value: { action: 'pass' } },
    {
      // 'blocked' = a real `disabled` (50%); the banner above says why and 'pass' stays the one live action
      id: 'buy', label: plan.status === 'blocked' ? [h('span', null, t('card.buy')), h('span', { class: 'btn-tag' }, t('card.unavailable'))] : t('card.buy'), variant: 'primary', autofocus: plan.status !== 'blocked', haptic: 'purchase',
      blocked: plan.status === 'blocked', describedBy: warn ? hintId : null,
      getValue: () => (plan.status === 'loan'
        ? { action: 'buyLoan', qty: qtyGetter(), need: plan.need }
        : { action: 'buy', qty: qtyGetter() }),
    },
  ];
  const tourCtl = tour && !ctl ? {} : null;
  const tourUi = tour ? createCardTour(tour, () => (ctl ?? tourCtl).card) : null;
  const cat = categoryOf(c);
  const promise = cardShell({
    type: 'opportunity', kind: null, headChip: categoryChip(c, { size: 40, on: 'cream' }), headLabel: cat.label, headVar: cat.neutral ? '--card-muted' : cat.inkVar,
    title: cardTitle(c, state.mode), text: cardText(c, state.mode),
    body, foot: deferred ? null : [tourUi?.strip, warn], actions: deferred ? [] : actions, ctl: ctl ?? tourCtl,
    data: {
      afford: String(plan.status === 'ok'), buy: plan.status, kind: c.type, cost: String(plan.cost), category: cat.id,
      payback: c.type === 'stock' ? '' : String(Math.round(c.downPayment / Math.max(1, c.monthlyCashFlow))),
      flow: String(c.type === 'stock' ? c.dividend : c.monthlyCashFlow),
      guess: guessState,
      // the badge tier drives the ribbon (badge fill); empty while the guess hides the numbers
      tier: tier ?? '',
    },
  });
  if (tourUi) { (ctl ?? tourCtl).card?.classList.add('has-tour'); tourUi.start(); promise.then(() => tourUi.stop()); }
  return deferred ? { promise, warn, normalActions: actions } : promise;
}

const tutLabel = () => learnContent().tutorial.ui.hintFoxLabel;
const tutLabelHome = () => ({ link: learnContent().tutorial.ui.handoffHomeLink });

/**
 * The first card's 3-step tour (spec section 5): a strip between the numbers and the buttons says what the down payment, the monthly
 * amount and the payback mean, one step at a time ('הבא'), with a ring around the number it talks about (never over it).
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
    const want = tour.steps[i].target;
    // 'hud-cash' = the step about where the first payment comes from: the ring goes on the cash in the HUD (behind the card), not on the card
    const outside = want === 'hud-cash';
    let target = outside ? document.querySelector('.hud-cash') : want ? card?.querySelector(`[data-tut="${want}"]`) : null;
    // the HUD is usually under the card and its scrim: a ring on something the player cannot see is noise, so the step then has no ring (the strip says it)
    if (outside && target) {
      const r = target.getBoundingClientRect();
      const hit = r.width && r.height ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      if (!hit || !target.contains(hit)) target = null;
    }
    if (!target) { ring?.remove(); ring = null; return; }
    if (ring) ring.move(target, { onCream: !outside }); else ring = showRing(target, { onCream: !outside, holdMs: 120000 });
  };
  function advance() {
    haptic('tap');
    if (i >= tour.steps.length - 1) { stop(); getCard()?.classList.remove('has-tour'); strip.remove(); return; }
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
    // the ring waits for the card's fade-in to land
    start() { timer = setTimeout(aim, 400); },
    stop,
  };
}

// ---------- expense (paid or must-pay) ----------
export function expenseModal(state, { card, amount, paid }) {
  const short = !paid ? amount - state.cash : 0;
  const body = [
    keyNumbers(
      statTile(t('card.amount'), money(-amount), { tone: 'expense', big: true }),
      statTile(t('card.cashNow'), money(paid ? state.cash + amount : state.cash), { big: true })),
    paid
      ? h('div', { class: 'banner banner-info' }, icon('check', { size: 20 }), h('span', null, t('card.alreadyPaid')))
      : h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, tn('card.expenseDue', { amount: money(short) }))),
  ];
  const actions = paid
    ? [{ id: 'pay', label: t('card.pay'), variant: 'primary', value: { action: 'ok' }, autofocus: true }]
    : [
      ...(canSell(state) ? [{ id: 'sell', label: t('card.sellAsset'), variant: 'secondary', value: { action: 'sell' } }] : []),
      { id: 'loan', label: t('card.getLoan'), variant: 'primary', value: { action: 'loan' }, disabled: maxLoan(state) === 0, autofocus: maxLoan(state) > 0 },
    ];
  if (!paid && maxLoan(state) === 0) body.push(limitBanner());
  return cardShell({ type: 'expense', kind: null, headChip: tileChip('expense'), title: cardTitle(card, state.mode), text: cardText(card, state.mode), body, actions });
}

export function shortfallModal(state) {
  const short = -state.cash;
  const body = [
    keyNumbers(statTile(t('card.cashNow'), money(state.cash), { tone: 'expense', big: true })),
    h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, tn('card.shortfallText', { amount: money(short) }))),
  ];
  const actions = [
    ...(canSell(state) ? [{ id: 'sell', label: t('card.sellAsset'), variant: 'secondary', value: { action: 'sell' } }] : []),
    { id: 'loan', label: t('card.getLoan'), variant: 'primary', value: { action: 'loan' }, disabled: maxLoan(state) === 0, autofocus: maxLoan(state) > 0 },
  ];
  if (maxLoan(state) === 0) body.push(limitBanner());
  return cardShell({ type: 'expense', kind: null, headChip: tileChip('expense'), title: t('card.shortfallTitle'), text: '', body, actions });
}

// ---------- charity ----------
export function charityModal(state) {
  const cost = state.pending.cost;
  const afford = state.cash >= cost;
  const body = [
    keyNumbers(statTile(t('charity.cost'), money(cost), { big: true }), statTile(t('card.cashNow'), money(state.cash), { big: true })),
    h('div', { class: 'banner banner-info' }, icon('charity', { size: 20 }), h('span', null, t(state.daily ? 'charity.boostDaily' : 'charity.boost'))),
    afford ? null : h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, tn('card.notEnough', { amount: money(cost - state.cash) }))),
  ];
  return cardShell({
    type: 'charity', kind: null, headChip: tileChip('charity'), title: t('charity.title'),
    text: tn('charity.text', { amount: money(cost) }), body,
    actions: [
      { id: 'skip', label: t('charity.skip'), variant: 'secondary', value: { action: 'skip' } },
      { id: 'donate', label: t('charity.donate'), variant: 'primary', disabled: !afford, value: { action: 'donate' }, autofocus: afford },
    ],
  });
}

// ---------- market offer ----------
export function offerModal(state) {
  const p = state.pending;
  const asset = state.assets.find((a) => a.id === p.assetId);
  const body = [
    keyNumbers(
      statTile(t('card.offerPrice'), money(p.offerPrice), { big: true }),
      statTile(t('card.offerProceeds'), money(p.proceeds, { sign: true }), { tone: p.proceeds >= 0 ? 'income' : 'expense', big: true })),
    h('div', { class: 'banner banner-info' }, categoryIcon(asset, { size: 20, on: 'cream' }), h('span', null, t('card.offerFor', { asset: assetTitle(asset, state.mode) }))),
    realWorldForCard(p.card),
  ].filter(Boolean);
  return cardShell({
    type: 'market', kind: null, headChip: tileChip('market'), title: cardTitle(p.card, state.mode), text: cardText(p.card, state.mode), body,
    actions: [
      { id: 'decline', label: t('card.decline'), variant: 'secondary', value: { action: 'decline' } },
      { id: 'accept', label: t('card.accept'), variant: 'primary', value: { action: 'accept' }, autofocus: true },
    ],
  });
}

// ---------- informational cards ----------
const signedPct = (x) => `${x > 0 ? '+' : x < 0 ? '-' : ''}${pctText(Math.abs(x) * 100)}`;

export function marketInfoModal(state, { card, noMatch }) {
  const body = [];
  if (TIMED_EFFECTS.includes(card.effect)) {
    // timed family-market card: what changes, for how long, and the one line it teaches
    const value = card.effect === 'cheapLoan' ? pctText(card.rate * 100) : signedPct(card.pct);
    const good = card.effect === 'cheapLoan' || card.pct > 0;
    body.push(keyNumbers(
      statTile(t(`market.effect.${card.effect}`), ltr(value), { tone: good ? 'income' : 'expense', big: true }),
      statTile(t('market.effect.turns'), tp('plural.turns', card.turns)),
    ));
    if (card.teaches) body.push(banner(h('span', null, h('b', null, `${t('market.teaches')}: `), card.teaches)));
  } else if (card.effect === 'cash') {
    body.push(keyNumbers(statTile(t('card.amount'), money(card.amount, { sign: true }), { tone: card.amount >= 0 ? 'income' : 'expense', big: true })));
  } else if (card.effect === 'stockPrice') {
    body.push(banner(tn('market.stockPrice', { symbol: card.symbol, price: money(card.newPrice) })));
    const held = state.assets.find((a) => a.type === 'stock' && a.symbol === card.symbol);
    if (held) body.push(h('div', { class: 'banner banner-info' }, categoryIcon(held, { size: 20, on: 'cream' }), h('span', null, t('market.stockHeld', { shares: tp('plural.sharesOf', held.qty, { symbol: card.symbol }) }))));
  } else if (noMatch) {
    body.push(h('div', { class: 'banner banner-info' }, icon('market', { size: 20 }), h('span', null, t('market.noAsset'))));
  }
  const rw = realWorldForCard(card);
  if (rw) body.push(rw);
  return cardShell({
    type: 'market', kind: null, headChip: tileChip('market'), title: cardTitle(card, state.mode), text: cardText(card, state.mode), body,
    actions: [{ id: 'ok', label: t('card.ok'), variant: 'primary', value: { action: 'ok' }, autofocus: true }],
  });
}

export function babyModal(state, { max, extra }) {
  const body = max ? [] : [keyNumbers(statTile(t('baby.extra'), money(-extra, { sign: true }), { tone: 'expense', big: true }))];
  return cardShell({
    type: 'baby', kind: null, headChip: tileChip('baby'), title: max ? t('baby.max') : t('baby.title'),
    text: max ? t('baby.maxText') : tn('baby.text', { amount: money(extra) }), body,
    actions: [{ id: 'ok', label: t('card.ok'), variant: 'primary', value: { action: 'ok' }, autofocus: true }],
  });
}

// ---------- dialogs (second level, over cards) ----------
function dialogShell({ title, text, body, actions, label }) {
  let layer;
  const bar = h('div', { class: 'dialog-actions' }, actions.map((a) => button(a.label, {
    variant: a.variant, disabled: a.disabled, 'data-action': a.id, 'data-autofocus': a.autofocus ? '' : null,
    onClick: () => { haptic(a.haptic || 'tap'); layer.close(a.getValue ? a.getValue() : a.value); },
  })));
  const dialog = h('div', { class: 'dialog' },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, title), closeButton(() => layer.close(null))),
    text ? h('p', { class: 'dialog-text' }, text) : null,
    body, bar);
  // no fox crop: the fox teaches on the home / guide / feedback screens, not on money dialogs (spec 5)
  const content = h('div', { class: 'dialog-frame' }, dialog);
  layer = openLayer(content, { kind: 'modal', label: label || title, dismissable: true, cls: 'layer-dialog' });
  return { layer, promise: layer.closed.then((v) => (v === undefined ? null : v)), bar };
}

/** Why the loan limit is what it is, when the 12-salary ceiling on borrowing to buy is the binding one (else null). Same numbers the engine enforces. */
function capNote(state) {
  const cap = loanCap(state);
  if (!cap.capBinds) return null;
  return h('p', { class: 'limit-cap', 'data-loan': 'cap' }, tn('loan.capNote', { salaries: ltr(numberText(cap.salaries)), amount: money(cap.total) }));
}

/** Loan dialog (spec 4.5). Resolves with the amount (multiple of 1000) or null. */
export function loanDialog(state, { required = 0, gain = null, hint = null } = {}) {
  const cap = loanCap(state);
  const max = cap.limit; // the one shared selector: the limit shown here is exactly what takeLoan() enforces
  // For a purchase the figures describe the state right AFTER buying: the asset's cash flow is part of the new flow and
  // of the next summary (gain = null: the loan is not for a purchase).
  const purchase = gain != null;
  const cf = monthlyCashFlow(state) + (gain ?? 0);
  const start = max === 0 ? 0 : Math.min(max, Math.max(LOAN_STEP, Math.ceil(required / LOAN_STEP) * LOAN_STEP));
  const voluntary = required <= 0;
  const spend = voluntary ? 0 : state.cash + required; // what the loan is about to pay for
  const rate = loanRateNow(state); // the cheap-loan card halves it for a few turns; the dialog shows what takeLoan() will charge
  const unit = loanTerms(LOAN_STEP, rate);

  const amountOut = h('bdi', { class: 'big-amount money', dir: 'ltr' });
  const payOut = h('bdi', { class: 'money', dir: 'ltr' });
  const rateOut = h('bdi', { class: 'money', dir: 'ltr' }, `${numberText(unit.aprNominal)}%`); // the rate is a constant of the config
  const costOut = h('bdi', { class: 'money', dir: 'ltr' });
  const flowOut = h('bdi', { class: 'money', dir: 'ltr' });
  const paydayOut = h('bdi', { class: 'money', dir: 'ltr' });
  const barFill = h('div', { class: 'limit-fill' });
  const limitBar = h('div', { class: 'limit-bar', 'aria-hidden': 'true' }, barFill);
  const usedChosen = h('bdi', { class: 'money', dir: 'ltr' });
  const usedMax = money(max);
  const flowRow = h('div', { class: 'kv', 'data-loan': 'flow' }, h('span', null, t(purchase ? 'loan.newFlowPurchase' : 'loan.newFlow')), flowOut);
  const paydayRow = h('div', { class: 'kv', 'data-loan': 'payday' }, h('span', null, t('loan.nextSummary')), paydayOut);
  const warnAmount = h('bdi', { class: 'money', dir: 'ltr' });
  const warnText = h('span');
  const warn = h('div', { class: 'banner banner-warn', role: 'status', 'data-risky': 'false', hidden: true }, icon('expense', { size: 20 }), warnText);
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

  // the rate and "per 1,000" come from the config through loanTerms; nothing is typed into the copy
  const rateLine = h('p', { class: 'loan-rate', 'data-loan': 'rate' }, tn('loan.rateLine', {
    apr: h('bdi', { dir: 'ltr' }, numberText(unit.aprNominal)), unit: money(LOAN_STEP), unitPay: money(unit.monthly),
  }, { scope }));
  const interestOut = h('bdi', { class: 'money', dir: 'ltr' });
  const totalOut = h('bdi', { class: 'money', dir: 'ltr' });

  const update = (from, to) => {
    const terms = loanTerms(to, rate);
    const pay = terms.monthly;
    setMoney(interestOut, terms.perPayday);
    setMoney(totalOut, terms.totalAtPayday);
    countUp(from, to, (v) => { setMoney(amountOut, v); }, 300);
    setMoney(payOut, pay);
    setMoney(costOut, terms.perYear); // 12 months of payments (interest only: the principal is still owed)
    const nf = cf - pay;
    setMoney(flowOut, nf, { sign: true });
    flowRow.classList.toggle('is-negative', nf < 0);
    flowRow.classList.toggle('is-positive', nf > 0);
    const imp = loanPaydayImpact(state, to, spend, gain ?? 0);
    setMoney(paydayOut, imp.payday, { sign: true });
    paydayRow.classList.toggle('is-negative', imp.payday < 0);
    paydayRow.classList.toggle('is-positive', imp.payday > 0);
    warn.hidden = !imp.risky;
    warn.dataset.risky = String(imp.risky);
    setMoney(warnAmount, -imp.cashAfter);
    warnText.replaceChildren(...(imp.risky ? [tn('loan.paydayWarn', { amount: warnAmount })] : []));
    if (takeBtn) takeBtn.textContent = imp.risky ? t('loan.takeAnyway') : t('loan.take'); // the primary stays gold: only the label changes
    if (hintEl) paintHint(to);
    barFill.style.setProperty('--fill', String(max ? to / max : 0));
    limitBar.dataset.high = String(max > 0 && to / max >= 0.9);
    setMoney(usedChosen, to);
  };

  const st = max === 0 ? null : stepper({
    min: LOAN_STEP, max, step: LOAN_STEP, value: start,
    render: () => amountOut,
    onChange: (v, from) => { shown = v; haptic('tick'); update(from, v); },
    decLabel: t('loan.less'), incLabel: t('loan.more'),
  });
  if (st) update(start, start); else setMoney(amountOut, 0);

  // the details (and their toggle) are filled in below, after the figures (source order follows the screen order)
  const toggleSlot = max === 0 ? null : {};
  const detailsSlot = max === 0 ? null : {};
  const body = max === 0
    ? [h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, t('loan.limitReached'))), capNote(state)].filter(Boolean)
    : [
      st.el,
      h('p', { class: 'loan-step-note' }, tn('loan.stepNote', { step: money(LOAN_STEP) })),
      hintEl, // first loan window: the fox's line sits right under the stepper, above the figures (never below the fold)
      // THE three numbers: the only 20px figures of the dialog
      h('div', { class: 'loan-nums', 'data-loan': 'numbers' },
        h('div', { class: 'loan-num', 'data-num': 'monthly' }, h('span', { class: 'loan-num-label' }, t('loan.numMonthly')), h('span', { class: 'loan-num-value' }, payOut)),
        h('div', { class: 'loan-num', 'data-num': 'rate' }, h('span', { class: 'loan-num-label' }, t('loan.numRate')), h('span', { class: 'loan-num-value' }, rateOut)),
        h('div', { class: 'loan-num', 'data-num': 'cost' }, h('span', { class: 'loan-num-label' }, t('loan.numCost', { months: numberText(MONTHS_PER_YEAR) })), h('span', { class: 'loan-num-value' }, costOut))),
      flowRow,
      paydayRow,
      warn,
      // the limit stays visible (one 8px bar + one line): the number shown is the one the engine enforces (loanCap)
      h('div', { class: 'limit' }, limitBar,
        h('div', { class: 'limit-row' }, h('span', null, t('loan.limit')), h('span', null, tn('loan.limitUsed', { amount: usedChosen, max: usedMax })))),
      toggleSlot,
      detailsSlot,
    ].filter(Boolean);
  // details behind a text toggle: the rate sentence, the 24-month figures, the limit bar, the cap note and the real-world row
  function detailsBlock() {
    return h('div', { class: 'loan-details', id: 'loan-details', hidden: true },
    rateLine,
    h('div', { class: 'kv', 'data-loan': 'interest' }, h('span', null, tn('loan.interestUntil', { months: numberText(PAYDAY_MONTHS) }, { scope })), interestOut),
    h('div', { class: 'kv', 'data-loan': 'total' }, h('span', null, t('loan.totalDue')), totalOut),
    h('p', { class: 'limit-cap', 'data-loan': 'cost-note' }, t('loan.costNote')),
    capNote(state),
    realWorldForPlace('loan-window', { rate }));
  }
  const toggle = max === 0 ? null : button([h('span', { class: 'toggle-label' }, t('loan.detailsShow')), icon('chevron', { size: 20, width: 2.4 })], {
    variant: 'text', cls: 'loan-details-toggle', 'aria-expanded': 'false', 'aria-controls': 'loan-details', 'data-action': 'loan-details',
    onClick: () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.toggle-label').textContent = t(open ? 'loan.detailsHide' : 'loan.detailsShow');
      toggle.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
      details.hidden = !open;
    },
  });
  const details = max === 0 ? null : detailsBlock();
  if (max > 0) { body.splice(body.indexOf(toggleSlot), 1, toggle); body.splice(body.indexOf(detailsSlot), 1, details); }

  const d = dialogShell({
    title: voluntary ? t('loan.titleVoluntary') : t('loan.title'),
    text: voluntary ? tn('loan.textVoluntary', { step: money(LOAN_STEP) }) : tn('loan.text', { amount: money(required) }),
    body,
    actions: [
      { id: 'cancel', label: t('loan.cancel'), variant: 'secondary', value: null },
      ...(max > 0 ? [{ id: 'take', label: t('loan.take'), variant: 'primary', haptic: 'loan', getValue: () => shown, autofocus: true }] : []),
    ],
    label: t('loan.title'),
  });
  takeBtn = d.bar.querySelector('[data-action="take"]');
  if (st) update(start, start);
  if (hintEl && st) {
    let ring = null;
    const t0 = setTimeout(() => { const row = d.layer.panel.querySelector('[data-loan="numbers"]'); if (row && !d.layer.done) ring = showRing(row, { holdMs: 12000, avoid: () => d.bar }); }, 450);
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
    setMoney(out, a);
    const remaining = liability.principal - a;
    setMoney(left, remaining);
    setMoney(payOut, remaining === 0 ? 0 : (liability.monthlyPayment * remaining) / liability.principal);
    inc.disabled = idx >= affordable.length - 1;
    dec.disabled = idx <= 0;
  };
  const dec = h('button', { type: 'button', class: 'step-btn', 'aria-label': t('loan.less'), onClick: () => { idx = Math.max(0, idx - 1); haptic('tick'); show(); } }, icon('minus', { size: 26, width: 3 }));
  const inc = h('button', { type: 'button', class: 'step-btn', 'aria-label': t('loan.more'), onClick: () => { idx = Math.min(affordable.length - 1, idx + 1); haptic('tick'); show(); } }, icon('plus', { size: 26, width: 3 }));
  const body = affordable.length === 0
    ? [h('div', { class: 'banner banner-warn', role: 'status' }, icon('bank', { size: 20 }), h('span', null, tn('card.notEnough', { amount: money(Math.min(LOAN_STEP, liability.principal) - cash) })))]
    : [
      h('div', { class: 'stepper', dir: 'ltr' }, dec, h('output', { class: 'stepper-value' }, out), inc),
      h('div', { class: 'kv' }, h('span', null, t('loan.remaining')), left),
      h('div', { class: 'kv' }, h('span', null, tn('loan.monthlyPayment', { amount: payOut }))),
    ];
  if (affordable.length) show();
  const d = dialogShell({
    title: `${t('loan.repayTitle')} · ${liability.label === 'loan' ? t('statement.loanLabel') : liability.label}`,
    text: tn('loan.repayText', { cash: money(cash) }),
    body,
    actions: [
      { id: 'cancel', label: t('loan.cancel'), variant: 'secondary', value: null },
      { id: 'repay', label: t('loan.repay'), variant: 'primary', disabled: affordable.length === 0, getValue: () => affordable[idx], autofocus: affordable.length > 0 },
    ],
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
      const upd = () => { setMoney(proceeds, a.type === 'stock' ? saleValue(state, a, qty) : saleValue(state, a)); };
      const qtyCtl = a.type === 'stock'
        ? stepper({ min: 1, max: a.qty, step: Math.max(1, Math.round(a.qty / 10)), value: a.qty, render: (q) => String(q), onChange: (v) => { qty = v; upd(); }, decLabel: t('loan.less'), incLabel: t('loan.more') })
        : null;
      upd();
      list.append(h('div', { class: 'sell-row', 'data-asset': a.id },
        h('div', { class: 'sell-head' },
          categoryChip(a, { size: 32, on: 'dark' }),
          h('div', { class: 'sell-info' },
            h('strong', null, assetTitle(a, state.mode)),
            h('span', { class: 'muted' }, a.type === 'stock' ? t('statement.stockLine', { shares: tp('plural.shares', a.qty) }) : categoryOf(a).label),
            h('span', null, tn('sell.proceeds', { amount: proceeds })))),
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
 * 'הטילו קובייה, <name>' that closes the sheet and rolls at once (the caller starts the roll when the promise resolves,
 * which happens on the tap itself, not after the closing animation). Not dismissable. Safe against double taps.
 * recap: { who, lines: [text|Node], fox: text|null } of the turn that just ended, or null (first turn, resume).
 * extra: { body: Node|string, more?: Node|string, pose? } one learning line (a hint, an explainer or a tip) or null.
 * Resolves true on the tap, false when the screen was torn down with the sheet still open.
 */
export const ARM_MS = 700;
export function handoffSheet({ name, color, recap = null, extra = null, onHome = null }) {
  let layer;
  let tapped = false;
  let resolveTap;
  const tap = new Promise((r) => { resolveTap = r; });
  // the buttons are really `disabled` (+ aria-busy + data-arming) for ARM_MS: a quick second tap from the previous card never rolls
  const go = button(h('span', { class: 'btn-label' }, withName(t('players.rollFor', { name: '{name}' }), name)), {
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
    h('div', { class: 'sheet-cta' }, go,
      onHome ? button(tutLabelHome().link, { variant: 'text', cls: 'btn-handoff-home', 'data-action': 'handoff-home', onClick: () => onHome() }) : null));
  const armer = arm([...content.querySelectorAll('.sheet-cta .btn')], ARM_MS); // both buttons: the sweep ends together, then the focus lands on 'roll'
  layer = openLayer(content, { kind: 'sheet', label: t('players.handoffTitle', { name }), dismissable: false, cls: 'layer-handoff' });
  layer.closed.then(() => armer.cancel());
  // torn down with the sheet still open (home, debug): nobody tapped
  layer.closed.then(() => resolveTap(false));
  return tap;
}

/** In-page confirm for "back to the start screen" (no native dialogs). Resolves 'home' or null. */
export function homeConfirmSheet({ daily = false, menu = null } = {}) {
  let layer;
  // board-spec 14.3 (CEO decision): the HUD's one menu button opens this sheet; it also carries the settings link and the
  // sound / vibration switches (the same prefs as the settings dialog). `menu.onSettings` opens the full settings after it closes.
  const quick = menu ? h('div', { class: 'menu-quick', role: 'group', 'aria-label': t('game.menuQuick') },
    toggleRow(t('settings.sound'), 'sound'),
    toggleRow(t('settings.haptics'), 'haptics'),
    button([icon('gear', { size: 22, width: 2.2 }), t('game.settings')], { variant: 'secondary', cls: 'menu-settings', 'data-action': 'settings', onClick: () => layer.close('settings') })) : null;
  const content = h('div', { class: `sheet home-sheet${menu ? ' menu-sheet' : ''}` },
    h('div', { class: 'home-body' },
      h('h2', { class: 'dialog-title' }, t('game.homeTitle')),
      h('p', { class: 'dialog-text' }, t('game.homeText'))),
    quick,
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
