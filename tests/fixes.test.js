import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { paybackYears, paybackTier } from '../src/engine/index.js';
import { POSES } from '../src/ui/fox.js';
import { paybackYearsShown } from '../src/ui/modals.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('payback display is consistent with its tier', () => {
  it('rounds up, so a year count above 8 is never shown as a neutral "8"', () => {
    expect(paybackYearsShown(8.33)).toBe(9);
    expect(paybackTier(8.33)).toBe('slow');
    expect(paybackYearsShown(8)).toBe(8);
    expect(paybackTier(8)).toBe('ok');
    expect(paybackYearsShown(0.2)).toBe(1);
  });
  it('shown years <= 8 iff tier is ok, and <= 14 iff tier is not bad (every 0.05 step)', () => {
    for (let i = 2; i < 600; i++) {
      const y = i / 20;
      const shown = paybackYearsShown(y);
      expect(shown <= 8, `y=${y}`).toBe(paybackTier(y) === 'ok');
      expect(shown <= 14, `y=${y}`).toBe(paybackTier(y) !== 'bad');
    }
    expect(paybackYears(100000, 1000)).toBeCloseTo(8.33, 2);
  });
});

describe('win screen actions', () => {
  it('play again is the primary action and uses a new key for "change mode or profession"', () => {
    expect(he.win.again).toBe('שחק שוב');
    expect(he.win.change).toBeTruthy();
    const src = read('src/ui/screens/end.js');
    expect(src).toMatch(/createWin\(\{ match, onAgain, onMenu \}\)/);
    expect(src).toMatch(/win\.again[^\n]*variant: 'primary'/);
    expect(src).toMatch(/win\.change[^\n]*variant: 'secondary'/);
    expect(src).toMatch(/win\.share[^\n]*variant: 'text'/);
  });
  it('play again restarts with the same mode and profession', () => {
    expect(read('src/ui/app.js')).toMatch(/onAgain: \(\) => again\(m\)/);
    expect(read('src/ui/app.js')).toMatch(/rematch\(engine, m, nextSeed\(\)\)/);
  });
});

describe('copy', () => {
  it('game-over cause names both the cash and the loan limit', () => {
    expect(he.gameOver.text).toContain('נגמר המזומן ותקרת ההלוואות');
  });
});

describe('fox art is exported at display size', () => {
  it('@2x heights stay within the displayed size (no oversized sources)', () => {
    const max2x = { roll: 260, tip: 305, wave: 605, tired: 605, hammock: 525 };
    for (const [pose, h2] of Object.entries(max2x)) {
      expect(POSES[pose].h * 2, pose).toBeLessThanOrEqual(h2);
      expect(statSync(new URL(`../src/assets/fox/${pose}@2x.webp`, import.meta.url)).size, pose).toBeLessThan(100_000);
    }
  });
});
