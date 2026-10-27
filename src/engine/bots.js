// Bots used by the balance simulation (and handy for QA / demo mode).
import { maxLoan, monthlyCashFlow, totalExpenses, loanRateNow, bankLoanPrincipal, loanStep } from './selectors.js';
import { decisionCanPass, isFreeOption, PASS_OPTION } from './engine.js';
import { act, canEndTurn, endTurn } from './match.js';
import { renovationOption } from './renovation.js';
import { maybeStartAuction, runAuction } from './auction.js';
import { LOAN_STEP, JUNIOR_LOAN_STEP } from './config.js';

// reserveMonths: cash buffer (in months of expenses) kept after a purchase.
// maxPayback: reject deals whose down payment takes longer than this many months of cash flow.
export const BOTS = {
  alwaysBuy: { reserveMonths: 0, maxPayback: Infinity, borrow: true, charity: true, acceptOffers: false },
  sensible: { reserveMonths: 0.5, maxPayback: 130, borrow: true, charity: true, acceptOffers: 1.2 },
  cautious: { reserveMonths: 2, maxPayback: 80, borrow: false, charity: true, acceptOffers: 1.15 },
  // finance's over-borrowing bots (docs/v3/economy-experiments.md). Both buy everything and skip the "does the deal still pay
  // after the loan payment" check. overBorrow takes the MAXIMUM loan whenever it is short; overBorrowLite borrows only the gap.
  overBorrow: { reserveMonths: 0, maxPayback: Infinity, borrow: true, charity: true, acceptOffers: false, overBorrow: 'max' },
  overBorrowLite: { reserveMonths: 0, maxPayback: Infinity, borrow: true, charity: true, acceptOffers: false, overBorrow: 'gap' },
  alwaysPass: { reserveMonths: 0, maxPayback: -1, borrow: false, charity: false, acceptOffers: false },
};

function coverShortfall(engine, s, need) {
  // Take the smallest loan(s) that cover `need` extra cash, if allowed.
  while (need > 0 && maxLoan(s) > 0) {
    const amt = Math.min(maxLoan(s), Math.ceil(need / loanStep(s)) * loanStep(s));
    s = engine.takeLoan(s, amt);
    need -= amt;
  }
  return s;
}

/**
 * A decision card (v4 stage 4): every available option is scored by what it does to the monthly money (passive income minus
 * new loan payments) and the cash it uses, inside the bot's own rules (reserve, payback, borrowing): the best monthly gain
 * wins. The reckless bots (alwaysBuy, overBorrow*) take the option that commits the most money; alwaysPass takes the free
 * option (on an expense card, the one with the least debt). Ties go to the option listed first.
 */
function decideBot(engine, s, cfg) {
  const card = s.pending.card;
  const avail = engine.decisionOptions(s).filter((o) => o.available).map((o) => o.id);
  const canPass = decisionCanPass(card);
  const free = card.options.find((o) => isFreeOption(o) && avail.includes(o.id))?.id ?? (canPass ? PASS_OPTION : null);
  const reserve = cfg.reserveMonths * totalExpenses(s);
  const scored = avail.map((id) => {
    const n = engine.decide(s, id);
    const gain = (monthlyCashFlow(n) - monthlyCashFlow(s));
    const used = s.cash - n.cash;
    const borrowed = bankLoanPrincipal(n) - bankLoanPrincipal(s);
    return { id, gain, used, borrowed, n };
  });
  if (cfg.maxPayback < 0) { // alwaysPass
    if (free) return engine.decide(s, free);
    return engine.decide(s, scored.sort((a, b) => a.borrowed - b.borrowed)[0].id);
  }
  const ok = scored.filter((x) => {
    if (x.borrowed > 0 && !cfg.borrow && card.square !== 'expense') return false;
    if (card.square === 'expense') return true;
    if (x.gain <= 0 && x.used > 0) return false;
    if (x.n.cash < reserve && x.used > 0) return false;
    const payback = x.gain > 0 ? Math.max(0, x.used) / x.gain : Infinity;
    return payback <= cfg.maxPayback || x.used <= 0;
  });
  if (card.square === 'expense') {
    // pay from cash when the reserve allows it, else the cheapest loan
    const cashFirst = ok.filter((x) => x.borrowed === 0 && x.n.cash >= reserve);
    const pick = cashFirst[0] ?? ok.sort((a, b) => a.borrowed - b.borrowed)[0];
    return engine.decide(s, pick.id);
  }
  // the reckless bots (no payback limit) commit the most money they can (cash + new debt), like they buy every deal
  if (cfg.maxPayback === Infinity) {
    const big = scored.filter((x) => x.used + x.borrowed > 0).sort((a, b) => (b.used + b.borrowed) - (a.used + a.borrowed) || b.gain - a.gain)[0];
    if (big) return engine.decide(s, big.id);
  }
  const best = ok.filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain)[0];
  if (best) return engine.decide(s, best.id);
  return engine.decide(s, free ?? scored[0].id);
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
      if (n === s) return engine.takeLoan(s, loanStep(s)); // will throw if impossible
    }
    return n;
  }
  if (p.kind === 'opportunity') {
    const c = p.card;
    const reserve = cfg.reserveMonths * totalExpenses(s);
    // Renovation of an owned coffee business: an alternative to the card, judged by the same payback rule.
    // The reckless bots renovate whenever they can pay; alwaysPass never does.
    const reno = renovationOption(s, engine.data.cards);
    if (reno && cfg.maxPayback >= 0) {
      const renoPayback = reno.gain > 0 ? reno.cost / reno.gain : Infinity;
      const cardPayback = c.type !== 'stock' && c.monthlyCashFlow > 0 ? c.downPayment / c.monthlyCashFlow : Infinity;
      const wants = cfg.maxPayback === Infinity || (renoPayback <= cfg.maxPayback && renoPayback <= cardPayback);
      if (wants) return engine.renovate(s, reno.assetId, reno.style ? 'terrace' : null);
    }
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
        const loanNeeded = Math.ceil(need / loanStep(s)) * loanStep(s);
        if (loanNeeded > maxLoan(s)) return engine.pass(s);
        // only borrow if the deal still improves cash flow after the loan payment (the over-borrowing bots skip this check)
        if (!cfg.overBorrow && c.monthlyCashFlow - loanNeeded * loanRateNow(s) <= 0) return engine.pass(s);
        n = engine.takeLoan(s, cfg.overBorrow === 'max' ? maxLoan(s) : loanNeeded);
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
  if (p.kind === 'decision') return decideBot(engine, s, cfg);
  if (p.kind === 'taxAudit') return engine.answerAudit(s, { questionId: null, correct: null }); // knowledge only: never money
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
 * The highest bid a policy puts on an auctioned deal (0 = sit out): the same payback ceiling it buys with
 * (cost / monthly cash flow in months), kept inside its cash reserve. The reckless bots (no payback limit) go
 * up to the card's full price; for a money-losing deal they offer at most its down payment. Cash only.
 */
export function auctionMaxBid(state, card, bot) {
  const cfg = BOTS[bot] ?? bot;
  if (!card || cfg.maxPayback < 0) return 0;
  const reserve = cfg.reserveMonths * totalExpenses(state);
  const budget = Math.max(0, state.cash - reserve);
  let ceiling;
  if (card.monthlyCashFlow > 0) {
    ceiling = cfg.maxPayback === Infinity ? card.price : cfg.maxPayback * card.monthlyCashFlow;
  } else {
    ceiling = cfg.maxPayback === Infinity ? card.downPayment : 0;
  }
  const step = state.junior ? JUNIOR_LOAN_STEP : LOAN_STEP;
  return Math.max(0, Math.floor(Math.min(budget, ceiling) / step) * step);
}

/**
 * Plays a whole hot-seat match with one bot policy per player (bots: ['sensible', ...]; a seat's own `bot` field wins).
 * A passed deal goes to auction: every bidder plays its own policy's ceiling. Stops at the first winner, when everyone
 * is out, or after `maxTurns` completed turns. Returns the final match.
 */
export function playMatch(engine, match, bots, maxTurns = 2000) {
  let m = match;
  let guard = 0;
  const policy = (i) => m.players[i].bot ?? bots[i % bots.length];
  while (m.status === 'playing' && m.turns < maxTurns && guard++ < maxTurns * 60) {
    if (m.auction) { m = runAuction(engine, m, (st, card, i) => auctionMaxBid(st, card, policy(i))); continue; }
    if (canEndTurn(m)) { m = endTurn(m); continue; }
    const bot = policy(m.currentIndex);
    m = act(m, (s) => step(engine, s, bot));
    const passed = m.players[m.currentIndex].state.events?.find((e) => e.type === 'passed' && e.card);
    if (passed) m = maybeStartAuction(m, passed.card);
  }
  return m;
}
