// Feedback effects: haptics, sound, count-up, floating text, coin burst, confetti.
// Motion uses only transform/opacity via WAAPI. Everything degrades under reduced motion.
import { h } from './dom.js';
import { getPrefs, motionOK } from './prefs.js';
import coinSmall from '../assets/coin-small.svg?url';

const HAPTICS = {
  roll: 15, land: 10, purchase: [20, 40, 20], win: [30, 60, 30, 60, 90], error: 40, tap: 8,
};
export function haptic(name) {
  if (!getPrefs().haptics || !('vibrate' in navigator)) return;
  try { navigator.vibrate(HAPTICS[name] ?? 10); } catch { /* ignore */ }
}

// ---- Tiny synthesized sounds (no audio files, offline friendly) ----
let ctx;
const TONES = {
  roll: [[300, 0.05], [380, 0.05], [460, 0.05]],
  land: [[260, 0.06]],
  coin: [[880, 0.07], [1320, 0.12]],
  payday: [[660, 0.08], [880, 0.08], [1100, 0.12]],
  error: [[180, 0.15]],
  win: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]],
  tap: [[500, 0.03]],
};
export function sound(name) {
  if (!getPrefs().sound) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    let at = ctx.currentTime;
    for (const [freq, len] of TONES[name] || []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + len + 0.02);
      at += len * 0.9;
    }
  } catch { /* audio unavailable */ }
}

/** Reads a duration token such as --dur-fast ("180ms") as a number of milliseconds. */
export function cssMs(name, fallback = 200) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s')) return parseFloat(v) * 1000;
  return fallback;
}
export const cssPx = (name, fallback = 0) => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};

export function animate(el, keyframes, options) {
  if (!el.animate) return { finished: Promise.resolve(), cancel() {} };
  return el.animate(keyframes, { fill: 'both', ...options });
}

/** Counts a number up/down with rAF. `render(value)` writes the text. Resolves when done. */
export function countUp(from, to, render, duration = cssMs('--dur-countup', 700)) {
  if (!motionOK() || from === to || duration <= 1) { render(to); return Promise.resolve(); }
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      render(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Floating "+₪1,200" label that rises 40px and fades.
 * `below` (an element, e.g. the HUD): the label starts just under that element's bottom edge and drifts DOWN a few pixels,
 * so it never travels over the text above it (title, profession, buttons, cash). Always clamped inside the viewport.
 */
export function floatText(anchor, node, tone = 'income', { below = null } = {}) {
  const layer = document.getElementById('fx-layer');
  if (!layer || !anchor) return Promise.resolve();
  const r = anchor.getBoundingClientRect();
  const el = h('div', { class: `float-text float-${tone}`, 'aria-hidden': 'true' }, node);
  layer.append(el);
  const vw = document.documentElement.clientWidth || 360;
  const half = (el.offsetWidth || 120) / 2;
  const x = Math.min(Math.max(r.left + r.width / 2, half + 8), vw - half - 8);
  const move = motionOK() ? 40 : 0;
  const y = below ? below.getBoundingClientRect().bottom + 6 : r.top;
  const dir = below ? 1 : -1; // under the HUD: down; otherwise: up
  const travel = below ? move * 0.5 : move;
  const base = `translate(${x}px, ${y}px)`;
  const a = animate(el, [
    { transform: `${base} translate(-50%, 0)`, opacity: 0 },
    { transform: `${base} translate(-50%, ${dir * travel * 0.4}px)`, opacity: 1, offset: 0.2 },
    { transform: `${base} translate(-50%, ${dir * travel}px)`, opacity: 0 },
  ], { duration: motionOK() ? 1100 : 700, easing: 'ease-out' });
  const done = () => el.remove();
  a.finished.then(done, done);
  return a.finished.catch(() => {});
}

/** Coin burst flying from a rect toward a target element (e.g. the statement button). */
export function coinBurst(fromEl, toEl, count = 10) {
  const layer = document.getElementById('fx-layer');
  if (!layer || !fromEl) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = (toEl || fromEl).getBoundingClientRect();
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height / 2;
  const tx = b.left + b.width / 2;
  const ty = b.top + b.height / 2;
  const n = motionOK() ? count : 1;
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const coin = h('img', { class: 'fx-coin', src: coinSmall, alt: '', 'aria-hidden': 'true', width: 22, height: 22 });
    layer.append(coin);
    const spread = (Math.random() - 0.5) * 140;
    const up = 40 + Math.random() * 80;
    const kf = motionOK()
      ? [
        { transform: `translate(${sx}px, ${sy}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${sx + spread}px, ${sy - up}px) scale(1.1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${tx}px, ${ty}px) scale(.5)`, opacity: 0.2 },
      ]
      : [{ transform: `translate(${tx}px, ${ty}px)`, opacity: 0 }, { transform: `translate(${tx}px, ${ty}px)`, opacity: 1 }, { transform: `translate(${tx}px, ${ty}px)`, opacity: 0 }];
    const anim = animate(coin, kf, { duration: 520 + i * 25, delay: i * 30, easing: 'cubic-bezier(.4,0,.3,1)' });
    const rm = () => coin.remove();
    anim.finished.then(rm, rm);
    jobs.push(anim.finished.catch(() => {}));
  }
  return Promise.all(jobs);
}

const CONFETTI_COLORS = ['#F2B53A', '#FFD479', '#E8702A', '#4FD6A0', '#FF9CCB', '#4DA3FF', '#F0524A', '#FFFFFF'];
/** 40 DOM confetti pieces animated with transforms only. Static sparkles under reduced motion. */
export function confetti(container, count = 40) {
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  container.append(layer);
  const W = container.clientWidth || 360;
  const H = container.clientHeight || 700;
  if (!motionOK()) {
    for (let i = 0; i < 14; i++) {
      const s = h('span', { class: 'sparkle' });
      s.style.insetInlineStart = `${(i * 37) % 100}%`;
      s.style.insetBlockStart = `${(i * 53) % 60}%`;
      layer.append(s);
    }
    return layer;
  }
  for (let i = 0; i < count; i++) {
    const p = h('i', { class: 'confetti-piece' });
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    p.style.borderRadius = i % 3 === 0 ? '50%' : '2px';
    layer.append(p);
    const x = Math.random() * W;
    const drift = (Math.random() - 0.5) * 160;
    const rot = (Math.random() - 0.5) * 1080;
    const dur = cssMs('--dur-confetti', 2800) * (0.7 + Math.random() * 0.6);
    animate(p, [
      { transform: `translate(${x}px, -30px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + drift}px, ${H * 0.55}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x + drift * 1.4}px, ${H + 30}px) rotate(${rot}deg)`, opacity: 0.8 },
    ], { duration: dur, delay: Math.random() * 900, easing: 'cubic-bezier(.3,.2,.5,1)', iterations: 2 });
  }
  return layer;
}

/** Error shake: 6px x2, or an opacity blink under reduced motion. */
export function shake(el) {
  if (!el) return Promise.resolve();
  const kf = motionOK()
    ? [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }]
    : [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }];
  return animate(el, kf, { duration: cssMs('--dur-fast', 180) * 2.5 + 40 }).finished.catch(() => {});
}

export function pulse(el, scale = 1.12) {
  if (!el || !motionOK()) return Promise.resolve();
  return animate(el, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' }).finished.catch(() => {});
}

/** Wait helper that collapses under reduced motion. */
export const pause = (ms) => new Promise((r) => setTimeout(r, motionOK() ? ms : Math.min(ms, 30)));

/** Short, polite status toast (e.g. "copied"). */
export function toast(text, ms = 2200) {
  const layer = document.getElementById('toast-layer');
  if (!layer) return;
  const el = h('div', { class: 'toast', role: 'status' }, text);
  layer.append(el);
  animate(el, [{ opacity: 0, transform: motionOK() ? 'translateY(12px)' : 'none' }, { opacity: 1, transform: 'none' }], { duration: 200 });
  setTimeout(() => {
    animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => el.remove(), () => el.remove());
  }, ms);
}
