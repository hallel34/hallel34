// Start screen (docs/v3/design/spec.md 4.1, design/fox-usage.md "Logo vs character"): night sky + skyline, the MaxiFox logo
// (brand art, never the character), tagline, mode pick, daily row, primary CTA, resume. The first-launch greeting
// "היי, אני מקסי!" lives in the board's corner guide (play.js), never on home next to the logo.
import { h, html } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { CAREER_DEADLINE_WEEKDAY } from '../../engine/config.js';
import { professionBust, hasProfessionFox } from '../professions.js';
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
import emblem1x from '../../assets/brand/maxifox-emblem-1x.webp';
import emblem2x from '../../assets/brand/maxifox-emblem-2x.webp';
import { openHomeMore, moreAriaLabel } from './home-more.js';
import { hasBadge } from '../../learn/store.js';
import { FIRST_ASSET_BADGE } from '../../engine/first-asset.js';

export const resumeInfo = (m) => (isMultiplayer(m)
  ? (Math.max(...m.players.map((p) => p.state.turn)) < 1
    ? t('menu.resumeInfoFresh', { n: m.players.length })
    : t('menu.resumeInfoMulti', { n: m.players.length, turn: Math.max(...m.players.map((p) => p.state.turn)) }))
  : (currentState(m).turn < 1
    ? t('menu.resumeInfoNew', { profession: currentState(m).profession.title })
    : t('menu.resumeInfo', { turn: currentState(m).turn, profession: currentState(m).profession.title })));


/** The sentence of the warning state: "ותק: נשארו 3 ימים". */
const chipSentence = (view) => t('career.seniority.chipWarn', { days: tp('career.plural.daysLeft', view.days, { day: t(`career.weekday.${CAREER_DEADLINE_WEEKDAY}`) }) });

/**
 * The home career chip (spec section 2): a 48px button with the profile's favourite fox head; at 360px and wider a pill with a label
 * (the amber day count in the warning state), under 360 the avatar alone with a small badge. Junior: the name only, never a loss word.
 */
function chipEl({ profile, view, junior }, onClick) {
  const label = junior ? profile.name : view.state === 'warn' ? tp('career.plural.daysShort', view.days) : view.state === 'bonus' ? t('career.seniority.chipBonus') : t('career.seniority.label');
  // the day count on the compact avatar is generated content (data-n + CSS), not text: axe compares the button's visible TEXT with its name,
  // and the number is already in the name as a word ("יומיים", "היום האחרון") (QA 0.5.0 P2-4)
  const badge = junior ? null : view.state === 'warn' ? '' : view.state === 'kept' ? icon('check', { size: 12, width: 3.4 }) : null;
  const aria = junior ? `${t('profile.current', { name: profile.name })}. ${t('career.seniority.textJunior')}`
    // the visible text is always part of the name (WCAG 2.5.3): the warning leads with its short day count, the bonus state names itself
    : `${t('profile.current', { name: profile.name })}. ${view.state === 'warn' ? `${label}. ${chipSentence(view)}` : view.state === 'bonus' ? t('career.seniority.bonusText') : view.state === 'kept' ? t('career.seniority.chipKept') : t('career.seniority.chipOpen')}`;
  return h('button', {
    type: 'button', class: `career-chip glass is-${junior ? 'waiting' : view.state}`, 'data-action': 'profile', 'data-career-state': junior ? 'waiting' : view.state, 'aria-label': aria, onClick,
  },
  professionBust(profile.fox && hasProfessionFox(profile.fox) ? profile.fox : 'teacher'),
  h('span', { class: 'career-chip-label' }, label),
  badge !== null ? h('span', { class: 'career-chip-badge', 'aria-hidden': 'true', 'data-n': view.state === 'warn' ? String(view.days) : null }, badge) : null);
}

const SKY = `<svg class="sky" aria-hidden="true" focusable="false" viewBox="0 0 360 800" preserveAspectRatio="xMidYMax slice">
<g class="stars" fill="#fff"><circle cx="34" cy="64" r="1.6" opacity=".9"/><circle cx="100" cy="38" r="1.1" opacity=".7"/><circle class="tw" cx="160" cy="88" r="1.8" opacity=".8"/><circle cx="236" cy="50" r="1.3" opacity=".9"/><circle class="tw tw2" cx="310" cy="82" r="1.7" opacity=".7"/><circle cx="334" cy="34" r="1.2" opacity=".8"/><circle class="tw tw3" cx="70" cy="140" r="1.2" opacity=".6"/><circle cx="288" cy="138" r="1.4" opacity=".6"/></g>
<g class="skyline" opacity=".95"><rect x="0" y="690" width="32" height="110"/><rect x="36" y="660" width="24" height="140"/><rect x="64" y="704" width="38" height="96"/><rect x="106" y="642" width="28" height="158"/><rect x="138" y="696" width="34" height="104"/><rect x="176" y="676" width="22" height="124"/><rect x="202" y="708" width="40" height="92"/><rect x="246" y="650" width="26" height="150"/><rect x="276" y="700" width="36" height="100"/><rect x="316" y="668" width="44" height="132"/></g>
<g class="windows" opacity=".9"><rect x="42" y="672" width="4" height="5"/><rect x="48" y="686" width="4" height="5"/><rect x="112" y="656" width="4" height="5"/><rect x="120" y="674" width="4" height="5"/><rect x="252" y="664" width="4" height="5"/><rect x="258" y="682" width="4" height="5"/><rect x="326" y="682" width="4" height="5"/><rect x="340" y="700" width="4" height="5"/></g>
</svg>`;

export function createStart({ save, mode: initialMode, gamesPlayed = 0, daily = null, onPlay, onResume, onMode, onDaily, onDailyReset, onRefresh, onMission, missionProgress = null, challengeSave = null, onChallengeResume = null, onBoard = null, career = null, onProfile = null }) {
  let mode = initialMode;
  setLearnMode(mode);
  let alive = true;
  let dailyTimer = 0;

  const modeBtn = (id, name, desc, glyph) => {
    const b = h('button', {
      type: 'button', class: 'mode-card', 'data-mode': id, 'aria-pressed': String(mode === id),
      onClick: () => {
        mode = id; setLearnMode(id); haptic('tap'); onMode?.(id);
        b.parentElement.querySelectorAll('.mode-card').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      },
    }, h('span', { class: 'mode-head' }, h('span', { class: 'mode-ico', 'aria-hidden': 'true' }, icon(glyph, { size: 22, width: 2.2 })), h('span', { class: 'mode-name' }, name)),
    h('span', { class: 'mode-desc' }, desc),
    // the selected state is never colour only: a gold border, a gold icon tile AND this check badge (plus aria-pressed)
    h('span', { class: 'mode-check', 'aria-hidden': 'true' }, icon('check', { size: 14, width: 3.4 })));
    return b;
  };

  // 0.5.0: with a profile, its chip takes the games chip's slot. Redesign phase A: the games count is no longer a chip: it is a badge on the
  // 'עוד' button (only when > 0 and there is no career chip) and a row of the 'עוד' sheet, which also holds the glossary and the family board.
  const careerChip = career?.profile && onProfile ? chipEl(career, onProfile) : null;
  const moreBtn = h('button', {
    type: 'button', class: 'more-btn', 'data-action': 'more', 'aria-haspopup': 'dialog', 'aria-label': moreAriaLabel({ hasBoard: !!onBoard, gamesPlayed }),
    onClick: () => { haptic('tap'); setLearnMode(mode); openHomeMore({ gamesPlayed, onDictionary: () => openDictionary(), onBoard }); },
  }, icon('grid', { size: 20, width: 2.2 }), h('span', { class: 'more-text' }, t('menu.more')),
  gamesPlayed > 0 && !careerChip ? h('span', { class: 'more-badge', 'aria-hidden': 'true', 'data-count': String(gamesPlayed) }, String(gamesPlayed)) : null);
  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'topbar-actions' },
      iconButton('gear', t('menu.settings'), () => openSettings({ version: __APP_VERSION__, mode }), 'icon-btn-glass top-btn'),
      iconButton('help', t('menu.howTo'), () => openHowTo({ mode }), 'icon-btn-glass top-btn')),
    careerChip,
    moreBtn);
  topbar.querySelectorAll('.top-btn')[0].dataset.action = 'settings';
  topbar.querySelectorAll('.top-btn')[1].dataset.action = 'help';

  // The fox emblem is the top of the approved logo (src/assets/brand, cropped, no new art); the wordmark is live text (Rubik 900, rounded),
  // so the h1 is the visible brand name and the image is decoration.
  const logo = h('img', {
    class: 'brand-logo brand-emblem', src: emblem1x, srcset: `${emblem1x} 1x, ${emblem2x} 2x`, alt: '', width: 240, height: 208,
    decoding: 'async', fetchpriority: 'high', draggable: 'false',
  });
  const title = h('h1', { class: 'wordmark brand' }, h('bdi', { dir: 'ltr', class: 'wordmark-text' }, t('app.title')));
  const tagline = h('p', { class: 'tagline' }, t('app.tagline'));

  // the seniority sentence ("ותק: נשארו 3 ימים"): one line in the hero's slack, at heights of 700px and above (the chip carries it below)
  const warnLine = career?.view?.state === 'warn' && !career.junior && globalThis.innerHeight >= 700
    ? h('p', { class: 'career-warn-line', 'data-career-warn': '' }, icon('seniorityDue', { size: 16, width: 2 }), h('span', null, chipSentence(career.view))) : null;
  const hero = h('div', { class: 'start-hero' }, h('div', { class: 'emblem' }, logo), title, tagline, warnLine);

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
    h('span', { class: 'daily-go', 'aria-hidden': 'true' }, icon('arrow', { size: 22, width: 3, fwd: true })));
  })() : null;
  const dailyReset = daily && debugEnabled() && daily.status !== 'new'
    ? h('button', { type: 'button', class: 'debug-btn daily-reset', 'data-action': 'daily-reset', onClick: () => onDailyReset?.() }, t('daily.debugReset')) : null;

  // 0.5.1: a challenge in progress (its own save slot). Under 700px tall it takes the missions row's slot (spec §3, reversible).
  const challengeRow = challengeSave && onChallengeResume ? h('button', {
    type: 'button', class: 'btn btn-secondary ch-resume', 'data-action': 'challenge-resume', onClick: () => { haptic('tap'); onChallengeResume(); },
  },
  h('span', { class: 'ch-resume-icon', 'aria-hidden': 'true' }, icon('challenge', { size: 22, width: 2 })),
  h('span', { class: 'ch-resume-text' }, h('span', null, t('challenge.resume')), h('span', { class: 'ch-resume-info' }, t('challenge.resumeInfo', { turn: challengeSave.turn }))),
  icon('arrow', { size: 22, width: 3, fwd: true })) : null;

  // quick missions: the entry text and the REAL count of practiced missions (the same list the missions screen marks 'practiced'); no reward, no streak
  const missionPanel = onMission ? h('button', { type: 'button', class: 'mission-entry mission-panel', 'data-action': 'missions', onClick: () => { haptic('tap'); onMission(); } },
    h('span', { class: 'm-text' },
      h('span', { class: 'm-title' }, t('missions.entry')),
      missionProgress ? h('span', { class: 'm-progress' },
        h('span', { class: 'm-sub', 'data-mission-done': String(missionProgress.done) }, t('menu.missionsProgress', { done: missionProgress.done, total: missionProgress.total })),
        h('span', { class: 'm-steps', 'aria-hidden': 'true' }, Array.from({ length: missionProgress.total }, (_, i) => h('i', { class: i < missionProgress.done ? 'is-done' : '' })))) : null),
    h('span', { class: 'm-go', 'aria-hidden': 'true' }, icon('arrow', { size: 20, width: 3, fwd: true }))) : null;

  const bottom = h('div', { class: 'start-bottom' },
    h('div', { class: 'mode-grid', role: 'group', 'aria-label': t('menu.chooseMode') },
      modeBtn('family', t('menu.modeFamily'), t('menu.modeFamilyDesc'), 'opportunity'),
      modeBtn('full', t('menu.modeFull'), t('menu.modeFullDesc'), 'market')),
    dailyCard, dailyReset,
    challengeRow,
    onMission && !(challengeRow && globalThis.innerHeight < 700) ? missionPanel : null,
    hasBadge(FIRST_ASSET_BADGE) ? h('p', { class: 'mission-home-badge' }, t('mission.badge')) : null,
    button([t('menu.start'), icon('arrow', { size: 24, width: 3, fwd: true })], { variant: 'primary', size: 'lg', 'data-action': 'start', onClick: () => onPlay(mode) }),
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
