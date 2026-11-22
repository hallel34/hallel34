import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, newMatch, act } from '../src/engine/index.js';
import { needsOverwriteConfirm } from '../src/services/save-guard.js';
import { slotOf, SLOT_NORMAL, SLOT_DAILY, SLOT_CHALLENGE, SLOT_MISSION } from '../src/services/match-store.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const engine = createEngine({ professions: read('professions.he.json'), cards: read('cards.he.json') });
const mk = (extra = {}) => newMatch(engine, { mode: 'family', seed: 1, players: [{ professionId: 'teacher' }], ...extra });

describe('save slots (the semantics the overwrite warning relies on)', () => {
  it('normal, daily, challenge and mission games live in different slots', () => {
    const slots = new Set([slotOf(mk()), slotOf(mk({ daily: { date: '2026-11-22' } })), SLOT_CHALLENGE, SLOT_MISSION]);
    expect(slots.size).toBe(4);
    expect(slotOf(mk())).toBe(SLOT_NORMAL);
    expect(slotOf(mk({ daily: { date: '2026-11-22' } }))).toBe(SLOT_DAILY);
  });
});

describe('needsOverwriteConfirm', () => {
  it('asks only when a game in progress would be replaced', () => {
    expect(needsOverwriteConfirm(null)).toBe(false);
    expect(needsOverwriteConfirm(mk())).toBe(true);
    expect(needsOverwriteConfirm({ ...mk(), status: 'won' })).toBe(false); // a finished save only resumes to its end screen
    expect(needsOverwriteConfirm({ ...mk(), status: 'lost' })).toBe(false);
  });
  it('never asks for an independent slot', () => {
    expect(needsOverwriteConfirm(mk({ daily: { date: '2026-11-22' } }))).toBe(false);
    expect(needsOverwriteConfirm(act(mk(), (s) => s))).toBe(true);
  });
});
