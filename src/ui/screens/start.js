// Start screen (docs/v3/design/spec.md 4.1, design/fox-usage.md "Logo vs character"): night sky + skyline, the MaxiFox logo
// (brand art, never the character), tagline, mode pick, daily row, primary CTA, resume. The first-launch greeting
// "היי, אני מקסי!" lives in the board's corner guide (play.js), never on home next to the logo.
import { h, html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { dayKey } from '../../daily/calendar.js';
import { nextChallengeText, streakText, outcomeText, cardTitleText } from '../daily-format.js';
import { debugEnabled } from '../debug.js';
import { warmFox } from '../fox.js';
import { icon } from '../icons.js';
import { button, iconButton } from '../widgets.js';
import { openSettings, openHowTo } from '../settings.js';
import { openDictionary } from '../learn.js';
import { setLearnMode } from '../../learn/context.js';
import { haptic, animate, cssMs } from '../fx.js';
import { motionOK } from '../prefs.js';
import { currentState, isMultiplayer } from '../../engine/index.js';
import logo1x from '../../assets/brand/maxifox-logo-alpha-1x.webp';
import logo2x from '../../assets/brand/maxifox-logo-alpha-2x.webp';
import coinUrl from '../../assets/coin-small.svg?url';
import { hasBadge } from '../../learn/store.js';
import { FIRST_ASSET_BADGE } from '../../engine/first-asset.js';

const resumeInfo = (m) => (isMultiplayer(m)
  ? (Math.max(...m.players.map((p) => p.state.turn)) < 1
    ? t('menu.resumeInfoFresh', { n: m.players.length })
    : t('menu.resumeInfoMulti', { n: m.players.length, turn: Math.max(...m.players.map((p) => p.state.turn)) }))
  : (currentState(m).turn < 1
    ? t('menu.resumeInfoNew', { profession: currentState(m).profession.title })
    : t('menu.resumeInfo', { turn: currentState(m).turn, profession: currentState(m).profession.title })));


const SKY = `<svg class="sky" aria-hidden="true" focusable="false" viewBox="0 0 360 800" preserveAspectRatio="xMidYMax slice">
<g class="stars" fill="#fff"><circle cx="34" cy="64" r="1.6" opacity=".9"/><circle cx="100" cy="38" r="1.1" opacity=".7"/><circle class="tw" cx="160" cy="88" r="1.8" opacity=".8"/><circle cx="236" cy="50" r="1.3" opacity=".9"/><circle class="tw tw2" cx="310" cy="82" r="1.7" opacity=".7"/><circle cx="334" cy="34" r="1.2" opacity=".8"/><circle class="tw tw3" cx="70" cy="140" r="1.2" opacity=".6"/><circle cx="288" cy="138" r="1.4" opacity=".6"/></g>
<g class="skyline" opacity=".95"><rect x="0" y="690" width="32" height="110"/><rect x="36" y="660" width="24" height="140"/><rect x="64" y="704" width="38" height="96"/><rect x="106" y="642" width="28" height="158"/><rect x="138" y="696" width="34" height="104"/><rect x="176" y="676" width="22" height="124"/><rect x="202" y="708" width="40" height="92"/><rect x="246" y="650" width="26" height="150"/><rect x="276" y="700" width="36" height="100"/><rect x="316" y="668" width="44" height="132"/></g>
<g class="windows" opacity=".9"><rect x="42" y="672" width="4" height="5"/><rect x="48" y="686" width="4" height="5"/><rect x="112" y="656" width="4" height="5"/><rect x="120" y="674" width="4" height="5"/><rect x="252" y="664" width="4" height="5"/><rect x="258" y="682" width="4" height="5"/><rect x="326" y="682" width="4" height="5"/><rect x="340" y="700" width="4" height="5"/></g>
</svg>`;

export function createStart({ save, mode: initialMode, gamesPlayed = 0, daily = null, onPlay, onResume, onMode, onDaily, onDailyReset, onRefresh, onMission }) {
  let mode = initialMode;
  setLearnMode(mode);
  let alive = true;
  let dailyTimer = 0;

  const modeBtn = (id, name, desc) => {
    const b = h('button', {
      type: 'button', class: 'mode-card', 'data-mode': id, 'aria-pressed': String(mode === id),
      onClick: () => {
        mode = id; setLearnMode(id); haptic('tap'); onMode?.(id);
        b.parentElement.querySelectorAll('.mode-card').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      },
    }, h('span', { class: 'mode-name' }, name), h('span', { class: 'mode-desc' }, desc),
    h('span', { class: 'mode-check', 'aria-hidden': 'true' }, icon('check', { size: 16, width: 3.4 })));
    return b;
  };

  const topbar = h('div', { class: 'topbar' },
    gamesPlayed > 0
      ? h('div', { class: 'games-chip glass' }, h('img', { src: coinUrl, alt: '', width: 22, height: 22 }),
        h('span', null, gamesPlayed === 1 ? t('menu.gamesPlayedOne') : t('menu.gamesPlayed', { n: gamesPlayed })))
      : h('span'),
    h('div', { class: 'topbar-actions' },
      iconButton('book', t('settings.dictionary'), () => { setLearnMode(mode); openDictionary(); }, 'icon-btn-glass'),
      iconButton('help', t('menu.howTo'), () => openHowTo({ mode }), 'icon-btn-glass'),
      iconButton('gear', t('menu.settings'), () => openSettings({ version: __APP_VERSION__, mode }), 'icon-btn-glass')));

  // h1 keeps the accessible name 'MaxiFox' (he.json app.title); the logo art itself is decorative (alt="").
  const logo = h('img', {
    class: 'brand-logo', src: logo1x, srcset: `${logo1x} 1x, ${logo2x} 2x`, alt: '', width: 200, height: 218,
    decoding: 'async', fetchpriority: 'high', draggable: 'false',
  });
  const title = h('h1', { class: 'wordmark brand' }, logo, h('span', { class: 'vh' }, t('app.title')));
  const tagline = h('p', { class: 'tagline' }, t('app.tagline'));

  const hero = h('div', { class: 'start-hero' }, title, tagline);

  // ---- daily challenge card (v2.5): gold secondary card under the mode cards ----
  // daily = { date, status: 'new' | 'playing' | 'done', entry, streak: streakView() }
  const dailyNext = daily?.status === 'done' ? h('span', { class: 'daily-line daily-next' }, nextChallengeText()) : null;
  const dailyCard = daily ? (() => {
    const streak = streakText(daily.streak);
    const status = daily.status === 'done' ? outcomeText(daily.entry.record) : daily.status === 'playing' ? t('daily.cardPlaying') : t('daily.cardNew');
    return h('button', {
      type: 'button', class: 'daily-card', 'data-action': 'daily', 'data-status': daily.status, onClick: () => { haptic('tap'); onDaily?.(); },
    },
    h('span', { class: 'daily-icon', 'aria-hidden': 'true' }, icon('star', { size: 22, width: 2.4 })),
    h('span', { class: 'daily-text' },
      h('span', { class: 'daily-title' }, cardTitleText(daily.date)),
      h('span', { class: 'daily-line daily-status' }, status),
      dailyNext,
      streak ? h('span', { class: 'daily-line daily-streak' }, streak) : null),
    h('span', { class: 'daily-go', 'aria-hidden': 'true' }, icon('arrow', { size: 22, width: 3 })));
  })() : null;
  const dailyReset = daily && debugEnabled() && daily.status !== 'new'
    ? h('button', { type: 'button', class: 'debug-btn daily-reset', 'data-action': 'daily-reset', onClick: () => onDailyReset?.() }, t('daily.debugReset')) : null;

  const bottom = h('div', { class: 'start-bottom' },
    h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('menu.chooseMode') },
      modeBtn('family', t('menu.modeFamily'), t('menu.modeFamilyDesc')),
      modeBtn('full', t('menu.modeFull'), t('menu.modeFullDesc'))),
    dailyCard, dailyReset,
    onMission ? button(t('missions.entry'), {
      variant: 'secondary', cls: 'mission-entry', 'data-action': 'first-asset', onClick: onMission,
    }) : null,
    hasBadge(FIRST_ASSET_BADGE) ? h('p', { class: 'mission-home-badge' }, t('mission.badge')) : null,
    button([t('menu.start'), icon('arrow', { size: 24, width: 3 })], { variant: 'primary', size: 'lg', 'data-action': 'start', onClick: () => onPlay(mode) }),
    save ? button(`${t('menu.resume')} · ${resumeInfo(save)}`, { variant: 'secondary', 'data-action': 'resume', onClick: () => onResume() }) : null);

  const el = h('section', { class: 'screen screen-start', 'data-screen': 'start' }, html(SKY), topbar, hero, bottom);

  return {
    el,
    /** Called once mounted: the logo's entrance (fade + scale .96 to 1, 400ms; fade only under reduced motion). */
    start() {
      animate(logo, motionOK() ? [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }],
        { duration: motionOK() ? cssMs('--dur-slow', 400) : cssMs('--dur-base', 120), easing: 'cubic-bezier(.16,1,.3,1)' });
      warmFox(['roll']);
      if (daily) {
        // the countdown ticks while the screen is open; a new calendar day (midnight passed) rebuilds the card
        dailyTimer = setInterval(() => {
          if (!alive || !el.isConnected) { clearInterval(dailyTimer); return; }
          if (dayKey() !== daily.date) { onRefresh?.(); return; }
          if (dailyNext) dailyNext.textContent = nextChallengeText();
        }, 30000);
      }
    },
    destroy() { alive = false; clearInterval(dailyTimer); },
  };
}
