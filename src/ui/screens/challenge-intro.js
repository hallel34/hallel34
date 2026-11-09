// 0.5.1 challenge intro (spec §2): the app opened with #c= shows who challenged, their verified result, the two challenge rules,
// and one gold "שחקו את האתגר". Also the link error screen (2.4 c). The creator's profession fox is the only fox here.
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { button } from '../widgets.js';
import { haptic, animate } from '../fx.js';
import { motionOK } from '../prefs.js';
import { professionFox } from '../professions.js';
import { AGE_BANDS, JUNIOR_AGE } from '../../engine/index.js';
import { ct, isJuniorView, modeLabel, turnsIn, viewerAge } from '../challenge/copy.js';
import coinUrl from '../../assets/coin-small.svg?url';

/** "התוצאה הקודמת תוחלף. לשחק שוב?" in the game's dialog surface. */
async function confirmAgain(onYes) {
  const { openLayer } = await import('../modal.js');
  const layer = openLayer(h('div', { class: 'dialog' },
    h('p', { class: 'dialog-text' }, ct('intro.playAgainConfirm')),
    h('div', { class: 'dialog-actions' },
      button(t('common.cancel'), { variant: 'secondary', 'data-action': 'ch-again-cancel', onClick: () => layer.close(false) }),
      button(ct('intro.playAgain'), { 'data-action': 'ch-again-confirm', onClick: () => layer.close(true) }))), { label: ct('intro.playAgain'), cls: 'layer-dialog' });
  if (await layer.closed) onYes?.();
}

const AGE_KEY = { upTo10: 'players.ageUpTo10', '11to13': 'players.age11to13', '14plus': 'players.age14plus' };

/** The verified / not verified badge (spec §8.3): never gold; "לא אומת" is a neutral dashed outline, never red. */
export function badge(ok, { sm = false } = {}) {
  return h('span', { class: `ch-badge ${ok ? 'is-ok' : 'is-no'}${sm ? ' is-sm' : ''}`, 'data-verified': String(!!ok) },
    icon(ok ? 'verified' : 'unverified', { size: sm ? 16 : 18, width: 2 }), h('span', null, ct(ok ? 'compare.verified' : 'compare.unverified')));
}
const topbar = (onClose) => h('div', { class: 'ch-top' },
  h('p', { class: 'ch-kicker' }, icon('challenge', { size: 20, width: 2 }), h('span', null, ct('intro.kicker'))),
  h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': ct('error.toHome'), 'data-action': 'ch-home', onClick: onClose }, icon('close', { size: 22 })));

/**
 * @param route        routeChallenge() result (screen 'intro')
 * @param profession   { id, title } of the link's profession
 * @param pendingName  the name of the other challenge in progress (state 'pendingOther')
 * @param handlers     { onPlay, onLater, onContinue, onResult, onPlayAgain, onAge }
 */
export function createChallengeIntro({ route, profession, pendingName = '', onPlay, onLater, onContinue, onResult, onPlayAgain, onAge }) {
  const v = route.them;
  const log = v.log;
  const name = log.name || '';
  const junior = isJuniorView();
  const fresh = route.fresh;
  const verified = route.verified && !fresh;
  const won = v.status === 'won';
  const resultLine = () => {
    const named = name ? 'Named' : '';
    if (won) return ct(`intro.resultWin${named}`, { name, turns: turnsIn(v.turns) });
    return ct(`intro.resultProgress${named}`, { name, pct: v.freedomPct ?? 0 });
  };
  const status = ct(route.verified ? 'compare.verified' : 'compare.unverified');
  const h1Label = fresh ? ct('intro.h1AriaFresh') : name ? ct('intro.h1AriaNamed', { name, result: resultLine(), status }) : ct('intro.h1Aria', { result: resultLine(), status });
  const title = h('h1', { class: 'ch-title', tabindex: '-1', 'aria-label': h1Label, 'data-autofocus': '' },
    name ? ct('intro.titleNamed', { name }) : fresh ? ct('intro.titleFresh') : ct('intro.title'));

  const chips = h('div', { class: 'ch-chips' },
    h('span', { class: 'ch-info-chip' }, profession.title),
    h('span', { class: 'ch-info-chip' }, t(log.config.mode === 'full' ? 'menu.modeFull' : 'menu.modeFamily')),
    log.config.junior ? h('span', { class: 'ch-info-chip', 'data-junior': '' }, h('img', { src: coinUrl, alt: '', width: 18, height: 18 }), t('challenge.board.juniorTag')) : null);
  const band = viewerAge();
  const fullNote = log.config.mode === 'full' && band && band !== '14plus' ? h('p', { class: 'ch-note', 'data-full-note': '' }, ct('intro.fullModeNote')) : null;

  // the result tile: the number + unit (52/900), or the % with a meter; a fresh link has no result to show
  let tile;
  if (fresh) tile = h('p', { class: 'ch-fresh', 'data-ch-fresh': '' }, ct('intro.resultFresh'));
  else {
    const muted = !route.verified;
    const pct = Math.min(100, v.freedomPct ?? 0);
    const value = !route.verified && v.code === 'REPLAY' ? h('span', { class: 'ch-big' }, '?')
      : won ? [h('bdi', { class: 'ch-big', dir: 'ltr' }, String(v.turns)), h('span', { class: 'ch-unit' }, ct(junior ? 'compare.turnsJunior' : 'compare.turns'))]
        : [h('bdi', { class: 'ch-big', dir: 'ltr' }, `${pct}%`), h('span', { class: 'ch-unit' }, ct('compare.freedom'))];
    tile = h('div', { class: `ch-result${muted ? ' is-muted' : ''}`, 'data-ch-result': won ? 'won' : 'progress' },
      h('div', { class: 'ch-result-head' }, h('span', { class: 'ch-result-label' }, resultLine()), badge(route.verified, { sm: true })),
      h('p', { class: 'ch-result-value' }, value),
      !won && route.verified ? h('div', { class: 'ch-meter', 'aria-hidden': 'true' }, h('i', { style: `inline-size:${pct}%` })) : null,
      muted ? h('p', { class: 'ch-note' }, ct('compare.unverifiedText')) : null);
  }
  const lede = h('p', { class: 'ch-lede' }, junior ? ct('intro.sameGame') : ct('intro.sameGame', { profession: profession.title, mode: modeLabel(log.config) }));
  const card = h('div', { class: 'ch-card' },
    h('div', { class: 'ch-bust' }, professionFox(profession.id, { width: 104, eager: true })),
    title, chips, fullNote, tile, lede, h('p', { class: 'ch-curious' }, ct('intro.curious')));

  // the age row: only when this device never said and the link is junior (no answer = shekels)
  let ageRow = null;
  if (!band && log.config.junior) {
    ageRow = h('fieldset', { class: 'age-group ch-age', 'data-ch-age': '' },
      h('legend', { class: 'age-legend' }, t('players.ageGroupSingle')),
      h('div', { class: 'age-chips' }, AGE_BANDS.map((b) => {
        const input = h('input', { type: 'radio', name: 'ch-age', value: b, class: 'age-input', 'data-age': b });
        input.addEventListener('change', () => { if (input.checked) { haptic('tap'); onAge?.(b); } });
        return h('label', { class: 'age-chip' }, input, h('span', { class: 'age-chip-text', dir: 'ltr' }, t(AGE_KEY[b])));
      })));
  }
  const rules = h('div', { class: 'banner banner-info ch-rules', 'data-ch-rules': '' }, icon('help', { size: 20 }),
    h('div', null,
      h('p', null, h('b', null, `${ct('rules.title')}: `), `${ct('rules.charity')} ${ct('rules.reroll')}`),
      h('p', { class: 'ch-rules-why' }, ct(fresh ? 'rules.whyFresh' : 'rules.why'))));
  const warn = route.state === 'pendingOther'
    ? h('div', { class: 'banner banner-warn ch-pending', role: 'status' }, icon('challenge', { size: 20, width: 2 }), h('span', null, pendingName && !junior ? ct('intro.pendingOtherNamed', { name: pendingName }) : ct('intro.pendingOther')))
    : null;

  const tap = (fn) => () => { haptic('tap'); fn?.(); };
  let primary; let secondary;
  if (route.state === 'continue') {
    primary = button(ct('intro.continue'), { variant: 'primary', size: 'lg', 'data-action': 'ch-continue', onClick: tap(onContinue) });
    secondary = button(ct('intro.later'), { variant: 'text', 'data-action': 'ch-later', onClick: onLater });
  } else if (route.state === 'played') {
    primary = button(ct('intro.toResult'), { variant: 'primary', size: 'lg', 'data-action': 'ch-result', onClick: tap(onResult) });
    secondary = button(ct('intro.playAgain'), { variant: 'text', 'data-action': 'ch-again', onClick: () => confirmAgain(onPlayAgain) });
  } else {
    primary = button(ct('intro.cta'), { variant: 'primary', size: 'lg', 'data-action': 'ch-play', onClick: tap(onPlay) });
    secondary = route.state === 'pendingOther'
      ? button(ct('intro.continueOther'), { variant: 'text', 'data-action': 'ch-continue-other', onClick: onContinue })
      : button(ct('intro.later'), { variant: 'text', 'data-action': 'ch-later', onClick: onLater });
  }
  const scroll = h('div', { class: 'ch-scroll' }, card, ageRow, rules);
  const el = h('section', { class: 'screen screen-ch screen-ch-intro', 'data-screen': 'challenge', 'data-fresh': String(fresh), 'data-verified': String(verified) },
    topbar(onLater), scroll, h('div', { class: 'ch-foot' }, warn, primary, secondary));
  return {
    el,
    start() {
      if (motionOK()) {
        animate(card, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'cubic-bezier(.16,1,.3,1)' });
        const bust = card.querySelector('.ch-bust');
        if (bust) animate(bust, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' });
        animate(rules, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 60, fill: 'backwards' });
      } else animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
    },
  };
}

/** Link error (spec §2.4 c / c1 / c2): no fox, no red; a support code; home or a normal game. */
export function createChallengeError({ variant = 'invalid', code = 'FORMAT', onHome, onPlay }) {
  const el = h('section', { class: 'screen screen-ch screen-ch-error', 'data-screen': 'challenge-error', 'data-variant': variant },
    topbar(onHome),
    h('div', { class: 'ch-error' },
      h('div', { class: 'ch-error-icon', 'aria-hidden': 'true' }, icon('unverified', { size: 40, width: 2 })),
      // role="alert" may not sit on a heading (axe aria-allowed-role): the alert wraps the title and its body
      h('div', { class: 'ch-alert', role: 'alert' },
        h('h1', { class: 'ch-title', tabindex: '-1', 'data-autofocus': '' }, ct(`error.${variant}Title`)),
        h('p', { class: 'ch-lede' }, ct(`error.${variant}Body`))),
      h('p', { class: 'ch-code' }, ct('error.code', { code }))),
    h('div', { class: 'ch-foot' },
      button(ct('error.toHome'), { variant: 'primary', size: 'lg', 'data-action': 'ch-home', onClick: onHome }),
      button(ct('error.toPlay'), { variant: 'text', 'data-action': 'ch-play-normal', onClick: onPlay })));
  return { el };
}

export { JUNIOR_AGE };
