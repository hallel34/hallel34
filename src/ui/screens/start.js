// Start screen: skyline, mascot, title, mode pick, primary CTA, resume.
import { h, html } from '../dom.js';
import { t } from '../../i18n/index.js';
import { mascot } from '../mascot.js';
import { icon } from '../icons.js';
import { button, iconButton } from '../widgets.js';
import { openSettings, openHowTo } from '../settings.js';
import { haptic } from '../fx.js';

const SKY = `<svg class="sky" aria-hidden="true" focusable="false" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice">
<g fill="#FFFFFF"><circle cx="40" cy="70" r="1.6" opacity=".9"/><circle cx="110" cy="40" r="1.1" opacity=".7"/><circle cx="170" cy="96" r="1.8" opacity=".8"/><circle cx="250" cy="52" r="1.3" opacity=".9"/><circle cx="330" cy="88" r="1.7" opacity=".7"/><circle cx="358" cy="36" r="1.2" opacity=".8"/><circle cx="76" cy="150" r="1.2" opacity=".6"/><circle cx="300" cy="150" r="1.4" opacity=".6"/><circle cx="20" cy="210" r="1" opacity=".5"/><circle cx="372" cy="200" r="1.3" opacity=".5"/></g>
<circle cx="195" cy="330" r="190" fill="#FFB35C" opacity=".13"/><circle cx="195" cy="330" r="120" fill="#FFC83D" opacity=".13"/>
<g class="skyline" opacity=".92"><rect x="0" y="700" width="34" height="144"/><rect x="38" y="670" width="26" height="174"/><rect x="68" y="716" width="40" height="128"/><rect x="112" y="652" width="30" height="192"/><rect x="146" y="704" width="36" height="140"/><rect x="186" y="684" width="24" height="160"/><rect x="214" y="720" width="42" height="124"/><rect x="260" y="660" width="28" height="184"/><rect x="292" y="708" width="38" height="136"/><rect x="334" y="676" width="56" height="168"/></g>
<g fill="#FFC83D" opacity=".85"><rect x="44" y="682" width="4" height="5"/><rect x="52" y="694" width="4" height="5"/><rect x="118" y="666" width="4" height="5"/><rect x="128" y="684" width="4" height="5"/><rect x="266" y="674" width="4" height="5"/><rect x="274" y="692" width="4" height="5"/><rect x="342" y="690" width="4" height="5"/><rect x="360" y="706" width="4" height="5"/><rect x="12" y="716" width="4" height="5"/><rect x="194" y="700" width="4" height="5"/></g>
</svg>`;

export function createStart({ save, mode: initialMode, onPlay, onResume, onMode }) {
  let mode = initialMode;
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
    iconButton('help', t('menu.howTo'), () => openHowTo(), 'icon-btn-glass'),
    iconButton('gear', t('menu.settings'), () => openSettings({ version: __APP_VERSION__ }), 'icon-btn-glass'));

  const hero = h('div', { class: 'start-hero' },
    mascot({ width: 132, cls: 'bob' }),
    h('h1', { class: 'title' }, ...t('app.title').split(' ').flatMap((w, i) => (i ? [h('br'), w] : [w]))),
    h('p', { class: 'tagline' }, t('app.tagline')));

  const bottom = h('div', { class: 'start-bottom' },
    h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('menu.chooseMode') },
      modeBtn('family', t('menu.modeFamily'), t('menu.modeFamilyDesc')),
      modeBtn('full', t('menu.modeFull'), t('menu.modeFullDesc'))),
    button([t('menu.start'), icon('arrow', { size: 24, width: 3 })], { variant: 'primary', size: 'lg', 'data-action': 'start', onClick: () => onPlay(mode) }),
    save ? button(`${t('menu.resume')} · ${t('menu.resumeInfo', { turn: save.turn, profession: save.profession.title })}`, { variant: 'secondary', 'data-action': 'resume', onClick: () => onResume() }) : null);

  const coins = h('div', { class: 'drift', 'aria-hidden': 'true' }, Array.from({ length: 6 }, (_, i) => h('i', { vars: { '--i': i } })));

  return h('section', { class: 'screen screen-start', 'data-screen': 'start' }, html(SKY), coins, topbar, hero, bottom);
}
