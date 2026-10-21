import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEngine, loanPaydayImpact, loanRating, monthlyCashFlow, loanTerms, loanLimits, maxLoan, deserialize, serialize, newMatch,
  buildReport, emptyLearn, purchaseCashFlow, liabilityReport,
} from '../src/engine/index.js';
import { reportView } from '../src/learn/report.js';
import { feedbackForEnd, feedbackForWinExtra, renderFeedback } from '../src/learn/feedback.js';
import { learnContent } from '../src/learn/content.js';
import { enqueueAt, pickExplainer } from '../src/learn/triggers.js';
import { setLearnMode } from '../src/learn/context.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const cards = read('cards.he.json');
const professions = read('professions.he.json');
const engine = createEngine({ cards, professions });
const card = (id) => cards.find((c) => c.id === id);

describe('round 7: buy-with-loan figures include the asset being bought', () => {
  const teacher3 = () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 4 });
    s.kids = 3; s.cash = 100000; s.position = 1; s.turn = 3;
    const c = structuredClone(card('opp-apt-001'));
    s.pending = { kind: 'opportunity', card: c }; s.phase = 'decision';
    return { s, c };
  };
  it('QA case: teacher, 3 kids, cash 100,000, opp-apt-001, loan 100,000 -> new flow +2,540, next summary +60,960, no warning', () => {
    const { s, c } = teacher3();
    const gain = purchaseCashFlow(c);
    const imp = loanPaydayImpact(s, 100000, c.downPayment, gain);
    expect(monthlyCashFlow(s) + gain - loanTerms(100000).monthly).toBe(2540);
    expect(imp.flow).toBe(2540);
    expect(imp.payday).toBe(60960);
    expect(imp.risky).toBe(false);
    // the old (pre-purchase) figures were what produced the false warning
    expect(loanPaydayImpact(s, 100000, c.downPayment).risky).toBe(true);
    expect(loanRating(s, 100000, { card: c, spend: c.downPayment })).toBe('sensible');
  });
  it('the figures equal the real state after the purchase (engine)', () => {
    const { s, c } = teacher3();
    const after = engine.buy(engine.takeLoan(s, 100000));
    expect(monthlyCashFlow(after)).toBe(2540);
  });
  it('costly cases stay costly: a bad deal, a payment above half the asset cash flow, a summary below zero even with the asset', () => {
    const { s } = teacher3();
    const bad = { ...structuredClone(card('opp-apt-001')), monthlyCashFlow: 300 };
    expect(loanRating(s, 100000, { card: bad, spend: bad.downPayment })).toBe('costly');
    const trap = { ...bad, monthlyCashFlow: -500 };
    expect(loanRating(s, 10000, { card: trap, spend: trap.downPayment })).toBe('costly');
    const poor = { ...structuredClone(card('opp-apt-001')), monthlyCashFlow: 3400, downPayment: 1000000 };
    s.cash = 0;
    expect(loanRating(s, 100000, { card: poor, spend: poor.downPayment })).toBe('costly'); // cash after the summary < 0
  });
});

describe('round 7: the 12-salary purchase cap is reported', () => {
  it('capBinds is true only when the cap (not the cash flow) is the limit; forced loans are uncapped', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'engineer', seed: 3 });
    s.pending = { kind: 'opportunity', card: card('opp-apt-001') };
    s.liabilities.push({ id: 'loan-9', kind: 'loan', principal: s.profession.salary * 12, monthlyPayment: 1, rate: 0.01 });
    expect(loanLimits(s).capBinds).toBe(true);
    expect(maxLoan(s)).toBe(0);
    s.pending = { kind: 'shortfall' };
    expect(loanLimits(s).capBinds).toBe(false);
  });
});

describe('round 7: legacy loans keep their own rate', () => {
  it('a 10% loan without a rate is stamped on load and reported at 10%', () => {
    const m = newMatch(engine, { mode: 'full', players: [{ name: 'א', professionId: 'teacher' }], seed: 5 });
    const st = m.players[0].state;
    st.liabilities.push({ id: 'loan-3', kind: 'loan', label: 'loan', principal: 10000, monthlyPayment: 1000 });
    const back = deserialize(serialize(m));
    const l = back.players[0].state.liabilities.find((x) => x.id === 'loan-3');
    expect(l.rate).toBe(0.1);
    expect(liabilityReport(back.players[0].state).items.find((x) => x.id === 'loan-3').rate).toBe(0.1);
    const fresh = engine.takeLoan({ ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 1 }), phase: 'roll' }, 1000);
    expect(fresh.liabilities.at(-1).rate).toBe(0.01);
  });
});

describe('round 7: report', () => {
  const dec = (over) => ({ turn: 1, kind: 'buy', cardId: 'x', title: 'נכס', type: 'apartment', tier: 'good', years: 4.9, yieldPct: 20.4, cf: 3400, green: true, ...over });
  const st = (decisions, extra = {}) => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 2 });
    return { ...s, ...extra, learn: { ...emptyLearn(), decisions } };
  };
  const section = (v, id) => v.sections.find((x) => x.id === id);
  it('end line: still playing -> end.neutral (never the cash-ran-out line); out -> lose; won -> win', () => {
    expect(feedbackForEnd(st([], { status: 'playing' })).group).toBe('end.neutral');
    expect(feedbackForEnd(st([], { status: 'lost' })).group).toBe('lose');
    expect(feedbackForEnd(st([], { status: 'won' })).group).toBe('win');
    const lose = learnContent().feedback.lines.lose;
    for (const mode of ['family', 'full']) {
      const text = renderFeedback(learnContent().feedback, feedbackForEnd(st([], { status: 'playing', mode })), { mode, seed: 1 }).text;
      expect(Object.values(lose[mode])).not.toContain(text);
      expect(text).not.toMatch(/נגמר המזומן|נגמרו המזומן|אין מזומן/);
    }
    setLearnMode('family');
    expect(reportView(st([], { status: 'playing' }), { seed: 1 }).subtitle).toBe(learnContent().report.subtitle.neutral);
  });
  it('only negative-cash-flow deals: best-deal says so, the worst deal is shown, never "bought nothing"', () => {
    const only = st([dec({ title: 'T', tier: 'trap', years: null, cf: -6000, green: false })], { status: 'won' });
    const r = buildReport(only);
    expect(r.bestKind).toBe('negativeOnly');
    expect(r.worstKind).toBe('negative');
    const v = reportView(only, { seed: 1 });
    expect(section(v, 'bestDeal').text).toBe(learnContent().report.sections.bestDeal.negativeOnly);
    expect(section(v, 'worstDeal').text).toContain('T');
    expect(JSON.stringify(v)).not.toContain(learnContent().report.sections.bestDeal.empty);
    expect(buildReport(st([])).bestKind).toBe('empty');
    expect(buildReport(st([dec({ type: 'stock', tier: null, years: undefined, green: null })])).bestKind).toBe('stocksOnly');
  });
  it('a migrated game with assets but no decisions is reported from its assets', () => {
    const s = st([]);
    s.assets = [{ id: 'asset-1', cardId: 'opp-apt-001', type: 'apartment', title: 'סטודיו', price: 1800000, downPayment: 200000, mortgage: 1600000, monthlyCashFlow: 3400 }];
    const r = buildReport(s);
    expect(r.bestKind).toBe('deal');
    expect(r.bestDeal.title).toBe('סטודיו');
    expect(r.green.kind).toBe('noData'); // derived entries are not rated decisions
  });
  it('concept count: singular, per game, titled "one" correctly', () => {
    const s = st([], { status: 'won' }); s.learn.concepts = ['asset'];
    setLearnMode('family');
    const text = section(reportView(s, { seed: 1 }), 'concepts').text;
    expect(text).toContain('מושג אחד');
    expect(text).not.toMatch(/1 מושגים/);
  });
  it('allGood tip has a family and a full text', () => {
    const tip = learnContent().report.nextStep.tips.allGood;
    expect(tip.family).toBeTruthy(); expect(tip.full).toBeTruthy();
  });
  it('win second line: one claim, only when true, in the order fastPayback, noBankLoan, diversified', () => {
    const won = (decisions, extra = {}) => st(decisions, { status: 'won', ...extra });
    expect(feedbackForWinExtra(won([dec({})])).group).toBe('win.fastPayback');
    expect(feedbackForWinExtra(won([dec({ tier: 'ok', green: false })])).group).toBe('win.noBankLoan');
    const s = won([dec({ tier: 'ok', green: false })]);
    s.stats = { ...s.stats, loansTaken: 2 };
    expect(feedbackForWinExtra(s)).toBeNull();
    s.assets = [{ type: 'apartment' }, { type: 'business' }];
    expect(feedbackForWinExtra(s).group).toBe('win.diversified');
    expect(feedbackForWinExtra(st([]))).toBeNull();
  });
});

describe('round 7: explainer queue', () => {
  it('shows the latest trigger first, ages old ones to the front, drops none', () => {
    const none = new Set();
    let q = enqueueAt([], ['liability'], none, 0);
    q = enqueueAt(q, ['passive_income', 'down_payment'], none, 1);
    q = enqueueAt(q, ['yield', 'payback'], none, 1);
    expect(pickExplainer(q, none, 'family', 1).id).toBe('passive_income'); // same trigger turn: arrival order
    expect(pickExplainer(q, none, 'family', 3).id).toBe('liability'); // waited 3 turns: first
    const seen = new Set(['liability']);
    expect(pickExplainer(q, seen, 'family', 1).id).toBe('passive_income');
    const all = new Set();
    const shown = [];
    for (let turn = 1; turn <= 10 && q.some((x) => !all.has(x.id)); turn++) { const it = pickExplainer(q, all, 'family', turn); if (!it) break; shown.push(it.id); all.add(it.id); }
    expect(new Set(shown)).toEqual(new Set(q.map((x) => x.id)));
  });
});

describe('round 7: production bundle carries no unpublished figure', () => {
  it('vite build output has none of the publish:false figures or review notes', () => {
    const out = mkdtempSync(join(tmpdir(), 'passivo-dist-'));
    execSync(`npx vite build --outDir ${out} --emptyOutDir`, { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe', env: { ...process.env, BASE_PATH: './' } });
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const js = walk(out).filter((f) => /\.(js|json|html)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const x of ['8.23', '3.25', '4.75', '329', 'needs_review', 'pending_finance', 'numbers-proposal']) expect(js.includes(x), x).toBe(false);
    // the content the UI renders is still there
    expect(js).toContain('המילון של פסיבו');
  }, 180000);
});
