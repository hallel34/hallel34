// Content registry. cards.<locale>.json and professions.<locale>.json are picked up
// automatically; adding a card or a language never requires code changes.
import { validateData } from '../engine/index.js';
import { FALLBACK } from '../i18n/index.js';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });
const pick = (kind, locale) =>
  files[`./${kind}.${locale}.json`] ?? files[`./${kind}.${FALLBACK}.json`];

/** Returns validated { cards, professions } for a locale. Throws with a readable message. */
export function loadData(locale = FALLBACK) {
  const data = { cards: pick('cards', locale), professions: pick('professions', locale) };
  validateData(data); // fails loudly on bad content
  return data;
}
