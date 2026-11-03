// v0.5 keyed RNG (docs/RNG.md): rngVersion 2 values depend on (seed, purpose, turn, index) only, never on a decision.
// Also: v1 (old saves) unchanged, the v0.4 schema-8 fixture, the daily-challenge boundary, the engine-purity rule.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  createEngine, EngineError, BOARD, newMatch, currentState, deserialize, serialize, botStep, playGame, SCHEMA_VERSION,
  hashString, unit, keyedInt, keyedShuffle, v2Die, v2RerollDie, v2AuditPick, v2DeckOrder, botProfessionId, stateHash,
  RNG_VERSION, V2_DRAW_SCHEME, rngVersionOf, DAILY_RNG_V2_FROM, dailyRngVersion, newDailyGame, replayDaily, dailyResult,
  dailyDie, dailyPick, TAX_AUDIT_PICKS, dealTierIndex, DEAL_TIERS, totalExpenses,
} from '../src/engine/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const oppIdx = BOARD.indexOf('opportunity');

/** Plays a bot game and returns the per-turn first dice and the state. */
function playBot(seed, bot, { mode = 'family', professionId = 'teacher', turns = 40 } = {}) {
  let s = engine.newGame({ mode, professionId, seed });
  const dice = {};
  let guard = 0;
  while (s.status === 'playing' && s.turn < turns && guard++ < 4000) {
    const t = s.turn;
    s = botStep(engine, s, bot);
    if (s.turn > t) dice[s.turn] = s.lastRoll.dice;
  }
  return { s, dice };
}

describe('rng.js primitives', () => {
  it('the hash is the daily one (re-exported, byte-identical) and keyedInt stays in range', () => {
    expect(hashString('passivo-daily|2026-10-21')).toBe(hashString(`passivo-daily|${'2026-10-21'}`));
    expect(unit(5, 'die', 3, 0)).toBe(hashString('5|die|3|0') / 4294967296);
    for (let i = 0; i < 2000; i++) {
      const v = keyedInt(i, 'x', i % 7, i % 3, 6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
    }
  });
  it('dice are uniform: chi-square of 60,000 keyed dice is below the 0.1% critical value (5 dof: 20.5)', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 600; seed++) for (let t = 1; t <= 50; t++) for (let k = 0; k < 2; k++) counts[v2Die(seed * 7919, t, k) - 1] += 1;
    const n = counts.reduce((a, b) => a + b, 0);
    const chi = counts.reduce((a, c) => a + ((c - n / 6) ** 2) / (n / 6), 0);
    expect(chi).toBeLessThan(20.5);
  });
  it('the reroll set and the audit pick are their own streams', () => {
    let same = 0;
    for (let t = 1; t <= 600; t++) if (v2RerollDie(9, t, 0) === v2Die(9, t, 0)) same += 1;
    expect(same).toBeGreaterThan(60); // ~1/6 by chance, not 100%
    expect(same).toBeLessThan(150);
    for (let t = 1; t < 100; t++) expect(v2AuditPick(3, t, TAX_AUDIT_PICKS)).toBeLessThan(TAX_AUDIT_PICKS);
  });
  it('keyedShuffle is a deterministic permutation; another key gives another order', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const a = keyedShuffle(1, 'deck:opportunity', 4, ids);
    expect([...a].sort()).toEqual([...ids].sort());
    expect(keyedShuffle(1, 'deck:opportunity', 4, ids)).toEqual(a);
    expect(keyedShuffle(1, 'deck:opportunity', 5, ids)).not.toEqual(a);
    expect(ids[0]).toBe('c0'); // the input is not touched
  });
  it('stateHash ignores key order and the events feed', () => {
    expect(stateHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(stateHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(stateHash({ a: 1, events: [1] })).toBe(stateHash({ a: 1, events: [] }));
    expect(stateHash({ a: 1 })).not.toBe(stateHash({ a: 2 }));
  });
});

describe('rngVersion 2: new games', () => {
  it('a new game is version 2 with no stream state and no pile; the shipped draw scheme is turn-keyed', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'engineer', seed: 3 });
    expect(RNG_VERSION).toBe(2);
    expect(V2_DRAW_SCHEME).toBe('turn');
    expect(s.rngVersion).toBe(2);
    expect('rngState' in s).toBe(false);
    expect('decks' in s).toBe(false);
    expect(s.draws).toEqual({ opportunity: 0, expense: 0, market: 0 });
    expect(s.log).toEqual([]);
    expect(rngVersionOf({})).toBe(1); // a state without the field is an old (v1) game
    expect(() => engine.newGame({ professionId: 'teacher', rngVersion: 3 })).toThrow(EngineError);
    expect(() => createEngine(data, { drawScheme: 'other' })).toThrow(EngineError);
  });
  it('die k of turn t is keyed: the same whatever the players decided (5 bots, 40 seeds)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const runs = ['alwaysBuy', 'cautious', 'sensible', 'alwaysPass', 'overBorrow'].map((b) => playBot(seed * 101, b));
      for (const { dice } of runs) {
        for (const [t, d] of Object.entries(dice)) d.forEach((v, k) => expect(v).toBe(v2Die(seed * 101, Number(t), k)));
      }
    }
  });
  it('the charity bonus die is die 1 of the same turn and never shifts a later die', () => {
    const base = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 77 });
    const giver = { ...base, charityTurns: 3 };
    let a = base; let b = giver;
    for (let t = 1; t <= 6; t++) {
      a = engine.dispatch({ ...a, position: 0, pending: null, phase: 'roll' }, { type: 'roll' });
      b = engine.dispatch({ ...b, position: 0, pending: null, phase: 'roll' }, { type: 'roll' });
      expect(a.lastRoll.dice).toEqual([v2Die(77, t, 0)]);
      expect(b.lastRoll.dice).toEqual(t <= 3 ? [v2Die(77, t, 0), v2Die(77, t, 1)] : [v2Die(77, t, 0)]);
      a = { ...a, status: 'playing' }; b = { ...b, status: 'playing' };
    }
  });
  it('a reroll rolls the reroll stream, keeps the higher set, and leaves every later die where it was', () => {
    const s0 = { ...engine.newGame({ mode: 'family', professionId: 'teacher', seed: 31 }), rerollTokens: 1 };
    const armed = engine.dispatch(s0, { type: 'armReroll' });
    const r = engine.dispatch(armed, { type: 'roll' });
    const ev = r.events.find((e) => e.type === 'reroll');
    expect(ev.first).toEqual([v2Die(31, 1, 0)]);
    expect([...ev.kept, ...ev.dropped].sort()).toEqual([v2Die(31, 1, 0), v2RerollDie(31, 1, 0)].sort());
    expect(r.rerollTokens).toBe(0);
    const later = (s) => { let x = s; while (x.phase !== 'roll' && x.status === 'playing') x = botStep(engine, x, 'alwaysPass'); return engine.dispatch(x, { type: 'roll' }); };
    expect(later(r).lastRoll.dice).toEqual([v2Die(31, 2, 0)]);
  });
  it('the tax-audit pick is keyed by the turn', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'teacher', seed: 12 });
    const at = engine.roll({ ...s, position: BOARD.indexOf('taxAudit') - 1 }, [1]);
    expect(at.pending).toEqual({ kind: 'taxAudit', pick: v2AuditPick(12, 1, TAX_AUDIT_PICKS) });
  });
  it('same seed, turn and deck tile, same player standing: the same card, whatever happened before (cash, buys, draws)', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'nurse', seed: 404 });
    for (let turn = 0; turn < 30; turn++) {
      const a = engine.roll({ ...s, turn, position: oppIdx - 1 }, [1]);
      const b = engine.roll({ ...s, turn, position: oppIdx - 1, cash: s.cash + 5000, draws: { opportunity: 9, expense: 2, market: 4 }, stats: { ...s.stats, dealsBought: 3 } }, [1]);
      expect(b.pending.card).toEqual(a.pending.card);
      expect(b.pending.alt).toEqual(a.pending.alt);
      for (const sq of ['expense', 'market']) {
        const i = BOARD.indexOf(sq);
        const x = engine.roll({ ...s, turn, position: i - 1 }, [1]);
        const y = engine.roll({ ...s, turn, position: i - 1, cash: s.cash + 777, draws: { opportunity: 3, expense: 7, market: 1 } }, [1]);
        expect(y.events.find((e) => e.type === 'market')?.card?.id ?? y.pending?.card?.id ?? null).toBe(x.events.find((e) => e.type === 'market')?.card?.id ?? x.pending?.card?.id ?? null);
      }
    }
  });
  it('the v1 pile rules on the keyed order: an out-of-tier deal is swapped for the first in-tier deal, `requires` skips', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 9 });
    const elig = data.cards.filter((c) => (c.deck === 'opportunity' || (c.deck === 'decision' && c.square === 'opportunity')) && c.modes.includes('family')).map((c) => c.id);
    const byId = new Map(data.cards.map((c) => [c.id, c]));
    const exp = totalExpenses(s);
    const fits = (c) => !(c.type === 'apartment' || c.type === 'business') || !(c.monthlyCashFlow > 0) || (c.monthlyCashFlow / exp >= DEAL_TIERS[0].min && c.monthlyCashFlow / exp <= DEAL_TIERS[0].max);
    const met = (c) => !c.requires || (!c.requires.asset && !c.requires.bankLoan);
    let swaps = 0; let skips = 0;
    for (let turn = 1; turn <= 300; turn++) {
      const order = v2DeckOrder(9, 'opportunity', turn, elig).map((id) => byId.get(id));
      const k = order.findIndex(met);
      let want = order[k];
      if (!fits(want)) { want = order.slice(k + 1).find((c) => (c.type === 'apartment' || c.type === 'business') && Number.isFinite(c.monthlyCashFlow) && fits(c) && met(c)) ?? want; swaps += 1; }
      if (k > 0) skips += 1;
      const got = engine.roll({ ...s, turn: turn - 1, position: oppIdx - 1 }, [1]);
      expect(dealTierIndex(s)).toBe(0);
      expect(got.pending.card.id).toBe(want.id);
    }
    expect(swaps).toBeGreaterThan(2); // both rules were exercised
    expect(skips).toBeGreaterThan(2);
  });
  it('a deal comes with a second, different deal (the choice) taken from the same keyed pile', () => {
    const s = engine.newGame({ mode: 'full', professionId: 'engineer', seed: 21 });
    let offers = 0;
    for (let turn = 0; turn < 60; turn++) {
      const r = engine.roll({ ...s, turn, position: oppIdx - 1 }, [1]);
      if (r.pending?.kind !== 'opportunity' || r.pending.card.type === 'stock') continue;
      offers += 1;
      expect(r.pending.alt).toBeTruthy();
      expect(r.pending.alt.id).not.toBe(r.pending.card.id);
      expect(['apartment', 'business']).toContain(r.pending.alt.type);
    }
    expect(offers).toBeGreaterThan(20);
  });
  it('the draws counters count the draws (stats only)', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 5 });
    s = engine.roll({ ...s, position: oppIdx - 1 }, [1]);
    expect(s.draws.opportunity).toBe(1);
  });
  it('the positional scheme (measured alternative) is decision independent too for the same draw count', () => {
    const pos = createEngine(data, { drawScheme: 'positional' });
    const s = pos.newGame({ mode: 'family', professionId: 'teacher', seed: 8 });
    const a = pos.roll({ ...s, turn: 4, position: oppIdx - 1, draws: { opportunity: 3, expense: 0, market: 0 } }, [1]);
    const b = pos.roll({ ...s, turn: 11, position: oppIdx - 1, cash: 99999, draws: { opportunity: 3, expense: 0, market: 0 } }, [1]);
    expect(b.pending.card.id).toBe(a.pending.card.id);
  });
});

describe('the bot seat profession (UI setup) comes from the seed', () => {
  it('is stable for a seed and seat, in the list, and spread over the professions', () => {
    const ids = data.professions.map((p) => p.id);
    expect(botProfessionId(123, 1, ids)).toBe(botProfessionId(123, 1, ids));
    const seen = new Set();
    for (let seed = 1; seed < 400; seed++) { const id = botProfessionId(seed, 1, ids); expect(ids).toContain(id); seen.add(id); }
    expect(seen.size).toBe(ids.length);
    const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
    expect(app).toContain('botProfessionId(seed, i, professionIds)');
    expect(app).not.toMatch(/botProfession\s*=\s*\(\)\s*=>[^\n]*Math\.random/);
  });
});

describe('purity: the engine has no clock and no Math.random; cosmetic randomness never reaches it', () => {
  const dir = new URL('../src/engine/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  it('no Math.random, Date.now, new Date or crypto in src/engine', () => {
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
      expect(src.join('\n'), f).not.toMatch(/Math\.random|Date\.now|new Date\b|crypto\./);
    }
  });
  it('the cosmetic sources (die tumble, coin burst / confetti, tutorial shuffle) import nothing from the engine', () => {
    for (const f of ['../src/ui/die.js', '../src/ui/fx.js', '../src/learn/tutorial.js']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/from ['"][^'"]*engine\/(engine|rng|bots|match)\.js['"]/);
    }
    // die.js only animates the dice the engine already rolled: its random tilt never feeds back into the state
    const die = readFileSync(new URL('../src/ui/die.js', import.meta.url), 'utf8');
    expect(die).toMatch(/Math\.random\(\) \* 2 - 1\) \* 80/);
  });
});

describe('rngVersion 1: old games are untouched', () => {
  it('48 v1 bot games end exactly as before v0.5 (fixture recorded on the pre-v0.5 engine)', () => {
    const golden = JSON.parse(fixture('v1-games-golden.json'));
    for (const g of golden) {
      let s = engine.newGame({ mode: g.mode, professionId: g.professionId, seed: g.seed, rngVersion: 1 });
      s = playGame(engine, s, g.bot, 200);
      const { events, log, rngVersion, ...rest } = s;
      expect(rngVersion).toBe(1);
      expect({ turn: s.turn, status: s.status, cash: s.cash, rngState: s.rngState }).toEqual({ turn: g.turn, status: g.status, cash: g.cash, rngState: g.rngState });
      expect(hashString(JSON.stringify({ ...rest, schemaVersion: 8 }))).toBe(g.digest);
    }
  });
  it('the v0.4 schema-8 save fixture loads as rngVersion 1 and plays 3 turns exactly as v0.4 did', () => {
    const raw = fixture('save-v0.4-schema8.json');
    expect(JSON.parse(raw).schemaVersion).toBe(8);
    const expected = JSON.parse(fixture('save-v0.4-schema8.expected.json'));
    const m = deserialize(raw);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.players.every((p) => p.state.rngVersion === 1 && p.state.schemaVersion === 9)).toBe(true);
    expect(m.currentIndex).toBe(expected.currentIndex);
    let s = currentState(m);
    for (const want of expected.after) {
      s = botStep(engine, s, 'sensible');
      let g = 0;
      while (s.status === 'playing' && s.phase !== 'roll' && g++ < 50) s = botStep(engine, s, 'sensible');
      expect({ turn: s.turn, dice: s.lastRoll.dice, position: s.position, cash: s.cash, rngState: s.rngState, decks: s.decks, assets: s.assets.map((a) => a.cardId) }).toEqual(want);
    }
    // and it saves again as schema 9, still version 1
    const back = deserialize(serialize({ ...m, players: m.players.map((p, i) => (i === m.currentIndex ? { ...p, state: s } : p)) }));
    expect(currentState(back).rngVersion).toBe(1);
  });
});

describe('daily challenge: v1 streams before DAILY_RNG_V2_FROM, v2 from it on', () => {
  const dayBefore = (key) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  it('the boundary is a future day key; the day before is version 1, the day itself version 2', () => {
    expect(DAILY_RNG_V2_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dailyRngVersion(dayBefore(DAILY_RNG_V2_FROM))).toBe(1);
    expect(dailyRngVersion(DAILY_RNG_V2_FROM)).toBe(2);
    expect(dailyRngVersion('2026-11-03')).toBe(1);
    expect(newDailyGame(engine, dayBefore(DAILY_RNG_V2_FROM)).rngVersion).toBe(1);
    expect(newDailyGame(engine, DAILY_RNG_V2_FROM).rngVersion).toBe(2);
  });
  it('days before the boundary are byte-identical to v0.4: dice, cards, picks and logs (fixture recorded on the pre-v0.5 engine)', () => {
    const golden = JSON.parse(fixture('daily-v1-golden.json'));
    for (const [key, want] of Object.entries(golden)) {
      const [date, bot] = key.split('|');
      expect(dailyRngVersion(date)).toBe(1);
      let s = newDailyGame(engine, date);
      const turns = [];
      let g = 0;
      while (s.status === 'playing' && g++ < 3000) {
        const before = s.turn;
        s = botStep(engine, s, bot);
        if (s.turn > before) {
          const card = s.events.find((e) => e.type === 'market')?.card?.id ?? s.pending?.card?.id ?? s.events.find((e) => e.type === 'expensePaid')?.card?.id ?? null;
          turns.push({ turn: s.turn, dice: s.lastRoll.dice, to: s.position, card, pick: s.pending?.kind === 'taxAudit' ? s.pending.pick : undefined });
        }
      }
      expect(JSON.parse(JSON.stringify(turns)), key).toEqual(want.turns);
      expect([s.status, s.cash], key).toEqual([want.status, want.cash]);
      expect(s.daily.log, key).toEqual(want.log);
      expect(turns.every((x) => x.dice[0] === dailyDie(s.seed, x.turn, 0))).toBe(true);
    }
  });
  it('from the boundary on: v2 keyed dice and draws, the same for every decision, and still replayable', () => {
    for (const date of [DAILY_RNG_V2_FROM, '2027-01-15']) {
      const runs = ['alwaysBuy', 'cautious', 'sensible'].map((bot) => {
        let s = newDailyGame(engine, date);
        const dice = {}; const picks = {};
        let g = 0;
        while (s.status === 'playing' && g++ < 3000) {
          const before = s.turn;
          s = botStep(engine, s, bot);
          if (s.turn > before) {
            dice[s.turn] = s.lastRoll.dice;
            const c = s.events.find((e) => e.type === 'market')?.card?.id ?? s.pending?.card?.id ?? null;
            if (c) picks[`${s.turn}:${BOARD[s.position]}`] = c;
          }
        }
        return { s, dice, picks };
      });
      for (const { s, dice } of runs) {
        expect(s.rngVersion).toBe(2);
        for (const [t, d] of Object.entries(dice)) d.forEach((v, k) => expect(v).toBe(v2Die(s.seed, Number(t), k)));
        expect(replayDaily(engine, dailyResult(s))).toEqual({ ...s, events: replayDaily(engine, dailyResult(s)).events });
      }
      const [a, b] = runs;
      const shared = Object.keys(a.picks).filter((k) => k in b.picks);
      expect(shared.length).toBeGreaterThan(3);
      for (const k of shared) expect(a.picks[k]).toBe(b.picks[k]);
      // the daily rules stay: no decision cards, no deal choice, no reroll
      expect(runs.every(({ s }) => !s.learn.decisions.some((d) => d.kind === 'decision'))).toBe(true);
    }
  });
  it('the v1 daily helpers are unchanged (re-exported hash)', () => {
    const seed = 1234567;
    expect(dailyDie(seed, 3, 1)).toBe(1 + Math.floor((hashString(`${seed}|die|3|1`) / 4294967296) * 6));
    expect(dailyPick(seed, 'market', 7, 10)).toBe(Math.floor((hashString(`${seed}|market|7|0`) / 4294967296) * 10));
  });
});

describe('matches: the per-seat seed stays seed + i * 7919', () => {
  it('seat i plays its own keyed streams', () => {
    const m = newMatch(engine, { mode: 'family', seed: 50, players: [{ professionId: 'teacher' }, { professionId: 'teacher' }] });
    expect(m.players.map((p) => p.state.seed)).toEqual([50, 50 + 7919]);
    expect(m.players.every((p) => p.state.rngVersion === 2)).toBe(true);
  });
});
