// Round 9: the daily and the normal save slots can never cross; daily wording / streak / headline rules.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createMatchStore, slotOf, SLOT_DAILY, SLOT_NORMAL } from '../src/services/match-store.js';
import { streakText, headlineGreen } from '../src/ui/daily-format.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('match store: the slot always comes from the match', () => {
  const log = [];
  const store = createMatchStore({ write: (k, v) => log.push(['write', k, v]), remove: (k) => log.push(['remove', k]), serialize: () => 'S' });
  it('daily and normal matches use different slots', () => {
    expect(slotOf({ daily: { date: '2026-10-21' } })).toBe(SLOT_DAILY);
    expect(slotOf({})).toBe(SLOT_NORMAL);
    log.length = 0;
    store.save({ daily: { date: 'x' } }); store.clear({ daily: { date: 'x' } }); store.save({}); store.clear({});
    expect(log).toEqual([['write', 'dailySave', 'S'], ['remove', 'dailySave'], ['write', 'save', 'S'], ['remove', 'save']]);
  });
  it('save / clear without a match throw instead of falling back to the normal slot', () => {
    expect(() => store.clear()).toThrow();
    expect(() => store.save()).toThrow();
    expect(() => store.clear(null)).toThrow();
  });
  it('every store.save / store.clear call in src/ui passes a match', () => {
    const files = ['app.js', 'play.js'];
    let calls = 0;
    for (const f of files) {
      for (const m of src(`ui/${f}`).matchAll(/\bstore\.(save|clear)\(([^)]*)\)/g)) {
        calls++;
        expect(m[2].trim(), `${f}: ${m[0]}`).not.toBe('');
      }
    }
    expect(calls).toBeGreaterThan(8);
    // the play.js wrapper forwards the argument
    expect(src('ui/play.js')).toMatch(/clear: \(m\) => \{ if \(!destroyed\) rawStore\.clear\(m\); \}/);
    // nothing outside the store touches the normal slot by key
    for (const f of readdirSync(new URL('../src/ui/', import.meta.url)).filter((x) => x.endsWith('.js') && x !== 'app.js')) {
      expect(src(`ui/${f}`), f).not.toMatch(/(?:remove|writeRaw)\(\s*'(?:save|dailySave)'/);
    }
  });
});

describe('daily streak line and learning headline', () => {
  it('"החמצתם יום?" only after a streak of 2+ and 1-3 missed days; else a neutral welcome back', () => {
    const broken = (prev, missed) => streakText({ state: 'broken', count: 0, prev, missed });
    const missedLine = broken(3, 1);
    expect(broken(2, 3)).toBe(missedLine);
    expect(missedLine).toContain('החמצתם יום');
    const welcome = broken(1, 1);
    expect(welcome).not.toContain('החמצתם');
    expect(broken(3, 4)).toBe(welcome);
    expect(broken(5, 40)).toBe(welcome);
  });
  it('plural address in streak lines', () => {
    expect(streakText({ state: 'today', count: 5 })).toBe('שיחקתם 5 ימים ברצף');
  });
  it('the headline needs at least 3 rated decisions', () => {
    expect(headlineGreen({ green: 2, total: 2, kind: 'all' }).kind).toBe('noData');
    expect(headlineGreen({ green: 0, total: 1, kind: 'none' }).kind).toBe('noData');
    expect(headlineGreen({ green: 3, total: 3, kind: 'all' }).kind).toBe('all');
    expect(headlineGreen({ green: 1, total: 4, kind: 'some' }).kind).toBe('some');
  });
});
