// 0.5.1 friend challenges by link: pure helpers on top of the action log (docs/RNG.md §6, docs/v051/design/challenges-spec.md).
// No DOM, no clock. A link carries a creator's (seed, config, actions); replaying it is the only proof of its result.
//   verifyResult(engine, log)   replay + result summary (refuses rngVersion 1, auctions, a daily, an unfinished game)
//   replayTurns(engine, log)    the per-turn decisions of a log (the replay timeline and the takeaway read it)
//   compareOutcome(a, b)        who is ahead (spec §4.1)
//   splitTurns / takeawayOf     where two logs' decisions split, and the educator's takeaway rule (copy §3.5)
//   challengeEligibility(match) whether the end screen offers "שלחו אתגר": false | 'link' (comparable) | 'fresh' (seed only)
import { decodeActionLog, ActionLogError, REFUSED_IN_LINKS } from './actionlog.js';
import { BOARD, PAYDAY_MONTHS } from './config.js';
import { passiveIncome, totalExpenses, loanRateNow, loanTerms } from './selectors.js';
import { dealMetrics } from './learn.js';

/** Freedom %: passive income over total expenses, rounded like the HUD, capped at 100. */
export function freedomPct(s) {
  const e = totalExpenses(s);
  return e > 0 ? Math.max(0, Math.min(100, Math.round((passiveIncome(s) / e) * 100))) : 0;
}

/** The identity of a challenge game: the same seed and the same rules config (mode, profession, junior). */
export const challengeKey = ({ seed, config = {} }) => `${seed}|${config.mode ?? 'family'}|${config.professionId}|${config.junior ? 1 : 0}`;

const NOT_IN_CHALLENGE = new Set([...REFUSED_IN_LINKS]);
const fail = (code, extra = {}) => ({ ok: false, comparable: false, code, ...extra });

function asLog(input) {
  if (typeof input === 'string') {
    try { return { log: decodeActionLog(input) }; } catch (e) {
      if (e instanceof ActionLogError) return { error: fail(e.code ?? 'FORMAT', { message: e.message }) };
      throw e;
    }
  }
  if (!input || typeof input !== 'object' || !Array.isArray(input.actions)) return { error: fail('FORMAT') };
  return { log: input };
}

/** A deal card's figures for the timeline / takeaway (null for anything else). */
function dealOf(card) {
  if (!card || (card.type !== 'apartment' && card.type !== 'business' && card.type !== 'stock')) return null;
  const m = card.type === 'stock' ? null : dealMetrics(card);
  return { cardId: card.id, title: card.title, type: card.type, downPayment: card.downPayment ?? card.price ?? 0, monthly: card.monthlyCashFlow ?? 0, light: m?.light ?? null, years: m?.years ?? null };
}

/**
 * Replays `log` action by action and records what each turn decided. Throws EngineError on an illegal action.
 * @returns { state, turns: [{ turn, square, card, deal, bought, passed, loans:[{amount,purpose,monthly,perPayday}], expense, charity,
 *   repaid:[{amount,saved}], sold, cash, freedomPct, end }], bonusDie, reroll }
 */
export function replayTurns(engine, log) {
  let s = engine.newGame({ ...log.config, seed: log.seed });
  const turns = [];
  let cur = null;
  let bonusDie = false;
  let reroll = false;
  for (const a of log.actions) {
    const prev = s;
    if (a.type === 'roll') {
      if (prev.charityTurns > 0 && !prev.challenge) bonusDie = true;
      if (prev.rerollArmed && prev.rerollTokens > 0 && !prev.challenge && !prev.daily) reroll = true;
    }
    s = engine.dispatch(prev, a);
    if (a.type === 'roll') {
      cur = { turn: s.turn, square: BOARD[s.position], card: null, deal: null, bought: null, passed: null, loans: [], expense: null, charity: null, repaid: [], sold: false, cash: s.cash, freedomPct: freedomPct(s), end: null };
      turns.push(cur);
    }
    if (!cur) continue; // nothing is decided before the first roll except arming a reroll
    const p = prev.pending;
    if (a.type === 'buy' && p?.kind === 'opportunity') cur.bought = dealOf(p.card);
    if (a.type === 'pass' && p?.kind === 'opportunity') cur.passed = dealOf(p.card);
    if (a.type === 'takeLoan') {
      const purpose = p?.kind === 'expense' || p?.kind === 'shortfall' ? 'expense' : p?.kind === 'opportunity' ? 'deal' : 'voluntary';
      const terms = loanTerms(a.amount, loanRateNow(prev));
      cur.loans.push({ amount: a.amount, purpose, monthly: terms.monthly, perPayday: terms.perPayday, cardId: purpose === 'deal' ? p.card.id : null });
    }
    if (a.type === 'donate') cur.charity = 'donated';
    if (a.type === 'declineCharity') cur.charity = 'declined';
    if (a.type === 'repayLoan') { const ev = s.events.find((e) => e.type === 'repaid'); cur.repaid.push({ amount: a.amount, saved: ev?.saved ?? 0 }); }
    if (a.type === 'sellAsset') cur.sold = true;
    const paid = s.events.find((e) => e.type === 'expensePaid');
    if (paid) cur.expense = { amount: paid.amount, via: a.type === 'takeLoan' || prev.pending?.funded === 'loan' ? 'loan' : 'cash', title: paid.card?.title ?? null };
    // the card of the turn: the first open card after the roll (a deal choice may swap it: the bought / passed card wins)
    if (!cur.card && s.pending?.card) cur.card = { id: s.pending.card.id, title: s.pending.card.title, kind: s.pending.kind };
    cur.deal = cur.bought ?? cur.passed ?? cur.deal;
    cur.cash = s.cash;
    cur.freedomPct = freedomPct(s);
    if (s.status !== 'playing' && !cur.end) cur.end = s.status;
  }
  return { state: s, turns, bonusDie, reroll };
}

/**
 * Replays a challenge log and summarizes the result.
 * @param input a base64url action log or a decoded one ({ rngVersion, seed, config, actions, name? })
 * @returns { ok, comparable, status, turns, freedomPct, stats, code?, log?, empty? }
 *   ok false: code 'FORMAT' | 'CRC' | 'VERSION' (decode or rngVersion 1), 'DAILY', 'AUCTION', 'REPLAY' (an illegal move),
 *   'UNFINISHED' (the game did not end). `log` is set whenever the log decoded, so a failed replay stays playable.
 *   comparable false: the game rolled charity's bonus die or a reroll (its dice differ from a challenge), or the log is a seed-only
 *   "new challenge on the same game" (no actions: `empty` true, ok true, no result).
 */
export function verifyResult(engine, input) {
  const { log, error } = asLog(input);
  if (error) return error;
  if (log.rngVersion !== 2) return fail('VERSION', { log });
  if (log.config?.daily) return fail('DAILY', { log });
  if (log.actions.some((a) => NOT_IN_CHALLENGE.has(a?.type))) return fail('AUCTION', { log });
  let run;
  try { run = replayTurns(engine, log); } catch (e) { return fail('REPLAY', { log, message: e.message }); }
  const s = run.state;
  const stats = {
    dealsBought: s.stats.dealsBought, loansTaken: s.stats.loansTaken,
    loanTotal: run.turns.reduce((n, t) => n + t.loans.reduce((m, l) => m + l.amount, 0), 0),
    donations: s.stats.donations, paydays: s.stats.paydays,
  };
  const base = { log, stats, freedomPct: freedomPct(s), professionId: s.profession.id, mode: s.mode, junior: !!s.junior, name: log.name ?? null };
  if (log.actions.length === 0) return { ok: true, comparable: false, empty: true, status: 'playing', turns: 0, ...base };
  if (s.status === 'playing') return fail('UNFINISHED', base);
  return {
    ok: true, comparable: !run.bonusDie && !run.reroll, status: s.status, turns: s.turn, winTurn: s.winTurn ?? null, ...base,
  };
}

/**
 * Who is ahead (spec §4.1): freedom beats none, then fewer turns, else the higher freedom %. 'you' | 'them' | 'tie' | null
 * (null when either result is missing, not verified or not comparable: no winner is claimed).
 */
export function compareOutcome(you, them) {
  if (!you?.ok || !them?.ok || !you.comparable || !them.comparable) return null;
  const yw = you.status === 'won';
  const tw = them.status === 'won';
  if (yw !== tw) return yw ? 'you' : 'them';
  if (yw) return you.turns === them.turns ? 'tie' : you.turns < them.turns ? 'you' : 'them';
  return you.freedomPct === them.freedomPct ? 'tie' : you.freedomPct > them.freedomPct ? 'you' : 'them';
}

/** What a turn decided, as comparable kinds (a different card on the same decision is not a split). */
export function decisionOf(t) {
  if (!t) return null;
  return {
    deal: t.bought ? 'bought' : t.passed ? 'passed' : null,
    loan: t.loans.some((l) => l.purpose !== 'expense'),
    expense: t.expense?.via ?? null,
    charity: t.charity === 'donated',
    repay: t.repaid.length > 0,
  };
}
const SPLIT_KINDS = ['deal', 'loan', 'expense', 'charity', 'repay'];

/**
 * The turns of two timelines, side by side, while both were still playing: { turn, you, them, split: [kinds], otherCard }.
 * A split = the two decision kinds differ on the same turn.
 */
export function splitTurns(youTurns, themTurns) {
  const n = Math.max(youTurns.length, themTurns.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const y = youTurns[i] ?? null;
    const th = themTurns[i] ?? null;
    const dy = decisionOf(y);
    const dt = decisionOf(th);
    const split = y && th ? SPLIT_KINDS.filter((k) => dy[k] !== dt[k]) : [];
    const otherCard = !!(y && th && dy.deal && dy.deal === dt.deal && y.deal?.cardId !== th.deal?.cardId);
    rows.push({ turn: i + 1, you: y, them: th, split, otherCard });
  }
  return rows;
}

const firstBuy = (turns) => turns.find((t) => t.bought)?.turn ?? null;

/**
 * The educator's takeaway rule (_meta.takeawaySelection): at most 2 lines, as { key, params } with raw numbers (the UI formats money).
 * Not verified / not comparable: [] (the UI shows only compare.simplification). No split: sameDecisions.
 */
export function takeawayOf(rows, { verified = true, mode = 'family' } = {}) {
  if (!verified) return [];
  const splitRows = rows.filter((r) => r.split.length);
  if (!splitRows.length) return [{ key: 'sameDecisions', params: {}, turn: null }];
  let first = null;
  for (const r of splitRows) {
    const { you: y, them: th, turn } = r;
    const yDealLoan = y.loans.find((l) => l.purpose === 'deal');
    if (r.split.includes('loan') && yDealLoan && y.bought) {
      first = { key: 'loanForDeal', params: { turn, monthlyPayment: yDealLoan.monthly, deal: y.bought.title, monthly: y.bought.monthly }, turn, cardId: y.bought.cardId };
    } else if (r.split.includes('deal')) {
      if (y.passed && th.bought) {
        const d = th.bought;
        if (d.monthly < 0) first = { key: 'passedNegative', params: { turn, deal: d.title, monthlyAbs: -d.monthly }, turn, cardId: d.cardId };
        else if (d.light === 'green' || d.light === 'yellow') first = { key: 'passedGoodDeal', params: { turn, deal: d.title, years: d.years }, turn, cardId: d.cardId };
      } else if (y.bought) {
        const d = y.bought;
        first = d.monthly < 0
          ? { key: 'boughtNegative', params: { turn, deal: d.title, monthlyAbs: -d.monthly }, turn, cardId: d.cardId }
          : { key: 'boughtGoodDeal', params: { turn, deal: d.title, monthly: d.monthly, months: PAYDAY_MONTHS }, turn, cardId: d.cardId };
      }
    } else if (r.split.includes('loan') && y.loans.some((l) => l.purpose !== 'expense')) {
      const l = y.loans.find((x) => x.purpose !== 'expense');
      first = { key: 'loanYou', params: { turn, amount: l.amount, monthlyPayment: l.monthly, perSummary: l.perPayday }, turn };
    } else if (r.split.includes('expense') && y.expense && th.expense) {
      const l = y.loans.find((x) => x.purpose === 'expense');
      first = y.expense.via === 'loan'
        ? { key: 'cushionLoan', params: { turn, amount: l?.amount ?? 0, monthlyPayment: l?.monthly ?? 0 }, turn }
        : { key: 'cushionCash', params: { turn }, turn };
    } else if (r.split.includes('repay') && y.repaid.length && mode === 'full') {
      const rp = y.repaid[0];
      first = { key: 'repayLoan', params: { turn, amount: rp.amount, monthlyPayment: rp.saved }, turn };
    }
    if (first) break;
  }
  const lines = first ? [first] : [];
  const fy = firstBuy(rows.map((r) => r.you).filter(Boolean));
  const ft = firstBuy(rows.map((r) => r.them).filter(Boolean));
  if (fy != null && ft != null && fy !== ft && !(first?.cardId && first.turn === Math.min(fy, ft))) {
    lines.push({ key: fy < ft ? 'firstAssetEarlier' : 'firstAssetLater', params: { turnYou: fy, turnThem: ft }, turn: Math.min(fy, ft) });
  }
  if (!lines.length) lines.push({ key: 'sameDecisions', params: {}, turn: null });
  return lines.slice(0, 2);
}

/**
 * Whether a finished match can send "שלחו אתגר" (spec §1.1): false for hot-seat / bots, the daily, missions, a short game,
 * an rngVersion 1 game, auctions, and a game that was itself a challenge (it ends on compare). Otherwise 'link' when its log is
 * comparable, or 'fresh' (decision 2026-11-09: a game with charity's bonus die or a reroll sends seed + config only).
 */
export function challengeEligibility(engine, match) {
  if (!match || match.players?.length !== 1 || match.players[0].bot) return false;
  if (match.daily || match.mission || match.roundCap || match.challenge) return false;
  const s = match.players[0].state;
  if (!s || s.rngVersion !== 2 || s.daily || s.challenge || s.status === 'playing' || !Array.isArray(s.log) || !s.log.length) return false;
  const v = verifyResult(engine, { rngVersion: 2, seed: s.seed, config: configOf(s), actions: s.log });
  if (!v.ok) return false;
  return v.comparable ? 'link' : 'fresh';
}

/** The rules config of a state, as a link carries it. */
export const configOf = (s) => ({ mode: s.mode, professionId: s.profession.id, ...(s.junior ? { junior: true } : {}), ...(s.challenge ? { challenge: true } : {}) });

/** The log a finished game sends: its whole log ('link'), or seed + config only ('fresh'). */
export function linkLogOf(s, { kind = 'link', name = '' } = {}) {
  return { rngVersion: 2, seed: s.seed, config: configOf(s), actions: kind === 'fresh' ? [] : s.log.map((a) => ({ ...a })), ...(name ? { name } : {}) };
}
