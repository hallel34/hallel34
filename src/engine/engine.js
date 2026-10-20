// Pure game engine. No DOM, no Date, no Math.random.
// createEngine(data) returns action functions of the form (state, ...args) => newState.
// The input state is never mutated. All randomness comes from state.rngState.
import {
  BOARD, SCHEMA_VERSION, MAX_KIDS, CHARITY_PCT, CHARITY_TURNS, LOAN_STEP,
  LOAN_PAYMENT_RATE, MAX_STOCK_QTY,
} from './config.js';
import { validateData } from './validate.js';
import {
  monthlyCashFlow, hasWon, maxLoan, saleValue, stockPrice, totalIncome,
  passiveIncome, canSell,
} from './selectors.js';

export class EngineError extends Error {}

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

  function draw(d, deck) {
    if (!d.decks[deck].length) d.decks[deck] = shuffle(d, eligible(deck, d.mode));
    return cardById.get(d.decks[deck].shift());
  }

  // ---------- setup ----------
  function newGame({ mode = 'full', professionId, seed = 1 } = {}) {
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
        expensesPaid: 0, peakPassive: 0, totalPaid: 0,
      },
    };
    for (const deck of Object.keys(d.decks)) d.decks[deck] = shuffle(d, eligible(deck, mode));
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
  }

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
    const amount = monthlyCashFlow(d);
    d.cash += amount;
    d.stats.paydays += 1;
    d.events.push({ type: 'payday', amount });
  }

  function roll(state, forcedDice) {
    const d = begin(state);
    if (d.phase !== 'roll') fail('cannot roll now');
    d.turn += 1;
    const diceCount = d.charityTurns > 0 ? 2 : 1;
    if (d.charityTurns > 0) d.charityTurns -= 1;
    const dice = forcedDice ?? Array.from({ length: diceCount }, () => 1 + randInt(d, 6));
    const steps = dice.reduce((a, b) => a + b, 0);
    const from = d.position;
    const path = [];
    for (let i = 0; i < steps; i++) {
      d.position = (d.position + 1) % BOARD.length;
      path.push(d.position);
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
        d.pending = { kind: 'opportunity', card };
        break;
      }
      case 'expense': {
        const card = clone(draw(d, 'expense'));
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

  function marketEvent(d) {
    const card = clone(draw(d, 'market'));
    d.events.push({ type: 'market', card });
    if (card.effect === 'cash') {
      d.cash += card.amount;
    } else if (card.effect === 'stockPrice') {
      d.stockPrices[card.symbol] = card.newPrice;
    } else if (card.effect === 'offer') {
      if (d.mode !== 'full') return; // family: no selling
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
      });
      d.events.push({ type: 'bought', cardId: card.id, cost: card.downPayment, qty: 1 });
    }
    d.stats.dealsBought += 1;
    d.pending = null;
    settle(d);
    return d;
  }

  function pass(state) {
    const d = begin(state);
    requirePending(d, 'opportunity');
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
    d.seq += 1;
    d.liabilities.push({
      id: `loan-${d.seq}`, kind: 'loan', label: 'loan', principal: amount,
      monthlyPayment: amount * LOAN_PAYMENT_RATE,
    });
    d.cash += amount;
    d.stats.loansTaken += 1;
    d.events.push({ type: 'loan', amount });
    settle(d);
    return d;
  }

  /** Full mode only. Repay `amount` (multiple of 1000) of a liability. */
  function repayLoan(state, liabilityId, amount) {
    const d = begin(state);
    if (d.mode !== 'full') fail('repayment is full mode only');
    const l = d.liabilities.find((x) => x.id === liabilityId);
    if (!l) fail('unknown liability');
    const whole = amount === l.principal;
    if (!Number.isInteger(amount) || amount <= 0 || amount > l.principal ||
        (!whole && amount % LOAN_STEP !== 0)) fail('bad repayment amount');
    if (d.cash < amount) fail('not enough cash');
    d.cash -= amount;
    const remaining = l.principal - amount;
    l.monthlyPayment = remaining === 0 ? 0 : (l.monthlyPayment * remaining) / l.principal;
    l.principal = remaining;
    if (remaining === 0) d.liabilities = d.liabilities.filter((x) => x.id !== liabilityId);
    d.events.push({ type: 'repaid', liabilityId, amount });
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
      proceeds = saleValue(d, asset, q);
      asset.qty -= q;
      asset.monthlyCashFlow = asset.qty * asset.dividend;
      if (asset.qty === 0) d.assets = d.assets.filter((a) => a.id !== assetId);
    } else {
      proceeds = saleValue(d, asset);
      d.assets = d.assets.filter((a) => a.id !== assetId);
    }
    d.cash += proceeds;
    d.stats.dealsSold += 1;
    d.events.push({ type: 'sold', assetId, proceeds });
    settle(d);
    return d;
  }

  return {
    data, newGame, roll, buy, pass, acceptOffer, declineOffer, donate,
    declineCharity, takeLoan, repayLoan, sellAsset,
  };
}
