// One attempt per day: finishing the day's game or giving it up consumes the attempt. Pure (storage is store.js).
import { dailyResult } from '../engine/daily.js';
import { buildReport } from '../engine/learn.js';
import { recordPlay, newBadges } from './streak.js';

export const RESULTS_SCHEMA = 1;
export const KEEP_DAYS = 60; // finished days kept on the device (older ones are dropped)

export const emptyResults = () => ({ v: RESULTS_SCHEMA, byDate: {} });

const fin = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** A stored entry repaired field by field, so the daily card and the result screen never throw. null = not an entry at all. */
export function sanitizeEntry(e, date) {
  if (!e || typeof e !== 'object' || !e.record || typeof e.record !== 'object' || e.record.date !== date) return null;
  const r = e.record;
  const turns = Number.isInteger(r.turns) && r.turns >= 0 ? r.turns : null;
  const g = e.green && typeof e.green === 'object' ? e.green : null;
  const kinds = ['all', 'none', 'some', 'noData'];
  const green = g && Number.isInteger(g.green) && Number.isInteger(g.total) && g.green >= 0 && g.total >= g.green && kinds.includes(g.kind)
    ? { green: g.green, total: g.total, kind: g.kind } : { green: 0, total: 0, kind: 'noData' };
  return {
    v: RESULTS_SCHEMA,
    record: {
      date, seed: fin(r.seed, 0), turns, netWorth: fin(r.netWorth, 0), professionId: typeof r.professionId === 'string' ? r.professionId : '',
      mode: typeof r.mode === 'string' ? r.mode : 'family', actionsLog: Array.isArray(r.actionsLog) ? r.actionsLog : [],
    },
    outcome: ['won', 'gaveUp', 'failed'].includes(e.outcome) ? e.outcome : turns == null ? 'failed' : 'won',
    lights: typeof e.lights === 'string' ? e.lights.replace(/[^gyrn]/g, '').slice(0, 200) : '',
    green,
  };
}

export function parseResults(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== RESULTS_SCHEMA || !raw.byDate || typeof raw.byDate !== 'object') return emptyResults();
  const byDate = {};
  for (const [k, e] of Object.entries(raw.byDate)) {
    const clean = /^\d{4}-\d{2}-\d{2}$/.test(k) ? sanitizeEntry(e, k) : null;
    if (clean) byDate[k] = clean;
  }
  return { v: RESULTS_SCHEMA, byDate };
}

/** 'done' (finished or given up), 'playing' (a saved game of today exists) or 'new'. */
export function dailyStatus({ results, hasSave }, today) {
  if (parseResults(results).byDate[today]) return 'done';
  return hasSave ? 'playing' : 'new';
}
/** A second attempt is never offered. */
export const canStartDaily = (status) => status === 'new';

/** Traffic light of one decision: 'g' | 'y' | 'r' | null (not rated). */
export function decisionLight(x) {
  if (x.kind === 'buy') return x.tier === 'good' ? 'g' : x.tier === 'ok' ? 'y' : x.tier === 'bad' || x.tier === 'trap' ? 'r' : null;
  if (x.kind === 'pass') return x.green === true ? 'g' : x.green === false ? 'r' : null;
  if (x.kind === 'loan') return x.rating === 'costly' ? 'r' : x.rating === 'sensible' ? 'g' : null;
  if (x.kind === 'expense') return x.viaLoan || x.viaSale ? 'y' : null;
  return null;
}
const RANK = { r: 3, y: 2, g: 1 };

/**
 * One character per turn played: the worst light among the turn's decisions ('g' < 'y' < 'r'), 'n' when nothing was rated.
 * It reveals neither cards nor choices, only how the turn went.
 */
export function turnLights(state, turns = state.turn) {
  const out = [];
  for (let turn = 1; turn <= turns; turn++) {
    let worst = null;
    for (const x of state.learn?.decisions ?? []) {
      if (x.turn !== turn || x.derived) continue;
      const l = decisionLight(x);
      if (l && (!worst || RANK[l] > RANK[worst])) worst = l;
    }
    out.push(worst ?? 'n');
  }
  return out.join('');
}

/**
 * The finished (or given-up) daily game becomes a stored entry. Nothing happens when the day already has one.
 * Returns { results, streak, entry, newBadges, fresh }.
 */
export function completeAttempt({ results, streak }, state) {
  const prev = parseResults(results);
  const record = dailyResult(state);
  if (prev.byDate[record.date]) return { results: prev, streak, entry: prev.byDate[record.date], newBadges: [], fresh: false };
  const entry = {
    v: RESULTS_SCHEMA,
    record,
    outcome: state.status === 'won' ? 'won' : state.daily.gaveUp ? 'gaveUp' : 'failed',
    lights: turnLights(state),
    green: buildReport(state).green,
  };
  const byDate = { ...prev.byDate, [record.date]: entry };
  const keys = Object.keys(byDate).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete byDate[k];
  const nextStreak = recordPlay(streak, record.date);
  return { results: { v: RESULTS_SCHEMA, byDate }, streak: nextStreak, entry, newBadges: newBadges(streak, nextStreak), fresh: true };
}
