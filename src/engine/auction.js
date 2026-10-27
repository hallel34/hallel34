// Auction of a declined opportunity among the other players (owner idea, 2026-10-27: "אם אחד ויתר על הזדמנות צריך
// להציע את זה למכרז בין שאר השחקנים"). Match-level: the bidding lives on the match, not in one player's state.
// Only apartment / business deals go to auction (a stock card is a personal buy offer, not an asset to win).
// The player who passed does not bid. Open ascending bids in loan steps (10,000 in a junior game), cash only
// (no loans mid-auction): a bid must top the current one and stay within the bidder's cash. Last bidder standing
// pays their bid as the effective down payment and gets the card with its own financing (see engine.auctionWin).
import { EngineError } from './engine.js';
import { LOAN_STEP, JUNIOR_LOAN_STEP } from './config.js';
import { currentState } from './match.js';

const fail = (msg) => { throw new EngineError(msg); };

export const auctionable = (card) => card?.type === 'apartment' || card?.type === 'business';
export const auctionStep = (m) => (m.junior ? JUNIOR_LOAN_STEP : LOAN_STEP);
/** Indexes of the players still in the game, except `fromIndex`, in turn order starting after them. */
export function auctionOrder(m, fromIndex) {
  const out = [];
  for (let k = 1; k < m.players.length; k++) {
    const i = (fromIndex + k) % m.players.length;
    if (m.players[i].state.status === 'playing') out.push(i);
  }
  return out;
}

/**
 * After the current player passed on an opportunity: the match gains an `auction` when the card is a deal and at
 * least one other player is still in the game. Otherwise the match is returned unchanged.
 */
export function maybeStartAuction(m, card, fromIndex = m.currentIndex) {
  if (m.auction || !auctionable(card)) return m;
  const order = auctionOrder(m, fromIndex);
  if (!order.length) return m;
  return { ...m, auction: { card, fromIndex, order, seat: 0, currentBid: 0, winner: null, out: [], history: [] } };
}

export const auctionActive = (m) => !!m?.auction;
export const auctionBidderIndex = (m) => m.auction.order[m.auction.seat];

/** The lowest amount the current bidder may offer (the first bid is one step; later bids top the current one). */
export function auctionMinBid(m) {
  const step = auctionStep(m);
  return m.auction.currentBid + step;
}

function advance(a) {
  // The next bidder cyclically after the current seat, skipping players who dropped out. Returning to the current
  // high bidder means a full round passed with no higher bid: they win. Nobody left: the auction ends without a sale.
  const n = a.order.length;
  for (let k = 1; k <= n; k++) {
    const i = a.order[(a.seat + k) % n];
    if (a.out.includes(i)) continue;
    if (i === a.winner) return null;
    return { ...a, seat: (a.seat + k) % n };
  }
  return null;
}

function finish(engine, m, a) {
  const { card, winner, currentBid, history } = a;
  const base = { ...m, auction: null, lastAuction: { cardId: card.id, title: card.title, winner, price: currentBid, history } };
  if (winner === null) return base; // everyone passed: the card is gone
  const state = engine.auctionWin(m.players[winner].state, card, currentBid);
  const next = { ...base, players: base.players.map((p, i) => (i === winner ? { ...p, state } : p)) };
  if (state.status === 'won') { next.status = 'won'; next.winnerIndex = winner; }
  return next;
}

/** The current bidder offers `amount` (a positive step multiple above the current bid, within their cash). */
export function auctionBid(engine, m, amount) {
  const a = m?.auction;
  if (!a) fail('no auction');
  const bidder = auctionBidderIndex(m);
  const step = auctionStep(m);
  if (!Number.isInteger(amount) || amount < auctionMinBid(m) || amount % step !== 0) fail(`bid must be a multiple of ${step} above ${a.currentBid}`);
  if (amount > m.players[bidder].state.cash) fail('not enough cash');
  const next = { ...a, currentBid: amount, winner: bidder, history: [...a.history, { player: bidder, bid: amount }] };
  const adv = advance(next);
  return adv ? { ...m, auction: adv } : finish(engine, m, next);
}

/** The current bidder drops out. */
export function auctionPass(engine, m) {
  const a = m?.auction;
  if (!a) fail('no auction');
  const bidder = auctionBidderIndex(m);
  const next = { ...a, out: [...a.out, bidder], history: [...a.history, { player: bidder, bid: null }] };
  const adv = advance(next);
  return adv ? { ...m, auction: adv } : finish(engine, m, next);
}

/** Runs the whole auction with one bid policy per player (simulation / tests): maxBid(state, card, playerIndex) -> amount or 0. */
export function runAuction(engine, m, maxBid) {
  let guard = 0;
  while (m.auction && guard++ < 1000) {
    const bidder = auctionBidderIndex(m);
    const p = m.players[bidder];
    const offer = maxBid(p.state, m.auction.card, bidder, m) | 0;
    const min = auctionMinBid(m);
    m = offer >= min && offer <= p.state.cash ? auctionBid(engine, m, Math.floor(offer / auctionStep(m)) * auctionStep(m)) : auctionPass(engine, m);
  }
  return m;
}
