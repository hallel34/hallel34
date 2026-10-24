// Rich text: {param} slots (strings or DOM nodes, e.g. money() <bdi>) and glossary markup [[term:id|display]] become DOM.
// A term turns into a dashed-underline button (class .term, data-term=id, aria-haspopup=dialog) that opens
// 'המילון של מקסי' (a delegated handler in ui/learn.js). Unknown ids, and terms the current mode does not have
// (e.g. net worth in family mode), render as plain text. Mark a term only once per screen with a scope.
import { h } from './dom.js';
import { parseMarkup } from '../i18n/markup.js';
import { getLearnMode } from '../learn/context.js';
import { conceptAvailable, conceptById, termName } from '../learn/content.js';

/** Tracks which terms were already turned into buttons on one screen / card / sheet (first occurrence only). */
export const createTermScope = () => {
  const used = new Set();
  return { has: (id) => used.has(id), add: (id) => used.add(id), clear: () => used.clear() };
};

export function termButton(id, display) {
  return h('button', { type: 'button', class: 'term', 'data-term': id, 'aria-haspopup': 'dialog' }, h('span', { class: 'term-t' }, display));
}

function slotNodes(text, params, used = new Set()) {
  const out = [];
  for (const part of text.split(/(\{\w+\})/)) {
    const m = part.match(/^\{(\w+)\}$/);
    if (m && m[1] in params) {
      const v = params[m[1]];
      // a node can sit in the DOM once: the first use keeps the live node (callers update it later), repeats get a copy
      if (v?.nodeType) { out.push(used.has(v) ? v.cloneNode(true) : v); used.add(v); } else out.push(String(v));
    } else if (part) out.push(part);
  }
  return out;
}

/** DocumentFragment for a raw (marked-up) string. */
export function richNodes(raw, params = {}, { scope = null, mode = getLearnMode() } = {}) {
  const frag = document.createDocumentFragment();
  const used = new Set();
  for (const part of parseMarkup(raw)) {
    if (!part.term) { frag.append(...slotNodes(part.text, params, used)); continue; }
    const c = conceptById(part.term);
    if (!c && import.meta.env?.DEV) console.warn(`[glossary] unknown term id in markup: ${part.term}`);
    const display = part.display || termName(part.term, mode) || '';
    if (c && conceptAvailable(part.term, mode) && !scope?.has(part.term)) {
      scope?.add(part.term);
      frag.append(termButton(part.term, display));
    } else frag.append(...slotNodes(display, params, used));
  }
  return frag;
}
