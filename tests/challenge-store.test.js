// 0.5.1: the challenge save slot, the passivo.challenges store, the weekly board ranking and the link router.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, newMatch, botStep, encodeActionLog, serialize, deserialize, configOf, challengeKey, EngineError } from '../src/engine/index.js';
import { slotOf, createMatchStore, SLOT_CHALLENGE, SLOT_NORMAL, SLOT_DAILY, SLOT_MISSION } from '../src/services/match-store.js';
import { loadChallenges, saveChallenges, upsertEntry, findEntry, weekOf, boardRows, summaryOf } from '../src/services/challenge-store.js';
import { parseChallengeHash, routeChallenge } from '../src/services/challenge-route.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const cfg = { mode: 'family', professionId: 'teacher' };

describe('challenge save slot', () => {
  const m = newMatch(engine, { mode: 'family', seed: 12, players: [{ professionId: 'teacher', age: 'upTo10' }], challenge: { log: 'x', name: 'נועה', key: 'k' }, junior: false });
  it('a challenge match is one player on the challenge rules, junior from the link (not the age)', () => {
    expect(m.challenge).toEqual({ log: 'x', name: 'נועה', key: 'k' });
    expect(m.players[0].state.challenge).toBe(true);
    expect(m.junior).toBeUndefined(); // the receiver is 10 but the link was not junior
    const j = newMatch(engine, { mode: 'family', seed: 12, players: [{ professionId: 'teacher', age: '14plus' }], challenge: { log: 'x' }, junior: true });
    expect(j.junior).toBe(true);
    expect(j.players[0].state.junior).toBe(true);
    expect(() => newMatch(engine, { mode: 'family', seed: 1, players: [{ professionId: 'teacher' }, { professionId: 'cook' }], challenge: { log: 'x' } })).toThrow(EngineError);
  });
  it("slotOf: 'challengeSave' for a challenge; normal, daily and mission slots unchanged", () => {
    expect(SLOT_CHALLENGE).toBe('challengeSave');
    expect(slotOf(m)).toBe(SLOT_CHALLENGE);
    expect(slotOf({})).toBe(SLOT_NORMAL);
    expect(slotOf({ daily: { date: '2026-11-20' } })).toBe(SLOT_DAILY);
    expect(slotOf({ mission: { id: 'first-asset' } })).toBe(SLOT_MISSION);
  });
  it('saving and clearing a challenge never touches the other slots; it resumes from its own slot', () => {
    const disk = { save: 'N', dailySave: 'D', missionSave: 'M' };
    const store = createMatchStore({ write: (k, v) => { disk[k] = v; }, remove: (k) => { delete disk[k]; }, serialize });
    store.save(m);
    expect(disk).toMatchObject({ save: 'N', dailySave: 'D', missionSave: 'M' });
    const back = deserialize(disk.challengeSave);
    expect(back.challenge).toEqual(m.challenge);
    expect(back.players[0].state.challenge).toBe(true);
    store.clear(m);
    expect(disk).toEqual({ save: 'N', dailySave: 'D', missionSave: 'M' });
  });
});

describe('passivo.challenges store and the weekly board', () => {
  const mem = {};
  const io = { read: (k, f) => (k in mem ? JSON.parse(mem[k]) : f), write: (k, v) => { mem[k] = JSON.stringify(v); } };
  const won = (turns) => ({ ok: true, comparable: true, status: 'won', turns, freedomPct: 100 });
  const prog = (pct) => ({ ok: true, comparable: true, status: 'lost', turns: 30, freedomPct: pct });
  const now = new Date(2026, 10, 11, 12).getTime(); // Wednesday 11.11.2026
  const week = weekOf(now);
  it('the week runs Sunday 00:00 to Saturday 23:59:59 local time', () => {
    expect(new Date(week.start)).toEqual(new Date(2026, 10, 8, 0, 0, 0));
    expect(new Date(week.end + 1)).toEqual(new Date(2026, 10, 15, 0, 0, 0));
    expect(weekOf(new Date(2026, 10, 8, 0, 0, 1).getTime()).start).toBe(week.start);
    expect(weekOf(new Date(2026, 10, 14, 23, 59).getTime()).start).toBe(week.start);
  });
  it('upsert merges me / them and round-trips through storage', () => {
    let s = loadChallenges(io.read);
    s = upsertEntry(s, 'received', 'k1', { seed: 1, config: cfg, at: now, them: { link: 'L', name: 'נועה', result: won(23), at: now } });
    s = upsertEntry(s, 'received', 'k1', { me: { link: 'M', result: won(20), at: now } });
    saveChallenges(s, io.write);
    const back = loadChallenges(io.read);
    expect(findEntry(back, 'received', 'k1')).toMatchObject({ them: { name: 'נועה' }, me: { link: 'M' } });
    expect(findEntry(back, 'sent', 'k1')).toBe(null);
  });
  it('ranks per mode: turns first, then unfinished by %, ties share a rank, best result per person, this week only', () => {
    const e = (key, mode, me, them, name, at = now) => ({ key, role: 'received', config: { mode, professionId: 'teacher' }, me: me && { result: me, at }, them: them && { result: them, name, at } });
    const store = { entries: [
      e('a', 'family', won(20), won(18), 'נועה'),
      e('b', 'family', null, won(26), 'יואב'),
      e('c', 'family', null, prog(72), 'סבתא רותי'),
      e('d', 'family', null, won(30), 'נועה'), // worse than her 18: one row per person
      e('e', 'family', null, won(26), 'דנה'),
      e('f', 'full', won(28), prog(80), 'אבא'),
      e('g', 'family', null, won(10), 'ישן', week.start - 1), // last week
      e('h', 'family', null, { ...won(5), comparable: false }, 'לא הוגן'),
      e('i', 'family', null, { ok: false }, 'לא אומת'),
    ] };
    const rows = boardRows(store, week);
    expect(rows.family.map((r) => [r.rank, r.you ? 'you' : r.name, r.status === 'won' ? r.turns : `${r.pct}%`])).toEqual([
      [1, 'נועה', 18], [2, 'you', 20], [3, 'יואב', 26], [3, 'דנה', 26], [5, 'סבתא רותי', '72%'],
    ]);
    expect(rows.family.filter((r) => r.tie).length).toBe(2);
    expect(rows.full.map((r) => r.you ? 'you' : r.name)).toEqual(['you', 'אבא']);
  });
  it('summaryOf keeps no log or state', () => {
    expect(Object.keys(summaryOf({ ok: true, comparable: true, status: 'won', turns: 3, freedomPct: 100, stats: {}, log: {}, state: {} })).sort())
      .toEqual(['code', 'comparable', 'empty', 'freedomPct', 'ok', 'stats', 'status', 'turns']);
  });
});

describe('challenge link routing', () => {
  /** A bot game that declines every charity square (comparable: no bonus die). */
  const noCharity = (seed, extra = {}, bot = 'sensible') => {
    let st = engine.newGame({ ...cfg, seed, ...extra });
    for (let i = 0; i < 2000 && st.status === 'playing'; i++) st = st.pending?.kind === 'charity' ? engine.dispatch(st, { type: 'declineCharity' }) : botStep(engine, st, bot);
    return st;
  };
  const s = noCharity(61);
  const log = { rngVersion: 2, seed: 61, config: configOf(s), actions: s.log, name: 'נועה' };
  const text = encodeActionLog(log);
  const key = challengeKey(log);
  const verify = (x) => engine.verifyResult(x);
  const empty = { entries: [] };
  it('parses #c= and #r=, nothing else', () => {
    expect(parseChallengeHash(`#c=${text}`)).toEqual({ kind: 'challenge', text });
    expect(parseChallengeHash(`#r=${text}`)).toEqual({ kind: 'reply', text });
    for (const h of ['', '#', '#c=', '#x=abc', '#c=ab+c', `#c=${text}&x`]) expect(parseChallengeHash(h)).toBe(null);
  });
  it('a valid link opens the intro; a tampered, truncated or old-version link the error screen', () => {
    expect(routeChallenge({ link: { kind: 'challenge', text }, verify, store: empty })).toMatchObject({ screen: 'intro', verified: true, fresh: false, state: 'new', key });
    const flipped = text.slice(0, 20) + (text[20] === 'A' ? 'B' : 'A') + text.slice(21);
    expect(routeChallenge({ link: { kind: 'challenge', text: flipped }, verify, store: empty })).toMatchObject({ screen: 'error', variant: 'tampered' });
    expect(routeChallenge({ link: { kind: 'challenge', text: text.slice(0, 9) }, verify, store: empty })).toMatchObject({ screen: 'error' });
    const v1 = encodeActionLog({ ...log, rngVersion: 1 });
    expect(routeChallenge({ link: { kind: 'challenge', text: v1 }, verify, store: empty })).toMatchObject({ screen: 'error', variant: 'version' });
  });
  it('a non-comparable or seed-only log is a "new challenge, same game" intro', () => {
    const seedOnly = encodeActionLog({ ...log, actions: [] });
    expect(routeChallenge({ link: { kind: 'challenge', text: seedOnly }, verify, store: empty })).toMatchObject({ screen: 'intro', fresh: true });
  });
  it('a log that decodes but does not replay is still playable, unverified', () => {
    const bad = encodeActionLog({ ...log, actions: log.actions.slice(0, 5) });
    expect(routeChallenge({ link: { kind: 'challenge', text: bad }, verify, store: empty })).toMatchObject({ screen: 'intro', verified: false });
  });
  it('my own sent link: home + toast; a reply (#r= or #c=) to it: compare; a third person: intro', () => {
    const store = upsertEntry(empty, 'sent', key, { seed: 61, config: log.config, at: 1, me: { link: text, result: { ok: true } } });
    expect(routeChallenge({ link: { kind: 'challenge', text }, verify, store })).toEqual({ screen: 'own' });
    const b = noCharity(61, { challenge: true }, 'cautious');
    const reply = encodeActionLog({ rngVersion: 2, seed: 61, config: configOf(b), actions: b.log });
    for (const kind of ['reply', 'challenge']) expect(routeChallenge({ link: { kind, text: reply }, verify, store })).toMatchObject({ screen: 'compare', variant: 'reply' });
    expect(routeChallenge({ link: { kind: 'reply', text: reply }, verify, store: empty })).toMatchObject({ screen: 'intro' });
  });
  it('the same challenge in progress, another one in progress, an already played one', () => {
    const link = { kind: 'challenge', text };
    expect(routeChallenge({ link, verify, store: empty, saveKey: key })).toMatchObject({ state: 'continue' });
    expect(routeChallenge({ link, verify, store: empty, saveKey: 'other' })).toMatchObject({ state: 'pendingOther' });
    const played = upsertEntry(empty, 'received', key, { them: { link: text }, me: { result: { ok: true } } });
    expect(routeChallenge({ link, verify, store: played })).toMatchObject({ state: 'played' });
  });
});
