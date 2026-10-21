// Build-time filter for src/data/learn/*.json: the production bundle keeps ONLY what the UI renders or the validator reads.
// Dropped: authoring notes, sources, review notes (needs_review), computed worksheets and every real-world figure that is not
// published (numbers.publish !== true). Sources stay in the repo files; they are not shipped to players.
const DROP_KEYS = new Set([
  'notes', 'needs_review', 'sources', 'source', 'computed', 'conditions', 'rules', 'when', 'usage', 'pluralRule', 'countRule',
  'researchedOn', 'hiddenIfUnavailable', 'status',
]);

function strip(value, path = []) {
  if (Array.isArray(value)) return value.map((v) => strip(v, path));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (DROP_KEYS.has(k)) {
      // glossary example.computed.amount feeds the interest example; the validator reads feedback.notes.slots names
      if (k === 'computed' && path.at(-1) === 'example' && Number.isFinite(v?.amount)) out.computed = { amount: v.amount };
      continue;
    }
    if (k === 'numbers') { if (v?.publish === true) out.numbers = { publish: true, text: v.text }; continue; }
    out[k] = strip(v, [...path, k]);
  }
  return out;
}

/** @param kind 'glossary' | 'feedback' | 'report' | 'guess' | 'real-world'. Returns the pruned data object. */
export function pruneLearn(kind, data) {
  const out = strip(data);
  if (kind === 'feedback') out.notes = { slots: Object.fromEntries(Object.keys(data.notes?.slots ?? {}).map((k) => [k, ''])) };
  return out;
}
