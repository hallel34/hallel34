// L4: the 'מה למדתי' report sheet, opened from the win / game-over / standings screens.
// Collapsed by nature (a button opens it), neutral on game over: red appears only on a deal row, never on the player.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { openLayer } from './modal.js';
import { icon } from './icons.js';
import { foxImg } from './fox.js';
import { button } from './widgets.js';
import { openDictionary } from './learn.js';
import { reportView } from '../learn/report.js';
import { setLearnMode } from '../learn/context.js';
import { playerToken, playerName, nameBdi } from './players.js';
import { haptic } from './fx.js';

function sectionNode(sec, extra = null) {
  return h('section', { class: `rep-sec${sec.empty ? ' is-empty' : ''}`, 'data-section': sec.id, 'data-tier': sec.tier ?? null, 'data-kind': sec.kind ?? null },
    h('h3', { class: 'rep-title' }, sec.title), h('p', { class: 'rep-text' }, sec.text), extra);
}

/** The report of one player's final state as DOM (also used by tests through its data attributes). */
export function reportBody(state, { seed, theme, onTheme, onDictionary }) {
  const v = reportView(state, { seed, theme });
  const conv = h('section', { class: 'rep-sec rep-conv', 'data-section': 'conversation', 'data-theme': v.conversation.theme, 'aria-live': 'polite' },
    h('h3', { class: 'rep-title' }, v.conversation.title),
    h('p', { class: 'rep-intro' }, v.conversation.intro),
    h('p', { class: 'rep-theme' }, v.conversation.themeTitle),
    h('ol', { class: 'rep-questions' }, v.conversation.questions.map((q) => h('li', null, q))),
    v.conversation.count > 1 ? button(t('learn.nextTheme'), { variant: 'secondary', size: 'sm', cls: 'rep-next', 'data-action': 'next-theme', onClick: onTheme }) : null);
  return h('div', { class: 'rep', 'data-won': String(v.won), 'data-tip': v.tipId },
    h('div', { class: 'rep-hero' },
      v.fox ? h('div', { class: 'fox-pop rep-pop', 'aria-hidden': 'true' }, foxImg(v.fox.pose, { size: 52 })) : null,
      h('div', { class: 'rep-hero-text' }, h('p', { class: 'rep-subtitle' }, v.subtitle), v.fox ? h('p', { class: 'rep-fox' }, v.fox.text) : null,
        v.foxExtra ? h('p', { class: 'rep-fox rep-fox-extra' }, v.foxExtra) : null)),
    ...v.sections.map((sec) => {
      if (sec.id === 'concepts') {
        return sectionNode(sec, button(sec.dictionary, { variant: 'secondary', size: 'sm', cls: 'rep-dict', 'data-action': 'report-dictionary', onClick: onDictionary }));
      }
      if (sec.id === 'greenDecisions' && v.guessLine) return sectionNode(sec, h('p', { class: 'rep-text rep-guess', 'data-eye': 'true' }, icon('star', { size: 18, width: 2.8 }), h('span', null, v.guessLine)));
      return sectionNode(sec);
    }),
    h('section', { class: 'rep-sec rep-stats', 'data-section': 'stats' }, h('h3', { class: 'rep-title' }, v.statsTitle),
      h('div', { class: 'rep-grid' }, v.stats.map((x) => h('div', { class: 'rep-stat', 'data-stat': x.id }, h('span', { class: 'rep-stat-label' }, x.label), h('bdi', { class: 'rep-stat-value', dir: 'ltr' }, x.value))))),
    h('section', { class: 'rep-sec rep-tip', 'data-section': 'nextStep', 'data-tip': v.tip.id }, h('h3', { class: 'rep-title' }, v.tip.title), h('p', { class: 'rep-text' }, v.tip.text)),
    conv);
}

/**
 * @param match   the finished match
 * @param index   whose report to open first (default: the winner, else the first player)
 */
export function openReport({ match, index = null }) {
  const multi = match.players.length > 1;
  let who = index ?? (match.winnerIndex ?? 0);
  let theme = 0;
  let layer;
  const scroll = h('div', { class: 'sheet-scroll rep-scroll', tabindex: '0', role: 'region' });
  const picker = multi ? h('div', { class: 'seg rep-who', role: 'group', 'aria-label': t('learn.reportPlayerLabel') }) : null;

  function paintPicker() {
    picker?.replaceChildren(...match.players.map((p, i) => h('button', {
      type: 'button', class: 'seg-btn', 'data-player': String(i), 'aria-pressed': String(i === who),
      onClick: () => { who = i; theme = 0; haptic('tap'); render(`.rep-who [data-player="${i}"]`); },
    }, playerToken(p.color), nameBdi(playerName(p, i)))));
  }
  /** Re-renders the report; keyboard focus goes back to the control that was used (a re-render drops the focused node). */
  function render(focusSel = null) {
    const p = match.players[who];
    setLearnMode(p.state.mode);
    paintPicker();
    scroll.setAttribute('aria-label', multi ? `${t('learn.reportPlayer')} ${playerName(p, who)}` : t('learn.reportOpen'));
    const body = reportBody(p.state, {
      seed: p.state.seed, theme,
      onTheme: () => { theme += 1; haptic('tap'); render('[data-action="next-theme"]'); scroll.querySelector('[data-section="conversation"]')?.scrollIntoView?.({ block: 'nearest' }); },
      onDictionary: () => openDictionary(),
    });
    scroll.replaceChildren(...[picker, body].filter(Boolean));
    if (focusSel) (scroll.querySelector(focusSel) ?? scroll).focus?.({ preventScroll: true });
  }
  render();

  const content = h('div', { class: 'sheet report-sheet', 'data-sheet': 'report' },
    h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i', null)),
    h('div', { class: 'sheet-head' }, h('h2', { class: 'dialog-title' }, t('learn.reportOpen')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), onClick: () => layer.close() }, icon('close', { size: 22 }))),
    scroll);
  layer = openLayer(content, { kind: 'sheet', label: t('learn.reportOpen') });
  return layer;
}
