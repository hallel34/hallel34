// Compact action log (v0.5, docs/RNG.md): { rngVersion, seed, config, actions } <-> a base64url string for a link.
// Pure: no DOM. Layout (all integers are unsigned LEB128 varints):
//   'M' 'F'  format byte (1)  rngVersion  seed  flags (bit0 full mode, bit1 junior, bit2 daily date present)
//   string-table: count, then each string as (byte length, UTF-8 bytes)   professionId (table index)   [daily date (index)]
//   action count, then each action: 1 type byte (ACTION_CODES) + its arguments (strings are table indexes)
//   CRC32 (4 bytes, little endian) over every byte before it
// decode() refuses a bad header, version, type code, argument, length, trailing byte or checksum with an ActionLogError.
// The checksum catches a damaged or hand-edited link; the proof that a result is real is replaying the decoded log.

export class ActionLogError extends Error {}
const fail = (msg) => { throw new ActionLogError(msg); };

export const FORMAT_VERSION = 1;
const MAGIC = [0x4D, 0x46]; // 'MF'

/** One byte per action type. Never renumber: links in the wild carry these codes. */
export const ACTION_CODES = {
  roll: 1, armReroll: 2, chooseDeal: 3, guess: 4, buy: 5, pass: 6, renovate: 7, auctionWin: 8, acceptOffer: 9,
  declineOffer: 10, donate: 11, declineCharity: 12, takeLoan: 13, repayLoan: 14, sellAsset: 15, decide: 16,
  answerAudit: 17, forfeit: 18, debugForce: 19,
};
const TYPE_OF = Object.fromEntries(Object.entries(ACTION_CODES).map(([k, v]) => [v, k]));

const LIGHTS = [null, 'green', 'yellow', 'red'];
const GUESSES = ['good', 'bad', 'skip'];
const STYLES = [null, 'terrace', 'takeaway'];
const CORRECT = [null, true, false];
const OUTCOMES = ['win', 'lose'];
const MODES = ['family', 'full'];

// ---------- CRC32 (IEEE) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------- base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
export function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const left = bytes.length - i;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (left > 1 ? B64[(n >> 6) & 63] : '') + (left > 2 ? B64[n & 63] : '');
  }
  return out;
}
export function fromBase64Url(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str) || str.length % 4 === 1) fail('not a base64url action log');
  const bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const chunk = str.slice(i, i + 4);
    const n = [...chunk].reduce((acc, ch, k) => acc | (B64_INDEX[ch] << (18 - 6 * k)), 0);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return Uint8Array.from(bytes);
}

// ---------- writer / reader ----------
function writer() {
  const bytes = [];
  const w = {
    bytes,
    byte(b) { bytes.push(b & 0xFF); },
    uint(n) {
      if (!Number.isSafeInteger(n) || n < 0) fail(`not a non-negative integer: ${n}`);
      let x = n;
      while (x >= 0x80) { bytes.push((x % 0x80) | 0x80); x = Math.floor(x / 0x80); }
      bytes.push(x);
    },
  };
  return w;
}
function reader(bytes, end) {
  let at = 0;
  const r = {
    get at() { return at; },
    byte() { if (at >= end) fail('action log is truncated'); return bytes[at++]; },
    uint() {
      let n = 0; let mul = 1;
      for (let i = 0; i < 8; i++) {
        const b = r.byte();
        n += (b & 0x7F) * mul;
        if (!(b & 0x80)) { if (!Number.isSafeInteger(n)) fail('number out of range'); return n; }
        mul *= 0x80;
      }
      return fail('number too long');
    },
  };
  return r;
}

const strOf = (x, what) => (typeof x === 'string' && x.length ? x : fail(`${what} must be a non-empty string`));
const indexIn = (list, v, what) => { const i = list.indexOf(v ?? null); return i < 0 ? fail(`bad ${what}: ${v}`) : i; };
const pick = (list, i, what) => (i < list.length ? list[i] : fail(`bad ${what} code ${i}`));

/**
 * @param log { rngVersion, seed, config: { mode, professionId, junior?, daily?: { date } }, actions: [{ type, ...args }] }
 * @returns a base64url string
 */
export function encodeActionLog({ rngVersion, seed, config = {}, actions = [] }) {
  if (rngVersion !== 1 && rngVersion !== 2) fail(`unknown rng version ${rngVersion}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) fail(`bad seed ${seed}`);
  if (!Array.isArray(actions)) fail('actions must be an array');
  const strings = [];
  const ref = (s) => { let i = strings.indexOf(s); if (i < 0) { i = strings.length; strings.push(s); } return i; };
  const body = writer();
  const professionRef = ref(strOf(config.professionId, 'professionId'));
  const dateRef = config.daily ? ref(strOf(config.daily.date, 'daily date')) : null;
  body.uint(actions.length);
  for (const a of actions) {
    const code = ACTION_CODES[a?.type];
    if (!code) fail(`unknown action ${a?.type}`);
    body.byte(code);
    switch (a.type) {
      case 'roll': {
        const dice = a.dice ?? [];
        if (!Array.isArray(dice) || dice.some((x) => !Number.isInteger(x) || x < 1 || x > 6)) fail('bad forced dice');
        body.uint(dice.length); for (const x of dice) body.byte(x);
        break;
      }
      case 'buy': body.uint(a.qty ?? 1); break;
      case 'chooseDeal': body.uint(ref(strOf(a.cardId, 'cardId'))); break;
      case 'guess': body.uint(ref(strOf(a.cardId, 'cardId'))); body.byte(indexIn(LIGHTS, a.light, 'light') * 4 + indexIn(GUESSES, a.guess, 'guess')); break;
      case 'renovate': body.uint(ref(strOf(a.assetId, 'assetId'))); body.uint(a.level ?? 0); body.byte(indexIn(STYLES, a.style, 'style')); break;
      case 'auctionWin': body.uint(ref(JSON.stringify(a.card))); body.uint(a.price); break;
      case 'takeLoan': body.uint(a.amount); break;
      case 'repayLoan': body.uint(ref(strOf(a.id, 'id'))); body.uint(a.amount); break;
      case 'sellAsset': body.uint(ref(strOf(a.id, 'id'))); body.uint(a.qty == null ? 0 : a.qty + 1); break;
      case 'decide': body.uint(ref(strOf(a.option, 'option'))); break;
      case 'answerAudit': body.uint(a.questionId == null ? 0 : ref(strOf(a.questionId, 'questionId')) + 1); body.byte(indexIn(CORRECT, a.correct, 'correct')); break;
      case 'debugForce': body.byte(indexIn(OUTCOMES, a.outcome, 'outcome')); break;
      default: break; // no arguments
    }
  }
  const w = writer();
  for (const b of MAGIC) w.byte(b);
  w.byte(FORMAT_VERSION);
  w.uint(rngVersion);
  w.uint(seed);
  w.byte((config.mode === 'full' ? 1 : 0) | (config.junior ? 2 : 0) | (dateRef !== null ? 4 : 0));
  if (!MODES.includes(config.mode ?? 'family')) fail(`bad mode ${config.mode}`);
  const enc = new TextEncoder();
  w.uint(strings.length);
  for (const s of strings) {
    const b = enc.encode(s);
    w.uint(b.length);
    for (const x of b) w.byte(x);
  }
  w.uint(professionRef);
  if (dateRef !== null) w.uint(dateRef);
  for (const b of body.bytes) w.byte(b);
  const crc = crc32(w.bytes);
  for (let k = 0; k < 4; k++) w.byte((crc >>> (8 * k)) & 0xFF);
  return toBase64Url(Uint8Array.from(w.bytes));
}

/** The inverse of encodeActionLog. Throws ActionLogError on anything malformed or tampered with. */
export function decodeActionLog(text) {
  const bytes = fromBase64Url(text);
  if (bytes.length < MAGIC.length + 1 + 4) fail('action log is too short');
  const end = bytes.length - 4;
  const stored = (bytes[end] | (bytes[end + 1] << 8) | (bytes[end + 2] << 16) | (bytes[end + 3] << 24)) >>> 0;
  if (crc32(bytes.subarray(0, end)) !== stored) fail('action log checksum does not match (damaged or edited)');
  const r = reader(bytes, end);
  if (r.byte() !== MAGIC[0] || r.byte() !== MAGIC[1]) fail('not a MaxiFox action log');
  const format = r.byte();
  if (format !== FORMAT_VERSION) fail(`unknown action log format ${format}`);
  const rngVersion = r.uint();
  if (rngVersion !== 1 && rngVersion !== 2) fail(`unknown rng version ${rngVersion}`);
  const seed = r.uint();
  if (seed > 0xFFFFFFFF) fail('bad seed');
  const flags = r.byte();
  if (flags & ~7) fail('bad config flags');
  const dec = new TextDecoder('utf-8', { fatal: true });
  const count = r.uint();
  if (count > end) fail('bad string table length');
  const strings = [];
  for (let i = 0; i < count; i++) {
    const len = r.uint();
    if (r.at + len > end) fail('action log is truncated');
    const chunk = [];
    for (let k = 0; k < len; k++) chunk.push(r.byte());
    try { strings.push(dec.decode(Uint8Array.from(chunk))); } catch { fail('bad text in action log'); }
  }
  const str = () => { const i = r.uint(); return i < strings.length ? strings[i] : fail(`bad string reference ${i}`); };
  const config = { mode: flags & 1 ? 'full' : 'family', professionId: str() };
  if (flags & 2) config.junior = true;
  if (flags & 4) config.daily = { date: str() };
  const n = r.uint();
  if (n > end) fail('bad action count');
  const actions = [];
  for (let i = 0; i < n; i++) {
    const code = r.byte();
    const type = TYPE_OF[code] ?? fail(`unknown action code ${code}`);
    const a = { type };
    switch (type) {
      case 'roll': {
        const k = r.uint();
        if (k > 2) fail('bad forced dice');
        if (k) a.dice = Array.from({ length: k }, () => { const x = r.byte(); return x >= 1 && x <= 6 ? x : fail('bad die'); });
        break;
      }
      case 'buy': a.qty = r.uint(); break;
      case 'chooseDeal': a.cardId = str(); break;
      case 'guess': { a.cardId = str(); const b = r.byte(); a.light = pick(LIGHTS, b >> 2, 'light'); a.guess = pick(GUESSES, b & 3, 'guess'); break; }
      case 'renovate': { a.assetId = str(); a.level = r.uint(); const st = pick(STYLES, r.byte(), 'style'); if (st) a.style = st; break; }
      case 'auctionWin': { try { a.card = JSON.parse(str()); } catch (e) { if (e instanceof ActionLogError) throw e; fail('bad auction card'); } a.price = r.uint(); break; }
      case 'takeLoan': a.amount = r.uint(); break;
      case 'repayLoan': a.id = str(); a.amount = r.uint(); break;
      case 'sellAsset': { a.id = str(); const q = r.uint(); if (q) a.qty = q - 1; break; }
      case 'decide': a.option = str(); break;
      case 'answerAudit': {
        const q = r.uint();
        if (q) a.questionId = q - 1 < strings.length ? strings[q - 1] : fail(`bad string reference ${q - 1}`);
        const c = pick(CORRECT, r.byte(), 'correct');
        if (c !== null) a.correct = c;
        break;
      }
      case 'debugForce': a.outcome = pick(OUTCOMES, r.byte(), 'outcome'); break;
      default: break;
    }
    actions.push(a);
  }
  if (r.at !== end) fail('trailing bytes in action log');
  return { rngVersion, seed, config, actions };
}
