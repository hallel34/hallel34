// v0.5 compact action log (src/engine/actionlog.js): round trip, size, and refusal of damaged / tampered logs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, encodeActionLog, decodeActionLog, ActionLogError, ACTION_CODES, playGame, botStep,
} from '../src/engine/index.js';
import { crc32, toBase64Url, fromBase64Url } from '../src/engine/actionlog.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const data = { professions: read('professions.he.json'), cards: read('cards.he.json') };
const engine = createEngine(data);

const sample = () => {
  const config = { mode: 'full', professionId: 'engineer' };
  const s = playGame(engine, engine.newGame({ ...config, seed: 4242 }), 'sensible', 200);
  return { rngVersion: s.rngVersion, seed: 4242, config, actions: s.log, state: s };
};
/** Re-encodes raw bytes with a fresh checksum (a tamperer who knows the format). */
const reseal = (bytes) => {
  const body = bytes.slice(0, bytes.length - 4);
  const c = crc32(body);
  return toBase64Url(Uint8Array.from([...body, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255]));
};

describe('action log: encode / decode', () => {
  it('round-trips every action type and argument', () => {
    const actions = [
      { type: 'roll' }, { type: 'armReroll' }, { type: 'chooseDeal', cardId: 'opp-apt-004' },
      { type: 'guess', cardId: 'opp-apt-004', light: 'green', guess: 'good' }, { type: 'guess', cardId: 'opp-biz-002', light: null, guess: 'skip' },
      { type: 'buy', qty: 1 }, { type: 'buy', qty: 250 }, { type: 'pass' }, { type: 'renovate', assetId: 'asset-3', level: 2, style: 'terrace' },
      { type: 'renovate', assetId: 'asset-3', level: 1 }, { type: 'auctionWin', card: { id: 'opp-apt-001', type: 'apartment', mortgage: 1, title: 'דירה' }, price: 12000 },
      { type: 'acceptOffer' }, { type: 'declineOffer' }, { type: 'donate' }, { type: 'declineCharity' }, { type: 'takeLoan', amount: 25000 },
      { type: 'repayLoan', id: 'loan-7', amount: 1000 }, { type: 'sellAsset', id: 'asset-2' }, { type: 'sellAsset', id: 'asset-5', qty: 0 },
      { type: 'decide', option: 'pass' }, { type: 'answerAudit' }, { type: 'answerAudit', questionId: 'tax-3', correct: false },
      { type: 'forfeit' },
    ];
    expect(new Set(actions.map((a) => a.type))).toEqual(new Set(Object.keys(ACTION_CODES).filter((t) => t !== 'debugForce')));
    for (const config of [{ mode: 'full', professionId: 'lawyer' }, { mode: 'family', professionId: 'cook', junior: true }, { mode: 'family', professionId: 'nurse', daily: { date: '2026-11-20' } }]) {
      const log = { rngVersion: 2, seed: 4294967295, config, actions };
      const text = encodeActionLog(log);
      expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeActionLog(text)).toEqual(log);
    }
  });
  it('a decoded bot game replays to the same final state', () => {
    const { state, ...log } = sample();
    const back = decodeActionLog(encodeActionLog(log));
    expect(engine.replay(back.seed, back.config, back.actions)).toEqual(state);
  });
  it('a whole game fits in a short link (far under 2,000 characters)', () => {
    const { state, ...log } = sample();
    expect(state.status).not.toBe('playing');
    expect(encodeActionLog(log).length).toBeLessThan(600);
  });
  it('base64url is exact for every length', () => {
    for (let n = 0; n < 40; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect([...fromBase64Url(toBase64Url(b))]).toEqual([...b]);
    }
  });
});

describe('action log: malformed or tampered logs are refused with an ActionLogError', () => {
  const { state, ...log } = sample();
  const good = encodeActionLog(log);
  const bytes = () => [...fromBase64Url(good)];
  const refuse = (text, msg) => expect(() => decodeActionLog(text)).toThrow(msg ? new RegExp(msg) : ActionLogError);
  it('any flipped byte breaks the checksum', () => {
    for (let i = 0; i < fromBase64Url(good).length; i += 3) {
      const b = bytes(); b[i] ^= 0x10;
      refuse(toBase64Url(Uint8Array.from(b)));
    }
  });
  it('not base64url, too short, truncated, trailing bytes', () => {
    refuse('ab+c', 'not a base64url');
    refuse('', 'too short');
    refuse(good.slice(0, -6));
    refuse(reseal([...bytes().slice(0, -4), 0, 0, 0, 0, 0]), 'trailing'); // one extra byte, then a fresh checksum slot
    refuse(reseal(bytes().slice(0, -12)));
  });
  it('a resealed log with a bad header, version, type code or argument is still refused', () => {
    const b = bytes();
    refuse(reseal([0x4E, ...b.slice(1)]), 'not a MaxiFox');
    refuse(reseal([b[0], b[1], 9, ...b.slice(3)]), 'format');
    refuse(reseal([b[0], b[1], b[2], 7, ...b.slice(4)]), 'rng version');
    // the first action's type byte: right after the header (magic, format, version, seed varint, flags, strings, profession, count)
    const decoded = decodeActionLog(good);
    expect(decoded.actions[0].type).toBe('roll');
    const at = b.findIndex((x, i) => i > 6 && x === ACTION_CODES.roll && b[i + 1] === ACTION_CODES.roll); // two rolls in a row
    expect(at).toBeGreaterThan(6);
    const bad = [...b]; bad[at] = 200;
    refuse(reseal(bad), 'unknown action code');
    const forced = [...b]; forced[at] = ACTION_CODES.debugForce;
    refuse(reseal(forced), 'debugForce');
  });
  it('encode refuses what it cannot represent', () => {
    expect(() => encodeActionLog({ ...log, rngVersion: 3 })).toThrow(ActionLogError);
    expect(() => encodeActionLog({ ...log, seed: -1 })).toThrow(ActionLogError);
    expect(() => encodeActionLog({ ...log, actions: [{ type: 'teleport' }] })).toThrow(ActionLogError);
    expect(() => encodeActionLog({ ...log, actions: [{ type: 'roll', dice: [6] }] })).toThrow(ActionLogError); // no chosen dice
    expect(() => encodeActionLog({ ...log, actions: [{ type: 'debugForce', outcome: 'win' }] })).toThrow(ActionLogError); // no forced win
    expect(() => encodeActionLog({ ...log, actions: [{ type: 'takeLoan', amount: 1.5 }] })).toThrow(ActionLogError);
    expect(() => encodeActionLog({ ...log, actions: [{ type: 'guess', cardId: 'x', light: 'blue', guess: 'good' }] })).toThrow(ActionLogError);
  });
  it('a decoded log that edits a move (a resealed different amount) replays to a different game or is refused', () => {
    const s0 = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 99 });
    let s = s0;
    for (let i = 0; i < 6; i++) s = botStep(engine, s, 'alwaysBuy');
    const text = encodeActionLog({ rngVersion: 2, seed: 99, config: { mode: 'family', professionId: 'teacher' }, actions: [...s.log, { type: 'takeLoan', amount: 1000 }] });
    const edited = decodeActionLog(text);
    edited.actions[edited.actions.length - 1].amount = 2000;
    const forged = decodeActionLog(encodeActionLog(edited));
    expect(engine.replay(99, forged.config, forged.actions).cash).not.toBe(engine.replay(99, edited.config, decodeActionLog(text).actions).cash);
  });
});
