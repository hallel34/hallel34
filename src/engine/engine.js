// Pure game engine. No DOM, no Date, no Math.random.
// createEngine(data) returns action functions of the form (state, ...args) => newState.
// The input state is never mutated. All randomness comes from state.rngState.
import {
  BOARD, SCHEMA_VERSION, MAX_KIDS, CHARITY_PCT, CHARITY_TURNS, LOAN_STEP,
  MAX_STOCK_QTY, PAYDAY_MONTHS, INFLATION_PRICE_ROUND, TIMED_EFFECT_KINDS, INFLATION_FLOW_ROUND, INFLATION_EXPENSE_ROUND,
} from './config.js';
import { validateData } from './validate.js';
import { cardView } from './card-view.js';
import {
  monthlyCashFlow, hasWon, maxLoan, saleValue, stockPrice, totalIncome,
  passiveIncome, canSell, loanMonthlyPayment, loanRateNow, priceFactor, expenseFactor,
} from './selectors.js';
import { emptyLearn, recordDecision, buyRecord, passRecord, loanRating, isDeal } from './learn.js';
import { dailyDie, dailyPick, DAILY_TURN_CAP } from './daily.js';

export class EngineError extends Error {}

const TIMED_KINDS = new Set(TIMED_EFFECT_KINDS);
const roundTo = (x, q) => Math.round(x / q) * q;

/**
 * Price inflation of a NEW apartment / business deal (mutates the drawn copy, never the card data or an owned asset).
 * Prices and down payments round to INFLATION_PRICE_ROUND, mortgage = price - down; rent / profit / loan payment round to
 * INFLATION_FLOW_ROUND and the cash flow is recomputed from them, so the card's breakdown keeps adding up.
 */
export function inflateDeal(card, f) {
  if (f === 1 || card.type === 'stock') return card;
  card.price = roundTo(card.price * f, INFLATION_PRICE_ROUND);
  card.downPayment = roundTo(card.downPayment * f, INFLATION_PRICE_ROUND);
  card.mortgage = card.price - card.downPayment;
  const gross = card.type === 'business' ? 'profit' : 'rent';
  if (Number.isFinite(card[gross]) && Number.isFinite(card.loanPayment)) {
    card[gross] = roundTo(card[gross] * f, INFLATION_FLOW_ROUND);
    card.loanPayment = roundTo(card.loanPayment * f, INFLATION_FLOW_ROUND);
    card.monthlyCashFlow = card[gross] - card.loanPayment;
  } else {
    card.monthlyCashFlow = roundTo(card.monthlyCashFlow * f, INFLATION_FLOW_ROUND);
    if (Number.isFinite(card.loanPayment)) card.loanPayment = roundTo(card.loanPayment * f, INFLATION_FLOW_ROUND);
  }
  card.inflation = f; // display: the deal is shown at today's prices
  return card;
}

const clone = (x) => structuredClone(x);
const fail = (msg) => { throw new EngineError(msg); };

// mulberry32, state kept inside the game state so it is serializable.
function rand(d) {
  d.rngState = (d.rngState + 0x6D2B79F5) >>> 0;
  let t = d.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (d, n) => Math.floor(rand(d) * n);
function shuffle(d, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(d, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createEngine(data, { validate = true } = {}) {
  if (validate) validateData(data);
  const cardById = new Map(data.cards.map((c) => [c.id, c]));
  const professionById = new Map(data.professions.map((p) => [p.id, p]));

  const eligible = (deck, mode) =>
    data.cards.filter((c) => c.deck === deck && c.modes.includes(mode)).map((c) => c.id);

  // A card may carry the children's wording (titleFamily / textFamily): a family game draws the card with that wording in
  // title/text, so every screen, log line and asset name downstream is already in the right register. Numbers never differ.
  const view = cardView;

  function draw(d, deck) {
    if (d.daily) { // daily challenge: the card of this turn depends on (seed, deck, turn) only, never on earlier choices
      const ids = eligible(deck, d.mode);
      return view(cardById.get(ids[dailyPick(d.seed, deck, d.turn, ids.length)]), d.mode);
    }
    if (!d.decks[deck].length) d.decks[deck] = shuffle(d, eligible(deck, d.mode));
    return view(cardById.get(d.decks[deck].shift()), d.mode);
  }

  // ---------- setup ----------
  function newGame({ mode = 'full', professionId, seed = 1, daily = null } = {}) {
    if (mode !== 'family' && mode !== 'full') fail(`unknown mode ${mode}`);
    const profession = professionById.get(professionId ?? data.professions[0].id);
    if (!profession) fail(`unknown profession ${professionId}`);
    const d = {
      schemaVersion: SCHEMA_VERSION,
      mode,
      seed,
      rngState: seed >>> 0,
      profession: clone({
        id: profession.id, title: profession.title, salary: profession.salary,
        perChild: profession.perChild, expenses: profession.expenses,
      }),
      cash: profession.savings,
      assets: [],
      liabilities: profession.liabilities.map((l) => ({ ...l, kind: 'base' })),
      kids: 0,
      position: 0,
      turn: 0,
      lap: 0, // passes of square 0 (price inflation reads it)
      effects: [], // timed market effects: { kind, pct | rate, turnsLeft, cardId }
      charityTurns: 0,
      stockPrices: {},
      decks: { opportunity: [], expense: [], market: [] },
      pending: null,
      phase: 'roll', // roll | decision | mustPay | ended
      status: 'playing', // playing | won | lost
      lastRoll: null,
      events: [],
      seq: 0,
      stats: {
        paydays: 0, dealsBought: 0, dealsSold: 0, loansTaken: 0, donations: 0,
        expensesPaid: 0, peakPassive: 0, totalPaid: 0, interestPaid: 0,
      },
      learn: emptyLearn(), // what the player decided (feedback, guesses, report); never read by a rule
    };
    if (daily) {
      // opt-in rules flag: pre-determined dice / card streams (see daily.js) and an action log for later verification
      d.daily = { date: String(daily.date), turnCap: daily.turnCap ?? DAILY_TURN_CAP, log: [] };
    } else {
      for (const deck of Object.keys(d.decks)) d.decks[deck] = shuffle(d, eligible(deck, mode));
    }
    settle(d);
    return d;
  }

  // ---------- core settlement ----------
  function payFromCash(d, amount) {
    d.cash -= amount;
    d.stats.totalPaid += amount;
  }

  function shortfallAmount(d) {
    if (d.pending?.kind === 'expense') return d.pending.amount - d.cash;
    if (d.pending?.kind === 'shortfall') return -d.cash;
    return 0;
  }

  function settle(d) {
    d.stats.peakPassive = Math.max(d.stats.peakPassive, passiveIncome(d));
    if (d.status !== 'playing') { d.phase = 'ended'; return; }
    if (hasWon(d)) {
      d.status = 'won'; d.phase = 'ended'; d.pending = null; d.winTurn = d.turn;
      d.events.push({ type: 'win' });
      return;
    }
    if (!d.pending && d.cash < 0) d.pending = { kind: 'shortfall' };
    if (d.pending?.kind === 'expense' && d.cash >= d.pending.amount) {
      const funded = d.pending.funded ?? 'cash'; // 'loan' / 'sale' when it was covered by borrowing / selling first
      recordDecision(d, {
        kind: 'expense', cardId: d.pending.card?.id ?? null, amount: d.pending.amount, viaLoan: funded === 'loan', viaSale: funded === 'sale',
        loanAmount: d.pending.loanTotal ?? 0, green: funded === 'cash',
      });
      payFromCash(d, d.pending.amount);
      d.stats.expensesPaid += 1;
      d.events.push({ type: 'expensePaid', amount: d.pending.amount, card: d.pending.card });
      d.pending = null;
    }
    if (d.pending?.kind === 'shortfall' && d.cash >= 0) d.pending = null;
    if (shortfallAmount(d) > 0) {
      // Game over: negative cash flow + no cash + loan limit reached
      // (full mode: and nothing left to sell).
      if (monthlyCashFlow(d) < 0 && maxLoan(d) === 0 && !canSell(d)) {
        d.status = 'lost'; d.phase = 'ended';
        d.events.push({ type: 'gameOver' });
        return;
      }
      d.phase = 'mustPay';
      return;
    }
    d.phase = d.pending ? 'decision' : 'roll';
    if (d.daily && d.phase === 'roll' && d.turn >= d.daily.turnCap) {
      // the day's last turn is resolved and there is no freedom yet: the challenge ends here (not a bankruptcy)
      d.status = 'lost'; d.phase = 'ended'; d.daily.timedOut = true;
      d.events.push({ type: 'dailyCap' });
    }
  }

  const logAction = (d, ...entry) => { if (d.daily) d.daily.log.push(entry); };

  function begin(state) {
    if (state.status !== 'playing') fail('game is over');
    const d = clone(state);
    d.events = [];
    return d;
  }

  const requirePending = (d, kind) => {
    if (d.pending?.kind !== kind) fail(`no pending ${kind}`);
  };

  // ---------- roll & movement ----------
  function payday(d) {
    const monthly = monthlyCashFlow(d);
    const amount = monthly * PAYDAY_MONTHS;
    // Interest on bank loans over the settled months (starting debts are installments, not counted as interest).
    const interest = d.liabilities.filter((l) => l.kind === 'loan').reduce((a, l) => a + l.monthlyPayment, 0) * PAYDAY_MONTHS;
    d.cash += amount;
    d.stats.paydays += 1;
    d.stats.interestPaid = (d.stats.interestPaid ?? 0) + interest;
    d.events.push({ type: 'payday', amount, monthly, months: PAYDAY_MONTHS, interest });
  }

  function roll(state, forcedDice) {
    const d = begin(state);
    if (d.phase !== 'roll') fail('cannot roll now');
    d.turn += 1;
    logAction(d, 'roll');
    tickEffects(d);
    const diceCount = d.charityTurns > 0 ? 2 : 1;
    if (d.charityTurns > 0) d.charityTurns -= 1;
    const dice = forcedDice ?? Array.from({ length: diceCount }, (_, k) => (d.daily ? dailyDie(d.seed, d.turn, k) : 1 + randInt(d, 6)));
    const steps = dice.reduce((a, b) => a + b, 0);
    const from = d.position;
    const path = [];
    for (let i = 0; i < steps; i++) {
      d.position = (d.position + 1) % BOARD.length;
      path.push(d.position);
      if (d.position === 0) d.lap = (d.lap ?? 0) + 1;
      if (BOARD[d.position] === 'payday') payday(d); // passing or landing
    }
    d.lastRoll = { dice, steps };
    d.events.push({ type: 'move', from, to: d.position, dice, steps, path });
    resolveSquare(d, BOARD[d.position]);
    settle(d);
    return d;
  }

  function resolveSquare(d, square) {
    d.events.push({ type: 'square', square });
    switch (square) {
      case 'payday': break; // already paid while moving
      case 'opportunity': {
        const card = clone(draw(d, 'opportunity'));
        if (card.type === 'stock') card.price = stockPrice(d, card.symbol, card.price);
        else inflateDeal(card, priceFactor(d));
        d.pending = { kind: 'opportunity', card };
        break;
      }
      case 'expense': {
        const card = clone(draw(d, 'expense'));
        const fx = expenseFactor(d);
        if (fx !== 1) { card.amount = Math.round((card.amount * fx) / INFLATION_EXPENSE_ROUND) * INFLATION_EXPENSE_ROUND; card.inflation = fx; }
        d.pending = { kind: 'expense', card, amount: card.amount };
        break;
      }
      case 'market': marketEvent(d); break;
      case 'baby':
        if (d.kids < MAX_KIDS) {
          d.kids += 1;
          d.events.push({ type: 'baby', kids: d.kids, extra: d.profession.perChild });
        } else d.events.push({ type: 'babyMax' });
        break;
      case 'charity': {
        const cost = Math.round((totalIncome(d) * CHARITY_PCT) / 10) * 10;
        d.pending = { kind: 'charity', cost };
        break;
      }
      default: fail(`unknown square ${square}`);
    }
  }

  /** Counts the running timed effects down at the start of a roll; an effect at 0 is gone before the player moves. */
  function tickEffects(d) {
    if (!Array.isArray(d.effects)) d.effects = [];
    for (const e of d.effects) e.turnsLeft -= 1;
    const ended = d.effects.filter((e) => e.turnsLeft <= 0);
    d.effects = d.effects.filter((e) => e.turnsLeft > 0);
    for (const e of ended) d.events.push({ type: 'effectEnded', kind: e.kind, cardId: e.cardId });
  }

  /** Starts a timed effect from a market card. A running effect of the same kind is replaced (no stacking). */
  function startEffect(d, card) {
    const e = { kind: card.effect, turnsLeft: card.turns, cardId: card.id };
    if (card.effect === 'cheapLoan') e.rate = card.rate; else e.pct = card.pct;
    if (!Array.isArray(d.effects)) d.effects = [];
    d.effects = [...d.effects.filter((x) => x.kind !== e.kind), e];
    d.events.push({ type: 'effectStarted', ...e });
  }

  function marketEvent(d) {
    const card = clone(draw(d, 'market'));
    d.events.push({ type: 'market', card });
    if (TIMED_KINDS.has(card.effect)) {
      startEffect(d, card);
    } else if (card.effect === 'cash') {
      d.cash += card.amount;
    } else if (card.effect === 'stockPrice') {
      d.stockPrices[card.symbol] = card.newPrice;
    } else if (card.effect === 'offer') {
      if (d.mode !== 'full') return; // offer cards are full-mode only (validated); a family game never sells
      const matches = d.assets.filter((a) => a.type === card.targetType);
      if (!matches.length) { d.events.push({ type: 'noMatchingAsset' }); return; }
      const asset = matches.reduce((a, b) => (b.price > a.price ? b : a));
      const offerPrice = Math.round(asset.price * card.offerPct);
      const proceeds = asset.type === 'stock' ? 0 : offerPrice - asset.mortgage;
      d.pending = { kind: 'offer', card, assetId: asset.id, offerPrice, proceeds };
    }
  }

  // ---------- opportunities ----------
  function buy(state, qty = 1) {
    const d = begin(state);
    requirePending(d, 'opportunity');
    const card = d.pending.card;
    if (card.type === 'stock') {
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_STOCK_QTY) fail('bad quantity');
      if (card.maxQty && qty > card.maxQty) fail('quantity above limit');
      const cost = qty * card.price;
      if (d.cash < cost) fail('not enough cash');
      d.cash -= cost;
      const existing = d.assets.find((a) => a.type === 'stock' && a.symbol === card.symbol);
      if (existing) {
        existing.avgCost = Math.round((existing.avgCost * existing.qty + cost) / (existing.qty + qty));
        existing.qty += qty;
        existing.monthlyCashFlow = existing.qty * card.dividend;
      } else {
        d.seq += 1;
        d.assets.push({
          id: `asset-${d.seq}`, cardId: card.id, type: 'stock', symbol: card.symbol,
          title: card.title, qty, avgCost: card.price, dividend: card.dividend,
          monthlyCashFlow: qty * card.dividend,
        });
      }
      d.events.push({ type: 'bought', cardId: card.id, cost, qty });
    } else {
      if (d.cash < card.downPayment) fail('not enough cash');
      d.cash -= card.downPayment;
      d.seq += 1;
      d.assets.push({
        id: `asset-${d.seq}`, cardId: card.id, type: card.type, title: card.title,
        price: card.price, downPayment: card.downPayment, mortgage: card.mortgage,
        monthlyCashFlow: card.monthlyCashFlow,
        ...(Number.isFinite(card.rent) ? { rent: card.rent } : {}), // a rent card changes the flow by rent x pct
        ...(Number.isFinite(card.loanPayment) ? { loanPayment: card.loanPayment } : {}),
      });
      d.events.push({ type: 'bought', cardId: card.id, cost: card.downPayment, qty: 1 });
    }
    logAction(d, 'buy', card.type === 'stock' ? qty : 1);
    recordDecision(d, buyRecord(card, card.type === 'stock' ? qty : 1));
    d.stats.dealsBought += 1;
    d.pending = null;
    settle(d);
    return d;
  }

  function pass(state) {
    const d = begin(state);
    requirePending(d, 'opportunity');
    logAction(d, 'pass');
    recordDecision(d, passRecord(d.pending.card, d.cash));
    d.pending = null;
    d.events.push({ type: 'passed' });
    settle(d);
    return d;
  }

  // ---------- market offer ----------
  function acceptOffer(state) {
    const d = begin(state);
    requirePending(d, 'offer');
    const { assetId, proceeds } = d.pending;
    logAction(d, 'acceptOffer');
    d.assets = d.assets.filter((a) => a.id !== assetId);
    d.cash += proceeds;
    d.stats.dealsSold += 1;
    d.events.push({ type: 'sold', assetId, proceeds });
    d.pending = null;
    settle(d);
    return d;
  }
  function declineOffer(state) {
    const d = begin(state);
    requirePending(d, 'offer');
    logAction(d, 'declineOffer');
    d.pending = null;
    settle(d);
    return d;
  }

  // ---------- charity ----------
  function donate(state) {
    const d = begin(state);
    requirePending(d, 'charity');
    const { cost } = d.pending;
    if (d.cash < cost) fail('not enough cash');
    logAction(d, 'donate');
    payFromCash(d, cost);
    d.charityTurns = CHARITY_TURNS;
    d.stats.donations += 1;
    d.events.push({ type: 'donated', cost });
    d.pending = null;
    settle(d);
    return d;
  }
  function declineCharity(state) {
    const d = begin(state);
    requirePending(d, 'charity');
    logAction(d, 'declineCharity');
    d.events.push({ type: 'charityDeclined', cost: d.pending.cost });
    d.pending = null;
    settle(d);
    return d;
  }

  // ---------- loans ----------
  function takeLoan(state, amount) {
    const d = begin(state);
    if (!Number.isInteger(amount) || amount <= 0 || amount % LOAN_STEP !== 0) {
      fail(`loan must be a positive multiple of ${LOAN_STEP}`);
    }
    if (amount > maxLoan(d)) fail('loan limit reached');
    logAction(d, 'takeLoan', amount);
    // Rate the loan on the state before it is taken (spec 2.2). A loan that covers an expense / shortfall is forced, not rated.
    const p = d.pending;
    const forced = p?.kind === 'expense' || p?.kind === 'shortfall';
    const purchase = p?.kind === 'opportunity';
    const rated = purchase ? isDeal(p.card) : !forced;
    const rating = rated ? loanRating(d, amount, purchase ? { card: p.card, spend: p.card.downPayment } : {}) : null;
    recordDecision(d, {
      kind: 'loan', amount, purpose: forced ? 'forced' : purchase ? 'purchase' : 'voluntary', cardId: purchase ? p.card.id : null,
      rating, green: rating == null ? null : rating === 'sensible',
    });
    if (p?.kind === 'expense') { p.funded = 'loan'; p.loanTotal = (p.loanTotal ?? 0) + amount; }
    d.seq += 1;
    const rate = loanRateNow(d); // a loan taken while a cheap-loan card runs keeps that rate until it is repaid
    d.liabilities.push({
      id: `loan-${d.seq}`, kind: 'loan', label: 'loan', principal: amount,
      monthlyPayment: loanMonthlyPayment(amount, rate), rate,
    });
    d.cash += amount;
    d.stats.loansTaken += 1;
    d.events.push({ type: 'loan', amount });
    settle(d);
    return d;
  }

  /** Repay `amount` (multiple of 1000, or the whole remaining principal) of a liability. Both modes. */
  function repayLoan(state, liabilityId, amount) {
    const d = begin(state);
    const l = d.liabilities.find((x) => x.id === liabilityId);
    if (!l) fail('unknown liability');
    const whole = amount === l.principal;
    if (!Number.isInteger(amount) || amount <= 0 || amount > l.principal ||
        (!whole && amount % LOAN_STEP !== 0)) fail('bad repayment amount');
    if (d.cash < amount) fail('not enough cash');
    logAction(d, 'repayLoan', liabilityId, amount);
    d.cash -= amount;
    const remaining = l.principal - amount;
    const before = l.monthlyPayment;
    l.monthlyPayment = remaining === 0 ? 0 : Math.round(((l.monthlyPayment * remaining) / l.principal) * 100) / 100;
    l.principal = remaining;
    if (remaining === 0) d.liabilities = d.liabilities.filter((x) => x.id !== liabilityId);
    d.events.push({ type: 'repaid', liabilityId, amount, saved: Math.round((before - l.monthlyPayment) * 100) / 100 });
    settle(d);
    return d;
  }

  // ---------- selling (full mode) ----------
  function sellAsset(state, assetId, qty) {
    const d = begin(state);
    if (d.mode !== 'full') fail('selling is full mode only');
    const asset = d.assets.find((a) => a.id === assetId);
    if (!asset) fail('unknown asset');
    if (d.pending?.kind === 'offer' && d.pending.assetId === assetId) fail('asset is under offer');
    let proceeds;
    if (asset.type === 'stock') {
      const q = qty ?? asset.qty;
      if (!Number.isInteger(q) || q < 1 || q > asset.qty) fail('bad quantity');
      logAction(d, 'sellAsset', assetId, q);
      proceeds = saleValue(d, asset, q);
      asset.qty -= q;
      asset.monthlyCashFlow = asset.qty * asset.dividend;
      if (asset.qty === 0) d.assets = d.assets.filter((a) => a.id !== assetId);
    } else {
      logAction(d, 'sellAsset', assetId);
      proceeds = saleValue(d, asset);
      d.assets = d.assets.filter((a) => a.id !== assetId);
    }
    d.cash += proceeds;
    d.stats.dealsSold += 1;
    d.events.push({ type: 'sold', assetId, proceeds });
    if (d.pending?.kind === 'expense' && d.pending.funded !== 'loan') d.pending.funded = 'sale';
    settle(d);
    return d;
  }

  /** Daily challenge only: the player gives the day's attempt up. Ends it as not completed (never a win). */
  function forfeit(state) {
    const d = begin(state);
    if (!d.daily) fail('only a daily challenge can be given up');
    logAction(d, 'forfeit');
    d.pending = null;
    d.status = 'lost'; d.phase = 'ended'; d.daily.gaveUp = true;
    d.events.push({ type: 'gameOver' });
    return d;
  }

  /** Dev/QA only (the UI calls it solely behind ?debug=1). Ends the game as won or lost. */
  function debugForce(state, outcome) {
    if (outcome !== 'win' && outcome !== 'lose') fail(`unknown outcome ${outcome}`);
    const d = begin(state);
    d.pending = null;
    d.status = outcome === 'win' ? 'won' : 'lost';
    d.phase = 'ended';
    if (outcome === 'win') d.winTurn = d.turn;
    d.events.push({ type: outcome === 'win' ? 'win' : 'gameOver' });
    return d;
  }

  return {
    data, newGame, debugForce, forfeit, roll, buy, pass, acceptOffer, declineOffer, donate,
    declineCharity, takeLoan, repayLoan, sellAsset,
  };
}
