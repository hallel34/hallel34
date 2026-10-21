// Glossary markup inside i18n strings: [[term:id|display]] (display optional: [[term:id]] shows the glossary term).
// Pure string helpers, shared by t() (which strips the markup), the renderer (which turns it into buttons) and the tests.
const RE = /\[\[term:([a-z_]+)(?:\|([^\]]*))?\]\]/g;

/** Splits a string into parts: { text } and { term, display }. `display` is '' when the markup had none. */
export function parseMarkup(str) {
  const parts = [];
  let last = 0;
  for (const m of String(str).matchAll(RE)) {
    if (m.index > last) parts.push({ text: str.slice(last, m.index) });
    parts.push({ term: m[1], display: m[2] ?? '' });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push({ text: str.slice(last) });
  return parts;
}

/** Plain text of a marked-up string. `termOf(id)` supplies the glossary term for markup without a display part. */
export function stripMarkup(str, termOf = () => '') {
  return String(str).replace(RE, (m, id, display) => display ?? termOf(id));
}

/** Every term id used in a string, in order. */
export const termIds = (str) => [...String(str).matchAll(RE)].map((m) => m[1]);

export const hasMarkup = (str) => /\[\[term:/.test(String(str));
