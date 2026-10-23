// Deal categories (v3.1): every opportunity card carries a registry category, the icons / tokens / labels exist, and the mapping
// is the one the designer assigned in docs/v3/design/category-map.md.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { CATEGORY_IDS } from '../src/data/categories.js';
import { validateCards } from '../src/engine/index.js';
import { categoryOf, categoryIdOf } from '../src/ui/categories.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const cards = JSON.parse(read('../src/data/cards.he.json'));
const he = JSON.parse(read('../src/i18n/he.json'));
const tokens = read('../src/styles/tokens.css');
const opp = cards.filter((c) => c.deck === 'opportunity');

describe('deal categories', () => {
  it('every opportunity card has a category from the registry (and only those)', () => {
    expect(opp.length).toBe(35);
    for (const c of opp) expect(CATEGORY_IDS, c.id).toContain(c.category);
    for (const c of cards.filter((x) => x.deck !== 'opportunity')) expect(c.category, c.id).toBeUndefined();
  });
  it('matches the designer mapping table', () => {
    const map = read('../docs/v3/design/category-map.md');
    const rows = [...map.matchAll(/\| `(opp-[a-z]+-\d+)` \|[^|]*\| (\w+) \| `([a-z-]+)` \|/g)];
    expect(rows.length).toBe(35);
    for (const [, id, type, category] of rows) {
      const c = cards.find((x) => x.id === id);
      expect(c.type, id).toBe(type);
      expect(c.category, id).toBe(category);
    }
  });
  it('counts per category', () => {
    const n = (id) => opp.filter((c) => c.category === id).length;
    expect(CATEGORY_IDS.map(n)).toEqual([16, 2, 2, 2, 2, 1, 4, 3, 3]);
  });
  it('each category has an icon, a short Hebrew label and colour tokens (dark + ink)', () => {
    for (const id of CATEGORY_IDS) {
      expect(existsSync(new URL(`../src/assets/category/${id}.svg`, import.meta.url)), id).toBe(true);
      expect(he.category[id], id).toBeTruthy();
      expect(he.category[id].length, id).toBeLessThanOrEqual(12);
      expect(tokens).toContain(`--cat-${id}:`);
      expect(tokens).toContain(`--cat-${id}-ink:`);
    }
  });
  it('the loader rejects an unknown or mismatching category', () => {
    const base = cards.filter((c) => c.deck !== 'opportunity' || c.id === 'opp-apt-001');
    expect(validateCards(base)).toEqual([]);
    const without = base.map((c) => (c.id === 'opp-apt-001' ? { ...c, category: undefined } : c));
    expect(validateCards(without)).toEqual([]); // optional in the schema (neutral icon); every shipped card has one (first test)
    const unknown = base.map((c) => (c.id === 'opp-apt-001' ? { ...c, category: 'boat' } : c));
    expect(validateCards(unknown).join()).toMatch(/category must be one of/);
    const wrong = base.map((c) => (c.id === 'opp-apt-001' ? { ...c, category: 'coffee' } : c));
    expect(validateCards(wrong).join()).toMatch(/needs the apartment category/);
  });
  it('categoryOf resolves cards and owned assets, with a neutral fallback', () => {
    const popcorn = cards.find((c) => c.id === 'opp-biz-006');
    expect(categoryOf(popcorn, cards).id).toBe('snack-cart');
    expect(categoryOf(popcorn, cards).inkVar).toBe('--cat-snack-cart-ink');
    // an asset bought before v3 has no category: derived from its card
    expect(categoryIdOf({ cardId: 'opp-biz-002', type: 'business' }, cards)).toBe('coffee');
    expect(categoryIdOf({ cardId: 'gone', type: 'stock', symbol: 'ELM' }, cards)).toBe('stock');
    const fallback = categoryOf({ cardId: 'gone', type: 'business' }, cards);
    expect(fallback.neutral).toBe(true);
    expect(fallback.label).toBe(he.type.business);
  });
});
