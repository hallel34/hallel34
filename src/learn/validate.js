// Schema validation for the learning content (src/data/learn/*.<locale>.json). Fails loudly at load, like the cards do.
// Adding a concept, a feedback phrasing or a real-world fact is a JSON edit only.
import { termIds } from '../i18n/markup.js';

/** Feedback groups the UI can trigger (spec section 2). Unknown groups in the JSON are an error. */
export const FEEDBACK_GROUPS = [
  'buy.good', 'buy.ok', 'buy.bad', 'buy.trap', 'buy.stock', 'buy.diversify',
  'pass.goodDeal', 'pass.neutral', 'pass.bad', 'pass.trap', 'pass.cantAfford',
  'loan.sensible', 'loan.costly', 'loan.repaid',
  'expense.cushion', 'expense.loan', 'expense.forcedSale',
  'charity.donate', 'charity.skip', 'baby', 'baby.max',
  'market.sold', 'market.kept', 'market.priceUp', 'market.priceDown', 'market.cashGood', 'market.cashBad',
  'win', 'lose', 'end.neutral', 'win.fastPayback', 'win.diversified', 'win.noBankLoan',
];
export const CONCEPT_LEVELS = ['family', 'full'];
export const GLOSSARY_SLOTS = ['months', 'monthlyRate', 'rate', 'amount', 'monthlyPayment', 'interest', 'total'];

const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const slotsIn = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

export function validateLearn({ glossary, feedback, report, guess, realWorld }, { cards = [] } = {}) {
  const errors = [];
  const err = (m) => errors.push(m);

  // ---- glossary ----
  const ui = glossary?.ui ?? {};
  for (const k of ['explainTitle', 'dictionaryTitle', 'whyLabel', 'exampleLabel', 'simplificationLabel', 'realWorldLabel', 'gotIt', 'newTerm']) {
    if (!isStr(ui[k])) err(`glossary.ui.${k}`);
  }
  const ids = new Set();
  const list = glossary?.concepts;
  if (!Array.isArray(list) || !list.length) err('glossary.concepts must be a non-empty array');
  for (const c of list ?? []) {
    const w = `concept ${c?.id}`;
    if (!isStr(c.id) || !/^[a-z_]+$/.test(c.id)) err(`${w}: id`);
    if (ids.has(c.id)) err(`${w}: duplicate id`);
    ids.add(c.id);
    if (!Number.isInteger(c.order)) err(`${w}: order`);
    if (!CONCEPT_LEVELS.includes(c.level)) err(`${w}: level`);
    for (const k of ['term', 'short', 'why']) if (!isStr(c[k])) err(`${w}: ${k}`);
    if (!isStr(c.example?.text)) err(`${w}: example.text`);
    if (c.gameSimplification != null && !isStr(c.gameSimplification)) err(`${w}: gameSimplification must be text or null`);
    for (const k of ['short', 'why']) {
      if (/\{\w+\}/.test(c[k] ?? '')) err(`${w}: ${k} may not use slots`);
    }
    for (const text of [c.example?.text, c.gameSimplification]) {
      for (const sl of slotsIn(text ?? '')) if (!GLOSSARY_SLOTS.includes(sl)) err(`${w}: unknown slot {${sl}}`);
    }
  }

  // ---- feedback ----
  const declared = new Set(Object.keys(feedback?.notes?.slots ?? {}));
  const groups = feedback?.lines ?? {};
  for (const [g, v] of Object.entries(groups)) {
    if (!FEEDBACK_GROUPS.includes(g)) err(`feedback: unknown group ${g}`);
    const variants = Object.keys(v ?? {});
    if (!variants.length) err(`feedback ${g}: no lines`);
    for (const variant of variants) {
      if (!['family', 'full', 'all'].includes(variant)) err(`feedback ${g}: unknown variant ${variant}`);
      const arr = v[variant];
      if (!Array.isArray(arr) || !arr.length || arr.some((x) => !isStr(x))) err(`feedback ${g}.${variant}: needs non-empty strings`);
      for (const line of arr ?? []) {
        for (const sl of slotsIn(line)) if (!declared.has(sl)) err(`feedback ${g}.${variant}: undeclared slot {${sl}}`);
        if (variant === 'family' && /^loan\./.test(g) && line.includes('{rate}')) err(`feedback ${g}.family: {rate} is full mode only`);
      }
    }
  }
  for (const g of FEEDBACK_GROUPS) if (!groups[g]) err(`feedback: missing group ${g}`);

  // ---- report ----
  for (const k of ['title']) if (!isStr(report?.[k])) err(`report.${k}`);
  for (const k of ['win', 'lose']) if (!isStr(report?.subtitle?.[k])) err(`report.subtitle.${k}`);
  for (const k of ['bestDeal', 'worstDeal', 'interest', 'greenDecisions', 'concepts']) if (!report?.sections?.[k]) err(`report.sections.${k}`);
  for (const k of ['highInterest', 'noCushion', 'manyRed', 'noDiversify', 'allGood', 'fallback']) if (!isStr(report?.nextStep?.tips?.[k])) err(`report.nextStep.tips.${k}`);
  for (const mode of ['family', 'full']) {
    const themes = report?.conversation?.[mode];
    if (!themes || !Object.keys(themes).length) err(`report.conversation.${mode}`);
    for (const [name, th] of Object.entries(themes ?? {})) {
      if (!isStr(th.title) || !Array.isArray(th.questions) || th.questions.length < 3) err(`report.conversation.${mode}.${name}: title + 3 questions`);
    }
  }

  // ---- guess ----
  for (const k of ['good', 'bad', 'reveal', 'title']) if (!isStr(guess?.prompt?.[k])) err(`guess.prompt.${k}`);
  for (const l of ['green', 'yellow', 'red']) for (const k of ['label', 'legend', 'a11y']) if (!isStr(guess?.lights?.[l]?.[k])) err(`guess.lights.${l}.${k}`);
  for (const k of ['green', 'yellow', 'red', 'redNever']) if (!Array.isArray(guess?.verdict?.[k]) || !guess.verdict[k].length) err(`guess.verdict.${k}`);
  for (const k of ['correct', 'wrong', 'yellowAny', 'skipped']) if (!Array.isArray(guess?.guessResult?.[k]) || !guess.guessResult[k].length) err(`guess.guessResult.${k}`);
  for (const k of ['progress', 'earned', 'endOfGame']) if (!isStr(guess?.investorEye?.[k])) err(`guess.investorEye.${k}`);

  // ---- real world ----
  const cardIds = new Set(cards.map((c) => c.id));
  const factIds = new Set();
  for (const f of realWorld?.facts ?? []) {
    const w = `fact ${f?.id}`;
    if (!isStr(f.id)) err('fact without id');
    if (factIds.has(f.id)) err(`${w}: duplicate id`);
    factIds.add(f.id);
    if (!isStr(f.game) || !isStr(f.real)) err(`${w}: game and real text`);
    if (!ids.has(f.concept)) err(`${w}: concept ${f.concept} is not a glossary id`);
    for (const id of f.cardIds ?? []) if (cards.length && !cardIds.has(id)) err(`${w}: unknown card ${id}`);
    if (f.numbers && typeof f.numbers.publish !== 'boolean') err(`${w}: numbers.publish must be true/false`);
  }
  for (const k of ['title', 'gameLabel', 'realLabel', 'disclaimer']) if (!isStr(realWorld?.ui?.[k])) err(`real-world.ui.${k}`);

  // ---- markup in every learn text resolves ----
  const texts = JSON.stringify({ glossary, feedback, report, guess, realWorld });
  for (const id of termIds(texts)) if (!ids.has(id)) err(`unknown term id in learn text: ${id}`);

  return errors;
}

export function validateLearnOrThrow(learn, opts) {
  const errors = validateLearn(learn, opts);
  if (errors.length) throw new Error(`Invalid learning content:\n- ${errors.join('\n- ')}`);
  return true;
}
