// Win and game-over screens.
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { foxImg, riseIn } from '../fox.js';
import { motionOK } from '../prefs.js';
import { button } from '../widgets.js';
import { money, moneyIsolated, numberText } from '../format.js';
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

export function createWin({ match, onAgain, onMenu }) {
  if (isMultiplayer(match)) return createMatchWin({ match, onAgain, onMenu });
  const state = match.players[0].state;
  const st = statement(state);
  const m = meter({ large: true });
  m.set(st.passiveIncome, st.totalExpenses, { animate: false });
  const text = t('win.shareText', { turns: tp('plural.turnsIn', state.turn), passive: moneyIsolated(st.passiveIncome) });
  const share = async () => {
    haptic('tap');
    // the Web Share API when there is one; otherwise (or when it fails) the clipboard, then a toast says what happened
    const r = await shareText(text, { title: t('app.title') });
    if (r === 'copied') toast(t('win.copied'));
    else if (r === 'failed') toast(t('win.copyFailed'));
  };
  const hammock = foxImg('hammock', { height: 250, altKey: 'fox.alt.hammock', cls: 'hammock', lazy: true });
  const winFox = h('div', { class: 'win-fox' }, h('div', { class: 'fox-halo fox-halo-win', 'aria-hidden': 'true' }), hammock, h('i', { class: 'glint', 'aria-hidden': 'true' }));
  const el = h('section', { class: 'screen screen-win', 'data-screen': 'win' },
    h('div', { class: 'end-hero' },
      winFox,
      h('h1', { class: 'title title-win' }, t('win.title')),
      h('p', { class: 'tagline' }, t('win.text'))),
    h('div', { class: 'end-card' },
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('win.passive')), h('div', { class: 'win-big tone-income' }, money(st.passiveIncome))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('win.expenses')), h('div', { class: 'win-mid tone-expense' }, money(st.totalExpenses)))),
      m.el,
      winStats([
        statBox(state.turn, 'turns'), statBox(state.assets.length, 'assets'), statBox(state.kids, 'kids'),
        state.stats.donations ? statBox(state.stats.donations, 'donations') : null,
      ])),
    h('div', { class: 'end-actions' },
      button(t('win.again'), { variant: 'primary', size: 'lg', 'data-action': 'again', 'data-autofocus': '', onClick: onAgain }),
      h('div', { class: 'end-row' }, reportButton(match), button(t('win.change'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu })),
      button(t('win.share'), { variant: 'text', cls: 'btn-share', 'data-action': 'share', onClick: share })));
  return {
    el,
    start() {
      haptic('win'); sound('win');
      confetti(el);
      dropIn(hammock);
    },
  };
}

export function createOver({ match, onRetry, onMenu }) {
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
      reportButton(match),
      button(t('gameOver.menu'), { variant: 'text', cls: 'btn-menu-text', 'data-action': 'menu', onClick: onMenu })));
  return { el, start() { haptic('error'); riseIn(overFox); } };
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
      h('p', { class: 'tagline' }, t('standings.winnerText'))),
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
