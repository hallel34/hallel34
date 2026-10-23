// Deal-category presentation (docs/v3/design/category-map.md): ONE registry of icon + colour + label, used identically on the
// revealed deal card, the assets list, the monthly-report rows and the sell / offer rows. Never on board tiles.
// The ids live in src/data/categories.js (pure data, validated with the cards); a missing / unknown category falls back to the
// neutral house icon with the label of the card's type.
import { CATEGORY_IDS } from '../data/categories.js';
import { t } from '../i18n/index.js';
import { html } from './dom.js';
import { icon } from './icons.js';
import { getEngine } from './session.js';

const ICONS = import.meta.glob('../assets/category/*.svg', { eager: true, query: '?raw', import: 'default' });
const svgOf = (id) => ICONS[`../assets/category/${id}.svg`] ?? null;

export const categoryIds = () => CATEGORY_IDS.filter((id) => svgOf(id));

/** The category id of a card, or of an owned asset (derived from its card: assets bought before v3 carry none, and the save schema stays as it is). */
export function categoryIdOf(cardOrAsset, cards = getEngine()?.data?.cards ?? []) {
  if (!cardOrAsset) return null;
  if (CATEGORY_IDS.includes(cardOrAsset.category)) return cardOrAsset.category;
  const card = cardOrAsset.cardId ? cards.find((c) => c.id === cardOrAsset.cardId) : null;
  if (card && CATEGORY_IDS.includes(card.category)) return card.category;
  if (cardOrAsset.type === 'stock') return 'stock';
  return null;
}

/** { id, label, svg, colorVar, inkVar, neutral } for a card or an asset; the neutral fallback when there is no category. */
export function categoryOf(cardOrAsset, cards) {
  const id = categoryIdOf(cardOrAsset, cards);
  if (id && svgOf(id)) {
    return { id, label: t(`category.${id}`), svg: svgOf(id), colorVar: `--cat-${id}`, inkVar: `--cat-${id}-ink`, neutral: false };
  }
  const type = cardOrAsset?.type;
  return { id: 'neutral', label: type ? t(`type.${type}`) : '', svg: null, colorVar: '--text-muted', inkVar: '--card-muted', neutral: true };
}

/**
 * The glyph as an inline <span class="cat-icon"> (stroke = currentColor, so one file serves every colour). `on` picks the token set:
 * 'dark' = --cat-X on navy surfaces, 'cream' = --cat-X-ink on the cream card.
 */
export function categoryIcon(cardOrAsset, { size = 24, on = 'dark', cards } = {}) {
  const c = categoryOf(cardOrAsset, cards);
  const glyph = c.svg ? html(c.svg) : icon('opportunity', { size, width: 2 });
  glyph.setAttribute('aria-hidden', 'true'); glyph.setAttribute('focusable', 'false');
  const span = document.createElement('span');
  span.className = `cat-glyph cat-on-${on}`;
  span.dataset.category = c.id;
  span.style.setProperty('--cat', `var(${on === 'cream' ? c.inkVar : c.colorVar})`);
  span.setAttribute('aria-hidden', 'true');
  glyph.removeAttribute('width'); glyph.removeAttribute('height');
  glyph.style.inlineSize = `${size}px`; glyph.style.blockSize = `${size}px`;
  span.append(glyph);
  return span;
}

/**
 * The round chip: 40px on the cream deal card (`on: 'cream'`, the -ink colour on a 12% tint), 32px in lists on navy surfaces
 * (`on: 'dark'`, 16% tint). The glyph is 24px / 20px, stroke 2 at any size. aria-hidden: the label next to it carries the meaning.
 */
export function categoryChip(cardOrAsset, { size = 40, on = 'cream', cards } = {}) {
  const c = categoryOf(cardOrAsset, cards);
  const glyph = c.svg ? html(c.svg) : icon('opportunity', { size: 24, width: 2 });
  glyph.removeAttribute('width'); glyph.removeAttribute('height');
  glyph.setAttribute('aria-hidden', 'true'); glyph.setAttribute('focusable', 'false');
  const chip = document.createElement('span');
  chip.className = `cat-chip cat-chip--${size} cat-on-${on}`;
  chip.dataset.category = c.id;
  chip.style.setProperty('--cat', `var(${on === 'cream' ? c.inkVar : c.colorVar})`);
  chip.setAttribute('aria-hidden', 'true');
  chip.append(glyph);
  return chip;
}
