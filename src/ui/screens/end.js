// Win and game-over screens.
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { foxImg, riseIn } from '../fox.js';
import { motionOK } from '../prefs.js';
import { button } from '../widgets.js';
import { money, moneyIsolated, numberText, coinScale } from '../format.js';
import { shareText } from './daily.js';
import { meter } from '../widgets.js';
import { confetti, haptic, sound, toast, animate } from '../fx.js';
import { statement, isMultiplayer } from '../../engine/index.js';
import { standingsList } from '../standings.js';
import { playerName, withName } from '../players.js';
import { icon } from '../icons.js';

const reportButton = (match) => button([icon('book', { size: 22, width: 2.4 }), t('learn.reportOpen')], { variant: 'secondary', cls: 'btn-report', 'data-action': 'report', onClick: async () => { const { openReport } = await import('../report.js'); openReport({ match }); } });

const statBox = (value, label) => h('div', { class: 'win-stat' }, h('span', { class: 'win-stat-num' }, numberText(value)), h('span', { class: 'win-stat-label' }, tp(`plural.label.${label}`, value)));

/** Tile grid sized to its count (2 or 4 tiles -> 2 columns, otherwise one row) so no tile is orphaned. */
function winStats(tiles) {
  const list = tiles.filter(Boolean);
  return h('div', { class: 'win-stats', 'data-count': String(list.length) }, list);
}

/** Hammock: drop in from -40px (bounce, 500ms), then a gentle sway from the top centre. Fades only if motion is reduced. */
function dropIn(img) {
  if (!motionOK()) { riseIn(img); return; }
  img.style.transformOrigin = '50% 0';
  animate(img, [{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    .finished.then(() => {
      animate(img, [{ transform: 'rotate(-1.5deg)' }, { transform: 'rotate(1.5deg)' }], { duration: 3200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    }, () => {});
}

/** 0.5.0: the career block animates after the hammock lands (900ms; 300ms under reduced motion), then the rank-up dialog follows. */
const careerRun = (career) => { if (career?.run) setTimeout(() => { career.run(); }, motionOK() ? 900 : 300); };

/** 0.5.1 "שלחו אתגר" (spec §1.1). `onChallenge` is set only when the game can send one (challengeEligibility). */
const challengeButton = (onChallenge, opts = {}) => button([icon('challenge', { size: 24, width: 2 }), t('challenge.create.button')], {
  'data-action': 'challenge', onClick: () => { haptic('tap'); onChallenge(); }, ...opts,
});

// 0.5.1: the second argument ({ onChallenge }) is optional; read through `arguments` so the v3.1 signature stays as it was
export function createWin({ match, onAgain, onMenu }) {
  const { onChallenge = null, career = null } = arguments[1] ?? {}; // eslint-disable-line prefer-rest-params
  if (isMultiplayer(match)) return createMatchWin({ match, onAgain, onMenu });
  const state = match.players[0].state;
  const st = statement(state);
  const m = meter({ large: true });
  m.set(st.passiveIncome, st.totalExpenses, { animate: false });
  // The headline follows the REAL win condition (the engine sets state.status 'won' only when passive income > total monthly expenses). A short
  // game that ran out of rounds ends with match.status 'won' + shortFinish but the player's state still 'playing': that is an honest "rounds over"
  // result with the percent reached, never "חופש כלכלי!" (live QA F3).
  const freedom = state.status === 'won';
  const text = freedom
    ? t('win.shareText', { turns: tp('plural.turnsIn', state.turn), passive: moneyIsolated(st.passiveIncome) })
    : t('win.shortShareText', { rounds: numberText(match.roundCap ?? state.turn), passive: moneyIsolated(st.passiveIncome), expenses: moneyIsolated(st.totalExpenses) });
  const share = async () => {
    haptic('tap');
    // the Web Share API when there is one; otherwise (or when it fails) the clipboard, then a toast says what happened
    const r = await shareText(text, { title: t('app.title') });
    if (r === 'copied') toast(t('win.copied'));
    else if (r === 'failed') {
      // QA round 14 P2-8: like the daily result, a failed copy leaves the text in a box the player can select and copy by hand
      toast(t('win.copyFailed'));
      shareBox.hidden = false; shareBox.focus({ preventScroll: true }); shareBox.select(); shareBox.scrollIntoView?.({ block: 'nearest' });
    }
  };
  const shareBox = h('textarea', { class: 'daily-sharebox win-sharebox', readonly: '', hidden: true, rows: 3, 'aria-label': t('daily.shareBox'), 'data-sharebox': '' });
  shareBox.value = text.replace(/[\u2066-\u2069]/g, '');
  const hammock = freedom ? foxImg('hammock', { height: 250, altKey: 'fox.alt.hammock', cls: 'hammock', lazy: true }) : foxImg('think', { size: 190, altKey: 'fox.alt.think', cls: 'sway' });
  const winFox = freedom
    ? h('div', { class: 'win-fox' }, h('div', { class: 'fox-halo fox-halo-win', 'aria-hidden': 'true' }), hammock, h('i', { class: 'glint', 'aria-hidden': 'true' }))
    : h('div', { class: 'over-fox' }, h('div', { class: 'fox-halo fox-halo-muted', 'aria-hidden': 'true' }), hammock);
  const el = h('section', { class: `screen screen-win${freedom ? '' : ' is-rounds'}`, 'data-screen': 'win', 'data-freedom': String(freedom) },
    h('div', { class: 'end-hero' },
      winFox,
      h('h1', { class: `title ${freedom ? 'title-win' : 'title-over'}` }, t(freedom ? 'win.title' : 'win.shortTitle')),
      h('p', { class: 'tagline' }, freedom ? t('win.text') : coinScale() ? t('win.shortTextJunior') : t('win.shortText'))),
    h('div', { class: 'end-card' },
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('win.passive')), h('div', { class: 'win-big tone-income' }, money(st.passiveIncome))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('win.expenses')), h('div', { class: 'win-mid tone-expense' }, money(st.totalExpenses)))),
      m.el,
      winStats([
        statBox(state.turn, 'turns'), statBox(state.assets.length, 'assets'), statBox(state.kids, 'kids'),
        state.stats.donations ? statBox(state.stats.donations, 'donations') : null,
      ])),
    onChallenge
      // a challenge replaces the plain share: gold "שלחו אתגר", ghosts "שחקו שוב · מה למדתי", text "שנו מצב או מקצוע" (same height)
      ? h('div', { class: 'end-actions', 'data-challenge': 'on' },
        challengeButton(onChallenge, { variant: 'primary', size: 'lg', 'data-autofocus': '' }),
        h('div', { class: 'end-row' }, button(t('win.again'), { variant: 'secondary', 'data-action': 'again', onClick: onAgain }), reportButton(match)),
        button(t('win.change'), { variant: 'text', cls: 'btn-menu-text', 'data-action': 'menu', onClick: onMenu }))
      : h('div', { class: 'end-actions' },
        button(t('win.again'), { variant: 'primary', size: 'lg', 'data-action': 'again', 'data-autofocus': '', onClick: onAgain }),
        h('div', { class: 'end-row' }, reportButton(match), button(t('win.change'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu })),
        button(t('win.share'), { variant: 'text', cls: 'btn-share', 'data-action': 'share', onClick: share }), shareBox));
  if (career) el.querySelector('.end-card')?.append(career.el); // 0.5.0: the career block closes the stats card
  return {
    el,
    start() {
      if (freedom) {
        haptic('win'); sound('win');
        confetti(el);
        dropIn(hammock);
      } else riseIn(hammock); // a calm arrival: no confetti, no win sound
      careerRun(career);
    },
  };
}

export function createOver({ match, onRetry, onMenu }, { onChallenge = null, career = null } = {}) {
  if (isMultiplayer(match)) return createMatchOver({ match, onRetry, onMenu });
  const state = match.players[0].state;
  const st = statement(state);
  const tip = t(`gameOver.tip${(state.turn % 3) + 1}`);
  // Same tired pose as the start screen, decorative here (the copy carries the message). Never celebrate.
  const overFox = h('div', { class: 'over-fox' }, h('div', { class: 'fox-halo fox-halo-muted', 'aria-hidden': 'true' }), foxImg('tired', { height: 200, cls: 'sway' }));
  const el = h('section', { class: 'screen screen-over', 'data-screen': 'over' },
    h('div', { class: 'end-hero' },
      overFox,
      h('h1', { class: 'title title-over' }, t('gameOver.title')),
      h('p', { class: 'tagline' }, t('gameOver.foxLine'))),
    h('div', { class: 'end-card' },
      h('p', { class: 'cause' }, t('gameOver.text')),
      winStats([
        statBox(state.turn, 'turns'), statBox(state.stats.paydays, 'paydays'), statBox(state.stats.dealsBought, 'deals'),
      ]),
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('stats.peakPassive')), h('div', { class: 'win-mid tone-income' }, money(state.stats.peakPassive))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('statement.monthlyCashFlow')), h('div', { class: 'win-mid tone-expense' }, money(st.monthlyCashFlow, { sign: true })))),
      h('p', { class: 'tip' }, h('b', null, `${t('gameOver.tipTitle')}: `), tip)),
    h('div', { class: 'end-actions' },
      button(t('gameOver.retry'), { variant: 'primary', size: 'lg', 'data-action': 'retry', 'data-autofocus': '', onClick: onRetry }),
      // a challenge is offered after a loss, not pushed: it shares the ghost row with "מה למדתי" (spec §1.1)
      onChallenge ? h('div', { class: 'end-row' }, challengeButton(onChallenge, { variant: 'secondary' }), reportButton(match)) : reportButton(match),
      button(t('gameOver.menu'), { variant: 'text', cls: 'btn-menu-text', 'data-action': 'menu', onClick: onMenu })));
  if (career) el.querySelector('.end-card')?.append(career.el);
  return { el, start() { haptic('error'); riseIn(overFox); careerRun(career); } };
}

/** Hot-seat win: the winner on the hammock, then everyone's standings. */
function createMatchWin({ match, onAgain, onMenu }) {
  const winner = match.players[match.winnerIndex];
  const name = playerName(winner, match.winnerIndex);
  const hammock = foxImg('hammock', { height: 250, altKey: 'fox.alt.hammock', cls: 'hammock', lazy: true });
  const winFox = h('div', { class: 'win-fox' }, h('div', { class: 'fox-halo fox-halo-win', 'aria-hidden': 'true' }), hammock, h('i', { class: 'glint', 'aria-hidden': 'true' }));
  const el = h('section', { class: 'screen screen-win screen-match-end', 'data-screen': 'win', 'data-multi': 'true' },
    h('div', { class: 'end-hero' },
      winFox,
      h('h1', { class: `title title-win pc-text-${winner.color}` }, withName(t('standings.winnerTitle', { name: '{name}' }), name)),
      h('p', { class: 'tagline' }, match.shortFinish ? t('win.shortWinner', { rounds: match.roundCap }) : t('standings.winnerText'))),
    h('div', { class: 'end-card', tabindex: '0', role: 'region', 'aria-label': t('standings.title') }, h('h2', { class: 'end-card-title' }, t('standings.title')), standingsList(match)),
    h('div', { class: 'end-actions' },
      button(t('win.again'), { variant: 'primary', size: 'lg', 'data-action': 'again', 'data-autofocus': '', onClick: onAgain }),
      h('div', { class: 'end-row' }, reportButton(match), button(t('players.changeSettings'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu }))));
  return {
    el,
    start() {
      haptic('win'); sound('win');
      confetti(el);
      dropIn(hammock);
    },
  };
}

/** Hot-seat match where every player ran out of road. */
function createMatchOver({ match, onRetry, onMenu }) {
  const overFox = h('div', { class: 'over-fox' }, h('div', { class: 'fox-halo fox-halo-muted', 'aria-hidden': 'true' }), foxImg('tired', { height: 200, cls: 'sway' }));
  const el = h('section', { class: 'screen screen-over screen-match-end', 'data-screen': 'over', 'data-multi': 'true' },
    h('div', { class: 'end-hero' },
      overFox,
      h('h1', { class: 'title title-over' }, t('standings.allOutTitle')),
      h('p', { class: 'tagline' }, t('standings.allOutText'))),
    h('div', { class: 'end-card', tabindex: '0', role: 'region', 'aria-label': t('standings.title') }, h('h2', { class: 'end-card-title' }, t('standings.title')), standingsList(match)),
    h('div', { class: 'end-actions' },
      button(t('gameOver.retry'), { variant: 'primary', size: 'lg', 'data-action': 'retry', 'data-autofocus': '', onClick: onRetry }),
      h('div', { class: 'end-row' }, reportButton(match), button(t('players.changeSettings'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu }))));
  return { el, start() { haptic('error'); riseIn(overFox); } };
}
