// The optional 3-question check after the story (spec section 7): guess first, instant feedback with the number, ONE retry,
// 'הראו לי', options in random order, no score that shames. Runs inside the story layer (the story hands over its three hosts).
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { foxImg } from '../fox.js';
import { button } from '../widgets.js';
import { haptic, animate } from '../fx.js';
import { motionOK } from '../prefs.js';
import { tut } from '../hint-ui.js';
import { createQuiz, shuffled } from '../../learn/tutorial.js';
import { markQuizDone } from '../../learn/tutorial-store.js';
import { fillSlots } from '../../learn/slots.js';
import { coinScale, scaleTypedMoney } from '../format.js';

const swap = (host, ...kids) => host.replaceChildren(...kids);
const fade = (el) => animate(el, [{ opacity: 0, transform: motionOK() ? 'translateY(8px)' : 'none' }, { opacity: 1, transform: 'none' }], { duration: motionOK() ? 220 : 120, easing: 'ease-out' });

/**
 * @param hosts   { viewHost, topHost, ctaHost, close, goTo(screenIndex, back) } from the story layer
 * @param openParent () => void  opens the parent card
 * @returns Promise resolved when the layer was closed from inside
 */
export function runAfterStory(hosts, { openParent = null } = {}) {
  const content = tut();
  const { ui } = content;
  const cui = content.check.ui;
  const { viewHost, topHost, ctaHost } = hosts;
  topHost.replaceChildren(h('span'), h('span'), h('span'));

  return new Promise((resolve) => {
    const done = (r) => { hosts.close(r); resolve(r); };

    // ---- offer: two buttons of the same size ----
    function offer() {
      const view = h('div', { class: 'story-screen story-offer', 'data-story': 'offer' },
        h('div', { class: 'story-stage fox-only', 'data-pose': 'tip' }, h('div', { class: 'story-halo', 'aria-hidden': 'true' }), h('div', { class: 'story-fox' }, foxImg('tip', { height: 150 }))),
        h('h2', { class: 'story-title', tabindex: '-1' }, ui.offerCheck),
        h('div', { class: 'offer-actions' },
          button(ui.doCheck, { variant: 'primary', size: 'lg', 'data-action': 'check-yes', 'data-autofocus': '', onClick: () => { haptic('tap'); quiz(); } }),
          button(ui.skipCheck, { variant: 'secondary', size: 'lg', 'data-action': 'check-no', onClick: () => { haptic('tap'); done({ completed: true, skipped: false, quiz: false }); } })),
        openParent ? button(ui.parentCardOpen, { variant: 'text', cls: 'story-parent', 'data-action': 'parent-card', onClick: () => openParent() }) : null);
      swap(viewHost, view);
      swap(ctaHost);
      fade(view);
      view.querySelector('.story-title').focus({ preventScroll: true });
    }

    // ---- the questions ----
    function quiz() {
      const q = createQuiz(content.check.questions);
      let order = [];
      const ask = () => {
        const question = q.question;
        order = content.check.shuffleOptions ? shuffled(question.options) : question.options;
        const status = h('div', { class: 'quiz-status', role: 'status', 'aria-live': 'polite' });
        const optionButtons = order.map((o) => h('button', {
          type: 'button', class: 'quiz-option', 'data-option': o.id, 'data-correct': String(!!o.correct),
          onClick: () => choose(o, optionButtons, status, showMe),
        }, h('span', { class: 'quiz-mark', 'aria-hidden': 'true' }), h('span', { class: 'quiz-text' }, o.text)));
        const showMe = button(cui.showMe, { variant: 'text', cls: 'quiz-showme', 'data-action': 'quiz-showme', onClick: () => { haptic('tap'); q.showMe(); reveal(optionButtons, status, { revealCorrect: true }); } });
        const view = h('div', { class: 'story-screen story-quiz', 'data-story': 'quiz', 'data-question': question.id },
          h('p', { class: 'quiz-step' }, fillSlots(cui.question, { n: q.index + 1, total: q.total })),
          h('h2', { class: 'story-title quiz-prompt', tabindex: '-1' }, question.prompt),
          h('div', { class: 'quiz-options', role: 'group', 'aria-label': question.prompt }, optionButtons),
          status, showMe);
        swap(viewHost, view);
        swap(ctaHost);
        fade(view);
        view.querySelector('.quiz-prompt').focus({ preventScroll: true });
      };

      const choose = (option, buttons, status, showMe) => {
        haptic('tap');
        const r = q.answer(option.id);
        const btn = buttons.find((b) => b.dataset.option === option.id);
        btn.setAttribute('aria-pressed', 'true');
        btn.classList.add(r.correct ? 'is-right' : 'is-miss');
        btn.querySelector('.quiz-mark').replaceChildren(icon(r.correct ? 'check' : 'minus', { size: 20, width: 3.4 }));
        if (r.retry) {
          // wrong, one retry left: say why in one line, keep the other options open
          btn.disabled = true;
          status.replaceChildren(h('p', { class: 'quiz-fb' }, r.feedback), h('p', { class: 'quiz-hint' }, cui.tryAgain));
          fade(status);
          return;
        }
        reveal(buttons, status, { feedback: r.feedback, correct: r.correct });
        showMe.hidden = true;
      };

      /** The explanation (with the figure) and the way on. */
      const reveal = (buttons, status, { feedback = '', correct = false, revealCorrect = false } = {}) => {
        buttons.forEach((b) => { b.disabled = true; if (b.dataset.correct === 'true') { b.classList.add('is-right'); b.querySelector('.quiz-mark').replaceChildren(icon('check', { size: 20, width: 3.4 })); } });
        const last = q.index >= q.total - 1;
        status.replaceChildren(
          h('p', { class: 'quiz-fb' }, correct ? h('b', null, `${cui.correctTitle}. `) : null, feedback),
          h('p', { class: 'quiz-explain' }, h('b', null, `${cui.explainTitle}: `), scaleTypedMoney(coinScale() && q.question.explainJunior ? q.question.explainJunior : q.question.explain)));
        void revealCorrect;
        fade(status);
        ctaHost.replaceChildren(button(last ? cui.finish : cui.nextQuestion, { variant: 'primary', size: 'lg', cls: 'story-next', 'data-action': 'quiz-next', 'data-autofocus': '', onClick: () => { haptic('tap'); if (last) { markQuizDone(); result(q); } else { q.next(); ask(); } } }));
        viewHost.querySelector('.quiz-explain')?.scrollIntoView?.({ block: 'nearest' });
      };
      ask();
    }

    // ---- result ----
    function result(q) {
      const total = q.total;
      const score = q.score;
      const all = score === total;
      const missed = q.firstMissed();
      const replayScreen = missed ? content.story.screens.findIndex((s) => s.id === missed.replayScreen) : -1;
      const title = all ? content.check.result.all : fillSlots(content.check.result.some, { n: score });
      const replayTitle = replayScreen >= 0 ? content.story.screens[replayScreen].title : '';
      const view = h('div', { class: 'story-screen story-result', 'data-story': 'result', 'data-score': String(score) },
        h('div', { class: 'story-stage fox-only', 'data-pose': 'tip' }, h('div', { class: 'story-halo', 'aria-hidden': 'true' }), h('div', { class: 'story-fox' }, foxImg(all ? 'roll' : 'tip', { height: 150 }))),
        h('h2', { class: 'story-title', tabindex: '-1' }, title),
        !all && replayScreen >= 0
          ? button(fillSlots(content.check.result.replayLine, { title: replayTitle }), { variant: 'secondary', cls: 'quiz-replay', 'data-action': 'quiz-replay', onClick: () => hosts.goTo(replayScreen, () => result(q)) })
          : null);
      swap(viewHost, view);
      ctaHost.replaceChildren(button(cui.go, { variant: 'primary', size: 'lg', cls: 'story-next', 'data-action': 'check-go', 'data-autofocus': '', onClick: () => { haptic('tap'); done({ completed: true, skipped: false, quiz: true, score }); } }));
      fade(view);
      view.querySelector('.story-title').focus({ preventScroll: true });
    }

    offer();
  });
}
