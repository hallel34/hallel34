// 0.5.0 career: the rules the owner may still change are single config values (src/engine/config.js). Each is exercised by loading
// the career module with a different value: one drop per return, a drop every two missed weeks, protection up to 13, the warning day.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { addDays, weekNumber } from '../src/daily/calendar.js';

const SUN = '2026-11-08';
const W = weekNumber(SUN);
const day = (n) => addDays(SUN, n);

async function career(overrides) {
  vi.resetModules();
  vi.doMock('../src/engine/config.js', async (orig) => ({ ...(await orig()), ...overrides }));
  return import('../src/career/career.js');
}
afterEach(() => { vi.doUnmock('../src/engine/config.js'); vi.resetModules(); });

const profile = (age = '14plus') => ({
  id: 'p1', name: 'א', age, fox: null, since: SUN, games: 1, ranks: { teacher: { rank: 3, xp: 0 }, nurse: { rank: 2, xp: 5 } }, peak: { teacher: 3, nurse: 2 },
  lastPlayWeek: W, settledWeek: W - 1, missed: 0, achievements: {}, counters: { badPasses: 0, challengeStreak: 0, wins: 0, wonProfessions: [] },
});

describe('CAREER_MAX_DROPS_PER_RETURN (default: unlimited)', () => {
  it('the default drops once per further missed week', async () => {
    const c = await career({});
    const r = c.syncSeniority(profile(), day(7 * 5)); // weeks W+1..W+4 missed: reset, drop, drop, drop
    expect(r.events.filter((e) => e.type === 'drop')).toHaveLength(3);
    expect(r.profile.ranks.teacher.rank).toBe(0);
  });
  it('1 = at most one drop per return, however long the absence', async () => {
    const c = await career({ CAREER_MAX_DROPS_PER_RETURN: 1 });
    const r = c.syncSeniority(profile(), day(7 * 9));
    expect(r.events.filter((e) => e.type === 'drop')).toHaveLength(1);
    expect(r.profile.ranks).toEqual({ teacher: { rank: 2, xp: 0 }, nurse: { rank: 1, xp: 0 } });
  });
});

describe('SENIORITY_COUNT_AFTER_DROP', () => {
  it('0 = after a drop the count restarts: the next missed week only resets, a drop needs two more', async () => {
    const c = await career({ SENIORITY_COUNT_AFTER_DROP: 0 });
    const r = c.syncSeniority(profile(), day(7 * 5)); // reset, drop, reset, drop
    expect(r.events.map((e) => e.type)).toEqual(['reset', 'drop', 'reset', 'drop']);
    expect(r.profile.ranks.teacher.rank).toBe(1);
  });
});

describe('CAREER_PROTECTED_AGE: widening to 13 is one line', () => {
  it("'11to13' protects 11-13 as well; 14+ still loses", async () => {
    const c = await career({ CAREER_PROTECTED_AGE: '11to13' });
    expect(c.isProtectedAge('upTo10')).toBe(true);
    expect(c.isProtectedAge('11to13')).toBe(true);
    expect(c.isProtectedAge('14plus')).toBe(false);
    expect(c.syncSeniority(profile('11to13'), day(7 * 9)).events.every((e) => e.type === 'waited')).toBe(true);
    expect(c.syncSeniority(profile('14plus'), day(7 * 9)).events.length).toBeGreaterThan(0);
  });
});

describe('the warning weekday and the deadline weekday', () => {
  it('Thursday and Saturday by default; Wednesday and Friday when configured (days count to the deadline)', async () => {
    const d = await career({});
    const p = { ...profile(), lastPlayWeek: W, settledWeek: W - 1 };
    expect(d.seniorityView(p, day(7 + 4))).toEqual({ state: 'warn', days: 3, rank: false });
    const f = await career({ CAREER_WARN_FROM_WEEKDAY: 3, CAREER_DEADLINE_WEEKDAY: 5 });
    expect(f.seniorityView(p, day(7 + 3))).toEqual({ state: 'warn', days: 3, rank: false }); // Wednesday: Wed, Thu, Fri
    expect(f.seniorityView(p, day(7 + 2))).toMatchObject({ state: 'open', days: 4 });
    expect(f.seniorityView(p, day(7 + 6))).toEqual({ state: 'warn', days: 1, rank: false }); // Saturday: never below 1
  });
});
