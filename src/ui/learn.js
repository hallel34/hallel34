// L1 in the UI: the glossary ('המילון של פסיבו'), term buttons everywhere, and the record of what was explained.
// One delegated click handler opens the dictionary for any <button class="term" data-term="...">.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { icon } from './icons.js';
import { foxImg } from './fox.js';
import { learnContent, conceptById, dictionaryOrder, glossaryUi, conceptAvailable } from '../learn/content.js';
import { getLearnMode } from '../learn/context.js';
import { glossarySlots, fillSlots } from '../learn/slots.js';
import { factsForConcept, realWorldView } from '../learn/rw.js';
import { seenConcepts, markConceptSeen } from '../learn/store.js';
import { getPrefs } from './prefs.js';

// The game screen registers what to do when a concept is unlocked (it records it in the player's state for the report).
let hooks = { onUnlock: null };
export const setLearnHooks = (next) => { hooks = { onUnlock: null, ...next }; };
export const clearLearnHooks = () => { hooks = { onUnlock: null }; };

/** Concept explained / opened: remembered on the device, and in the current game through the hook. */
export function recordSeen(id) {
  markConceptSeen(id);
  hooks.onUnlock?.(id);
}

/** Are the automatic 'פסיבו מסביר' explainers on? (The dictionary always works.) */
export const explainEnabled = () => getPrefs().explain !== false;

const section = (label, ...kids) => h('section', { class: 'dict-sec' }, h('h4', { class: 'dict-label' }, label), ...kids);

/** Detail of one concept: short, why, example, what the game simplifies, real-world notes. */
export function conceptDetail(c) {
  const ui = glossaryUi();
  const slots = glossarySlots(c);
  const facts = factsForConcept(c.id).map(realWorldView);
  return h('article', { class: 'dict-detail', 'data-concept': c.id },
    h('div', { class: 'dict-hero' },
      h('div', { class: 'dict-hero-text' }, h('p', { class: 'dict-kicker' }, ui.explainTitle), h('h3', { class: 'dict-term' }, c.term)),
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
            h('strong', { class: 'dict-item-term' }, c.term),
            seen.has(c.id) ? null : h('span', { class: 'dict-new' }, ui.newTerm)),
          h('span', { class: 'dict-item-short' }, c.short),
          icon('arrow', { size: 20, width: 2.6 }))))));
    scroll.scrollTop = 0;
    (scroll.querySelector(`[data-concept="${focusId}"]`) ?? scroll).focus?.({ preventScroll: true });
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
