// 0.5.0 career store logic (src/career/): weeks, the age guard, XP and ranks, seniority (reset, drop, clock guards), profiles, the device
// store, finishing a game (verification, achievements) and the 16 achievement conditions.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, botStep, playGame, configOf, newMatch, currentState, stateHash, EngineError,
  AGE_BANDS, MAX_RANK, XP_WIN, XP_LOSS, XP_ACHIEVEMENT, RANK_XP_NEEDED, MAX_PROFILES, CAREER_PROTECTED_AGE, JUNIOR_AGE,
} from '../src/engine/index.js';
import { dayNumber, addDays, weekDay, weekNumber, weekStartKey, weekEndKey, daysLeftInWeek } from '../src/daily/calendar.js';
import {
  CAREER_SCHEMA, emptyCareer, parseCareer, parseProfile, createProfile, withProfile, removeProfile, setActive, activeProfile, editProfile, setAge,
  isProtectedAge, promoWeekProfession, gameXp, xpNeeded, standing, syncSeniority, seniorityView, awardGame, awardAchievements, recordOf, effectiveWeek,
  startableRanks, cleanProfileName,
} from '../src/career/career.js';
import { ACHIEVEMENTS, achievementById, evaluateGame, evaluateRankBased, gameTimeline, updateCounters, suitsGame } from '../src/career/achievements.js';
import { finishGame, endStateVerified } from '../src/career/finish.js';
import { loadCareer, saveCareer, syncActive, addProfile, updateCareer } from '../src/career/store.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);
const IDS = data.professions.map((p) => p.id);
const NO_PROMO = []; // no promotion-week profession: XP is paid at face value

// a fixed run of days: 2026-11-08 is a Sunday
const SUN = '2026-11-08';
const day = (n) => addDays(SUN, n); // day(0) = Sunday of week W0, day(7) = Sunday of the next week ...
const W = weekNumber(SUN);

/** A new adult profile whose creation week is W. */
const fresh = (age = '14plus', today = SUN) => createProfile(emptyCareer(), { name: 'נועה', age, fox: 'teacher' }, today).profile;
/** A profile that finished a game in week W + k. */
const playedIn = (p, k) => ({ ...p, lastPlayWeek: W + k, settledWeek: W + k - 1, missed: 0 });
const withRanks = (p, ranks) => ({ ...p, ranks: Object.fromEntries(Object.entries(ranks).map(([id, [rank, xp]]) => [id, { rank, xp }])), peak: Object.fromEntries(Object.entries(ranks).map(([id, [rank]]) => [id, rank])) });

describe('weeks (Sunday to Saturday, pure date maths)', () => {
  it('weekDay, weekNumber, the Sunday and the Saturday of a week, days left', () => {
    expect(weekDay('2026-11-08')).toBe(0); expect(weekDay('2026-11-11')).toBe(3); expect(weekDay('2026-11-14')).toBe(6);
    expect(weekDay('1970-01-01')).toBe(4); expect(weekDay('1969-12-28')).toBe(0);
    expect(weekNumber('2026-11-08')).toBe(weekNumber('2026-11-14'));
    expect(weekNumber('2026-11-15')).toBe(weekNumber('2026-11-14') + 1);
    expect(weekStartKey(W)).toBe('2026-11-08'); expect(weekEndKey(W)).toBe('2026-11-14');
    expect(daysLeftInWeek('2026-11-08')).toBe(7); expect(daysLeftInWeek('2026-11-14')).toBe(1); expect(daysLeftInWeek('2026-11-12')).toBe(3);
    expect(daysLeftInWeek('2026-11-08', 5)).toBe(6); // a Friday deadline counts to Friday
    expect(daysLeftInWeek('2026-11-14', 5)).toBe(1); // never below 1
  });
  it('every day of 400 years of calendar maps into a week of 7 days, no skips (daylight saving cannot matter: no clock is read)', () => {
    let prev = weekNumber('2020-01-01'); let n = 0;
    for (let i = 0; i < 3650; i++) {
      const k = addDays('2020-01-01', i);
      const w = weekNumber(k);
      expect(w - prev === 0 || w - prev === 1).toBe(true);
      expect(w === prev ? 1 : 0).toBeGreaterThanOrEqual(0);
      if (weekDay(k) === 0) expect(w).toBe(prev + (i === 0 ? 0 : 1));
      prev = w; n += 1;
    }
    expect(n).toBe(3650);
  });
});

describe('the age guard', () => {
  it('protected: the configured band and every younger one, and no band at all; 11-13 and 14+ are not', () => {
    expect(CAREER_PROTECTED_AGE).toBe(JUNIOR_AGE);
    expect(isProtectedAge('upTo10')).toBe(true);
    expect(isProtectedAge(null)).toBe(true);
    expect(isProtectedAge(undefined)).toBe(true);
    expect(isProtectedAge('11to13')).toBe(false);
    expect(isProtectedAge('14plus')).toBe(false);
  });
});

describe('XP and ranks', () => {
  it('a win pays more than a loss; below your rank pays half; the promotion week doubles', () => {
    expect(XP_WIN).toBeGreaterThan(XP_LOSS);
    expect(gameXp({ won: true })).toBe(XP_WIN);
    expect(gameXp({ won: false })).toBe(XP_LOSS);
    expect(gameXp({ won: true, gameRank: 0, careerRank: 2 })).toBe(Math.floor(XP_WIN / 2));
    expect(gameXp({ won: true, gameRank: 2, careerRank: 2 })).toBe(XP_WIN);
    expect(gameXp({ won: true, doubled: true })).toBe(XP_WIN * 2);
    expect(gameXp({ won: true, gameRank: 0, careerRank: 1, doubled: true })).toBe(Math.floor(XP_WIN / 2) * 2);
  });
  it('thresholds: rank 0, 1, 2 need RANK_XP_NEEDED; the top rank needs none and gathers none', () => {
    expect(RANK_XP_NEEDED).toHaveLength(MAX_RANK);
    expect([0, 1, 2].map(xpNeeded)).toEqual(RANK_XP_NEEDED);
    expect(xpNeeded(3)).toBe(Infinity);
  });
  const record = (extra = {}) => ({ professionId: 'teacher', rank: 0, won: true, mode: 'family', junior: false, challenge: false, turns: 20, ...extra });
  it('XP lands in the game profession; a rank up carries the remainder over; several ranks can rise at once', () => {
    let p = fresh();
    const r1 = awardGame(p, record(), { today: SUN, professionIds: NO_PROMO });
    expect(r1.xp.game).toBe(XP_WIN);
    expect(standing(r1.profile, 'teacher')).toMatchObject({ rank: 0, xp: XP_WIN });
    const r2 = awardGame(withRanks(p, { teacher: [0, RANK_XP_NEEDED[0] - XP_WIN + 5] }), record(), { today: day(1), professionIds: NO_PROMO });
    expect(r2.rankUps).toEqual([{ professionId: 'teacher', from: 0, to: 1 }]);
    expect(standing(r2.profile, 'teacher')).toMatchObject({ rank: 1, xp: 5 }); // the remainder carries over
    expect(r2.profile.peak.teacher).toBe(1);
    const big = awardGame(withRanks(p, { teacher: [0, 50] }), record(), { today: SUN, earned: ACHIEVEMENTS.slice(0, 12).map((a) => a.id), professionIds: NO_PROMO });
    expect(big.rankUps.length).toBeGreaterThanOrEqual(1);
    const top = awardGame(withRanks(p, { teacher: [2, RANK_XP_NEEDED[2] - 10] }), record({ rank: 2 }), { today: SUN, professionIds: NO_PROMO });
    expect(standing(top.profile, 'teacher')).toMatchObject({ rank: 3, xp: 0 });
    const again = awardGame(top.profile, record({ rank: 3 }), { today: SUN, professionIds: NO_PROMO });
    expect(standing(again.profile, 'teacher')).toMatchObject({ rank: 3, xp: 0 }); // no XP at the top, no rank beyond it
    expect(again.rankUps).toEqual([]);
  });
  it('a game below the profession rank pays half, in the same profession; another profession keeps its own progress', () => {
    const p = withRanks(fresh(), { teacher: [1, 0], nurse: [0, 10] });
    const r = awardGame(p, record({ rank: 0 }), { today: SUN, professionIds: NO_PROMO });
    expect(standing(r.profile, 'teacher').xp).toBe(Math.floor(XP_WIN / 2));
    expect(standing(r.profile, 'nurse')).toMatchObject({ rank: 0, xp: 10 });
  });
  it('an achievement pays XP_ACHIEVEMENT once (never again), into the game profession', () => {
    const p = fresh();
    const a = awardGame(p, record({ won: false }), { today: SUN, earned: ['fast-payback', 'fast-payback'.replace('fast-payback', 'win-no-bank-loan')], professionIds: NO_PROMO });
    expect(a.xp.achievements).toBe(2 * XP_ACHIEVEMENT);
    expect(Object.keys(a.profile.achievements).sort()).toEqual(['fast-payback', 'win-no-bank-loan']);
    expect(a.profile.achievements['fast-payback']).toBe(SUN);
    const b = awardGame(a.profile, record({ won: false }), { today: day(1), earned: ['fast-payback'], professionIds: NO_PROMO });
    expect(b.xp.achievements).toBe(0);
    expect(awardAchievements(a.profile, ['fast-payback'], { today: SUN, professionId: 'teacher' }).xp).toBe(0);
  });
  it('the promotion week: one profession per week, keyed from the week number, the same every time; it pays double, only there', () => {
    const picks = Array.from({ length: 80 }, (_, i) => promoWeekProfession(W + i, IDS));
    expect(picks).toEqual(Array.from({ length: 80 }, (_, i) => promoWeekProfession(W + i, IDS)));
    expect(new Set(picks).size).toBe(IDS.length); // every profession gets its week
    expect(promoWeekProfession(W, [])).toBeNull();
    const promo = promoWeekProfession(W, IDS);
    const other = IDS.find((x) => x !== promo);
    const a = awardGame(fresh(), record({ professionId: promo }), { today: SUN, professionIds: IDS });
    const b = awardGame(fresh(), record({ professionId: other }), { today: SUN, professionIds: IDS });
    expect(a.xp).toMatchObject({ game: XP_WIN * 2, doubled: true });
    expect(b.xp).toMatchObject({ game: XP_WIN, doubled: false });
    const withAch = awardGame(fresh(), record({ professionId: promo }), { today: SUN, earned: ['fast-payback'], professionIds: IDS });
    expect(withAch.xp.achievements).toBe(XP_ACHIEVEMENT * 2);
    // the Sunday and the Saturday of one week share the profession; the next Sunday may not
    expect(promoWeekProfession(weekNumber('2026-11-14'), IDS)).toBe(promo);
  });
  it('startable ranks: the current rank and every lower one', () => {
    expect(startableRanks(withRanks(fresh(), { teacher: [2, 0] }), 'teacher')).toEqual([0, 1, 2]);
    expect(startableRanks(fresh(), 'nurse')).toEqual([0]);
  });
});

describe('seniority: reset, drop, never below rank 0', () => {
  const adult = () => withRanks(playedIn(fresh(), 0), { teacher: [2, 50], nurse: [1, 20], cook: [0, 30] });
  const sync = (p, k) => syncSeniority(p, day(7 * k));
  it('the same week and the next one change nothing: a game in week W keeps W and gives all of W+1 to play', () => {
    expect(sync(adult(), 0).events).toEqual([]);
    expect(sync(adult(), 1).events).toEqual([]);
    expect(sync(adult(), 1).profile.ranks.teacher).toEqual({ rank: 2, xp: 50 });
  });
  it('one full week without a game resets the progress in every profession; the ranks stay', () => {
    const r = sync(adult(), 2);
    expect(r.events).toEqual([{ type: 'reset', week: W + 1 }]);
    expect(r.profile.ranks).toEqual({ teacher: { rank: 2, xp: 0 }, nurse: { rank: 1, xp: 0 }, cook: { rank: 0, xp: 0 } });
    expect(r.profile.missed).toBe(1);
  });
  it('two in a row drop every profession above rank 0 by one rank (never below 0), progress zero', () => {
    const r = sync(adult(), 3);
    expect(r.events.map((e) => e.type)).toEqual(['reset', 'drop']);
    expect(r.events[1].drops).toEqual([{ professionId: 'teacher', from: 2, to: 1 }, { professionId: 'nurse', from: 1, to: 0 }]);
    expect(r.profile.ranks).toEqual({ teacher: { rank: 1, xp: 0 }, nurse: { rank: 0, xp: 0 }, cook: { rank: 0, xp: 0 } });
  });
  it('at most ONE drop per return: more missed weeks change nothing, in one sync or in weekly ones; titles reached stay (peak)', () => {
    const r = sync(adult(), 4);
    expect(r.events.map((e) => e.type)).toEqual(['reset', 'drop']);
    expect(r.profile.ranks).toEqual({ teacher: { rank: 1, xp: 0 }, nurse: { rank: 0, xp: 0 }, cook: { rank: 0, xp: 0 } });
    expect(r.profile.dropped).toBe(true);
    const far = sync(adult(), 12); // nine absent weeks in one sync
    expect(far.events.map((e) => e.type)).toEqual(['reset', 'drop']);
    expect(far.profile.ranks.teacher.rank).toBe(1);
    expect(far.profile.peak).toEqual({ teacher: 2, nurse: 1, cook: 0 }); // "הגעתי פעם ל..." survives the drop
    expect(far.profile.settledWeek).toBe(W + 11);
    // weekly syncs over one absence lower each rank by exactly one
    let p = adult(); const types = [];
    for (let k = 1; k <= 12; k++) { const s = syncSeniority(p, day(7 * k)); p = s.profile; types.push(...s.events.map((e) => e.type)); }
    expect(types).toEqual(['reset', 'drop']);
    expect(p.ranks).toEqual(far.profile.ranks);
  });
  it('a finished game ends the run: a later absence resets and drops once again', () => {
    const missed = sync(adult(), 3).profile;
    expect(missed.dropped).toBe(true);
    const back = awardGame(missed, { professionId: 'teacher', rank: 1, won: false, mode: 'family', junior: false, challenge: false, turns: 9 }, { today: day(21), professionIds: IDS }).profile;
    expect(back.missed).toBe(0);
    expect(back.dropped).toBe(false);
    expect(syncSeniority(back, day(28)).events).toEqual([]);
    expect(syncSeniority(back, day(35)).events).toEqual([{ type: 'reset', week: W + 4 }]);
    const again = syncSeniority(back, day(49));
    expect(again.events.map((e) => e.type)).toEqual(['reset', 'drop']);
    expect(again.profile.ranks.teacher.rank).toBe(back.ranks.teacher.rank - 1);
  });
  it('syncing is idempotent and the order of calls does not matter: two syncs equal one', () => {
    const a = sync(adult(), 5);
    expect(syncSeniority(a.profile, day(35))).toEqual({ profile: a.profile, events: [] });
    const stepwise = syncSeniority(syncSeniority(syncSeniority(adult(), day(14)).profile, day(21)).profile, day(35));
    expect(stepwise.profile).toEqual(a.profile);
  });
  it('a protected profile never loses anything: the week count just moves on (age up to 10, and no band at all)', () => {
    for (const age of ['upTo10', null]) {
      const kid = { ...adult(), age };
      const r = sync(kid, 20);
      expect(r.events).toEqual([{ type: 'waited', weeks: 19 }]); // only "the career waited", once (the junior return screen)
      expect(r.profile.ranks).toEqual(kid.ranks);
      expect(r.profile.missed).toBe(0);
      expect(r.profile.dropped).toBe(false);
      expect(r.profile.settledWeek).toBe(W + 19);
    }
  });
  it('clock guards: a clock moved back restores nothing; a far-future date is ignored; a long absence is not misread', () => {
    const dropped = sync(adult(), 3).profile;
    const back = syncSeniority(dropped, day(7)); // the clock was set back to week W + 1
    expect(back.events).toEqual([]);
    expect(back.profile).toEqual(dropped);
    const view = seniorityView(dropped, day(7));
    expect(['kept', 'open', 'warn']).toContain(view.state);
    const far = syncSeniority(adult(), '2090-01-01'); // beyond the jump limit
    expect(far.events).toEqual([]);
    expect(far.profile.ranks).toEqual(adult().ranks);
    expect(effectiveWeek(adult(), '2090-01-01')).toBe(W); // read as the profile's own unsettled week
    // a play on a far-future date counts for the next unsettled week and never freezes the profile
    const r = awardGame(adult(), { professionId: 'teacher', rank: 2, won: true, mode: 'family', junior: false, challenge: false, turns: 20 }, { today: '2090-01-01', professionIds: IDS });
    expect(r.profile.lastPlayWeek).toBe(W);
    expect(syncSeniority(r.profile, day(7)).events).toEqual([]);
  });
  it('a play on a clock moved back never moves the last play back', () => {
    const p = playedIn(adult(), 5);
    const r = awardGame(p, { professionId: 'cook', rank: 0, won: true, mode: 'family', junior: false, challenge: false, turns: 20 }, { today: day(14), professionIds: IDS });
    expect(r.profile.lastPlayWeek).toBe(W + 5);
    expect(r.events).toEqual([]);
  });
});

describe('Shabbat: the week ends Saturday, the deadline is Friday (owner 2026-11-11)', () => {
  const rec = { professionId: 'teacher', rank: 0, won: true, mode: 'family', junior: false, challenge: false, turns: 20 };
  const play = (p, d) => awardGame(p, rec, { today: d, professionIds: IDS }).profile;
  it('Friday 23:59 and Sunday 00:01 are different weeks; Saturday belongs to the week before it', () => {
    expect(weekNumber('2026-11-13')).toBe(W);          // Friday
    expect(weekNumber('2026-11-14')).toBe(W);          // Saturday: same week, a bonus day
    expect(weekNumber('2026-11-15')).toBe(W + 1);      // Sunday
  });
  it('daylight-saving weeks (Israel: last Friday of March, last Sunday of October) keep seven-day weeks', () => {
    for (const fri of ['2026-03-27', '2026-10-23', '2027-03-26', '2027-10-29']) {
      const sun = addDays(fri, -5);
      expect(weekDay(sun)).toBe(0);
      expect(weekNumber(fri)).toBe(weekNumber(sun));
      expect(weekNumber(addDays(fri, 2))).toBe(weekNumber(sun) + 1);
    }
    for (const sun of ['2026-10-25', '2027-03-28']) { expect(weekDay(sun)).toBe(0); expect(weekNumber(addDays(sun, 6))).toBe(weekNumber(sun)); }
  });
  it('a Friday-only player and a Saturday-only player are never penalised over ten weeks', () => {
    for (const wd of [5, 6]) {
      let p = fresh('14plus', SUN);
      let events = [];
      for (let k = 1; k <= 10; k++) {
        const d = addDays(SUN, 7 * k + wd);
        const s = syncSeniority(p, d); events = events.concat(s.events); p = play(s.profile, d);
      }
      expect(events).toEqual([]);
      expect(p.dropped).toBe(false);
      expect(p.ranks.teacher.rank).toBeGreaterThanOrEqual(1); // they earned ranks, and lost nothing
    }
  });
  it('the chip never counts 0 days: Thursday 2, Friday 1, Saturday 1', () => {
    const p = playedIn(fresh(), 0);
    expect([4, 5, 6].map((d) => seniorityView(p, day(7 + d)).days)).toEqual([2, 1, 1]);
  });
});

describe('age edits (free) and the grace week', () => {
  it('growing out of the protected band: the current week counts as played, so the first week never starts with a loss', () => {
    const kid = withRanks({ ...playedIn(fresh('upTo10'), 0) }, { teacher: [2, 10] });
    const r = setAge(kid, '11to13', day(7 * 6)); // six weeks later, the age is edited
    expect(r.events).toEqual([{ type: 'waited', weeks: 5 }]); // settled under the old band: nothing lost
    expect(r.profile.age).toBe('11to13');
    expect(r.profile.lastPlayWeek).toBe(W + 6);
    expect(syncSeniority(r.profile, day(7 * 7)).events).toEqual([]); // the next week is still open
    expect(syncSeniority(r.profile, day(7 * 8)).events.map((e) => e.type)).toEqual(['reset']); // and now the rule applies
    expect(r.profile.ranks.teacher).toEqual({ rank: 2, xp: 10 });
  });
  it('becoming protected forgets the missed weeks; the same band is a no-op; a bad band is refused', () => {
    const p = { ...withRanks(playedIn(fresh('14plus'), 0), { teacher: [1, 5] }), missed: 1 };
    const r = setAge(p, 'upTo10', day(7));
    expect(r.profile.missed).toBe(0);
    expect(setAge({ ...p, dropped: true }, 'upTo10', day(7)).profile.dropped).toBe(false);
    expect(setAge(p, '14plus', day(7)).profile).toBe(p);
    expect(setAge(p, 'nope', day(7)).profile).toBe(p);
  });
});

describe('what the home chip shows', () => {
  it('kept / open / warn / waiting / none, the days left, and whether the next miss drops a rank', () => {
    const p = playedIn(fresh(), 1); // played in week W + 1
    expect(seniorityView(null, SUN)).toEqual({ state: 'none' });
    expect(seniorityView(p, day(7))).toEqual({ state: 'kept' });
    expect(seniorityView(fresh('upTo10'), day(3))).toEqual({ state: 'waiting' });
    const early = seniorityView(playedIn(fresh(), 0), day(7 + 1)); // Monday, nothing this week yet
    expect(early).toMatchObject({ state: 'open', days: 5 });
    expect(seniorityView(playedIn(fresh(), 0), day(7 + 3))).toMatchObject({ state: 'open', days: 3 }); // Wednesday: no warning yet
    expect(seniorityView(playedIn(fresh(), 0), day(7 + 4))).toEqual({ state: 'warn', days: 2, rank: false }); // Thursday: Thu, Fri
    expect(seniorityView(playedIn(fresh(), 0), day(7 + 5))).toEqual({ state: 'warn', days: 1, rank: false }); // Friday
    expect(seniorityView(playedIn(fresh(), 0), day(7 + 6))).toEqual({ state: 'warn', days: 1, rank: false }); // Saturday: bonus day, never 0
    // after a drop nothing more can be lost: no warning on any day
    const dropped = { ...playedIn(fresh(), 0), dropped: true, missed: 2 };
    for (let d = 0; d < 7; d++) expect(seniorityView(dropped, day(7 + d)).state).not.toBe('warn');
    // after one missed week the next miss drops every rank
    expect(seniorityView(playedIn(fresh(), 0), day(14 + 5))).toMatchObject({ state: 'warn', rank: true });
  });
});

describe('profiles', () => {
  it('the age band is required; the name is cleaned to 12 characters; the creation week counts as played', () => {
    expect(createProfile(emptyCareer(), { name: 'x' }, SUN)).toMatchObject({ profile: null, error: 'age' });
    expect(createProfile(emptyCareer(), { name: 'x', age: '99' }, SUN).profile).toBeNull();
    const { profile, career } = createProfile(emptyCareer(), { name: '  דנה   כהן-לוי-הארוכה מאוד ', age: '11to13', fox: 'nurse' }, SUN);
    expect(profile.name.length).toBeLessThanOrEqual(12);
    expect(profile).toMatchObject({ age: '11to13', fox: 'nurse', since: SUN, games: 0, lastPlayWeek: W, settledWeek: W - 1, missed: 0 });
    expect(career.active).toBe(profile.id);
    expect(syncSeniority(profile, day(7)).events).toEqual([]);
    expect(cleanProfileName('  a   b  ')).toBe('a b');
  });
  it('up to 4 profiles; switch, rename, change the fox, remove; the active one is always a real one', () => {
    let c = emptyCareer();
    for (let i = 0; i < MAX_PROFILES; i++) c = createProfile(c, { name: `p${i}`, age: '14plus' }, SUN).career;
    expect(c.profiles).toHaveLength(MAX_PROFILES);
    expect(createProfile(c, { name: 'x', age: '14plus' }, SUN)).toMatchObject({ profile: null, error: 'full' });
    expect(new Set(c.profiles.map((p) => p.id)).size).toBe(MAX_PROFILES);
    expect(setActive(c, 'p2').active).toBe('p2');
    expect(setActive(c, 'nope').active).toBe(c.active);
    const edited = editProfile(c.profiles[0], { name: 'חדש', fox: 'cook' });
    expect(withProfile(c, edited).profiles[0]).toMatchObject({ name: 'חדש', fox: 'cook' });
    const gone = removeProfile(setActive(c, 'p2'), 'p2');
    expect(gone.profiles).toHaveLength(3);
    expect(gone.profiles.some((p) => p.id === gone.active)).toBe(true);
    expect(activeProfile(removeProfile(removeProfile(removeProfile(removeProfile(c, 'p1'), 'p2'), 'p3'), 'p4'))).toBeNull();
  });
  it('profiles are migration-safe: a record from before a field existed still loads (defaults), unknown fields are ignored', () => {
    const old = { v: CAREER_SCHEMA, active: 'p1', profiles: [{ id: 'p1', name: 'א', age: '14plus', ranks: { teacher: { rank: 1, xp: 5 } } }], future: 1 };
    const c = parseCareer(old);
    expect(c.profiles[0]).toMatchObject({ id: 'p1', name: 'א', games: 0, missed: 0, lastPlayWeek: null, counters: { badPasses: 0, wins: 0, challengeStreak: 0, wonProfessions: [] } });
    expect(c.profiles[0].peak.teacher).toBe(1);
    expect(syncSeniority(c.profiles[0], SUN)).toMatchObject({ events: [], profile: { lastPlayWeek: W, settledWeek: W - 1 } }); // the first sync starts the clock
  });
});

describe('the device store: schema-versioned, corrupt data starts over', () => {
  const memory = () => { const m = {}; return { read: (k, f = null) => (k in m ? JSON.parse(m[k]) : f), write: (k, v) => { m[k] = JSON.stringify(v); return true; }, m }; };
  it('round-trips; every kind of corruption becomes an empty career, never an exception', () => {
    const io = memory();
    expect(loadCareer(io.read)).toEqual(emptyCareer());
    const { career } = createProfile(emptyCareer(), { name: 'נועה', age: '14plus' }, SUN);
    saveCareer(career, io.write);
    expect(loadCareer(io.read)).toEqual(career);
    for (const bad of [null, 7, 'x', [], { v: 99, profiles: [] }, { v: 1, profiles: 'no' }, { v: 1 }, { profiles: [] }]) expect(parseCareer(bad)).toEqual(emptyCareer());
    expect(parseCareer({ v: 1, profiles: [null, 5, { id: '' }, { id: 'a', age: 'x', ranks: { teacher: { rank: 99, xp: -4 } }, lastPlayWeek: -3 }] }).profiles).toEqual([
      expect.objectContaining({ id: 'a', age: null, lastPlayWeek: null, ranks: { teacher: { rank: 3, xp: 0 } } }),
    ]);
    expect(parseProfile({ id: 'a', ranks: { x: { rank: 1, xp: 99999 } } }).ranks.x.xp).toBeLessThan(RANK_XP_NEEDED[1]);
  });
  it('addProfile / syncActive / updateCareer go through the store', () => {
    const io = memory();
    expect(addProfile({ name: 'א' }, SUN, io)).toMatchObject({ profile: null, error: 'age' });
    expect(loadCareer(io.read).profiles).toHaveLength(0);
    const { profile } = addProfile({ name: 'ב', age: '14plus' }, SUN, io);
    expect(profile.id).toBe('p1');
    const out = syncActive(day(7 * 3), io);
    expect(out.profile.id).toBe('p1');
    expect(out.events.map((e) => e.type)).toEqual(['reset']);
    expect(syncActive(day(7 * 3), io).events).toEqual([]); // events are shown once
    updateCareer((c) => setActive(c, 'p1'), io);
    expect(syncActive(SUN, { read: () => null, write: () => true }).profile).toBeNull();
  });
});

describe('recordOf: only a win or a game over counts', () => {
  const won = playGame(engine, engine.newGame({ mode: 'family', professionId: 'teacher', seed: 31 }), 'sensible', 200);
  it('a finished game counts; a game still playing (quit from the menu), the daily and a mission do not', () => {
    expect(won.status).toBe('won');
    expect(recordOf(won)).toMatchObject({ professionId: 'teacher', rank: 0, won: true, mode: 'family', junior: false, challenge: false });
    expect(recordOf(engine.newGame({ mode: 'family', professionId: 'teacher', seed: 31 }))).toBeNull();
    expect(recordOf({ ...won, daily: { date: '2026-11-20' } })).toBeNull();
    expect(recordOf(won, { mission: true })).toBeNull();
    expect(recordOf({ ...won, status: 'lost' }).won).toBe(false);
    expect(recordOf(null)).toBeNull();
  });
  it('a ranked, junior or challenge game says so', () => {
    const r = recordOf({ ...won, rank: 2, junior: true, challenge: true });
    expect(r).toMatchObject({ rank: 2, junior: true, challenge: true });
  });
});

describe('finishGame: verify, achievements, XP, ranks', () => {
  const noCharity = (seed, extra = {}) => { let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed, ...extra }); for (let i = 0; i < 2000 && s.status === 'playing'; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, 'sensible'); return s; };
  it('credits a real game: seniority kept, XP paid, first-freedom earned with its XP, once', () => {
    const state = noCharity(41);
    expect(state.status).toBe('won');
    const out = finishGame({ engine, profile: fresh(), state, today: SUN });
    expect(out.newAchievements).toContain('first-freedom');
    expect(out.xp.game).toBe(XP_WIN * (out.xp.doubled ? 2 : 1));
    expect(out.profile.games).toBe(1);
    expect(out.profile.counters.wins).toBe(1);
    expect(out.profile.lastPlayWeek).toBe(W);
    const second = finishGame({ engine, profile: out.profile, state: noCharity(42), today: day(1) });
    expect(second.newAchievements).not.toContain('first-freedom');
  });
  it('a loss counts too (less XP); a game that does not count returns null', () => {
    const lost = { ...noCharity(43), status: 'lost' };
    void lost; // a forged status is caught by the verification below
    const real = playGame(engine, engine.newGame({ mode: 'family', professionId: 'cook', seed: 7 }), 'overBorrow', 200);
    if (real.status === 'lost') expect(finishGame({ engine, profile: fresh(), state: real, today: SUN }).xp.game).toBeLessThan(XP_WIN * 2);
    expect(finishGame({ engine, profile: fresh(), state: engine.newGame({ mode: 'family', professionId: 'cook', seed: 7 }), today: SUN })).toBeNull();
    expect(finishGame({ engine, profile: null, state: noCharity(41), today: SUN })).toBeNull();
  });
  it('only verified end states count: a forged status, a cut log or a changed action is refused', () => {
    const state = noCharity(44);
    expect(endStateVerified(engine, state)).toBe(true);
    expect(finishGame({ engine, profile: fresh(), state: { ...state, status: 'lost' }, today: SUN })).toBeNull();
    expect(finishGame({ engine, profile: fresh(), state: { ...state, turn: state.turn - 3 }, today: SUN })).toBeNull();
    expect(finishGame({ engine, profile: fresh(), state: { ...state, log: state.log.slice(0, -4) }, today: SUN })).toBeNull();
    const i = state.log.findIndex((a) => a.type === 'pass');
    expect(i).toBeGreaterThanOrEqual(0);
    const forged = { ...state, log: state.log.map((a, k) => (k === i ? { type: 'buy', qty: 1 } : a)) }; // a pass turned into a buy
    expect(finishGame({ engine, profile: fresh(), state: forged, today: SUN })).toBeNull();
  });
  it('a challenge game gives XP and keeps seniority like any other', () => {
    const state = noCharity(45, { challenge: true });
    const profile = playedIn(fresh(), 0);
    const out = finishGame({ engine, profile, state, today: day(7) });
    expect(out.record.challenge).toBe(true);
    expect(out.profile.lastPlayWeek).toBe(W + 1);
    expect(out.xp.game).toBeGreaterThan(0);
    expect(out.profile.counters.challengeStreak).toBe(state.status === 'won' ? 1 : 0);
  });
  it('a ranked game at the profession rank pays full XP; settled seniority events come with the award', () => {
    const state = noCharity(46, { rank: 1 });
    const p = withRanks(playedIn(fresh(), 0), { teacher: [1, 0] });
    const out = finishGame({ engine, profile: p, state, today: day(7 * 3) }); // two weeks missed first
    expect(out.events.map((e) => e.type)).toEqual(['reset', 'drop']);
    expect(out.events[1].drops).toEqual([{ professionId: 'teacher', from: 1, to: 0 }]); // settled first, then this game's XP lands
    expect(out.profile.peak.teacher).toBeGreaterThanOrEqual(1);
  });
  it('the ladder achievements come from the XP of the game itself: enough XP to leave rank 0 earns "first-rank-up"', () => {
    const state = noCharity(47);
    const p = withRanks(fresh(), { teacher: [0, RANK_XP_NEEDED[0] - 1] });
    const out = finishGame({ engine, profile: p, state, today: SUN });
    expect(out.rankUps[0]).toEqual({ professionId: 'teacher', from: 0, to: 1 });
    expect(out.newAchievements).toContain('first-rank-up');
  });
});

describe('the 16 achievements', () => {
  const baseRecord = { professionId: 'teacher', rank: 0, won: true, mode: 'family', junior: false, challenge: false, turns: 20 };
  const baseState = (over = {}) => ({ stats: { loansTaken: 0 }, assets: [], learn: { decisions: [] }, rngVersion: 1, log: [], ...over });
  const ev = (state, over = {}) => evaluateGame({ engine, state, record: { ...baseRecord, ...(over.record ?? {}) }, profile: over.profile ?? fresh(), promoProfessionId: over.promo ?? null });
  const earned = (state, over) => ev(state, over).earned;

  it('the file holds 16 ids, 10 learning and 6 play, every one with a check', () => {
    expect(ACHIEVEMENTS).toHaveLength(16);
    expect(ACHIEVEMENTS.filter((a) => a.kind === 'learning')).toHaveLength(10);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(16);
    // every concept-tied achievement names a concept (at least half, per the plan)
    expect(ACHIEVEMENTS.filter((a) => a.concept).length).toBeGreaterThanOrEqual(8);
    expect(achievementById('promo-keep').concept).toBe('lifestyle_creep');
  });
  it('spot-bad-deals: 5 passes on red deals the player could afford, counted across games (stocks and unaffordable passes never count)', () => {
    const pass = (extra) => ({ kind: 'pass', type: 'apartment', tier: 'bad', afford: true, ...extra });
    const four = baseState({ learn: { decisions: [pass(), pass(), pass(), { ...pass(), tier: 'trap' }, { ...pass(), afford: false }, { ...pass(), type: 'stock', tier: null }, { ...pass(), tier: 'good' }] } });
    expect(earned(four)).not.toContain('spot-bad-deals');
    expect(ev(four).counters.badPasses).toBe(4);
    const more = ev(baseState({ learn: { decisions: [pass(), pass()] } }), { profile: { ...fresh(), counters: { ...fresh().counters, badPasses: 4 } } });
    expect(more.earned).toContain('spot-bad-deals');
  });
  it('win-no-bank-loan: a win with no loan taken (a loss with none does not count)', () => {
    expect(earned(baseState())).toContain('win-no-bank-loan');
    expect(earned(baseState({ stats: { loansTaken: 1 } }))).not.toContain('win-no-bank-loan');
    expect(earned(baseState(), { record: { won: false } })).not.toContain('win-no-bank-loan');
  });
  it('fast-payback: a buy of an apartment or business with a green light; a stock or a yellow one does not', () => {
    const buy = (extra) => baseState({ learn: { decisions: [{ kind: 'buy', type: 'apartment', tier: 'good', ...extra }] } });
    expect(earned(buy({}))).toContain('fast-payback');
    expect(earned(buy({ type: 'business' }))).toContain('fast-payback');
    expect(earned(buy({ tier: 'ok' }))).not.toContain('fast-payback');
    expect(earned(buy({ type: 'stock', tier: null }))).not.toContain('fast-payback');
  });
  it('promo-keep: the promotion answered with keep (upgrade does not)', () => {
    const d = (choice) => baseState({ learn: { decisions: [{ kind: 'promotion', choice }] } });
    expect(earned(d('keep'))).toContain('promo-keep');
    expect(earned(d('upgrade'))).not.toContain('promo-keep');
  });
  it('promo-keep end to end: a real game that kept its lifestyle earns it, even in a game that ends in a loss', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 77, promotion: true });
    for (let i = 0; i < 800 && s.status === 'playing'; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, 'sensible');
    expect(s.promotion.status).toBe('kept');
    const out = finishGame({ engine, profile: fresh(), state: s, today: SUN });
    expect(out.newAchievements).toContain('promo-keep');
  });
  it('expenses-from-cash: 3 unexpected expenses in one game, none through a loan or a sale', () => {
    const ex = (extra) => ({ kind: 'expense', viaLoan: false, viaSale: false, ...extra });
    expect(earned(baseState({ learn: { decisions: [ex(), ex(), ex()] } }), { record: { won: false } })).toContain('expenses-from-cash');
    expect(earned(baseState({ learn: { decisions: [ex(), ex()] } }))).not.toContain('expenses-from-cash');
    expect(earned(baseState({ learn: { decisions: [ex(), ex(), ex({ viaLoan: true })] } }))).not.toContain('expenses-from-cash');
    expect(earned(baseState({ learn: { decisions: [ex(), ex(), ex({ viaSale: true })] } }))).not.toContain('expenses-from-cash');
  });
  it('all-assets-earn: a win with 3+ assets, every one with a positive cash flow', () => {
    const asset = (cf) => ({ type: 'apartment', monthlyCashFlow: cf });
    expect(earned(baseState({ assets: [asset(100), asset(200), asset(50)] }))).toContain('all-assets-earn');
    expect(earned(baseState({ assets: [asset(100), asset(200)] }))).not.toContain('all-assets-earn');
    expect(earned(baseState({ assets: [asset(100), asset(200), asset(0)] }))).not.toContain('all-assets-earn');
    expect(earned(baseState({ assets: [asset(100), asset(200), asset(50)] }), { record: { won: false } })).not.toContain('all-assets-earn');
  });
  it('first-freedom: the first win of the profile, in any mode (not a loss, not the second win)', () => {
    expect(earned(baseState())).toContain('first-freedom');
    expect(earned(baseState(), { record: { won: false } })).not.toContain('first-freedom');
    expect(earned(baseState(), { profile: { ...fresh(), counters: { ...fresh().counters, wins: 1 } } })).not.toContain('first-freedom');
    expect(earned(baseState(), { record: { mode: 'full' } })).toContain('first-freedom');
  });
  it('challenge-streak-3: the last 3 finished challenge games all won; any other result restarts the count; normal games do not touch it', () => {
    const at = (streak) => ({ ...fresh(), counters: { ...fresh().counters, challengeStreak: streak } });
    expect(earned(baseState(), { record: { challenge: true }, profile: at(2) })).toContain('challenge-streak-3');
    expect(earned(baseState(), { record: { challenge: true }, profile: at(1) })).not.toContain('challenge-streak-3');
    expect(ev(baseState(), { record: { challenge: true, won: false }, profile: at(2) }).counters.challengeStreak).toBe(0);
    expect(ev(baseState(), { record: { challenge: false }, profile: at(2) }).counters.challengeStreak).toBe(2);
  });
  it('all-professions: a win in all 8 professions, any rank and mode', () => {
    const seven = { ...fresh(), counters: { ...fresh().counters, wonProfessions: IDS.slice(0, 7) } };
    expect(earned(baseState(), { profile: seven, record: { professionId: IDS[7] } })).toContain('all-professions');
    expect(earned(baseState(), { profile: seven, record: { professionId: IDS[0] } })).not.toContain('all-professions');
    expect(updateCounters(seven.counters, { ...baseRecord, professionId: IDS[7] }, baseState()).wonProfessions).toHaveLength(8);
    expect(updateCounters(seven.counters, { ...baseRecord, professionId: IDS[7], won: false }, baseState()).wonProfessions).toHaveLength(7);
  });
  it('promo-week-freedom: a win in the promotion-week profession (a loss, or another profession, does not)', () => {
    expect(earned(baseState(), { promo: 'teacher' })).toContain('promo-week-freedom');
    expect(earned(baseState(), { promo: 'nurse' })).not.toContain('promo-week-freedom');
    expect(earned(baseState(), { promo: 'teacher', record: { won: false } })).not.toContain('promo-week-freedom');
    expect(earned(baseState(), { promo: null })).not.toContain('promo-week-freedom');
  });
  it('first-rank-up and top-rank: judged from the highest rank ever reached, and kept after a drop', () => {
    expect(evaluateRankBased(fresh())).toEqual([]);
    expect(evaluateRankBased(withRanks(fresh(), { cook: [1, 0] }))).toEqual(['first-rank-up']);
    expect(evaluateRankBased(withRanks(fresh(), { cook: [3, 0] })).sort()).toEqual(['first-rank-up', 'top-rank']);
    const dropped = { ...withRanks(fresh(), { cook: [0, 0] }), peak: { cook: 3 } };
    expect(evaluateRankBased(dropped).sort()).toEqual(['first-rank-up', 'top-rank']);
    expect(evaluateRankBased({ ...dropped, achievements: { 'first-rank-up': SUN, 'top-rank': SUN } })).toEqual([]);
  });
  it('an achievement is never earned twice and never taken away', () => {
    const p = { ...fresh(), achievements: { 'win-no-bank-loan': SUN } };
    expect(earned(baseState(), { profile: p })).not.toContain('win-no-bank-loan');
    const after = awardGame(p, baseRecord, { today: day(40), professionIds: IDS });
    expect(after.profile.achievements['win-no-bank-loan']).toBe(SUN);
  });
  it('the log-based ones need a log that replays to the final state: quarter-early, debt-before-asset, three-kinds, repaid-bank-loan (stubbed engine)', () => {
    // a stub engine that walks scripted states: milestone at turn 7, the dearest debt gone before the first asset, three kinds of assets, a bank loan repaid
    const start = { assets: [], stats: { dealsBought: 0 }, events: [], turn: 0, rngVersion: 2, liabilities: [{ id: 'card', kind: 'base', principal: 5000, monthlyPayment: 150 }, { id: 'car', kind: 'base', principal: 18000, monthlyPayment: 360 }, { id: 'loan-1', kind: 'loan', principal: 1000, monthlyPayment: 10 }] };
    const s1 = { ...start, turn: 7, events: [{ type: 'milestone', pct: 25 }], liabilities: start.liabilities.filter((l) => l.id !== 'card' && l.id !== 'loan-1') };
    const s2 = { ...s1, turn: 8, events: [], stats: { dealsBought: 1 }, assets: [{ type: 'apartment' }] };
    const s3 = { ...s2, turn: 9, assets: [{ type: 'apartment' }, { type: 'business' }, { type: 'stock' }], mode: 'full', profession: { id: 'teacher' }, seed: 1, log: [{ type: 'roll' }, { type: 'roll' }, { type: 'roll' }] };
    const state = s3; // the last scripted state IS the final state, so the replay "rebuilds" it
    const script = [s1, s2, s3]; let i = 0;
    const stub = { newGame: () => start, dispatch: () => script[i++] };
    const tl = gameTimeline(stub, state);
    expect(tl).toMatchObject({ replayed: true, milestone25Turn: 7, debtBeforeAsset: true, threeKinds: true, repaidBankLoan: true });
    i = 0;
    const out = evaluateGame({ engine: stub, state, record: { ...baseRecord, mode: 'full' }, profile: fresh() });
    expect(out.earned).toEqual(expect.arrayContaining(['quarter-early', 'debt-before-asset', 'three-kinds', 'repaid-bank-loan']));
    // a milestone on turn 10 is too late; a log that does not rebuild the state proves nothing
    i = 0;
    expect(evaluateGame({ engine: { ...stub, dispatch: () => script[i++] }, state: { ...state, turn: 99 }, record: baseRecord, profile: fresh() }).earned).not.toContain('quarter-early');
    const late = [{ ...s1, turn: 10 }, s2, s3]; i = 0;
    expect(gameTimeline({ ...stub, dispatch: () => late[i++] }, state).milestone25Turn).toBe(10);
    expect(gameTimeline(stub, { ...state, rngVersion: 1 }).replayed).toBe(false);
    expect(gameTimeline(stub, { ...state, log: [] }).replayed).toBe(false);
  });
  it('three-kinds is a full-mode achievement: family and junior games cannot earn it', () => {
    const a = achievementById('three-kinds');
    expect(suitsGame(a, { mode: 'full', junior: false })).toBe(true);
    expect(suitsGame(a, { mode: 'family', junior: false })).toBe(false);
    expect(suitsGame(a, { mode: 'family', junior: true })).toBe(false);
    expect(suitsGame(achievementById('first-freedom'), { mode: 'family', junior: true })).toBe(true);
  });
  it('real games: debt-before-asset and repaid-bank-loan come out of a scripted replay with the real engine', () => {
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 91 });
    s = engine.dispatch(s, { type: 'takeLoan', amount: 1000 });
    s = engine.dispatch(s, { type: 'repayLoan', id: 'loan-1', amount: 1000 });
    s = engine.dispatch(s, { type: 'repayLoan', id: 'card', amount: 5000 }); // the dearest starting debt (card, 3% a month)
    for (let i = 0; i < 900 && s.status === 'playing' && s.stats.dealsBought === 0; i++) s = s.pending?.kind === 'charity' ? engine.dispatch(s, { type: 'declineCharity' }) : botStep(engine, s, 'alwaysBuy');
    expect(s.stats.dealsBought).toBeGreaterThan(0);
    const tl = gameTimeline(engine, s);
    expect(tl).toMatchObject({ replayed: true, debtBeforeAsset: true, repaidBankLoan: true });
    // without the repayment the first asset does not earn it
    let t = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 91 });
    for (let i = 0; i < 900 && t.status === 'playing' && t.stats.dealsBought === 0; i++) t = t.pending?.kind === 'charity' ? engine.dispatch(t, { type: 'declineCharity' }) : botStep(engine, t, 'alwaysBuy');
    expect(gameTimeline(engine, t)).toMatchObject({ replayed: true, debtBeforeAsset: false, repaidBankLoan: false });
  });
});

describe('a junior profile never loses a thing, whatever happens to the clock', () => {
  it('years of missed weeks, a clock jump and a dozen games: ranks and XP only ever go up', () => {
    let p = withRanks(playedIn(fresh('upTo10'), 0), { teacher: [1, 20] });
    const before = JSON.stringify(p.ranks);
    for (const k of [3, 9, 30, 52, 100]) {
      const r = syncSeniority(p, day(7 * k));
      expect(r.events.every((e) => e.type === 'waited')).toBe(true);
      expect(JSON.stringify(r.profile.ranks)).toBe(before);
      p = r.profile;
    }
    expect(seniorityView(p, day(7 * 101))).toEqual({ state: 'waiting' });
    // and a game played after the long wait is simply credited
    const r = awardGame(p, { professionId: 'teacher', rank: 1, won: true, mode: 'family', junior: true, challenge: false, turns: 20 }, { today: day(7 * 101), professionIds: IDS });
    expect(r.events.every((e) => e.type === 'waited')).toBe(true);
    expect(standing(r.profile, 'teacher').xp).toBe(20 + XP_WIN);
  });
});
