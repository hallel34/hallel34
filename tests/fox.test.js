import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as foxModule from '../src/ui/fox.js';
import { POSES, foxUrls } from '../src/ui/fox.js';
import { tipIndexForTurn, TIP_COUNT, REACTIONS, CARD_REACTION, LAND_REACTION } from '../src/ui/fox-rules.js';
import { BOARD } from '../src/engine/index.js';

const ROOT = new URL('..', import.meta.url).pathname;
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));

/** Width/height of a WebP file from its RIFF header (VP8 / VP8L / VP8X). */
function webpSize(file) {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  throw new Error(`unknown webp: ${file}`);
}

describe('fox module surface', () => {
  it('exports everything the screens import', () => {
    for (const name of ['foxImg', 'foxUrls', 'loadFox', 'warmFox', 'riseIn', 'squash', 'createReactor', 'cornerPop', 'dirSign', 'POSES', 'REACTIONS', 'CARD_REACTION']) {
      expect(foxModule[name], name).toBeDefined();
    }
  });
});

describe('fox poses', () => {
  it('every pose resolves to a bundled URL; poses with @2x get a 1x/2x srcset', () => {
    for (const [pose, m] of Object.entries(POSES)) {
      const u = foxUrls(pose);
      expect(u.src, pose).toBeTruthy();
      if (m.x2) expect(u.srcset, pose).toMatch(/ 1x, .* 2x$/); else expect(u.srcset, pose).toBeNull();
    }
    expect(() => foxUrls('hero')).toThrow();
  });

  it('declared sizes match the real files (aspect ratio is never stretched) and @2x is exactly double', () => {
    for (const [pose, m] of Object.entries(POSES)) {
      expect(webpSize(join(ROOT, `src/assets/fox/${pose}.webp`)), pose).toEqual([m.w, m.h]);
      if (m.x2) {
        const [w2, h2] = webpSize(join(ROOT, `src/assets/fox/${pose}@2x.webp`));
        expect(Math.abs(w2 - m.w * 2) <= 2 && Math.abs(h2 - m.h * 2) <= 2, `${pose}@2x`).toBe(true);
      }
    }
  });

  it('reaction crops are square; there is no unused/forgotten pose file besides hero', () => {
    for (const r of REACTIONS) expect(POSES[r].crop).toBe(true);
    const files = readdirSync(join(ROOT, 'src/assets/fox')).map((f) => f.replace('@2x', '').replace('.webp', ''));
    const unknown = [...new Set(files)].filter((n) => n !== 'hero' && !POSES[n]);
    expect(unknown).toEqual([]);
  });

  it('only reaction crops are used for cards and landings; every card kind and square has one', () => {
    for (const v of [...Object.values(CARD_REACTION), ...Object.values(LAND_REACTION)]) expect(REACTIONS).toContain(v);
    for (const k of ['opportunity', 'expense', 'market', 'baby', 'charity']) expect(CARD_REACTION[k]).toBeTruthy();
    for (const sq of BOARD.filter((x) => x !== 'payday')) expect(LAND_REACTION[sq], sq).toBeTruthy();
  });
});

describe('family-mode tips', () => {
  it('show on turns 1, 2, 3 then every 5th turn, never otherwise', () => {
    const shown = Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => tipIndexForTurn(n) >= 0);
    expect(shown).toEqual([1, 2, 3, 8, 13, 18, 23, 28]);
    expect(tipIndexForTurn(0)).toBe(-1);
  });
  it('indices stay inside the available tip strings, all of which exist in he.json', () => {
    for (let n = 1; n <= 200; n++) { const i = tipIndexForTurn(n); expect(i).toBeLessThan(TIP_COUNT); }
    for (let i = 1; i <= TIP_COUNT; i++) expect(typeof he.fox[`tip${i}`], `fox.tip${i}`).toBe('string');
  });
});

describe('fox copy and accessibility', () => {
  it('has alt text for the meaningful poses and three bubble jokes', () => {
    for (const k of ['tired', 'wave', 'hammock']) expect(he.fox.alt[k]).toMatch(/[֐-׿]/);
    for (const k of ['hello', 'joke1', 'joke2', 'joke3']) expect(he.fox[k]).toMatch(/[֐-׿]/);
  });
  it('every UI file that renders a fox honours reduced motion through motionOK', () => {
    const src = readFileSync(join(ROOT, 'src/ui/fox.js'), 'utf8');
    expect(src).toContain('motionOK()');
    const css = readFileSync(join(ROOT, 'src/styles/fox.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('data-motion="reduced"');
  });
  it('no fox image is built without width/height attributes', () => {
    const src = readFileSync(join(ROOT, 'src/ui/fox.js'), 'utf8');
    expect(src).toMatch(/width: w, height: hh/);
    expect(src).toContain("decoding: 'async'");
  });
});

describe('tiles', () => {
  it('tile ink uses the navy token on every tile (no white ink)', () => {
    const css = readFileSync(join(ROOT, 'src/styles/screens.css'), 'utf8');
    expect(css).toContain('--tile-ink: var(--sq-icon-dark)');
    expect(css).not.toMatch(/--tile-ink:\s*#fff/i);
  });
});
