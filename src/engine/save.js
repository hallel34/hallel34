// Save/load: JSON with schemaVersion and migrations. Storage itself is the UI's job.
// Schema 2 saves a whole match (1-4 players). Schema 1 saves were one bare game state: they load as a one-player match.
import { SCHEMA_VERSION, MILESTONES } from './config.js';
import { emptyTaxAudit } from './engine.js';
import { matchFromState } from './match.js';
import { emptyLearn } from './learn.js';
import { loanRate, passiveRatio } from './selectors.js';

const safeRatio = (st) => { try { return passiveRatio(st); } catch { return 0; } };

// Each step lifts a save by exactly one schema version.
const migrations = {
  // 1 -> 2: a bare single-player state becomes a one-player match
  1: (s) => ({ ...matchFromState(s), schemaVersion: 2 }),
  // 2 -> 3: every player's state gets an empty learning record (old games have no decisions to report on)
  2: (m) => ({
    ...m,
    schemaVersion: 3,
    players: Array.isArray(m.players)
      ? m.players.map((p) => (p?.state ? { ...p, state: { ...p.state, schemaVersion: 3, learn: p.state.learn ?? emptyLearn() } } : p))
      : m.players,
  }),
  // 3 -> 4 (v3 phase 3 economy): every player's state gets `lap` and `effects`. The laps of an old game cannot be rebuilt from
  // its turns, so lap starts at 0 (its new deals start inflating from the load on); there are no timed effects yet.
  3: (m) => ({
    ...m,
    schemaVersion: 4,
    players: Array.isArray(m.players)
      ? m.players.map((p) => (p?.state ? {
        ...p, state: { ...p.state, schemaVersion: 4, lap: Number.isInteger(p.state.lap) ? p.state.lap : 0, effects: Array.isArray(p.state.effects) ? p.state.effects : [] },
      } : p))
      : m.players,
  }),
  // 4 -> 5 (v4 stage 4): every player's state gets `milestones` (the 25 / 50% celebrations already shown) and `taxAudit`
  // (quiz points). A loaded game marks the milestones it has already passed as shown, so a resume never replays them.
  4: (m) => ({
    ...m,
    schemaVersion: 5,
    players: Array.isArray(m.players)
      ? m.players.map((p) => (p?.state ? {
        ...p,
        state: {
          ...p.state,
          schemaVersion: 5,
          milestones: Array.isArray(p.state.milestones) ? p.state.milestones : MILESTONES.filter((pct) => safeRatio(p.state) * 100 >= pct),
          taxAudit: p.state.taxAudit && Array.isArray(p.state.taxAudit.asked) ? p.state.taxAudit : emptyTaxAudit(),
        },
      } : p))
      : m.players,
  }),
};

export function serialize(match) {
  return JSON.stringify({ ...match, schemaVersion: SCHEMA_VERSION });
}

/** Returns a match, or null for corrupt / too-new / unknown saves. */
export function deserialize(json) {
  let s;
  try { s = JSON.parse(json); } catch { return null; }
  if (!s || typeof s !== 'object' || typeof s.schemaVersion !== 'number') return null;
  if (s.schemaVersion > SCHEMA_VERSION) return null;
  while (s.schemaVersion < SCHEMA_VERSION) {
    const m = migrations[s.schemaVersion];
    if (!m) return null;
    s = m(s);
  }
  if (!Array.isArray(s.players) || !s.players.length || s.players.some((p) => !p?.state?.profession)) return null;
  // Bank loans from before the 1%/month rule have no `rate`: stamp the one their payment implies (10% back then), so a
  // loan is always labelled with its own rate.
  for (const p of s.players) {
    for (const l of Array.isArray(p.state.liabilities) ? p.state.liabilities : []) {
      if (l?.kind === 'loan' && !Number.isFinite(l.rate)) l.rate = loanRate(l);
    }
  }
  return s;
}
