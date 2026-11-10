// 0.5.1: where a challenge link opens (spec §2.4). Pure: the caller passes the verifier and what the device has stored.
import { challengeKey } from '../engine/challenge.js';
import { findEntry } from './challenge-store.js';

/** '#c=<log>' (a challenge) or '#r=<log>' (a reply to one), else null. */
export function parseChallengeHash(hash) {
  const m = /^#(c|r)=([A-Za-z0-9_-]+)$/.exec(String(hash ?? '').trim());
  return m ? { kind: m[1] === 'r' ? 'reply' : 'challenge', text: m[2] } : null;
}

/** The error screen's variant for a failed decode / refused log (spec §2.4 c, c1, c2). */
export const errorVariant = (code) => (code === 'CRC' ? 'tampered' : code === 'VERSION' ? 'version' : 'invalid');

/**
 * @param link     parseChallengeHash() result
 * @param verify   (text) => verifyResult
 * @param store    loadChallenges()
 * @param saveKey  challengeKey of the challenge game in progress (challengeSave), or null
 * @returns one of
 *   { screen: 'error', variant, code }
 *   { screen: 'own' }                                     my own sent link, no reply yet (g)
 *   { screen: 'compare', variant: 'reply', entry, them }  a reply to my sent challenge (f2)
 *   { screen: 'intro', them, key, fresh, verified, state: 'new' | 'continue' | 'pendingOther' | 'played', entry }
 */
export function routeChallenge({ link, verify, store, saveKey = null }) {
  const v = verify(link.text);
  // only a log that decoded and is a v2, non-daily, auction-free game is playable; a failed replay still is (2.4 d)
  if (!v.log || ['VERSION', 'DAILY', 'AUCTION'].includes(v.code)) return { screen: 'error', variant: errorVariant(v.code), code: v.code ?? 'FORMAT' };
  const key = challengeKey(v.log);
  const sent = findEntry(store, 'sent', key);
  if (sent) {
    if (sent.me?.sentLink === link.text || sent.me?.link === link.text) return { screen: 'own' };
    return { screen: 'compare', variant: 'reply', entry: sent, them: v, key };
  }
  const entry = findEntry(store, 'received', key);
  if (entry?.me?.link && (entry.me.link === link.text || entry.me.sentLink === link.text)) return { screen: 'own' }; // my own reply link
  const fresh = !!v.ok && !v.comparable;
  let state = 'new';
  if (saveKey === key) state = 'continue';
  else if (entry?.me?.result && entry.them?.link === link.text) state = 'played';
  else if (saveKey) state = 'pendingOther';
  return { screen: 'intro', them: v, key, fresh, verified: !!v.ok, state, entry };
}

/** A challenge URL longer than this is sent as the seed-only "אתגר חדש באותו משחק" link (QA 0.5.1 P2-4; the plan's ceiling is 2,000). */
export const LINK_MAX = 1800;
/** The longest display name a link can carry (16 two-byte letters): the guard measures with it, so no typed name can tip it over. */
export const LONGEST_NAME = '\u05D0'.repeat(16); // 16 two-byte letters (alef): never shown, only measured
/**
 * The link kind to send: 'link' (the whole game) unless its URL would pass LINK_MAX, then 'fresh' (seed + config only, the existing
 * fallback for non-comparable games). false stays false.
 * @param urlOf (kind) => the full URL with the hash for that kind, built with LONGEST_NAME
 */
export function guardLinkKind(kind, urlOf, max = LINK_MAX) {
  if (kind !== 'link') return kind;
  return urlOf('link').length > max ? 'fresh' : 'link';
}
