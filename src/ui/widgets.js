// Small reusable widgets: buttons, stepper, meter, stat tiles.
import { h } from './dom.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';
import { moneyText, money } from './format.js';
import { countUp, haptic, shake, pulse } from './fx.js';

export function button(label, { variant = 'primary', onClick, disabled = false, cls = '', size = '', ...attrs } = {}) {
  return h('button', {
    type: 'button', class: `btn btn-${variant} ${size ? `btn-${size}` : ''} ${cls}`.trim(), disabled, onClick, ...attrs,
  }, label);
}

export const iconButton = (name, label, onClick, cls = '') =>
  h('button', { type: 'button', class: `icon-btn ${cls}`.trim(), 'aria-label': label, onClick }, icon(name, { size: 24 }));

/**
 * Numeric stepper with 48px +/- buttons and a big live value.
 * opts: { min, max, step, value, render(value) -> Node|string, onChange(value) }
 */
export function stepper({ min, max, step = 1, value, render, onChange, decLabel, incLabel }) {
  let v = value;
  const out = h('output', { class: 'stepper-value', 'aria-live': 'polite' });
  const dec = h('button', { type: 'button', class: 'step-btn', 'aria-label': decLabel || t('card.decrease'), onClick: () => set(prevValue(v)) }, icon('minus', { size: 26, width: 3 }));
  const inc = h('button', { type: 'button', class: 'step-btn', 'aria-label': incLabel || t('card.increase'), onClick: () => set(nextValue(v)) }, icon('plus', { size: 26, width: 3 }));
  const el = h('div', { class: 'stepper', dir: 'ltr' }, dec, out, inc);
  const prevValue = (x) => Math.max(min, x - step);
  const nextValue = (x) => Math.min(max, x + step);

  function paint(x) {
    out.replaceChildren(render ? render(x) : String(x));
    dec.disabled = x <= min;
    inc.disabled = x >= max;
  }
  function set(x, { silent = false } = {}) {
    const clamped = Math.min(max, Math.max(min, x));
    if (clamped === v && !silent) { shake(el); haptic('error'); return; }
    const from = v;
    v = clamped;
    paint(v);
    if (!silent) { haptic('tap'); pulse(out, 1.08); }
    onChange?.(v, from);
  }
  paint(v);
  return { el, get value() { return v; }, set, setMax(m) { max = m; if (v > m) set(m); else paint(v); } };
}

/** Passive-income meter: fills from the inline-start; ticks at 25/50/75% and a goal flag. */
export function meter({ large = false } = {}) {
  const fill = h('div', { class: 'meter-fill' });
  const flag = h('span', { class: 'meter-flag', 'aria-hidden': 'true' }, icon('star', { size: 14, width: 2.6 }));
  const track = h('div', { class: `meter-track${large ? ' meter-large' : ''}`, role: 'progressbar', 'aria-label': t('a11y.passiveMeter'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
    fill, h('i', { class: 'tick', vars: { '--p': '25%' } }), h('i', { class: 'tick', vars: { '--p': '50%' } }), h('i', { class: 'tick', vars: { '--p': '75%' } }), flag);
  let last = 0;
  return {
    el: track,
    set(passive, expenses, { animate: anim = true } = {}) {
      const p = expenses > 0 ? Math.max(0, Math.min(1, passive / expenses)) : 0;
      fill.style.setProperty('--fill', String(p));
      track.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      track.setAttribute('aria-valuetext', t('a11y.passiveMeterValue', { pct: Math.round(p * 100), passive: moneyText(passive), expenses: moneyText(expenses) }));
      for (const mark of [0.25, 0.5, 0.75]) {
        if (anim && last < mark && p >= mark) { pulse(track, 1.04); haptic('tap'); }
      }
      last = p;
    },
  };
}

export function statTile(label, valueNode, { tone = '', big = false } = {}) {
  return h('div', { class: `stat-tile${tone ? ` stat-${tone}` : ''}${big ? ' stat-big' : ''}` },
    h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, valueNode));
}

/** A money <output> that can count up to new values. */
export function cashDisplay(initial, { sign = false } = {}) {
  const el = h('span', { class: 'money cash-num', dir: 'ltr' }, moneyText(initial, { sign }));
  let shown = initial;
  return {
    el,
    get value() { return shown; },
    set(v) { shown = v; el.textContent = moneyText(v, { sign }); },
    async to(v, dur) {
      const from = shown;
      shown = v;
      await countUp(from, v, (x) => { el.textContent = moneyText(x, { sign }); }, dur);
      el.textContent = moneyText(v, { sign });
    },
  };
}

export { money };
