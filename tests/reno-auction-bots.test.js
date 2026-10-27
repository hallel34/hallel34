// Renovation of an owned coffee business, auctions of passed deals, and bot seats (owner ideas, 2026-10-27).
import { describe, it, expect } from 'vitest';
import {
  createEngine, EngineError, newMatch, act, currentState, canEndTurn, endTurn, playMatch, auctionMaxBid, botStep,
  renovationOption, RENOVATION_LEVELS, maybeStartAuction, auctionBid, auctionPass, auctionMinBid, auctionBidderIndex,
  serialize, deserialize, SCHEMA_VERSION, passiveIncome,
} from '../src/engine/index.js';

const profession = {
  id: 'test', title: 'בדיקה', salary: 10000, savings: 500000, perChild: 500,
  expenses: [{ id: 'housing', label: 'דירה', amount: 5000 }],
  liabilities: [],
};
const cafe = {
  id: 'opp-cafe', deck: 'opportunity', type: 'business', category: 'coffee', modes: ['family', 'full'],
  title: 'בית קפה', text: 't', price: 160000, downPayment: 80000, mortgage: 80000, monthlyCashFlow: 1800, profit: 3200, loanPayment: 1400,
};
const apt = {
  id: 'opp-apt', deck: 'opportunity', type: 'apartment', modes: ['family', 'full'],
  title: 'דירה', text: 't', price: 500000, downPayment: 20000, mortgage: 480000, monthlyCashFlow: 1000,
};
const stock = {
  id: 'opp-stk', deck: 'opportunity', type: 'stock', modes: ['full'], title: 'מניה', text: 't',
  symbol: 'AAA', price: 10, dividend: 1, maxQty: 100,
};
const expense = { id: 'exp', deck: 'expense', modes: ['family', 'full'], title: 'תיקון', text: 't', amount: 1500 };
const cashEvt = { id: 'mkt-cash', deck: 'market', modes: ['family', 'full'], effect: 'cash', title: 'בונוס', text: 't', amount: 700 };
const mk = (cards) => createEngine({ professions: [profession], cards: [...cards, expense, cashEvt] });

/** A state with a drawn opportunity card pending and the cafe already owned. */
function withCafeAndCard(engine, card = apt, cash = 500000) {
  let s = engine.newGame({ mode: 'full', professionId: 'test', seed: 1 });
  s = { ...s, cash, phase: 'decision', pending: { kind: 'opportunity', card } };
  s.assets.push({
    id: 'asset-cafe', cardId: 'opp-cafe', type: 'business', category: 'coffee', title: 'בית קפה',
    price: 160000, downPayment: 80000, mortgage: 80000, monthlyCashFlow: 1800,
  });
  return s;
}

describe('renovation', () => {
  const engine = mk([apt, cafe]);
  it('offers the next level only for an owned coffee business the player can pay for', () => {
    const s = withCafeAndCard(engine);
    const opt = renovationOption(s, engine.data.cards);
    expect(opt).toMatchObject({ assetId: 'asset-cafe', level: 1, cost: RENOVATION_LEVELS[0].cost, gain: RENOVATION_LEVELS[0].gain });
    expect(renovationOption({ ...s, cash: 1000 }, engine.data.cards)).toBeNull(); // cannot pay
    const noCafe = { ...s, assets: s.assets.filter((a) => a.id !== 'asset-cafe') };
    expect(renovationOption(noCafe, engine.data.cards)).toBeNull(); // nothing to renovate
  });
  it('renovate pays the cost, adds the monthly gain, records the level and discards the drawn card', () => {
    const s = withCafeAndCard(engine);
    const before = passiveIncome(s);
    const n = engine.renovate(s, 'asset-cafe');
    expect(n.cash).toBe(s.cash - RENOVATION_LEVELS[0].cost);
    const a = n.assets.find((x) => x.id === 'asset-cafe');
    expect(a.monthlyCashFlow).toBe(1800 + RENOVATION_LEVELS[0].gain);
    expect(a.renovations).toEqual({ level: 1, style: null });
    expect(passiveIncome(n)).toBe(before + RENOVATION_LEVELS[0].gain);
    expect(n.pending).toBeNull(); // the renovation replaces the card decision
    expect(n.events.find((e) => e.type === 'renovated')).toMatchObject({ level: 1, cost: RENOVATION_LEVELS[0].cost });
  });
  it('level 2 needs a style and keeps it; level 3 is the last', () => {
    let s = withCafeAndCard(engine);
    s = engine.renovate(s, 'asset-cafe');
    s = { ...s, pending: { kind: 'opportunity', card: apt } };
    expect(() => engine.renovate(s, 'asset-cafe')).toThrow(EngineError); // style missing
    s = engine.renovate(s, 'asset-cafe', 'takeaway');
    expect(s.assets[0].renovations).toEqual({ level: 2, style: 'takeaway' });
    s = { ...s, pending: { kind: 'opportunity', card: apt } };
    s = engine.renovate(s, 'asset-cafe');
    expect(s.assets[0].renovations.level).toBe(3);
    expect(s.assets[0].monthlyCashFlow).toBe(1800 + 800 + 1000 + 1200);
    expect(renovationOption({ ...s, pending: { kind: 'opportunity', card: apt } }, engine.data.cards)).toBeNull(); // fully renovated
  });
  it('requires a pending opportunity and the cash', () => {
    const s = withCafeAndCard(engine);
    expect(() => engine.renovate({ ...s, pending: null }, 'asset-cafe')).toThrow(EngineError);
    expect(() => engine.renovate({ ...s, cash: 100 }, 'asset-cafe')).toThrow(EngineError);
    expect(() => engine.renovate(s, 'nope')).toThrow(EngineError);
  });
  it('recovers the category from the card data for assets saved before they carried it', () => {
    const s = withCafeAndCard(engine);
    delete s.assets[0].category;
    expect(renovationOption(s, engine.data.cards)?.assetId).toBe('asset-cafe');
    expect(() => engine.renovate(s, 'asset-cafe')).not.toThrow();
  });
  it('an owned non-coffee business cannot be renovated', () => {
    const s = withCafeAndCard(engine);
    s.assets[0] = { ...s.assets[0], category: 'retail', cardId: 'x' };
    expect(renovationOption(s, engine.data.cards)).toBeNull();
    expect(() => engine.renovate(s, 'asset-cafe')).toThrow(EngineError);
  });
});

describe('auction', () => {
  const engine = mk([apt, cafe, stock]);
  const players = () => [{ professionId: 'test' }, { professionId: 'test' }, { professionId: 'test' }];
  it('starts only for a passed deal with other players still in', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    expect(maybeStartAuction(m, apt).auction.order).toEqual([1, 2]);
    expect(maybeStartAuction(m, stock).auction).toBeUndefined(); // stocks are personal offers
    const solo = newMatch(engine, { mode: 'full', players: [{ professionId: 'test' }], seed: 7 });
    expect(maybeStartAuction(solo, apt).auction).toBeUndefined();
  });
  it('the highest bidder pays the bid and gets the card with its own financing', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    m = maybeStartAuction(m, apt, m.currentIndex, { floor: 0 });
    expect(auctionBidderIndex(m)).toBe(1);
    expect(auctionMinBid(m)).toBe(1000);
    m = auctionBid(engine, m, 5000);
    expect(auctionBidderIndex(m)).toBe(2);
    m = auctionPass(engine, m); // player 2 out; back to 1 would mean no contest... player 0 passed (decliner)
    expect(m.auction).toBeNull(); // player 1 is the last bidder standing
    expect(m.lastAuction).toMatchObject({ cardId: 'opp-apt', winner: 1, price: 5000 });
    const st = m.players[1].state;
    expect(st.cash).toBe(500000 - 5000);
    const a = st.assets.find((x) => x.cardId === 'opp-apt');
    // bid = the effective down payment; the card's mortgage comes unchanged, so the value is bid + mortgage
    expect(a).toMatchObject({ downPayment: 5000, mortgage: 480000, price: 485000, monthlyCashFlow: 1000, auctioned: true });
  });
  it('bids must top the current one, be step multiples, and stay in cash', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    m = maybeStartAuction(m, apt, m.currentIndex, { floor: 0 });
    expect(() => auctionBid(engine, m, 1500)).toThrow(EngineError); // not a step multiple
    m = auctionBid(engine, m, 3000);
    expect(() => auctionBid(engine, m, 3000)).toThrow(EngineError); // must top
    expect(() => auctionBid(engine, m, 999999000)).toThrow(EngineError); // beyond cash
  });
  it('everyone passing drops the card', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    m = maybeStartAuction(m, apt);
    m = auctionPass(engine, m);
    m = auctionPass(engine, m);
    expect(m.auction).toBeNull();
    expect(m.lastAuction.winner).toBeNull();
    expect(m.players.every((p) => p.state.assets.length === 0)).toBe(true);
  });
  it('a later raise keeps the auction open until a full round of passes', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    m = maybeStartAuction(m, apt, m.currentIndex, { floor: 0 });
    m = auctionBid(engine, m, 2000); // p1
    m = auctionBid(engine, m, 4000); // p2 tops
    m = auctionPass(engine, m); // p1 drops
    expect(m.auction).toBeNull();
    expect(m.lastAuction).toMatchObject({ winner: 2, price: 4000 });
  });
  it('the winner can win the game by the auction purchase', () => {
    let m = newMatch(engine, { mode: 'full', players: [{ professionId: 'test' }, { professionId: 'test' }], seed: 7 });
    // player 1 is one deal away from freedom
    const s1 = m.players[1].state;
    m = { ...m, players: m.players.map((p, i) => (i === 1 ? { ...p, state: { ...s1, profession: { ...s1.profession, expenses: [] }, liabilities: [] } } : p)) };
    m = maybeStartAuction(m, apt, m.currentIndex, { floor: 0 });
    m = auctionBid(engine, m, 1000);
    expect(m.status).toBe('won');
    expect(m.winnerIndex).toBe(1);
  });
  it('an open auction survives a save round-trip and resumes', () => {
    let m = newMatch(engine, { mode: 'full', players: players(), seed: 7 });
    m = maybeStartAuction(m, apt, m.currentIndex, { floor: 0 });
    m = auctionBid(engine, m, 2000);
    const loaded = deserialize(serialize(m));
    expect(loaded.auction).toEqual(m.auction);
    const after = auctionPass(engine, loaded);
    expect(after.lastAuction.winner).toBe(1);
  });
});

describe('bot seats', () => {
  const engine = mk([apt, cafe, stock]);
  it('a match carries the bot policy of each seat and survives a save round-trip', () => {
    let m = newMatch(engine, { mode: 'full', players: [{ professionId: 'test' }, { professionId: 'test', bot: 'cautious' }], seed: 3 });
    expect(m.players.map((p) => p.bot)).toEqual([null, 'cautious']);
    const loaded = deserialize(serialize(m));
    expect(loaded.players.map((p) => p.bot)).toEqual([null, 'cautious']);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('a schema-6 save migrates with human seats', () => {
    const m = newMatch(engine, { mode: 'full', players: [{ professionId: 'test' }], seed: 3 });
    const old = JSON.parse(serialize(m));
    old.schemaVersion = 6;
    for (const p of old.players) { delete p.bot; p.state.schemaVersion = 6; }
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.players[0].bot).toBeNull();
  });
  it('auctionMaxBid follows the policy: cautious keeps a reserve, reckless caps at the price, alwaysPass sits out', () => {
    const s = withCafeAndCard(engine, apt, 100000);
    const card = { ...apt, monthlyCashFlow: 1000, price: 500000, downPayment: 20000 };
    expect(auctionMaxBid(s, card, 'alwaysPass')).toBe(0);
    const sensible = auctionMaxBid(s, card, 'sensible'); // 130 months x 1000 = 130k, cash-capped at 97.5k -> 97k (0.5 month reserve)
    expect(sensible).toBe(97000);
    const cautious = auctionMaxBid(s, card, 'cautious'); // 80 x 1000 = 80k, reserve 2 x 5000 = 10k -> 90k cash cap
    expect(cautious).toBe(80000);
    expect(auctionMaxBid(s, card, 'alwaysBuy')).toBe(100000); // the price is 500k: all its cash
    const bad = { ...card, monthlyCashFlow: -100 };
    expect(auctionMaxBid(s, bad, 'sensible')).toBe(0);
    expect(auctionMaxBid(s, bad, 'alwaysBuy')).toBe(20000); // the down payment at most
  });
  it('a bot match with auctions still finishes (mixed policies)', () => {
    const m = newMatch(engine, { mode: 'full', players: [
      { professionId: 'test', bot: 'sensible' }, { professionId: 'test', bot: 'cautious' }, { professionId: 'test', bot: 'alwaysBuy' },
    ], seed: 11 });
    const out = playMatch(engine, m, ['sensible']);
    expect(['won', 'lost']).toContain(out.status);
  });
  it('a sensible bot renovates its coffee business instead of taking a worse card', () => {
    const s = withCafeAndCard(engine, apt, 200000);
    const badCard = { ...apt, monthlyCashFlow: 100, downPayment: 20000 }; // payback 200 months > 130
    const n = botStep(engine, { ...s, pending: { kind: 'opportunity', card: badCard } }, 'sensible');
    expect(n.assets[0].renovations?.level).toBe(1);
    expect(n.pending).toBeNull();
    const better = { ...apt, downPayment: 10000, monthlyCashFlow: 1000 }; // payback 10 months beats the renovation's 50
    const n2 = botStep(engine, { ...s, pending: { kind: 'opportunity', card: better } }, 'sensible');
    expect(n2.assets.some((a) => a.cardId === 'opp-apt')).toBe(true);
    expect(n2.assets.find((a) => a.id === 'asset-cafe').renovations).toBeUndefined();
  });
});

describe('renovation style branches', () => {
  const engine = mk([apt, cafe]);
  it('both level-2 styles reach level 3 and keep their identity; the option exposes the asset style', () => {
    for (const style of ['terrace', 'takeaway']) {
      let s = withCafeAndCard(engine);
      s = engine.renovate(s, 'asset-cafe');
      s = { ...s, phase: 'decision', pending: { kind: 'opportunity', card: apt } };
      s = engine.renovate(s, 'asset-cafe', style);
      let a = s.assets.find((x) => x.id === 'asset-cafe');
      expect(a.renovations).toEqual({ level: 2, style });
      const opt = renovationOption({ ...s, phase: 'decision', pending: { kind: 'opportunity', card: apt } }, engine.data.cards);
      expect(opt).toMatchObject({ level: 3, assetStyle: style }); // the UI labels level 3 per style (roof garden / delivery kitchen)
      s = { ...s, phase: 'decision', pending: { kind: 'opportunity', card: apt } };
      s = engine.renovate(s, 'asset-cafe');
      a = s.assets.find((x) => x.id === 'asset-cafe');
      expect(a.renovations).toEqual({ level: 3, style });
      expect(a.monthlyCashFlow).toBe(1800 + RENOVATION_LEVELS[0].gain + RENOVATION_LEVELS[1].gain + RENOVATION_LEVELS[2].gain);
      expect(renovationOption(s, engine.data.cards)).toBeNull(); // fully renovated
    }
  });
});

describe('auction economics coverage', () => {
  const engine = mk([apt, cafe]);
  /** A match whose current player just passed on `card`; everyone has `cash`. */
  function matchAfterPass(card, cash = 500000, mode = 'full', rules = {}) {
    let m = newMatch(engine, { mode, seed: 1, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    m = { ...m, players: m.players.map((p) => ({ ...p, state: { ...p.state, cash } })) };
    return maybeStartAuction(m, card, m.currentIndex, rules);
  }
  it('the recorded price tracks the bid at many levels, financing never changes with the bid', () => {
    for (const bid of [1000, 25000, 80000, 200000]) {
      const s = engine.auctionWin(
        { ...engine.newGame({ mode: 'full', professionId: 'test', seed: 1 }), cash: 500000, phase: 'decision' },
        apt, bid);
      const a = s.assets.at(-1);
      expect(a).toMatchObject({ downPayment: bid, mortgage: apt.mortgage, price: bid + apt.mortgage, monthlyCashFlow: apt.monthlyCashFlow, auctioned: true });
    }
  });
  it('an immediate resale never beats simply keeping the bid, at any bid and any offer at/below full price', () => {
    for (const bid of [1000, 25000, 80000, 200000]) {
      for (const pct of [0.5, 0.9, 1.0]) {
        let s = engine.auctionWin(
          { ...engine.newGame({ mode: 'full', professionId: 'test', seed: 1 }), cash: 500000, phase: 'decision' },
          apt, bid);
        const a = s.assets.at(-1);
        const offerPrice = Math.round(a.price * pct);
        s = { ...s, phase: 'decision', pending: { kind: 'offer', card: cashEvt, assetId: a.id, offerPrice, proceeds: offerPrice - a.mortgage } };
        const sold = engine.acceptOffer(s);
        // never a profit; at exactly 100% of the recorded price it is break-even, same as a normally bought asset
        expect(sold.cash - 500000).toBeLessThanOrEqual(0);
      }
    }
  });
  it('an above-price offer pays the same premium as for a normally bought asset (no auction-specific free value)', () => {
    const base = { ...engine.newGame({ mode: 'full', professionId: 'test', seed: 1 }), cash: 500000, phase: 'decision' };
    const gain = (s0, assetIdx) => {
      const a = s0.assets[assetIdx];
      const offerPrice = Math.round(a.price * 1.2);
      const s = { ...s0, phase: 'decision', pending: { kind: 'offer', card: cashEvt, assetId: a.id, offerPrice, proceeds: offerPrice - a.mortgage } };
      return engine.acceptOffer(s).cash - s0.cash + a.downPayment; // resale result relative to the cash that went in
    };
    const bought = engine.buy({ ...base, phase: 'decision', pending: { kind: 'opportunity', card: apt } });
    const won = engine.auctionWin(base, apt, apt.downPayment);
    expect(gain(won, won.assets.length - 1)).toBe(gain(bought, bought.assets.length - 1));
  });
  it('floor and custom step: the opening bid clears the floor rounded to a step', () => {
    let m = matchAfterPass(apt, 500000, 'full', { floor: apt.downPayment }); // floor = the printed down payment
    expect(auctionMinBid(m)).toBe(apt.downPayment);
    m = matchAfterPass(apt, 500000, 'full', { floor: 20500 });
    expect(auctionMinBid(m)).toBe(21000); // 20500 rounded up to a 1000 step
    m = matchAfterPass(apt, 500000, 'full', { step: 5000, floor: 0 });
    expect(auctionMinBid(m)).toBe(5000);
    expect(() => auctionBid(engine, m, 3000)).toThrow(EngineError); // not a step multiple
    m = auctionBid(engine, m, 10000);
    expect(auctionMinBid(m)).toBe(15000);
  });
  it('junior auctions move in junior steps', () => {
    let m = newMatch(engine, { mode: 'family', seed: 1, players: [{ name: 'A' }, { name: 'B' }] });
    m = { ...m, junior: true, players: m.players.map((p) => ({ ...p, state: { ...p.state, junior: true, cash: 300000 } })) };
    m = maybeStartAuction(m, apt);
    expect(auctionMinBid(m)).toBe(10000);
    expect(() => auctionBid(engine, m, 15000)).toThrow(EngineError);
    m = auctionBid(engine, m, 20000); // the only other bidder takes it at once
    expect(m.auction).toBeNull();
    expect(m.lastAuction).toMatchObject({ winner: 1, price: 20000 });
  });
});
