// Start screen (design/screens.md #1, fox placement: design/fox-usage.md): night sky + skyline, wordmark,
// tired fox with a joke bubble (waves hello on first launch only), mode pick, primary CTA, resume.
import { h, html, sleep } from '../dom.js';
import { t } from '../../i18n/index.js';
import { foxImg, loadFox, riseIn, squash, warmFox, dirSign } from '../fox.js';
import { icon } from '../icons.js';
import { button, iconButton } from '../widgets.js';
import { openSettings, openHowTo } from '../settings.js';
import { haptic, animate, cssMs } from '../fx.js';
import { motionOK } from '../prefs.js';
import { readRaw, writeRaw } from '../../services/storage.js';
import { currentState, isMultiplayer } from '../../engine/index.js';
import wordmarkUrl from '../../assets/wordmark.svg?url';
import coinUrl from '../../assets/coin-small.svg?url';

const resumeInfo = (m) => (isMultiplayer(m)
  ? (Math.max(...m.players.map((p) => p.state.turn)) < 1
    ? t('menu.resumeInfoFresh', { n: m.players.length })
    : t('menu.resumeInfoMulti', { n: m.players.length, turn: Math.max(...m.players.map((p) => p.state.turn)) }))
  : t('menu.resumeInfo', { turn: currentState(m).turn, profession: currentState(m).profession.title }));

export const WAVE_MS = 1800;
const JOKES = ['fox.joke1', 'fox.joke2', 'fox.joke3'];

const SKY = `<svg class="sky" aria-hidden="true" focusable="false" viewBox="0 0 360 800" preserveAspectRatio="xMidYMax slice">
<g class="stars" fill="#fff"><circle cx="34" cy="64" r="1.6" opacity=".9"/><circle cx="100" cy="38" r="1.1" opacity=".7"/><circle class="tw" cx="160" cy="88" r="1.8" opacity=".8"/><circle cx="236" cy="50" r="1.3" opacity=".9"/><circle class="tw tw2" cx="310" cy="82" r="1.7" opacity=".7"/><circle cx="334" cy="34" r="1.2" opacity=".8"/><circle class="tw tw3" cx="70" cy="140" r="1.2" opacity=".6"/><circle cx="288" cy="138" r="1.4" opacity=".6"/></g>
<g class="skyline" opacity=".95"><rect x="0" y="690" width="32" height="110"/><rect x="36" y="660" width="24" height="140"/><rect x="64" y="704" width="38" height="96"/><rect x="106" y="642" width="28" height="158"/><rect x="138" y="696" width="34" height="104"/><rect x="176" y="676" width="22" height="124"/><rect x="202" y="708" width="40" height="92"/><rect x="246" y="650" width="26" height="150"/><rect x="276" y="700" width="36" height="100"/><rect x="316" y="668" width="44" height="132"/></g>
<g class="windows" opacity=".9"><rect x="42" y="672" width="4" height="5"/><rect x="48" y="686" width="4" height="5"/><rect x="112" y="656" width="4" height="5"/><rect x="120" y="674" width="4" height="5"/><rect x="252" y="664" width="4" height="5"/><rect x="258" y="682" width="4" height="5"/><rect x="326" y="682" width="4" height="5"/><rect x="340" y="700" width="4" height="5"/></g>
</svg>`;

export function createStart({ save, mode: initialMode, gamesPlayed = 0, onPlay, onResume, onMode }) {
  let mode = initialMode;
  const firstLaunch = !readRaw('seenIntro');
  let alive = true;
  let jokeTimer = 0;

  const modeBtn = (id, name, desc) => {
    const b = h('button', {
      type: 'button', class: 'mode-card', 'data-mode': id, 'aria-pressed': String(mode === id),
      onClick: () => {
        mode = id; haptic('tap'); onMode?.(id);
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
      iconButton('help', t('menu.howTo'), () => openHowTo(), 'icon-btn-glass'),
      iconButton('gear', t('menu.settings'), () => openSettings({ version: __APP_VERSION__ }), 'icon-btn-glass')));

  // h1 keeps the accessible name 'פסיבו'; the wordmark art itself is decorative.
  const title = h('h1', { class: 'wordmark' },
    h('img', { src: wordmarkUrl, alt: '', width: 232, height: 129, decoding: 'async', fetchpriority: 'high' }),
    h('span', { class: 'vh' }, t('app.title')));
  const tagline = h('p', { class: 'tagline' }, t('app.tagline'));

  // ---- fox stage ----
  // First launch: wave is the LCP image, so `tired` only starts loading once the wave has painted.
  const tired = foxImg('tired', { height: 296, altKey: 'fox.alt.tired', cls: 'bob', priority: !firstLaunch, defer: firstLaunch });
  const wave = firstLaunch ? foxImg('wave', { height: 296, altKey: 'fox.alt.wave', priority: true }) : null;
  if (wave) { tired.style.opacity = '0'; tired.setAttribute('alt', ''); tired.setAttribute('aria-hidden', 'true'); }
  const slot = h('div', { class: 'fox-slot' }, tired, wave);
  const bubble = h('div', { class: 'bubble', role: 'note' }, firstLaunch ? t('fox.hello') : t(JOKES[0]));
  const stage = h('div', { class: 'fox-stage' }, h('div', { class: 'fox-halo', 'aria-hidden': 'true' }), slot, bubble);

  const hero = h('div', { class: 'start-hero' }, title, tagline, stage);

  const bottom = h('div', { class: 'start-bottom' },
    h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('menu.chooseMode') },
      modeBtn('family', t('menu.modeFamily'), t('menu.modeFamilyDesc')),
      modeBtn('full', t('menu.modeFull'), t('menu.modeFullDesc'))),
    button([t('menu.start'), icon('arrow', { size: 24, width: 3 })], { variant: 'primary', size: 'lg', 'data-action': 'start', onClick: () => onPlay(mode) }),
    save ? button(`${t('menu.resume')} · ${resumeInfo(save)}`, { variant: 'secondary', 'data-action': 'resume', onClick: () => onResume() }) : null);

  const el = h('section', { class: 'screen screen-start', 'data-screen': 'start' }, html(SKY), topbar, hero, bottom);

  slot.addEventListener('click', () => squash(slot));

  async function swapBubble(text) {
    if (!alive) return;
    const d = 180;
    await animate(bubble, [{ opacity: 1 }, { opacity: 0 }], { duration: d }).finished.catch(() => {});
    bubble.textContent = text;
    await animate(bubble, [{ opacity: 0 }, { opacity: 1 }], { duration: d }).finished.catch(() => {});
  }

  function startJokes() {
    let i = 0;
    jokeTimer = setInterval(() => {
      if (!alive || !el.isConnected) { clearInterval(jokeTimer); return; }
      i = (i + 1) % JOKES.length;
      swapBubble(t(JOKES[i]));
    }, 6000);
  }

  async function intro() {
    writeRaw('seenIntro', '1');
    setTimeout(() => { if (alive) loadFox(tired, 'tired'); }, 700);
    const enter = motionOK() ? 500 : cssMs('--dur-base', 120);
    animate(wave, motionOK()
      ? [{ opacity: 0, transform: `translateX(${dirSign() * 40}px)` }, { opacity: 1, transform: 'translateX(0)' }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: enter, easing: 'cubic-bezier(.16,1,.3,1)' });
    await sleep(enter + WAVE_MS);
    if (!alive) return;
    // crossfade 200ms to the tired pose and the normal bubble line
    tired.setAttribute('alt', t('fox.alt.tired')); tired.removeAttribute('aria-hidden');
    wave.setAttribute('aria-hidden', 'true');
    animate(wave, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    animate(tired, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).finished.catch(() => {}).then(() => { tired.style.opacity = ''; });
    swapBubble(t(JOKES[0]));
    startJokes();
  }

  return {
    el,
    /** Called once mounted: entrance rise, then (first launch) wave -> tired, joke rotation. */
    start() {
      riseIn(slot);
      warmFox(['roll']);
      if (firstLaunch) intro(); else startJokes();
    },
    destroy() { alive = false; clearInterval(jokeTimer); },
  };
}
