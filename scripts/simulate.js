// npm run simulate [-- --games=100 --max=200 --bots=sensible,alwaysBuy,...]
// Plays N games per mode / bot / profession and prints balance statistics.
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/engine.js';
import { playGame, playMatch, BOTS } from '../src/engine/bots.js';
import { newMatch } from '../src/engine/match.js';
import { monthlyCashFlow } from '../src/engine/selectors.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const data = { professions: read('../src/data/professions.he.json'), cards: read('../src/data/cards.he.json') };
const engine = createEngine(data);

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const GAMES = Number(args.games ?? 100);
const MAX_TURNS = Number(args.max ?? 200);
const botNames = (args.bots ?? 'sensible,cautious,alwaysBuy,alwaysPass').split(',');

const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (x) => (Number.isNaN(x) ? '-' : x.toFixed(1));

function run(mode, bot, professionIds, games) {
  const res = { wins: [], lost: 0, timeout: 0, loans: [], n: 0 };
  for (let g = 0; g < games; g++) {
    const professionId = professionIds[g % professionIds.length];
    const s = playGame(engine, engine.newGame({ mode, professionId, seed: 1000 + g * 7919 }), bot, MAX_TURNS);
    res.n++;
    res.loans.push(s.stats.loansTaken);
    if (s.status === 'won') res.wins.push(s.turn);
    else if (s.status === 'lost') res.lost++;
    else res.timeout++;
  }
  return res;
}

const row = (label, r) =>
  `${label.padEnd(26)} win ${(100 * r.wins.length / r.n).toFixed(0).padStart(3)}%  ` +
  `lost ${(100 * r.lost / r.n).toFixed(0).padStart(3)}%  timeout ${(100 * r.timeout / r.n).toFixed(0).padStart(3)}%  ` +
  `avgTurns ${f1(avg(r.wins)).padStart(5)}  median ${f1(pct(r.wins, 0.5)).padStart(5)}  p90 ${f1(pct(r.wins, 0.9)).padStart(5)}  loans ${f1(avg(r.loans))}`;

const allProfs = data.professions.map((p) => p.id);
console.log(`Simulation: ${GAMES} games per row, cap ${MAX_TURNS} turns (professions rotated)\n`);
for (const mode of ['family', 'full']) {
  console.log(`== mode: ${mode}`);
  for (const bot of botNames) {
    if (!BOTS[bot]) { console.log(`unknown bot ${bot}`); continue; }
    console.log(row(bot, run(mode, bot, allProfs, GAMES)));
  }
  if (args.perProfession) {
    for (const p of data.professions) {
      const start = monthlyCashFlow(engine.newGame({ mode, professionId: p.id }));
      console.log(row(`  sensible/${p.id} (cf ${start})`, run(mode, 'sensible', [p.id], GAMES)));
    }
  }
  console.log('');
}

// ---- hot-seat multiplayer: bots vs bots (4 players, mixed professions) ----
if (args.multiplayer !== '0') {
  const MP_GAMES = Number(args.mpGames ?? 50);
  const profs = data.professions.map((p) => p.id);
  for (const mode of ['family', 'full']) {
    const res = { winner: 0, lost: 0, timeout: 0, rounds: [], byIndex: [0, 0, 0, 0] };
    for (let g = 0; g < MP_GAMES; g++) {
      const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i + 1}`, professionId: profs[(g + i * 2) % profs.length] }));
      const m = playMatch(engine, newMatch(engine, { mode, players, seed: 5000 + g * 104729 }), ['sensible', 'sensible', 'sensible', 'sensible'], 2000);
      if (m.status === 'won') { res.winner++; res.rounds.push(m.players[m.winnerIndex].state.turn); res.byIndex[m.winnerIndex]++; }
      else if (m.status === 'lost') res.lost++;
      else res.timeout++;
    }
    console.log(`== multiplayer ${mode}, 4 sensible bots, ${MP_GAMES} matches: winner ${res.winner}  allOut ${res.lost}  timeout ${res.timeout}  ` +
      `winner's turns avg ${f1(avg(res.rounds))} median ${f1(pct(res.rounds, 0.5))} p90 ${f1(pct(res.rounds, 0.9))}  wins by seat ${res.byIndex.join('/')}`);
  }
}
