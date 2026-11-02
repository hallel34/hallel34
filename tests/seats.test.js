// Owner bug report 2026-11-02: the device owner is seat 1 (a person, at the top); extra seats come below it.
import { describe, it, expect } from 'vitest';
import { initialSeats, canBeBot, playableBots } from '../src/ui/seats.js';
import { AGE_BANDS, MAX_PLAYERS } from '../src/engine/index.js';

const init = (o) => initialSeats({ max: MAX_PLAYERS, ageBands: AGE_BANDS, ...o });

describe('players screen seats', () => {
  it('a fresh setup at 2, 3 and 4 players has seat 1 a person', () => {
    for (const count of [2, 3, 4]) {
      const s = init({ count });
      expect(s.bots.slice(0, count).every((b) => b === null)).toBe(true);
      expect(s.names).toHaveLength(MAX_PLAYERS);
    }
  });
  it('a setup that comes back with a bot in seat 1 opens with the people first, each seat keeping its own data', () => {
    const s = init({ count: 3, names: ['שועל מאוזן', 'דנה', 'אורי'], ages: [null, '14plus', 'upTo10'], bots: ['sensible', null, null] });
    expect(s.bots.slice(0, 3)).toEqual([null, null, 'sensible']);
    expect(s.names.slice(0, 3)).toEqual(['דנה', 'אורי', '']); // a bot's name is the policy's, derived on the way out
    expect(s.ages.slice(0, 3)).toEqual(['14plus', 'upTo10', null]);
  });
  it('people keep their order and bots keep theirs (stable)', () => {
    const s = init({ count: 4, names: ['', 'א', '', 'ב'], bots: ['cautious', null, 'alwaysBuy', null] });
    expect(s.names.slice(0, 4)).toEqual(['א', 'ב', '', '']);
    expect(s.bots.slice(0, 4)).toEqual([null, null, 'cautious', 'alwaysBuy']);
  });
  it('a default label ("שחקן 2") is not carried to another seat', () => {
    const s = init({ count: 3, names: ['', 'שחקן 2', 'אורי'], bots: ['sensible', null, null], isDefaultName: (nm, i) => nm === `שחקן ${i + 1}` });
    expect(s.names.slice(0, 3)).toEqual(['', 'אורי', '']); // seat 1 shows its own default, "שחקן 1"
  });
  it('a setup of bots only gets a person in seat 1', () => {
    const s = init({ count: 2, bots: ['sensible', 'cautious'] });
    expect(s.bots.slice(0, 2)).toEqual([null, 'cautious']);
  });
  it('a setup with seat 1 a person is left as it is', () => {
    const s = init({ count: 3, names: ['דנה', '', 'אורי'], bots: [null, 'alwaysBuy', null] });
    expect(s.bots.slice(0, 3)).toEqual([null, 'alwaysBuy', null]);
    expect(s.names.slice(0, 3)).toEqual(['דנה', '', 'אורי']);
  });
  it('a seat may become a bot only while another seat is a person', () => {
    expect(canBeBot([null, null, null, null], 0, 3)).toBe(true);
    expect(canBeBot([null, 'sensible', 'sensible', null], 0, 3)).toBe(false); // seat 4 is out of the game
    expect(canBeBot(['sensible', null, null, null], 1, 2)).toBe(false);
    expect(canBeBot([null, null, null, null], 0, 1)).toBe(false); // one player is always a person
  });
  it('the match never gets bots only, and one player is never a bot', () => {
    expect(playableBots(['sensible', 'cautious', null, null], 2)).toEqual([null, 'cautious']);
    expect(playableBots(['sensible', null, null, null], 1)).toEqual([null]);
    expect(playableBots([null, 'alwaysBuy', 'bogus', null], 3)).toEqual([null, 'alwaysBuy', null]);
  });
});
