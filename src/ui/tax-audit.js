// v4 stage 4: the 'ביקורת רשות המסים' square. One question from src/data/learn/quiz-tax.he.json in the guess-first mechanic: the
// player picks an answer (or skips), then the reveal names the right one with a one-line fox reaction, the explanation, the
// "נכון ל-2026" tag and the source link (`ref`, kept by the build prune). Family mode asks the family variants. The reward is
// knowledge points and the badge only: the card never shows or changes money (engine.answerAudit).
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { learnContent } from '../learn/content.js';
import { cardShell } from './modals.js';
import { button } from './widgets.js';
import { icon } from './icons.js';
import { haptic } from './fx.js';
import { readJSON, writeJSON } from '../services/storage.js';
import { earnBadge, hasBadge } from '../learn/store.js';

const fill = (s, slots) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in slots ? String(slots[k]) : m));

/** The questions of a mode: full = every question; family = the family variants (same id, ref and asOf). */
export function auditPool(quiz, mode) {
  if (mode !== 'family') return quiz.questions;
  return quiz.questions.filter((q) => q.family).map((q) => ({ ...q, ...q.family, family: undefined }));
}

/** The question for an engine pick: pick % pool size, then the next one not asked yet in this game (deterministic). */
export function auditQuestion(quiz, mode, pick, asked = []) {
  const pool = auditPool(quiz, mode);
  const done = new Set(asked.map((a) => a.questionId));
  for (let k = 0; k < pool.length; k++) {
    const q = pool[(pick + k) % pool.length];
    if (!done.has(q.id)) return q;
  }
  return pool[pick % pool.length];
}

/** Options in a stable shuffled order for this pick (the UI shuffles; the same pick always shows the same order). */
export function shuffledOptions(options, pick) {
  const a = [...options];
  let x = (pick * 2654435761) >>> 0;
  for (let i = a.length - 1; i > 0; i--) { x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9E3779B9) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** "נכון ל-2026" + the source link (opens a new tab). */
export function asOfLine(ui, { asOf, ref }) {
  return h('p', { class: 'audit-meta' },
    h('span', { class: 'asof-tag' }, fill(ui.asOfLabel, { asOf })),
    ref?.url ? h('a', { class: 'src-link', href: ref.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('taxAudit.linkA11y', { name: `${ui.sourceLabel}: ${ref.name}` }) }, `${ui.sourceLabel}: ${ref.name}`) : null);
}

const TAX_CORRECT_KEY = 'learn.taxCorrect';
/** Device-level count of correct answers; the badge comes at reward.badge.goal (in total, not in a row). Returns the earned text or null. */
export function countCorrect(quiz, mode) {
  const n = (Number(readJSON(TAX_CORRECT_KEY, 0)) || 0) + 1;
  writeJSON(TAX_CORRECT_KEY, n);
  const b = quiz.reward.badge;
  if (n >= b.goal && !hasBadge(b.id)) {
    earnBadge(b.id);
    return mode === 'family' ? (quiz.reward.familyBadge?.earned ?? b.earned) : b.earned;
  }
  return null;
}

/** Opens the quiz for the pending tax audit. Resolves { questionId, correct } (correct: true | false | null = skipped). */
export function taxAuditModal(state) {
  const quiz = learnContent().quizTax;
  const ui = quiz.ui;
  const { pick } = state.pending;
  const q = auditQuestion(quiz, state.mode, pick, state.taxAudit?.asked ?? []);
  const opts = shuffledOptions(q.options, pick);
  const ctl = {};
  let answered = false;
  const resultLine = (kind) => { const list = quiz.result[kind]; return list[(pick + (state.taxAudit?.asked?.length ?? 0)) % list.length]; };
  const points = (correct) => (state.taxAudit?.points ?? 0) + (correct === true ? quiz.reward.pointsPerCorrect : 0);

  const optBtns = opts.map((o) => button(o.text, {
    variant: 'secondary', cls: 'audit-opt', 'data-action': `answer-${o.id}`, 'data-option': o.id,
    onClick: () => reveal(o),
  }));
  const ask = h('section', { class: 'guess-prompt audit-ask', 'data-guess-block': 'ask' },
    h('p', { class: 'guess-sub' }, ui.subtitle),
    h('p', { class: 'audit-q' }, q.prompt),
    h('div', { class: 'audit-opts', role: 'group', 'aria-label': q.prompt }, optBtns));

  function reveal(picked) {
    if (answered) return;
    answered = true;
    const correct = picked ? picked.correct === true : null;
    haptic(correct ? 'purchase' : 'tap');
    const right = q.options.find((o) => o.correct);
    for (const b of optBtns) {
      const o = q.options.find((x) => x.id === b.dataset.option);
      b.disabled = true;
      b.dataset.correct = String(!!o.correct);
      if (picked && o.id === picked.id) b.dataset.picked = 'true';
    }
    const kind = correct === null ? 'skipped' : correct ? 'correct' : 'wrong';
    const block = h('section', { class: 'reveal audit-reveal', role: 'status', 'data-result': kind },
      h('p', { class: 'audit-result' }, correct ? ui.correctTitle : ui.explainTitle),
      h('p', { class: 'audit-text' }, resultLine(kind)),
      h('p', { class: 'audit-text' }, h('b', null, `${right.text}: `), right.feedback),
      picked && !correct ? h('p', { class: 'audit-text' }, h('b', null, `${picked.text}: `), picked.feedback) : null,
      h('p', { class: 'audit-text' }, q.explanation),
      asOfLine(ui, q),
      h('p', { class: 'audit-points' }, icon('star', { size: 16, width: 2.6 }), ' ', t('taxAudit.pointsLine', { points: points(correct) })),
      h('p', { class: 'audit-nomoney' }, ui.noMoney),
      h('p', { class: 'audit-nomoney' }, ui.disclaimer));
    ctl.body.append(block);
    block.scrollIntoView?.({ block: 'nearest' });
    ctl.setActions([{ id: 'ok', label: ui.continue, variant: 'primary', autofocus: true, value: { questionId: q.id, correct } }]);
  }

  return cardShell({
    type: 'taxAudit', kind: null, headChip: null, title: ui.title, text: null, body: [ask], ctl,
    data: { audit: q.id },
    actions: [{ id: 'decline', label: ui.skip, variant: 'secondary', run: () => reveal(null) }],
  });
}
