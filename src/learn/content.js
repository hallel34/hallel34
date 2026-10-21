// Access to the validated learning content (glossary, feedback, report, guess, real-world) for the active locale.
import { loadLearn } from '../data/index.js';
import { getLocale, setGlossaryTermLookup, setStringOverrides } from '../i18n/index.js';
import { getLearnMode, onLearnMode } from './context.js';

let cache = null;
let cacheLocale = null;

let unsubscribe = null;

/** { glossary, feedback, report, guess, realWorld, tutorial }. Throws (loudly) when a content file breaks its schema. */
export function learnContent() {
  const loc = getLocale();
  if (!cache || cacheLocale !== loc) {
    cache = loadLearn(loc);
    cacheLocale = loc;
    setGlossaryTermLookup((id) => termName(id));
    // The family vocabulary layer follows the learn mode: family mode swaps in the kid wording, full mode never does.
    const map = familyOverrideMap(cache.tutorial);
    const apply = (m) => setStringOverrides(m === 'family' ? map : null);
    unsubscribe?.();
    apply(getLearnMode());
    unsubscribe = onLearnMode(apply);
  }
  return cache;
}

/** { key: familyText } of the 22 strings that switch in family mode. */
export const familyOverrideMap = (tutorial) => Object.fromEntries(tutorial.familyStrings.overrides.map((o) => [o.key, o.family]));

/** The kid vocabulary entry of a concept ({ term, kidName, kidShort, level }), or null. */
export const kidOf = (id) => learnContent().tutorial.kidNames.concepts.find((c) => c.id === id) ?? null;
/** The name the UI shows for a concept: the kid name in family mode, the real term otherwise. */
export const termName = (id, mode = getLearnMode()) => (mode === 'family' ? (kidOf(id)?.kidName ?? conceptById(id)?.term) : conceptById(id)?.term) ?? '';
/** True when the title shown for the concept is not the real term (family mode): the real term then appears underneath. */
export const hasKidName = (id, mode = getLearnMode()) => mode === 'family' && !!kidOf(id) && kidOf(id).kidName !== conceptById(id)?.term;

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
  return conceptsForMode(mode).sort((a, b) => termName(a.id, mode).localeCompare(termName(b.id, mode), loc));
};
export const glossaryUi = () => learnContent().glossary.ui;
