// 0.5.1 challenge copy (docs/v051/challenges-copy.md §1): full mode = challenge.<key>; family = the override layer on top
// (t() applies it); junior viewer = challenge.<key>Junior when it exists, else the family string.
import { t, tp, rawString } from '../../i18n/index.js';
import { readRaw } from '../../services/storage.js';
import { cleanAge, JUNIOR_AGE } from '../../engine/index.js';

let juniorView = false;
/** The viewer's age band decides kid words and coins on the challenge screens (spec §7), not the link. */
export const setJuniorView = (on) => { juniorView = !!on; };
export const isJuniorView = () => juniorView;
/** This device's last chosen age band (the players screen / the intro's age row), or null. */
export const viewerAge = () => cleanAge(readRaw('lastAge'));
export const viewerIsJunior = () => viewerAge() === JUNIOR_AGE;

/** The full i18n key a challenge string resolves to for this viewer (the Junior sibling when there is one). */
export function ckey(key) {
  const k = `challenge.${key}`;
  return juniorView && rawString(`${k}Junior`, 'he') !== undefined ? `${k}Junior` : k;
}
export const ct = (key, params) => t(ckey(key), params);
/** "אצל נועה" / "במשחק מהקישור" (junior: "במשחק ששלחו לכם"): gender-free, the name never takes a verb. */
export const themPhrase = (name) => (name ? ct('them.named', { name }) : ct('them.anon'));
export const modeLabel = (config) => ct(`mode.${config?.junior ? 'junior' : config?.mode === 'full' ? 'full' : 'family'}`);
export const turnsIn = (n) => tp('plural.turnsIn', n);

/** The base URL of this app (works under a Pages sub-path) + the challenge hash. */
export const linkUrl = (text, kind = 'c') => `${new URL('.', globalThis.location?.href ?? 'http://localhost/').href}#${kind}=${text}`;

/**
 * The text a link is sent with.
 * @param kind 'invite' (a new challenge) | 'reply' (my answer to one)
 * @param fresh invite: my game had the bonus die / a reroll (seed only); reply: the challenge I answer was such a "fresh" one
 */
export function shareMessage({ kind = 'invite', fresh = false, result, name = '', config, url }) {
  const won = result?.status === 'won';
  const params = { turns: turnsIn(result?.turns ?? 0), pct: result?.freedomPct ?? 0, mode: modeLabel(config), url, name };
  const named = name ? 'Named' : '';
  if (kind === 'invite') return ct(fresh ? `invite.fresh${named}` : `invite.${won ? 'win' : 'progress'}${named}`, params);
  return ct(`reply.${won ? 'win' : 'progress'}${fresh ? 'Fresh' : ''}${named}`, params);
}

export { t };
