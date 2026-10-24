// 'המשחק הראשון עם מקסי': the five story screens (spec section 2, art.md section 2) in one full-screen layer. Loaded lazily
// (dynamic import) together with its three SVG illustrations, so the first paint of the app never pays for it.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { openLayer } from '../modal.js';
import { foxImg, dirSign } from '../fox.js';
import { icon } from '../icons.js';
import { button } from '../widgets.js';
import { money, moneyText } from '../format.js';
import { animate, haptic } from '../fx.js';
import { motionOK } from '../prefs.js';
import { holdBack } from '../history.js';
import { tut, fillNodes } from '../hint-ui.js';
import { storyFigures, leftTemplate } from '../../learn/tutorial.js';
import treeUrl from '../../assets/tutorial/tree-coins.svg?url';
import billsUrl from '../../assets/tutorial/bills-stack.svg?url';
import bankUrl from '../../assets/tutorial/bank.svg?url';

/** Art per screen id (screens 3 and 5 are the fox alone). */
const ART = { 's1-passive': treeUrl, 's2-expenses': billsUrl, 's4-loan': bankUrl };
const num = (n) => h('bdi', { class: 'money story-num', dir: 'ltr' }, moneyText(n));

/** Text with every ₪ amount wrapped as a big, direction-safe number (the fixed examples of screens 1 and 4). */
function emphasise(text) {
  const out = [];
  for (const part of String(text).split(/(₪[\d,]+)/)) {
    if (/^₪[\d,]+$/.test(part)) out.push(h('bdi', { class: 'money story-num', dir: 'ltr' }, part));
    else if (part) out.push(part);
  }
  return out;
}

/** The slot values of every screen for a profession (numbers from the game data, see storyFigures). */
export function storySlots(engine, professionId) {
  const state = engine.newGame({ mode: 'family', professionId, seed: 1 });
  const f = storyFigures(state, engine.data.cards);
  return {
    f,
    s2: { profession: f.profession, expenses: num(f.expenses), debts: num(f.debts), salary: num(f.salary) },
    s3: { profession: f.profession, expenses: num(f.expenses), monthly: num(f.cart), left: num(f.left) },
    s5: { passive: num(f.passive), salary: num(f.salary), expenses: num(f.expenses), monthly: num(f.monthly), months: h('bdi', { dir: 'ltr' }, String(f.months)), amount: num(f.amount) },
  };
}

function chainRow(screen) {
  const icons = ['opportunity', 'plus', 'statement', 'payday'];
  const chips = screen.chainShort.map((label, i) => h('li', { class: 'chain-chip' },
    h('span', { class: 'chain-icon', 'aria-hidden': 'true' }, icon(icons[i], { size: 24, width: 2.4 })),
    h('span', { class: 'chain-label' }, label),
    h('span', { class: 'vh' }, screen.chain[i])));
  const withArrows = chips.flatMap((c, i) => (i ? [h('li', { class: 'chain-arrow', 'aria-hidden': 'true' }, icon('arrow', { size: 18, width: 3 })), c] : [c]));
  return h('div', { class: 'chain' },
    h('ol', { class: 'chain-row' }, withArrows),
    h('div', { class: 'chain-dots', 'aria-hidden': 'true' }, Array.from({ length: 24 }, (_, i) => h('i', { style: `--i:${i}` }))));
}

/** One screen as an element (the layer swaps these). */
export function storyScreen({ screen, slots, n, total, part = null }) {
  const ui = tut().ui;
  const ex = screen.example;
  const slotsFor = { 's2-expenses': slots.s2, 's3-freedom': slots.s3, 's5-turn': slots.s5 }[screen.id];
  // a screen of short 'parts': one idea at a time (part = index), or every part as plain lines when no index is given (the quiz replay)
  const parts = screen.parts?.length ? screen.parts : null;
  const cur = parts && part != null ? parts[Math.min(part, parts.length - 1)] : null;
  const lines = parts ? (cur ? [cur.text] : parts.map((p) => p.text)) : screen.lines;
  const exampleText = cur ? cur.exampleText : parts ? null : ex.text;
  // 'ועוד ₪X בחודש לחופש': winning needs strictly more than the expenses, so the story's amount is followed by 'וקצת' too (round 12, item 8)
  const truthful = (x) => (slotsFor && x.includes('{left}') && slots.f.left > 0 ? leftTemplate(x, slots.f.left, { andABit: t('goal.andABitShort'), onTheLine: x }) : x);
  const exampleBody = exampleText ? (slotsFor ? fillNodes(truthful(exampleText), slotsFor) : emphasise(exampleText)) : null;
  const showChain = !!screen.chain && (!cur || cur.id === 'p2-gather' || cur.id === 'p4-times');
  // the 'במשחק זה מפושט' box belongs to one part (round 12: part 4 only, never repeated under part 5); without a list it follows the old 'from this part on' rule
  const showSimplify = screen.simplification && (!cur || (screen.simplificationShowOnParts
    ? screen.simplificationShowOnParts.includes(cur.id)
    : !screen.simplificationAfterPart || parts.findIndex((p) => p.id === screen.simplificationAfterPart) <= parts.indexOf(cur)));
  const art = ART[screen.id];
  const pose = screen.pose;
  const stage = h('div', { class: `story-stage${art ? ' has-art' : ' fox-only'}`, 'data-pose': pose },
    h('div', { class: 'story-halo', 'aria-hidden': 'true' }),
    h('div', { class: 'story-fox' }, foxImg(pose, { height: 150, cls: pose === 'hammock' ? 'sway' : 'bob' })),
    art ? h('img', { class: 'story-art', src: art, alt: '', width: 320, height: 240, decoding: 'async', draggable: 'false' }) : null);
  return h('div', { class: 'story-screen', 'data-story': screen.id, 'data-n': String(n), 'data-total': String(total) },
    stage,
    h('h2', { class: 'story-title', tabindex: '-1' }, screen.title),
    h('div', { class: 'story-body' }, lines.map((l) => h('p', null, slotsFor ? fillNodes(truthful(l), slotsFor) : l))),
    exampleBody || showChain
      ? h('div', { class: 'story-card', 'data-story-card': '' },
        exampleBody ? [h('span', { class: 'story-card-label' }, ui.exampleLabel), h('p', { class: 'story-card-text' }, exampleBody)] : null,
        ex?.footnote && !cur ? h('p', { class: 'story-card-foot' }, ex.footnote) : null,
        showChain ? chainRow(screen) : null)
      : null,
    showSimplify
      ? h('p', { class: 'story-simplify' }, h('b', { class: 'story-simplify-label' }, `${ui.simplificationLabel}: `), screen.simplification)
      : null,
    parts && cur ? h('p', { class: 'story-part-of', 'aria-live': 'polite' }, ui.partOf.replace('{n}', String(part + 1)).replace('{total}', String(parts.length))) : null);
}

const dots = (n, total) => h('div', { class: 'story-dots', role: 'img', 'aria-label': tut().ui.dots.replace('{n}', n).replace('{total}', total) },
  Array.from({ length: total }, (_, i) => h('i', { class: i + 1 === n ? 'is-on' : '' })));

/**
 * Plays the story in a full-screen layer. Resolves { completed, skipped }.
 * `host` lets the quiz continue in the same layer: after the last screen `onEnd(api)` may take over (it must return a promise).
 * @param startAt   0-based screen to open on
 * @param single    show only that screen (the quiz's 'see it again'), the button reads 'חזרה'
 */
export function runStory({ engine, professionId = 'teacher', startAt = 0, single = false, onEnd = null, onSkip = null }) {
  const content = tut();
  const screens = content.story.screens;
  const slots = storySlots(engine, professionId);
  const total = screens.length;
  let index = Math.min(Math.max(0, startAt), total - 1);
  let part = 0; // inside a screen that has parts
  const partsOf = (i) => (single ? 0 : screens[i].parts?.length ?? 0);
  let layer;
  let result = { completed: false, skipped: false };
  const viewHost = h('div', { class: 'story-view' });
  const topHost = h('div', { class: 'story-top' });
  const ctaHost = h('div', { class: 'story-cta' });
  const root = h('div', { class: 'story', 'data-story-root': '' }, topHost, viewHost, ctaHost);

  const cross = (el, dir) => {
    if (!motionOK()) return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
    const off = dirSign() * -24 * dir; // forward: from the inline-end side toward the start
    return animate(el, [{ opacity: 0, transform: `translateX(${-off}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
  };

  function entrance(el) {
    if (!motionOK()) return;
    const fox = el.querySelector('.story-fox');
    const art = el.querySelector('.story-art');
    const pose = el.querySelector('.story-stage')?.dataset.pose;
    if (fox) animate(fox, pose === 'hammock' ? [{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'translateY(0)' }] : [{ opacity: 0, transform: `translateX(${dirSign() * 24}px)` }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: pose === 'hammock' ? 500 : 300, easing: pose === 'hammock' ? 'cubic-bezier(.34,1.56,.64,1)' : 'cubic-bezier(.16,1,.3,1)' });
    if (art) animate(art, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 400, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)' });
    el.querySelectorAll('.chain-chip').forEach((c, i) => animate(c, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, delay: 150 * i, easing: 'cubic-bezier(.16,1,.3,1)' }));
    el.querySelectorAll('.chain-dots i').forEach((d, i) => animate(d, [{ opacity: 0.15 }, { opacity: 1 }], { duration: 80, delay: 600 + i * 30 }));
  }

  function paintTop() {
    const ui = content.ui;
    const back = h('button', { type: 'button', class: 'icon-btn story-back', 'aria-label': ui.back, 'data-action': 'story-back', onClick: () => go(-1) }, icon('arrow', { size: 22, width: 3 }));
    if ((index === 0 && part === 0) || single) back.style.visibility = 'hidden';
    const skip = single ? h('span', { class: 'story-skip-gap' }) : h('button', { type: 'button', class: 'btn btn-text story-skip', 'data-action': 'story-skip', onClick: () => skip_() }, ui.skip);
    topHost.replaceChildren(back, single ? h('span') : dots(index + 1, total), skip);
  }

  function paintCta() {
    const ui = content.ui;
    const nParts = partsOf(index);
    const last = index === total - 1 && (!nParts || part === nParts - 1);
    const label = single ? ui.back : nParts && part < nParts - 1 ? ui.partNext : last ? ui.go : ui.next;
    ctaHost.replaceChildren(button(label, { variant: 'primary', size: 'lg', cls: 'story-next', 'data-action': 'story-next', 'data-autofocus': '', onClick: () => go(1) }));
  }

  function show(dir = 1, { same = false } = {}) {
    const screen = screens[index];
    const el = storyScreen({ screen, slots, n: index + 1, total, part: partsOf(index) ? part : null });
    viewHost.replaceChildren(el);
    paintTop();
    paintCta();
    cross(el, dir);
    if (!same) entrance(el);
    el.querySelector('.story-title')?.focus({ preventScroll: true });
    el.querySelector('[data-story-card]')?.addEventListener('click', () => go(1));
    layer.panel.setAttribute('aria-label', content.ui.storyLayer.replace('{n}', index + 1).replace('{total}', total));
  }

  async function go(dir) {
    haptic('tap');
    if (single) { finish({ completed: false, skipped: false }); return; }
    // inside a screen of parts, 'הבא' / back move between its parts first
    const nParts = partsOf(index);
    if (nParts && part + dir >= 0 && part + dir < nParts) { part += dir; show(dir, { same: true }); return; }
    const next = index + dir;
    if (next < 0) return;
    if (next >= total) { result = { completed: true, skipped: false }; await end(); return; }
    index = next;
    part = dir < 0 ? Math.max(0, partsOf(index) - 1) : 0;
    show(dir);
  }

  let closing = false;
  async function end() {
    if (closing) return;
    if (onEnd) {
      // the caller (offer + quiz) keeps using this layer: it gets the three hosts and closes the layer itself
      closing = true;
      const r = await onEnd({ viewHost, topHost, ctaHost, close: finish, cross, slots, goTo: (i, back) => showSingle(i, back) });
      void r;
      return;
    }
    finish(result);
  }
  function skip_() { onSkip?.(); finish({ completed: false, skipped: true }); }
  function finish(r) {
    closing = true;
    layer.close(r);
  }
  /** One screen again (from the quiz result), then `back()`. */
  function showSingle(i, back) {
    const prev = { top: [...topHost.childNodes], view: [...viewHost.childNodes], cta: [...ctaHost.childNodes] };
    const screen = screens[i];
    const el = storyScreen({ screen, slots, n: i + 1, total });
    viewHost.replaceChildren(el);
    topHost.replaceChildren(h('span'), h('span'), h('span'));
    ctaHost.replaceChildren(button(content.ui.back, { variant: 'primary', size: 'lg', cls: 'story-next', 'data-action': 'story-back-to', 'data-autofocus': '', onClick: () => { topHost.replaceChildren(...prev.top); viewHost.replaceChildren(...prev.view); ctaHost.replaceChildren(...prev.cta); back?.(); } }));
    cross(el, 1); entrance(el);
    el.querySelector('.story-title')?.focus({ preventScroll: true });
  }

  layer = openLayer(root, { kind: 'modal', label: content.ui.title, dismissable: false, cls: 'layer-story' });
  // Back (Android / browser) steps to the previous screen; on the first screen, or once the check has begun, it closes the story
  const releaseBack = holdBack('story', () => {
    if (layer.done) return;
    if (!closing && !single && (index > 0 || part > 0)) go(-1);
    else if (closing) finish({ completed: true, skipped: false });
    else if (single) finish({ completed: false, skipped: false });
    else skip_();
  });
  layer.closed.then(() => releaseBack());
  show(1);
  return layer.closed.then((r) => r ?? result);
}
