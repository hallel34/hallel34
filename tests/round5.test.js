// QA round 5 fixes: teardown of the play screen, resuming a match whose current player is out, names, plurals, copy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, newMatch, currentState, setCurrentState, endTurn, canEndTurn, resumePlan, lastPlayerStanding, uniqueNames,
  serialize, deserialize, activeCount, nextActiveIndex,
} from '../src/engine/index.js';
import { tp } from '../src/i18n/index.js';
import { pawnOffsets, CROWD_FROM } from '../src/ui/layout.js';

const readJson = (p) => JSON.parse(readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8'));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const he = readJson('i18n/he.json');
const engine = createEngine({ professions: readJson('data/professions.he.json'), cards: readJson('data/cards.he.json') });
const crew = (n) => ['teacher', 'engineer', 'nurse', 'driver'].slice(0, n).map((professionId, i) => ({ name: `ש${i + 1}`, professionId }));

/** What QA did: P1 is broke with a big loan, and the engine itself rolls them out. */
function bankruptPlayer(m, index = 0) {
  const s = structuredClone(m.players[index].state);
  s.cash = 100;
  s.liabilities.push({ id: 'x', kind: 'loan', label: 'loan', principal: 90000, monthlyPayment: 9000 });
  const lost = engine.roll(s, [2]);
  expect(lost.status).toBe('lost');
  return { ...m, players: m.players.map((p, i) => (i === index ? { ...p, state: lost } : p)) };
}
const viaSave = (m) => deserialize(serialize(m));

describe('P1-2: resuming a match whose current player is already out', () => {
  it('an engine-produced save with the current player out resumes into the out flow, then hands over', () => {
    let m = newMatch(engine, { mode: 'family', players: crew(3), seed: 5 });
    m = viaSave(bankruptPlayer(m));
    expect(m.status).toBe('playing');
    expect(currentState(m).status).toBe('lost');
    expect(resumePlan(m)).toBe('out');
    expect(canEndTurn(m)).toBe(true);
    const next = endTurn(m);
    expect(next.currentIndex).toBe(1);
    expect(next.status).toBe('playing');
    expect(resumePlan(next)).toBe('ready');
  });
  it('the out player is skipped for good, also when it is the last seat', () => {
    let m = newMatch(engine, { mode: 'family', players: crew(3), seed: 5 });
    m = viaSave(bankruptPlayer({ ...m, currentIndex: 2 }, 2));
    expect(resumePlan(m)).toBe('out');
    expect(endTurn(m).currentIndex).toBe(0);
  });
  it('all remaining players lost -> the match is over (all-out screen), whichever way it was saved', () => {
    let m = newMatch(engine, { mode: 'family', players: crew(2), seed: 5 });
    m = bankruptPlayer(m, 0);
    m = { ...m, currentIndex: 1 };
    m = bankruptPlayer(m, 1);
    m = setCurrentState(m, currentState(m)); // what the controller's commit() does
    expect(m.status).toBe('lost');
    expect(resumePlan(m)).toBe('finish');
    // a hand-edited / older save: status still "playing" but nobody is left
    const stale = { ...m, status: 'playing' };
    expect(resumePlan(stale)).toBe('out');
    expect(endTurn(stale).status).toBe('lost');
  });
  it('only one active player left: they are the last one standing and the turn passes back to them', () => {
    let m = newMatch(engine, { mode: 'family', players: crew(3), seed: 5 });
    m = bankruptPlayer(m, 0);
    m = { ...m, currentIndex: 1 };
    m = bankruptPlayer(m, 1);
    m = { ...m, currentIndex: 2 };
    expect(activeCount(m)).toBe(1);
    expect(lastPlayerStanding(m)).toBe(true);
    expect(nextActiveIndex(m)).toBe(2); // themselves: no phone hand-over
    let played = engine.roll(currentState(m), [1]);
    while (played.pending) played = passAny(played);
    m = setCurrentState(m, played);
    expect(canEndTurn(m)).toBe(true);
    expect(endTurn(m).currentIndex).toBe(2);
    expect(lastPlayerStanding(newMatch(engine, { players: crew(1) }))).toBe(false);
  });
  it('a fresh or mid-turn match resumes where it was', () => {
    const m = newMatch(engine, { mode: 'family', players: crew(2), seed: 7 });
    expect(resumePlan(m)).toBe('ready');
    const rolled = setCurrentState(m, engine.roll(currentState(m), [3]));
    expect(resumePlan(rolled)).toBe(currentState(rolled).pending ? 'resolve' : 'settle');
    expect(resumePlan({ ...m, status: 'won' })).toBe('finish');
  });
});

function passAny(s) {
  const k = s.pending?.kind;
  if (k === 'opportunity') return engine.pass(s);
  if (k === 'charity') return engine.declineCharity(s);
  if (k === 'offer') return engine.declineOffer(s);
  return engine.takeLoan(s, 1000);
}

describe('P1-1: the play screen tears everything down before the start screen mounts', () => {
  const play = src('src/ui/play.js');
  const modal = src('src/ui/modal.js');
  const app = src('src/ui/app.js');
  it('goHome saves, then tears down (layers + controller) and only then asks the app for the start screen', () => {
    expect(play).toMatch(/function goHome\(\) \{[^}]*store\.save\(match\);\s*teardown\(\);[^}]*nav\.menu\(\);/s);
    const teardown = play.match(/function teardown\(\) \{([^}]*)\}/s)[1];
    expect(teardown).toMatch(/destroyed = true/);
    expect(teardown).toMatch(/destroyAllLayers\(\)/);
    expect(teardown).toMatch(/removeEventListener\('popstate'/);
  });
  it('the browser-back path ends in the same goHome', () => {
    expect(play).toMatch(/const onPop = \(\) => \{[^}]*askHome\(\);/s);
    expect(play).toMatch(/if \(r === 'home'\) goHome\(\)/);
  });
  it('a destroyed controller cannot write: the store is wrapped, apply() refuses and every modal is gated', () => {
    expect(play).toMatch(/save: \(m\) => \{ if \(!destroyed\) rawStore\.save\(m\); \}/);
    expect(play).toMatch(/clear: \(\) => \{ if \(!destroyed\) rawStore\.clear\(\); \}/);
    expect(play).toMatch(/function apply\(fn\) \{\s*if \(destroyed\) return false;/);
    expect(play).toMatch(/if \(destroyed\) return undefined;/);
  });
  it('layers are removed synchronously (not animated out) so nothing can be tapped afterwards', () => {
    expect(modal).toMatch(/destroy\(result\) \{/);
    expect(modal).toMatch(/export function destroyAllLayers\(\)/);
    expect(modal).toMatch(/root\(\)\?\.replaceChildren\(\)/);
  });
  it('the app also clears every layer on any screen change', () => {
    expect(app).toMatch(/active\?\.destroy\?\.\(\);\s*destroyAllLayers\(\);/);
  });
});

describe('P2: names, plurals, copy', () => {
  it('duplicate names get a number (case-insensitive), empty names stay empty', () => {
    expect(uniqueNames(['דנה', 'דנה', 'דנה'])).toEqual(['דנה', 'דנה 2', 'דנה 3']);
    expect(uniqueNames(['Bob', 'bob', ' BOB '])).toEqual(['Bob', 'bob 2', 'BOB 3']);
    expect(uniqueNames(['', '', 'א'])).toEqual(['', '', 'א']);
    expect(uniqueNames(['דנה', 'דנה 2', 'דנה'])).toEqual(['דנה', 'דנה 2', 'דנה 3']);
    const long = uniqueNames(['abcdefghijkl', 'abcdefghijkl']);
    expect(long[1].length).toBeLessThanOrEqual(12);
    expect(new Set(long).size).toBe(2);
  });
  it('newMatch enforces unique names', () => {
    const m = newMatch(engine, { players: [{ name: 'דנה', professionId: 'teacher' }, { name: 'דנה', professionId: 'nurse' }] });
    expect(m.players.map((p) => p.name)).toEqual(['דנה', 'דנה 2']);
  });
  it('plural helper', () => {
    expect(tp('plural.turns', 1)).toBe('תור אחד');
    expect(tp('plural.turns', 2)).toBe('2 תורות');
    expect(tp('plural.turns', 12)).toBe('12 תורות');
    expect(tp('plural.shares', 1)).toBe('מניה אחת');
    expect(tp('plural.shares', 100)).toBe('100 מניות');
    expect(tp('plural.sharesOf', 1, { symbol: 'ABC' })).toBe('מניה אחת של ABC');
    expect(tp('plural.turnsLeft', 1)).toBe('עוד תור אחד');
    expect(tp('plural.label.kids', 1)).toBe('ילד');
    expect(tp('plural.label.kids', 2)).toBe('ילדים');
  });
  it('no count is hard-wired to a plural noun any more', () => {
    for (const k of ['game.charityBoost', 'market.stockHeld', 'statement.stockLine', 'standings.row', 'win.shareText']) {
      const text = k.split('.').reduce((o, p) => o[p], he);
      expect(text, k).not.toMatch(/תורות|מניות/);
    }
  });
  it('neutral wording; "שחק שוב" stays on the win screen', () => {
    expect(he.players.ready).toBe('מוכנים');
    expect(he.win.again).toBe('שחק שוב');
    expect(he.game.outTitle.replace('{name}', 'דנה')).toBe('דנה – מחוץ למשחק');
    expect(he.standings.out).toBe('מחוץ למשחק');
    expect(he.standings.allOutTitle).toBe('כולם מחוץ למשחק');
    const all = JSON.stringify(he);
    expect(all).not.toMatch(/אני מוכן|יצא מהמשחק|יצאו מהמשחק|בלי השחקן הזה/);
  });
  it('after a turn the status names the next roller in hot-seat (no "the die waits")', () => {
    expect(he.game.statusNext.replace('{name}', 'דנה')).toBe('ממשיכים. תור של דנה');
    const play = src('src/ui/play.js');
    expect(play).toMatch(/function afterTurnStatus\(\)/);
    expect(play).toMatch(/t\('game\.statusNext', \{ name: nameOf\(next\) \}\)/);
    expect(play).not.toMatch(/setStatus\(t\('game\.statusBack'\)\)/);
  });
  it('the out modal is its own neutral dialog (not the expense card) with the worried fox', () => {
    const m = src('src/ui/modals.js');
    const body = m.slice(m.indexOf('export function playerOutModal'));
    expect(body).toMatch(/foxImg\('worried'/);
    expect(body).not.toMatch(/cardShell|type: 'expense'|square\.expense/);
  });
  it('hot-seat hand-over: no handoff to the same player; cards wait for the home sheet; sell sheet closes when empty', () => {
    const play = src('src/ui/play.js');
    expect(play).toMatch(/if \(match\.currentIndex !== prevIndex\) await showHandoff\(\)/);
    expect(play).toMatch(/\(!multi \|\| lastPlayerStanding\(match\)\) && canEndTurn\(match\)/);
    expect(play).toMatch(/while \(homeGate && !destroyed\) await homeGate/);
    expect(play).toMatch(/s\.assets\.length === 0/);
    expect(src('src/ui/modals.js')).toMatch(/if \(next && shouldClose\(next\)\) \{ layer\.close\(\); return; \}/);
  });
});

describe('P2: four pawns on one tile', () => {
  it('3+ pawns become 15px discs that fit inside the smallest tile (32px), 4 form a 2x2 grid', () => {
    expect(CROWD_FROM).toBe(3);
    const DISC = 15;
    const TILE = 32;
    for (const n of [3, 4]) {
      const offs = pawnOffsets(n);
      expect(offs).toHaveLength(n);
      for (const o of offs) {
        expect(Math.abs(o.x) + DISC / 2).toBeLessThanOrEqual(TILE / 2);
        expect(Math.abs(o.y) + DISC / 2).toBeLessThanOrEqual(TILE / 2);
      }
    }
    const four = pawnOffsets(4);
    expect(new Set(four.map((o) => o.x)).size).toBe(2);
    expect(new Set(four.map((o) => o.y)).size).toBe(2);
    // discs never overlap each other
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(Math.hypot(four[i].x - four[j].x, four[i].y - four[j].y)).toBeGreaterThanOrEqual(DISC);
  });
});
