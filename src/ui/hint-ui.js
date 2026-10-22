// Pieces shared by the guided hints and the itemised summary: the highlight ring (art.md section 5), the hint strip that sits
// inside a card / the summary / the loan window, and the template -> DOM helper. Small on purpose: the story, the quiz and the
// parent card live in src/ui/tutorial/ and load lazily; this file is what the board needs at once.
import { h } from './dom.js';
import { foxImg } from './fox.js';
import { richNodes } from './rich.js';
import { money } from './format.js';
import { learnContent } from '../learn/content.js';
import { t } from '../i18n/index.js';
import { freedomView, leftTemplate } from '../learn/tutorial.js';
import { motionOK } from './prefs.js';

/** The validated tutorial content (src/data/learn/tutorial.he.json). */
export const tut = () => learnContent().tutorial;
export const hintDef = (id) => tut().hints.items.find((i) => i.id === id);
export const hintMaxChars = () => tut().hints.bubble.maxChars;
export const hintMoreAllowed = () => window.innerHeight >= tut().hints.bubble.moreFromHeightPx;

/** A money value as the <bdi dir=ltr> node the UI uses everywhere. */
export const amount = (n, opts) => money(n, opts);
/** Template -> DOM nodes: {slot} values may be strings or nodes (a node used twice is cloned), glossary markup becomes terms. */
export const fillNodes = (template, slots = {}) => richNodes(template, Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v?.nodeType ? v.cloneNode(true) : v])));
// (every call clones the node slots: the same figure can fill the text AND the 'more' line of one hint without being moved out of the first)

// ---------- highlight ring ----------
/**
 * A gold ring around `target` (outline only: it never covers, never takes a tap, never dims anything else). Appears with a
 * 220ms scale-in, the glow pulses three times, then it holds still; reduced motion: a still ring. It follows the target while
 * the target moves (a scrolling card). Returns { move(target), remove() }.
 */
export function showRing(target, { onCream = false, holdMs = 12000, avoid = null } = {}) {
  let node = null;
  let raf = 0;
  let current = null;
  let stopTimer = 0;
  const host = () => document.getElementById('fx-layer') ?? document.body;
  const place = () => {
    if (!node || !current?.isConnected) return;
    const r = current.getBoundingClientRect();
    node.style.inlineSize = `${r.width}px`;
    node.style.blockSize = `${r.height}px`;
    node.style.transform = `translate(${r.left}px, ${r.top}px)`;
    node.hidden = r.width === 0 || r.height === 0;
    // never over a pinned control: when the target slides under (or next to) `avoid` (the dialog's button bar) the ring steps aside
    const bar = typeof avoid === 'function' ? avoid() : avoid;
    if (bar?.isConnected && !node.hidden) { const b = bar.getBoundingClientRect(); if (r.bottom + 10 > b.top && r.top - 10 < b.bottom && r.right + 10 > b.left && r.left - 10 < b.right) node.hidden = true; }
    raf = requestAnimationFrame(place);
  };
  const api = {
    move(next, opts = {}) {
      current = next;
      if (!next) { node?.remove(); node = null; cancelAnimationFrame(raf); return; }
      if (!node) {
        node = h('div', { class: `hint-ring${(opts.onCream ?? onCream) ? ' on-cream' : ''}${motionOK() ? '' : ' is-still'}`, 'aria-hidden': 'true' });
        host().append(node);
      } else node.classList.toggle('on-cream', !!(opts.onCream ?? onCream));
      cancelAnimationFrame(raf);
      next.scrollIntoView?.({ block: 'nearest' });
      place();
    },
    remove() { clearTimeout(stopTimer); cancelAnimationFrame(raf); node?.remove(); node = null; current = null; },
  };
  api.move(target);
  stopTimer = setTimeout(() => api.remove(), holdMs); // the ring never outlives its hint (12 s at most)
  return api;
}

// ---------- strip inside a card ----------
/**
 * The hint strip: the fox points (tip pose) and a short line of text, as a band between the card's numbers and its buttons.
 * `body` is text or nodes; `more` (optional) shows only on tall screens. `action` = { label, onClick } adds the 'הבא' button.
 */
export function hintStrip({ body, more = null, action = null, cls = '', pose = 'tip', label = '' }) {
  const strip = h('div', { class: `hint-strip${cls ? ` ${cls}` : ''}`, role: 'note', 'aria-label': label || tut().ui.hintFoxLabel },
    h('div', { class: 'hint-fox', 'aria-hidden': 'true' }, foxImg(pose, { height: 64 })),
    h('div', { class: 'hint-body' },
      h('p', { class: 'hint-text' }, body),
      more && hintMoreAllowed() ? h('p', { class: 'hint-more' }, more) : null),
    action ? h('button', { type: 'button', class: 'btn btn-primary btn-sm hint-next', 'data-action': 'hint-next', onClick: action.onClick }, action.label) : null);
  return strip;
}

// ---------- 'what is left to freedom': one truthful phrasing everywhere (HUD goal line, h-meter, h-almost) ----------
/** The template with {left} made truthful (see leftTemplate): '... עוד {left} ועוד קצת ...' or the exactly-on-the-line sentence. */
export const leftWords = (template, state) => leftTemplate(template, freedomView(state).left, { andABit: t('goal.andABit'), onTheLine: tut().goalLine.progress.onTheLine });
/** The same as DOM nodes ({left} is a money node). */
export const leftNodes = (template, state) => fillNodes(leftWords(template, state), { left: money(freedomView(state).left) });
