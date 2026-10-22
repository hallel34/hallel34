// Round 10 polish: ordered end of a daily game, sanitised stored results, loadSave rejecting a daily match, capped streak, share isolate.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseResults, sanitizeEntry } from '../src/daily/attempt.js';
import { parseStreak, recordPlay, MAX_COUNT } from '../src/daily/streak.js';
import { endDailyGame, loadResults, loadStreak } from '../src/daily/store.js';
import { buildShareText, LRI, PDI } from '../src/daily/share.js';
import { headlineGreen, streakText } from '../src/ui/daily-format.js';
import { greenText } from '../src/learn/report.js';
import { createEngine, newMatch, currentState, dailySeed, dailyProfessionId, DAILY_MODE } from '../src/engine/index.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const read = (p) => JSON.parse(src(`data/${p}`));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const he = JSON.parse(src('i18n/he.json'));

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), snapshot: () => Object.fromEntries(m) };
}

describe('ordered end of a daily game (reload at any instant keeps the result)', () => {
  beforeEach(() => { globalThis.localStorage = memoryStorage(); });
  it('the result is stored before the save slot is cleared', () => {
    const state = engine.forfeit(currentState(newMatch(engine, { mode: DAILY_MODE, seed: dailySeed('2026-10-21'), players: [{ name: '', professionId: dailyProfessionId(dailySeed('2026-10-21'), engine.data.professions) }], daily: { date: '2026-10-21' } })));
    localStorage.setItem('passivo.dailySave', 'SAVE');
    let atClear;
    endDailyGame(state, () => { atClear = localStorage.snapshot(); localStorage.removeItem('passivo.dailySave'); });
    // simulated reload between the two steps: result and streak are there, the save is still there too
    expect(Object.keys(atClear).some((k) => k.includes('dailyResults'))).toBe(true);
    expect(Object.keys(atClear).some((k) => k.includes('dailySave'))).toBe(true);
    expect(loadResults().byDate['2026-10-21']).toBeTruthy();
    expect(loadStreak().count).toBe(1);
  });
  it('a crash in the clearing step still leaves the result behind', () => {
    const state = engine.forfeit(currentState(newMatch(engine, { mode: DAILY_MODE, seed: dailySeed('2026-10-21'), players: [{ name: '', professionId: dailyProfessionId(dailySeed('2026-10-21'), engine.data.professions) }], daily: { date: '2026-10-21' } })));
    expect(() => endDailyGame(state, () => { throw new Error('reload'); })).toThrow();
    expect(loadResults().byDate['2026-10-21']).toBeTruthy();
  });
  it('play.js ends a daily game through nav.commit before the pause', () => {
    const s = src('ui/play.js');
    const body = s.slice(s.indexOf('async function finishIfOver'));
    expect(body.indexOf('nav.commit')).toBeGreaterThan(-1);
    expect(body.indexOf('nav.commit')).toBeLessThan(body.indexOf('await pause(500)'));
  });
  it('a daily finish does not count as a played game for the interstitial cadence', () => {
    const a = src('ui/app.js');
    const f = a.slice(a.indexOf('function finishDaily'), a.indexOf('function mount'));
    expect(f).not.toMatch(/countGame/);
  });
});

describe('parseResults sanitises every entry', () => {
  const rec = (date, over = {}) => ({ date, seed: 1, turns: 12, netWorth: 5000, professionId: 'teacher', mode: 'family', actionsLog: [], ...over });
  it('repairs green:null, non-string lights and junk fields', () => {
    const raw = { v: 1, byDate: {
      '2026-10-21': { record: rec('2026-10-21'), outcome: 'won', lights: 42, green: null },
      '2026-10-20': { record: rec('2026-10-20', { turns: 'x', netWorth: NaN, professionId: 7 }), outcome: {}, lights: ['g'], green: { total: 'a' } },
      '2026-10-19': { record: rec('2026-10-19'), lights: 'gyXr\n', green: { green: 2, total: 5, kind: 'some' } },
      '2026-10-18': null, '2026-10-17': 'junk', '2026-10-16': { record: null }, '2026-10-15': { record: rec('2026-10-14') }, bad: {},
    } };
    const { byDate } = parseResults(raw);
    expect(Object.keys(byDate).sort()).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    for (const e of Object.values(byDate)) {
      expect(typeof e.lights).toBe('string');
      expect(() => greenText(headlineGreen(e.green))).not.toThrow();
      expect(['won', 'gaveUp', 'failed']).toContain(e.outcome);
      expect(Number.isFinite(e.record.netWorth)).toBe(true);
    }
    expect(byDate['2026-10-20'].record.turns).toBeNull();
    expect(byDate['2026-10-19'].lights).toBe('gyr');
    expect(byDate['2026-10-19'].green.kind).toBe('some');
  });
  it('a sanitised entry builds a share text without throwing', () => {
    const e = parseResults({ v: 1, byDate: { '2026-10-21': { record: rec('2026-10-21', { netWorth: Infinity }), lights: null, green: null } } }).byDate['2026-10-21'];
    expect(() => buildShareText(e, 'u')).not.toThrow();
  });
  it('headlineGreen survives null', () => { expect(() => greenText(headlineGreen(null))).not.toThrow(); });
  it('sanitizeEntry of a valid entry is stable', () => {
    const e = sanitizeEntry({ record: rec('2026-10-21'), outcome: 'won', lights: 'ggy', green: { green: 3, total: 3, kind: 'all' } }, '2026-10-21');
    expect(sanitizeEntry(e, '2026-10-21')).toEqual(e);
  });
});

describe('loadSave rejects a daily match', () => {
  it('app.js loadSave refuses m.daily', () => {
    const a = src('ui/app.js');
    const f = a.slice(a.indexOf('function loadSave'), a.indexOf('function loadDailySave'));
    expect(f).toMatch(/m\.daily/);
  });
});

describe('streak counts are capped', () => {
  it('ignores non-finite and absurd counts', () => {
    expect(parseStreak({ v: 1, last: '2026-10-21', count: 1e12, best: Infinity, badges: [] })).toMatchObject({ count: MAX_COUNT, best: MAX_COUNT });
    expect(parseStreak({ v: 1, last: '2026-10-21', count: Infinity, best: NaN, badges: [] }).count).toBe(0);
    expect(parseStreak({ v: 1, last: '2026-10-21', count: 5.7, best: -3, badges: [] })).toMatchObject({ count: 5, best: 5 });
    const s = recordPlay({ v: 1, last: '2026-10-20', count: MAX_COUNT, best: MAX_COUNT, badges: [] }, '2026-10-21');
    expect(s.count).toBe(MAX_COUNT);
  });
});

describe('share text amount is an LTR isolate', () => {
  it('wraps only the amount', () => {
    const e = { record: { date: '2026-10-21', turns: 17, netWorth: 1234567 }, lights: '' };
    const head = buildShareText(e, '').split('\n')[0];
    expect(head.endsWith(`${LRI}₪1.2M${PDI}`)).toBe(true);
    expect(head.startsWith('פסיבו אתגר יומי')).toBe(true);
  });
});

describe('copy', () => {
  it('dead key removed; how-to truthful; charity banner neutral', () => {
    expect(he.daily.charityNote).toBeUndefined();
    expect(he.howto.dailyNote).not.toMatch(/אותם קלפים/);
    expect(he.charity.boostDaily).not.toMatch(/מזל טוב/);
  });
});
