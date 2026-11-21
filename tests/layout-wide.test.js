import { describe, it, expect } from 'vitest';
import { isWideLayout, wideScenePanel, wideSceneRoom, WIDE_MAX_APP } from '../src/ui/layout-wide.js';

describe('phase C wide layout', () => {
  it('is wide for landscape phones and desktops, never for portrait phones or square-ish tablets', () => {
    expect(isWideLayout(844, 390)).toBe(true);
    expect(isWideLayout(1280, 800)).toBe(true);
    expect(isWideLayout(390, 844)).toBe(false);
    expect(isWideLayout(667, 375)).toBe(false); // narrower than 720
    expect(isWideLayout(768, 1024)).toBe(false);
    expect(isWideLayout(1024, 900)).toBe(false); // ratio 1.14 < 1.15
  });
  it('keeps the panel between 340 and 420 and the board room positive', () => {
    for (const w of [720, 844, 1024, 1280, 1920]) {
      const p = wideScenePanel(w);
      expect(p).toBeGreaterThanOrEqual(340); expect(p).toBeLessThanOrEqual(420);
      expect(wideSceneRoom(w, p)).toBeGreaterThan(280);
    }
    expect(wideSceneRoom(3000, 400)).toBe(WIDE_MAX_APP - 400 - 32);
  });
});
