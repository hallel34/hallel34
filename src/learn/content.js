// Access to the validated learning content (glossary, feedback, report, guess, real-world) for the active locale.
import { loadLearn } from '../data/index.js';
import { getLocale, setGlossaryTermLookup } from '../i18n/index.js';

let cache = null;
let cacheLocale = null;

/** { glossary, feedback, report, guess, realWorld }. Throws (loudly) when a content file breaks its schema. */
export function learnContent() {
  const loc = getLocale();
  if (!cache || cacheLocale !== loc) {
    cache = loadLearn(loc);
    cacheLocale = loc;
    setGlossaryTermLookup((id) => conceptById(id)?.term ?? '');
  }
  return cache;
}

export const conceptList = () => [...learnContent().glossary.concepts].sort((a, b) => a.order - b.order);
export const conceptById = (id) => learnContent().glossary.concepts.find((c) => c.id === id) ?? null;

/** Family mode knows the 'family' concepts, full mode all of them (spec 1). */
export const conceptAvailable = (id, mode) => {
  const c = conceptById(id);
  return !!c && (c.level === 'family' || mode === 'full');
};
export const conceptsForMode = (mode) => conceptList().filter((c) => conceptAvailable(c.id, mode));

/** Dictionary order: alphabetical by the term (search-free list). */
export const dictionaryOrder = (mode) => {
  const loc = getLocale();
  return conceptsForMode(mode).sort((a, b) => a.term.localeCompare(b.term, loc));
};
export const glossaryUi = () => learnContent().glossary.ui;
