// Schema validation for the v4 "real world" learn files (v4 stage 4): quiz-tax (the tax-audit square), guide (lessons + the
// statement popover) and israel (adult real-world concepts). Fails loudly at load, like the cards do. Adding a question = JSON.
// The "never ship the held Bank of Israel figure" rule is a test (tests/v4-stage4.test.js), so the figure never appears in code.
const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const isUrl = (x) => isStr(x) && /^https:\/\//.test(x);

/** A one-correct multiple choice block { prompt, options[{ id, text, correct, feedback }], explanation }. */
function choiceErrors(q, w, { explanationKey = 'explanation' } = {}) {
  const e = [];
  if (!isStr(q?.prompt)) e.push(`${w}: prompt`);
  if (!Array.isArray(q?.options) || q.options.length < 2 || q.options.length > 4) { e.push(`${w}: 2-4 options`); return e; }
  const ids = new Set();
  for (const o of q.options) {
    if (!isStr(o.id) || ids.has(o.id)) e.push(`${w}: option id ${o.id}`);
    ids.add(o.id);
    if (!isStr(o.text)) e.push(`${w}: option ${o.id} text`);
    if (typeof o.correct !== 'boolean') e.push(`${w}: option ${o.id} correct must be true/false`);
    if (!isStr(o.feedback)) e.push(`${w}: option ${o.id} feedback`);
  }
  if (q.options.filter((o) => o.correct === true).length !== 1) e.push(`${w}: exactly one option is correct`);
  if (!isStr(q[explanationKey])) e.push(`${w}: ${explanationKey}`);
  return e;
}
const refErrors = (x, w) => (x?.ref && isStr(x.ref.name) && isUrl(x.ref.url) ? [] : [`${w}: ref { name, url (https) } is required (the link shown with the as-of tag; source is pruned from the build)`]);
export function validateQuizTax(q) {
  const e = [];
  if (!q || !Array.isArray(q.questions) || !q.questions.length) return ['quiz-tax: questions'];
  for (const k of ['title', 'subtitle', 'showAnswer', 'skip', 'continue', 'explainTitle', 'correctTitle', 'asOfLabel', 'sourceLabel', 'noMoney', 'disclaimer']) if (!isStr(q.ui?.[k])) e.push(`quiz-tax.ui.${k}`);
  if (!String(q.ui?.asOfLabel).includes('{asOf}')) e.push('quiz-tax.ui.asOfLabel needs {asOf}');
  for (const k of ['correct', 'wrong', 'skipped']) if (!Array.isArray(q.result?.[k]) || !q.result[k].every(isStr)) e.push(`quiz-tax.result.${k}`);
  const r = q.reward;
  if (!Number.isInteger(r?.pointsPerCorrect) || r.pointsPerCorrect < 1) e.push('quiz-tax.reward.pointsPerCorrect');
  for (const k of ['id', 'badgeName', 'description', 'earned', 'earnedShort']) if (!isStr(r?.badge?.[k])) e.push(`quiz-tax.reward.badge.${k}`);
  if (!Number.isInteger(r?.badge?.goal) || r.badge.goal < 1) e.push('quiz-tax.reward.badge.goal');
  for (const k of ['cash', 'money', 'amount', 'income']) if (r && k in r) e.push(`quiz-tax.reward.${k}: the quiz never changes money`);
  const ids = new Set();
  for (const x of q.questions) {
    const w = `quiz-tax ${x?.id}`;
    if (!isStr(x.id) || ids.has(x.id)) e.push(`${w}: id`);
    ids.add(x.id);
    e.push(...choiceErrors(x, w));
    if (!isStr(x.asOf)) e.push(`${w}: asOf`);
    e.push(...refErrors(x, w));
    if (x.family !== undefined) e.push(...choiceErrors(x.family, `${w} family`));
  }
  if (!q.questions.some((x) => x.family)) e.push('quiz-tax: family mode needs at least one question with a family variant');
  return e;
}

export function validateGuide(g) {
  const e = [];
  if (!g) return ['guide: missing'];
  for (const k of ['title', 'asOfLabel', 'sourceLabel', 'realLabel', 'gameLabel', 'disclaimer']) if (!isStr(g.ui?.[k])) e.push(`guide.ui.${k}`);
  const p = g.statementPopover;
  if (!p) return [...e, 'guide.statementPopover'];
  for (const k of ['title', 'short', 'gameNote', 'asOf']) if (!isStr(p[k])) e.push(`guide.statementPopover.${k}`);
  for (const k of ['incomeTax', 'nationalInsurance']) {
    if (!isStr(p[k]?.title) || !Array.isArray(p[k]?.rows) || !p[k].rows.every((r) => isStr(r.label) && isStr(r.value))) e.push(`guide.statementPopover.${k}`);
  }
  e.push(...refErrors(p, 'guide.statementPopover'));
  return e;
}

export function validateIsrael(x, { glossaryIds = new Set() } = {}) {
  const e = [];
  if (!x || !Array.isArray(x.concepts)) return ['israel: concepts'];
  for (const k of ['title', 'asOfLabel', 'sourceLabel', 'disclaimer']) if (!isStr(x.ui?.[k])) e.push(`israel.ui.${k}`);
  const ids = new Set();
  for (const c of x.concepts) {
    const w = `israel ${c?.id}`;
    if (!/^[a-z_]+$/.test(c.id ?? '') || ids.has(c.id)) e.push(`${w}: id`);
    if (glossaryIds.has(c.id)) e.push(`${w}: collides with a glossary id`);
    ids.add(c.id);
    for (const k of ['term', 'short', 'asOf']) if (!isStr(c[k])) e.push(`${w}: ${k}`);
    e.push(...refErrors(c, w));
  }
  return e;
}

export function validateV4Learn({ quizTax, guide, israel }, { glossaryIds } = {}) {
  return [...validateQuizTax(quizTax), ...validateGuide(guide), ...validateIsrael(israel, { glossaryIds })];
}
