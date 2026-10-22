// Access to the validated learning content (glossary, feedback, report, guess, real-world) for the active locale.
import { loadLearn } from '../data/index.js';
import { getLocale, setGlossaryTermLookup, setStringOverrides } from '../i18n/index.js';
import { getLearnMode, onLearnMode } from './context.js';

let cache = null;
let familyCache = null; // the same content with the family overrides applied to its learn files (kid wording)
let cacheLocale = null;

let unsubscribe = null;

/** { glossary, feedback, report, guess, realWorld, tutorial }. Throws (loudly) when a content file breaks its schema. */
export function learnContent() {
  const loc = getLocale();
  if (!cache || cacheLocale !== loc) {
    cache = loadLearn(loc);
    familyCache = applyContentOverrides(cache, contentOverrides(cache.tutorial));
    cacheLocale = loc;
    setGlossaryTermLookup((id) => termName(id));
    // The family vocabulary layer follows the learn mode: family mode swaps in the kid wording, full mode never does.
    const map = familyOverrideMap(cache.tutorial);
    const apply = (m) => setStringOverrides(m === 'family' ? map : null);
    unsubscribe?.();
    apply(getLearnMode());
    unsubscribe = onLearnMode(apply);
  }
  return getLearnMode() === 'family' ? familyCache : cache;
}

/**
 * The family vocabulary layer reaches every surface through ONE list (tutorial.familyStrings.overrides):
 *  - key 'loan.rateLine'            a string of the locale file (src/i18n/he.json), swapped by setStringOverrides
 *  - key 'guess:prompt.hint'        a string inside a learn file ('<file>:<dotted.path>', file = glossary | feedback | report |
 *                                   guess | realWorld | tutorial), swapped in the family view of learnContent()
 * Adding a surface = adding an entry to the JSON; no code and no per-string special cases.
 */
export const isContentKey = (key) => key.includes(':');
export const splitContentKey = (key) => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
export const contentOverrides = (tutorial) => tutorial.familyStrings.overrides.filter((o) => isContentKey(o.key));

/** A deep copy of `content` with each { key: 'file:path', family } entry written into it (a path that does not exist is skipped; the test reports it). */
export function applyContentOverrides(content, entries) {
  if (!entries.length) return content;
  const copy = structuredClone(content);
  for (const { key, family } of entries) {
    const [file, path] = splitContentKey(key);
    const parts = path.split('.');
    let node = copy[file];
    for (const part of parts.slice(0, -1)) node = node?.[part];
    const last = parts[parts.length - 1];
    if (node && typeof node[last] === 'string') node[last] = family;
  }
  return copy;
}

/** { key: familyText } of the locale-file strings that switch in family mode (learn-file paths are applied by learnContent()). */
export const familyOverrideMap = (tutorial) => Object.fromEntries(tutorial.familyStrings.overrides.filter((o) => !isContentKey(o.key)).map((o) => [o.key, o.family]));

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
