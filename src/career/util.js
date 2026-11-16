import { stateHash } from '../engine/rng.js';
/** stateHash of a state, or null when it cannot be hashed. */
export const stateHashSafe = (s) => { try { return stateHash(s); } catch { return null; } };
