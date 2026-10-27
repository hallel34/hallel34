// Owner 2026-10-26: the age picker and the 'צעירים' round rules (a family game with a player aged 10 or under).
// Every amount a junior game can reach is a multiple of COIN_VALUE (100), so the coin display is exact.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, newMatch, serialize, deserialize, botStep, BOTS, act, canEndTurn, endTurn, currentState,
  monthlyCashFlow, totalExpenses, passiveIncome, totalIncome, maxLoan, loanTerms, loanStep, loanRateNow, PAYDAY_MONTHS, COIN_VALUE,
  JUNIOR_LOAN_STEP, SCHEMA_VERSION, seesCoins, isJuniorSetup, assetValue, purchasePlan,
} from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';
import { juniorSkips } from '../src/engine/engine.js';
import { moneyText, setCoinScale, scaleTypedMoney, inShekels, COIN_SHEKELS } from '../src/ui/format.js';
import { t } from '../src/i18n/index.js';

// the kid-vocabulary word list (read from that test file, so the two never drift apart; importing it would run its suite twice)
const FORBIDDEN = JSON.parse(`[${readFileSync(new URL('./kid-vocabulary.test.js', import.meta.url), 'utf8').match(/export const FORBIDDEN = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/,\s*$/, '')}]`);

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const readLearn = (n) => JSON.parse(readFileSync(new URL(`../src/data/learn/${n}.he.json`, import.meta.url), 'utf8'));
const TYPED = /₪(\d{1,3}(?:,\d{3})+|\d+)(?!\.?\d)/g;
const oddTyped = (text) => [...String(text ?? '').matchAll(TYPED)].map((m) => Number(m[1].replace(/,/g, ''))).filter((v) => v % COIN_SHEKELS !== 0);
const data = loadData('he');
const engine = createEngine(data);
const profs = data.professions.map((p) => p.id);

const MONEY_KEYS = ['cash', 'amount', 'cost', 'proceeds', 'extra', 'monthly', 'price', 'downPayment', 'mortgage', 'monthlyCashFlow', 'rent',
  'profit', 'loanPayment', 'principal', 'monthlyPayment', 'salary', 'perChild', 'offerPrice', 'savings', 'interest'];
/** Every money field of a state (and its pending card, events), plus the derived figures the screens show. */
function amounts(s) {
  const out = [];
  const add = (where, v) => { if (typeof v === 'number') out.push([where, v]); };
  const scan = (where, o) => { if (o && typeof o === 'object') for (const k of MONEY_KEYS) add(`${where}.${k}`, o[k]); };
  add('cash', s.cash);
  scan('profession', s.profession);
  for (const e of s.profession.expenses) add(`expense.${e.id ?? e.label}`, e.amount);
  for (const l of s.liabilities) scan(`liability.${l.id}`, l);
  for (const a of s.assets) { scan(`asset.${a.id}`, a); add(`asset.${a.id}.value`, assetValue(s, a)); }
  if (s.pending) { scan('pending', s.pending); scan('pending.card', s.pending.card); }
  for (const ev of s.events) scan(`event.${ev.type}`, ev);
  add('monthlyCashFlow', monthlyCashFlow(s)); add('totalExpenses', totalExpenses(s)); add('passive', passiveIncome(s));
  add('totalIncome', totalIncome(s)); add('maxLoan', maxLoan(s)); add('payday', monthlyCashFlow(s) * PAYDAY_MONTHS);
  const lt = loanTerms(loanStep(s), loanRateNow(s));
  add('loanStep.monthly', lt.monthly); add('loanStep.perPayday', lt.perPayday);
  if (s.pending?.card?.downPayment) add('plan.loanAmount', purchasePlan(s, s.pending.card.downPayment).loanAmount);
  return out;
}
const bad = (s) => amounts(s).filter(([, v]) => !Number.isInteger(v) || v % COIN_VALUE !== 0);

describe('age picker: schema 6 and the junior flag', () => {
  it('a v2.5 save (schema 3) migrates to 6: age unknown, no junior flag, the game plays on as before', () => {
    expect(SCHEMA_VERSION).toBe(7);
    const fixture = readFileSync(new URL('./fixtures/save-v2.5-schema3.json', import.meta.url), 'utf8');
    const m = deserialize(fixture);
    expect(m.schemaVersion).toBe(7);
    expect(m.junior).toBeUndefined();
    for (const p of m.players) {
      expect(p.age).toBeNull();
      expect(p.state.schemaVersion).toBe(7);
      expect(p.state.junior).toBeUndefined();
      expect(seesCoins(m, p)).toBe(false);
    }
    let n = m;
    for (let k = 0; k < 60 && n.status === 'playing'; k++) n = canEndTurn(n) ? endTurn(n) : act(n, (s) => botStep(engine, s, 'sensible'));
    const back = deserialize(serialize(n));
    expect(back.schemaVersion).toBe(7);
    expect(back.players.map((p) => p.age)).toEqual(m.players.map(() => null));
  });
  it('a schema 5 save gets age null', () => {
    const m5 = { ...newMatch(engine, { mode: 'family', players: [{ professionId: 'teacher' }] }), schemaVersion: 5 };
    for (const p of m5.players) { delete p.age; p.state.schemaVersion = 5; }
    const m = deserialize(JSON.stringify(m5));
    expect(m.players[0].age).toBeNull();
  });
  it('a family game with a player of 10 or under is junior for everyone; 11-13, 14+, unknown and full mode are not', () => {
    const mk = (mode, ages) => newMatch(engine, { mode, players: ages.map((age, i) => ({ professionId: profs[i], age })) });
    const j = mk('family', ['14plus', 'upTo10']);
    expect(j.junior).toBe(true);
    expect(j.players.every((p) => p.state.junior === true)).toBe(true);
    expect(seesCoins(j, j.players[0])).toBe(false);
    expect(seesCoins(j, j.players[1])).toBe(true);
    for (const [mode, ages] of [['family', ['11to13']], ['family', ['14plus', null]], ['full', ['upTo10']], ['family', ['bogus']]]) {
      const m = mk(mode, ages);
      expect(m.junior).toBeUndefined();
      expect(m.players.every((p) => !p.state.junior)).toBe(true);
    }
    expect(mk('family', ['bogus']).players[0].age).toBeNull();
    expect(isJuniorSetup('family', [{ age: 'upTo10' }])).toBe(true);
  });
  it('the engine refuses a junior full-mode or daily game', () => {
    expect(() => engine.newGame({ mode: 'full', professionId: 'teacher', junior: true })).toThrow();
    expect(() => engine.newGame({ mode: 'family', professionId: 'teacher', junior: true, daily: { date: '2026-10-26' } })).toThrow();
  });
});

describe('junior round rules: every reachable amount is a multiple of 100', () => {
  it('loans come in 10,000 steps (1 coin a month); smaller or odd steps are refused', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', junior: true });
    expect(loanStep(s)).toBe(JUNIOR_LOAN_STEP);
    expect(loanTerms(JUNIOR_LOAN_STEP, loanRateNow(s)).monthly).toBe(100);
    expect(() => engine.takeLoan(s, 1000)).toThrow();
    const ok = engine.takeLoan(s, 10000);
    expect(ok.liabilities.at(-1).monthlyPayment).toBe(100);
  });
  it('the starting profession, debts and cash are round', () => {
    for (const id of profs) expect(bad(engine.newGame({ mode: 'family', professionId: id, junior: true }))).toEqual([]);
  });
  it('a starting debt is repaid whole only; a bank loan in 10,000 steps', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'engineer', junior: true });
    s = { ...s, cash: 200000 };
    const base = s.liabilities.find((l) => l.kind === 'base');
    expect(() => engine.repayLoan(s, base.id, 10000)).toThrow();
    const whole = engine.repayLoan(s, base.id, base.principal);
    expect(whole.liabilities.some((l) => l.id === base.id)).toBe(false);
    s = engine.takeLoan(s, 30000);
    const loan = s.liabilities.find((l) => l.kind === 'loan');
    expect(() => engine.repayLoan(s, loan.id, 5000)).toThrow();
    expect(bad(engine.repayLoan(s, loan.id, 10000))).toEqual([]);
  });
  for (const bot of ['sensible', 'cautious', 'alwaysBuy', 'overBorrow', 'overBorrowLite', 'alwaysPass']) {
    it(`${bot}: 40 games (every profession), every state, card and event`, () => {
      const seen = [];
      for (let g = 0; g < 40; g++) {
        let s = engine.newGame({ mode: 'family', professionId: profs[g % profs.length], seed: 9000 + g, junior: true });
        for (let k = 0; k < 400 && s.status === 'playing'; k++) {
          s = botStep(engine, s, bot);
          for (const b of bad(s)) seen.push(`${bot} game ${g} turn ${s.turn}: ${b[0]} = ${b[1]}`);
          if (s.pending?.kind === 'decision') expect(s.pending.card.id).not.toMatch(/^dec-00[246]/);
          expect(s.pending?.kind).not.toBe('taxAudit');
        }
      }
      expect(seen.slice(0, 10)).toEqual([]);
    });
  }
  it('control: the same scan finds odd amounts in a normal family game (so it really looks)', () => {
    let found = 0;
    for (let g = 0; g < 8 && !found; g++) {
      let s = engine.newGame({ mode: 'family', professionId: profs[g], seed: 9000 + g });
      for (let k = 0; k < 400 && s.status === 'playing'; k++) { s = botStep(engine, s, 'sensible'); found += bad(s).length; }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('hot-seat with mixed ages: the round rules are game-wide', () => {
    let m = newMatch(engine, { mode: 'family', seed: 77, players: [{ professionId: 'lawyer', age: '14plus' }, { professionId: 'cook', age: 'upTo10' }] });
    const seen = [];
    for (let k = 0; k < 600 && m.status === 'playing'; k++) {
      m = canEndTurn(m) ? endTurn(m) : act(m, (s) => botStep(engine, s, 'sensible'));
      for (const p of m.players) for (const b of bad(p.state)) seen.push(`${p.id}: ${b[0]} = ${b[1]}`);
    }
    expect(seen.slice(0, 10)).toEqual([]);
    expect(currentState(m).junior).toBe(true);
  });
});

describe('coin display (one switch in format.js)', () => {
  it('coins: "179 מטבעות", "מטבע אחד", signs; off again = shekels; inShekels for the "1 coin = ₪100" line', () => {
    setCoinScale(true);
    try {
      const plain = (x) => x.replace(/[\u2066-\u2069]/g, ''); // what is read (the bidi isolates are invisible)
      expect(plain(moneyText(17900))).toBe('179 מטבעות');
      expect(plain(moneyText(100))).toBe('מטבע אחד');
      expect(plain(moneyText(-800))).toBe('-8 מטבעות');
      expect(plain(moneyText(900, { sign: true }))).toBe('+9 מטבעות');
      expect(plain(moneyText(100, { sign: true }))).toBe('+1 מטבע');
      // the phrase is an RTL isolate and a signed number an LTR isolate inside it: the number reads first also in a <bdi dir="ltr">
      expect(moneyText(-7400)).toBe('\u2067\u2066-74\u2069 מטבעות\u2069');
      expect(moneyText(17900)).toBe('\u2067179 מטבעות\u2069');
      expect(inShekels(() => moneyText(100))).toBe('₪100');
      expect(t('coins.perCoin', { value: inShekels(() => moneyText(COIN_SHEKELS)) })).toBe('כל מטבע = ₪100');
      // typed figures in texts: whole coins convert, others (and decimals) stay as they are
      expect(plain(scaleTypedMoney('עגלה: ₪900 בחודש, ₪1,000 בסך הכול, ₪212.4 ו-₪150.'))).toBe('עגלה: 9 מטבעות בחודש, 10 מטבעות בסך הכול, ₪212.4 ו-₪150.');
      expect(plain(scaleTypedMoney('נשארו -₪800'))).toBe('נשארו -8 מטבעות');
    } finally { setCoinScale(false); }
    expect(moneyText(17900)).toBe('₪17,900');
    expect(scaleTypedMoney('₪900')).toBe('₪900');
  });
  it('the coin and age wording passes the kid-vocabulary scan', () => {
    const words = [...Object.values(he.coins.amount), ...Object.values(he.coins.signed), he.coins.word, he.coins.perCoin,
      ...['ageGroup', 'ageGroupSingle', 'ageUpTo10', 'age11to13', 'age14plus', 'ageNote', 'familySuggested', 'juniorOn'].map((k) => he.players[k]),
      he.taxAudit.juniorRest];
    for (const w of words) for (const f of FORBIDDEN) expect(w.includes(f), `${w} has "${f}"`).toBe(false);
  });
});

describe('junior texts: every typed ₪ figure a junior player can read is whole coins (or has a junior wording)', () => {
  it('decision cards dealt in a junior game', () => {
    const dealt = data.cards.filter((c) => c.deck === 'decision' && c.modes.includes('family') && !juniorSkips(c));
    expect(dealt.length).toBeGreaterThan(0);
    for (const c of dealt) expect(oddTyped(JSON.stringify(c)), c.id).toEqual([]);
  });
  it('family cards (opportunity, expense, market) dealt in a junior game', () => {
    for (const c of data.cards.filter((x) => x.deck !== 'decision' && x.modes.includes('family') && !juniorSkips(x))) {
      expect(oddTyped(`${c.titleFamily ?? c.title} ${c.textFamily ?? c.text ?? ''}`), c.id).toEqual([]);
    }
  });
  it('glossary (family view): an odd figure has a junior example', () => {
    for (const c of readLearn('glossary').concepts) {
      if (c.level === 'full' || c.modes?.includes?.('full') && !c.modes.includes('family')) continue;
      const ex = c.family?.exampleText ?? c.example?.text;
      if (oddTyped(ex).length) {
        expect(c.junior?.exampleText, c.id).toBeTruthy();
        expect(oddTyped(c.junior.exampleText), c.id).toEqual([]);
      }
      for (const k of ['short', 'why', 'gameSimplification']) expect(oddTyped(c.family?.[k] ?? c[k]), `${c.id}.${k}`).toEqual([]);
    }
  });
  it('tutorial: check explanations, hints and their "more" lines', () => {
    const tut = readLearn('tutorial');
    for (const q of tut.check.questions) {
      if (oddTyped(q.explain).length) expect(oddTyped(q.explainJunior ?? '₪1'), q.id).toEqual([]);
      expect(q.explainJunior || !oddTyped(q.explain).length, q.id).toBeTruthy();
    }
    for (const hnt of tut.hints.items) {
      expect(oddTyped(hnt.text), hnt.id).toEqual([]);
      if (oddTyped(hnt.more).length) expect(hnt.moreJunior, hnt.id).toBeTruthy();
      if (hnt.moreJunior) expect(oddTyped(hnt.moreJunior), hnt.id).toEqual([]);
    }
  });
  it('feedback, guess and report lines type no odd figure', () => {
    for (const n of ['feedback', 'guess', 'report']) expect(oddTyped(JSON.stringify(readLearn(n))), n).toEqual([]);
  });
});
