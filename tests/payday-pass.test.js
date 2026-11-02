// Owner bug report 2026-11-01: a roll that only CROSSES 'סיכום שנתי' never halts the pawn there. The engine still pays on pass;
// the board shows a non-blocking float + count-up while hopping, and the itemised card only
// after the pawn has landed, before the landing square's own card (docs/decisions.md 2026-11-01).
// v0.4 (owner decision 2026-11-02, QA P0): at most ONE annual summary is credited per turn, even when one roll
// crosses several payday squares (they sit 3 apart: 4, 7, 10) — the first one on the path settles the turn.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, BOARD } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';
import { paydayStops } from '../src/ui/layout.js';

const engine = createEngine(loadData('he'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const game = (extra = {}) => ({ ...engine.newGame({ mode: 'full', professionId: 'teacher', seed: 5 }), ...extra });
const paydaysOf = (s) => s.events.filter((e) => e.type === 'payday');

describe('passing payday: credited once, the pawn does not stop', () => {
  it('a roll from 3 with a 2 crosses square 4 (payday) and lands on 5: one payday, cash credited exactly once', () => {
    expect(BOARD[4]).toBe('payday');
    expect(BOARD[5]).toBe('opportunity');
    const s = game({ position: 3 });
    const next = engine.roll(s, [2]);
    const move = next.events.find((e) => e.type === 'move');
    expect(move.path).toEqual([4, 5]);
    const pds = paydaysOf(next);
    expect(pds).toHaveLength(1);
    expect(next.cash - s.cash).toBe(pds[0].amount);
    const stops = paydayStops(move.path, BOARD, pds);
    expect(stops.landing).toBeNull();
    expect(stops.passes).toEqual([{ step: 0, idx: 4, pd: pds[0] }]);
  });
  it('REGRESSION (QA P0, 2026-11-02): charity (2 dice) crossing several paydays credits the annual summary only once', () => {
    const s = game({ position: 3, charityTurns: 2 });
    const next = engine.roll(s, [4, 4]); // path 4..11: paydays 4, 7, 10, lands on 11
    const move = next.events.find((e) => e.type === 'move');
    const pds = paydaysOf(next);
    expect(pds).toHaveLength(1);
    expect(next.cash - s.cash).toBe(pds[0].amount);
    expect(next.stats.paydays - s.stats.paydays).toBe(1);
    const stops = paydayStops(move.path, BOARD, pds);
    expect(stops.passes.map((p) => p.idx)).toEqual([4]);
    expect(stops.landing).toBeNull();
  });
  it('crossing a payday and landing on another in the same roll: only the first settles, as a pass', () => {
    const s = game({ position: 3, charityTurns: 1 });
    const next = engine.roll(s, [3, 1]); // path 4..7: crosses 4, lands on 7
    const move = next.events.find((e) => e.type === 'move');
    const pds = paydaysOf(next);
    expect(pds).toHaveLength(1);
    const stops = paydayStops(move.path, BOARD, pds);
    expect(stops.passes.map((p) => p.idx)).toEqual([4]);
    expect(stops.landing).toBeNull();
    expect(next.cash - s.cash).toBe(pds[0].amount);
  });
  it('a roll whose only payday is the landing square still settles it as the landing stop', () => {
    const s = game({ position: 5 });
    const next = engine.roll(s, [2]); // path 6, 7: lands on payday 7, crosses none before it
    const move = next.events.find((e) => e.type === 'move');
    const pds = paydaysOf(next);
    expect(pds).toHaveLength(1);
    const stops = paydayStops(move.path, BOARD, pds);
    expect(stops.passes).toEqual([]);
    expect(stops.landing).toEqual({ step: 1, idx: 7, pd: pds[0] });
    expect(next.cash - s.cash).toBe(pds[0].amount);
  });
});

describe('the board never awaits a payday card mid-path', () => {
  const play = read('src/ui/play.js');
  const turn = play.slice(play.indexOf('async function playTurn'), play.indexOf('/** The turn\'s events are all resolved'));
  const loop = turn.slice(turn.indexOf('for (const [k, idx] of move.path.entries())'), turn.indexOf('if (destroyed) return;\n    // The pawn stands'));
  it('the hop loop only awaits the hop; the pass effect is fire-and-forget', () => {
    expect(loop).toContain('await hopTo(idx)');
    expect(loop).toContain('paydayPassFx(p.pd, p.idx)');
    expect(loop).not.toMatch(/await\s+(paydayFx|paydaySummary|summaryCard)/);
  });
  it('the summary cards (crossed paydays first, then a landed one) come after the loop and before the landing caption and card', () => {
    const after = turn.slice(turn.indexOf('// The pawn stands'));
    const iSummary = after.indexOf('await paydaySummary(f)');
    const iLanding = after.indexOf('await paydayFx(stops.landing.pd)');
    const iCaption = after.indexOf('await landingCaption(');
    const iEvents = after.indexOf('await handleEvents(next)');
    expect(iSummary).toBeGreaterThan(-1);
    expect(iSummary).toBeLessThan(iLanding);
    expect(iLanding).toBeLessThan(iCaption);
    expect(iCaption).toBeLessThan(iEvents);
  });
  it('the pass effect counts the cash up without awaiting it (the card after the landing adds no second count-up)', () => {
    const fx = play.slice(play.indexOf('function paydayPassFx'), play.indexOf('async function turn()'));
    expect(fx).toContain('cash.to(cash.value + f.amount');
    expect(fx).not.toMatch(/await /);
    const summary = play.slice(play.indexOf('async function paydaySummary'), play.indexOf('// ---------- turn ----------'));
    expect(summary).not.toContain('cash.to(');
  });
  it('bots get the same non-blocking pass effect and no card', () => {
    const bot = play.slice(play.indexOf('async function runBotTurn'), play.indexOf('async function runBotTurn') + 1500);
    expect(bot).toContain('paydayPassFx(p.pd, p.idx)');
    expect(bot).not.toContain('paydaySummary');
  });
});
