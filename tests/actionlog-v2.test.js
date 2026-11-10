// 0.5.1 action log format 2: the challenge flag (bit3) and the optional display name (bit4); format 1 links still decode.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, playGame, encodeActionLog, decodeActionLog, ActionLogError, FORMAT_VERSION, sanitizeDisplayName, NAME_MAX_CHARS } from '../src/engine/index.js';
import { crc32, toBase64Url, fromBase64Url } from '../src/engine/actionlog.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const config = { mode: 'family', professionId: 'teacher' };
const s = playGame(engine, engine.newGame({ ...config, seed: 77 }), 'sensible', 200);
const log = { rngVersion: 2, seed: 77, config, actions: s.log };
const seal = (body) => { const c = crc32(Uint8Array.from(body)); return toBase64Url(Uint8Array.from([...body, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255])); };

/** A format 1 link as v0.5 step 1 wrote it: the same bytes with format byte 1 (no bit3/bit4 then existed). */
const asFormat1 = (text) => { const b = [...fromBase64Url(text)].slice(0, -4); b[2] = 1; return seal(b); };

describe('action log format 2', () => {
  it('writes format 2', () => {
    expect(FORMAT_VERSION).toBe(2);
    expect(fromBase64Url(encodeActionLog(log))[2]).toBe(2);
  });
  it('round-trips the challenge flag and the display name; no extra fields when absent', () => {
    expect(decodeActionLog(encodeActionLog(log))).toEqual(log);
    const ch = { ...log, config: { ...config, challenge: true }, name: 'נועה' };
    expect(decodeActionLog(encodeActionLog(ch))).toEqual(ch);
    const junior = { ...log, config: { mode: 'family', professionId: 'cook', junior: true, challenge: true }, actions: [] };
    expect(decodeActionLog(encodeActionLog(junior))).toEqual(junior);
  });
  it('sanitizes the name: controls, bidi overrides, zero-width, spaces; at most 16 characters; empty = no name', () => {
    expect(sanitizeDisplayName('  סבתא‮  רותי​ ')).toBe('סבתא רותי');
    expect(sanitizeDisplayName('a\nb\tc')).toBe('a b c');
    expect(Array.from(sanitizeDisplayName('א'.repeat(40))).length).toBe(NAME_MAX_CHARS);
    expect(sanitizeDisplayName('😀'.repeat(20))).toBe('😀'.repeat(16)); // code points, never a half surrogate
    expect(decodeActionLog(encodeActionLog({ ...log, name: '  ‏ ' }))).toEqual(log);
    expect(decodeActionLog(encodeActionLog({ ...log, name: 'x'.repeat(30) })).name).toBe('x'.repeat(16));
  });
  it('refuses a resealed link whose name is not in sanitized form, or a challenge flag with a daily', () => {
    // build the bytes by hand: encode with a name, then swap the name's bytes for an unsanitized one of the same length
    const text = encodeActionLog({ ...log, name: 'abc' });
    const b = [...fromBase64Url(text)].slice(0, -4);
    const at = b.findIndex((x, i) => x === 97 && b[i + 1] === 98 && b[i + 2] === 99);
    b[at] = 0x0A; // '\nbc'
    expect(() => decodeActionLog(seal(b))).toThrow(/bad display name/);
    expect(() => encodeActionLog({ ...log, config: { ...config, challenge: true, daily: { date: '2026-11-20' } } })).toThrow(ActionLogError);
  });
  it('a junior link never carries a name: encode drops it, and decode ignores one in a crafted link (QA 0.5.1 P2-1)', () => {
    const jconfig = { mode: 'family', professionId: 'cook', junior: true };
    const j = { rngVersion: 2, seed: 77, config: jconfig, actions: [], name: 'נועה' };
    const text = encodeActionLog(j);
    expect(decodeActionLog(text)).toEqual({ rngVersion: 2, seed: 77, config: jconfig, actions: [] });
    expect(encodeActionLog({ ...j, name: '' })).toBe(text); // not a byte of the name is written
    // crafted: the bytes of a named family link with the junior bit set and a fresh checksum
    const b = [...fromBase64Url(encodeActionLog({ ...j, config: { mode: 'family', professionId: 'cook' }, name: 'ShouldNotShow' }))].slice(0, -4);
    b[b.indexOf(16, 3)] |= 2; // the flags byte (bit4 name present) gets bit1 junior
    const crafted = decodeActionLog(seal(b));
    expect(crafted.config.junior).toBe(true);
    expect(crafted.name).toBeUndefined();
  });
  it('decodes a format 1 link exactly as before (no challenge, no name)', () => {
    const v1 = asFormat1(encodeActionLog(log));
    expect(fromBase64Url(v1)[2]).toBe(1);
    expect(decodeActionLog(v1)).toEqual(log);
    expect(engine.replay(77, decodeActionLog(v1).config, decodeActionLog(v1).actions)).toEqual(s);
  });
  it('format 1 refuses the bits that only format 2 has', () => {
    const b = [...fromBase64Url(encodeActionLog({ ...log, config: { ...config, challenge: true } }))].slice(0, -4);
    b[2] = 1;
    expect(() => decodeActionLog(seal(b))).toThrow(/bad config flags/);
  });
  it('error codes: CRC for a damaged link, VERSION for another format, FORMAT otherwise', () => {
    const text = encodeActionLog(log);
    const b = [...fromBase64Url(text)]; b[5] ^= 4;
    expect(() => decodeActionLog(toBase64Url(Uint8Array.from(b)))).toThrow(expect.objectContaining({ code: 'CRC' }));
    const f3 = [...fromBase64Url(text)].slice(0, -4); f3[2] = 3;
    expect(() => decodeActionLog(seal(f3))).toThrow(expect.objectContaining({ code: 'VERSION' }));
    expect(() => decodeActionLog('a')).toThrow(expect.objectContaining({ code: 'FORMAT' }));
  });
});
