// npm run simulate [-- --games=100 --max=200 --bots=sensible,alwaysBuy,... --modes=family,full --perProfession --json=out.json --multiplayer=0]
// Plays N games per mode / bot / profession and prints balance statistics.
// cash@t10 = median cash at the first roll phase on or after turn 10 (games that reached it), as in finance's runner.
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/engine.js';
import { writeFileSync } from 'node:fs';
import { step, playMatch, BOTS } from '../src/engine/bots.js';
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
const botNames = (args.bots ?? 'sensible,cautious,alwaysBuy,overBorrow,overBorrowLite,alwaysPass').split(',');

const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (x) => (Number.isNaN(x) ? '-' : x.toFixed(1));

function play(mode, bot, professionId, seed) {
  let s = engine.newGame({ mode, professionId, seed });
  let cash10 = null;
  let guard = 0;
  while (s.status === 'playing' && s.turn < MAX_TURNS && guard++ < 5000) {
    s = step(engine, s, bot);
    if (cash10 === null && s.turn >= 10 && s.phase === 'roll') cash10 = s.cash;
  }
  return { s, cash10 };
}

function run(mode, bot, professionIds, games) {
  const res = { wins: [], lost: 0, timeout: 0, loans: [], cash10: [], n: 0 };
  for (let g = 0; g < games; g++) {
    const professionId = professionIds[g % professionIds.length];
    const { s, cash10 } = play(mode, bot, professionId, 1000 + g * 7919);
    res.n++;
    if (cash10 !== null) res.cash10.push(cash10);
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
  `avgTurns ${f1(avg(r.wins)).padStart(5)}  median ${f1(pct(r.wins, 0.5)).padStart(5)}  p90 ${f1(pct(r.wins, 0.9)).padStart(5)}  loans ${f1(avg(r.loans))}  ` +
  `cash@t10 ${Number.isNaN(pct(r.cash10, 0.5)) ? '-' : Math.round(pct(r.cash10, 0.5))}`;
const out = { games: GAMES, maxTurns: MAX_TURNS, rows: [] };
const record = (mode, bot, profession, r) => out.rows.push({
  mode, bot, profession, n: r.n, win: r.wins.length / r.n, lost: r.lost / r.n, timeout: r.timeout / r.n,
  avg: avg(r.wins), median: pct(r.wins, 0.5), p90: pct(r.wins, 0.9), loans: avg(r.loans), cash10: pct(r.cash10, 0.5),
});

const allProfs = data.professions.map((p) => p.id);
console.log(`Simulation: ${GAMES} games per row, cap ${MAX_TURNS} turns (professions rotated)\n`);
const modes = String(args.modes ?? 'family,full').split(',');
for (const mode of modes) {
  console.log(`== mode: ${mode}`);
  for (const bot of botNames) {
    if (!BOTS[bot]) { console.log(`unknown bot ${bot}`); continue; }
    const r = run(mode, bot, allProfs, GAMES);
    record(mode, bot, null, r);
    console.log(row(bot, r));
  }
  if (args.perProfession) {
    for (const p of data.professions) {
      const start = monthlyCashFlow(engine.newGame({ mode, professionId: p.id }));
      for (const bot of String(args.perProfessionBots ?? 'sensible').split(',')) {
        const r = run(mode, bot, [p.id], GAMES);
        record(mode, bot, p.id, r);
        console.log(row(`  ${bot}/${p.id} (cf ${start})`, r));
      }
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

if (typeof args.json === 'string') writeFileSync(args.json, JSON.stringify(out, null, 1));
