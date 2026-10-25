// L1 in the UI: the glossary ('המילון של מקסי'), term buttons everywhere, and the record of what was explained.
// One delegated click handler opens the dictionary for any <button class="term" data-term="...">.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { icon } from './icons.js';
import { foxImg } from './fox.js';
import { learnContent, conceptById, dictionaryOrder, glossaryUi, conceptAvailable, termName, hasKidName, kidOf } from '../learn/content.js';
import { getLearnMode } from '../learn/context.js';
import { glossarySlots, fillSlots } from '../learn/slots.js';
import { factsForConcept, realWorldView, publishedFigure } from '../learn/rw.js';

const figureLine = (f, asOf) => (f ? h('p', { class: 'guide-figure', 'data-verified': f.verified ?? '' }, h('b', null, f.text), ' ', h('span', { class: 'asof-tag' }, asOf)) : null);
import { seenConcepts, markConceptSeen } from '../learn/store.js';
import { getPrefs } from './prefs.js';
import { asOfLine } from './tax-audit.js';
import { LOAN_APR_NOMINAL, LOAN_PAYMENT_RATE } from '../engine/index.js';

// The game screen registers what to do when a concept is unlocked (it records it in the player's state for the report).
let hooks = { onUnlock: null };
export const setLearnHooks = (next) => { hooks = { onUnlock: null, ...next }; };
export const clearLearnHooks = () => { hooks = { onUnlock: null }; };

/** Concept explained / opened: remembered on the device, and in the current game through the hook. */
export function recordSeen(id) {
  markConceptSeen(id);
  hooks.onUnlock?.(id);
}

/** Are the automatic 'מקסי מסביר' explainers on? (The dictionary always works.) */
export const explainEnabled = () => getPrefs().explain !== false;

/** 'המילה המקצועית: הכנסה פסיבית' (family mode: the real term under the kid name). */
export const professionalWord = (term) => learnContent().tutorial.ui.professionalWord.replace('{term}', term);

const section = (label, ...kids) => h('section', { class: 'dict-sec' }, h('h4', { class: 'dict-label' }, label), ...kids);

/** Detail of one concept: short, why, example, what the game simplifies, real-world notes. */
export function conceptDetail(c) {
  const ui = glossaryUi();
  const slots = glossarySlots(c);
  const facts = factsForConcept(c.id).map((f) => realWorldView(f));
  return h('article', { class: 'dict-detail', 'data-concept': c.id },
    h('div', { class: 'dict-hero' },
      h('div', { class: 'dict-hero-text' }, h('p', { class: 'dict-kicker' }, ui.explainTitle), h('h3', { class: 'dict-term' }, termName(c.id)),
        hasKidName(c.id) ? h('p', { class: 'dict-pro', 'data-pro': c.id }, professionalWord(c.term)) : null),
      foxImg('tip', { height: 84, cls: 'dict-fox' })),
    h('p', { class: 'dict-short' }, c.short),
    section(ui.whyLabel, h('p', null, c.why)),
    section(ui.exampleLabel, h('p', { class: 'dict-example' }, fillSlots(c.example.text, slots))),
    c.gameSimplification ? section(ui.simplificationLabel, h('p', null, fillSlots(c.gameSimplification, slots))) : null,
    facts.length
      ? section(ui.realWorldLabel, ...facts.map((f) => h('p', { 'data-fact': f.id }, f.real)), h('p', { class: 'rw-disclaimer' }, facts[0].disclaimer))
      : null);
}

/** Opens the dictionary sheet; with `termId` straight on that concept (the back button returns to the list). */
export function openDictionary({ termId = null } = {}) {
  const mode = getLearnMode();
  const ui = glossaryUi();
  let layer;
  const scroll = h('div', { class: 'sheet-scroll dict-scroll', tabindex: '0', role: 'region', 'aria-label': ui.dictionaryTitle });
  const title = h('h2', { class: 'dialog-title' }, ui.dictionaryTitle);

  /** Lists the concepts; focus returns to the entry that was just closed (a re-render drops the focused node). */
  function showList(focusId = null) {
    const seen = seenConcepts();
    scroll.replaceChildren(
      h('p', { class: 'dict-hint' }, t('learn.dictionaryHint')),
      h('ul', { class: 'dict-list' }, dictionaryOrder(mode).map((c) => h('li', null,
        h('button', { type: 'button', class: 'dict-item', 'data-concept': c.id, onClick: () => showDetail(c.id) },
          h('span', { class: 'dict-item-main' },
            h('strong', { class: 'dict-item-term' }, termName(c.id)),
            seen.has(c.id) ? null : h('span', { class: 'dict-new' }, ui.newTerm)),
          hasKidName(c.id) ? h('span', { class: 'dict-pro dict-pro-sm' }, professionalWord(c.term)) : null,
          h('span', { class: 'dict-item-short' }, hasKidName(c.id) ? kidOf(c.id).kidShort : c.short),
          icon('arrow', { size: 20, width: 2.6 }))))),
      // v4 stage 4 (full mode): the Israeli money rules of israel.he.json as their own group under the game concepts (real-world
      // facts, "נכון ל-2026" + link); the glossary list and its counts are unchanged
      israelGroup(), guideGroup());
    scroll.scrollTop = 0;
    (scroll.querySelector(`[data-concept="${focusId}"]`) ?? scroll).focus?.({ preventScroll: true });
  }
  function israelGroup() {
    const il = learnContent().israel;
    if (mode !== 'full' || !il?.concepts?.length) return null;
    return h('section', { class: 'dict-rw', 'aria-label': il.ui.title },
      h('h3', { class: 'dict-rw-title' }, il.ui.title), h('p', { class: 'dict-hint' }, il.ui.subtitle),
      h('ul', { class: 'dict-list' }, [...il.concepts].sort((a, b) => a.order - b.order).map((c) => h('li', null,
        h('button', { type: 'button', class: 'dict-rw-item', 'data-rw': c.id, onClick: () => showIsrael(c) },
          h('span', { class: 'dict-item-main' }, h('strong', { class: 'dict-item-term' }, c.term)),
          h('span', { class: 'dict-item-short' }, c.short),
          icon('arrow', { size: 20, width: 2.6 }))))));
  }
  // v4 stage 4 (full mode): the guide's three real-world lessons (guide.he.json), each one scroll: its screens in order with the
  // "בעולם האמיתי" / "במשחק" tag, the guess-first question after its screen, a published figure with its as-of tag, and the link
  function guideGroup() {
    const g = learnContent().guide;
    if (mode !== 'full' || !g?.lessons?.length) return null;
    return h('section', { class: 'dict-rw dict-guide', 'aria-label': g.ui.title },
      h('h3', { class: 'dict-rw-title' }, g.ui.title), h('p', { class: 'dict-hint' }, g.ui.subtitle),
      h('ul', { class: 'dict-list' }, [...g.lessons].sort((a, b) => a.order - b.order).map((l) => h('li', null,
        h('button', { type: 'button', class: 'dict-rw-item', 'data-lesson': l.id, onClick: () => showLesson(l) },
          h('span', { class: 'dict-item-main' }, h('strong', { class: 'dict-item-term' }, l.title)),
          icon('arrow', { size: 20, width: 2.6 }))))));
  }
  function showLesson(l) {
    const g = learnContent().guide;
    const slots = { rate: `${LOAN_APR_NOMINAL}%`, monthlyRate: `${Math.round(LOAN_PAYMENT_RATE * 10000) / 100}%` };
    const fillS = (x) => String(x).replace(/\{(\w+)\}/g, (m, k) => slots[k] ?? m);
    const guess = l.guess ? (() => {
      const out = h('div', { class: 'guide-guess-out', role: 'status' });
      const btns = l.guess.options.map((o) => h('button', { type: 'button', class: 'dict-rw-item guide-opt', 'data-option': o.id, onClick: () => {
        btns.forEach((b) => { b.disabled = true; });
        out.replaceChildren(h('p', null, icon(o.correct ? 'check' : 'close', { size: 16, width: 3 }), ' ', o.feedback), h('p', null, l.guess.explain));
      } }, h('span', { class: 'dict-item-main' }, o.text)));
      return h('section', { class: 'guide-guess' }, h('h4', null, g.ui.guessTitle), h('p', { class: 'dict-sub' }, g.ui.guessSubtitle), h('p', null, h('b', null, l.guess.prompt)), h('div', { class: 'dict-list' }, btns), out);
    })() : null;
    const screens = l.screens.flatMap((sc, i) => [
      h('section', { class: 'guide-screen', 'data-screen-id': sc.id },
        h('p', { class: 'rw-badge' }, sc.game ? g.ui.gameLabel : g.ui.realLabel),
        h('h4', null, sc.title), h('p', null, fillS(sc.text)),
        Array.isArray(sc.table) ? h('table', { class: 'rw-table' }, h('tbody', null, sc.table.map((r) => h('tr', null, h('td', null, r.label), h('td', null, h('bdi', { dir: 'ltr' }, r.value)))))) : null,
        figureLine(publishedFigure(sc), g.ui.asOfLabel.replace('{asOf}', l.asOf))),
      i === l.guess?.afterScreen ? guess : null]);
    scroll.replaceChildren(
      h('button', { type: 'button', class: 'dict-back', 'data-action': 'dict-back', onClick: () => showList() }, icon('arrow', { size: 20, width: 2.8, cls: 'dict-back-icon' }), h('span', null, t('learn.back'))),
      h('article', { class: 'dict-entry dict-rw-entry dict-lesson', 'data-lesson': l.id }, h('h3', { class: 'dict-term' }, l.title), ...screens,
        asOfLine(g.ui, l), h('p', { class: 'dict-sub' }, g.ui.disclaimer)));
    scroll.scrollTop = 0;
    scroll.focus({ preventScroll: true });
  }
  function showIsrael(c) {
    const il = learnContent().israel;
    scroll.replaceChildren(
      h('button', { type: 'button', class: 'dict-back', 'data-action': 'dict-back', onClick: () => showList() }, icon('arrow', { size: 20, width: 2.8, cls: 'dict-back-icon' }), h('span', null, t('learn.back'))),
      h('article', { class: 'dict-entry dict-rw-entry' },
        h('p', { class: 'rw-badge' }, il.ui.realWorldBadge),
        h('h3', { class: 'dict-term' }, c.term),
        h('p', null, c.short),
        c.why ? h('p', null, c.why) : null,
        c.example?.text ? h('p', null, c.example.text) : null,
        Array.isArray(c.table) ? h('table', { class: 'rw-table' }, h('tbody', null, c.table.map((r) => h('tr', null, h('td', null, r.label), h('td', null, h('bdi', { dir: 'ltr' }, r.value)))))) : null,
        c.gameSimplification ? h('p', { class: 'dict-sub' }, c.gameSimplification) : null,
        asOfLine(il.ui, c),
        h('p', { class: 'dict-sub' }, il.ui.disclaimer)));
    scroll.scrollTop = 0;
    scroll.focus({ preventScroll: true });
  }
  function showDetail(id) {
    const c = conceptById(id);
    if (!c || !conceptAvailable(id, mode)) { showList(); return; }
    recordSeen(id);
    scroll.replaceChildren(
      h('button', { type: 'button', class: 'dict-back', 'data-action': 'dict-back', onClick: () => showList(id) }, icon('arrow', { size: 20, width: 2.8, cls: 'dict-back-icon' }), h('span', null, t('learn.back'))),
      conceptDetail(c));
    scroll.scrollTop = 0;
    scroll.focus({ preventScroll: true });
  }

  const content = h('div', { class: 'sheet dict-sheet', 'data-sheet': 'dictionary' },
    h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i', null)),
    h('div', { class: 'sheet-head' }, title,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), onClick: () => layer.close() }, icon('close', { size: 22 }))),
    scroll);
  layer = openLayer(content, { kind: 'sheet', label: ui.dictionaryTitle });
  if (termId && conceptById(termId)) showDetail(termId); else showList();
  return layer;
}

let wired = false;
/** Installs the one click handler behind every term button (idempotent). */
export function initTermButtons() {
  if (wired) return;
  wired = true;
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button.term') : null;
    if (!b) return;
    e.preventDefault();
    openDictionary({ termId: b.dataset.term });
  });
  learnContent(); // validates the learning content once, loudly, at startup
}
