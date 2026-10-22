// Schema validation for src/data/learn/tutorial.<locale>.json (the 'first game with Passivo' package). Fails loudly at load.
// Adding a hint, a story line or a vocabulary word is a JSON edit only.
import { rawString } from '../i18n/index.js';
import { POSE_NAMES } from '../ui/fox-rules.js';

const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const slotsIn = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

/** Keys that are authoring notes only (never rendered): skipped by the slot scan. */
const AUTHORING = new Set(['notes', 'computed', 'was', 'sampleText', 'sampleOneLine', 'sampleNoAsset', 'sample', 'ownerWording', 'trigger', 'family', 'note', 'howto', 'keepAsIs', 'showWhile']);
export const HINT_IDS = ['h-roll', 'h-card', 'h-guess-intro', 'h-summary', 'h-summary-income', 'h-loan', 'h-expense-paid', 'h-expense-loan', 'h-meter', 'h-almost', 'h-summary-square'];

function* strings(v, path = []) {
  if (typeof v === 'string') yield [path.join('.'), v];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* strings(x, [...path, i]);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!AUTHORING.has(k)) yield* strings(x, [...path, k]);
}

/** Returns the error list (empty = valid). `glossaryIds` Set, `cards` array (may be empty). */
export function validateTutorial(tut, { glossaryIds = new Set(), cards = [], glossaryLevels = {} } = {}) {
  const errors = [];
  const err = (m) => errors.push(`tutorial: ${m}`);
  if (!tut || typeof tut !== 'object') return ['tutorial: file missing'];

  // ---- ui ----
  for (const k of ['title', 'next', 'back', 'skip', 'skipToast', 'go', 'dots', 'replay', 'replayHints', 'helpToggle', 'helpToggleHelp', 'offerCheck', 'doCheck', 'skipCheck', 'gotIt', 'simplificationLabel', 'exampleLabel', 'parentCardOpen', 'professionalWord', 'hintNext', 'howtoStory', 'howtoRules', 'storyLayer', 'close']) {
    if (!isStr(tut.ui?.[k])) err(`ui.${k}`);
  }

  // ---- declared slots ----
  const declared = new Set(Object.keys(tut.notes?.slots ?? {}));
  if (!declared.size) err('notes.slots must list the slot names');
  for (const [path, text] of strings(tut)) {
    for (const sl of slotsIn(text)) if (!declared.has(sl)) err(`${path}: undeclared slot {${sl}}`);
  }

  // ---- story ----
  const screens = tut.story?.screens;
  const ids = new Set();
  if (!Array.isArray(screens) || !screens.length) err('story.screens must be a non-empty array');
  if (Array.isArray(screens) && screens.length > (tut.story.maxScreens ?? 5)) err('story has too many screens');
  let secs = 0;
  for (const s of screens ?? []) {
    const w = `story ${s?.id}`;
    if (!isStr(s.id) || ids.has(s.id)) err(`${w}: id`);
    ids.add(s.id);
    if (!POSE_NAMES.includes(s.pose)) err(`${w}: pose ${s.pose}`);
    if (!isStr(s.title)) err(`${w}: title`);
    // a screen is either plain lines or a sequence of short 'parts' (one idea each, advanced with 'הבא' inside the screen)
    const parts = Array.isArray(s.parts) && s.parts.length ? s.parts : null;
    if (parts) {
      const pids = new Set();
      for (const p of parts) { if (!isStr(p?.id) || pids.has(p.id) || !isStr(p.text)) err(`${w}: part ${p?.id}`); pids.add(p?.id); }
      if (words(parts.map((p) => p.text).join(' ')) > 60) err(`${w}: more than 60 words in the parts`);
      if (s.simplificationAfterPart && !pids.has(s.simplificationAfterPart)) err(`${w}: simplificationAfterPart`);
    } else if (!Array.isArray(s.lines) || !s.lines.length || s.lines.some((l) => !isStr(l))) err(`${w}: lines`);
    else if (words(s.lines.join(' ')) > 45) err(`${w}: more than 45 words`);
    if (!parts && !isStr(s.example?.text)) err(`${w}: example.text`);
    if (s.example?.cardId && cards.length && !cards.some((c) => c.id === s.example.cardId)) err(`${w}: unknown card ${s.example.cardId}`);
    if (s.simplification != null && !isStr(s.simplification)) err(`${w}: simplification`);
    if (!Number.isFinite(s.readSec)) err(`${w}: readSec`); else secs += s.readSec;
    if (s.chain && (!Array.isArray(s.chain) || s.chain.length !== 4 || !Array.isArray(s.chainShort) || s.chainShort.length !== 4)) err(`${w}: chain and chainShort need 4 items`);
  }
  const [lo, hi] = tut.story?.targetSeconds ?? [60, 90];
  if (screens?.length && (secs < lo || secs > hi)) err(`story reading time ${secs}s is outside ${lo}-${hi}s`);

  // ---- check ----
  const qs = tut.check?.questions ?? [];
  if (qs.length !== 3) err('check needs exactly 3 questions');
  for (const q of qs) {
    const w = `check ${q?.id}`;
    if (!isStr(q.prompt) || !isStr(q.explain)) err(`${w}: prompt/explain`);
    if (!ids.has(q.replayScreen)) err(`${w}: replayScreen ${q.replayScreen} is not a story screen`);
    const opts = q.options ?? [];
    if (opts.length < 2 || opts.filter((o) => o.correct).length !== 1 || opts.some((o) => !isStr(o.text) || !isStr(o.feedback))) err(`${w}: options (one correct, all with feedback)`);
  }
  for (const k of ['question', 'showMe', 'tryAgain', 'nextQuestion', 'finish', 'go', 'explainTitle', 'correctTitle']) if (!isStr(tut.check?.ui?.[k])) err(`check.ui.${k}`);
  for (const k of ['all', 'some', 'replayLine']) if (!isStr(tut.check?.result?.[k])) err(`check.result.${k}`);

  // ---- hints ----
  const items = tut.hints?.items ?? [];
  const hintIds = new Set();
  for (const it of items) {
    const w = `hint ${it?.id}`;
    if (!isStr(it.id) || hintIds.has(it.id)) err(`${w}: id`);
    hintIds.add(it.id);
    if (!POSE_NAMES.includes(it.pose)) err(`${w}: pose`);
    if (!Number.isFinite(it.priority)) err(`${w}: priority`);
  }
  for (const id of HINT_IDS) if (!hintIds.has(id)) err(`missing hint ${id}`);
  const hint = (id) => items.find((i) => i.id === id) ?? {};
  for (const id of HINT_IDS.filter((x) => !['h-card', 'h-summary', 'h-summary-income'].includes(x))) if (!isStr(hint(id).text)) err(`hint ${id}: text`);
  for (const k of ['positive', 'negative']) if (!isStr(hint('h-summary').variants?.[k]?.text)) err(`hint h-summary.${k}`);
  for (const k of ['apartment', 'business']) {
    if (!isStr(hint('h-summary-income').textAsset?.[k]) || !isStr(hint('h-summary-income').moreAsset?.[k])) err(`hint h-summary-income.${k}`);
  }
  const steps = hint('h-card').steps ?? [];
  if (steps.length < 3 || steps.some((st) => !isStr(st.text) || !isStr(st.target))) err('hint h-card: at least 3 steps with target + text');
  if (!isStr(hint('h-card').closing)) err('hint h-card: closing');

  // ---- summary breakdown / HUD / goal line ----
  for (const k of ['resultMonthly', 'resultTotal', 'oneLine', 'negativeResult', 'negativeMonthly', 'arrival', 'arrivalSr', 'negativeNote', 'zeroShort']) if (!isStr(tut.summaryBreakdown?.[k])) err(`summaryBreakdown.${k}`);
  for (const id of ['salary', 'passive', 'expenses']) if (!isStr(tut.summaryBreakdown?.rows?.find((r) => r.id === id)?.label)) err(`summaryBreakdown.rows.${id}`);
  for (const k of ['chip', 'incomeTitle', 'incomeTotal', 'outTitle', 'resultRow', 'arrivalLine']) if (!isStr(tut.hudFamily?.[k])) err(`hudFamily.${k}`);
  if (!Array.isArray(tut.hudFamily?.incomeRows) || tut.hudFamily.incomeRows.length !== 2) err('hudFamily.incomeRows needs 2 rows');
  if (!Array.isArray(tut.hudFamily?.outRows) || tut.hudFamily.outRows.length !== 1) err('hudFamily.outRows needs 1 row');
  for (const k of ['text', 'textShort', 'a11y']) if (!isStr(tut.goalLine?.[k])) err(`goalLine.${k}`);
  for (const k of ['text', 'almost', 'onTheLine', 'won']) if (!isStr(tut.goalLine?.progress?.[k])) err(`goalLine.progress.${k}`);
  if (!Number.isFinite(tut.goalLine?.shortFromHeightPx)) err('goalLine.shortFromHeightPx');

  // ---- kid vocabulary ----
  const kidIds = new Set();
  for (const c of tut.kidNames?.concepts ?? []) {
    const w = `kidNames ${c?.id}`;
    if (!glossaryIds.has(c.id)) err(`${w}: not a glossary concept`);
    if (kidIds.has(c.id)) err(`${w}: duplicate`);
    kidIds.add(c.id);
    for (const k of ['term', 'kidName', 'kidShort']) if (!isStr(c[k])) err(`${w}: ${k}`);
    if (glossaryLevels[c.id] && c.level !== glossaryLevels[c.id]) err(`${w}: level differs from the glossary`);
  }
  for (const id of glossaryIds) if (!kidIds.has(id)) err(`kidNames: no kid name for glossary concept ${id}`);
  const keys = new Set();
  for (const o of [...(tut.familyStrings?.overrides ?? []), ...(tut.familyStrings?.overridesRound11 ?? [])]) {
    const w = `familyStrings ${o?.key}`;
    if (keys.has(o.key)) err(`${w}: duplicate`);
    keys.add(o.key);
    if (!isStr(o.family)) err(`${w}: family text`);
    if (typeof o.key === 'string' && o.key.includes(':')) {
      // 'file:path' = a string inside a learn file; existence and slots are checked against the loaded files (tests/kid-vocabulary.test.js)
      if (!/^(glossary|feedback|report|guess|realWorld|tutorial):[\w.-]+$/.test(o.key)) err(`${w}: use '<file>:<dotted.path>'`);
      continue;
    }
    const orig = rawString(o.key, 'he');
    if (orig == null) err(`${w}: key does not exist in the locale file`);
    else if (slotsIn(o.family).some((sl) => !slotsIn(orig).includes(sl))) err(`${w}: may only use the {slots} of the original`);
  }
  if (keys.size < 22) err(`familyStrings: expected at least 22 overrides, found ${keys.size}`);

  // ---- parent card / how-to ----
  if (!Array.isArray(tut.parentCard?.howToExplain) || tut.parentCard.howToExplain.length !== 3) err('parentCard.howToExplain needs 3 sentences');
  if (!Array.isArray(tut.parentCard?.questions) || tut.parentCard.questions.length !== 3 || tut.parentCard.answers?.length !== 3) err('parentCard: 3 questions with 3 answers');
  if (!isStr(tut.parentCard?.title)) err('parentCard.title');
  if (!Array.isArray(tut.howtoKid?.steps) || tut.howtoKid.steps.length < 4) err('howtoKid.steps needs at least 4 lines');

  // ---- term markup resolves ----
  for (const [path, text] of strings(tut)) for (const m of text.matchAll(/\[\[term:([a-z_]+)/g)) if (!glossaryIds.has(m[1])) err(`${path}: unknown term ${m[1]}`);
  return errors;
}
