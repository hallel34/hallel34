// node scripts/rng-fairness.js [--seeds=500] [--schemes=v1,turn,positional] [--modes=family,full] [--json=out.json] [--lengths]
// Decision independence of the engine RNG (docs/RNG.md). For every seed, two different bots play the same profession on
// the same seed (a friend challenge), each its own game; their games are joined turn by turn and we report:
//   dice      % of turns where every die both players rolled is the same (target 100); a charity turn rolls a 2nd die
//   square    % of turns on the same square
//   card      % of turns where both landed on a tile of the same deck AND saw the same card (target 100 of those turns)
//   card|pos  the same, on the turns both stood on the same tile
//   card|tier the same, on the same-deck opportunity turns where both players were in the same deal tier
//   tierDiff  % of the same-deck opportunity turns where the two players' deal tiers differed
//   desync    % of games whose squares split at least once, and what split them first (charity's 2nd die / a reroll)
// Pairs: alwaysBuy vs cautious, sensible vs alwaysPass. Bots never earn reroll tokens (they do not guess), so a third pair
// 'sensible+reroll vs sensible' gives the first player 2 tokens at the start and arms one whenever it can.
import { readFileSync, writeFileSync } from 'node:fs';
import { createEngine, dealTierIndex } from '../src/engine/engine.js';
import { step } from '../src/engine/bots.js';
import { BOARD } from '../src/engine/config.js';
import { encodeActionLog } from '../src/engine/actionlog.js';
import { isDeal, lightOfTier, dealMetrics } from '../src/engine/learn.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const data = { professions: read('../src/data/professions.he.json'), cards: read('../src/data/cards.he.json') };
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SEEDS = Number(args.seeds ?? 500);
const SCHEMES = String(args.schemes ?? 'v1,turn,positional').split(',');
const MODES = String(args.modes ?? 'family,full').split(',');
const MAX_TURNS = Number(args.max ?? 200);
const PAIRS = [['alwaysBuy', 'cautious'], ['sensible', 'alwaysPass'], ['sensible+reroll', 'sensible']];
const DECK_SQUARES = new Set(['opportunity', 'expense', 'market']);

const engines = {
  v1: { engine: createEngine(data), rngVersion: 1 },
  turn: { engine: createEngine(data, { drawScheme: 'turn' }), rngVersion: 2 },
  positional: { engine: createEngine(data, { drawScheme: 'positional' }), rngVersion: 2 },
};

/** The card a player met on the square of this roll (the main offer of an opportunity), or null. */
function cardOf(s) {
  if (s.pending?.card) return s.pending.card.id;
  const ev = s.events.find((e) => (e.type === 'market' || e.type === 'expensePaid') && e.card);
  return ev ? ev.card.id : null;
}

/** Plays one game; returns per-turn records { dice, pos, square, card, tier, reroll }. */
function trace(engine, rngVersion, mode, professionId, seed, botName) {
  const reroll = botName.endsWith('+reroll');
  const bot = botName.replace('+reroll', '');
  let s = engine.newGame({ mode, professionId, seed, rngVersion });
  if (reroll) s = { ...s, rerollTokens: 2 };
  const turns = [];
  let guard = 0;
  while (s.status === 'playing' && s.turn < MAX_TURNS && guard++ < 6000) {
    if (s.phase === 'roll' && reroll && s.rerollTokens > 0 && !s.rerollArmed) s = engine.dispatch(s, { type: 'armReroll' });
    const before = s;
    s = step(engine, s, bot);
    if (s.turn > before.turn) {
      const rr = s.events.find((e) => e.type === 'reroll'); // a reroll turn: compare the first set (the second is extra)
      turns[s.turn] = {
        dice: rr ? rr.first : s.lastRoll.dice, pos: s.position, square: BOARD[s.position], card: cardOf(s), tier: dealTierIndex(before),
        reroll: s.events.some((e) => e.type === 'reroll'),
      };
    }
  }
  return turns;
}

const pct = (a, b) => (b ? (100 * a) / b : NaN);
const f1 = (x) => (Number.isNaN(x) ? '-' : x.toFixed(1));

function measure(scheme, mode, pair) {
  const { engine, rngVersion } = engines[scheme];
  const c = { turns: 0, dice: 0, square: 0, deckTurns: 0, card: 0, posTurns: 0, cardPos: 0, oppTurns: 0, tierSame: 0, cardTier: 0, tierDiff: 0, games: 0, desync: 0, byCharity: 0, byReroll: 0 };
  for (let i = 0; i < SEEDS; i++) {
    const seed = 100003 + i * 7919;
    const professionId = data.professions[i % data.professions.length].id;
    const a = trace(engine, rngVersion, mode, professionId, seed, pair[0]);
    const b = trace(engine, rngVersion, mode, professionId, seed, pair[1]);
    c.games += 1;
    let split = null;
    for (let t = 1; t < Math.min(a.length, b.length); t++) {
      const x = a[t]; const y = b[t];
      if (!x || !y) continue;
      c.turns += 1;
      const shared = Math.min(x.dice.length, y.dice.length);
      if (x.dice.slice(0, shared).every((v, k) => v === y.dice[k])) c.dice += 1;
      if (x.pos === y.pos) c.square += 1;
      else if (!split) split = x.reroll || y.reroll ? 'reroll' : 'charity';
      if (DECK_SQUARES.has(x.square) && x.square === y.square) {
        c.deckTurns += 1;
        if (x.card === y.card) c.card += 1;
        if (x.pos === y.pos) { c.posTurns += 1; if (x.card === y.card) c.cardPos += 1; }
        if (x.square === 'opportunity') {
          c.oppTurns += 1;
          if (x.tier === y.tier) { c.tierSame += 1; if (x.card === y.card) c.cardTier += 1; } else c.tierDiff += 1;
        }
      }
    }
    if (split) { c.desync += 1; if (split === 'reroll') c.byReroll += 1; else c.byCharity += 1; }
  }
  return {
    scheme, mode, pair: pair.join(' vs '),
    dice: pct(c.dice, c.turns), square: pct(c.square, c.turns), card: pct(c.card, c.deckTurns), cardPos: pct(c.cardPos, c.posTurns),
    cardTier: pct(c.cardTier, c.tierSame), tierDiff: pct(c.tierDiff, c.oppTurns), desync: pct(c.desync, c.games),
    byCharity: pct(c.byCharity, c.games), byReroll: pct(c.byReroll, c.games), turns: c.turns, deckTurns: c.deckTurns,
  };
}

// --lengths: the encoded action-log length of whole games (median / p95), both modes. 'bot' = the sensible bot's own
// actions; 'player' = the same game played like the UI does it: the 'עסקה טובה?' guess on every deal and the deal choice
// examined (chooseDeal) on every two-deal square, i.e. the longest realistic log.
function lengths() {
  const engine = engines.turn.engine;
  const q = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
  console.log('| mode | log | games | median turns | median actions | median chars | p95 turns | p95 actions | p95 chars | max chars |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const mode of MODES) {
    for (const style of ['bot', 'player']) {
      const rows = [];
      for (let i = 0; i < SEEDS; i++) {
        const seed = 100003 + i * 7919;
        const config = { mode, professionId: data.professions[i % data.professions.length].id };
        let s = engine.newGame({ ...config, seed });
        let guard = 0;
        while (s.status === 'playing' && s.turn < MAX_TURNS && guard++ < 6000) {
          const p = s.pending;
          if (style === 'player' && p?.kind === 'opportunity') {
            if (p.alt && !p.chosen) { s = engine.dispatch(s, { type: 'chooseDeal', cardId: p.card.id }); continue; }
            const c = s.pending.card;
            if (isDeal(c) && !(s.learn.guesses ?? []).some((g) => g.cardId === c.id && g.turn === s.turn)) {
              s = engine.dispatch(s, { type: 'guess', cardId: c.id, light: lightOfTier(dealMetrics(c).tier) ?? null, guess: 'good' });
              continue;
            }
          }
          s = step(engine, s, 'sensible');
        }
        const chars = encodeActionLog({ rngVersion: s.rngVersion, seed, config, actions: s.log }).length;
        rows.push({ turns: s.turn, actions: s.log.length, chars });
      }
      const by = (k, p) => q(rows.map((r) => r[k]), p);
      console.log(`| ${mode} | ${style} | ${rows.length} | ${by('turns', 0.5)} | ${by('actions', 0.5)} | ${by('chars', 0.5)} | ${by('turns', 0.95)} | ${by('actions', 0.95)} | ${by('chars', 0.95)} | ${Math.max(...rows.map((r) => r.chars))} |`);
    }
  }
}
if (args.lengths) { lengths(); process.exit(0); }

const rows = [];
console.log(`${SEEDS} seeds per row; same profession and seed for both players\n`);
console.log('| scheme | mode | pair | dice % | square % | card % (same deck tile) | card % (same tile) | card % (same tier) | tier differs % | games desynced % | first split: charity / reroll % |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const scheme of SCHEMES) {
  for (const mode of MODES) {
    for (const pair of PAIRS) {
      const r = measure(scheme, mode, pair);
      rows.push(r);
      console.log(`| ${scheme} | ${mode} | ${r.pair} | ${f1(r.dice)} | ${f1(r.square)} | ${f1(r.card)} | ${f1(r.cardPos)} | ${f1(r.cardTier)} | ${f1(r.tierDiff)} | ${f1(r.desync)} | ${f1(r.byCharity)} / ${f1(r.byReroll)} |`);
    }
  }
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(rows, null, 1));
