// A random legal-move player (v0.5 replay fuzz). It lists the moves the state allows, from the pending decision and the
// selectors (decisionOptions, maxLoan, canSell, renovationOption), and picks one with its own seeded generator.
// Every move is an engine action object ({ type, ...args }), applied through engine.dispatch.
import { maxLoan, loanStep, renovationOption, decisionCanPass, PASS_OPTION, MAX_STOCK_QTY, isDeal, lightOfTier, dealMetrics } from '../../src/engine/index.js';

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The legal moves of `s` (most of them; an illegal pick is simply refused by the engine and another one is tried). */
export function legalMoves(engine, s, rnd, { passed = null } = {}) {
  const moves = [];
  const p = s.pending;
  const step = loanStep(s);
  const room = maxLoan(s);
  const loan = () => ({ type: 'takeLoan', amount: step * (1 + Math.floor(rnd() * Math.max(1, Math.min(5, Math.floor(room / step))))) });
  if (room >= step && rnd() < 0.15) moves.push(loan());
  const bankLoans = s.liabilities.filter((l) => l.principal > 0);
  if (bankLoans.length && rnd() < 0.1) {
    const l = bankLoans[Math.floor(rnd() * bankLoans.length)];
    moves.push({ type: 'repayLoan', id: l.id, amount: rnd() < 0.5 ? l.principal : step });
  }
  if (s.mode === 'full' && s.assets.length && rnd() < 0.05) {
    const a = s.assets[Math.floor(rnd() * s.assets.length)];
    moves.push(a.type === 'stock' ? { type: 'sellAsset', id: a.id, qty: 1 + Math.floor(rnd() * a.qty) } : { type: 'sellAsset', id: a.id });
  }
  void passed; // auctions are hot-seat only (never in a single-player link): covered by tests/actionlog.test.js
  if (s.phase === 'roll') {
    if (s.rerollTokens > 0 && !s.daily && rnd() < 0.5) moves.push({ type: 'armReroll' });
    moves.push({ type: 'roll' });
    return moves;
  }
  switch (p?.kind) {
    case 'opportunity': {
      const c = p.card;
      if (p.alt && !p.chosen && rnd() < 0.5) moves.push({ type: 'chooseDeal', cardId: rnd() < 0.5 ? p.alt.id : c.id });
      const guessed = (s.learn?.guesses ?? []).some((g) => g.cardId === c.id && g.turn === s.turn);
      if (isDeal(c) && !guessed && rnd() < 0.6) {
        const light = lightOfTier(dealMetrics(c).tier) ?? null;
        moves.push({ type: 'guess', cardId: c.id, light, guess: ['good', 'bad', 'skip'][Math.floor(rnd() * 3)] });
      }
      const reno = renovationOption(s, engine.data.cards);
      if (reno && rnd() < 0.3) moves.push({ type: 'renovate', assetId: reno.assetId, level: reno.level, ...(reno.style ? { style: rnd() < 0.5 ? 'terrace' : 'takeaway' } : {}) });
      if (c.type === 'stock') {
        const max = Math.min(MAX_STOCK_QTY, c.maxQty ?? MAX_STOCK_QTY, Math.floor(s.cash / c.price));
        if (max >= 1) moves.push({ type: 'buy', qty: 1 + Math.floor(rnd() * max) });
      } else if (s.cash >= c.downPayment) moves.push({ type: 'buy', qty: 1 });
      else if (room >= step) moves.push({ type: 'takeLoan', amount: Math.min(room, Math.ceil((c.downPayment - s.cash) / step) * step) });
      moves.push({ type: 'pass' });
      break;
    }
    case 'decision': {
      for (const o of engine.decisionOptions(s)) if (o.available) moves.push({ type: 'decide', option: o.id });
      if (decisionCanPass(p.card)) moves.push({ type: 'decide', option: PASS_OPTION });
      break;
    }
    case 'charity': if (s.cash >= p.cost) moves.push({ type: 'donate' }); moves.push({ type: 'declineCharity' }); break;
    case 'offer': moves.push({ type: 'acceptOffer' }, { type: 'declineOffer' }); break;
    case 'taxAudit': moves.push({ type: 'answerAudit', ...(rnd() < 0.7 ? { questionId: `q${Math.floor(rnd() * 9)}`, correct: rnd() < 0.6 } : {}) }); break;
    case 'expense':
    case 'shortfall': {
      if (room >= step) moves.push({ type: 'takeLoan', amount: Math.min(room, Math.max(step, Math.ceil(((p.amount ?? 0) - s.cash) / step) * step)) });
      if (s.mode === 'full') for (const a of s.assets) moves.push({ type: 'sellAsset', id: a.id });
      break;
    }
    default: break;
  }
  if (s.daily && rnd() < 0.002) moves.push({ type: 'forfeit' });
  return moves;
}

/**
 * Plays a random legal game: returns the final state (its `log` is every action). Moves the engine refuses
 * (an EngineError) are dropped and another is tried; a state with no legal move ends the game.
 */
export function playRandom(engine, s0, rnd, { maxTurns = 45, maxActions = 400 } = {}) {
  let s = s0;
  let passed = null;
  for (let n = 0; n < maxActions && s.status === 'playing' && s.turn < maxTurns; n++) {
    const moves = legalMoves(engine, s, rnd, { passed });
    let next = null;
    while (moves.length && !next) {
      const [m] = moves.splice(Math.floor(rnd() * moves.length), 1);
      try { next = engine.dispatch(s, m); } catch (e) { if (e.name !== 'EngineError' && e.constructor?.name !== 'EngineError') throw e; }
    }
    if (!next) break;
    s = next;
    const ev = s.events.find((e) => e.type === 'passed' && e.card);
    if (ev) passed = ev.card;
  }
  return s;
}
