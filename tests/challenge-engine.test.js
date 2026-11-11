// 0.5.1 friend challenges: the challenge rules in the engine, verifyResult, the timeline / split / takeaway helpers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, playGame, botStep, EngineError, encodeActionLog, newMatch, verifyResult, replayTurns, compareOutcome, splitTurns,
  takeawayOf, challengeEligibility, challengeKey, freedomPct, linkLogOf, configOf, v2Die,
  dealMetrics,
} from '../src/engine/index.js';
import { crc32, toBase64Url, fromBase64Url } from '../src/engine/actionlog.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const cfg = { mode: 'family', professionId: 'teacher' };

/** Plays a game with a bot to the end; `donor` = donate on every charity square. */
function play(seed, { config = cfg, bot = 'sensible', donor = false, challenge = false } = {}) {
  let s = engine.newGame({ ...config, seed, challenge });
  for (let i = 0; i < 2000 && s.status === 'playing'; i++) {
    if (s.pending?.kind === 'charity') s = engine.dispatch(s, { type: s.cash >= s.pending.cost && donor ? 'donate' : 'declineCharity' });
    else s = botStep(engine, s, bot);
  }
  return s;
}
const logOf = (s) => ({ rngVersion: 2, seed: s.seed, config: configOf(s), actions: s.log });
const usedBonus = (s) => replayTurns(engine, logOf(s)).bonusDie;
/** A normal game that earns a reroll token through right guesses and arms it once. */
function rerollGame() {
  for (let seed = 1; seed < 400; seed++) {
    let s = engine.newGame({ ...cfg, seed });
    let armed = false;
    for (let i = 0; i < 2000 && s.status === 'playing'; i++) {
      const c = s.pending?.kind === 'opportunity' ? s.pending.card : null;
      const light = c && c.type !== 'stock' ? dealMetrics(c).light : null;
      if (c && light && !s.learn.guesses?.some((g) => g.cardId === c.id && g.turn === s.turn)) {
        s = engine.dispatch(s, { type: 'guess', cardId: c.id, light, guess: light === 'red' ? 'bad' : 'good' });
        continue;
      }
      if (s.phase === 'roll' && s.rerollTokens > 0 && !s.rerollArmed && !armed) { s = engine.dispatch(s, { type: 'armReroll' }); armed = true; continue; }
      if (s.pending?.kind === 'charity') s = engine.dispatch(s, { type: 'declineCharity' });
      else s = botStep(engine, s, 'sensible');
    }
    if (armed && s.status !== 'playing') return s;
  }
  throw new Error('no reroll seed');
}
const findSeed = (pred, opts) => { for (let seed = 1; seed < 400; seed++) { const s = play(seed, opts); if (pred(s)) return s; } throw new Error('no seed'); };

describe('challenge rules in the engine', () => {
  it('newGame({ challenge }) marks the state; a normal game has no field; never together with the daily', () => {
    expect(engine.newGame({ ...cfg, seed: 3, challenge: true }).challenge).toBe(true);
    expect('challenge' in engine.newGame({ ...cfg, seed: 3 })).toBe(false);
    expect(() => engine.newGame({ ...cfg, seed: 3, challenge: true, daily: { date: '2026-11-20' } })).toThrow(EngineError);
  });
  it('a donation still happens (cash paid, counted) but gives no bonus die: every roll is one die', () => {
    const s = findSeed((x) => x.stats.donations > 0, { donor: true, challenge: true });
    expect(s.challenge).toBe(true);
    let st = engine.newGame({ ...cfg, seed: s.seed, challenge: true });
    for (const a of s.log) {
      const next = engine.dispatch(st, a);
      if (a.type === 'roll') expect(next.lastRoll.dice).toEqual([v2Die(s.seed, next.turn, 0)]);
      if (a.type === 'donate') { expect(next.charityTurns).toBe(0); expect(next.cash).toBe(st.cash - st.pending.cost); }
      st = next;
    }
  });
  it('a normal game with a donation does roll the bonus die (unchanged rule)', () => {
    const s = findSeed((x) => usedBonus(x), { donor: true });
    expect(s.challenge).toBeUndefined();
  });
  it('armReroll is refused in a challenge, even with a token; an armed flag set by hand never rolls a second set', () => {
    const s = { ...engine.newGame({ ...cfg, seed: 8, challenge: true }), rerollTokens: 2 };
    expect(() => engine.dispatch(s, { type: 'armReroll' })).toThrow(/no reroll in a friend challenge/);
    const forced = engine.roll({ ...s, rerollArmed: true });
    expect(forced.events.some((e) => e.type === 'reroll')).toBe(false);
    expect(forced.rerollTokens).toBe(2);
    expect(engine.dispatch({ ...engine.newGame({ ...cfg, seed: 8 }), rerollTokens: 1 }, { type: 'armReroll' }).rerollArmed).toBe(true); // normal game unchanged
  });
  it('the same seed gives the same dice to a challenge player whatever they decide', () => {
    const a = play(21, { bot: 'alwaysBuy', challenge: true, donor: true });
    const b = play(21, { bot: 'cautious', challenge: true });
    const dice = (s) => replayTurns(engine, logOf(s)).turns.map((t) => t.turn);
    const n = Math.min(a.turn, b.turn);
    expect(n).toBeGreaterThan(5);
    const rolls = (s) => { let st = engine.newGame({ ...cfg, seed: 21, challenge: true }); const out = []; for (const x of s.log) { st = engine.dispatch(st, x); if (x.type === 'roll') out.push(st.position); } return out; };
    expect(rolls(a).slice(0, n)).toEqual(rolls(b).slice(0, n)); // the same squares, turn by turn
    void dice;
  });
});

describe('verifyResult', () => {
  const won = findSeed((x) => x.status === 'won' && !usedBonus(x));
  it('replays an encoded or a decoded log to its result', () => {
    const log = logOf(won);
    for (const input of [encodeActionLog(log), log]) {
      const v = engine.verifyResult(input);
      expect(v).toMatchObject({ ok: true, comparable: true, status: 'won', turns: won.turn, freedomPct: 100 });
      expect(v.stats).toMatchObject({ dealsBought: won.stats.dealsBought, loansTaken: won.stats.loansTaken });
      expect(verifyResult(engine, input)).toEqual(v);
    }
  });
  it('a lost game verifies with its freedom %', () => {
    const lost = findSeed((x) => x.status === 'lost', { bot: 'overBorrow' });
    expect(engine.verifyResult(logOf(lost))).toMatchObject({ ok: true, status: 'lost', freedomPct: freedomPct(lost) });
  });
  it('comparable is false when the log rolled a charity bonus die or a reroll', () => {
    const bonus = findSeed((x) => x.status !== 'playing' && usedBonus(x), { donor: true });
    expect(engine.verifyResult(logOf(bonus))).toMatchObject({ ok: true, comparable: false });
    // a reroll: right guesses on deals earn a token (a streak of 3), the bot then arms it before its next roll
    const s = rerollGame();
    expect(replayTurns(engine, logOf(s)).reroll).toBe(true);
    expect(engine.verifyResult(logOf(s))).toMatchObject({ ok: true, comparable: false });
  });
  it('a seed-only log ("new challenge, same game") is ok, empty and not comparable', () => {
    expect(engine.verifyResult(encodeActionLog(linkLogOf(won, { kind: 'fresh' })))).toMatchObject({ ok: true, comparable: false, empty: true, status: 'playing' });
  });
  it('refuses rngVersion 1, a daily, auctions, an unfinished game and an illegal move, with a code', () => {
    const v1 = engine.newGame({ ...cfg, seed: 9, rngVersion: 1 });
    expect(engine.verifyResult(encodeActionLog({ rngVersion: 1, seed: 9, config: cfg, actions: [{ type: 'roll' }] }))).toMatchObject({ ok: false, code: 'VERSION' });
    void v1;
    expect(engine.verifyResult({ rngVersion: 2, seed: 9, config: { ...cfg, daily: { date: '2026-11-20' } }, actions: [] })).toMatchObject({ ok: false, code: 'DAILY' });
    const card = { id: 'fake', deck: 'opportunity', type: 'business', title: 'x', price: 1, downPayment: 1, mortgage: 0, monthlyCashFlow: 999999 };
    expect(engine.verifyResult({ rngVersion: 2, seed: 9, config: cfg, actions: [{ type: 'auctionWin', card, price: 1 }] })).toMatchObject({ ok: false, code: 'AUCTION' });
    const half = { ...logOf(won), actions: won.log.slice(0, 6) };
    expect(engine.verifyResult(half)).toMatchObject({ ok: false, code: 'UNFINISHED' });
    const bad = { ...logOf(won), actions: [{ type: 'roll' }, { type: 'roll' }, { type: 'buy', qty: 1 }, ...won.log] };
    const v = engine.verifyResult(bad);
    expect(v).toMatchObject({ ok: false, code: 'REPLAY' });
    expect(v.log.seed).toBe(won.seed); // still playable: the seed and config decoded
  });
  it('decode failures carry FORMAT / CRC / VERSION codes', () => {
    const text = encodeActionLog(logOf(won));
    expect(engine.verifyResult(`${text.slice(0, 10)}`)).toMatchObject({ ok: false, code: expect.stringMatching(/FORMAT|CRC/) });
    expect(engine.verifyResult('!!')).toMatchObject({ ok: false, code: 'FORMAT' });
    const b = [...fromBase64Url(text)];
    b[8] ^= 1;
    expect(engine.verifyResult(toBase64Url(Uint8Array.from(b)))).toMatchObject({ ok: false, code: 'CRC' });
    const body = [...fromBase64Url(text)].slice(0, -4);
    body[2] = 4; // a format from the future, resealed
    const c = crc32(Uint8Array.from(body));
    expect(engine.verifyResult(toBase64Url(Uint8Array.from([...body, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255])))).toMatchObject({ ok: false, code: 'VERSION' });
  });
  it('a challenge game (config.challenge) replays under the challenge rules', () => {
    const s = findSeed((x) => x.status !== 'playing' && x.stats.donations > 0, { donor: true, challenge: true });
    expect(engine.verifyResult(encodeActionLog(logOf(s)))).toMatchObject({ ok: true, comparable: true, turns: s.turn });
  });
});

describe('compare, splits and takeaway', () => {
  const r = (status, turns, pct) => ({ ok: true, comparable: true, status, turns, freedomPct: pct });
  it('compareOutcome follows spec §4.1 and claims no winner for an unverified side', () => {
    expect(compareOutcome(r('won', 20, 100), r('won', 23, 100))).toBe('you');
    expect(compareOutcome(r('won', 25, 100), r('won', 23, 100))).toBe('them');
    expect(compareOutcome(r('won', 23, 100), r('won', 23, 100))).toBe('tie');
    expect(compareOutcome(r('lost', 30, 70), r('won', 40, 100))).toBe('them');
    expect(compareOutcome(r('lost', 30, 70), r('lost', 20, 64))).toBe('you');
    expect(compareOutcome(r('lost', 30, 64), r('lost', 20, 64))).toBe('tie');
    expect(compareOutcome(r('won', 20, 100), { ok: false })).toBe(null);
    expect(compareOutcome(r('won', 20, 100), { ...r('won', 1, 100), comparable: false })).toBe(null);
  });
  it('two challenge games on one seed with different bots split on decisions, never on the square', () => {
    const a = play(33, { bot: 'alwaysBuy', challenge: true });
    const b = play(33, { bot: 'cautious', challenge: true });
    const rows = splitTurns(replayTurns(engine, logOf(a)).turns, replayTurns(engine, logOf(b)).turns);
    const both = rows.filter((x) => x.you && x.them);
    expect(both.every((x) => x.you.square === x.them.square)).toBe(true);
    expect(rows.some((x) => x.split.length)).toBe(true);
    const lines = takeawayOf(rows, { verified: true });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[0].key).not.toBe('sameDecisions');
    expect(takeawayOf(rows, { verified: false })).toEqual([]);
  });
  it('the same log against itself has no split: sameDecisions', () => {
    const a = replayTurns(engine, logOf(play(33, { challenge: true }))).turns;
    expect(takeawayOf(splitTurns(a, a))).toEqual([{ key: 'sameDecisions', params: {}, turn: null }]);
  });
  it('takeaway lines map the first deal / loan / expense split (charity never counts)', () => {
    const t = (o) => ({ turn: 4, bought: null, passed: null, loans: [], expense: null, charity: null, repaid: [], ...o });
    const deal = (monthly, light = 'green') => ({ cardId: 'c', title: 'עגלת קפה', monthly, light, years: 4 });
    const one = (y, th) => takeawayOf([{ turn: 4, you: t(y), them: t(th), split: splitTurns([t(y)], [t(th)])[0].split }])[0].key;
    expect(one({ passed: deal(500) }, { bought: deal(500) })).toBe('passedGoodDeal');
    expect(one({ passed: deal(-200, 'red') }, { bought: deal(-200, 'red') })).toBe('passedNegative');
    expect(one({ bought: deal(500) }, { passed: deal(500) })).toBe('boughtGoodDeal');
    expect(one({ bought: deal(-100) }, { passed: deal(-100) })).toBe('boughtNegative');
    expect(one({ bought: deal(500), loans: [{ amount: 10000, purpose: 'deal', monthly: 100, perPayday: 1200 }] }, { passed: deal(500) })).toBe('loanForDeal');
    expect(one({ loans: [{ amount: 5000, purpose: 'voluntary', monthly: 50, perPayday: 600 }] }, {})).toBe('loanYou');
    expect(one({ expense: { via: 'loan' }, loans: [{ amount: 2000, purpose: 'expense', monthly: 20 }] }, { expense: { via: 'cash' } })).toBe('cushionLoan');
    expect(one({ expense: { via: 'cash' } }, { expense: { via: 'loan' } })).toBe('cushionCash');
    expect(one({ charity: 'donated' }, {})).toBe('sameDecisions'); // a charity split is shown in the timeline, never a takeaway
  });
});

describe('challenge eligibility (the end screen button)', () => {
  const won = findSeed((x) => x.status === 'won' && !usedBonus(x));
  const matchOf = (s, extra = {}) => ({ ...newMatch(engine, { mode: s.mode, seed: s.seed, players: [{ professionId: s.profession.id }] }), players: [{ id: 'p1', state: s, bot: null }], status: s.status, ...extra });
  it("a finished single-player game is 'link'; with a bonus die it is 'fresh'", () => {
    expect(challengeEligibility(engine, matchOf(won))).toBe('link');
    const bonus = findSeed((x) => x.status !== 'playing' && usedBonus(x), { donor: true });
    expect(challengeEligibility(engine, matchOf(bonus))).toBe('fresh');
  });
  it('hidden for hot-seat, bots, daily, missions, short games, challenge games, rngVersion 1 and unfinished games', () => {
    const m = matchOf(won);
    expect(challengeEligibility(engine, { ...m, players: [...m.players, m.players[0]] })).toBe(false);
    expect(challengeEligibility(engine, { ...m, players: [{ ...m.players[0], bot: 'sensible' }] })).toBe(false);
    expect(challengeEligibility(engine, { ...m, daily: { date: '2026-11-20' } })).toBe(false);
    expect(challengeEligibility(engine, { ...m, mission: { id: 'first-asset' } })).toBe(false);
    expect(challengeEligibility(engine, { ...m, roundCap: 12 })).toBe(false);
    expect(challengeEligibility(engine, { ...m, challenge: { log: 'x' } })).toBe(false);
    expect(challengeEligibility(engine, matchOf({ ...won, rngVersion: 1 }))).toBe(false);
    expect(challengeEligibility(engine, matchOf(engine.newGame({ ...cfg, seed: 2 })))).toBe(false);
  });
  it('challengeKey: same seed + rules config', () => {
    expect(challengeKey({ seed: 5, config: { mode: 'family', professionId: 'cook', junior: true } })).toBe('5|family|cook|1');
    expect(challengeKey({ seed: 5, config: { mode: 'family', professionId: 'cook', challenge: true } })).toBe('5|family|cook|0');
  });
});
