// The fox note in the roll zone (under the board): one place for instant feedback (L3) and the first-time explainer (L1).
// It takes the slot of the roll pose / status chip / family tip, so it never covers the HUD numbers, the board or the roll
// button; on very short screens it grows upward into the empty strip above the zone, never over the HUD or the button.
// Items queue (feedback first, explainers after) and wait while a card / dialog / sheet is open.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { foxImg } from './fox.js';
import { button } from './widgets.js';
import { animate, cssMs } from './fx.js';
import { motionOK } from './prefs.js';
import { layerDepth } from './modal.js';

// feedback stays 3.5-5 s (spec: 3-4 s, tap to dismiss): long enough to read about 100 characters, short enough not to hold the next turn
const holdFor = (text) => Math.min(5000, 3500 + text.length * 10);

/**
 * @param zone     the .roll-zone element
 * @param onShown  (active: boolean) => void, so the board can swap its pose slot ('note' while a note is shown)
 */
export function createNotes({ zone, onActive, onDismiss }) {
  const queue = [];
  let current = null; // { el, timer, item }
  let retry = 0;
  let destroyed = false;

  const active = () => !!current || queue.length > 0;

  async function remove(node) {
    if (!node?.isConnected) return;
    const a = animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: motionOK() ? 160 : cssMs('--dur-base', 120) });
    await a.finished.catch(() => {});
    node.remove();
  }

  /** reason: 'button' (the player answered it), 'timeout' (it was on screen for its whole time), 'cleared' (a new roll / screen change). */
  function hideCurrent({ next = true, reason = 'button' } = {}) {
    if (!current) return;
    const { el, timer, item, shownAt } = current;
    clearTimeout(timer);
    current = null;
    item.onHide?.({ reason, ms: performance.now() - shownAt });
    remove(el).then(() => {
      if (destroyed) return;
      if (next && queue.length) setTimeout(pump, 120); else if (!current && !queue.length) onActive?.(false);
    });
  }

  function build(item) {
    if (item.kind === 'explain') {
      const c = item.concept;
      const why = h('p', { class: 'note-why' }, h('b', null, `${item.whyLabel}: `), c.why);
      return h('div', { class: 'note note-explain', role: 'region', 'aria-label': item.label, 'data-note': 'explain', 'data-concept': c.id },
        h('div', { class: 'note-fox', 'aria-hidden': 'true' }, foxImg('tip', { height: 84, cls: 'note-fox-img' })),
        h('div', { class: 'note-bubble' },
          h('div', { class: 'note-main' },
            h('p', { class: 'note-head' }, h('strong', { class: 'note-term' }, c.term), h('span', { class: 'note-kicker' }, item.label)),
            h('p', { class: 'note-text' }, c.short), why),
          h('div', { class: 'note-actions' },
            button(item.gotIt, { variant: 'primary', size: 'sm', cls: 'note-btn', 'data-action': 'explain-ok', 'aria-label': t('learn.gotItLabel'), onClick: () => { hideCurrent({ reason: 'answered' }); onDismiss?.(); } }),
            button(t('learn.more'), { variant: 'secondary', size: 'sm', cls: 'note-btn', 'data-action': 'explain-more', 'aria-label': t('learn.moreLabel', { term: c.term }), onClick: () => { hideCurrent({ reason: 'answered' }); item.onMore?.(c.id); } }))));
    }
    return h('div', { class: 'note note-feedback', role: 'status', 'data-note': 'feedback', 'data-group': item.group, 'data-tone': item.tone,
      onClick: () => hideCurrent() },
    h('div', { class: 'fox-pop note-pop', 'aria-hidden': 'true' }, foxImg(item.pose, { size: 52 })),
    h('p', { class: 'note-text' }, item.body));
  }

  function display(item) {
    const el = build(item);
    zone.append(el);
    onActive?.(true);
    item.onShow?.();
    animate(el, motionOK()
      ? [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: motionOK() ? 260 : cssMs('--dur-base', 120), easing: 'cubic-bezier(.16,1,.3,1)' });
    const hold = item.kind === 'explain' ? (window.matchMedia?.('(max-height: 600px)').matches ? 6000 : 20000) : holdFor(item.plain ?? '');
    current = { el, item, shownAt: performance.now(), timer: setTimeout(() => hideCurrent({ reason: 'timeout' }), hold) };
  }

  function pump() {
    clearTimeout(retry);
    if (destroyed || current || !queue.length) return;
    // wait while a card / dialog / sheet is open: the note belongs to the board
    if (layerDepth() > 0) { retry = setTimeout(pump, 400); return; }
    display(queue.shift());
  }

  return {
    /** item: { kind: 'feedback', body: Node|string, plain, pose, tone, group } | { kind: 'explain', concept, label, gotIt, whyLabel, onShow, onMore } */
    push(item) {
      // An urgent item (an explainer that was already pushed aside once) takes the screen at once instead of waiting behind
      // a feedback note, so a player who rolls fast still meets every concept within two turns.
      if (item.urgent) {
        queue.unshift(item);
        if (current && current.item.kind !== 'explain') hideCurrent({ next: false, reason: 'replaced' });
      } else queue.push(item);
      onActive?.(true);
      pump();
    },
    /** Dismiss what is shown and drop the queue (a new roll, a screen change). Unshown explainers are not lost: they stay in the flow's queue. */
    clear() {
      clearTimeout(retry);
      const dropped = queue.filter((i) => i.kind === 'explain'); // never shown: the flow keeps them for a later turn
      queue.length = 0;
      if (current) hideCurrent({ next: false, reason: 'cleared' }); else onActive?.(false);
      return dropped;
    },
    /** Dismiss only the visible note (tap elsewhere), then show the next one. */
    dismiss() { hideCurrent(); },
    get active() { return active(); },
    get visible() { return !!current; },
    get current() { return current?.el ?? null; },
    destroy() { destroyed = true; clearTimeout(retry); if (current) { clearTimeout(current.timer); current.el.remove(); current = null; } queue.length = 0; },
  };
}
