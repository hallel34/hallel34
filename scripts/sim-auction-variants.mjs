// Controlled comparison of auction rule variants (same bots, seeds, economy) - balance evidence for the rule proposal.
// node scripts/sim-auction-variants.mjs [--matches=60]
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/engine.js';
import { playMatch } from '../src/engine/bots.js';
import { newMatch } from '../src/engine/match.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('../src/data/professions.he.json'), cards: read('../src/data/cards.he.json') });
const MATCHES = Number((process.argv.find((a) => a.startsWith('--matches=')) ?? '--matches=60').split('=')[1]);
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (x) => (Number.isNaN(x) ? '-' : x.toFixed(1));

const VARIANTS = {
  'no-auction': { auctions: false },
  'no-floor (step 1k)': { auctionRules: { floor: 0 } },
  'floor=half-down (DEFAULT)': {},
  'floor=down-payment': { auctionRules: { floor: (c) => c.downPayment ?? 0 } },
  'step=5k': { auctionRules: { step: 5000 } },
};

for (const mode of ['family', 'full']) {
  console.log(`\n== ${mode}, 4 sensible bots, ${MATCHES} matches per variant (seeds 1..${MATCHES})`);
  console.log('variant                    winTurns(med)  totalTurns(med)  auctions/match  sold%  bid/down(avg)  bidRounds(avg)');
  for (const [name, opts] of Object.entries(VARIANTS)) {
    const winTurns = [], totalTurns = [], per = [];
    let auctions = 0, sold = 0, timeouts = 0;
    const ratios = [], rounds = [];
    for (let seed = 1; seed <= MATCHES; seed++) {
      const stats = { auctions: 0, sold: 0, bids: [] };
      const m = newMatch(engine, { mode, seed, players: [0, 1, 2, 3].map((i) => ({ name: 'B' + i, professionId: ['teacher', 'engineer', 'nurse', 'driver'][i], bot: 'sensible' })) });
      const out = playMatch(engine, m, ['sensible'], 2000, { ...opts, stats });
      auctions += stats.auctions; sold += stats.sold;
      for (const b of stats.bids) { ratios.push(b.price / Math.max(1, b.down)); rounds.push(b.rounds); }
      if (out.status === 'won') { winTurns.push(out.players[out.winnerIndex].state.turn); totalTurns.push(out.turns); }
      else timeouts++;
    }
    console.log(
      name.padEnd(26) +
      String(f1(pct(winTurns, 0.5))).padStart(8) +
      String(f1(pct(totalTurns, 0.5))).padStart(14) +
      String(f1(auctions / MATCHES)).padStart(13) +
      String(sold ? Math.round((100 * sold) / Math.max(1, auctions)) : 0).padStart(6) + '%' +
      String(f1(avg(ratios))).padStart(12) +
      String(f1(avg(rounds))).padStart(13) +
      (timeouts ? `  TIMEOUTS:${timeouts}` : ''));
  }
}
