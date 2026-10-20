// 3D-feeling die: a CSS cube (faces use the die-N.svg art). The outer wrapper tumbles via WAAPI,
// the inner cube holds the final orientation. Falls back to a quick fade under reduced motion.
import { h } from './dom.js';
import { animate, cssMs } from './fx.js';
import { motionOK } from './prefs.js';
import { t } from '../i18n/index.js';

const faceUrls = import.meta.glob('../assets/die-*.svg', { eager: true, query: '?url', import: 'default' });
const face = (n) => faceUrls[`../assets/die-${n}.svg`];

// Orientation that brings face n to the front.
const SHOW = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateY(-90deg)',
  3: 'rotateX(-90deg)',
  4: 'rotateX(90deg)',
  5: 'rotateY(90deg)',
  6: 'rotateY(180deg)',
};
const PLACE = {
  1: 'rotateY(0deg)', 2: 'rotateY(90deg)', 3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)', 5: 'rotateY(-90deg)', 6: 'rotateY(180deg)',
};

function makeCube() {
  const cube = h('div', { class: 'die-cube' });
  for (let n = 1; n <= 6; n++) {
    const f = h('img', { class: 'die-face', src: face(n), alt: '', draggable: 'false' });
    f.style.transform = `${PLACE[n]} translateZ(var(--die-half))`;
    cube.append(f);
  }
  const tumble = h('div', { class: 'die-tumble' }, cube);
  const shadow = h('div', { class: 'die-shadow' });
  const wrap = h('div', { class: 'die' }, shadow, tumble);
  return { wrap, cube, tumble, shadow };
}

export function createDice() {
  const root = h('div', { class: 'dice', role: 'img', 'aria-live': 'polite', 'aria-label': '' });
  let cubes = [];
  let value = [1];

  function ensure(count) {
    if (cubes.length === count) return;
    root.replaceChildren();
    cubes = Array.from({ length: count }, makeCube);
    cubes.forEach((c, i) => {
      root.append(c.wrap);
      c.cube.style.transform = SHOW[value[i] || 1];
    });
    root.classList.toggle('dice-two', count === 2);
  }
  ensure(1);

  function setValues(values) {
    value = values;
    ensure(values.length);
    cubes.forEach((c, i) => { c.cube.style.transform = SHOW[values[i]]; });
    root.setAttribute('aria-label', t('a11y.die', { value: values.join(' + ') }));
  }

  async function roll(values) {
    ensure(values.length);
    value = values;
    cubes.forEach((c, i) => { c.cube.style.transform = SHOW[values[i]]; });
    root.setAttribute('aria-label', t('a11y.die', { value: values.join(' + ') }));
    const dur = cssMs('--dur-die', 1100);
    if (!motionOK()) {
      await animate(root, [{ opacity: 0.3 }, { opacity: 1 }], { duration: dur }).finished.catch(() => {});
      return;
    }
    const jobs = cubes.map((c, i) => {
      const rx = 360 * (2 + i);
      const ry = 360 * (3 - i);
      const rz = i ? -360 : 360;
      const fn = (y, x, yy, z, s) => `translateY(${y}px) rotateX(${x}deg) rotateY(${yy}deg) rotateZ(${z}deg) scale(${s})`;
      const spin = animate(c.tumble, [
        { transform: fn(0, 0, 0, 0, 1) },
        { transform: fn(-70, rx * 0.5, ry * 0.5, rz * 0.5, 1.15), offset: 0.4 },
        { transform: fn(0, rx, ry, rz, 1), offset: 0.78, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        { transform: fn(-8, rx, ry, rz, 1), offset: 0.88 },
        { transform: fn(0, rx, ry, rz, 1) },
      ], { duration: dur, delay: i * 90, easing: 'cubic-bezier(.3,.6,.4,1)' });
      animate(c.shadow, [{ transform: 'scale(1)', opacity: 0.35 }, { transform: 'scale(.6)', opacity: 0.15, offset: 0.4 }, { transform: 'scale(1)', opacity: 0.35 }], { duration: dur, delay: i * 90 });
      return spin.finished.catch(() => {});
    });
    await Promise.all(jobs);
  }

  return { el: root, roll, setValues };
}
