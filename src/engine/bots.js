// Bots used by the balance simulation (and handy for QA / demo mode).
import { maxLoan, monthlyCashFlow, totalExpenses } from './selectors.js';
import { LOAN_STEP, LOAN_PAYMENT_RATE } from './config.js';
import { act, canEndTurn, endTurn } from './match.js';

// reserveMonths: cash buffer (in months of expenses) kept after a purchase.
// maxPayback: reject deals whose down payment takes longer than this many months of cash flow.
export const BOTS = {
  alwaysBuy: { reserveMonths: 0, maxPayback: Infinity, borrow: true, charity: true, acceptOffers: false },
  sensible: { reserveMonths: 0.5, maxPayback: 130, borrow: true, charity: true, acceptOffers: 1.2 },
  cautious: { reserveMonths: 2, maxPayback: 80, borrow: false, charity: true, acceptOffers: 1.15 },
  alwaysPass: { reserveMonths: 0, maxPayback: -1, borrow: false, charity: false, acceptOffers: false },
};

function coverShortfall(engine, s, need) {
  // Take the smallest loan(s) that cover `need` extra cash, if allowed.
  while (need > 0 && maxLoan(s) > 0) {
    const amt = Math.min(maxLoan(s), Math.ceil(need / LOAN_STEP) * LOAN_STEP);
    s = engine.takeLoan(s, amt);
    need -= amt;
  }
  return s;
}

/** Plays one decision. Returns the new state. */
export function step(engine, s, bot) {
  const cfg = BOTS[bot];
  const p = s.pending;
  if (s.phase === 'roll') {
    return engine.roll(s);
  }
  if (p.kind === 'shortfall' || p.kind === 'expense') {
    const need = p.kind === 'expense' ? p.amount - s.cash : -s.cash;
    let n = coverShortfall(engine, s, need);
    if (n === s) {
      // cannot borrow: sell things (full mode)
      for (const a of s.assets) {
        if (n.pending && n.cash < (p.amount ?? 0) && n.mode === 'full') n = engine.sellAsset(n, a.id);
      }
      if (n === s) return engine.takeLoan(s, LOAN_STEP); // will throw if impossible
    }
    return n;
  }
  if (p.kind === 'opportunity') {
    const c = p.card;
    const reserve = cfg.reserveMonths * totalExpenses(s);
    if (c.type === 'stock') {
      const afford = Math.floor((s.cash - reserve) / c.price);
      const qty = Math.min(afford, c.maxQty ?? 1000);
      const stockPayback = c.dividend > 0 ? c.price / c.dividend : Infinity; // months
      return qty >= 1 && stockPayback <= cfg.maxPayback ? engine.buy(s, qty) : engine.pass(s);
    }
    const payback = c.monthlyCashFlow > 0 ? c.downPayment / c.monthlyCashFlow : Infinity;
    if (payback > cfg.maxPayback) return engine.pass(s);
    let n = s;
    if (s.cash - c.downPayment < reserve) {
      if (!cfg.borrow) return engine.pass(s);
      const need = c.downPayment - s.cash;
      if (need > 0) {
        const loanNeeded = Math.ceil(need / LOAN_STEP) * LOAN_STEP;
        // only borrow if the deal still improves cash flow after the loan payment
        if (loanNeeded > maxLoan(s) ||
            c.monthlyCashFlow - loanNeeded * LOAN_PAYMENT_RATE <= 0) return engine.pass(s);
        n = engine.takeLoan(s, loanNeeded);
      }
    }
    return n.cash >= c.downPayment ? engine.buy(n) : engine.pass(n);
  }
  if (p.kind === 'offer') {
    return cfg.acceptOffers && p.card.offerPct >= cfg.acceptOffers
      ? engine.acceptOffer(s) : engine.declineOffer(s);
  }
  if (p.kind === 'charity') {
    const reserve = cfg.reserveMonths * totalExpenses(s);
    return cfg.charity && s.cash - p.cost >= reserve && monthlyCashFlow(s) >= 0
      ? engine.donate(s) : engine.declineCharity(s);
  }
  throw new Error(`bot cannot handle ${p.kind}`);
}

/** Plays a whole game. Returns the final state. */
export function playGame(engine, state, bot, maxTurns = 200) {
  let s = state;
  let guard = 0;
  while (s.status === 'playing' && s.turn < maxTurns && guard++ < 5000) {
    s = step(engine, s, bot);
  }
  return s;
}

/**
 * Plays a whole hot-seat match with one bot policy per player (bots: ['sensible', ...]).
 * Stops at the first winner, when everyone is out, or after `maxTurns` completed turns. Returns the final match.
 */
export function playMatch(engine, match, bots, maxTurns = 2000) {
  let m = match;
  let guard = 0;
  while (m.status === 'playing' && m.turns < maxTurns && guard++ < maxTurns * 60) {
    if (canEndTurn(m)) { m = endTurn(m); continue; }
    const bot = bots[m.currentIndex % bots.length];
    m = act(m, (s) => step(engine, s, bot));
  }
  return m;
}
