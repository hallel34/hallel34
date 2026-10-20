import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ringPos } from '../src/ui/layout.js';
import { moneyText } from '../src/ui/format.js';
import { t, availableLocales } from '../src/i18n/index.js';
import { createEngine, BOARD } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';

const root = new URL('../src/', import.meta.url).pathname;
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const jsFiles = walk(root).filter((f) => f.endsWith('.js'));
const lookup = (key) => key.split('.').reduce((o, k) => o?.[k], he);

describe('board layout', () => {
  it('places 24 unique squares on the perimeter of a 7x7 grid', () => {
    const cells = BOARD.map((_, i) => ringPos(i));
    expect(new Set(cells.map((c) => c.join(','))).size).toBe(24);
    for (const [c, r] of cells) {
      expect(c >= 1 && c <= 7 && r >= 1 && r <= 7).toBe(true);
      expect(c === 1 || c === 7 || r === 1 || r === 7).toBe(true);
    }
  });
  it('consecutive squares are adjacent (the pawn can hop one tile at a time), including the wrap', () => {
    for (let i = 0; i < 24; i++) {
      const [a, b] = [ringPos(i), ringPos((i + 1) % 24)];
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
    }
  });
});

describe('formatting', () => {
  it('formats shekels with Intl, symbol first, explicit signs', () => {
    expect(moneyText(14250)).toBe('₪14,250');
    expect(moneyText(-800)).toBe('-₪800');
    expect(moneyText(900, { sign: true })).toBe('+₪900');
    expect(moneyText(0, { sign: true })).toBe('₪0');
    expect(moneyText(1234.6)).toBe('₪1,235');
  });
});

describe('i18n', () => {
  it('interpolates params', () => {
    expect(t('game.turn', { turn: 7 })).toContain('7');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
  it('every literal t()/tn() key used in the source exists in he.json', () => {
    const missing = [];
    for (const f of jsFiles) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt[n]?\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (typeof lookup(m[1]) !== 'string') missing.push(`${f.replace(root, '')}: ${m[1]}`);
      }
      // template keys like t(`type.${x}`) are checked by prefix
      for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) {
        if (typeof lookup(m[1]) !== 'object') missing.push(`${f.replace(root, '')}: ${m[1]}.*`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('has no hard-coded Hebrew strings in UI code', () => {
    const offenders = [];
    for (const f of jsFiles.filter((x) => /\/(ui|services)\/|main\.js$/.test(x))) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
      if (/[֐-׿]/.test(code)) offenders.push(f.replace(root, ''));
    }
    expect(offenders).toEqual([]);
  });
  it('locale meta is complete', () => {
    expect(availableLocales()).toContain('he');
    expect(he.meta).toMatchObject({ dir: 'rtl', lang: 'he' });
  });
});

describe('data registry', () => {
  it('loads and validates the Hebrew content', () => {
    const data = loadData('he');
    expect(data.cards.length).toBeGreaterThan(30);
    expect(() => createEngine(data)).not.toThrow();
  });
  it('falls back to Hebrew content for locales without a content file', () => {
    expect(loadData('xx').cards.length).toBe(loadData('he').cards.length);
  });
});

describe('engine events used by the UI', () => {
  const data = loadData('he');
  const e = createEngine(data);
  it('expensePaid carries the card so the UI can show what was paid', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      let s = e.newGame({ mode: 'family', professionId: 'engineer', seed });
      for (let i = 0; i < 40 && s.status === 'playing' && !found; i++) {
        if (s.phase === 'roll') s = e.roll(s);
        else if (s.pending?.kind === 'opportunity') s = e.pass(s);
        else if (s.pending?.kind === 'charity') s = e.declineCharity(s);
        else break;
        const ev = s.events.find((x) => x.type === 'expensePaid');
        if (ev) { found = true; expect(ev.card.deck).toBe('expense'); expect(ev.amount).toBe(ev.card.amount); }
      }
    }
    expect(found).toBe(true);
  });
});
