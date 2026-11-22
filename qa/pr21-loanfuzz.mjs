import { readFileSync } from 'node:fs';
import { createEngine, newMatch, currentState, botStep, loanLimits, monthlyCashFlow, bankLoanPrincipal, LOAN_STEP, JUNIOR_LOAN_STEP, LOAN_PAYMENT_RATE, loanRateNow } from '../src/engine/index.js';
const rd = (n) => JSON.parse(readFileSync(new URL(`../src/data/${n}.he.json`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: rd('professions'), cards: rd('cards') });
let checks = 0, bad = [], maxForced = 0, rates = new Set(), over400 = 0; const kinds = {};
for (const mode of ['family', 'full']) for (const p of engine.data.professions) for (let seed = 1; seed <= 25; seed++) for (const bot of ['sensible', 'alwaysBuy', 'cautious']) {
  let s = currentState(newMatch(engine, { mode, seed, players: [{ professionId: p.id }] })); let g = 0;
  while (s.status === 'playing' && g++ < 900) {
    s = botStep(engine, s, bot);
    const k = s.pending?.kind ?? 'none'; kinds[k] = (kinds[k] || 0) + 1;
    const step = s.junior ? JUNIOR_LOAN_STEP : LOAN_STEP; const rate = loanRateNow(s); rates.add(rate);
    const sal = s.profession.salary; const flow = monthlyCashFlow(s);
    const byFlow = Math.max(0, Math.floor((flow + 0.2 * sal) / (step * rate) + 1e-9) * step);
    const L = loanLimits(s); checks++;
    const forced = s.pending?.kind === 'expense' || s.pending?.kind === 'shortfall';
    const cap = Math.max(0, Math.floor(12 * sal / step) * step - Math.floor(bankLoanPrincipal(s) / step) * step);
    const allowed = forced ? byFlow : Math.min(byFlow, cap);
    if (L.max > allowed) bad.push({ mode, id: p.id, seed, bot, turn: s.turn, kind: k, max: L.max, allowed, flow, sal, rate });
    if (forced) { maxForced = Math.max(maxForced, L.max); if (L.max >= 400000) over400++; }
    if (L.max % step) bad.push({ notMultiple: L.max });
  }
}
console.log({ checks, bad: bad.length, maxForcedLoan: maxForced, forcedStatesAtOrOver400k: over400, rates: [...rates], kinds }); console.log(bad.slice(0, 5));
