// Content registry. cards.<locale>.json and professions.<locale>.json are picked up
// automatically; adding a card or a language never requires code changes.
import { validateData } from '../engine/index.js';
import { FALLBACK } from '../i18n/index.js';
import { validateLearnOrThrow } from '../learn/validate.js';
import { validateV4Learn } from '../learn/validate-v4.js';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });
const learnFiles = import.meta.glob('./learn/*.json', { eager: true, import: 'default' });
const pick = (kind, locale) =>
  files[`./${kind}.${locale}.json`] ?? files[`./${kind}.${FALLBACK}.json`];

/** Returns validated { cards, professions } for a locale. Throws with a readable message. */
export function loadData(locale = FALLBACK) {
  const data = { cards: pick('cards', locale), professions: pick('professions', locale) };
  validateData(data); // fails loudly on bad content
  return data;
}

const LEARN_KINDS = { glossary: 'glossary', feedback: 'feedback', report: 'report', guess: 'guess', realWorld: 'real-world', tutorial: 'tutorial' };
// v4 stage 4: the real-world files (the tax-audit quiz, the guide with the statement popover, the Israeli money rules)
const V4_KINDS = { quizTax: 'quiz-tax', guide: 'guide', israel: 'israel' };

/**
 * Validated learning content for a locale: { glossary, feedback, report, guess, realWorld, tutorial } from src/data/learn/<kind>.<locale>.json
 * (falls back to Hebrew per file). Throws with a readable message when a file breaks the schema.
 */
export function loadLearn(locale = FALLBACK, { cards } = {}) {
  const pickLearn = (kind) => learnFiles[`./learn/${kind}.${locale}.json`] ?? learnFiles[`./learn/${kind}.${FALLBACK}.json`];
  const learn = Object.fromEntries(Object.entries(LEARN_KINDS).map(([key, kind]) => [key, pickLearn(kind)]));
  validateLearnOrThrow(learn, { cards: cards ?? pick('cards', locale) });
  const v4 = Object.fromEntries(Object.entries(V4_KINDS).map(([key, kind]) => [key, pickLearn(kind)]));
  const errors = validateV4Learn(v4, { glossaryIds: new Set((learn.glossary?.concepts ?? []).map((c) => c.id)) });
  if (errors.length) throw new Error(`Invalid learning content:\n- ${errors.join('\n- ')}`);
  return { ...learn, ...v4 };
}
