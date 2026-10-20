// Modal/sheet layers. At most two levels deep. Each layer traps focus and closes on Escape/scrim.
import { h } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { animate, cssMs } from './fx.js';
import { motionOK } from './prefs.js';

const stack = [];

function root() { return document.getElementById('modal-root'); }

/**
 * Opens a layer. kind: 'modal' (centered) | 'sheet' (bottom sheet).
 * Returns { el, close(result), closed: Promise }.
 */
export function openLayer(content, { kind = 'modal', label = '', dismissable = true, cardFlip = false, cls = '' } = {}) {
  const prevFocus = document.activeElement;
  let resolve;
  const closed = new Promise((r) => { resolve = r; });
  const panel = h('div', { class: `layer-panel layer-${kind} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' }, content);
  const scrim = h('div', { class: 'scrim', onClick: () => dismissable && api.close(undefined) });
  const el = h('div', { class: `layer layer-k-${kind}` }, scrim, panel);
  const level = stack.length;
  el.style.zIndex = String(30 + level);
  root().append(el);
  // The layer below becomes inert while this one is open.
  const below = stack[stack.length - 1];
  if (below) below.el.setAttribute('inert', '');
  else document.getElementById('app')?.setAttribute('inert', '');

  const api = {
    el, panel, closed,
    async close(result) {
      if (api.done) return;
      api.done = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      const nextBelow = stack[stack.length - 1];
      if (nextBelow) nextBelow.el.removeAttribute('inert');
      else document.getElementById('app')?.removeAttribute('inert');
      const d = cssMs('--dur-base', 250);
      const out = kind === 'sheet'
        ? [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }]
        : [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: motionOK() ? 'translateY(40px) scale(.96)' : 'none', opacity: 0 }];
      animate(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: d });
      await animate(panel, motionOK() || kind !== 'sheet' ? out : [{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'cubic-bezier(.7,0,.84,0)' }).finished.catch(() => {});
      el.remove();
      try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
      resolve(result);
    },
  };
  stack.push(api);

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dismissable) { e.stopPropagation(); api.close(undefined); }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Entrance
  const dur = cssMs('--dur-slow', 400);
  animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: cssMs('--dur-base', 250) });
  if (kind === 'sheet') {
    animate(panel, motionOK() ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: cssMs('--dur-base', 250), easing: 'cubic-bezier(.16,1,.3,1)' });
  } else if (cardFlip && motionOK()) {
    animate(panel, [
      { transform: 'perspective(900px) rotateY(90deg) scale(.9)', opacity: 0 },
      { transform: 'perspective(900px) rotateY(0deg) scale(1)', opacity: 1 },
    ], { duration: dur, easing: 'cubic-bezier(.16,1,.3,1)' });
  } else {
    animate(panel, motionOK() ? [{ transform: 'translateY(30px) scale(.94)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'cubic-bezier(.34,1.3,.64,1)' });
  }
  queueMicrotask(() => {
    const target = panel.querySelector('[data-autofocus]') || panel.querySelector('button') || panel;
    target.focus?.({ preventScroll: true });
  });
  return api;
}

export const closeButton = (onClick, cls = '') =>
  h('button', { type: 'button', class: `icon-btn ${cls}`, 'aria-label': t('common.close'), onClick }, icon('close', { size: 22 }));

export const layerDepth = () => stack.length;
