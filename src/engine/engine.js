// Pure game engine. No DOM, no clock, no unseeded randomness.
// createEngine(data) returns action functions of the form (state, ...args) => newState, and dispatch(state, action),
// the one entry point the UI, the bots and replay() use (every dispatched action is appended to state.log).
// The input state is never mutated. Randomness: rngVersion 2 (every new game) derives each die, card and pick from
// (seed, purpose, turn, index) only (rng.js, docs/RNG.md); rngVersion 1 (saves up to v0.4) keeps the mulberry32 stream
// in state.rngState and the shuffled deck arrays, unchanged.
import {
  BOARD, SCHEMA_VERSION, MAX_KIDS, CHARITY_PCT, CHARITY_TURNS, LOAN_STEP,
  MAX_STOCK_QTY, PAYDAY_MONTHS, INFLATION_PRICE_ROUND, TIMED_EFFECT_KINDS, INFLATION_FLOW_ROUND, INFLATION_EXPENSE_ROUND,
  MILESTONES, TAX_AUDIT_PICKS, TAX_AUDIT_POINTS, JUNIOR_ROUND, JUNIOR_PRICE_ROUND, JUNIOR_LOAN_STEP,
} from './config.js';
import { validateData } from './validate.js';
import { cardView } from './card-view.js';
import {
  monthlyCashFlow, hasWon, maxLoan, saleValue, stockPrice, totalIncome,
  passiveIncome, canSell, loanMonthlyPayment, loanRateNow, priceFactor, expenseFactor, loanLimits, loanPayments, bankLoanPrincipal,
  passiveRatio, loanStep, totalExpenses,
} from './selectors.js';
import { emptyLearn, recordDecision, buyRecord, passRecord, loanRating, isDeal } from './learn.js';
import { dailyDie, dailyPick, DAILY_TURN_CAP, dailyRngVersion } from './daily.js';
import { RNG_V1, RNG_V2, RNG_VERSION, V2_DRAW_SCHEME, v2Die, v2RerollDie, v2AuditPick, v2DeckOrder, v2DeckCycle, stableStringify } from './rng.js';
import { recordGuess, dealMetrics } from './learn.js';
import { renovationLevel, renovationLevelsFor, RENOVATION_STYLES } from './renovation.js';

export class EngineError extends Error {}

/** The tax-audit record of one game (schema 5): the questions asked and the knowledge points earned. Never read by a money rule. */
/** An opportunity decision card whose options all cost something also offers the plain pass ('לא עכשיו'). */
export const PASS_OPTION = 'pass';
export const isFreeOption = (o) => !o.effects || Object.keys(o.effects).length === 0;
export const decisionCanPass = (card) => card.square === 'opportunity' && !card.options.some(isFreeOption);
export const emptyTaxAudit = () => ({ points: 0, asked: [] });

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

/**
 * 'צעירים' round rules for a NEW deal (after inflation): price and down payment to JUNIOR_PRICE_ROUND, mortgage = price - down,
 * rent / profit / loan payment and cash flow to JUNIOR_ROUND, so every number on the card is a whole number of coins.
 */
export function juniorDeal(card) {
  if (card.type === 'stock') return card;
  card.price = Math.max(JUNIOR_PRICE_ROUND, roundTo(card.price, JUNIOR_PRICE_ROUND));
  card.downPayment = Math.max(JUNIOR_PRICE_ROUND, roundTo(card.downPayment, JUNIOR_PRICE_ROUND));
  if (Number.isFinite(card.mortgage)) card.mortgage = Math.max(0, card.price - card.downPayment);
  const gross = card.type === 'business' ? 'profit' : 'rent';
  if (Number.isFinite(card[gross]) && Number.isFinite(card.loanPayment)) {
    card[gross] = roundTo(card[gross], JUNIOR_ROUND);
    card.loanPayment = roundTo(card.loanPayment, JUNIOR_ROUND);
    card.monthlyCashFlow = card[gross] - card.loanPayment;
  } else {
    card.monthlyCashFlow = roundTo(card.monthlyCashFlow, JUNIOR_ROUND);
    if (Number.isFinite(card.loanPayment)) card.loanPayment = roundTo(card.loanPayment, JUNIOR_ROUND);
    if (Number.isFinite(card[gross])) card[gross] = roundTo(card[gross], JUNIOR_ROUND);
  }
  return card;
}

/** The profession of a junior game: salary, expenses and the per-child cost to 100; starting debts to 1,000 / 100 a month. */
function juniorProfession(p) {
  const r = (x) => roundTo(x, JUNIOR_ROUND);
  return { ...p, salary: r(p.salary), perChild: r(p.perChild), expenses: p.expenses.map((e) => ({ ...e, amount: r(e.amount) })) };
}

/**
 * A card a junior game never deals: the cheap-loan card (half a coin a month) and a decision card with an amount that is not
 * whole coins (or a fixed loan that is not a JUNIOR_LOAN_STEP multiple). The other decision cards keep their numbers.
 */
const MONEY_FIELDS = ['price', 'downPayment', 'mortgage', 'monthlyCashFlow', 'profit', 'rent', 'loanPayment', 'pay', 'repay'];
export function juniorSkips(c) {
  if (c.effect === 'cheapLoan') return true;
  if (c.deck !== 'decision') return false;
  const round = (v) => !Number.isFinite(v) || v % JUNIOR_ROUND === 0;
  return c.options.some((o) => {
    const fx = o.effects ?? {};
    if (Number.isFinite(fx.loan) && fx.loan % JUNIOR_LOAN_STEP !== 0) return true;
    if (Number.isFinite(fx.repay) && fx.repay % JUNIOR_LOAN_STEP !== 0) return true;
    if (!MONEY_FIELDS.every((k) => round(fx[k]))) return true;
    return [...(fx.buy ?? []), ...(fx.stocks ?? [])].some((x) => !MONEY_FIELDS.every((k) => round(x[k])) || !round(x.price));
  });
}

export const DEAL_TIERS = [
  { maxStage: 0.25, min: 0, max: 0.4 },
  { maxStage: 0.5, min: 0.12, max: 0.55 },
  { maxStage: 0.75, min: 0.22, max: 0.75 },
  { maxStage: Infinity, min: 0.32, max: Infinity },
];
/**
 * v0.5 (owner-approved balance change 2026-11-03, docs/BALANCE.md): the bands of rngVersion 2 games. A keyed pile never runs
 * out of in-tier deals, so v1's soft filter (out-of-tier deals came through once a cycle's in-tier deals were used up) became
 * strict. Family mode is recalibrated so v2 plays like v0.4 did: only the lower bounds moved (v0.4: 0.12 / 0.22 / 0.32), they
 * decide how soon the small deals leave a growing player's offers. Full mode already plays like v0.4 on the v0.4 bands.
 * v1 games (old saves) keep DEAL_TIERS.
 */
export const DEAL_TIERS_V2 = {
  family: [
    { maxStage: 0.25, min: 0, max: 0.4 },
    { maxStage: 0.5, min: 0.08, max: 0.55 },
    { maxStage: 0.75, min: 0.15, max: 0.75 },
    { maxStage: Infinity, min: 0.22, max: Infinity },
  ],
  full: DEAL_TIERS,
};
/** The tier bands a game uses: rngVersion 2 -> DEAL_TIERS_V2[mode], otherwise (v1) DEAL_TIERS. */
export const dealTiersOf = (d) => (d?.rngVersion === 2 ? DEAL_TIERS_V2[d.mode] ?? DEAL_TIERS : DEAL_TIERS);
/** The deal tier (0-3) of a player: their stage on the road to freedom (passive income / expenses). */
export function dealTierIndex(d) {
  const stage = passiveRatio(d);
  const tiers = dealTiersOf(d);
  const i = tiers.findIndex((t) => stage < t.maxStage);
  return i === -1 ? tiers.length - 1 : i;
}

const clone = (x) => structuredClone(x);

// ---------- an auction on a bidder's own state (hot-seat; the match runs the bidding, auction.js) ----------
/** The lowest legal winning bid of an open auction: one step, and at least the floor rounded up to a step. */
export const auctionMinBidOf = (o) => Math.max(o.step, Math.ceil((o.floor ?? 0) / o.step) * o.step);
/** The bidder's state with the auction open on it (the dispatch action `auctionOpen`, without the log entry). */
export function auctionOpenState(state, { card, floor, step }) {
  if (state.status !== 'playing') throw new EngineError('game is over');
  if (!['apartment', 'business'].includes(card?.type)) throw new EngineError('only a deal can be auctioned');
  if (!Number.isInteger(step) || step <= 0 || !Number.isInteger(floor) || floor < 0) throw new EngineError('bad auction rules');
  const d = structuredClone(state);
  d.auctionOpen = { card: structuredClone(card), floor, step };
  return d; // the events of the bidder's last action stay as they were
}
/** The bidder's state with the open auction closed (the dispatch action `auctionClose`, without the log entry). */
export function auctionCloseState(state) {
  if (!state.auctionOpen) throw new EngineError('no auction open');
  const d = structuredClone(state);
  delete d.auctionOpen;
  return d;
}
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

/** The engine RNG version of a state: a state without the field is a v0.4 (or older) game, i.e. version 1. */
export const rngVersionOf = (d) => (d?.rngVersion === RNG_V2 ? RNG_V2 : RNG_V1);
const isV1 = (d) => rngVersionOf(d) === RNG_V1;
export const DECKS = ['opportunity', 'expense', 'market'];

/**
 * @param drawScheme rngVersion 2 card draws (default V2_DRAW_SCHEME, rng.js): 'turn' (the card of deck D on turn t is keyed by
 *   (seed, D, t)) or 'positional' (the n-th draw of D replays its keyed cycle). The other one exists so scripts/rng-fairness.js
 *   and `npm run simulate -- --rng=...` can re-measure the comparison in docs/RNG.md; saves do not carry it.
 */
export function createEngine(data, { validate = true, drawScheme = V2_DRAW_SCHEME } = {}) {
  if (validate) validateData(data);
  if (drawScheme !== 'turn' && drawScheme !== 'positional') throw new EngineError(`unknown draw scheme ${drawScheme}`);
  const cardById = new Map(data.cards.map((c) => [c.id, c]));
  const professionById = new Map(data.professions.map((p) => [p.id, p]));

  // A square's draw pile: its own deck plus the decision cards dealt on it (`square`, v4 stage 4).
  const eligible = (deck, mode, junior = false) =>
    data.cards.filter((c) => (c.deck === deck || (c.deck === 'decision' && c.square === deck)) && c.modes.includes(mode) && !(junior && juniorSkips(c))).map((c) => c.id);

  // A card may carry the children's wording (titleFamily / textFamily): a family game draws the card with that wording in
  // title/text, so every screen, log line and asset name downstream is already in the right register. Numbers never differ.
  const view = cardView;

  // A decision card with `requires` (own an apartment, owe a bank loan of at least X) is skipped when the player does not meet
  // it: the next card of the deck is drawn and the skipped one goes to the bottom. The daily challenge deals no decision cards
  // at all (its piles are the classic decks), so its card stream is unchanged and the same for everyone.
  const dailyEligible = (deck, mode) => data.cards.filter((c) => c.deck === deck && c.modes.includes(mode)).map((c) => c.id);
  // ---------- rngVersion 2 draws: no pile in the state, nothing a decision can shift ----------
  // The v1 pile rules, applied to a keyed order instead of a stored pile:
  //  - a card whose `requires` is not met goes to the bottom (after 64 tries it is dealt anyway, as in v1);
  //  - an out-of-tier deal is swapped with the first in-tier deal still in the pile (none left: it stands);
  //  - the deal-choice alternative is a peek at the pile after the drawn card.
  // 'turn': the pile of deck D on turn t is the eligible list in an order keyed by (seed, D, t), freshly shuffled: the card is
  //   its first draw. 'positional': the n-th draw of D replays cycle floor(n / len) (order keyed by (seed, D, cycle)) up to
  //   position n mod len, with the player's current requirements and tier (the v1 pile, rebuilt instead of stored).
  // The daily challenge walks its classic piles (no decision cards) with no tiers and no choice, as before.
  let lastPile = null; // transient (one synchronous resolveSquare): the pile left after the last v2 opportunity draw
  function pileStep(d, deck, pile, ok, fits) {
    for (let tries = 0; ; tries++) {
      const id = pile.shift();
      if (ok(id) || tries > 64) {
        if (fits && !fits(id)) {
          const idx = pile.findIndex((x) => x !== id && isDealCard(cardById.get(x)) && fits(x) && ok(x));
          if (idx !== -1) { const swap = pile[idx]; pile[idx] = id; return swap; }
        }
        return id;
      }
      pile.push(id);
    }
  }
  function drawV2(d, deck) {
    const ids = d.daily ? dailyEligible(deck, d.mode) : eligible(deck, d.mode, !!d.junior);
    if (!d.draws) d.draws = { opportunity: 0, expense: 0, market: 0 };
    const n = d.draws[deck] ?? 0;
    d.draws[deck] = n + 1;
    // the player's predicates, evaluated once for this draw
    const met = new Map();
    const ok = (id) => { if (!met.has(id)) { const c = cardById.get(id); met.set(id, !c.requires || meetsRequires(d, c.requires)); } return met.get(id); };
    const tiered = !d.daily && deck === 'opportunity';
    const fitMemo = new Map();
    const fits = tiered ? (id) => { if (!fitMemo.has(id)) { const c = cardById.get(id); fitMemo.set(id, !isDealCard(c) || dealFitsTier(d, c)); } return fitMemo.get(id); } : null;
    let pile; let id;
    if (drawScheme === 'positional') {
      pile = v2DeckCycle(d.seed, deck, Math.floor(n / ids.length), ids);
      for (let k = 0; k <= n % ids.length; k++) id = pileStep(d, deck, pile, ok, fits);
    } else {
      pile = v2DeckOrder(d.seed, deck, d.turn, ids);
      id = pileStep(d, deck, pile, ok, fits);
    }
    if (deck === 'opportunity') lastPile = pile;
    return view(cardById.get(id), d.mode);
  }

  function draw(d, deck) {
    if (!isV1(d)) return drawV2(d, deck);
    if (d.daily) { // daily challenge: the card of this turn depends on (seed, deck, turn) only, never on earlier choices
      const ids = dailyEligible(deck, d.mode);
      return view(cardById.get(ids[dailyPick(d.seed, deck, d.turn, ids.length)]), d.mode);
    }
    for (let tries = 0; ; tries++) {
      if (!d.decks[deck].length) d.decks[deck] = shuffle(d, eligible(deck, d.mode, !!d.junior));
      const card = cardById.get(d.decks[deck].shift());
      if (!card.requires || meetsRequires(d, card.requires) || tries > 64) {
        // v0.4 tiered deal pools: an out-of-tier deal is swapped with the first in-tier deal still in the pile
        // (the out-of-tier card takes its slot — nothing is removed, the pile's size and order otherwise stand).
        if (deck === 'opportunity' && isDealCard(card) && !dealFitsTier(d, card)) {
          const idx = d.decks[deck].findIndex((id) => {
            const c = cardById.get(id);
            return c && c.id !== card.id && isDealCard(c) && dealFitsTier(d, c) && (!c.requires || meetsRequires(d, c.requires));
          });
          if (idx !== -1) {
            const swapId = d.decks[deck][idx];
            d.decks[deck][idx] = card.id;
            return view(cardById.get(swapId), d.mode);
          }
        }
        return view(card, d.mode);
      }
      d.decks[deck].push(card.id);
    }
  }

  // v0.4 tiered deal pools (improvement plan, axis 1): the deals a player is offered grow with their stage.
  // A deal's size is its monthly cash flow RELATIVE to that player's own total monthly expenses, and the bands
  // are calibrated to the existing catalogue (positive flows run ₪500–₪8,500 against expenses of ₪5,600–₪11,400,
  // so the plan's literal percentages were widened to the catalogue's real spread — the intent is unchanged:
  // small deals early, big deals late, per player, never a global rubber band). Negative-flow trap deals always
  // "fit": they are judgement tests, not sized deals. The daily challenge is exempt (drawn deterministically).
  const isDealCard = (c) => c && (c.type === 'apartment' || c.type === 'business') && Number.isFinite(c.monthlyCashFlow);
  function dealFitsTier(d, card) {
    if (!isDealCard(card) || card.monthlyCashFlow <= 0) return true;
    const exp = totalExpenses(d);
    if (!exp) return true;
    const tier = dealTiersOf(d)[dealTierIndex(d)];
    const ratio = card.monthlyCashFlow / exp;
    return ratio >= tier.min && ratio <= tier.max;
  }

  // v0.4 deal choice: the second deal offered alongside the drawn one on an opportunity square. It is a PEEK at
  // the next apartment/business in the opportunity pile (not the drawn card, `requires` met), priced exactly like
  // a drawn deal (lap inflation, junior rounding). The card is NOT removed from the pile: the main card stream —
  // and with it the game's balance and every seeded sequence — stays exactly as before, and a deal the player
  // did not pick simply comes up again as a later offer (or goes to auction when the picked one is bought).
  // Returns null when the pile holds no second deal — the square then plays as a classic single-deal card.
  // The daily challenge never offers a choice: its card stream stays (seed, turn)-determined for everyone.
  function drawAltDeal(d, first) {
    if (d.daily) return null;
    if (!isV1(d)) return altFrom(d, first, lastPile.length ? lastPile : v2DeckOrder(d.seed, 'opportunity:alt', d.turn, eligible('opportunity', d.mode, !!d.junior)));
    if (!d.decks.opportunity.length) d.decks.opportunity = shuffle(d, eligible('opportunity', d.mode, !!d.junior));
    return altFrom(d, first, d.decks.opportunity);
  }
  function altFrom(d, first, pile) {
    const candidates = pile.filter((candidate) => {
      const c = cardById.get(candidate);
      return c && c.id !== first.id && (c.type === 'apartment' || c.type === 'business') && (!c.requires || meetsRequires(d, c.requires));
    });
    // the offered alternative follows the same tiering as the main draw, with any deal as the fallback
    const id = candidates.find((candidate) => dealFitsTier(d, cardById.get(candidate))) ?? candidates[0];
    if (!id) return null;
    const card = clone(view(cardById.get(id), d.mode));
    inflateDeal(card, priceFactor(d));
    if (d.junior) juniorDeal(card);
    return card;
  }

  // ---------- setup ----------
  function newGame({ mode = 'full', professionId, seed = 1, daily = null, junior = false, rngVersion = null, challenge = false } = {}) {
    if (mode !== 'family' && mode !== 'full') fail(`unknown mode ${mode}`);
    if (junior && (mode !== 'family' || daily)) fail('a junior game is a family game (and never the daily challenge)');
    if (challenge && daily) fail('a friend challenge is never the daily challenge');
    const raw = professionById.get(professionId ?? data.professions[0].id);
    if (!raw) fail(`unknown profession ${professionId}`);
    const profession = junior ? juniorProfession(raw) : raw;
    // a new normal game is rngVersion 2; the daily challenge follows its date (DAILY_RNG_V2_FROM); 1 only on request (tests)
    const version = rngVersion ?? (daily ? dailyRngVersion(daily.date) : RNG_VERSION);
    if (version !== RNG_V1 && version !== RNG_V2) fail(`unknown rng version ${version}`);
    const d = {
      schemaVersion: SCHEMA_VERSION,
      mode,
      seed,
      rngVersion: version,
      ...(version === RNG_V1 ? { rngState: seed >>> 0 } : {}),
      profession: clone({
        id: profession.id, title: profession.title, salary: profession.salary,
        perChild: profession.perChild, expenses: profession.expenses,
      }),
      cash: junior ? roundTo(profession.savings, JUNIOR_ROUND) : profession.savings,
      assets: [],
      liabilities: profession.liabilities.map((l) => (junior
        ? { ...l, kind: 'base', principal: Math.max(JUNIOR_PRICE_ROUND, roundTo(l.principal, JUNIOR_PRICE_ROUND)), monthlyPayment: Math.max(JUNIOR_ROUND, roundTo(l.monthlyPayment, JUNIOR_ROUND)) }
        : { ...l, kind: 'base' })),
      kids: 0,
      position: 0,
      turn: 0,
      rerollTokens: 0, // schema 8 (v0.4): 'גלגול שוב' tokens earned by investor's-eye guess streaks (max 2)
      rerollArmed: false, // a token armed for the next roll: two dice sets are rolled, the higher total moves
      lap: 0, // passes of square 0 (price inflation reads it)
      effects: [], // timed market effects: { kind, pct | rate, turnsLeft, cardId }
      milestones: [], // schema 5: passive-income milestones (MILESTONES, % of expenses) already celebrated in this game
      taxAudit: emptyTaxAudit(), // schema 5: tax-audit quiz answers and knowledge points (no money)
      charityTurns: 0,
      stockPrices: {},
      ...(version === RNG_V1 ? { decks: { opportunity: [], expense: [], market: [] } } : { draws: { opportunity: 0, expense: 0, market: 0 } }),
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
      log: [], // schema 9: every dispatched action, in order (replay / action-log links)
    };
    if (junior) d.junior = true; // 'צעירים' round rules (schema 6)
    // 0.5.1 friend challenge (owner 2026-11-03, docs/RNG.md §4): charity gives no bonus die and no reroll can be armed, so both
    // players on the seed stay on the same squares. Optional field: no schema change (old saves simply have no challenge).
    if (challenge) d.challenge = true;
    if (daily) {
      // opt-in rules flag: pre-determined dice / card streams (see daily.js) and an action log for later verification
      d.daily = { date: String(daily.date), turnCap: daily.turnCap ?? DAILY_TURN_CAP, log: [] };
    } else if (version === RNG_V1) {
      for (const deck of Object.keys(d.decks)) d.decks[deck] = shuffle(d, eligible(deck, mode, junior));
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
    // v4 milestones: the first time passive income covers 25% / 50% of the expenses in this game (once each, kept in the save)
    if (!Array.isArray(d.milestones)) d.milestones = [];
    const ratio = passiveRatio(d);
    for (const pct of MILESTONES) {
      if (ratio * 100 >= pct && !d.milestones.includes(pct)) { d.milestones.push(pct); d.events.push({ type: 'milestone', pct }); }
    }
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

  /**
   * v0.4: arm (or disarm) a reroll token for the next roll. Arming is free and reversible until the roll;
   * the roll itself consumes the token. The daily challenge cannot arm one — its dice are (seed, turn)-fixed,
   * so a second set would be the same dice.
   */
  function armReroll(state) {
    const d = begin(state);
    if (d.phase !== 'roll') fail('cannot arm a reroll now');
    if (d.daily) fail('no reroll in the daily challenge');
    if (d.challenge) fail('no reroll in a friend challenge');
    if (!d.rerollArmed && !(d.rerollTokens > 0)) fail('no reroll token');
    d.rerollArmed = !d.rerollArmed;
    d.events.push({ type: 'rerollArmed', armed: d.rerollArmed });
    settle(d);
    return d;
  }

  function roll(state, forcedDice) {
    const d = begin(state);
    if (d.phase !== 'roll') fail('cannot roll now');
    d.turn += 1;
    logAction(d, 'roll');
    tickEffects(d);
    // a friend challenge never rolls charity's bonus die (the donation itself still happens)
    const diceCount = d.charityTurns > 0 && !d.challenge ? 2 : 1;
    if (d.charityTurns > 0) d.charityTurns -= 1;
    const v1 = isV1(d);
    // v2: die k of turn t is keyed by (seed, 'dice', t, k): the charity bonus die is k = 1 of the same turn, so it never shifts a later value
    const v1Die = (k) => (d.daily ? dailyDie(d.seed, d.turn, k) : 1 + randInt(d, 6));
    const rollSet = (die) => forcedDice ?? Array.from({ length: diceCount }, (_, k) => die(k));
    let dice = rollSet(v1 ? v1Die : (k) => v2Die(d.seed, d.turn, k));
    // v0.4: an armed reroll token rolls a second set and keeps the higher total (the token is spent either way)
    if (d.rerollArmed && d.rerollTokens > 0 && !d.daily && !d.challenge) {
      const second = rollSet(v1 ? v1Die : (k) => v2RerollDie(d.seed, d.turn, k));
      const total = (set) => set.reduce((a, b) => a + b, 0);
      d.rerollTokens -= 1;
      d.events.push({ type: 'reroll', kept: total(second) > total(dice) ? second : dice, dropped: total(second) > total(dice) ? dice : second, first: dice });
      if (total(second) > total(dice)) dice = second;
    }
    d.rerollArmed = false;
    const steps = dice.reduce((a, b) => a + b, 0);
    const from = d.position;
    const path = [];
    // v0.4 (owner decision 2026-11-02, QA P0): at most ONE annual summary per turn. Payday squares sit 3 apart
    // (indices 4, 7, 10), so one roll — above all a charity roll with 2 dice — could cross two of them and credit
    // the annual flow twice in a single turn. The first payday square on the path settles the turn; any further
    // payday square on the same path is crossed/landed on without another credit.
    let paydaySettled = false;
    for (let i = 0; i < steps; i++) {
      d.position = (d.position + 1) % BOARD.length;
      path.push(d.position);
      if (d.position === 0) d.lap = (d.lap ?? 0) + 1;
      if (!paydaySettled && BOARD[d.position] === 'payday') { payday(d); paydaySettled = true; } // passing or landing, once per turn
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
        if (card.deck === 'decision') { startDecision(d, card); break; }
        if (card.type === 'stock') card.price = stockPrice(d, card.symbol, card.price);
        else { inflateDeal(card, priceFactor(d)); if (d.junior) juniorDeal(card); }
        // v0.4: a deal (apartment/business) comes with a second deal to choose between — see drawAltDeal.
        const alt = card.type === 'stock' ? null : drawAltDeal(d, card);
        d.pending = { kind: 'opportunity', card, ...(alt ? { alt } : {}) };
        break;
      }
      case 'expense': {
        const card = clone(draw(d, 'expense'));
        if (card.deck === 'decision') { startDecision(d, card); break; }
        const fx = expenseFactor(d);
        if (fx !== 1) { card.amount = Math.round((card.amount * fx) / INFLATION_EXPENSE_ROUND) * INFLATION_EXPENSE_ROUND; card.inflation = fx; }
        if (d.junior) card.amount = Math.max(JUNIOR_ROUND, roundTo(card.amount, JUNIOR_ROUND));
        d.pending = { kind: 'expense', card, amount: card.amount };
        break;
      }
      case 'market': marketEvent(d); break;
      case 'baby':
        if (d.kids < MAX_KIDS) {
          d.kids += 1;
          d.events.push({ type: 'baby', kids: d.kids, extra: d.profession.perChild }); // junior: perChild is already round
        } else d.events.push({ type: 'babyMax' });
        break;
      case 'charity': {
        const q = d.junior ? JUNIOR_ROUND : 10;
        const cost = Math.round((totalIncome(d) * CHARITY_PCT) / q) * q;
        d.pending = { kind: 'charity', cost };
        break;
      }
      case 'taxAudit': {
        // a junior game asks no tax question: the quiz is about real 2026 shekel figures (they stay hidden in junior)
        if (d.junior) { d.events.push({ type: 'taxAuditRest' }); break; }
        // v4 'ביקורת רשות המסים': a quiz question from the learn bank. `pick` chooses it (the UI maps it onto the questions of
        // the mode); the answer gives knowledge points only. Daily challenge: the pick depends on (seed, turn) only.
        const pick = !isV1(d) ? v2AuditPick(d.seed, d.turn, TAX_AUDIT_PICKS)
          : d.daily ? dailyPick(d.seed, 'taxAudit', d.turn, TAX_AUDIT_PICKS) : randInt(d, TAX_AUDIT_PICKS);
        d.pending = { kind: 'taxAudit', pick };
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
      if (d.junior) card.amount = roundTo(card.amount, JUNIOR_ROUND);
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

  // ---------- decision cards (v4 stage 4, docs/v4/decision-cards.md) ----------
  // A card of type 'decision' (opportunity or expense deck) offers 2-3 options. Each option's `effects` are built from the
  // existing moves, applied in this order: sell (a market-style offer on the player's most expensive asset of a type) ->
  // loan (a bank loan, engine rules: LOAN_STEP, the cash-flow floor and, unless the card is an expense, the purchase cap) ->
  // buy (assets, paid by their down payments) / stocks / pay (an expense) -> repay (bank loans). An option that would fail
  // on the current state is "not available"; the card's numbers are never inflated (its text names them).
  function meetsRequires(s, req) {
    if (!req) return true;
    if (req.asset && !s.assets.some((a) => a.type === req.asset)) return false;
    if (Number.isFinite(req.bankLoan) && bankLoanPrincipal(s) < req.bankLoan) return false;
    return true;
  }

  /** Applies an option's effects to `d` (a working copy). Returns null, or the reason code it cannot be applied. */
  function applyOption(d, card, opt, record) {
    const fx = opt.effects ?? {};
    let saleProceeds = 0;
    if (fx.sell) {
      const matches = d.assets.filter((a) => a.type === fx.sell.targetType);
      if (!matches.length) return 'asset';
      const asset = matches.reduce((a, b) => (b.price > a.price ? b : a));
      saleProceeds = Math.round(asset.price * fx.sell.offerPct) - asset.mortgage;
      d.assets = d.assets.filter((a) => a.id !== asset.id);
      d.cash += saleProceeds;
      d.stats.dealsSold += 1;
      if (record) d.events.push({ type: 'sold', assetId: asset.id, proceeds: saleProceeds, monthly: asset.monthlyCashFlow });
    }
    const buys = Array.isArray(fx.buy) ? fx.buy : [];
    const down = buys.reduce((a, x) => a + x.downPayment, 0);
    const step = loanStep(d);
    const loan = fx.loan === 'down' ? Math.ceil(down / step) * step : (fx.loan ?? 0);
    if (loan > 0) {
      const lim = loanLimits(d, { forced: !!card.expenseLoan, gain: buys.reduce((a, x) => a + x.monthlyCashFlow, 0) });
      if (loan > lim.max) return lim.netBinds ? 'net' : 'loan';
      d.seq += 1;
      const rate = loanRateNow(d);
      d.liabilities.push({ id: `loan-${d.seq}`, kind: 'loan', label: 'loan', principal: loan, monthlyPayment: loanMonthlyPayment(loan, rate), rate });
      d.cash += loan;
      d.stats.loansTaken += 1;
      if (record) d.events.push({ type: 'loan', amount: loan });
    }
    const stocks = Array.isArray(fx.stocks) ? fx.stocks : [];
    const cost = down + stocks.reduce((a, x) => a + x.qty * x.price, 0) + (fx.pay ?? 0);
    if (cost > 0 && d.cash < cost) return 'cash';
    d.cash -= cost;
    if (fx.pay) { d.stats.totalPaid += fx.pay; d.stats.expensesPaid += 1; }
    for (const a of buys) {
      d.seq += 1;
      const { title, ...nums } = a;
      d.assets.push({ id: `asset-${d.seq}`, cardId: card.id, title: title ?? card.title, ...nums });
      d.stats.dealsBought += 1;
      if (record) recordDecision(d, buyRecord({ ...a, id: card.id, title: title ?? card.title }, 1));
    }
    for (const x of stocks) {
      const existing = d.assets.find((a) => a.type === 'stock' && a.symbol === x.symbol);
      if (existing) {
        existing.avgCost = Math.round((existing.avgCost * existing.qty + x.qty * x.price) / (existing.qty + x.qty));
        existing.qty += x.qty;
        existing.dividend = x.dividend;
        existing.monthlyCashFlow = existing.qty * existing.dividend;
      } else {
        d.seq += 1;
        d.assets.push({ id: `asset-${d.seq}`, cardId: card.id, type: 'stock', symbol: x.symbol, title: x.title ?? x.symbol, qty: x.qty, avgCost: x.price, dividend: x.dividend, monthlyCashFlow: x.qty * x.dividend });
      }
      d.stats.dealsBought += 1;
    }
    if (fx.repay) {
      const loans = d.liabilities.filter((l) => l.kind === 'loan').sort((a, b) => b.monthlyPayment / b.principal - a.monthlyPayment / a.principal);
      const owed = loans.reduce((a, l) => a + l.principal, 0);
      if (!owed) return 'bankLoan';
      let left = fx.repay === 'all' ? Math.min(owed, d.cash) : fx.repay;
      if (left <= 0) return 'cash';
      if (fx.repay !== 'all' && (owed < left)) return 'bankLoan';
      if (d.cash < left) return 'cash';
      let repaid = 0; let saved = 0;
      for (const l of loans) {
        if (left <= 0) break;
        const amt = Math.min(l.principal, left);
        const before = l.monthlyPayment;
        const remaining = l.principal - amt;
        l.monthlyPayment = remaining === 0 ? 0 : Math.round(((l.monthlyPayment * remaining) / l.principal) * 100) / 100;
        l.principal = remaining;
        saved += before - l.monthlyPayment; repaid += amt; left -= amt;
      }
      d.liabilities = d.liabilities.filter((l) => !(l.kind === 'loan' && l.principal === 0));
      d.cash -= repaid;
      if (record) d.events.push({ type: 'repaid', amount: repaid, saved: Math.round(saved * 100) / 100 });
    }
    return null;
  }

  /** [{ id, available, reason }] for the pending decision card (reason: 'cash' | 'loan' | 'asset' | 'bankLoan'). */
  function decisionOptions(state) {
    const p = state.pending;
    if (p?.kind !== 'decision') return [];
    return p.card.options.map((opt) => {
      const reason = applyOption(clone(state), p.card, opt, false);
      return { id: opt.id, available: reason === null, reason };
    });
  }

  function startDecision(d, card) {
    d.pending = { kind: 'decision', card };
    // an expense decision with nothing the player can do (no cash, no loan room) is an ordinary expense: the shortfall rules apply
    if (card.expenseLoan && !decisionOptions(d).some((o) => o.available)) {
      const amount = Math.max(...card.options.map((o) => o.effects?.pay ?? 0));
      d.pending = { kind: 'expense', card: { ...card, amount }, amount };
    }
  }

  /** Plays option `optionId` of the pending decision card. */
  function decide(state, optionId) {
    const d = begin(state);
    requirePending(d, 'decision');
    const card = d.pending.card;
    const opt = optionId === PASS_OPTION && decisionCanPass(card) ? { id: PASS_OPTION, effects: {} } : card.options.find((o) => o.id === optionId);
    if (!opt) fail(`unknown option ${optionId}`);
    const cashBefore = d.cash;
    const passiveBefore = passiveIncome(d);
    const loansBefore = loanPayments(d);
    const reason = applyOption(d, card, opt, true);
    if (reason) fail(`option not available: ${reason}`);
    logAction(d, 'decide', optionId);
    const delta = { cash: d.cash - cashBefore, passive: passiveIncome(d) - passiveBefore, loanPayment: Math.round((loanPayments(d) - loansBefore) * 100) / 100 };
    if (card.square === 'expense') {
      // an expense decision is also an expense record (the cushion lesson): green when it was paid from cash alone
      const fx = opt.effects ?? {};
      const loanAmount = Number.isFinite(fx.loan) ? fx.loan : 0;
      recordDecision(d, { kind: 'expense', cardId: card.id, amount: fx.pay ?? 0, viaLoan: loanAmount > 0, viaSale: false, loanAmount, green: loanAmount === 0 });
    }
    recordDecision(d, { kind: 'decision', cardId: card.id, option: optionId, ...delta, green: null });
    d.events.push({ type: 'decided', cardId: card.id, option: optionId, ...delta });
    d.pending = null;
    settle(d);
    return d;
  }

  /** Answers the pending tax-audit question. Knowledge points only: money, assets and debts never change. */
  function answerAudit(state, { questionId = null, correct = null } = {}) {
    const d = begin(state);
    requirePending(d, 'taxAudit');
    logAction(d, 'answerAudit', { questionId, correct });
    if (!d.taxAudit) d.taxAudit = emptyTaxAudit();
    d.taxAudit.asked.push({ turn: d.turn, questionId, correct });
    if (correct === true) d.taxAudit.points += TAX_AUDIT_POINTS;
    d.events.push({ type: 'audited', questionId, correct, points: d.taxAudit.points });
    d.pending = null;
    settle(d);
    return d;
  }

  // ---------- opportunities ----------
  /**
   * v0.4 deal choice: pick which of the two offered deals (pending.card / pending.alt) the player wants to
   * decide on. The picked one becomes pending.card; the other stays pending.alt — when the picked deal is
   * bought, the unchosen one is emitted as a 'passed' card so the match layer can auction it (see buy()).
   * The pending decision stays open; this only swaps the cards.
   */
  function chooseDeal(state, cardId) {
    const d = begin(state);
    requirePending(d, 'opportunity');
    if (!d.pending.alt) fail('no deal choice offered');
    if (cardId === d.pending.alt.id) {
      const first = d.pending.card;
      d.pending.card = d.pending.alt;
      d.pending.alt = first;
    } else if (cardId !== d.pending.card.id) fail('unknown deal');
    d.pending.chosen = true;
    logAction(d, 'chooseDeal', d.pending.card.id);
    d.events.push({ type: 'dealChoice', cardId: d.pending.card.id, altId: d.pending.alt.id });
    settle(d);
    return d;
  }

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
      // v0.4 guess stakes: a correct 'עסקה טובה?' guess on this very card this turn takes 10% off the down
      // payment (rounded to ₪10, or to a whole coin for juniors). The asset's price drops by the same amount,
      // so price = down payment + mortgage still holds; the mortgage and the monthly flow are untouched.
      const guessedRight = (d.learn?.guesses ?? []).some((g) => g.cardId === card.id && g.turn === d.turn && g.correct);
      const discount = guessedRight ? Math.round((card.downPayment * 0.1) / (d.junior ? JUNIOR_ROUND : 10)) * (d.junior ? JUNIOR_ROUND : 10) : 0;
      const cost = card.downPayment - discount;
      if (d.cash < cost) fail('not enough cash');
      d.cash -= cost;
      d.seq += 1;
      d.assets.push({
        id: `asset-${d.seq}`, cardId: card.id, type: card.type, title: card.title, category: card.category,
        price: card.price - discount, downPayment: cost, mortgage: card.mortgage,
        monthlyCashFlow: card.monthlyCashFlow,
        ...(Number.isFinite(card.rent) ? { rent: card.rent } : {}), // a rent card changes the flow by rent x pct
        ...(Number.isFinite(card.loanPayment) ? { loanPayment: card.loanPayment } : {}),
      });
      d.events.push({ type: 'bought', cardId: card.id, cost, qty: 1, ...(discount ? { discount } : {}) });
    }
    logAction(d, 'buy', card.type === 'stock' ? qty : 1);
    recordDecision(d, buyRecord(card, card.type === 'stock' ? qty : 1));
    d.stats.dealsBought += 1;
    // v0.4: the deal that was offered alongside and not chosen goes to the other players, exactly like a
    // passed deal — the match layer auctions it off the 'passed' event (bots and UI already listen for it).
    if (d.pending.alt) d.events.push({ type: 'passed', card: d.pending.alt, viaChoice: true });
    d.pending = null;
    settle(d);
    return d;
  }

  function pass(state) {
    const d = begin(state);
    requirePending(d, 'opportunity');
    logAction(d, 'pass');
    recordDecision(d, passRecord(d.pending.card, d.cash));
    d.events.push({ type: 'passed', card: d.pending.card });
    d.pending = null;
    settle(d);
    return d;
  }

  // ---------- renovation (an owned coffee business, on an opportunity square) ----------
  /**
   * Renovates the owned coffee business `assetId` one level up instead of deciding on the drawn card. The card is
   * not lost: the match layer auctions it among the other players (owner-approved 2026-10-27), using the cardId the
   * 'renovated' event records. Level 2 needs `style` ('terrace' / 'takeaway'); the styles play identically.
   * Costs cash, adds the level's monthly cash flow to the business.
   */
  function renovate(state, assetId, style = null) {
    const d = begin(state);
    requirePending(d, 'opportunity');
    const asset = d.assets.find((a) => a.id === assetId);
    const category = asset?.category ?? data.cards.find((c) => c.id === asset?.cardId)?.category;
    if (!asset || asset.type !== 'business' || category !== 'coffee') fail('no coffee business to renovate');
    const lvl = renovationLevel(asset);
    const next = renovationLevelsFor(d)[lvl];
    if (!next) fail('already fully renovated');
    if (d.cash < next.cost) fail('not enough cash');
    if (next.style && !RENOVATION_STYLES.includes(style)) fail('choose a style');
    logAction(d, 'renovate', assetId, next.level, style);
    const cardId = d.pending.card.id; // the skipped card: the match layer auctions it among the other players
    d.cash -= next.cost;
    asset.monthlyCashFlow += next.gain;
    asset.renovations = { level: next.level, style: style ?? asset.renovations?.style ?? null };
    recordDecision(d, { kind: 'renovation', cardId: asset.cardId, title: asset.title, level: next.level, cost: next.cost, gain: next.gain, green: null });
    d.events.push({ type: 'renovated', assetId, cardId, title: asset.title, level: next.level, style: asset.renovations.style, cost: next.cost, gain: next.gain });
    d.pending = null;
    settle(d);
    return d;
  }

  // ---------- auction (a passed opportunity, multiplayer; the match layer runs the bidding) ----------
  /**
   * Gives the auction winner the passed card at their bid: the bid is paid in cash as the effective down payment, the
   * card's own financing (mortgage and its payment) comes with it unchanged, so the recorded price = bid + mortgage,
   * the balance sheet and a later sale stay consistent, and no financing value appears or disappears.
   */
  function auctionWin(state, card, price) {
    const d = begin(state);
    if (!['apartment', 'business'].includes(card?.type)) fail('only a deal can be auctioned');
    if (!Number.isInteger(price) || price <= 0) fail('bad bid');
    if (d.cash < price) fail('not enough cash');
    logAction(d, 'auctionWin', card.id, price);
    d.cash -= price;
    d.seq += 1;
    d.assets.push({
      id: `asset-${d.seq}`, cardId: card.id, type: card.type, title: card.title, category: card.category,
      price: price + (card.mortgage ?? 0), downPayment: price, mortgage: card.mortgage ?? 0,
      monthlyCashFlow: card.monthlyCashFlow,
      ...(Number.isFinite(card.rent) ? { rent: card.rent } : {}),
      ...(Number.isFinite(card.loanPayment) ? { loanPayment: card.loanPayment } : {}),
      auctioned: true,
    });
    recordDecision(d, { kind: 'auctionWin', cardId: card.id, title: card.title, type: card.type, cf: card.monthlyCashFlow, down: price, green: null });
    d.stats.dealsBought += 1;
    d.events.push({ type: 'auctionWin', cardId: card.id, cost: price });
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
    d.charityTurns = d.challenge ? 0 : CHARITY_TURNS; // a challenge donation buys no bonus die
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
    const step = loanStep(d);
    if (!Number.isInteger(amount) || amount <= 0 || amount % step !== 0) {
      fail(`loan must be a positive multiple of ${step}`);
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
    // junior: a starting debt is repaid whole (its payment is rounded, so part of it would not be whole coins); bank loans in steps
    if (!Number.isInteger(amount) || amount <= 0 || amount > l.principal ||
        (!whole && (amount % loanStep(d) !== 0 || (d.junior && l.kind !== 'loan')))) fail('bad repayment amount');
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

  // ---------- dispatch + replay (v0.5): the one seam every player action goes through ----------
  // An action is a plain object { type, ...args }. dispatch() runs the engine function and appends the action (only its
  // known fields) to state.log, so a game is fully described by (seed, config, log). replay() rebuilds it from that.
  // The daily challenge additionally keeps its own v2.5 log (state.daily.log, the format of stored result records).
  const ACTIONS = {
    // forced dice (engine.roll(s, dice)) stay a test hook: a logged roll never carries dice, so a log cannot choose them
    roll: { fields: [], run: (s, a) => (a.dice !== undefined ? fail('a dispatched roll takes no dice') : roll(s)) },
    armReroll: { fields: [], run: (s) => armReroll(s) },
    chooseDeal: { fields: ['cardId'], run: (s, a) => chooseDeal(s, a.cardId) },
    guess: { fields: ['cardId', 'light', 'guess'], run: (s, a) => guessAction(s, a) },
    buy: { fields: ['qty'], run: (s, a) => buy(s, a.qty ?? 1) },
    pass: { fields: [], run: (s) => pass(s) },
    renovate: { fields: ['assetId', 'level', 'style'], run: (s, a) => renovateAction(s, a) },
    // an auction is a hot-seat event: the match opens it on every bidder's state (auctionOpen), a win must be for that very
    // card at a legal bid, and the match closes it on the others (auctionClose). Never part of a single-player link.
    auctionOpen: { fields: ['card', 'floor', 'step'], run: (s, a) => auctionOpenAction(s, a) },
    auctionClose: { fields: [], run: (s) => auctionCloseAction(s) },
    auctionWin: { fields: ['card', 'price'], run: (s, a) => auctionWinAction(s, a) },
    acceptOffer: { fields: [], run: (s) => acceptOffer(s) },
    declineOffer: { fields: [], run: (s) => declineOffer(s) },
    donate: { fields: [], run: (s) => donate(s) },
    declineCharity: { fields: [], run: (s) => declineCharity(s) },
    takeLoan: { fields: ['amount'], run: (s, a) => takeLoan(s, a.amount) },
    repayLoan: { fields: ['id', 'amount'], run: (s, a) => repayLoan(s, a.id, a.amount) },
    sellAsset: { fields: ['id', 'qty'], run: (s, a) => sellAsset(s, a.id, a.qty ?? undefined) },
    decide: { fields: ['option'], run: (s, a) => decide(s, a.option) },
    answerAudit: { fields: ['questionId', 'correct'], run: (s, a) => answerAudit(s, { questionId: a.questionId ?? null, correct: a.correct ?? null }) },
    forfeit: { fields: [], run: (s) => forfeit(s) },
    debugForce: { fields: ['outcome'], run: (s, a) => debugForce(s, a.outcome) },
  };
  const ACTION_TYPES = Object.keys(ACTIONS);

  // the 'עסקה טובה?' guess (learn.recordGuess) is an action: a right guess takes 10% off the down payment and streaks earn reroll tokens
  function guessAction(state, { cardId, light, guess }) {
    if (state.status !== 'playing') fail('game is over');
    if (!['good', 'bad', 'skip'].includes(guess)) fail(`bad guess ${guess}`);
    // the guess is on the open deal, and its light is that deal's own (dealMetrics): a log cannot claim a green light on a red deal
    const card = state.pending?.kind === 'opportunity' ? state.pending.card : null;
    if (!card || card.id !== cardId || !isDeal(card)) fail('a guess needs the open deal');
    const own = dealMetrics(card).light ?? null;
    if ((light ?? null) !== own) fail(`the light of ${cardId} is ${own}`);
    return recordGuess(state, { cardId, light: own, guess }); // events untouched: a guess is part of the open card
  }
  // ---------- auctions through dispatch: open -> win (or close) ----------
  const auctionOpenAction = (state, a) => auctionOpenState(state, a);
  const auctionCloseAction = (state) => auctionCloseState(state);
  function auctionWinAction(state, { card, price }) {
    const open = state.auctionOpen;
    if (!open) fail('no auction open for this player');
    if (stableStringify(open.card) !== stableStringify(card)) fail('not the auctioned card');
    if (!Number.isInteger(price) || price < auctionMinBidOf(open) || price % open.step !== 0) fail(`bid must be a multiple of ${open.step} from ${auctionMinBidOf(open)}`);
    const d = auctionWin(state, card, price);
    delete d.auctionOpen;
    return d;
  }

  // renovate with the level it reaches in the log: a replayed log whose level does not match the state is refused
  function renovateAction(state, { assetId, level = null, style = null }) {
    const d = renovate(state, assetId, style ?? null);
    const ev = d.events.find((e) => e.type === 'renovated');
    if (level !== null && level !== undefined && ev?.level !== level) fail(`renovation level ${level} does not match ${ev?.level}`);
    return d;
  }

  /** Applies `action` ({ type, ...args }) and logs it. Throws EngineError on an unknown or illegal action. */
  function dispatch(state, action) {
    const def = ACTIONS[action?.type];
    if (!def) fail(`unknown action ${action?.type}`);
    const next = def.run(state, action);
    const entry = { type: action.type, ...(action.type === 'buy' ? { qty: action.qty ?? 1 } : {}) };
    for (const f of def.fields) if (action[f] !== undefined && action[f] !== null) entry[f] = action.type === 'auctionWin' && f === 'card' ? clone(action[f]) : action[f];
    if (action.type === 'renovate' && entry.level === undefined) entry.level = next.events.find((e) => e.type === 'renovated')?.level;
    next.log = Array.isArray(next.log) ? next.log : [];
    next.log.push(entry);
    return next;
  }

  /** The game a (seed, config, actions) triple describes: newGame, then every action dispatched in order. */
  function replay(seed, config = {}, actions = []) {
    let s = newGame({ ...config, seed });
    for (const a of actions) s = dispatch(s, a);
    return s;
  }

  const api = {
    data, newGame, debugForce, forfeit, roll, armReroll, buy, pass, chooseDeal, renovate, auctionWin, acceptOffer, declineOffer, donate,
    declineCharity, takeLoan, repayLoan, sellAsset, decide, decisionOptions, answerAudit, dispatch, replay, ACTION_TYPES,
  };
  // 0.5.1: engine.verifyResult(log) is attached by engine/index.js (and by the lazy challenge flow in the app), so the verifier
  // and the action-log codec stay out of the app's main bundle (QA 0.5.1 P2-3)
  return api;
}
