// L3: instant fox feedback after a decision (spec section 2). Pure: it maps what changed in the state to
// { group, slots, pose, tone } requests, picks one of the phrasings deterministically (a seeded rotation, never
// Math.random, never the same line twice in a row) and fills the slots.
import { learnOf, diversifyKey, hasShown, assetKinds } from '../engine/learn.js';
import { passiveIncome, totalExpenses } from '../engine/selectors.js';
import { moneyText } from '../ui/format.js';
import { tp } from '../i18n/index.js';
import { yearsPhrase, pctText, loanSlots, fillSlots } from './slots.js';

/** Slots each group's caller provides (the content test checks every text only uses these). */
export const GROUP_SLOTS = {
  'buy.good': ['title', 'years', 'yield', 'monthly'], 'buy.ok': ['title', 'years', 'yield', 'monthly'],
  'buy.bad': ['title', 'years', 'yield', 'monthly'], 'buy.trap': ['title', 'loss'],
  'buy.stock': ['qty', 'symbol', 'shares', 'monthly'], 'buy.diversify': [],
  'pass.goodDeal': ['years', 'yield'], 'pass.neutral': ['years'], 'pass.bad': ['years', 'yield'], 'pass.trap': ['loss'], 'pass.cantAfford': [],
  'loan.sensible': ['amount', 'loanAmount', 'monthlyPayment', 'interest', 'total', 'rate'],
  'loan.costly': ['amount', 'loanAmount', 'monthlyPayment', 'interest', 'total', 'rate'],
  'loan.repaid': ['amount', 'saved'],
  'expense.cushion': ['amount', 'cashLeft'],
  'expense.loan': ['amount', 'loanAmount', 'monthlyPayment', 'interest', 'total', 'rate'],
  'expense.forcedSale': ['amount'],
  'charity.donate': ['amount'], 'charity.skip': ['amount'], baby: ['amount'], 'baby.max': [],
  'market.sold': ['title', 'amount', 'over'], 'market.kept': ['title', 'monthly'],
  'market.priceUp': ['symbol', 'price'], 'market.priceDown': ['symbol', 'price'],
  'market.cashGood': ['amount'], 'market.cashBad': ['amount'],
  win: ['passive', 'expenses'], lose: ['passive', 'expenses'], 'end.neutral': ['passive', 'expenses'],
  'win.fastPayback': [], 'win.diversified': [], 'win.noBankLoan': [],
};

/** Fox reaction crop per group (spec 2: good/cushion/win celebrate, ok and pass think, bad/trap/costly/lose worried, market ponder). */
export function poseOfGroup(group) {
  if (/^market\./.test(group)) return 'ponder';
  if (group === 'buy.good' || group === 'expense.cushion' || group === 'win' || /^win\./.test(group) || group === 'buy.diversify' || group === 'loan.repaid' || group === 'charity.donate') return 'celebrate';
  if (group === 'buy.bad' || group === 'buy.trap' || group === 'loan.costly' || group === 'lose' || group === 'expense.forcedSale') return 'worried';
  return 'think';
}
/** Border tone of the note: 'good' (green deals), 'warn' (the deal is the problem, never the player), else 'neutral'. */
export function toneOfGroup(group) {
  if (['buy.good', 'expense.cushion', 'win', 'win.fastPayback', 'win.diversified', 'win.noBankLoan', 'loan.sensible', 'loan.repaid', 'pass.bad', 'pass.trap'].includes(group)) return 'good';
  if (['buy.bad', 'buy.trap', 'loan.costly', 'lose', 'expense.forcedSale', 'pass.goodDeal'].includes(group)) return 'warn';
  return 'neutral';
}

/** The phrasings of a group for a mode: lines[group][mode], else .all, else .family (spec 2). */
export function linesFor(feedback, group, mode) {
  const g = feedback.lines[group];
  if (!g) return [];
  return g[mode] ?? g.all ?? g.family ?? [];
}

const hash32 = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/**
 * Deterministic rotation: a seeded starting phrasing, then one step per use of the group. Consecutive uses of a group
 * therefore never repeat a line (when it has two or more), and the same seed always gives the same sequence.
 */
export const pickLineIndex = (n, seed, group, counter) => (n <= 1 ? 0 : (hash32(`${seed}|${group}`) + counter) % n);

/** Text of one feedback request, or null when the group has no lines. `counter` = how many times this group was shown before. */
export function renderFeedback(feedback, request, { mode, seed = 0, counter = 0 }) {
  const lines = linesFor(feedback, request.group, mode);
  if (!lines.length) return null;
  const index = pickLineIndex(lines.length, seed, request.group, counter);
  return { ...request, index, template: lines[index], text: fillSlots(lines[index], request.slots) };
}

const req = (group, slots = {}, extra = {}) => ({ group, slots, pose: poseOfGroup(group), tone: toneOfGroup(group), ...extra });

function dealSlots(x) {
  return { title: x.title, years: x.years == null ? '' : yearsPhrase(x.years), yield: x.yieldPct == null ? '' : pctText(x.yieldPct), monthly: moneyText(x.cf), loss: moneyText(Math.abs(x.cf)) };
}

function fromDecision(x, after) {
  if (x.kind === 'buy') {
    if (x.type === 'stock') {
      const out = [req('buy.stock', { qty: String(x.qty), symbol: x.symbol, shares: tp('plural.sharesOf', x.qty, { symbol: x.symbol }), monthly: moneyText(x.cf) })];
      const key = diversifyKey(after);
      if (key && !hasShown(after, key)) out.push(req('buy.diversify', {}, { mark: key }));
      return out;
    }
    const out = [req(`buy.${x.tier}`, dealSlots(x))];
    const key = diversifyKey(after);
    if (key && !hasShown(after, key)) out.push(req('buy.diversify', {}, { mark: key }));
    return out;
  }
  if (x.kind === 'pass') {
    if (x.type === 'stock') return [];
    if (!x.afford && (x.tier === 'good' || x.tier === 'ok')) return [req('pass.cantAfford')];
    const group = { good: 'pass.goodDeal', ok: 'pass.neutral', bad: 'pass.bad', trap: 'pass.trap' }[x.tier];
    return [req(group, dealSlots(x))];
  }
  if (x.kind === 'loan') {
    if (!x.rating) return [];
    return [req(x.rating === 'sensible' ? 'loan.sensible' : 'loan.costly', loanSlots(x.amount))];
  }
  if (x.kind === 'expense') {
    if (x.viaSale) return [req('expense.forcedSale', { amount: moneyText(x.amount) })];
    if (x.viaLoan) return [req('expense.loan', loanSlots(x.loanAmount || x.amount, { amount: x.amount }))];
    return [req('expense.cushion', { amount: moneyText(x.amount), cashLeft: moneyText(after.cash) })];
  }
  return [];
}

/**
 * Feedback requests for what one player action changed: new decisions plus the events of the action
 * (repayment, charity, market offer answered). `before` / `after` are the player's engine states around an engine call.
 */
export function feedbackForChange(before, after) {
  const out = [];
  const fresh = learnOf(after).decisions.slice(learnOf(before).decisions.length);
  // v4 stage 4: a decision card speaks with its own option line (the UI shows it); its buys / repayments add no second note
  if (fresh.some((x) => x.kind === 'decision')) return out;
  for (const x of fresh) out.push(...fromDecision(x, after));
  for (const ev of after.events ?? []) {
    if (ev.type === 'repaid') out.push(req('loan.repaid', { amount: moneyText(ev.amount), saved: moneyText(ev.saved ?? 0) }));
    else if (ev.type === 'donated') out.push(req('charity.donate', { amount: moneyText(ev.cost) }));
    else if (ev.type === 'charityDeclined') out.push(req('charity.skip', { amount: moneyText(ev.cost) }));
  }
  // market offer: accepted (an asset was sold) or kept
  const offer = before.pending?.kind === 'offer' ? before.pending : null;
  if (offer && !after.pending) {
    const asset = before.assets.find((a) => a.id === offer.assetId);
    const sold = (after.events ?? []).some((e) => e.type === 'sold' && e.assetId === offer.assetId);
    if (asset && sold) {
      out.push(req('market.sold', { title: asset.title, amount: moneyText(offer.offerPrice), over: pctText(Math.round((offer.card.offerPct - 1) * 100)) }));
    } else if (asset) out.push(req('market.kept', { title: asset.title, monthly: moneyText(asset.monthlyCashFlow) }));
  }
  return out;
}

/** Feedback for one event of a roll: an expense paid from cash, a baby, a market card. `priorPrice`: the stock's price before. */
export function feedbackForEvent(ev, state, { priorPrice = null } = {}) {
  if (ev.type === 'expensePaid') return [req('expense.cushion', { amount: moneyText(ev.amount), cashLeft: moneyText(state.cash) })];
  if (ev.type === 'baby') return [req('baby', { amount: moneyText(ev.extra) })];
  if (ev.type === 'babyMax') return [req('baby.max')];
  if (ev.type === 'market') {
    const c = ev.card;
    if (c.effect === 'cash') return [req(c.amount >= 0 ? 'market.cashGood' : 'market.cashBad', { amount: moneyText(Math.abs(c.amount)) })];
    if (c.effect === 'stockPrice' && priorPrice != null && c.newPrice !== priorPrice) {
      return [req(c.newPrice > priorPrice ? 'market.priceUp' : 'market.priceDown', { symbol: c.symbol, price: moneyText(c.newPrice) })];
    }
  }
  return [];
}

/**
 * Feedback line of the end screens. 'win' only for a player who reached financial freedom, 'lose' only for a player who is
 * actually out of the game; a player who did not win but is still in (the round ended because someone else won) gets the
 * neutral 'end.neutral' line, which never says the cash ran out.
 */
export const feedbackForEnd = (state) => req(
  state.status === 'won' ? 'win' : state.status === 'lost' ? 'lose' : 'end.neutral',
  { passive: moneyText(passiveIncome(state)), expenses: moneyText(totalExpenses(state)) },
);

/**
 * The optional second line of a win: ONE claim that is true for this game (a fast-payback deal was bought, the assets are of
 * two or more kinds, no bank loan was taken). The plain 'win' lines make no such claim, so nothing here can be untrue.
 * Returns null when no claim holds.
 */
export function feedbackForWinExtra(state) {
  if (state.status !== 'won') return null;
  const decisions = learnOf(state).decisions;
  const fast = decisions.some((x) => x.kind === 'buy' && x.tier === 'good');
  const diversified = assetKinds(state).length >= 2;
  const noLoan = (state.stats?.loansTaken ?? 0) === 0;
  const group = fast ? 'win.fastPayback' : noLoan ? 'win.noBankLoan' : diversified ? 'win.diversified' : null;
  return group ? req(group) : null;
}
