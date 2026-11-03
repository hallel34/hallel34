// Keyed, decision-independent randomness (rngVersion 2, docs/RNG.md). Pure: no DOM, no Date, no Math.random.
// Every random value is a function of (seed, purpose, a, b) only, never of a stream position. So a buy, a pass, a loan,
// a charity bonus die or a reroll never shifts a later die or card: two players on the same seed see the same dice on
// the same turn and the same card on the same deck tile and turn, whatever they decide.
// The hash is the daily challenge's (FNV-1a 32 bit + murmur3 fmix32), proven since v2.5; daily.js re-exports it.

/** Engine RNG versions. 1 = the single mulberry32 stream + shuffled deck arrays (saves up to v0.4). 2 = keyed values. */
export const RNG_V1 = 1;
export const RNG_V2 = 2;
export const RNG_VERSION = RNG_V2; // the version of every new normal game
/**
 * How rngVersion 2 deals cards (docs/RNG.md, "Card draws"): 'turn' = the card of deck D on turn t is keyed by (seed, D, t);
 * 'positional' = the n-th draw of D replays its keyed cycle. Saves do not record it, so it must never change once v2 games
 * exist in the wild (a change would need a new rngVersion).
 */
export const V2_DRAW_SCHEME = 'turn';

/** FNV-1a 32 bit over the UTF-16 code units, finished with a murmur-style avalanche. Stable across platforms. */
export function hashString(str) {
  let h = 0x811C9DC5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A uniform value in [0, 1) keyed by (seed, tag, i, k). The daily challenge's v1 streams use exactly this. */
export const unit = (seed, tag, i, k) => hashString(`${seed}|${tag}|${i}|${k}`) / 4294967296;

/** An integer in 0..n-1 keyed by (seed, purpose, a, b). */
export const keyedInt = (seed, purpose, a, b, n) => Math.floor(unit(seed, purpose, a, b) * n);

/** A Fisher-Yates permutation of `arr` keyed by (seed, purpose, a): the same key gives the same order. */
export function keyedShuffle(seed, purpose, a, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = keyedInt(seed, purpose, a, i, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- the keys of rngVersion 2 (one place, so the docs, the tests and the engine cannot drift) ----------
/** Die k of turn t (k = 0 the first die, k = 1 the charity bonus die of the same turn), 1-6. */
export const v2Die = (seed, turn, k) => 1 + keyedInt(seed, 'dice', turn, k, 6);
/** Die k of the second set an armed reroll token rolls on turn t, 1-6. */
export const v2RerollDie = (seed, turn, k) => 1 + keyedInt(seed, 'reroll', turn, k, 6);
/** The tax-audit question pick of turn t (0..n-1). */
export const v2AuditPick = (seed, turn, n) => keyedInt(seed, 'audit', turn, 0, n);
/** The order the eligible cards of `deck` are walked in on turn t (turn-keyed draws, the chosen option). */
export const v2DeckOrder = (seed, deck, turn, ids) => keyedShuffle(seed, `deck:${deck}`, turn, ids);
/** The order of cycle c of `deck` (positional draws: the measured alternative, docs/RNG.md). */
export const v2DeckCycle = (seed, deck, cycle, ids) => keyedShuffle(seed, `deck:${deck}:cycle`, cycle, ids);

/** The profession of a bot seat (UI setup): derived from the match seed and the seat, so a seed replays the same table. */
export const botProfessionId = (seed, seat, ids) => ids[keyedInt(seed, 'botProfession', seat, 0, ids.length)];

/** JSON with sorted object keys (a stable text of a state, whatever order its keys were written in). */
export function stableStringify(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const keys = Object.keys(x).filter((k) => x[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(x[k])}`).join(',')}}`;
}

/**
 * A stable 32-bit digest of a game state (replay checks). Left out: `events` (the last action's UI feed) and the learn
 * record's presentation flags `learn.shown` / `learn.concepts` (the UI marks a note or a glossary card as seen without an
 * action; no rule reads them), so a game played on screen and its replay hash the same.
 */
export function stateHash(state) {
  const { events, ...rest } = state ?? {};
  if (rest.learn) { const { shown, concepts, ...learn } = rest.learn; rest.learn = learn; }
  return hashString(stableStringify(rest));
}
