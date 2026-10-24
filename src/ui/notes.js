// The fox note in the fox strip (under the board): one place for instant feedback (L3), the guided hints, the family tips and
// the first-time explainer (L1). v4 (docs/v4/design/board-spec.md 7.2-7.4): every message is a smoked-glass bubble beside the
// corner fox guide (fox-guide.js), never a fox of its own. It never covers the HUD, the board, the die or the roll button.
// Items queue (feedback first, explainers after) and wait while a card / dialog / sheet is open.
// Bubbles close on a tap anywhere on them (or the 48px "×"), or after the auto-close time of bubbleMs(); that timer pauses while
// the bubble is pressed, hovered or focused, while the page is hidden and while any layer is open, and restarts in full after.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { button } from './widgets.js';
import { icon } from './icons.js';
import { isolateMoney } from './format.js';
import { animate, cssMs } from './fx.js';
import { motionOK } from './prefs.js';
import { layerDepth, onLayers } from './modal.js';

/** The bubble tokens (unitless ms, read in JS; family mode raises the floor and the per-word time in tokens.css). */
export const BUBBLE_DEFAULTS = { base: 2500, perWord: 300, min: 6000, max: 15000 };
export const BUBBLE_FAMILY = { base: 2500, perWord: 400, min: 8000, max: 15000 };

/** ms = clamp(min, base + words x perWord, max); words = text.trim().split(/\s+/).length (spec 7.3). */
export function bubbleMs(text, { base, perWord, min, max } = BUBBLE_DEFAULTS) {
  const s = String(text ?? '').trim();
  const words = s ? s.split(/\s+/).length : 0;
  return Math.min(max, Math.max(min, base + words * perWord));
}

function bubbleTokens() {
  if (typeof getComputedStyle !== 'function') return BUBBLE_DEFAULTS;
  const cs = getComputedStyle(document.documentElement);
  const num = (name, fb) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : fb; };
  return {
    base: num('--bubble-base-ms', BUBBLE_DEFAULTS.base), perWord: num('--bubble-per-word-ms', BUBBLE_DEFAULTS.perWord),
    min: num('--bubble-min-ms', BUBBLE_DEFAULTS.min), max: num('--bubble-max-ms', BUBBLE_DEFAULTS.max),
  };
}

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const EASE_IN = 'cubic-bezier(.7,0,.84,0)';
const dirSign = () => (document.documentElement.dir === 'rtl' ? -1 : 1);

/**
 * @param zone      the .roll-zone element (the fox strip)
 * @param onActive  (active: boolean, item) => void, so the board can swap its pose slot ('note' / 'tip' while a bubble is shown)
 * @param onShown   (item) => void, a message is on screen (the guide takes its pose)
 * @param onDismiss the explainer was dismissed with its button (keyboard focus goes back to the roll button)
 */
export function createNotes({ zone, onActive, onDismiss, onShown }) {
  const queue = [];
  let current = null; // { el, timer, item, shownAt, hold, pauses:Set }
  let retry = 0;
  let destroyed = false;
  let last = null; // the last message shown (the fox re-opens it)

  const active = () => !!current || queue.length > 0;

  async function remove(node) {
    if (!node?.isConnected) return;
    const kf = motionOK() ? [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${dirSign() * 8}px)` }] : [{ opacity: 1 }, { opacity: 0 }];
    const a = animate(node, kf, { duration: motionOK() ? 160 : cssMs('--dur-base', 120), easing: EASE_IN });
    await a.finished.catch(() => {});
    node.remove();
  }

  /** reason: 'button' (the player answered it), 'timeout' (it was on screen for its whole time), 'cleared' (a new roll / screen change). */
  function hideCurrent({ next = true, reason = 'button' } = {}) {
    if (!current) return;
    const { el, timer, item, shownAt } = current;
    clearTimeout(timer);
    current = null;
    if (!item.replay) item.onHide?.({ reason, ms: performance.now() - shownAt });
    remove(el).then(() => {
      if (destroyed) return;
      if (next && queue.length) setTimeout(pump, 120); else if (!current && !queue.length) onActive?.(false, null);
    });
  }

  const closeX = () => h('button', { type: 'button', class: 'bubble-close', 'aria-label': t('fox.bubbleClose'), 'data-action': 'bubble-close',
    onClick: (e) => { e.stopPropagation(); hideCurrent(); } }, icon('close', { size: 20, width: 2.4 }));

  function build(item) {
    if (item.kind === 'explain') {
      const c = item.concept;
      const why = h('p', { class: 'note-why' }, h('b', null, `${item.whyLabel}: `), c.why);
      return h('div', { class: 'note note-explain fox-bubble', role: 'region', 'aria-label': item.label, 'data-note': 'explain', 'data-concept': c.id },
        h('div', { class: 'note-bubble' },
          h('div', { class: 'note-main' },
            h('p', { class: 'note-head' }, h('strong', { class: 'note-term' }, item.name ?? c.term), h('span', { class: 'note-kicker' }, item.label)),
            h('p', { class: 'note-text' }, item.short ?? c.short), why),
          h('div', { class: 'note-actions' },
            button(item.gotIt, { variant: 'secondary', size: 'sm', cls: 'note-btn', 'data-action': 'explain-ok', 'aria-label': t('learn.gotItLabel'), onClick: () => { hideCurrent({ reason: 'answered' }); onDismiss?.(); } }),
            button(t('learn.more'), { variant: 'text', size: 'sm', cls: 'note-btn', 'data-action': 'explain-more', 'aria-label': t('learn.moreLabel', { term: item.name ?? c.term }), onClick: () => { hideCurrent({ reason: 'answered' }); item.onMore?.(c.id); } }))));
    }
    const body = h('p', { class: 'note-text' }, isolateMoney(item.body));
    if (item.kind === 'hint') {
      // a guided hint (first game): one short bubble, tap anywhere to close. Never takes a button of its own (the "×" only closes).
      return h('div', { class: 'note note-hint fox-bubble', role: 'status', 'aria-label': item.label, 'data-note': 'hint', 'data-hint': item.id, onClick: () => hideCurrent() },
        h('div', { class: 'note-bubble' }, h('div', { class: 'note-main' }, body, item.more ? h('p', { class: 'note-why' }, item.more) : null), closeX()));
    }
    if (item.kind === 'tip') {
      return h('div', { class: 'note note-tip fox-bubble', role: 'status', 'data-note': 'tip', onClick: () => hideCurrent() },
        h('div', { class: 'note-bubble' }, h('div', { class: 'note-main' }, body), closeX()));
    }
    return h('div', { class: 'note note-feedback fox-bubble', role: 'status', 'data-note': 'feedback', 'data-group': item.group, 'data-tone': item.tone,
      onClick: () => hideCurrent() },
    h('div', { class: 'note-bubble' }, h('div', { class: 'note-main' }, body), closeX()));
  }

  /** The auto-close time: explainers wait for their button (as in v3); bubbles follow the reading-time formula. */
  function holdOf(item) {
    if (item.kind === 'explain') return window.matchMedia?.('(max-height: 600px)').matches ? 6000 : 20000;
    const plain = item.plain ?? (typeof item.body === 'string' ? item.body : item.body?.textContent ?? '');
    return bubbleMs(plain, bubbleTokens());
  }

  // ---- pause rules: pressed / hovered / focused, page hidden, a layer open. The timer restarts in full afterwards. ----
  function arm() {
    if (!current) return;
    clearTimeout(current.timer);
    current.timer = 0;
    if (current.pauses.size) return;
    const c = current;
    c.timer = setTimeout(() => { if (current === c) hideCurrent({ reason: 'timeout' }); }, c.hold);
  }
  function pauseFor(why, on) {
    if (!current) return;
    const had = current.pauses.size;
    if (on) current.pauses.add(why); else current.pauses.delete(why);
    if (on && !had) { clearTimeout(current.timer); current.timer = 0; }
    if (!on && had && !current.pauses.size) arm();
  }
  const onVisibility = () => pauseFor('hidden', document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  const offLayers = onLayers((open) => pauseFor('layer', open));

  function display(item) {
    const el = build(item);
    zone.append(el);
    onActive?.(true, item);
    if (!item.replay) item.onShow?.();
    onShown?.(item);
    if (item.kind !== 'explain' && item.kind !== 'replay-explain') last = item;
    animate(el, motionOK()
      ? [{ opacity: 0, transform: `translateX(${dirSign() * 8}px)` }, { opacity: 1, transform: 'translateX(0)' }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: motionOK() ? 240 : cssMs('--dur-base', 120), easing: EASE_OUT });
    current = { el, item, shownAt: performance.now(), hold: holdOf(item), timer: 0, pauses: new Set() };
    if (document.hidden) current.pauses.add('hidden');
    if (layerDepth() > 0) current.pauses.add('layer');
    for (const [ev, why, on] of [['pointerenter', 'hover', true], ['pointerleave', 'hover', false], ['pointerdown', 'press', true], ['pointerup', 'press', false], ['pointercancel', 'press', false], ['focusin', 'focus', true], ['focusout', 'focus', false]]) {
      el.addEventListener(ev, (e) => {
        if (ev === 'focusout' && el.contains(e.relatedTarget)) return;
        pauseFor(why, on);
      });
    }
    arm();
  }

  function pump() {
    clearTimeout(retry);
    if (destroyed || current || !queue.length) return;
    // wait while a card / dialog / sheet is open: the note belongs to the board
    if (layerDepth() > 0) { retry = setTimeout(pump, 400); return; }
    display(queue.shift());
  }

  return {
    /** item: { kind: 'feedback', body: Node|string, plain, pose, tone, group } | { kind: 'tip', body, plain } | { kind: 'explain', concept, label, gotIt, whyLabel, onShow, onMore } | { kind: 'hint', id, body, more, plain, onShow, onHide } */
    push(item) {
      // An urgent item (an explainer that was already pushed aside once) takes the screen at once instead of waiting behind
      // a feedback note, so a player who rolls fast still meets every concept within two turns.
      if (item.urgent) {
        queue.unshift(item);
        if (current && current.item.kind !== 'explain') hideCurrent({ next: false, reason: 'replaced' });
      } else queue.push(item);
      onActive?.(true, item);
      pump();
    },
    /** The fox was tapped: the last bubble comes back with a new timer (no hooks: a hint's ring or a tip's schedule are not re-run). */
    reopen() {
      if (!last || destroyed) return false;
      if (current) {
        if (current.item === last || current.item.source === last) { arm(); return true; }
        if (current.item.kind === 'explain') return false; // an explainer waits for its button
        hideCurrent({ next: false, reason: 'replaced' });
      }
      const copy = { ...last, replay: true, source: last, body: last.body?.cloneNode ? last.body.cloneNode(true) : Array.isArray(last.body) ? last.body.map((n) => (n?.cloneNode ? n.cloneNode(true) : n)) : last.body };
      queue.unshift(copy);
      onActive?.(true, copy);
      pump();
      return true;
    },
    /** Dismiss what is shown and drop the queue (a new roll, a screen change). Unshown explainers are not lost: they stay in the flow's queue. */
    clear() {
      clearTimeout(retry);
      const dropped = queue.filter((i) => i.kind === 'explain'); // never shown: the flow keeps them for a later turn
      queue.length = 0;
      if (current) hideCurrent({ next: false, reason: 'cleared' }); else onActive?.(false, null);
      return dropped;
    },
    /** Dismiss only the visible note (tap elsewhere), then show the next one. */
    dismiss() { hideCurrent(); },
    /** Drops a queued or visible item of one kind (a family tip that the turn no longer wants). */
    dismissKind(kind) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === kind) queue.splice(i, 1);
      if (current?.item.kind === kind) hideCurrent();
      else if (!current && !queue.length) onActive?.(false, null);
    },
    get active() { return active(); },
    get visible() { return !!current; },
    get current() { return current?.el ?? null; },
    get currentItem() { return current?.item ?? null; },
    get hasLast() { return !!last; },
    destroy() {
      destroyed = true; clearTimeout(retry); offLayers(); document.removeEventListener('visibilitychange', onVisibility);
      if (current) { clearTimeout(current.timer); current.el.remove(); current = null; }
      queue.length = 0;
    },
  };
}
