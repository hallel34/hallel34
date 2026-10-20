// Win and game-over screens.
import { h, html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { mascot } from '../mascot.js';
import { button } from '../widgets.js';
import { money, moneyText, numberText } from '../format.js';
import { meter } from '../widgets.js';
import { confetti, haptic, sound, toast } from '../fx.js';
import { statement } from '../../engine/index.js';

const rays = () => html(`<svg class="rays" aria-hidden="true" focusable="false" viewBox="-300 -300 600 600"><g fill="#FFE27A" opacity=".16">${
  Array.from({ length: 12 }, (_, i) => `<path d="M0 0L-60 -420L60 -420z" transform="rotate(${i * 30})"/>`).join('')
}</g></svg>`);

const statBox = (value, label) => h('div', { class: 'win-stat' }, h('span', { class: 'win-stat-num' }, numberText(value)), h('span', { class: 'win-stat-label' }, label));

/** Tile grid sized to its count (2 or 4 tiles -> 2 columns, otherwise one row) so no tile is orphaned. */
function winStats(tiles) {
  const list = tiles.filter(Boolean);
  return h('div', { class: 'win-stats', 'data-count': String(list.length) }, list);
}

export function createWin({ state, onAgain }) {
  const st = statement(state);
  const m = meter({ large: true });
  m.set(st.passiveIncome, st.totalExpenses, { animate: false });
  const text = t('win.shareText', { turns: state.turn, passive: moneyText(st.passiveIncome) });
  const share = async () => {
    haptic('tap');
    try {
      if (navigator.share) { await navigator.share({ title: t('app.title'), text }); return; }
      await navigator.clipboard.writeText(text);
      toast(t('win.copied'));
    } catch { /* user cancelled */ }
  };
  const el = h('section', { class: 'screen screen-win', 'data-screen': 'win' },
    h('div', { class: 'rays-wrap', 'aria-hidden': 'true' }, rays()),
    h('div', { class: 'end-hero' },
      mascot({ mood: 'happy', width: 150, cls: 'jump' }),
      h('h1', { class: 'title title-win' }, t('win.title')),
      h('p', { class: 'tagline' }, t('win.text'))),
    h('div', { class: 'glass glass-strong end-card' },
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('win.passive')), h('div', { class: 'win-big tone-income' }, money(st.passiveIncome))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('win.expenses')), h('div', { class: 'win-mid tone-expense' }, money(st.totalExpenses)))),
      m.el,
      winStats([
        statBox(state.turn, t('win.turns')), statBox(state.assets.length, t('win.assets')), statBox(state.kids, t('win.kids')),
        state.stats.donations ? statBox(state.stats.donations, t('win.donations')) : null,
      ])),
    h('div', { class: 'end-actions' },
      button(t('win.again'), { variant: 'primary', size: 'lg', 'data-action': 'again', 'data-autofocus': '', onClick: onAgain }),
      button(t('win.share'), { variant: 'secondary', 'data-action': 'share', onClick: share })));
  return {
    el,
    start() {
      haptic('win'); sound('win');
      confetti(el);
    },
  };
}

export function createOver({ state, onRetry, onMenu }) {
  const st = statement(state);
  const tip = t(`gameOver.tip${(state.turn % 3) + 1}`);
  const el = h('section', { class: 'screen screen-over', 'data-screen': 'over' },
    h('div', { class: 'end-hero' },
      mascot({ mood: 'sad', width: 132, cls: 'sway' }),
      h('h1', { class: 'title title-over' }, t('gameOver.title')),
      h('p', { class: 'tagline' }, t('gameOver.text'))),
    h('div', { class: 'glass glass-strong end-card' },
      winStats([
        statBox(state.turn, t('stats.turns')), statBox(state.stats.paydays, t('stats.paydays')), statBox(state.stats.dealsBought, t('stats.dealsBought')),
      ]),
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('stats.peakPassive')), h('div', { class: 'win-mid tone-income' }, money(state.stats.peakPassive))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('statement.monthlyCashFlow')), h('div', { class: 'win-mid tone-expense' }, money(st.monthlyCashFlow, { sign: true })))),
      h('p', { class: 'tip' }, h('b', null, `${t('gameOver.tipTitle')}: `), tip)),
    h('div', { class: 'end-actions' },
      button(t('gameOver.retry'), { variant: 'primary', size: 'lg', 'data-action': 'retry', 'data-autofocus': '', onClick: onRetry }),
      button(t('gameOver.menu'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu })));
  return { el, start() { haptic('error'); } };
}
