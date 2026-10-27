// Maxi the fox (מקסי): raster poses (WebP @1x/@2x) from src/assets/fox. Placement and motion: design/fox-usage.md.
// Cutouts keep their aspect ratio (height drives size); reaction crops are always shown as gold-ringed circles.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { motionOK } from './prefs.js';
import { animate, cssMs } from './fx.js';
export { REACTIONS, CARD_REACTION } from './fox-rules.js';

// hero.webp is store/splash art only: excluded so it is not bundled or precached.
const FILES = import.meta.glob(['../assets/fox/*.webp', '!../assets/fox/hero.webp'], { eager: true, query: '?url', import: 'default' });
const url = (name) => FILES[`../assets/fox/${name}.webp`];

/** Intrinsic @1x size per pose. `crop` poses are square circle crops (no @2x). */
export const POSES = {
  tired: { w: 184, h: 300, x2: true },
  wave: { w: 175, h: 300, x2: true },
  roll: { w: 123, h: 128, x2: true },
  hammock: { w: 287, h: 260, x2: true },
  tip: { w: 94, h: 150, x2: true },
  think: { w: 512, h: 512, crop: true },
  celebrate: { w: 512, h: 512, crop: true },
  worried: { w: 512, h: 512, crop: true },
  ponder: { w: 512, h: 512, crop: true },
};

/** { src, srcset, x1, x2 } URLs for a pose. */
export function foxUrls(pose) {
  const m = POSES[pose];
  if (!m) throw new Error(`unknown fox pose: ${pose}`);
  const x1 = url(pose);
  const x2 = m.x2 ? url(`${pose}@2x`) : null;
  return { src: x1, srcset: x2 ? `${x1} 1x, ${x2} 2x` : null, x1, x2 };
}

/**
 * <img> for a pose. Give `height` (cutouts) or `size` (crops); width/height attributes carry the
 * displayed size so the browser reserves the box (no layout shift). CSS may override with height:100%.
 * alt = '' marks it decorative; otherwise pass an i18n key via `altKey`.
 */
export function foxImg(pose, { height, size, altKey = '', cls = '', lazy = false, priority = false, defer = false } = {}) {
  const m = POSES[pose];
  const { src, srcset } = foxUrls(pose);
  let w; let hh;
  if (m.crop) { w = size ?? 56; hh = w; } else { hh = height ?? 128; w = Math.round((hh * m.w) / m.h); }
  const img = h('img', {
    class: `fox pose-${pose}${cls ? ` ${cls}` : ''}`, src: defer ? null : src, srcset: defer ? null : srcset, width: w, height: hh,
    alt: altKey ? t(altKey) : '', decoding: 'async', loading: lazy ? 'lazy' : 'eager', draggable: 'false',
    fetchpriority: priority ? 'high' : null,
  });
  if (!altKey) img.setAttribute('aria-hidden', 'true');
  return img;
}

/** Starts loading an <img> built without a source (used to keep the first paint's bandwidth for the LCP pose). */
export function loadFox(img, pose) {
  const { src, srcset } = foxUrls(pose);
  if (srcset) img.srcset = srcset;
  img.src = src;
}

/** Warms the HTTP/SW cache for poses that appear soon. Waits `delay` ms (after the first paint) and then for idle time. */
export function warmFox(poses, delay = 1500) {
  const run = () => poses.forEach((p) => {
    const { src, srcset } = foxUrls(p);
    const i = new Image();
    i.decoding = 'async';
    if (srcset) i.srcset = srcset;
    i.src = src;
  });
  setTimeout(() => { if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 3000 }); else run(); }, delay);
}

export const dirSign = () => (document.documentElement.dir === 'rtl' ? -1 : 1);
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const EASE_IN = 'cubic-bezier(.7,0,.84,0)';
const EASE_BOUNCE = 'cubic-bezier(.34,1.56,.64,1)';

/** Fade + 24px rise entrance. Fades only under reduced motion. */
export function riseIn(el, { dur = cssMs('--dur-slow', 400), delay = 0 } = {}) {
  const kf = motionOK()
    ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }]
    : [{ opacity: 0 }, { opacity: 1 }];
  return animate(el, kf, { duration: motionOK() ? dur : cssMs('--dur-base', 120), delay, easing: EASE_OUT });
}

/** Tap squash 1.04 over 120ms (start screen only; non-essential). */
export function squash(el) {
  if (!motionOK()) return;
  animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 120, easing: 'ease-out' });
}

/**
 * Circular reaction pop-up (think / celebrate / worried / ponder) shown in `host`.
 * One at a time: a new pop replaces the current one. Never carries information that is not also text.
 * opts: { size = 56, hold = --dur-toast, className }
 */
export function createReactor(host, { size = 56, className = '' } = {}) {
  let el = null;
  let timer = 0;

  async function exit(node) {
    if (!node?.isConnected) return;
    const a = animate(node, motionOK()
      ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }]
      : [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EASE_IN });
    await a.finished.catch(() => {});
    node.remove();
    if (node === el) el = null;
  }

  function hide() {
    clearTimeout(timer);
    const node = el;
    el = null;
    if (node) { node.remove(); }
  }

  function show(pose, { hold = cssMs('--dur-toast', 2200) } = {}) {
    hide();
    const node = h('div', { class: `fox-pop${className ? ` ${className}` : ''}`, 'aria-hidden': 'true' }, foxImg(pose, { size }));
    node.style.setProperty('--pop', `${size}px`);
    el = node;
    host.append(node);
    animate(node, motionOK()
      ? [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: cssMs('--dur-pop', 320), easing: EASE_BOUNCE });
    timer = setTimeout(() => { exit(node); }, hold);
    return node;
  }
  return { show, hide, get active() { return !!el; } };
}

/**
 * A reaction crop pinned to a corner of a card/dialog/sheet (position comes from CSS, see .fox-corner).
 * Pops in (scale .5 -> 1, --dur-pop, bounce) after `delay` ms; fades only under reduced motion. No bob.
 */
export function cornerPop(pose, { size = 64, delay = 0, cls = '' } = {}) {
  const node = h('div', { class: `fox-pop fox-corner${cls ? ` ${cls}` : ''}`, 'aria-hidden': 'true' }, foxImg(pose, { size }));
  node.style.setProperty('--pop', `${size}px`);
  animate(node, motionOK()
    ? [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }]
    : [{ opacity: 0 }, { opacity: 1 }], { duration: cssMs('--dur-pop', 320), delay: motionOK() ? delay : 0, easing: EASE_BOUNCE });
  return node;
}
