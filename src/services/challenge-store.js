// 0.5.1 friend challenges on this device: the `passivo.challenges` store (no server). Each entry is one challenge game
// (seed + rules config = challengeKey):
//   { key, role: 'sent' | 'received', seed, config, at,
//     me:   { link, name, result, at } | null      — this device's own finished game (its link text and verified summary)
//     them: { link, name, result, at, fresh } | null — the other side: the creator (received) or the reply (sent) }
// `result` is the compact summary of verifyResult: { ok, comparable, status, turns, freedomPct, stats }.
// The weekly family board (spec §6) reads these entries; home never does (Lighthouse).
import { readJSON, writeJSON } from './storage.js';

export const CHALLENGES_KEY = 'challenges';
export const MAX_ENTRIES = 80;
/** The creator's last typed display name (prefills the create sheet). */
export const NAME_KEY = 'challengeName';

/** The part of a verifyResult worth keeping (no log, no state). */
export const summaryOf = (v) => (v ? {
  ok: !!v.ok, comparable: !!v.comparable, empty: !!v.empty, status: v.status ?? null, turns: v.turns ?? 0, freedomPct: v.freedomPct ?? 0,
  stats: v.stats ? { ...v.stats } : null, code: v.code ?? null,
} : null);

export function loadChallenges(read = readJSON) {
  const raw = read(CHALLENGES_KEY, null);
  const entries = Array.isArray(raw?.entries) ? raw.entries.filter((e) => e && typeof e.key === 'string' && (e.role === 'sent' || e.role === 'received')) : [];
  return { v: 1, entries };
}
export function saveChallenges(store, write = writeJSON) {
  const entries = [...store.entries].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, MAX_ENTRIES);
  write(CHALLENGES_KEY, { v: 1, entries });
}

export const findEntry = (store, role, key) => store.entries.find((e) => e.role === role && e.key === key) ?? null;

/** Inserts or merges the entry of (role, key); `patch` fields replace the stored ones (me / them merge shallowly). */
export function upsertEntry(store, role, key, patch) {
  const old = findEntry(store, role, key);
  const next = {
    ...(old ?? { key, role, me: null, them: null }), ...patch, key, role,
    me: patch.me === undefined ? old?.me ?? null : patch.me && { ...(old?.me ?? {}), ...patch.me },
    them: patch.them === undefined ? old?.them ?? null : patch.them && { ...(old?.them ?? {}), ...patch.them },
  };
  return { ...store, entries: [next, ...store.entries.filter((e) => e !== old)] };
}

// ---------- the week (Sunday 00:00 to Saturday 23:59:59, local time) ----------
export function weekOf(now) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() - 1 };
}

/**
 * The board rows of a week, ranked per mode (spec §6.2, decision 2026-11-09 (4)): finishers by turns (ascending), then unfinished
 * games by freedom % (descending); equal results share a rank. One row per person (typed name + profession; "you" = this
 * device), their best verified, comparable result of the week. Junior ranks inside family.
 * @returns { family: rows, full: rows }, row = { id, you, name, professionId, mode, junior, status, turns, pct, key, rank, tie }
 */
export function boardRows(store, week) {
  const inWeek = (at) => Number.isFinite(at) && at >= week.start && at <= week.end;
  const best = new Map();
  const consider = (row) => {
    const old = best.get(row.id);
    if (!old || better(row, old) < 0) best.set(row.id, row);
  };
  for (const e of store.entries) {
    const mode = e.config?.mode === 'full' ? 'full' : 'family';
    const base = { mode, junior: !!e.config?.junior, professionId: e.config?.professionId ?? null, key: e.key, role: e.role };
    for (const side of ['me', 'them']) {
      const x = e[side];
      const r = x?.result;
      if (!x || !r?.ok || !r.comparable || r.empty || !inWeek(x.at)) continue;
      const you = side === 'me';
      const name = you ? null : (x.name || null);
      consider({ ...base, id: you ? `you|${mode}` : `${name ?? ''}|${base.professionId}|${mode}`, you, name, status: r.status, turns: r.turns, pct: r.freedomPct });
    }
  }
  const out = { family: [], full: [] };
  for (const row of best.values()) out[row.mode].push(row);
  for (const list of Object.values(out)) {
    list.sort(better);
    list.forEach((row, i) => {
      const prev = list[i - 1];
      row.rank = prev && better(row, prev) === 0 ? prev.rank : i + 1;
    });
    list.forEach((row) => { row.tie = list.filter((x) => x.rank === row.rank).length > 1; });
  }
  return out;
}
/** < 0 when a ranks above b (spec §4.1 order). */
export function better(a, b) {
  const aw = a.status === 'won';
  const bw = b.status === 'won';
  if (aw !== bw) return aw ? -1 : 1;
  if (aw) return a.turns - b.turns;
  return b.pct - a.pct;
}
