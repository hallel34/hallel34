// Learning layer, pure and serializable (docs/v2/learn/spec.md sections 2, 4, 6, 7). No DOM, no Math.random.
// This module only RECORDS and RATES what the player does; no rule of the game and no bot decision reads it.
// `state.learn` = { decisions[], guesses[], concepts[], shown[] } lives inside every player's engine state, so resume works.
import {
  LOAN_COSTLY_PAYMENT_SHARE, INVESTOR_EYE_STREAK, REPORT_MANY_LOANS, REPORT_MANY_RED, REPORT_NO_DIVERSIFY_ASSETS,
  REPORT_ALL_GOOD_SHARE,
} from './config.js';
import { paybackYears, paybackTier, loanTerms, loanPaydayImpact, monthlyCashFlow } from './selectors.js';

// ---------- deal rating (spec 2) ----------
const TIER_NAME = { ok: 'good', slow: 'ok', bad: 'bad' }; // engine paybackTier -> feedback group name
const LIGHT_OF = { good: 'green', ok: 'yellow', bad: 'red', trap: 'red' };

export const isDeal = (card) => card?.type === 'apartment' || card?.type === 'business';

/**
 * Rating of an apartment / business deal: tier 'good' | 'ok' | 'bad' | 'trap' (cash flow <= 0), the traffic light
 * ('green' | 'yellow' | 'red'), payback years (Infinity when it never pays) and the yearly yield on the down payment in %.
 * Works on a card or an owned asset (needs downPayment and monthlyCashFlow).
 */
export function dealMetrics(card) {
  const cf = card.monthlyCashFlow;
  const down = card.downPayment;
  const years = paybackYears(down, cf);
  const tier = cf <= 0 ? 'trap' : TIER_NAME[paybackTier(years)];
  const yieldPct = down > 0 ? ((cf * 12) / down) * 100 : 0;
  return { cf, down, years, yieldPct, tier, light: LIGHT_OF[tier] };
}

/** Traffic light of a tier name. */
export const lightOfTier = (tier) => LIGHT_OF[tier] ?? null;

// ---------- loan rating (spec 2.2) ----------
/**
 * 'costly' | 'sensible' for a bank loan of `amount`, rated on the state BEFORE the loan is taken.
 *  - to buy an asset (`card` = the apartment / business): costly when the asset does not pay (cash flow <= 0), its deal is
 *    bad/trap, the monthly payment is more than LOAN_COSTLY_PAYMENT_SHARE of the asset's cash flow, or the next summary
 *    would end below zero.
 *  - with no asset (voluntary, `card` = null): costly when the payment is more than that share of the (positive) cash flow
 *    before the loan, the cash flow after it is not positive, or the next summary would end below zero.
 * `spend` is what the loan is about to pay for (the card's down payment), as in loanPaydayImpact.
 */
export function loanRating(s, amount, { card = null, spend = 0 } = {}) {
  const payment = loanTerms(amount).monthly;
  const risky = loanPaydayImpact(s, amount, spend).risky;
  if (card) {
    const m = dealMetrics(card);
    const costly = m.cf <= 0 || m.tier === 'bad' || m.tier === 'trap' || payment > LOAN_COSTLY_PAYMENT_SHARE * m.cf || risky;
    return costly ? 'costly' : 'sensible';
  }
  const cf = monthlyCashFlow(s);
  const costly = cf <= 0 || payment > LOAN_COSTLY_PAYMENT_SHARE * cf || cf - payment <= 0 || risky;
  return costly ? 'costly' : 'sensible';
}

/** Largest principal that stays 'sensible' for a purchase (before the cap and the payday check): share x cash flow / rate. */
export const largestSensibleLoan = (cashFlow, rate) => (LOAN_COSTLY_PAYMENT_SHARE * cashFlow) / rate;

// ---------- the record kept in the state ----------
export const emptyLearn = () => ({ decisions: [], guesses: [], concepts: [], shown: [] });
export const learnOf = (s) => s.learn ?? emptyLearn();

/** Makes sure a state (a clone being edited by an action) has its learn record. */
export function ensureLearn(d) {
  if (!d.learn) d.learn = emptyLearn();
  for (const k of ['decisions', 'guesses', 'concepts', 'shown']) if (!Array.isArray(d.learn[k])) d.learn[k] = [];
  return d.learn;
}

const finite = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

/** Appends one decision (used by the engine inside its own actions). Infinity is stored as null so JSON keeps it. */
export function recordDecision(d, entry) {
  ensureLearn(d).decisions.push({ turn: d.turn, ...entry });
}

/** Decision record of buying `qty` of the pending opportunity card. */
export function buyRecord(card, qty = 1) {
  if (!isDeal(card)) {
    return { kind: 'buy', cardId: card.id, title: card.title, type: 'stock', tier: null, green: null, symbol: card.symbol, qty, cf: qty * card.dividend };
  }
  const m = dealMetrics(card);
  return {
    kind: 'buy', cardId: card.id, title: card.title, type: card.type, tier: m.tier, years: finite(m.years), yieldPct: finite(m.yieldPct),
    cf: m.cf, down: m.down, green: m.tier === 'good',
  };
}

/** Decision record of passing on the pending opportunity card; `cash` is the player's cash at that moment. */
export function passRecord(card, cash) {
  if (!isDeal(card)) return { kind: 'pass', cardId: card.id, title: card.title, type: 'stock', tier: null, green: null, afford: cash >= card.price };
  const m = dealMetrics(card);
  const afford = cash >= card.downPayment;
  // smart pass on a bad / trap deal; a pass on a good deal is not green (unless the cash was not there: then it is not rated);
  // a pass on an 'ok' deal is not rated.
  let green = null;
  if (m.tier === 'bad' || m.tier === 'trap') green = true;
  else if (m.tier === 'good' && afford) green = false;
  return {
    kind: 'pass', cardId: card.id, title: card.title, type: card.type, tier: m.tier, years: finite(m.years), yieldPct: finite(m.yieldPct),
    cf: m.cf, down: m.down, afford, green,
  };
}

// ---------- guesses ('עסקה טובה?', L2) ----------
/** True when the guess matches the light: green -> 'good', red -> 'bad'. Yellow and a skip count for nothing (null). */
export function guessCorrect(light, guess) {
  if (guess === 'skip' || light === 'yellow') return null;
  if (light === 'green') return guess === 'good';
  if (light === 'red') return guess === 'bad';
  return null;
}

/** Current streak of correct guesses: wrong resets it, yellow / skipped entries leave it alone. */
export function investorStreak(guesses) {
  let n = 0;
  for (const g of guesses ?? []) {
    if (g.correct === true) n += 1;
    else if (g.correct === false) n = 0;
  }
  return n;
}

/** The guess already made for this open card (so a reload does not offer a second try), or null. */
export const guessForCard = (s, cardId) => {
  const g = learnOf(s).guesses;
  const last = g[g.length - 1];
  return last && last.cardId === cardId && last.turn === s.turn ? last : null;
};

/** Returns a new state with the guess recorded: { cardId, light, guess: 'good'|'bad'|'skip' }. */
export function recordGuess(s, { cardId, light, guess }) {
  const d = structuredClone(s);
  ensureLearn(d).guesses.push({ turn: d.turn, cardId, light, guess, correct: guessCorrect(light, guess) });
  return d;
}

/** { right, of } over the guesses that were rated (green or red deal, not skipped). */
export function guessTotals(guesses) {
  const rated = (guesses ?? []).filter((g) => g.correct === true || g.correct === false);
  return { right: rated.filter((g) => g.correct).length, of: rated.length };
}

// ---------- concepts and "shown once" flags ----------
export function unlockConcept(s, id) {
  if (learnOf(s).concepts.includes(id)) return s;
  const d = structuredClone(s);
  ensureLearn(d).concepts.push(id);
  return d;
}

export const hasShown = (s, key) => learnOf(s).shown.includes(key);
export function markShown(s, key) {
  if (hasShown(s, key)) return s;
  const d = structuredClone(s);
  ensureLearn(d).shown.push(key);
  return d;
}

/** Kinds of assets owned: 'apartment', 'business' and one 'stock:SYMBOL' per distinct stock. */
export const assetKinds = (s) => [...new Set(s.assets.map((a) => (a.type === 'stock' ? `stock:${a.symbol}` : a.type)))].sort();
/** Key of the current asset mix when it has at least two kinds (diversification), else null. */
export const diversifyKey = (s) => {
  const kinds = assetKinds(s);
  return kinds.length >= 2 ? `diversify:${kinds.join('+')}` : null;
};

// ---------- report (L4, spec 6) ----------
/**
 * Pure aggregation for the 'מה למדתי' report of one player's final state.
 * Concepts and texts are the UI's job; this only counts.
 */
export function buildReport(s) {
  const learn = learnOf(s);
  const decisions = learn.decisions;
  const deals = decisions.filter((x) => x.kind === 'buy' && (x.type === 'apartment' || x.type === 'business'));
  const yearsOf = (x) => (x.years == null ? Infinity : x.years);
  let best = null;
  let worst = null;
  deals.forEach((x, i) => {
    if (!best || yearsOf(x) < yearsOf(deals[best.i])) best = { i };
    if (!worst || yearsOf(x) >= yearsOf(deals[worst.i])) worst = { i };
  });
  const pick = (r) => (r ? deals[r.i] : null);
  let bestDeal = pick(best);
  let worstDeal = pick(worst);
  // a deal that never pays is not "the best"; with a single deal only the best is shown; a worst that is good/ok is "none"
  if (bestDeal && bestDeal.tier === 'trap') bestDeal = null;
  if (deals.length < 2 || (worst && best && worst.i === best.i)) worstDeal = null;
  const worstKind = worstDeal ? (worstDeal.tier === 'trap' ? 'negative' : worstDeal.tier === 'bad' ? 'slow' : null) : null;
  const worstEmpty = deals.length >= 2 && !worstKind;
  if (!worstKind) worstDeal = null;

  const rated = decisions.filter((x) => x.green === true || x.green === false);
  const green = rated.filter((x) => x.green).length;
  const total = rated.length;
  const greenKind = total === 0 ? 'noData' : green === total ? 'all' : green === 0 ? 'none' : 'some';

  const loansTaken = s.stats?.loansTaken ?? 0;
  const interestPaid = s.stats?.interestPaid;
  const salary = s.profession?.salary ?? 0;

  const redBuys = deals.filter((x) => x.tier === 'bad' || x.tier === 'trap').length;
  const noCushion = decisions.some((x) => x.kind === 'expense' && x.viaLoan);
  const kinds = assetKinds(s);
  let tip = 'fallback';
  if ((typeof interestPaid === 'number' && interestPaid > salary) || loansTaken > REPORT_MANY_LOANS) tip = 'highInterest';
  else if (noCushion) tip = 'noCushion';
  else if (redBuys >= REPORT_MANY_RED) tip = 'manyRed';
  else if (s.mode === 'full' && kinds.length === 1 && s.assets.length >= REPORT_NO_DIVERSIFY_ASSETS) tip = 'noDiversify';
  else if (total > 0 && green / total >= REPORT_ALL_GOOD_SHARE) tip = 'allGood';

  return {
    bestDeal, worstDeal, worstKind, worstEmpty, dealCount: deals.length,
    interest: { available: typeof interestPaid === 'number', amount: interestPaid ?? 0, loansTaken, none: loansTaken === 0 },
    green: { green, total, kind: greenKind },
    guesses: guessTotals(learn.guesses),
    concepts: [...learn.concepts],
    tip,
  };
}

/** Which conversation theme (and in which order the others follow) a tip points to. `seed` rotates the order of the rest. */
export function conversationOrder(mode, tip, themes, seed = 0) {
  const byTip = mode === 'full'
    ? { noDiversify: 'invest', manyRed: 'realWorld' }
    : { highInterest: 'borrow', noCushion: 'safety' };
  const first = themes.includes(byTip[tip]) ? byTip[tip] : (mode === 'full' ? 'strategy' : 'flow');
  const rest = themes.filter((x) => x !== first);
  const k = rest.length ? Math.abs(Math.trunc(seed)) % rest.length : 0;
  return [first, ...rest.slice(k), ...rest.slice(0, k)];
}

export const INVESTOR_GOAL = INVESTOR_EYE_STREAK;
