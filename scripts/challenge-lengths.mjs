// 0.5.1: the length of a challenge URL with its hash (median / p95 / max), the way the UI sends it: a whole game played like a
// player (the 'עסקה טובה?' guess on every deal, the deal choice examined), charity declined (a comparable link), and the longest
// display name (16 Hebrew letters = 32 bytes). The base is a PR-preview URL, longer than production.
// node scripts/challenge-lengths.mjs [--seeds=500] [--base=https://hallel34.github.io/hallel34/pr-preview/pr-99/]
import { readFileSync } from 'node:fs';
import { createEngine, encodeActionLog, botStep, dealMetrics, lightOfTier, configOf } from '../src/engine/index.js';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const SEEDS = Number(arg('seeds', 500));
const BASE = arg('base', 'https://hallel34.github.io/hallel34/pr-preview/pr-99/');
const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const isDeal = (c) => c && (c.type === 'apartment' || c.type === 'business');
const q = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
const NAME = 'אבגדהוזחטיכלמנסע'; // 16 letters

console.log(`base ${BASE} (${BASE.length} chars), ${SEEDS} games per row, name of 16 Hebrew letters`);
console.log('| mode | link | median turns | median URL | p95 URL | max URL |');
console.log('|---|---|---|---|---|---|');
for (const mode of ['family', 'full']) {
  for (const kind of ['challenge', 'reply']) {
    const rows = [];
    for (let i = 0; i < SEEDS; i++) {
      const seed = 200003 + i * 7919;
      let s = engine.newGame({ mode, professionId: data.professions[i % data.professions.length].id, seed, challenge: kind === 'reply' });
      for (let g = 0; s.status === 'playing' && g < 6000; g++) {
        const p = s.pending;
        if (p?.kind === 'charity') { s = engine.dispatch(s, { type: 'declineCharity' }); continue; }
        if (p?.kind === 'opportunity') {
          if (p.alt && !p.chosen) { s = engine.dispatch(s, { type: 'chooseDeal', cardId: p.card.id }); continue; }
          const c = s.pending.card;
          if (isDeal(c) && !(s.learn.guesses ?? []).some((x) => x.cardId === c.id && x.turn === s.turn)) {
            s = engine.dispatch(s, { type: 'guess', cardId: c.id, light: lightOfTier(dealMetrics(c).tier) ?? null, guess: 'good' });
            continue;
          }
        }
        s = botStep(engine, s, 'sensible');
      }
      const text = encodeActionLog({ rngVersion: 2, seed, config: configOf(s), actions: s.log, name: NAME });
      rows.push({ turns: s.turn, url: `${BASE}#${kind === 'reply' ? 'r' : 'c'}=${text}`.length });
    }
    const by = (k, p) => q(rows.map((r) => r[k]), p);
    console.log(`| ${mode} | ${kind} | ${by('turns', 0.5)} | ${by('url', 0.5)} | ${by('url', 0.95)} | ${Math.max(...rows.map((r) => r.url))} |`);
  }
}
