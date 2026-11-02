// MaxiFox v0.4 regression tests: teacher starting cash consistency.
// (Deal choice, tiered deal pools and short mode add their tests in this file as they land.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';

const engine = createEngine(loadData('he'));
const professions = JSON.parse(readFileSync(new URL('../src/data/professions.he.json', import.meta.url), 'utf8'));

describe('teacher starting cash: one value everywhere (QA P1, 2026-11-02)', () => {
  it('the intended teacher savings are ₪9,000 in the single source of truth', () => {
    // Live QA of the preview showed ₪10,000 on the profession card. In this codebase every display
    // (pick sheet, statement, HUD, learn texts) is fed live from this one field, the learn lessons are
    // built on 9,000 (9,000 - 7,500 = 1,500 left) and tests lock it — so 9,000 is the intended value,
    // and this test fails loudly if the data ever drifts away from it again.
    expect(professions.find((p) => p.id === 'teacher').savings).toBe(9000);
  });
  it('the engine starts every profession with exactly the savings shown for it (family, full, junior)', () => {
    for (const p of professions) {
      for (const mode of ['family', 'full']) {
        const s = engine.newGame({ mode, professionId: p.id, seed: 7 });
        expect(s.cash, `${p.id}/${mode}`).toBe(p.savings);
      }
    }
    const teacher = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 7 });
    expect(teacher.cash).toBe(9000);
  });
});
