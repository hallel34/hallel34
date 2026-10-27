// 3D-feeling die (v4, docs/v4/design/board-spec.md section 6): a CSS cube (faces use the die-N.svg art).
// Structure: .dice > .die > (.die-shadow, .die-tumble > .die-cube). The wrapper takes the toss (translate), the wind-up / settle
// (scale) and the tilt (rotate) as three independent WAAPI animations; the cube tumbles from a random start to its final face.
// The phases (wind-up 80 / tumble 780 / settle 240 = --dur-die) and easings are tokens. At the end the result appears as a big
// number over the die (700ms: pop, hold, fade); the promise resolves 200ms after the land, so the number is read before the
// pawn moves. Reduced motion: the face crossfades and the number only fades (it is information, so it is never removed).
import { h } from './dom.js';
import { animate, cssMs, cssPx, cssVar, haptic } from './fx.js';
import { motionOK } from './prefs.js';
import { t } from '../i18n/index.js';
import { numberText } from './format.js';

const faceUrls = import.meta.glob('../assets/die-*.svg', { eager: true, query: '?url', import: 'default' });
const face = (n) => faceUrls[`../assets/die-${n}.svg`];

// Orientation that brings face n to the front.
const SHOW = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};
const PLACE = {
  1: 'rotateY(0deg)', 2: 'rotateY(90deg)', 3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)', 5: 'rotateY(-90deg)', 6: 'rotateY(180deg)',
};

/** The phase timings in ms (tokens; the reduced-motion layer collapses them). Exported for the unit test of the timeline. */
export function dieTimeline({ windup = 80, tumble = 780, settle = 240 } = {}) {
  const total = windup + tumble + settle;
  const tumbleEnd = windup + tumble;
  const apex = windup + tumble * (350 / 780); // toss up 80-430, fall 430-860 in the spec's 1100ms timeline
  return { windup, tumble, settle, total, apex, tumbleEnd, result: 700, pawnAfter: total + 200 };
}

const RESULT = { pop: 200, hold: 380, fade: 120 };

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
  return { wrap, cube, tumble, shadow, anims: [] };
}

export function createDice() {
  const root = h('div', { class: 'dice', role: 'img', 'aria-live': 'polite', 'aria-label': '' });
  const cubesHost = h('div', { class: 'dice-row' });
  const resultNum = h('b', { class: 'die-result-num' });
  const resultSum = h('span', { class: 'die-result-sum' });
  const result = h('span', { class: 'die-result', 'aria-hidden': 'true', hidden: true }, resultNum, resultSum);
  root.append(cubesHost, result);
  let cubes = [];
  let value = [1];
  let resultAnim = null;

  function ensure(count) {
    if (cubes.length === count) return;
    cubesHost.replaceChildren();
    cubes = Array.from({ length: count }, makeCube);
    cubes.forEach((c, i) => {
      cubesHost.append(c.wrap);
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

  /** The big number: the sum, with "4 + 5" under it for two dice. Not awaited by the caller (it runs over the first hops). */
  function showResult(values, motion) {
    resultAnim?.cancel();
    const sum = values.reduce((a, b) => a + b, 0);
    resultNum.textContent = numberText(sum);
    resultSum.textContent = values.length > 1 ? t('board.dieSum', { a: numberText(values[0]), b: numberText(values[1]) }) : '';
    resultSum.hidden = values.length < 2;
    result.hidden = false;
    const total = cssMs('--dur-die-result', RESULT.pop + RESULT.hold + RESULT.fade);
    const popAt = RESULT.pop / total;
    const fadeAt = (RESULT.pop + RESULT.hold) / total;
    const kf = motion
      ? [
        { opacity: 0, transform: 'scale(.6)', easing: cssVar('--ease-bounce', 'cubic-bezier(.34,1.56,.64,1)') },
        { opacity: 1, transform: 'scale(1)', offset: popAt },
        { opacity: 1, transform: 'scale(1)', offset: fadeAt, easing: cssVar('--ease-in', 'ease-in') },
        { opacity: 0, transform: 'scale(1)' },
      ]
      : [{ opacity: 0 }, { opacity: 1, offset: popAt }, { opacity: 1, offset: fadeAt }, { opacity: 0 }];
    resultAnim = animate(result, kf, { duration: total, fill: 'none' });
    resultAnim.finished?.then(() => { result.hidden = true; }, () => {});
  }

  async function roll(values) {
    ensure(values.length);
    value = values;
    root.setAttribute('aria-label', t('a11y.die', { value: values.join(' + ') }));
    const motion = motionOK();
    if (!motion) {
      // reduced motion: no tumble, no toss; the face crossfades and the number fades in
      cubes.forEach((c, i) => { c.cube.style.transform = SHOW[values[i]]; });
      await animate(cubesHost, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 120, fill: 'none' }).finished?.catch(() => {});
      showResult(values, false);
      await new Promise((r) => { setTimeout(r, 200); });
      return;
    }
    const tl = dieTimeline({
      windup: cssMs('--dur-die-windup', 80), tumble: cssMs('--dur-die-tumble', 780), settle: cssMs('--dur-die-settle', 240),
    });
    const toss = cssPx('--die-toss', 28);
    const tilt = parseFloat(cssVar('--die-tilt', '10deg')) || 0;
    const easeTumble = cssVar('--ease-die-tumble', 'cubic-bezier(.15,.85,.35,1)');
    const easeRise = cssVar('--ease-die-rise', 'cubic-bezier(.33,1,.68,1)');
    const easeFall = cssVar('--ease-die-fall', 'cubic-bezier(.32,0,.67,0)');
    const easeSettle = cssVar('--ease-die-settle', 'cubic-bezier(.34,1.56,.64,1)');
    const o = (ms) => Math.min(1, Math.max(0, ms / tl.total));
    const jobs = cubes.map((c, i) => {
      c.anims.forEach((a) => a.cancel());
      const delay = i * 60; // die 2 is 60ms behind, with a mirrored tilt
      const mirror = i ? -1 : 1;
      // the cube: a random start, then 2 full turns on X and 1 on Y onto the final face (same transform list = per-function interpolation)
      const rx0 = Math.round((Math.random() * 2 - 1) * 80);
      const ry0 = Math.round((Math.random() * 2 - 1) * 80);
      const [fx, fy] = SHOW[values[i]].match(/-?\d+/g).map(Number);
      const cubeFrom = `rotateX(${fx - 720 + rx0}deg) rotateY(${fy - 360 + ry0}deg)`;
      const cubeAnim = animate(c.cube, [
        { transform: cubeFrom, offset: 0 },
        { transform: cubeFrom, offset: o(tl.windup), easing: easeTumble },
        { transform: SHOW[values[i]], offset: o(tl.tumbleEnd) },
        { transform: SHOW[values[i]] },
      ], { duration: tl.total, delay, fill: 'forwards' });
      // the wrapper: toss up and fall (translate), wind-up and settle (scale), tilt (rotate): three independent properties
      const lift = animate(c.tumble, [
        { translate: '0 0', offset: 0 },
        { translate: '0 0', offset: o(tl.windup), easing: easeRise },
        { translate: `0 ${-toss}px`, offset: o(tl.apex), easing: easeFall },
        { translate: '0 0', offset: o(tl.tumbleEnd) },
        { translate: '0 0' },
      ], { duration: tl.total, delay, fill: 'none' });
      const size = animate(c.tumble, [
        { scale: '1', offset: 0, easing: 'ease-in' },
        { scale: '.94', offset: o(tl.windup) },
        { scale: '1', offset: o(tl.windup + 120) },
        { scale: '1', offset: o(tl.tumbleEnd), easing: easeSettle },
        { scale: '1.06', offset: o(tl.tumbleEnd + tl.settle * 0.35) },
        { scale: '.98', offset: o(tl.tumbleEnd + tl.settle * 0.7) },
        { scale: '1' },
      ], { duration: tl.total, delay, fill: 'none' });
      const tw = (f) => o(tl.windup + tl.tumble * f);
      const turn = animate(c.tumble, [
        { rotate: '0deg', offset: 0 },
        { rotate: '0deg', offset: o(tl.windup) },
        { rotate: `${-tilt * mirror}deg`, offset: tw(0.15) },
        { rotate: `${7 * mirror}deg`, offset: tw(0.45) },
        { rotate: `${-3 * mirror}deg`, offset: tw(0.75) },
        { rotate: '0deg', offset: o(tl.tumbleEnd) },
        { rotate: '0deg' },
      ], { duration: tl.total, delay, fill: 'none' });
      // the pre-blurred shadow: grows on the wind-up, shrinks and fades at the apex, squashes on the land
      const shade = animate(c.shadow, [
        { transform: 'scale(1)', opacity: 0.35, offset: 0 },
        { transform: 'scale(1.05)', opacity: 0.35, offset: o(tl.windup), easing: easeRise },
        { transform: 'scale(.6)', opacity: 0.18, offset: o(tl.apex), easing: easeFall },
        { transform: 'scale(1)', opacity: 0.35, offset: o(tl.tumbleEnd) },
        { transform: 'scale(1.1, 1)', opacity: 0.35, offset: o(tl.tumbleEnd + tl.settle * 0.35) },
        { transform: 'scale(1)', opacity: 0.35 },
      ], { duration: tl.total, delay, fill: 'none' });
      c.anims = [cubeAnim, lift, size, turn, shade];
      if (i === 0) setTimeout(() => haptic('dieSettle'), tl.tumbleEnd);
      return cubeAnim.finished?.then(() => {
        c.cube.style.transform = SHOW[values[i]];
        cubeAnim.cancel();
      }, () => {});
    });
    await Promise.all(jobs);
    showResult(values, true);
    await new Promise((r) => { setTimeout(r, RESULT.pop); });
  }

  return { el: root, roll, setValues };
}
