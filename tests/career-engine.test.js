// 0.5.0 career, engine half: rank data and its validation, rank games and the deal scale, the in-game promotion, action log format 3
// (rank + promotion, formats 1 and 2 still decode), the save migration 9 -> 10, and "daily and missions are always rank 0".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, EngineError, newMatch, currentState, serialize, deserialize, botStep, playGame, stateHash, validateProfessions, validateData,
  SCHEMA_VERSION, MAX_RANK, PROMOTION_RAISE_PCT, PROMOTION_UPGRADE_SHARE, PROMOTION_FROM_TURN, PROMOTION_TURN_SPAN, PROMOTION_ROUND,
  promotionTerms, promotionTurn, rankDealScale, rankOf, promotionOf, hasFoxAccessory, priceFactor, totalExpenses, monthlyCashFlow,
  encodeActionLog, decodeActionLog, FORMAT_VERSION, configOf, challengeKey, verifyResult, newDailyGame,
  replayDaily, dailyResult, rematch, totalIncome,
} from '../src/engine/index.js';
import { crc32, toBase64Url, fromBase64Url } from '../src/engine/actionlog.js';
import { newShortMission as shortMission, REPAY_MISSION, BUFFER_MISSION } from '../src/engine/short-missions.js';
import { newFirstAsset } from '../src/engine/first-asset.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const fixture = (p) => readFileSync(new URL(`./fixtures/${p}`, import.meta.url), 'utf8');
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const seal = (body) => { const c = crc32(Uint8Array.from(body)); return toBase64Url(Uint8Array.from([...body, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255])); };

/** A bot game to its end; a donor game would roll charity's bonus die, so a challenge-style game (no bonus die) is used where dice matter. */
const play = (config, bot = 'sensible') => playGame(engine, engine.newGame(config), bot, 200);

describe('rank data', () => {
  it('every profession has ranks 1-3 with a title, ascending salaries, and rank 0 stays as it was', () => {
    expect(MAX_RANK).toBe(3);
    for (const p of data.professions) {
      expect(p.ranks.map((r) => r.rank), p.id).toEqual([1, 2, 3]);
      let before = p.salary;
      for (const r of p.ranks) { expect(r.title.length).toBeGreaterThan(2); expect(r.salary).toBeGreaterThan(before); before = r.salary; }
    }
    // rank 0 of the teacher is the profession itself (0.5.1 numbers)
    expect(data.professions[0]).toMatchObject({ id: 'teacher', salary: 8800, savings: 9000, perChild: 450 });
  });
  it('validation: a valid list passes; gaps, a lower salary, a 4th rank, a bad dealScale, a bad debt or a missing expense id fail', () => {
    expect(validateProfessions(data.professions)).toEqual([]);
    const t = structuredClone(data.professions[0]);
    const bad = (mut, re) => { const p = structuredClone(t); mut(p); expect(validateProfessions([p]).join('|')).toMatch(re); };
    bad((p) => { p.ranks[1].rank = 3; }, /rank must be 2/);
    bad((p) => { p.ranks[0].salary = 8000; }, /salary must be above/);
    bad((p) => { p.ranks.push({ ...p.ranks[2], rank: 4, salary: 99999 }); }, /at most 3 ranks/);
    bad((p) => { p.ranks[0].dealScale = 0.5; }, /dealScale/);
    bad((p) => { p.ranks[0].liabilities[0].monthlyPayment = 1; }, /payment must be/);
    bad((p) => { p.ranks[0].expenses = p.ranks[0].expenses.slice(1); }, /keep the ids of rank 0/);
    bad((p) => { delete p.ranks[0].title; }, /title/);
    bad((p) => { p.ranks = 'x'; }, /ranks must be a list/);
    expect(() => validateData({ professions: [{ ...t, ranks: [{ ...t.ranks[0], salary: 1 }] }], cards: data.cards })).toThrow(/Invalid game data/);
  });
  it('adding a rank is a JSON edit: a 4th profession entry with its own dealScale plays', () => {
    const custom = structuredClone(data.professions);
    custom[0].ranks[0].dealScale = 1.6;
    const e = createEngine({ professions: custom, cards: data.cards });
    expect(e.newGame({ mode: 'family', professionId: 'teacher', seed: 4, rank: 1 }).dealScale).toBe(1.6);
  });
});

describe('newGame({ rank })', () => {
  it('rank 0 is the game it always was: no new field, the same hash as a game without the argument', () => {
    const a = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 9 });
    const b = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 9, rank: 0 });
    for (const k of ['rank', 'dealScale', 'promotion']) expect(k in a).toBe(false);
    expect(stateHash(b)).toBe(stateHash(a));
    expect(rankOf(a)).toBe(0);
    expect(a.profession.rankTitle).toBeUndefined();
  });
  it('a rank plays on its own salary, savings, expenses and debts, and says its title', () => {
    for (const p of data.professions) {
      for (const r of p.ranks) {
        const s = engine.newGame({ mode: 'full', professionId: p.id, seed: 3, rank: r.rank });
        expect(s.rank).toBe(r.rank);
        expect(s.profession).toMatchObject({ id: p.id, title: p.title, salary: r.salary, rankTitle: r.title });
        expect(s.cash).toBe(r.savings);
        expect(s.liabilities.map((l) => l.principal)).toEqual(r.liabilities.map((l) => l.principal));
        expect(totalExpenses(s)).toBe(r.expenses.reduce((a, e) => a + e.amount, 0) + r.liabilities.reduce((a, l) => a + l.monthlyPayment, 0));
        expect(s.dealScale).toBeGreaterThan(1);
      }
    }
  });
  it('refuses an unknown rank, a rank the profession lacks, and the daily with a rank or a promotion', () => {
    for (const rank of [-1, 4, 1.5, '1']) expect(() => engine.newGame({ mode: 'family', professionId: 'cook', seed: 1, rank })).toThrow(EngineError);
    const lean = createEngine({ professions: [{ ...data.professions[0], ranks: [data.professions[0].ranks[0]] }], cards: data.cards });
    expect(() => lean.newGame({ mode: 'family', professionId: 'teacher', seed: 1, rank: 2 })).toThrow(/no rank 2/);
    expect(() => engine.newGame({ mode: 'family', professionId: 'cook', seed: 1, rank: 1, daily: { date: '2026-11-20' } })).toThrow(/daily/);
    expect(() => engine.newGame({ mode: 'family', professionId: 'cook', seed: 1, promotion: true, daily: { date: '2026-11-20' } })).toThrow(/daily/);
    expect(() => engine.newGame({ mode: 'family', professionId: 'cook', seed: 1, promotion: true, rngVersion: 1 })).toThrow(/rngVersion 2/);
  });
  it('a junior game at a rank keeps whole coins: salary, expenses and debts are multiples of 100 / 1,000', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'engineer', seed: 2, rank: 3, junior: true });
    expect(s.junior).toBe(true);
    for (const x of [s.profession.salary, s.cash, ...s.profession.expenses.map((e) => e.amount), ...s.liabilities.map((l) => l.monthlyPayment)]) expect(x % 100).toBe(0);
    for (const l of s.liabilities) expect(l.principal % 1000).toBe(0);
  });
});

describe('the deal scale of a rank', () => {
  it('defaults to the salary ratio, rounded to 0.05, never below 1; a rank may set its own', () => {
    const t = data.professions[0];
    expect(rankDealScale(t, t.ranks[0])).toBe(1.65); // 1.3 x 11,200 / 8,800 = 1.65 (the teacher has no dealScale of its own)
    expect(rankDealScale(data.professions.find((x) => x.id === 'cook'), data.professions.find((x) => x.id === 'cook').ranks[0])).toBe(1.2); // a profession's own value wins
    expect(rankDealScale(t, { ...t.ranks[0], dealScale: 3 })).toBe(3);
    expect(rankDealScale(t, { salary: 100 })).toBe(1);
  });
  it('prices, down payments and monthly money of new deals grow with it; the cash flow breakdown still adds up', () => {
    const cardsAt = (rank) => {
      const s = engine.newGame({ mode: 'family', professionId: 'programmer', seed: 11, rank });
      const out = [];
      let st = s;
      for (let i = 0; i < 200 && out.length < 4; i++) {
        st = botStep(engine, st, 'alwaysPass');
        if (st.pending?.kind === 'opportunity' && st.pending.card.type !== 'stock') out.push(st.pending.card);
      }
      return { s, out };
    };
    const r0 = cardsAt(0); const r3 = cardsAt(3);
    expect(priceFactor(r3.s)).toBeGreaterThan(priceFactor(r0.s) * 2);
    const ratio = r3.out[0].price / r3.out[0].price; // same card ids are dealt on the same turn: compare card by id
    void ratio;
    const base = new Map(r0.out.map((c) => [c.id, c]));
    let compared = 0;
    for (const c of r3.out) {
      const b = base.get(c.id);
      if (!b) continue;
      expect(c.price / b.price).toBeGreaterThan(2.3); // x2.6, rounded to 1,000
      expect(c.downPayment).toBeGreaterThan(b.downPayment * 2);
      expect(c.mortgage).toBe(c.price - c.downPayment);
      const gross = c.type === 'business' ? 'profit' : 'rent';
      if (c[gross] !== undefined) expect(c[gross] - c.loanPayment).toBe(c.monthlyCashFlow);
      compared += 1;
    }
    expect(compared + r3.out.length).toBeGreaterThan(0);
  });
  it('each rank wins in about the same number of turns as rank 0 (sensible bot, median of 300 games, within +3)', () => {
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    for (const id of ['teacher', 'programmer']) {
      const turns = (rank) => med(Array.from({ length: 300 }, (_, g) => play({ mode: 'family', professionId: id, seed: 1000 + g * 7919, rank, promotion: true })).filter((s) => s.status === 'won').map((s) => s.turn));
      const base = turns(0);
      for (const rank of [1, 2, 3]) expect(turns(rank) - base, `${id} rank ${rank}`).toBeLessThanOrEqual(3);
    }
  }, 120000);
});

describe('the in-game promotion', () => {
  const config = { mode: 'family', professionId: 'teacher', seed: 77, promotion: true };
  /** Plays until the promotion card is open. */
  const toOffer = (cfg = config) => {
    let s = engine.newGame(cfg);
    for (let i = 0; i < 600 && s.pending?.kind !== 'promotion' && s.status === 'playing'; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, 'sensible');
    return s;
  };
  it('the terms: a raise of 12% of the salary in whole 100s, 80% of it a new expense, always something left', () => {
    expect(promotionTerms(8800)).toEqual({ raise: 1100, upgradeCost: 900 });
    expect(PROMOTION_RAISE_PCT).toBe(0.12); expect(PROMOTION_UPGRADE_SHARE).toBe(0.8);
    for (const salary of [300, 5000, 7800, 8800, 13500, 35000, 90000]) {
      const { raise, upgradeCost } = promotionTerms(salary);
      expect(raise % PROMOTION_ROUND).toBe(0); expect(upgradeCost % PROMOTION_ROUND).toBe(0);
      expect(upgradeCost).toBeGreaterThan(0); expect(upgradeCost).toBeLessThan(raise);
    }
  });
  it('the offer turn is keyed by the seed alone, inside its window', () => {
    for (let seed = 1; seed < 200; seed++) {
      const at = promotionTurn(seed);
      expect(at).toBeGreaterThanOrEqual(PROMOTION_FROM_TURN); expect(at).toBeLessThan(PROMOTION_FROM_TURN + PROMOTION_TURN_SPAN);
      expect(engine.newGame({ ...config, seed }).promotion).toEqual({ status: 'waiting', at });
    }
  });
  it('a game without `promotion: true` has none: no field, no offer, nothing changes', () => {
    const s = playGame(engine, engine.newGame({ ...config, promotion: false }), 'sensible', 200);
    expect(s.promotion).toBeUndefined();
    expect(s.learn.decisions.some((d) => d.kind === 'promotion')).toBe(false);
  });
  it('is offered once, on a payday on or after its turn, and the card carries the terms', () => {
    const s = toOffer();
    expect(s.pending).toMatchObject({ kind: 'promotion', ...promotionTerms(8800) });
    expect(s.phase).toBe('decision');
    expect(s.turn).toBeGreaterThanOrEqual(s.promotion.at);
    expect(s.promotion.status).toBe('offered');
    expect(promotionOf(s)).toBe(s.promotion);
    expect(() => engine.dispatch(s, { type: 'roll' })).toThrow(EngineError); // it must be answered first
    expect(s.events.some((e) => e.type === 'promotionOffered')).toBe(true);
  });
  it("'keep': the whole raise is free cash, expenses and the target stay, no cash perk", () => {
    const s = toOffer();
    const n = engine.dispatch(s, { type: 'promotionKeep' });
    expect(n.profession.salary).toBe(s.profession.salary + 1100);
    expect(totalExpenses(n)).toBe(totalExpenses(s));
    expect(monthlyCashFlow(n)).toBe(monthlyCashFlow(s) + 1100);
    expect(n.cash).toBe(s.cash);
    expect(n.promotion).toMatchObject({ status: 'kept', raise: 1100, upgradeCost: 0 });
    expect(hasFoxAccessory(n)).toBe(false);
    expect(n.learn.decisions.at(-1)).toMatchObject({ kind: 'promotion', choice: 'keep', green: true });
    expect(n.pending?.kind).not.toBe('promotion');
  });
  it("'upgrade': 80% of the raise becomes a monthly expense, the rest stays, a cosmetic accessory, no cash", () => {
    const s = toOffer();
    const n = engine.dispatch(s, { type: 'promotionUpgrade' });
    expect(n.profession.salary).toBe(s.profession.salary + 1100);
    expect(totalExpenses(n)).toBe(totalExpenses(s) + 900);
    expect(monthlyCashFlow(n)).toBe(monthlyCashFlow(s) + 200);
    expect(n.cash).toBe(s.cash);
    expect(n.profession.expenses.at(-1)).toMatchObject({ id: 'lifestyle', amount: 900 });
    expect(n.promotion).toMatchObject({ status: 'upgraded', raise: 1100, upgradeCost: 900 });
    expect(hasFoxAccessory(n)).toBe(true);
    expect(n.learn.decisions.at(-1)).toMatchObject({ kind: 'promotion', choice: 'upgrade', green: false });
  });
  it('happens once per game, and an answer without an open offer is refused', () => {
    const s = toOffer();
    const n = engine.dispatch(s, { type: 'promotionKeep' });
    expect(() => engine.dispatch(n, { type: 'promotionKeep' })).toThrow(/no pending promotion/);
    expect(() => engine.dispatch(engine.newGame(config), { type: 'promotionUpgrade' })).toThrow(EngineError);
    const end = playGame(engine, n, 'sensible', 200);
    expect(end.learn.decisions.filter((d) => d.kind === 'promotion')).toHaveLength(1);
    expect(end.log.filter((a) => a.type === 'promotionKeep' || a.type === 'promotionUpgrade')).toHaveLength(1);
  });
  it('two players on one seed in a challenge game get it on the same turn, whatever they decide', () => {
    const cfg = { mode: 'family', professionId: 'nurse', seed: 4141, promotion: true, challenge: true };
    const turnOf = (bot) => { let s = engine.newGame(cfg); for (let i = 0; i < 800 && s.pending?.kind !== 'promotion' && s.status === 'playing'; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, bot); return s.pending?.kind === 'promotion' ? s.turn : null; };
    const a = turnOf('sensible'); const b = turnOf('cautious'); const c = turnOf('alwaysBuy');
    expect(a).not.toBeNull();
    expect([b, c].filter((x) => x !== null).every((x) => x === a)).toBe(true);
  });
  it('the bots answer it: the reckless ones upgrade, the others keep', () => {
    const answer = (bot) => { const s = toOffer(); return botStep(engine, s, bot).promotion.status; };
    expect(answer('sensible')).toBe('kept'); expect(answer('cautious')).toBe('kept'); expect(answer('alwaysPass')).toBe('kept');
    expect(answer('alwaysBuy')).toBe('upgraded'); expect(answer('overBorrow')).toBe('upgraded');
  });
  it('a hot-seat match: every seat has it, at its own rank, and a rematch keeps both', () => {
    const m = newMatch(engine, { mode: 'family', seed: 5, promotion: true, players: [{ professionId: 'cook', rank: 2 }, { professionId: 'lawyer' }] });
    expect(m.promotion).toBe(true);
    expect(m.players.map((p) => p.state.rank)).toEqual([2, undefined]);
    expect(m.players.every((p) => p.state.promotion?.status === 'waiting')).toBe(true);
    const again = rematch(engine, m, 99);
    expect(again.players[0].state.rank).toBe(2);
    expect(again.players[1].state.promotion.status).toBe('waiting');
  });
});

describe('daily and missions are always rank 0 with no promotion (their records stay byte-identical)', () => {
  it('a daily game carries no rank, scale or promotion field, on either side of the v2 boundary', () => {
    for (const date of ['2026-11-03', '2026-11-20']) {
      const s = newDailyGame(engine, date);
      for (const k of ['rank', 'dealScale', 'promotion']) expect(k in s, `${date} ${k}`).toBe(false);
      expect(priceFactor(s)).toBe(1);
      const end = playGame(engine, s, 'sensible', 200);
      expect(end.log.some((a) => /^promotion/.test(a.type))).toBe(false);
      const rec = dailyResult(end);
      expect(replayDaily(engine, rec).status).toBe(end.status);
    }
  });
  it('the practice missions start unranked and without a promotion', () => {
    const states = [currentState(newFirstAsset(engine)), currentState(shortMission(engine, REPAY_MISSION)), currentState(shortMission(engine, BUFFER_MISSION))];
    for (const s of states) for (const k of ['rank', 'dealScale', 'promotion']) expect(k in s).toBe(false);
  });
});

describe('action log format 3: the rank and the promotion flag', () => {
  const cfg = { mode: 'family', professionId: 'cook', rank: 2, promotion: true };
  const rankedGame = () => { let s = engine.newGame({ ...cfg, seed: 81 }); for (let i = 0; i < 900 && s.status === 'playing'; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, 'alwaysBuy'); return s; };
  it('round-trips the rank (0-3) and the promotion flag with the promotion actions', () => {
    const s = rankedGame();
    expect(s.log.some((a) => a.type === 'promotionUpgrade')).toBe(true);
    const link = { rngVersion: 2, seed: 81, config: configOf(s), actions: s.log };
    expect(link.config).toMatchObject({ rank: 2, promotion: true });
    const back = decodeActionLog(encodeActionLog(link));
    expect(back).toEqual(link);
    expect(engine.replay(back.seed, back.config, back.actions)).toEqual(s);
    for (const rank of [1, 3]) expect(decodeActionLog(encodeActionLog({ ...link, actions: [], config: { ...cfg, rank } })).config.rank).toBe(rank);
    expect(decodeActionLog(encodeActionLog({ ...link, actions: [], config: { mode: 'full', professionId: 'cook' } })).config).toEqual({ mode: 'full', professionId: 'cook' });
    expect(FORMAT_VERSION).toBe(3);
  });
  it('the rank travels with a friend challenge: the same rank, verified, and a different challengeKey per rank / promotion', () => {
    const s = rankedGame();
    const v = engine.verifyResult({ rngVersion: 2, seed: 81, config: configOf(s), actions: s.log });
    expect(v).toMatchObject({ ok: true, status: s.status });
    const key = (config) => challengeKey({ seed: 1, config: { mode: 'family', professionId: 'cook', ...config } });
    expect(key({})).toBe('1|family|cook|0'); // a 0.5.1 key is unchanged
    expect(new Set([key({}), key({ rank: 1 }), key({ rank: 2 }), key({ promotion: true }), key({ rank: 2, promotion: true })]).size).toBe(5);
  });
  it('a junior link at a rank still never carries a name; the 1,800-character guard still measures the name', () => {
    const j = { rngVersion: 2, seed: 5, config: { mode: 'family', professionId: 'cook', junior: true, rank: 1, promotion: true }, actions: [], name: 'שם' };
    expect(decodeActionLog(encodeActionLog(j)).name).toBeUndefined();
    expect(decodeActionLog(encodeActionLog({ ...j, config: { ...j.config, junior: false } })).name).toBe('שם');
  });
  it('formats 1 and 2 still decode, as rank 0 without the promotion', () => {
    const plain = encodeActionLog({ rngVersion: 2, seed: 8, config: { mode: 'full', professionId: 'lawyer', challenge: true }, actions: [{ type: 'roll' }, { type: 'pass' }], name: 'דנה' });
    const asFormat = (n) => { const b = [...fromBase64Url(plain)].slice(0, -4); b[2] = n; return seal(b); };
    for (const n of [2, 3]) expect(decodeActionLog(asFormat(n))).toMatchObject({ config: { mode: 'full', professionId: 'lawyer', challenge: true }, name: 'דנה' });
    expect('rank' in decodeActionLog(asFormat(2)).config || 'promotion' in decodeActionLog(asFormat(2)).config).toBe(false);
  });
  it('formats 1 and 2 refuse what only format 3 has: the rank bits, the promotion bit and the new action codes', () => {
    const withRank = [...fromBase64Url(encodeActionLog({ rngVersion: 2, seed: 8, config: { mode: 'family', professionId: 'cook', rank: 3 }, actions: [] }))].slice(0, -4);
    withRank[2] = 2;
    expect(() => decodeActionLog(seal(withRank))).toThrow(/bad config flags/);
    const withCode = [...fromBase64Url(encodeActionLog({ rngVersion: 2, seed: 8, config: { mode: 'family', professionId: 'cook' }, actions: [{ type: 'promotionKeep' }] }))].slice(0, -4);
    withCode[2] = 2;
    expect(() => decodeActionLog(seal(withCode))).toThrow(/needs format 3/);
  });
  it('a daily link never has a rank or a promotion, a rank above 3 cannot be written', () => {
    const daily = { rngVersion: 2, seed: 5, config: { mode: 'family', professionId: 'cook', daily: { date: '2026-11-20' } }, actions: [] };
    expect(() => encodeActionLog({ ...daily, config: { ...daily.config, rank: 1 } })).toThrow(/daily/);
    expect(() => encodeActionLog({ ...daily, config: { ...daily.config, promotion: true } })).toThrow(/daily/);
    expect(() => encodeActionLog({ ...daily, config: { mode: 'family', professionId: 'cook', rank: 4 } })).toThrow(/bad rank/);
    const b = [...fromBase64Url(encodeActionLog(daily))].slice(0, -4);
    const flagsAt = b.indexOf(4, 3); // the flags byte: the daily bit
    b[flagsAt] |= 32;
    expect(() => decodeActionLog(seal(b))).toThrow(/daily/);
  });
  it('a link with a rank the profession lacks does not verify (the replay refuses it), it never crashes', () => {
    const lean = createEngine({ professions: [{ ...data.professions[0], ranks: [data.professions[0].ranks[0]] }], cards: data.cards });
    const link = encodeActionLog({ rngVersion: 2, seed: 4, config: { mode: 'family', professionId: 'teacher', rank: 3 }, actions: [{ type: 'roll' }] });
    expect(verifyResult(lean, link)).toMatchObject({ ok: false, code: 'REPLAY' });
  });
});

describe('save schema 10: a 0.5.1 save (schema 9) loads as rank 0 and plays on exactly as before', () => {
  it('the schema is 10; the fixture loads, stamps 10, has no rank, scale or promotion', () => {
    expect(SCHEMA_VERSION).toBe(10);
    const raw = fixture('save-v0.5.1-schema9.json');
    expect(JSON.parse(raw).schemaVersion).toBe(9);
    const m = deserialize(raw);
    expect(m.schemaVersion).toBe(10);
    for (const p of m.players) {
      expect(p.state.schemaVersion).toBe(10);
      for (const k of ['rank', 'dealScale', 'promotion']) expect(k in p.state).toBe(false);
      expect(rankOf(p.state)).toBe(0);
    }
  });
  it('plays 6 more turns exactly as the 0.5.1 engine did (dice, position, cash, assets), then saves again as 10', () => {
    const expected = JSON.parse(fixture('save-v0.5.1-schema9.expected.json'));
    const m = deserialize(fixture('save-v0.5.1-schema9.json'));
    expect(m.currentIndex).toBe(expected.currentIndex);
    let s = currentState(m);
    for (const want of expected.after) {
      s = botStep(engine, s, 'sensible');
      let g = 0;
      while (s.status === 'playing' && s.phase !== 'roll' && g++ < 50) s = botStep(engine, s, 'sensible');
      expect({ turn: s.turn, dice: s.lastRoll.dice, position: s.position, cash: s.cash, assets: s.assets.map((a) => a.cardId), status: s.status }).toEqual(want);
    }
    expect(s.promotion).toBeUndefined(); // an old game never gets the promotion mid-way
    const back = deserialize(serialize({ ...m, players: m.players.map((p, i) => (i === m.currentIndex ? { ...p, state: s } : p)) }));
    expect(back.schemaVersion).toBe(10);
  });
  it('a ranked game with a promotion round-trips through a save', () => {
    const m = newMatch(engine, { mode: 'family', seed: 6, promotion: true, players: [{ professionId: 'police', rank: 3 }] });
    const back = deserialize(serialize(m));
    expect(back).toEqual({ ...m, schemaVersion: 10 });
    expect(currentState(back)).toMatchObject({ rank: 3, promotion: { status: 'waiting' } });
  });
});

describe('derived figures stay honest at a rank', () => {
  it('income = salary + passive; the win target is the (higher) rank expenses', () => {
    const r0 = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 2 });
    const r3 = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 2, rank: 3 });
    expect(totalIncome(r3)).toBe(19500);
    expect(totalExpenses(r3)).toBeGreaterThan(totalExpenses(r0) * 2);
  });
});
