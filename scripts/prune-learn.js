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

// The tutorial file carries more authoring text than the others: worked examples, wording notes and the hand-computed sums.
const TUTORIAL_DROP = new Set(['note', 'sampleText', 'sampleOneLine', 'sampleNoAsset', 'sample', 'ownerWording', 'trigger', 'afterwards', 'assumes', 'textGenderNeutral', 'illustration', 'was', 'terms', 'target', 'howto', 'keepAsIs', 'showWhile']);
function pruneTutorial(data) {
  const out = strip(data);
  const drop = (v) => {
    if (Array.isArray(v)) return v.map(drop);
    if (!v || typeof v !== 'object') return v;
    return Object.fromEntries(Object.entries(v).filter(([k]) => !TUTORIAL_DROP.has(k)).map(([k, x]) => [k, drop(x)]));
  };
  const o = drop(out);
  // hint targets that the UI needs are the `steps[].target` ids of the card tour (kept below); worked examples are authoring only
  for (const it of o.hints?.items ?? []) { delete it.example; }
  delete o.summaryBreakdown?.example; delete o.hudFamily?.example;
  // the validator reads the slot NAMES only
  o.notes = { slots: Object.fromEntries(Object.keys(data.notes?.slots ?? {}).map((k) => [k, ''])) };
  // the card tour steps keep their target ids (they point at the tiles)
  const steps = data.hints?.items?.find((i) => i.id === 'h-card')?.steps;
  const tour = o.hints?.items?.find((i) => i.id === 'h-card');
  if (steps && tour) tour.steps = steps.map((st) => ({ ...st }));
  return o;
}

/** @param kind 'glossary' | 'feedback' | 'report' | 'guess' | 'real-world'. Returns the pruned data object. */
export function pruneLearn(kind, data) {
  if (kind === 'tutorial') return pruneTutorial(data);
  const out = strip(data);
  if (kind === 'feedback') out.notes = { slots: Object.fromEntries(Object.keys(data.notes?.slots ?? {}).map((k) => [k, ''])) };
  return out;
}
