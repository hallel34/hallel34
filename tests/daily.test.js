// Daily challenge (v2.5): seed / streams, determinism across decision policies, calendar + streak edge cases, share text,
// the one-attempt rule and the result record.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, EngineError, newMatch, act, currentState, serialize, deserialize, botStep, BOARD, DAILY_TURN_CAP,
  hashString, dailySeed, dailyDie, dailyPick, dailyProfessionId, dailyDiceSequence, newDailyGame, dailyResult, replayDaily,
} from '../src/engine/index.js';
import { dayKey, addDays, dayNumber, daysBetween, shortDate, msUntilNextDay, countdownParts } from '../src/daily/calendar.js';
import { emptyStreak, parseStreak, recordPlay, streakView, STREAK_BADGES, newBadges } from '../src/daily/streak.js';
import { buildShareText, compactMoney, squaresRows } from '../src/daily/share.js';
import {
  dailyStatus, canStartDaily, completeAttempt, turnLights, decisionLight, emptyResults, parseResults, KEEP_DAYS,
} from '../src/daily/attempt.js';
import { greenText } from '../src/learn/report.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));

/** Plays a daily game with a bot policy; records the dice and the cards drawn per turn. */
function play(date, bot, { maxTurns = DAILY_TURN_CAP + 5 } = {}) {
  let s = newDailyGame(engine, date);
  const dice = {}; const cards = {};
  let guard = 0;
  while (s.status === 'playing' && guard++ < 3000) {
    const before = s.turn;
    s = botStep(engine, s, bot);
    if (s.turn > before) dice[s.turn] = s.lastRoll.dice;
    for (const e of s.events) {
      const c = e.type === 'market' ? e.card : null;
      if (c) cards[`${s.turn}:market`] = c.id;
    }
    if (s.pending?.card) cards[`${s.turn}:${s.pending.card.deck}`] = s.pending.card.id;
    if (s.events.some((e) => e.type === 'expensePaid')) cards[`${s.turn}:expense`] = s.events.find((e) => e.type === 'expensePaid').card.id;
  }
  return { s, dice, cards };
}

describe('daily: date seed', () => {
  it('is a stable hash of the date string', () => {
    expect(hashString('')).toBe(hashString(''));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(dailySeed('2026-10-21')).toBe(dailySeed('2026-10-21'));
  });
  it('pins known values so a change of the hash is noticed (it would break every shared result)', () => {
    expect(hashString('passivo')).toBe(hashString('passivo'));
    expect(dailySeed('2026-10-21')).toMatchInlineSnapshot(`4207170569`);
    expect(dailySeed('2026-10-22')).toMatchInlineSnapshot(`3544530435`);
  });
  it('differs between dates and is a positive 32 bit integer', () => {
    const seeds = new Set();
    for (let i = 0; i < 400; i++) {
      const s = dailySeed(addDays('2026-01-01', i));
      expect(Number.isInteger(s) && s > 0 && s <= 0xFFFFFFFF).toBe(true);
      seeds.add(s);
    }
    expect(seeds.size).toBe(400);
  });
  it('rejects anything that is not YYYY-MM-DD', () => {
    for (const bad of ['', '2026-1-5', '21.10.2026', null, undefined, 20261021]) expect(() => dailySeed(bad)).toThrow(EngineError);
  });
  it('picks the same profession for a date and varies across dates', () => {
    const ids = new Set();
    for (let i = 0; i < 60; i++) {
      const seed = dailySeed(addDays('2026-10-01', i));
      const p = dailyProfessionId(seed, data.professions);
      expect(p).toBe(dailyProfessionId(seed, data.professions));
      ids.add(p);
    }
    expect(ids.size).toBeGreaterThan(3);
  });
  it('dice streams are 1-6 and roughly even', () => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 1; i <= 6000; i++) counts[dailyDie(dailySeed('2026-10-21'), i, 0)] += 1;
    expect(counts[0]).toBe(0);
    for (let f = 1; f <= 6; f++) expect(counts[f]).toBeGreaterThan(800);
  });
});

describe('daily: same dice and cards for everyone, whatever they choose', () => {
  const date = '2026-10-21';
  it('two very different decision policies see identical dice and identical cards at the same turns', () => {
    const a = play(date, 'alwaysBuy');
    const b = play(date, 'alwaysPass');
    const seed = dailySeed(date);
    const common = Math.min(Math.max(...Object.keys(a.dice).map(Number)), Math.max(...Object.keys(b.dice).map(Number)));
    expect(common).toBeGreaterThan(5);
    for (let turn = 1; turn <= common; turn++) {
      // the first die of every turn is the day's die (a charity turn adds a second die, also a pure function of the turn)
      expect(a.dice[turn][0]).toBe(dailyDie(seed, turn, 0));
      expect(b.dice[turn][0]).toBe(dailyDie(seed, turn, 0));
      if (a.dice[turn].length > 1) expect(a.dice[turn][1]).toBe(dailyDie(seed, turn, 1));
    }
    // a card drawn at turn i is the card the stream gives for (deck, i), for both players
    let compared = 0;
    for (const { cards } of [a, b]) {
      for (const [key, id] of Object.entries(cards)) {
        const [turn, deck] = key.split(':');
        const ids = data.cards.filter((c) => c.deck === deck && c.modes.includes('family')).map((c) => c.id);
        expect(id).toBe(ids[dailyPick(seed, deck, Number(turn), ids.length)]);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(10);
    expect(a.s.profession.id).toBe(b.s.profession.id);
    expect(a.s.mode).toBe('family');
  });
  it('the same card shows at the same turn even when the two players stand on different squares', () => {
    const a = play(date, 'sensible');
    const b = play(date, 'cautious');
    const shared = Object.keys(a.cards).filter((k) => k in b.cards);
    for (const k of shared) expect(a.cards[k]).toBe(b.cards[k]);
  });
  it('dailyDiceSequence lists the same dice the engine uses', () => {
    const { dice } = play(date, 'sensible');
    const seq = dailyDiceSequence(dailySeed(date), 10);
    for (let i = 1; i <= 10 && dice[i]; i++) expect(dice[i][0]).toBe(seq[i - 1]);
  });
  it('a different date gives a different day', () => {
    expect(dailyDiceSequence(dailySeed('2026-10-21'), 20)).not.toEqual(dailyDiceSequence(dailySeed('2026-10-22'), 20));
  });
  it('the game does not touch the shared rng: states of the same day only differ by choices', () => {
    const s0 = newDailyGame(engine, date);
    const s1 = newDailyGame(engine, date);
    expect(s1).toEqual(s0);
    expect(s0.decks).toEqual({ opportunity: [], expense: [], market: [] });
  });
});

describe('daily: normal games are untouched', () => {
  it('a normal game has no daily field and still shuffles its decks', () => {
    const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    expect('daily' in s).toBe(false);
    expect(s.decks.opportunity.length).toBeGreaterThan(5);
    expect(engine.forfeit).toBeTypeOf('function');
    expect(() => engine.forfeit(s)).toThrow(EngineError);
  });
  it('a normal match has no daily field, a daily one carries its date through save and load', () => {
    const normal = newMatch(engine, { mode: 'family', seed: 3, players: [{ professionId: 'teacher' }] });
    expect('daily' in normal).toBe(false);
    const m = newMatch(engine, { mode: 'family', seed: dailySeed('2026-10-21'), players: [{ professionId: 'teacher' }], daily: { date: '2026-10-21' } });
    const back = deserialize(serialize(m));
    expect(back.daily).toEqual({ date: '2026-10-21' });
    expect(currentState(back).daily.date).toBe('2026-10-21');
    expect(currentState(back).daily.log).toEqual([]);
  });
  it('a daily match resumes (save, load) and continues with the same dice', () => {
    let m = newMatch(engine, { mode: 'family', seed: dailySeed('2026-10-21'), players: [{ professionId: 'teacher' }], daily: { date: '2026-10-21' } });
    m = act(m, (s) => engine.roll(s));
    const resumed = deserialize(serialize(m));
    expect(currentState(resumed)).toEqual(currentState(m));
    expect(currentState(resumed).lastRoll.dice[0]).toBe(dailyDie(dailySeed('2026-10-21'), 1, 0));
  });
});

describe('daily: cap, give up, result record, replay', () => {
  it('ends with turns = null when there is no freedom by the turn cap', () => {
    let found = null;
    for (let i = 0; i < 30 && !found; i++) {
      const { s } = play(addDays('2026-10-01', i), 'alwaysPass');
      if (s.daily.timedOut) found = s;
    }
    expect(found).toBeTruthy();
    expect(found.turn).toBe(DAILY_TURN_CAP);
    expect(found.status).toBe('lost');
    const r = dailyResult(found);
    expect(r.turns).toBeNull();
    expect(r.mode).toBe('family');
  });
  it('a win records the turn of freedom', () => {
    let won = null;
    for (let i = 0; i < 30 && !won; i++) {
      const { s } = play(addDays('2026-10-01', i), 'sensible');
      if (s.status === 'won') won = s;
    }
    expect(won).toBeTruthy();
    const r = dailyResult(won);
    expect(r.turns).toBe(won.winTurn);
    expect(r.turns).toBeLessThanOrEqual(DAILY_TURN_CAP);
    expect(Object.keys(r).sort()).toEqual(['actionsLog', 'date', 'mode', 'netWorth', 'professionId', 'seed', 'turns']);
    expect(r.seed).toBe(dailySeed(r.date));
    expect(Number.isFinite(r.netWorth)).toBe(true);
    expect(r.actionsLog.filter((a) => a[0] === 'roll')).toHaveLength(won.turn);
  });
  it('the action log replays to exactly the same game (what a server check would do)', () => {
    for (const bot of ['sensible', 'alwaysBuy', 'cautious']) {
      const { s } = play('2026-10-23', bot);
      const replay = replayDaily(engine, dailyResult(s));
      expect(replay).toEqual({ ...s, events: replay.events });
      expect(replay.turn).toBe(s.turn);
    }
  });
  it('giving up ends the attempt as not completed', () => {
    let s = newDailyGame(engine, '2026-10-21');
    s = engine.roll(s);
    s = engine.forfeit(s);
    expect(s.status).toBe('lost');
    expect(s.daily.gaveUp).toBe(true);
    expect(dailyResult(s).turns).toBeNull();
    expect(dailyResult(s).actionsLog.at(-1)).toEqual(['forfeit']);
    expect(() => engine.roll(s)).toThrow(EngineError);
    expect(replayDaily(engine, dailyResult(s)).daily.gaveUp).toBe(true);
  });
  it('dailyResult refuses a normal game', () => {
    expect(() => dailyResult(engine.newGame({ mode: 'family', professionId: 'teacher' }))).toThrow(EngineError);
  });
});

describe('calendar', () => {
  it('formats the local date as YYYY-MM-DD and DD.MM', () => {
    expect(dayKey(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21');
    expect(dayKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
    expect(shortDate('2026-10-21')).toBe('21.10');
    expect(shortDate('2026-01-05')).toBe('05.01');
  });
  it('rolls over months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0);
  });
  it('day numbers are consecutive across daylight-saving changes in any zone', () => {
    const old = process.env.TZ;
    try {
      for (const tz of ['America/New_York', 'Asia/Jerusalem', 'Australia/Lord_Howe', 'UTC']) {
        process.env.TZ = tz;
        for (const start of ['2026-03-07', '2026-03-26', '2026-10-24', '2026-10-31', '2026-11-01']) {
          for (let i = 0; i < 4; i++) {
            const a = addDays(start, i);
            expect(daysBetween(a, addDays(a, 1))).toBe(1);
          }
        }
      }
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  });
  it('the countdown to the next challenge follows the real length of a daylight-saving day', () => {
    const old = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      expect(msUntilNextDay(new Date(2026, 2, 8, 0, 0, 0))).toBe(23 * 3600 * 1000); // spring forward: a 23 hour day
      expect(msUntilNextDay(new Date(2026, 10, 1, 0, 0, 0))).toBe(25 * 3600 * 1000); // fall back: 25 hours
      expect(msUntilNextDay(new Date(2026, 9, 21, 23, 59, 30))).toBe(30 * 1000);
      expect(dayKey(new Date(2026, 2, 8, 12))).toBe('2026-03-08');
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  });
  it('countdown parts round minutes up and never show zero', () => {
    expect(countdownParts(5 * 3600000 + 32 * 60000)).toEqual({ hours: 5, minutes: 32 });
    expect(countdownParts(1)).toEqual({ hours: 0, minutes: 1 });
    expect(countdownParts(60 * 60000)).toEqual({ hours: 1, minutes: 0 });
    expect(countdownParts(60 * 60000 + 1)).toEqual({ hours: 1, minutes: 1 });
  });
});

describe('streak (D4)', () => {
  const play = (s, ...days) => days.reduce((acc, d) => recordPlay(acc, d), s);
  it('starts at 1 on the first play', () => {
    const s = recordPlay(emptyStreak(), '2026-10-21');
    expect(s).toMatchObject({ v: 1, last: '2026-10-21', count: 1, best: 1, badges: [] });
  });
  it('playing the same day twice changes nothing', () => {
    const once = play(emptyStreak(), '2026-10-21');
    expect(play(once, '2026-10-21')).toEqual(once);
  });
  it('consecutive days count up; a gap of one missed day resets to 1', () => {
    expect(play(emptyStreak(), '2026-10-21', '2026-10-22', '2026-10-23').count).toBe(3);
    const gap = play(emptyStreak(), '2026-10-21', '2026-10-22', '2026-10-24');
    expect(gap.count).toBe(1);
    expect(gap.best).toBe(2);
  });
  it('counts across month and year rollovers', () => {
    expect(play(emptyStreak(), '2026-10-31', '2026-11-01').count).toBe(2);
    expect(play(emptyStreak(), '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02').count).toBe(4);
    expect(play(emptyStreak(), '2028-02-28', '2028-02-29', '2028-03-01').count).toBe(3);
  });
  it('counts across daylight-saving days in any zone', () => {
    const old = process.env.TZ;
    try {
      for (const tz of ['America/New_York', 'Asia/Jerusalem']) {
        process.env.TZ = tz;
        expect(play(emptyStreak(), '2026-03-07', '2026-03-08', '2026-03-09').count).toBe(3);
        expect(play(emptyStreak(), '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29').count).toBe(4);
        expect(play(emptyStreak(), '2026-10-24', '2026-10-25', '2026-10-26').count).toBe(3);
        expect(play(emptyStreak(), '2026-10-31', '2026-11-01', '2026-11-02').count).toBe(3);
      }
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  });
  it('earns a badge at 3, 7 and 30 days and keeps it after the streak breaks', () => {
    expect(STREAK_BADGES).toEqual([3, 7, 30]);
    let s = emptyStreak();
    const seen = [];
    for (let i = 0; i < 30; i++) {
      const next = recordPlay(s, addDays('2026-09-01', i));
      seen.push(...newBadges(s, next).map((b) => `${i + 1}:${b}`));
      s = next;
    }
    expect(seen).toEqual(['3:3', '7:7', '30:30']);
    expect(s.badges).toEqual([3, 7, 30]);
    const after = recordPlay(s, addDays('2026-09-01', 40));
    expect(after.count).toBe(1);
    expect(after.badges).toEqual([3, 7, 30]);
    expect(after.best).toBe(30);
  });
  it('an older date (clock set back) does not change the streak', () => {
    const s = play(emptyStreak(), '2026-10-21', '2026-10-22');
    expect(play(s, '2026-10-21')).toEqual(s); // one day back; further back is tampering (see below)
  });
  it('view: never played, played today, played yesterday, missed a day', () => {
    expect(streakView(emptyStreak(), '2026-10-21')).toMatchObject({ state: 'none', count: 0 });
    const s = play(emptyStreak(), '2026-10-19', '2026-10-20', '2026-10-21');
    expect(streakView(s, '2026-10-21')).toMatchObject({ state: 'today', count: 3 });
    expect(streakView(s, '2026-10-22')).toMatchObject({ state: 'pending', count: 3 });
    expect(streakView(s, '2026-10-23')).toMatchObject({ state: 'broken', count: 0, best: 3, badges: [3] });
    expect(streakView(s, '2026-10-20')).toMatchObject({ state: 'today' }); // clock set back: keep what we have
  });
  it('a stored last more than a day ahead is ignored (clock tampering / restore), not frozen', () => {
    const s = { v: 1, last: '2027-03-01', count: 5, best: 5, badges: [3] };
    expect(streakView(s, '2026-10-21')).toMatchObject({ state: 'none', count: 0, best: 5 });
    const after = recordPlay(s, '2026-10-21');
    expect(after).toMatchObject({ last: '2026-10-21', count: 1, best: 5, badges: [3] });
    expect(streakView(after, '2026-10-22')).toMatchObject({ state: 'pending', count: 1 });
    // one day ahead stays what it was (a clock set back a little)
    const near = { v: 1, last: '2026-10-22', count: 2, best: 2, badges: [] };
    expect(recordPlay(near, '2026-10-21')).toEqual(near);
    expect(streakView(near, '2026-10-21')).toMatchObject({ state: 'today', count: 2 });
  });
  it('view reports how long the ended streak was and how many days were missed', () => {
    const s = { v: 1, last: '2026-10-19', count: 3, best: 3, badges: [3] };
    expect(streakView(s, '2026-10-21')).toMatchObject({ state: 'broken', prev: 3, missed: 1 });
    expect(streakView(s, '2026-10-30')).toMatchObject({ state: 'broken', prev: 3, missed: 10 });
  });
  it('is schema-versioned: unknown versions and corrupt data start over', () => {
    expect(parseStreak({ v: 99, last: '2026-10-21', count: 5 })).toEqual(emptyStreak());
    expect(parseStreak(null)).toEqual(emptyStreak());
    expect(parseStreak('x')).toEqual(emptyStreak());
    expect(parseStreak({ v: 1, last: 'tomorrow', count: 5 })).toEqual(emptyStreak());
    expect(parseStreak({ v: 1, last: '2026-10-21', count: -3, badges: [3, 5] })).toMatchObject({ count: 0, badges: [3] });
    const s = recordPlay(emptyStreak(), '2026-10-21');
    expect(parseStreak(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('share text (D2)', () => {
  const entry = (over = {}) => ({
    record: { date: '2026-10-21', turns: 17, netWorth: 1234567, professionId: 'teacher', mode: 'family', seed: 1, actionsLog: [], ...over },
    lights: 'gyrngg', green: { green: 2, total: 3, kind: 'some' },
  });
  const url = 'https://example.org/passivo/';
  it('first line: date | outcome | net worth, then the squares and the link', () => {
    const lines = buildShareText(entry({ lights: undefined }), url).split('\n');
    expect(lines[0]).toBe('MaxiFox אתגר יומי 21.10 | חופש כלכלי ב-17 תורות | שווי נקי \u2066₪1.2M\u2069');
    const full = buildShareText(entry(), url).split('\n');
    expect(full[0]).toBe('MaxiFox אתגר יומי 21.10 | חופש כלכלי ב-17 תורות | שווי נקי \u2066₪1.2M\u2069');
    expect(full[1]).toBe('\u200F🟩🟨🟥⬜🟩🟩'); // RLM at the start of each emoji row
    expect(full.at(-1)).toBe(url);
  });
  it('uses the plural helper for one turn and says "not today" without freedom', () => {
    expect(buildShareText(entry({ turns: 1 }), url).split('\n')[0]).toContain('בתור אחד');
    const fail = buildShareText(entry({ turns: null, netWorth: 90000 }), url).split('\n')[0];
    expect(fail).toBe('MaxiFox אתגר יומי 21.10 | לא הצלחתי היום | שווי נקי \u2066₪90K\u2069');
  });
  it('wraps the squares in rows of ten', () => {
    expect(squaresRows('g'.repeat(23))).toEqual(['\u200F' + '🟩'.repeat(10), '\u200F' + '🟩'.repeat(10), '\u200F' + '🟩'.repeat(3)]);
    expect(squaresRows('')).toEqual([]);
  });
  it('compact money', () => {
    expect(compactMoney(1234567)).toBe('₪1.2M');
    expect(compactMoney(2000000)).toBe('₪2M');
    expect(compactMoney(850000)).toBe('₪850K');
    expect(compactMoney(12400)).toBe('₪12K');
    expect(compactMoney(9500)).toBe('₪9,500');
    expect(compactMoney(0)).toBe('₪0');
    expect(compactMoney(-300)).toBe('מינוס ₪300');
    expect(compactMoney(-24000)).toBe('מינוס ₪24K');
    expect(compactMoney(-1500000)).toBe('מינוס ₪1.5M');
    expect(buildShareText(entry({ netWorth: -24000 }), url).split('\n')[0]).toBe('MaxiFox אתגר יומי 21.10 | חופש כלכלי ב-17 תורות | שווי נקי \u2066מינוס ₪24K\u2069');
  });
  it('a real game reveals no card titles, no profession, no player names', () => {
    const { s } = play('2026-10-21', 'sensible');
    const e = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, s).entry;
    const text = buildShareText(e, url);
    for (const c of data.cards) expect(text).not.toContain(c.title);
    for (const p of data.professions) expect(text).not.toContain(p.title);
    expect(text.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(text.split('\n').slice(0, -1).join('\n').replace(/\d[KM]/, '').replace(/^MaxiFox /, '')).not.toMatch(/[A-Za-z]/); // only the brand name (MaxiFox, rename) and the link carry Latin letters
  });
  it('every emoji lives in he.json only (the share strings)', () => {
    for (const k of ['green', 'yellow', 'red', 'none']) expect(he.daily.shareLines[k]).toMatch(/\p{Extended_Pictographic}/u);
    for (const f of ['src/daily/share.js', 'src/ui/screens/daily.js', 'src/ui/screens/start.js']) {
      expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('one attempt per day and the stored result', () => {
  const finished = (date = '2026-10-21', bot = 'sensible') => play(date, bot).s;
  it('status: new -> playing (a saved game) -> done (a result), and only "new" may start', () => {
    const today = '2026-10-21';
    expect(dailyStatus({ results: emptyResults(), hasSave: false }, today)).toBe('new');
    expect(dailyStatus({ results: emptyResults(), hasSave: true }, today)).toBe('playing');
    const { results } = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, finished());
    expect(dailyStatus({ results, hasSave: false }, today)).toBe('done');
    expect(dailyStatus({ results, hasSave: true }, today)).toBe('done');
    expect(dailyStatus({ results, hasSave: false }, '2026-10-22')).toBe('new');
    expect(canStartDaily('new')).toBe(true);
    expect(canStartDaily('playing')).toBe(false);
    expect(canStartDaily('done')).toBe(false);
  });
  it('a second finish on the same day is ignored (result and streak stay)', () => {
    const first = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, finished());
    expect(first.fresh).toBe(true);
    const second = completeAttempt({ results: first.results, streak: first.streak }, finished('2026-10-21', 'alwaysPass'));
    expect(second.fresh).toBe(false);
    expect(second.entry).toEqual(first.entry);
    expect(second.streak).toEqual(first.streak);
    expect(second.streak.count).toBe(1);
  });
  it('giving up uses the attempt too, and counts for the streak', () => {
    let s = newDailyGame(engine, '2026-10-21');
    s = engine.forfeit(engine.roll(s));
    const out = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, s);
    expect(out.entry.outcome).toBe('gaveUp');
    expect(out.entry.record.turns).toBeNull();
    expect(out.streak.count).toBe(1);
  });
  it('stores the record, the lights per turn and the learning counts; never more than 60 days', () => {
    const s = finished();
    const { entry } = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, s);
    expect(entry.record).toEqual(dailyResult(s));
    expect(entry.lights).toHaveLength(s.turn);
    expect(entry.lights).toMatch(/^[gyrn]+$/);
    expect(entry.green).toMatchObject({ kind: expect.any(String) });
    expect(entry.outcome).toBe(s.status === 'won' ? 'won' : 'failed');
    let acc = { results: emptyResults(), streak: emptyStreak() };
    for (let i = 0; i < KEEP_DAYS + 5; i++) {
      const day = addDays('2026-01-01', i);
      acc = completeAttempt(acc, newDailyGame(engine, day).status === 'playing' ? engine.forfeit(newDailyGame(engine, day)) : null);
    }
    expect(Object.keys(acc.results.byDate)).toHaveLength(KEEP_DAYS);
    expect(acc.streak.count).toBe(KEEP_DAYS + 5);
    expect(acc.streak.badges).toEqual([3, 7, 30]);
  });
  it('stored results are schema-versioned and validated', () => {
    expect(parseResults({ v: 2, byDate: {} })).toEqual(emptyResults());
    expect(parseResults(null)).toEqual(emptyResults());
    expect(parseResults({ v: 1, byDate: { '2026-10-21': { record: { date: '2026-10-22' } } } }).byDate).toEqual({});
  });
  it('lights: the worst light of a turn wins, unrated turns are neutral', () => {
    expect(decisionLight({ kind: 'buy', tier: 'good' })).toBe('g');
    expect(decisionLight({ kind: 'buy', tier: 'ok' })).toBe('y');
    expect(decisionLight({ kind: 'buy', tier: 'trap' })).toBe('r');
    expect(decisionLight({ kind: 'buy', tier: null })).toBeNull();
    expect(decisionLight({ kind: 'pass', green: true })).toBe('g');
    expect(decisionLight({ kind: 'pass', green: false })).toBe('r');
    expect(decisionLight({ kind: 'pass', green: null })).toBeNull();
    expect(decisionLight({ kind: 'loan', rating: 'costly' })).toBe('r');
    expect(decisionLight({ kind: 'expense', viaLoan: true })).toBe('y');
    expect(decisionLight({ kind: 'expense', viaLoan: false })).toBeNull();
    const st = { turn: 4, learn: { decisions: [
      { turn: 1, kind: 'buy', tier: 'good' }, { turn: 1, kind: 'loan', rating: 'costly' }, { turn: 3, kind: 'pass', green: true },
    ] } };
    expect(turnLights(st)).toBe('rngn');
  });
});

describe('learning layer in the daily', () => {
  it('records decisions and ends with a headline the report can print', () => {
    const { s } = play('2026-10-21', 'sensible');
    expect(s.learn.decisions.length).toBeGreaterThan(0);
    const e = completeAttempt({ results: emptyResults(), streak: emptyStreak() }, s).entry;
    expect(greenText(e.green)).toMatch(/\S/);
  });
});

describe('strings', () => {
  it('has every daily key, with plural forms for the helpers', () => {
    for (const k of ['title', 'cardNew', 'cardPlaying', 'streakBroken', 'copied', 'share', 'giveUp', 'shareLines']) expect(he.daily[k]).toBeTruthy();
    for (const k of ['hours', 'minutes', 'streakDays', 'badgeDays', 'turnsIn']) expect(he.plural[k].other).toContain('{n}');
    expect(he.plural.streakDays.other.replace('{n}', '5')).toBe('שיחקתם 5 ימים ברצף');
  });
  it('the board has the squares the stream relies on', () => {
    expect(BOARD).toContain('opportunity');
  });
});

describe('shareText: system share, clipboard fallback, rejections', async () => {
  const { shareText } = await import('../src/ui/screens/daily.js');
  const doc = { createElement: () => ({ setAttribute() {}, style: {}, select() {}, remove() {} }), body: { append() {} }, execCommand: () => false };
  it('uses navigator.share when there is one', async () => {
    const sent = [];
    expect(await shareText('hi', { nav: { share: async (x) => sent.push(x) }, doc })).toBe('shared');
    expect(sent[0].text).toBe('hi');
  });
  it('a closed share sheet (AbortError) is silent', async () => {
    const nav = { share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }, clipboard: { writeText: async () => { throw new Error('never'); } } };
    expect(await shareText('hi', { nav, doc })).toBe('cancelled');
  });
  it('falls back to the clipboard without share, or when sharing fails', async () => {
    const wrote = [];
    const clipboard = { writeText: async (x) => wrote.push(x) };
    expect(await shareText('hi', { nav: { clipboard }, doc })).toBe('copied');
    expect(await shareText('yo', { nav: { share: async () => { throw new Error('boom'); }, clipboard }, doc })).toBe('copied');
    expect(wrote).toEqual(['hi', 'yo']);
  });
  it('a rejected clipboard never throws: it reports failure (the screen then shows the text to copy by hand)', async () => {
    const nav = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
    expect(await shareText('hi', { nav, doc })).toBe('failed');
    expect(await shareText('hi', { nav: {}, doc })).toBe('failed');
  });
});
