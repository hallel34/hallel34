// Board screen + game flow controller. The engine is the source of truth; this file only
// presents engine events (die, hops, cash) and applies the player's choices through the engine.
import boardBaseUrl from '../assets/board-premium.webp?url';
import { BOARD_GEO } from './board-geo.js';
import { h, html } from './dom.js';
import { t, tp, tRaw } from '../i18n/index.js';
import {
  BOARD, EngineError, statement, monthlyCashFlow, currentState, setCurrentState, endTurn, canEndTurn, isMultiplayer, passiveIncome,
  totalExpenses, resumePlan, lastPlayerStanding, nextActiveIndex,
} from '../engine/index.js';
import { icon } from './icons.js';
import { money, moneyText, moneyIsolated, tn, signedMoney, paydayCalc, numberText, setCoinScale } from './format.js';
import { button, iconButton, meter, cashDisplay, miniMeter, fitText } from './widgets.js';
import { createDice } from './die.js';
import { motionOK } from './prefs.js';
import {
  haptic, sound, animate, cssMs, cssPx, coinBurst, shake, pulse, pause, toast,
} from './fx.js';
import * as raw from './modals.js';
import { openStatement } from './statement.js';
import { openSettings } from './settings.js';
import { ringPos, avatarColor, pawnOffsets, progressPct, CROWD_FROM } from './layout.js';
import { playerToken, playerName, nameBdi } from './players.js';
import { closeAllLayers, destroyAllLayers, closeTopLayer } from './modal.js';
import { debugEnabled, mountDebugTools } from './debug.js';
import { readRaw, writeRaw } from '../services/storage.js';
import { warmFox } from './fox.js';
import { createFoxGuide } from './fox-guide.js';
import { tileFamily, tileIcon, tileLabel, tileLabelChip, ensureTileSprite, boardTile } from './tiles.js';
import { openLegend } from './legend.js';
import { createLearnFlow } from './learn-flow.js';
import { loanTerms, loanRateNow, loanStep, seesCoins, currentPlayer as playerNow } from '../engine/index.js';
import { setLearnHooks, clearLearnHooks } from './learn.js';
import { setLearnMode } from '../learn/context.js';
import { feedbackForChange, feedbackForEvent } from '../learn/feedback.js';
import { eyeModel } from '../learn/guess.js';
import { earnBadge } from '../learn/store.js';
import { guessEnabled } from './prefs.js';
import {
  recordGuess, guessForCard, unlockConcept, markShown, hasShown, isDeal, purchaseCashFlow,
} from '../engine/learn.js';
import { REACTIONS, LAND_REACTION, tipIndexForTurn } from './fox-rules.js';
import { summaryCard } from './summary-card.js';
import { professionBust } from './professions.js';
import { paydayChip } from './payday.js';
import { decisionModal as rawDecisionModal, decisionFox, decisionLog, foxSlots } from './decision.js';
import { taxAuditModal as rawTaxAuditModal, countCorrect } from './tax-audit.js';
import { feedbackNodes } from './learn-flow.js';
import { learnContent } from '../learn/content.js';
import { createFamilyHud, GOAL_MIN_HEIGHT } from './hud-family.js';
import {
  tut, hintDef, fillNodes, leftWords, showRing, hintStrip, hintMoreAllowed,
} from './hint-ui.js';
import { cardTitle as cardTitleOf } from './card-view.js';
import { loadTutorial, markHintSeen, unmarkHintSeen, gamesFinished } from '../learn/tutorial-store.js';
import {
  goalLineVisible, hintsActive, tipReplaced, explainerAllowed, summaryFigures, summaryHintId, createHintScheduler, assetKindOf,
  cardTourFigures, freedomView, leftToFreedom, almostEligible, summarySquareDue, SQUARE_HINT_MAX_TAKES,
} from '../learn/tutorial.js';
import { yearsPhrase, fillSlots } from '../learn/slots.js';
import coinUrl from '../assets/coin.svg?url';
import pawnUrl from '../assets/pawn.svg?url';

// v4 stage (docs/v4/design/board-spec.md section 5): the HOME skyline (start.js SKY: 10 buildings, 8 windows, no stars) as one
// inline SVG behind the board plate's lower half and the fox strip (viewBox 0 640 360 160, meet, so % maps exactly). Two windows
// are static in the SVG; six are HTML <i class="win"> that flicker (opacity only, 3 durations, 2 windows each).
const SKYLINE = `<svg class="sky-svg" aria-hidden="true" focusable="false" viewBox="0 640 360 160" preserveAspectRatio="xMidYMax slice">
<g class="sky-b"><rect x="0" y="690" width="32" height="110"/><rect x="36" y="660" width="24" height="140"/><rect x="64" y="704" width="38" height="96"/><rect x="106" y="642" width="28" height="158"/><rect x="138" y="696" width="34" height="104"/><rect x="176" y="676" width="22" height="124"/><rect x="202" y="708" width="40" height="92"/><rect x="246" y="650" width="26" height="150"/><rect x="276" y="700" width="36" height="100"/><rect x="316" y="668" width="44" height="132"/></g>
<g class="sky-w"><rect x="48" y="686" width="4" height="5"/><rect x="258" y="682" width="4" height="5"/></g>
</svg>`;
// the six flickering windows of the home skyline (x, y in its 360x800 frame), as % of the 360x160 skyline box
const FLICKER = [[42, 672, 1, 0], [112, 656, 1, 1], [252, 664, 2, 0], [120, 674, 2, 1], [326, 682, 3, 0], [340, 700, 3, 1]];
function boardSky() {
  // owner override (spec 13.5): the skyline sits inside the plate with 'slice', so a window is placed from the bottom edge in units of the plate width
  const wins = FLICKER.map(([x, y, d, k]) => h('i', { class: `win win-d${d} win-k${k}`, vars: { '--x': `${(x / 360) * 100}%`, '--y': `${((y - 640) / 160) * 100}%`, '--yb': String((800 - y - 5) / 360) } }));
  return h('div', { class: 'board-sky', 'aria-hidden': 'true' }, html(SKYLINE), ...wins);
}


/**
 * @param engine createEngine(...) result
 * @param match  starting match (new or resumed): 1-4 players, each with their own engine state
 * @param nav    { menu(), win(match), over(match) }
 * @param store  { save(match), clear(match) } (slot comes from the match)
 * `state` below is always the ACTIVE player's engine state; every dialog and action works on that player.
 */
export function createPlay({ engine, match: initialMatch, nav, store: rawStore, professionIds = [], fresh = false }) {
  let match = initialMatch;
  let state = currentState(match);
  // 'צעירים' (owner 2026-10-26): the player whose turn it is sees amounts in coins when they are 10 or under (per player)
  const applyScale = () => setCoinScale(seesCoins(match, playerNow(match)));
  applyScale();
  const multi = isMultiplayer(match);
  let busy = false;
  let destroyed = false;
  let btnMode = 'roll'; // roll | rolling | working
  // A destroyed controller (after "home", or when another screen replaced it) must never touch the save again:
  // late taps, timers and promise continuations all end up here.
  const store = {
    save: (m) => { if (!destroyed) rawStore.save(m); },
    clear: (m) => { if (!destroyed) rawStore.clear(m); },
  };
  // While the "back to home?" sheet is open, cards and dialogs wait (a card must never stack under that sheet).
  let homeGate = null;
  const gated = (fn) => async (...args) => {
    while (homeGate && !destroyed) await homeGate;
    if (destroyed) return undefined;
    return fn(...args);
  };
  const opportunityModal = gated(raw.opportunityModal);
  const expenseModal = gated(raw.expenseModal);
  const shortfallModal = gated(raw.shortfallModal);
  const charityModal = gated(raw.charityModal);
  const offerModal = gated(raw.offerModal);
  const marketInfoModal = gated(raw.marketInfoModal);
  const babyModal = gated(raw.babyModal);
  const loanDialog = gated(raw.loanDialog);
  const repayDialog = gated(raw.repayDialog);
  const sellSheet = gated(raw.sellSheet);
  const handoffSheet = gated(raw.handoffSheet);
  const summaryCardGated = gated(summaryCard);
  const playerOutModal = gated(raw.playerOutModal);
  const decisionModal = gated(rawDecisionModal);
  const taxAuditModal = gated(rawTaxAuditModal);
  const { homeConfirmSheet, giveUpConfirmSheet } = raw;
  const isDaily = !!match.daily;

  const nameOf = (i = match.currentIndex) => playerName(match.players[i], i);
  const colorOf = (i = match.currentIndex) => match.players[i].color;

  // ---------- HUD ----------
  const avatar = h('div', { class: 'avatar', 'aria-hidden': 'true' });
  const hudProf = h('span', { class: 'hud-prof' });
  const profEl = h('span', { class: 'hud-job', hidden: !multi }); // hot-seat: the player's profession (ellipsis lives here, never on the name)
  const turnEl = h('span', { class: 'hud-turn', 'aria-live': 'polite' });
  const babies = h('span', { class: 'hud-babies', role: 'img', 'aria-label': t('game.kids', { n: 0 }) });
  const charityChip = h('span', { class: 'chip chip-charity', 'data-active': 'false' });
  const cash = cashDisplay(state.cash);
  const isFamily = state.mode === 'family';
  // Family: the chip reads 'נשאר בחודש +₪X' and opens a small popover (money in, money out, what is left). Full mode keeps the plain chip.
  const flowChip = isFamily
    ? h('button', { type: 'button', class: 'flow-chip flow-chip-btn', 'aria-expanded': 'false', 'aria-haspopup': 'true', 'data-action': 'flow' })
    : h('span', { class: 'flow-chip' });
  const goalLine = h('p', { class: 'goal-line', hidden: true, 'data-goal': '' });
  const freeLine = h('p', { class: 'free-line', hidden: true, 'data-free': '' });
  // Family: 'מזומן' is named once in words ('הכסף שיש לכם עכשיו'): a caption under the number on tall screens, a tap-for-tooltip on short ones
  const cashUi = isFamily ? tut().ui : null;
  const cashWrap = h('span', { class: 'cash-wrap', 'aria-label': cashUi ? `${t('game.cash')}, ${cashUi.cashLabel}` : t('game.cash'), title: cashUi?.cashTooltip }, cash.el);
  // tall screens: the full caption under the number; short ones (<= 640): the compact word 'מזומן' ABOVE the number inside the cash row (no extra height)
  const cashCap = cashUi ? h('p', { class: 'cash-cap', 'data-cash-caption': '' }, h('span', { class: 'cap-long' }, cashUi.cashCaption)) : null;
  // v4 (3-second HUD): the word 'מזומן' sits above the number in both modes (12/500 muted)
  const cashLabel = h('span', { class: 'cash-label cap-short', 'aria-hidden': 'true' }, t('game.cash'));
  if (cashUi) cashWrap.addEventListener('click', () => { if (getComputedStyle(cashCap).display === 'none') toast(cashUi.cashTooltip, 3500); });
  fitText(cash.el, { minScale: 0.4, box: cashWrap }); // very narrow screens (320px): a long amount shrinks to fit instead of overflowing
  const passiveVal = h('b', { class: 'tone-income' });
  const expenseVal = h('b', { class: 'tone-expense' });
  const m = meter();
  const meterPct = h('span', { class: 'meter-pct', 'data-meter-pct': '' });
  // rank 2 of the 3-second test: "המטרה: ..." above the bar (the long sentence on turns 1-3), a flag at the bar's inline-end
  const goalCapText = h('span', { class: 'goal-cap-text' });
  const goalCap = h('p', { class: 'goal-cap', 'data-goal-cap': '' }, goalCapText, icon('flag', { size: 16, width: 2.2, cls: 'goal-flag' }));
  const openGameSettings = () => openSettings({ onQuit: () => goHome(), version: __APP_VERSION__, mode: state.mode, professionId: state.profession.id });
  const stmtBtn = iconButton('statement', t('game.statement'), () => openStmt(), 'icon-btn-glass');
  stmtBtn.dataset.action = 'statement';
  // board-spec 14.3 (CEO decision): home and settings merge into ONE menu button (the menu sheet = the home confirm + settings,
  // sound and vibration). It keeps the data-action="home" hook of the old home button.
  const homeBtn = iconButton('menu', t('game.menu'), () => askHome(), 'icon-btn-glass');
  homeBtn.dataset.action = 'home';
  homeBtn.setAttribute('aria-haspopup', 'dialog');

  // owner override 2026-10-24b (board-spec 14.3): one slim bar. Row 1: avatar · "מורה · תור 3" over the coin + cash · statement, menu.
  // Row 2: the goal caption, the bar with its 25/50/75 ticks, passive income at the start and expenses at the end.
  const hud = h('header', { class: 'hud glass hud-slim' },
    h('div', { class: 'hud-top' },
      h('div', { class: 'hud-avatar' }, avatar, babies), // kids: a small badge on the avatar, so the text column keeps all its width
      h('div', { class: 'hud-id' },
        h('div', { class: 'hud-idline' }, hudProf, h('span', { class: 'hud-sub' }, profEl, turnEl))),
      h('div', { class: 'hud-btns' }, stmtBtn, homeBtn),
      // QA round 14 P1: the cash has its own row under the name and the buttons (the full width beside the avatar), so the ₪ sign,
      // every digit and a minus sign always show (up to -₪99,999 / ₪9,999,999 at 320); fitText shrinks it as the last resort
      h('div', { class: 'hud-cash' },
        h('img', { class: 'hud-coin', src: coinUrl, alt: '', width: 20, height: 20 }),
        h('div', { class: 'cash-col' }, cashLabel, cashWrap))),
    cashCap,
    goalLine,
    goalCap,
    m.el,
    h('div', { class: 'meter-labels' },
      // under the bar: start = passive income (+ how far along, "0% מהדרך"), end = expenses. Family: its kid word for passive income
      h('span', { class: 'ml-start' }, h('span', { class: 'ml-label' }, t('game.passive')), ' ', passiveVal, ' · ', meterPct),
      h('span', { class: 'ml-end' }, h('span', { class: 'ml-label' }, t('game.expenses')), ' ', expenseVal)),
    freeLine);
  const famHud = isFamily ? createFamilyHud({ hud, chip: flowChip, goalLine, freeLine }) : null;
  const tutorialDevice = () => ({ mode: state.mode, helpOn: loadTutorial().helpOn, gamesFinished: gamesFinished(), daily: !!match.daily });
  // the hints belong to the first game since they were (re-)armed: 'הפעילו שוב את הרמזים' in the settings re-arms them
  const hintsDevice = () => { const d = tutorialDevice(); return { ...d, gamesFinished: d.gamesFinished - loadTutorial().hintsFrom }; };

  // ---------- Board (v4: night-city stage, tile families, one gold ring on the current tile) ----------
  ensureTileSprite();
  const tiles = BOARD.map((sq, i) => {
    const [col, row] = ringPos(i);
    const g = BOARD_GEO.tiles[i];
    const tile = boardTile(sq, { mode: state.mode, cls: `tile-${sq}`, attrs: { 'aria-hidden': 'true', 'data-i': i } });
    tile.classList.add('scene-anchor');
    tile.style.setProperty('--c', col); tile.style.setProperty('--r', row);
    tile.style.left = `${g.x * 100}%`; tile.style.top = `${g.y * 100}%`;
    tile.style.inlineSize = `${g.w * 112}%`; tile.style.blockSize = `${g.h * 130}%`;
    return tile;
  });
  // One pawn per player, each with its OWN ground shadow (no filter on the moving pawn). Shared tiles offset the pawns (pawnOffsets).
  const pawns = match.players.map((p, i) => h('div', { class: `pawn-slot pc-${p.color}`, 'data-player': String(i), 'aria-hidden': 'true' },
    h('i', { class: 'pawn-shadow' }),
    h('img', { class: 'pawn', src: pawnUrl, alt: '', width: 36, height: 40, draggable: 'false' }),
    multi ? h('i', { class: 'pawn-badge' }, String(p.color)) : null));
  const pawnAt = match.players.map((p) => p.state.position);
  const activePawn = () => pawns[match.currentIndex];
  const dice = createDice();
  dice.setValues(state.lastRoll?.dice || [1]);
  const status = h('p', { class: 'board-status', 'aria-live': 'polite', hidden: true });
  // "you are here" (idle): icon + "אתם על: הזדמנות" under the status line (merged into it as a prefix chip on the smallest screens)
  const hereIcon = h('span', { class: 'here-icon' });
  const hereText = h('span', { class: 'here-text' });
  const hereLine = h('p', { class: 'here-line', 'data-here': '' }, hereIcon, hereText);
  // the landing caption: icon + full label, shown at every landing before the card opens
  const landCap = h('div', { class: 'land-cap', 'aria-hidden': 'true', hidden: true });
  const legendBtn = h('button', { type: 'button', class: 'icon-btn legend-btn', 'aria-label': t('legend.open'), 'aria-haspopup': 'dialog', 'data-action': 'legend', onClick: () => { haptic('tap'); openLegend({ mode: state.mode }); } },
    h('span', { class: 'legend-q', 'aria-hidden': 'true' }, '?'));
  // Hot-seat: compact strip with the other players (tap to expand into a panel over the board, never over the roll button).
  const othersCells = h('span', { class: 'os-cells' }); // each cell starts with a visually hidden player name, so the button's name contains its visible text
  const othersBtn = multi ? h('button', { type: 'button', class: 'others-strip', 'aria-expanded': 'false', 'aria-controls': 'others-panel', 'data-action': 'others', onClick: () => toggleOthers() }, h('span', { class: 'vh' }, `${t('game.othersOpen')}: `), othersCells) : null;
  const othersList = h('ul', { class: 'others-list' });
  const othersClose = h('button', { type: 'button', class: 'icon-btn others-close', 'aria-label': t('game.othersClose'), onClick: () => toggleOthers(false) }, icon('close', { size: 22 }));
  const othersPanel = multi ? h('div', { class: 'others-panel glass glass-strong', id: 'others-panel', role: 'region', 'aria-label': t('game.others'), hidden: true },
    h('div', { class: 'others-head' }, h('strong', null, t('game.others')), othersClose), othersList) : null;
  // owner override 2026-10-24b (board-spec 14.4): the plaza is a flex column. Top row: the flow chip (start) and "?" (end);
  // spacer; die (the landing caption takes its place on a landing); status + "you are here"; spacer; the fox row; the CTA.
  const plazaTop = h('div', { class: 'plaza-top' }, flowChip, legendBtn);
  const center = h('div', { class: 'board-center' }, h('i', { class: 'plaza-spacer', 'aria-hidden': 'true' }),
    h('div', { class: 'plaza-die' }, landCap, dice.el), h('div', { class: 'status-wrap' }, status, hereLine), charityChip, othersBtn,
    h('i', { class: 'plaza-spacer', 'aria-hidden': 'true' }));
  const board = h('div', { class: `board${multi ? ' board-multi' : ''}`, role: 'group', style: `background-image:url(${boardBaseUrl})` }, boardSky(), ...tiles, center, othersPanel);
  let currentTile = null;

  const rollLabel = h('span', null, t('game.roll'));
  // owner 2026-10-26: no die icon inside the button (the plaza die above it is the die)
  const rollBtn = button([rollLabel], { variant: 'primary', cls: 'btn-roll', 'data-action': 'roll', onClick: () => turn() });
  const actions = h('div', { class: 'board-actions' }, rollBtn);

  // The fox strip (between the board plate and the roll button): the latest-event chip, the corner fox guide and its bubble.
  // data-pose: 'roll' = idle, 'none' = a turn is playing, 'note' = a bubble is up, 'tip' = a family tip bubble is up.
  const chip = h('div', { class: 'status-chip glass', hidden: true });
  const zone = h('div', { class: 'roll-zone fox-strip', 'data-pose': 'roll' }, chip);
  let flow = null;
  const guide = createFoxGuide({
    zone,
    onReopen: () => { haptic('tap'); if (!flow?.notes.reopen()) guide.react('think', 900); },
    // a strip too short for the fox: the fox hides and the bubble lines go to the status line
    // board-spec 14: the plaza fox is always shown (56px when compact), so the bubble is always visible and the status line keeps the
    // next action (QA round 14 P2-5: the bubble text never replaces it)
    onCompact: (on) => { el.dataset.foxCompact = String(on); },
  });
  zone.prepend(guide.el);
  // The bubble takes the strip while it is shown; the pose that was wanted meanwhile returns after it.
  let noteShown = false;
  let poseAfterNote = 'roll';
  const setPose = (p) => { if (noteShown) { poseAfterNote = p; return; } zone.dataset.pose = p; };
  setLearnMode(state.mode);
  flow = createLearnFlow({
    zone, mode: state.mode, seed: state.seed,
    getState: () => state,
    getPlayerKey: () => match.currentIndex,
    onQuietFeedback: (nodes, tone) => pushLog(nodes, tone === 'good' ? 'good' : tone === 'warn' ? 'bad' : '', { record: false }),
    setState: (next) => { state = next; commit(); },
    onDismiss: () => rollBtn.focus?.({ preventScroll: true }),
    onShown: (item) => {
      guide.setBase(item.kind === 'tip' ? 'think' : item.pose);
      zone.dataset.pose = item.kind === 'tip' ? 'tip' : 'note';
    },
    onActive: (on) => {
      if (on === noteShown) return;
      noteShown = on;
      if (on) { if (zone.dataset.pose !== 'note' && zone.dataset.pose !== 'tip') poseAfterNote = zone.dataset.pose || 'roll'; zone.dataset.pose = 'note'; guide.settle(); }
      else { zone.dataset.pose = busy ? 'none' : (poseAfterNote === 'none' || poseAfterNote === 'tip' ? 'roll' : poseAfterNote); guide.setBase(null); }
    },
  });
  setLearnHooks({ onUnlock: (id) => { if (!destroyed) { state = unlockConcept(state, id); commit(); } } });
  /** Brief fox reaction: the corner guide takes the pose for a moment (not while a bubble is up: it carries its own pose). */
  const react = (pose) => { if (!flow.notes.visible) guide.react(pose); };

  // ---------- guided hints (first family game; spec section 5) ----------
  const hintsOn = () => hintsActive(hintsDevice());
  const hints = createHintScheduler({
    seen: loadTutorial().hintsSeen,
    active: hintsOn,
    mark: (id, turn) => markHintSeen(id, turn),
    unmark: (id) => unmarkHintSeen(id),
    priorityOf: (id) => hintDef(id)?.priority ?? 9,
  });
  const tourCards = new Set(); // cards shown with the tour: they never get the guess window on a re-open
  let floating = null; // { id, shown } the floating hint of this turn

  /** The text of a floating hint with its figures (all from the live state). */
  function floatingView(id, ctx = {}) {
    let def = hintDef(id);
    const st = statement(state);
    // every 'what is left' phrase is the truthful one (left > 0: '... ועוד קצת'; exactly on the line: the on-the-line sentence, nothing more)
    if (id === 'h-almost' || id === 'h-meter') {
      const onLine = leftToFreedom(state) === 0;
      def = { ...def, text: leftWords(def.text, state), more: onLine || !def.more ? null : leftWords(def.more, state) };
    }
    const slots = { amount: money(ctx.amount ?? 0), cashLeft: money(ctx.cashLeft ?? state.cash), passive: money(st.passiveIncome), expenses: money(st.totalExpenses), left: money(leftToFreedom(state)) };
    return { id, pose: def.pose, body: fillNodes(def.text, slots), more: def.more ? fillNodes(def.more, slots) : null, plain: def.text };
  }
  /** The nearest 'סיכום שנתיים' tile ahead of the active pawn (the hint's ring goes on the board, never over it). */
  const nextPaydayTile = () => {
    const from = pawnAt[match.currentIndex];
    for (let k = 1; k <= BOARD.length; k++) { const i = (from + k) % BOARD.length; if (BOARD[i] === 'payday') return tiles[i]; }
    return null;
  };
  const ringTarget = (id) => (id === 'h-roll' ? rollBtn : id === 'h-summary-square' ? nextPaydayTile() : id.startsWith('h-expense') ? el.querySelector('.hud-cash') : el.querySelector('.hud .meter-track'));

  /** Single player: the fox points from the roll zone (after the feedback line), ring on the target. Hot-seat: see sheetExtra(). */
  function showFloatingHint() {
    if (destroyed || multi) return false;
    const next = hints.takeFloating(state.turn);
    if (!next) return false;
    const v = floatingView(next.id, next.ctx);
    let ring = null;
    floating = { id: next.id, shown: false };
    flow.notes.push({
      kind: 'hint', id: next.id, label: tut().ui.hintFoxLabel, pose: v.pose, body: v.body, more: v.more, plain: v.plain,
      onShow: () => { floating.shown = true; const tgt = ringTarget(next.id); if (tgt) ring = showRing(tgt); },
      onHide: () => { ring?.remove(); ring = null; },
    });
    return true;
  }
  /** 'חפשו על הלוח את משבצת סיכום שנתיים': offered whenever a payday square is within the next roll (turn 1 included), re-offered once if the roll skipped it. */
  let squareTakes = 0;
  function offerSquareHint() {
    const summarySeen = hints.isSeen('h-summary') || hints.isSeen('h-summary-income');
    const moot = summarySeen || state.turn > 3 || squareTakes >= SQUARE_HINT_MAX_TAKES;
    if (moot) { hints.drop('h-summary-square'); return; }
    if (summarySquareDue({ board: BOARD, position: state.position, turn: state.turn, charityTurns: state.charityTurns, summarySeen })) hints.offer('h-summary-square', state.turn);
  }
  /** A floating hint that never reached the screen (the player rolled on first) is given back for a later turn. */
  function releaseUnshownHint() {
    if (floating && !floating.shown) hints.release(floating.id, state.turn);
    floating = null;
  }

  /** The summary hint of this summary (or null): the income variant once an asset pays, else the plain one. */
  function summaryHintFor(f) {
    const pick = summaryHintId(f, hints);
    if (!pick || !hints.claim(pick.id, state.turn)) return null;
    const def = hintDef(pick.id);
    if (pick.variant === 'income') {
      const kind = assetKindOf(state);
      const slots = { passive: money(f.passive), months: numberText(f.months), passiveTotal: money(f.passive * f.months) };
      // several income assets: 'הנכסים שקניתם הכניסו ₪X' (the content may supply textAsset.many / moreAsset.many, else the locale file)
      const body = kind === 'many' ? (def.textAsset.many ?? t('hint.incomeMany')) : def.textAsset[kind];
      const more = kind === 'many' ? (def.moreAsset.many ?? t('hint.incomeManyMore')) : def.moreAsset[kind];
      return { body: fillNodes(body, slots), more: fillNodes(more, slots), target: 'passive' };
    }
    const v = def.variants[pick.variant];
    const slots = { monthly: money(f.monthly), months: numberText(f.months), amount: money(pick.variant === 'negative' ? Math.abs(f.amount) : f.amount) };
    return { body: fillNodes(v.text, slots), more: v.more ? fillNodes(v.more, slots) : null, target: 'cash' };
  }

  /** The 3-step tour of the first apartment / business card (down payment, what it brings, payback), then the closing line. */
  function cardTourFor(card) {
    const def = hintDef('h-card');
    const f = cardTourFigures(card);
    const slots = { downPayment: money(f.downPayment), monthly: money(f.monthly), loss: money(f.loss), years: Number.isFinite(f.years) ? yearsPhrase(f.years) : '' };
    const steps = def.steps.map((st) => {
      const text = st.target === 'monthly' && f.monthly < 0 ? st.negativeText : st.target === 'payback' && !Number.isFinite(f.years) ? st.neverText : st.text;
      return { target: st.target, body: fillNodes(text, slots) };
    });
    steps.push({ target: null, body: fillNodes(def.closing) });
    return { steps, next: tut().ui.hintNext, done: tut().ui.gotIt };
  }

  /** The loan window's hint: the figures follow the amount on the stepper. */
  function loanHintFor() {
    if (!hints.claim('h-loan', state.turn)) return null;
    hints.claim('h-expense-loan', state.turn); // one lesson at a time: the loan window wins the turn
    const def = hintDef('h-loan');
    return {
      render: (amount) => {
        const lt = loanTerms(amount, loanRateNow(state));
        // the live rate (a cheap-loan card halves it): "per ₪1,000" is computed, never typed (QA round 14 P3-2)
        const slots = { amount: money(amount), monthlyPayment: money(lt.monthly), perSummary: money(lt.perPayday), perThousand: money(loanTerms(1000, loanRateNow(state)).monthly), perStep: money(loanTerms(loanStep(state), loanRateNow(state)).monthly) };
        // a junior game borrows in 10,000 steps: "per ₪1,000" would be a tenth of a coin, so its line counts per step
        return { body: fillNodes(def.text, slots), more: fillNodes(state.junior && def.moreJunior ? def.moreJunior : def.more, slots) };
      },
    };
  }

  /** Hot-seat: one learning line for the pass-the-phone sheet (the zone is covered then): a hint, else an explainer, else a tip. */
  function sheetExtra() {
    offerSquareHint();
    const next = hints.takeFloating(state.turn);
    if (next?.id === 'h-summary-square') squareTakes += 1;
    if (next) { const v = floatingView(next.id, next.ctx); return { body: v.body, more: v.more, pose: v.pose, label: tut().ui.hintFoxLabel }; }
    const ex = flow.explainerForSheet({ allowed: explainerAllowed({ active: hintsOn(), turn: state.turn }) });
    if (ex) return { body: [h('b', null, ex.name), ': ', ex.short], pose: 'tip', label: t('learn.foxSays') };
    if (state.mode === 'family' && !tipReplaced({ active: hintsOn(), turn: state.turn + 1 })) {
      const idx = tipIndexForTurn(state.turn + 1);
      if (idx >= 0) return { body: t(`fox.tip${idx + 1}`), pose: 'tip', label: t('learn.foxSays') };
    }
    return null;
  }

  // What happened in the turn that is being played, for the hot-seat recap (nodes: amounts keep their <bdi>).
  let turnLog = [];
  function pushLog(text, tone = '', { record = true, payday = false, present = true } = {}) {
    if (!text) return;
    if (!present) {
      if (record) turnLog.push((Array.isArray(text) ? text : [text]).map((n) => n.cloneNode?.(true) ?? document.createTextNode(String(n))));
      return;
    }
    chip.querySelector('.payday-chip')?.closePopover?.();
    chip.hidden = false;
    if (Array.isArray(text)) chip.replaceChildren(...text); else chip.replaceChildren(text); // a string or DOM nodes (amounts wrapped in <bdi dir="ltr">)
    chip.classList.toggle('is-payday', payday);
    chip.dataset.tone = tone;
    if (record) turnLog.push([...chip.childNodes].map((n) => n.cloneNode(true)));
    if (motionOK()) animate(chip, [{ transform: 'scale(.94)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }

  // the fox row and the CTA live INSIDE the plaza now (14.4 items 7-8); the plate sits under the slim HUD
  const dock = h('div', { class: 'play-dock' }, zone, actions);
  const el = h('section', { class: 'screen screen-board board-full', 'data-screen': 'board' },
    h('h1', { class: 'vh' }, `${t('app.title')} · ${t('game.boardTitle')}`), hud, plazaTop, board, dock);
  // board-spec 14.2: the 6x8 ring fills the screen. JS sets --tile-c (width-bound, clamped 40-60) and the side-column row gap
  // --tile-gap-v (the spare height of a tall phone goes there, capped at c/2; leftover goes above the plate). Height-bound
  // (split screen / landscape): a smaller cell with the 4px gap. Below c = 40 the plate scales down as a whole, never scrolls.
  const fitBoard = (W, H, safeT, safeB, measured = 0) => {
    const nominal = H - safeT - safeB >= 700 ? 120 : 96;
    const hudH = Math.max(nominal, measured); // the live HUD height (the cash row, the first-game goal line) when it is taller
    let c = Math.max(40, Math.min(60, Math.floor((Math.min(W, 430) - 16 - 12 - 20) / 6)));
    const padTop = (x) => 6 + Math.round(0.375 * x);
    const avail = H - safeT - hudH - 8 - safeB - 6;
    let gv = (avail - padTop(c) - 6 - 8 * c) / 7;
    if (gv < 4) { c = Math.floor((avail - padTop(c) - 6 - 28) / 8); gv = 4; }
    gv = Math.max(4, Math.min(Math.floor(gv), Math.round(0.5 * c)));
    return { c, gv, hud: nominal, scale: c < 40 ? Math.max(0.5, c / 40) : 1, cell: Math.max(40, c) };
  };
  function sizeBoard() {
    if (destroyed) return;
    const cs = getComputedStyle(el);
    const safeT = Math.max(parseFloat(cs.paddingBlockStart) || 10, 6);
    const safeB = Math.max(parseFloat(cs.paddingBlockEnd) || 16, 8);
    const H = globalThis.visualViewport?.height || innerHeight;
    const f = fitBoard(innerWidth, H, safeT, safeB, hud.offsetHeight || 0);
    el.style.setProperty('--tile-c', `${f.cell}px`);
    el.style.setProperty('--tile-gap-v', `${f.gv}px`);
    el.style.setProperty('--board-scale', String(f.scale));
    el.style.setProperty('--pad-top', `${6 + Math.round(0.375 * f.cell)}px`);
    const hudMode = f.hud === 96 ? 'compact' : 'slim';
    const changed = el.dataset.hud && el.dataset.hud !== hudMode;
    el.dataset.hud = hudMode;
    if (changed) refreshHud(); // the goal caption form follows the bar
    if (f.cell < 50) el.dataset.small = ''; else delete el.dataset.small;
    const dockH = Math.max(dock.offsetHeight || 0, H < 700 ? 124 : 152);
    const room = Math.max(190, H - safeT - safeB - Math.max(hud.offsetHeight, H < 700 ? 108 : 138) - 48 - dockH - 24);
    const sceneW = Math.min(Math.min(innerWidth, 480) - 16, room * BOARD_GEO.aspect);
    el.style.setProperty('--scene-w', `${sceneW}px`);
    el.style.setProperty('--scene-ratio', String(BOARD_GEO.aspect));
  }
  sizeBoard();
  requestAnimationFrame(sizeBoard);
  const dockObserver = new ResizeObserver(() => sizeBoard());
  dockObserver.observe(dock);
  addEventListener('resize', sizeBoard);
  // The loops (window flicker, ring breathing) start once the board is interactive (idle callback, or 1.5 s), never before.
  let liveTimer = 0;
  const goLive = () => { if (!destroyed) el.classList.add('is-live'); };
  if ('requestIdleCallback' in globalThis) requestIdleCallback(goLive, { timeout: 1500 }); else liveTimer = setTimeout(goLive, 1500);
  const onHidden = () => el.classList.toggle('is-hidden', document.hidden);
  document.addEventListener('visibilitychange', onHidden);

  // ---- family tips (v4: a bubble beside the corner fox; the 150px tip pose left the board) ----
  function hideTip() { flow.notes.dismissKind('tip'); }
  function maybeTip() {
    if (destroyed || busy || state.mode !== 'family' || state.status !== 'playing' || state.phase !== 'roll') return;
    if (tipReplaced({ active: hintsOn(), turn: state.turn + 1 })) return; // the first game's turns 1-3 have the guided hints instead
    const idx = tipIndexForTurn(state.turn + 1);
    if (idx < 0 || flow.notes.active) return;
    const text = t(`fox.tip${idx + 1}`);
    flow.notes.push({ kind: 'tip', body: text, plain: text, pose: 'think' });
  }
  // Tap anywhere else closes the bubble (the roll button still works on the same tap); the fox itself re-opens the last one.
  // A tap that opens a sheet (HUD buttons, the legend, a chip with a popover) keeps the bubble: it pauses under the sheet and
  // its timer restarts when the sheet closes (spec 7.3, QA round 14 P2-2)
  el.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.note, .fox-guide, .hud, [aria-haspopup], .payday-chip, .flow-chip')) flow.notes.dismiss(); });

  /** Lays out every pawn on one tile: a lone pawn is centred, shared tiles spread them out. */
  function layoutTile(tile) {
    const slots = [...tile.querySelectorAll('.pawn-slot')].sort((x, y) => Number(x.dataset.player) - Number(y.dataset.player));
    const offs = pawnOffsets(slots.length);
    slots.forEach((sl, k) => { sl.style.setProperty('--ox', `${offs[k].x}px`); sl.style.setProperty('--oy', `${offs[k].y}px`); });
    if (slots.length) tile.dataset.pawns = String(slots.length); else delete tile.dataset.pawns;
    tile.classList.toggle('is-crowded', slots.length >= CROWD_FROM);
  }
  /** Moves player i's pawn to tile idx (instantly; hopTo animates). */
  function placePawn(i, idx) {
    const from = tiles[pawnAt[i]];
    pawnAt[i] = idx;
    tiles[idx].append(pawns[i]);
    if (from && from !== tiles[idx]) layoutTile(from);
    layoutTile(tiles[idx]);
  }
  function markActive() {
    pawns.forEach((p, i) => p.classList.toggle('is-active', i === match.currentIndex));
    currentTile?.classList.remove('is-current');
    currentTile = tiles[pawnAt[match.currentIndex]];
    currentTile.classList.add('is-current');
    const idx = pawnAt[match.currentIndex];
    board.setAttribute('aria-label', t('game.boardLabel', { n: idx + 1, total: BOARD.length, square: t(`square.${BOARD[idx]}`) }));
    paintHere(BOARD[idx]);
  }
  /** "אתם על: הזדמנות": the full label of the active pawn's square, with its glyph in the family ink. */
  function paintHere(type) {
    hereLine.dataset.family = tileFamily(type);
    hereLine.dataset.type = type;
    hereIcon.replaceChildren(tileIcon(type, { size: 16 }));
    hereText.textContent = t('board.youAreHere', { label: tileLabel(type) });
  }
  /** The landing caption: 200ms in (scale .9 -> 1 + fade; a 120ms fade under reduced motion), a 450ms hold, then the card opens. */
  async function landingCaption(type) {
    landCap.replaceChildren(tileLabelChip(type, { size: 32, cls: 'land-chip' }));
    landCap.dataset.family = tileFamily(type);
    landCap.hidden = false;
    const kf = motionOK() ? [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }];
    await animate(landCap, kf, { duration: motionOK() ? 200 : 120, easing: 'cubic-bezier(.16,1,.3,1)' }).finished?.catch(() => {});
    await new Promise((r) => { setTimeout(r, 450); });
  }
  function hideLandingCaption() {
    if (landCap.hidden) return;
    animate(landCap, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'none' }).finished?.then(() => { landCap.hidden = true; }, () => { landCap.hidden = true; });
  }
  function place(idx) {
    placePawn(match.currentIndex, idx);
    markActive();
  }
  match.players.forEach((p, i) => placePawn(i, p.state.position));
  markActive();

  let lastPct = 0;
  function paintPlayer() {
    // Active player's identity: colour ring + name in the HUD (a single player keeps the profession look).
    // owner override 2026-10-24b: the profession fox bust in a 44px circle (professions.md 3); the glyph is the fallback.
    // Hot-seat: the player's colour ring replaces the fox ring (the bust tells the profession, the name is the text).
    const profId = state.profession.id;
    if (avatar.dataset.prof !== profId) { avatar.replaceChildren(professionBust(profId, { fallbackHost: avatar })); avatar.dataset.prof = profId; }
    avatar.className = `avatar avatar-fox${multi ? ` pc-${colorOf()}` : ''}${avatar.querySelector('img') ? '' : ' is-glyph'}`;
    if (multi) {
      hudProf.textContent = nameOf();
      hud.dataset.pc = String(colorOf());
    } else {
      hudProf.textContent = state.profession.title;
    }
    el.dataset.player = String(match.currentIndex + 1);
  }
  function refreshOthers() {
    if (!multi) return;
    const order = match.players.map((p, i) => i).filter((i) => i !== match.currentIndex);
    // turn order: the players after the active one first
    order.sort((x, y) => ((x - match.currentIndex + match.players.length) % match.players.length) - ((y - match.currentIndex + match.players.length) % match.players.length));
    othersCells.replaceChildren(...order.map((i) => {
      const ps = match.players[i].state;
      return h('span', { class: `os-cell pc-${colorOf(i)}${ps.status === 'lost' ? ' is-out' : ''}`, 'data-player': String(i) },
        h('span', { class: 'vh' }, nameBdi(nameOf(i)), ps.status === 'lost' ? ` ${t('standings.out')} ` : ' '),
        ps.status === 'lost' ? h('span', { class: 'out-tag', 'aria-hidden': 'true' }, t('standings.out')) : money(ps.cash, { class: 'os-cash' }),
        h('span', { class: 'os-top' }, playerToken(colorOf(i)),
          h('span', { class: 'os-bar' }, h('i', { style: `--fill:${progressPct(passiveIncome(ps), totalExpenses(ps))}` }))));
    }));
    othersList.replaceChildren(...order.map((i) => {
      const ps = match.players[i].state;
      const pct = progressPct(passiveIncome(ps), totalExpenses(ps));
      return h('li', { class: `others-row pc-${colorOf(i)}${ps.status === 'lost' ? ' is-out' : ''}`, 'data-player': String(i) },
        // two lines: [token  name ........ cash] / [progress bar  %  per-month flow] so the name always keeps room
        h('div', { class: 'or-top' }, playerToken(colorOf(i)), h('strong', { class: 'or-name' }, nameBdi(nameOf(i))),
          ps.status === 'lost' ? h('span', { class: 'out-tag' }, t('standings.out')) : null, h('span', { class: 'or-cash' }, money(ps.cash))),
        h('div', { class: 'or-sub' },
          miniMeter(pct, t('game.otherRow', { name: nameOf(i), cash: moneyIsolated(ps.cash), pct: Math.round(pct * 100) })),
          h('span', { class: 'or-pct' }, `${Math.round(pct * 100)}%`),
          h('span', { class: 'or-flow' }, tn('game.perMonth', { amount: money(monthlyCashFlow(ps), { sign: true }) }))));
    }));
  }
  function toggleOthers(open) {
    if (!multi) return;
    const want = open ?? othersPanel.hidden;
    othersPanel.hidden = !want;
    othersBtn.setAttribute('aria-expanded', String(want));
    if (want) { refreshOthers(); othersClose.focus({ preventScroll: true }); if (motionOK()) animate(othersPanel, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' }); } else othersBtn.focus({ preventScroll: true });
  }
  function refreshHud() {
    const st = statement(state);
    paintPlayer();
    const turnText = state.turn ? t('game.turn', { turn: state.turn }) : t('game.yourTurn');
    // hot-seat: the number of the turn being played (the next one until the player has rolled)
    if (multi) {
      profEl.textContent = state.profession.title;
      turnEl.textContent = `· ${t('game.turnShort', { turn: state.turn > match.turnMark ? state.turn : state.turn + 1 })}`;
    } else turnEl.textContent = isDaily ? (state.turn ? t('daily.turnOf', { turn: state.turn, cap: state.daily.turnCap }) : t('game.yourTurn')) : turnText;
    if (famHud) famHud.refresh(state, { goal: goalLineVisible(tutorialDevice()) });
    else {
      flowChip.replaceChildren(tn('game.perMonth', { amount: money(st.monthlyCashFlow, { sign: true }) }));
      flowChip.classList.toggle('is-negative', st.monthlyCashFlow < 0);
    }
    passiveVal.replaceChildren(money(st.passiveIncome));
    expenseVal.replaceChildren(money(st.totalExpenses));
    m.set(st.passiveIncome, st.totalExpenses);
    const pct = st.totalExpenses > 0 ? Math.round((st.passiveIncome / st.totalExpenses) * 100) : 0;
    meterPct.replaceChildren(tn('hud.progress', { pct: h('b', { class: 'meter-pct-num', dir: 'ltr' }, `${pct}%`) }));
    // the goal caption: hidden while the first-game family goal line says it; the smallest screens get the one-line figures
    const tutorialGoal = famHud ? !goalLine.hidden : false;
    // the smallest screens and the compact top bar (board-spec 14.3) show the one-line figures "המטרה: ₪0 מתוך ₪X" (QA round 14 P2-9)
    const tiny = (mqMin?.matches ?? false) || el.dataset.hud === 'compact';
    goalCap.hidden = tutorialGoal;
    hud.dataset.goalCap = tutorialGoal ? 'tutorial' : tiny ? 'short' : 'long';
    if (tiny) goalCapText.replaceChildren(tn('hud.goalShort', { passive: money(st.passiveIncome), expenses: money(st.totalExpenses) }));
    else goalCapText.textContent = state.turn <= 3 ? t('hud.goalFirst') : t('hud.goal');
    // one baby icon plus the count (up to three icons would not fit next to the buttons on a 320px screen)
    babies.replaceChildren(...(state.kids ? [icon('baby', { size: 18, width: 2.2 }), h('b', null, String(state.kids))] : []));
    babies.setAttribute('aria-label', t('game.kids', { n: state.kids }));
    babies.hidden = state.kids === 0;
    // The chip keeps its slot (visibility, not display) so the board centre never changes height.
    charityChip.dataset.active = String(state.charityTurns > 0);
    charityChip.setAttribute('aria-hidden', String(state.charityTurns <= 0));
    if (state.charityTurns > 0) charityChip.replaceChildren(icon('charity', { size: 16, width: 2.6 }), ` ${t('game.charityBoost', { turns: tp('plural.turnsLeft', state.charityTurns) })}`);
    el.dataset.turn = String(state.turn);
    el.dataset.cash = String(state.cash);
    el.dataset.phase = state.phase;
    el.dataset.passive = String(st.passiveIncome);
    el.dataset.expenses = String(st.totalExpenses);
    el.dataset.position = String(state.position);
    el.dataset.players = String(match.players.length);
    el.dataset.assets = String(state.assets.length);
    el.dataset.mortgages = String(state.assets.filter((a) => a.mortgage > 0).length);
    refreshOthers();
  }
  const mqShort = typeof matchMedia === 'function' ? matchMedia(`(max-height: ${tut().goalLine.shortFromHeightPx}px)`) : null;
  const mqMin = typeof matchMedia === 'function' ? matchMedia(`(max-height: ${GOAL_MIN_HEIGHT}px)`) : null;
  refreshHud();
  mqShort?.addEventListener?.('change', refreshHud); // the goal line has a short form on short screens
  mqMin?.addEventListener?.('change', refreshHud); // ...and a minimal one-liner on the smallest
  lastPct = (() => { const st = statement(state); return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0; })();

  /** The engine state of the active player is saved into the match, then the whole match is persisted. */
  function commit() {
    match = setCurrentState(match, state);
    store.save(match);
  }

  const setStatus = (text) => { status.replaceChildren(text); status.hidden = !text; };

  // The primary button always says what is happening: roll / rolling / advancing (disabled).
  const BTN_LABEL = { roll: 'game.roll', rolling: 'game.rolling', working: 'game.advancing' };
  function paintButton(mode) {
    btnMode = mode;
    rollLabel.textContent = t(BTN_LABEL[mode]);
    rollBtn.disabled = mode === 'rolling' || mode === 'working';
    rollBtn.dataset.action = 'roll';
    el.dataset.btn = mode;
  }
  function setBusy(b, mode = 'working') {
    const was = busy;
    busy = b;
    paintButton(b ? mode : 'roll');
    el.classList.toggle('is-busy', b);
    if (b) {
      if (!was) hideTip();
      setPose('none');
    } else {
      // The strip goes idle 250ms after the button re-enables (or the tip bubble shows instead).
      setTimeout(() => { if (!destroyed && !busy) { setPose('roll'); maybeTip(); } }, motionOK() ? 250 : 0);
    }
  }
  /**
   * Called whenever a turn has fully played out (or a game is resumed): puts the game into a state the player can act on.
   * Single player: the turn is closed silently and the roll button returns. Hot-seat: the pass-the-phone sheet opens at once
   * with a recap and ONE button that rolls for the next player (no 'המשיכו', no 'מוכנים').
   */
  function settleButton() {
    if (destroyed) return;
    // One player (or the last one standing): the turn closes silently and the roll button returns, no hand-over.
    if ((!multi || lastPlayerStanding(match)) && canEndTurn(match) && state.status === 'playing') {
      match = endTurn(match); store.save(match); state = currentState(match); refreshHud();
    }
    if (multi && state.status === 'playing' && canEndTurn(match) && !lastPlayerStanding(match)) { handOver(); return; }
    setBusy(false);
    setStatus('');
  }
  /** Status line once a turn has played out: who is next in hot-seat, otherwise the roll prompt. */
  function afterTurnStatus() {
    if (multi && !lastPlayerStanding(match)) {
      const next = nextActiveIndex(match);
      if (next >= 0 && next !== match.currentIndex) return t('game.statusNext', { name: nameOf(next) });
    }
    return ''; // The roll button already gives the next action.
  }

  const cardTitle = (id) => cardTitleOf(engine.data.cards.find((c) => c.id === id), state.mode);

  // ---------- state application ----------
  const syncCash = (dur) => cash.to(state.cash, dur);

  /** Runs an engine action. On EngineError: shake + haptic, state unchanged. Returns true on success. */
  /** The fox-line slots of a decision as plain text (money() nodes would not survive the plain copy for the log / status). */
  const foxSlotsText = (before, after) => Object.fromEntries(Object.entries(foxSlots(before, after)).map(([k, v]) => [k, typeof v === 'string' ? v : v.textContent]));
  const badgeChip = (name, description = '') => h('span', { class: 'badge-chip', role: 'img', 'aria-label': description ? t('milestone.badgeA11y', { name, description }) : name }, icon('star', { size: 18, width: 2.6 }), h('span', { 'aria-hidden': 'true' }, name));
  // v4 stage 4: the 25 / 50% milestones (engine events, once per game, kept in the save): a small celebration in the corner guide
  // with one line of docs/v4/milestones.md and the badge
  let milestoneCount = 0;
  function celebrateMilestone(pct) {
    const st = statement(state);
    const slots = { pct: String(pct), passive: moneyText(st.passiveIncome), expenses: moneyText(st.totalExpenses), left: moneyText(Math.max(0, st.totalExpenses - st.passiveIncome)) };
    // the lines live in he.json milestone.lines.m<pct><mode>.1..n; a seeded rotation, never the same line twice in a row
    const base = `milestone.lines.m${pct}${state.mode === 'family' ? 'family' : 'full'}`;
    const list = [];
    for (let i = 1; i < 10 && t(`${base}.${i}`) !== `${base}.${i}`; i++) list.push(tRaw(`${base}.${i}`));
    const index = list.length ? (state.seed + milestoneCount++ + pct) % list.length : -1;
    const r = index >= 0 ? { template: list[index], text: fillSlots(list[index], slots) } : null;
    const b = t(`milestone.badge${pct}.name`);
    earnBadge(`milestone-${pct}`);
    pushLog(t('game.milestone', { pct }), 'good');
    haptic('win');
    if (r) flow.notes.push({ kind: 'milestone', group: `milestone.${pct}`, pose: 'celebrate', tone: 'good', plain: `${r.text} ${t(`milestone.badge${pct}.earned`)}`, body: feedbackNodes(r.template, slots), extra: badgeChip(b, t(`milestone.badge${pct}.description`)) });
    else react('celebrate');
  }

  function apply(fn) {
    if (destroyed) return false; // a late tap on a card that outlived the screen
    const before = state;
    try {
      state = fn(state);
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      haptic('error'); sound('error');
      shake(el.querySelector('.hud'));
      return false;
    }
    commit();
    refreshHud();
    const said = feedbackForChange(before, state);
    const rx = (pose) => { if (!said.length) react(pose); }; // the fox note carries its own reaction crop
    for (const ev of state.events) {
      if (ev.type === 'bought') {
        pushLog(t('game.logBought', { title: cardTitle(ev.cardId) }), 'good');
        haptic('purchase'); sound('coin');
        coinBurst(center, stmtBtn, 10);
        rx('celebrate');
      } else if (ev.type === 'sold' || ev.type === 'loan') {
        pushLog(ev.type === 'loan' ? tn('game.logLoan', { amount: money(ev.amount) }) : tn('game.logSold', { amount: money(ev.proceeds) }), ev.type === 'loan' ? 'bad' : 'good');
        haptic('purchase'); sound('coin');
        coinBurst(ev.type === 'loan' ? rollBtn : stmtBtn, cash.el, 6);
        if (ev.type === 'loan') rx('worried');
      } else if (ev.type === 'passed') {
        pushLog(t('game.logPassed'));
      } else if (ev.type === 'donated') {
        pushLog(tn('game.logDonated', { amount: money(ev.cost) }));
        haptic('purchase'); sound('coin');
      }
    }
    syncCash();
    if (said.length) flow.feedback(said);
    // the milestone celebration queues AFTER the note about the decision that reached it
    // two milestones in one move: only the higher one is celebrated (QA round 14 P3-4); both stay recorded in the save
    const reached = state.events.filter((ev) => ev.type === 'milestone').map((ev) => ev.pct);
    if (reached.length) celebrateMilestone(Math.max(...reached));
    // Passive-income milestones: 25 / 50% come from the engine (once per game, above); 75% keeps the short log line per crossing.
    const st = statement(state);
    const pct = st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0;
    const crossed = [0.75].find((mark) => lastPct < mark && pct >= mark && pct < 1);
    lastPct = pct;
    if (passiveIncome(before) < st.passiveIncome) hints.offer('h-meter', state.turn); // the first asset that pays
    if (almostEligible(state)) hints.offer('h-almost', state.turn);
    if (crossed) { pushLog(t('game.milestone', { pct: Math.round(crossed * 100) }), 'good'); react('celebrate'); }
    return true;
  }

  // ---------- hop ----------
  const cssNum = (name, fb) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return Number.isFinite(v) ? v : fb; };
  async function hopTo(idx) {
    const pawn = activePawn();
    const a = pawn.getBoundingClientRect();
    place(idx);
    if (!motionOK()) { await pause(10); return; }
    const b = pawn.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const hop = cssPx('--hop-height', 14);
    const dur = cssMs('--dur-fast', 180);
    // the pawn's own shadow stays on the ground: it counters the lift and shrinks / fades at the apex, back on land
    const shadow = pawn.querySelector('.pawn-shadow');
    if (shadow) {
      animate(shadow, [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: `translateY(${hop}px) scale(${cssNum('--pawn-shadow-apex-scale', 0.6)})`, opacity: cssNum('--pawn-shadow-apex-opacity', 0.45), offset: 0.5 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: dur, easing: 'ease-out', fill: 'none' });
    }
    await animate(pawn, [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx / 2}px, ${dy / 2 - hop}px)`, offset: 0.5 },
      { transform: 'translate(0, 0)' },
    ], { duration: dur, easing: 'ease-out', fill: 'none' }).finished.catch(() => {});
    // squash on land: scale(1.08, .92) for 80ms, then back (not awaited: the next hop starts at once)
    const body = pawn.querySelector('.pawn');
    if (body) animate(body, [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.08, .92)', offset: 0.5 }, { transform: 'scale(1, 1)' }], { duration: 80, easing: 'ease-out', fill: 'none' });
  }

  /**
   * 'סיכום שנתיים': the itemised card (blocking but quick: one tap), then the cash arrives (float text, count-up) and the one-line
   * form stays in the log. The figures are the engine's own payday event over the player's state.
   */
  async function paydayFx(pd) {
    const f = summaryFigures(state, pd, cash.value);
    haptic('land'); sound('payday');
    await summaryCardGated({ figures: f, hint: summaryHintFor(f) });
    if (destroyed) return;
    // spec 4.9 (owner approved 2026-10-25): the log / hand-over recap keeps the one-line form; the fox-row chip shows one of three
    // phrasings (turn % 3); a tap opens the stacked equation without overlaying dice.
    pushLog(tn('game.logPayday', { calc: paydayCalc(f.monthly, f.months, f.amount) }), f.amount >= 0 ? 'good' : 'bad', { payday: true });
    chip.replaceChildren(paydayChip(f, state.turn, { host: zone }));
    setStatus(t('game.paydayFloatLabel'));
    // The summary already shows the full calculation. Animate the cash in its own HUD, not over dice and board text.
    pulse(el.querySelector('.hud-cash'), 1.04);
    if (f.amount > 0) react('celebrate');
    await cash.to(cash.value + f.amount, 450);
  }

  // ---------- turn ----------
  let priorPrices = {};
  async function turn() {
    if (busy || destroyed || state.phase !== 'roll' || state.status !== 'playing') return;
    setBusy(true, 'rolling');
    releaseUnshownHint();
    hints.drop('h-roll'); // the roll hint belongs to the moment before the first roll
    flow.newTurn();
    chip.querySelector('.payday-chip')?.closePopover?.();
    chip.hidden = true; // Never carry a previous turn's fact into the next roll.
    hints.newTurn();
    hints.sync(loadTutorial().hintsSeen);
    turnLog = [];
    priorPrices = { ...state.stockPrices };
    haptic('roll'); sound('roll');
    let next;
    try { next = engine.roll(state); } catch (e) { console.error(e); setBusy(false); return; }
    try {
      await playTurn(next);
    } catch (e) {
      // Never leave the player on a disabled button: whatever failed, hand control back in a valid state.
      console.error(e);
      if (!destroyed) { if (state.pending) { setBusy(true); await resolvePending(); } await afterTurn(); }
    }
  }

  async function playTurn(next) {
    const move = next.events.find((e) => e.type === 'move');
    setStatus(t('game.statusMoving'));
    await dice.roll(move.dice);
    if (destroyed) return;
    paintButton('working');
    const paydays = next.events.filter((e) => e.type === 'payday');
    let pi = 0;
    for (const idx of move.path) {
      if (destroyed) return;
      await hopTo(idx);
      if (BOARD[idx] === 'payday' && paydays[pi]) { const pd = paydays[pi++]; flow.trigger('summary'); await paydayFx(pd); }
    }
    if (destroyed) return;
    paintButton('working'); // the dice have stopped; the label now says we are moving on (cards, payday) instead of rolling
    haptic('land'); sound('land');
    // "נחתתם על: הוצאה לא צפויה" (status, aria-live) + the landing caption in the plaza, then the card opens
    setStatus(t('board.landed', { label: tileLabel(BOARD[move.to]) }));
    pushLog(t('game.logMove', { steps: move.steps, square: t(`square.${BOARD[move.to]}`) }), '', { present: BOARD[move.to] !== 'payday' });
    state = next;
    commit();
    refreshHud();
    // The fox reacts to the square while the caption names it; the card (which carries its own reaction) opens after the hold.
    const landed = LAND_REACTION[BOARD[move.to]];
    if (landed) react(landed);
    await landingCaption(BOARD[move.to]);
    if (destroyed) return;
    hideLandingCaption();
    guide.settle();
    await handleEvents(next);
    await resolvePending();
    await afterTurn();
  }

  /** The turn's events are all resolved: end the match, send a player home, or let the player continue / roll again. */
  async function afterTurn() {
    if (destroyed) return;
    if (match.status !== 'playing') { setBusy(false); await finishIfOver(); return; }
    if (state.status === 'lost') { await outFlow(); return; }
    // until the first 'סיכום שנתיים' has been passed (turns 1-3) the fox points at that square on the board (after h-roll, never with it)
    offerSquareHint();
    // the fox points from the roll zone after the feedback line (single player); in hot-seat the sheet carries it
    if (!multi) showFloatingHint();
    settleButton();
    if (!multi) flow.pumpExplain({ allowed: explainerAllowed({ active: hintsOn(), turn: state.turn }) && !hints.floatedThisTurn });
  }

  /** Switches the screen to the (new) current player of the match. */
  function switchPlayer() {
    state = currentState(match);
    applyScale();
    refreshHud();
    markActive();
    cash.set(state.cash);
    dice.setValues(state.lastRoll?.dice || [1]);
    lastPct = (() => { const st = statement(state); return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0; })();
    setStatus('');
    pushLog(t('game.playerTurn', { name: nameOf() }), '', { record: false });
    hideTip();
    toggleOthers(false);
  }

  /** What happened in the turn that just ended, for the pass-the-phone sheet: the last log lines and the fox's line. */
  function buildRecap(prevIndex) {
    const lines = turnLog.slice(-2).map((nodes) => nodes.map((n) => n.cloneNode(true)));
    return { who: nameOf(prevIndex), lines, fox: flow.lastFeedbackNodes() };
  }

  let handingOver = false;
  /**
   * The ONE-TAP hand-over: the turn is resolved, so the sheet appears at once (no 'המשיכו' first). It shows the recap and one
   * primary button 'הטילו קובייה, <name>'; the tap closes the sheet and rolls for that player right away.
   * `recap` null = nothing just happened (a fresh match, a resume between turns).
   */
  async function handoverAndRoll({ recap = null, extra = null } = {}) {
    if (destroyed) return;
    busy = true;
    paintButton('working');
    el.classList.remove('is-busy');
    const tapped = await handoffSheet({ name: nameOf(), color: colorOf(), recap, extra, onHome: () => goHome() });
    if (!tapped || destroyed) return;
    busy = false;
    paintButton('roll');
    turn(); // not awaited: the whole next turn plays out on its own (and ends in the next hand-over)
  }

  /** Hot-seat, a turn is resolved: close it for the active player, switch to the next one and show the sheet. */
  async function handOver() {
    if (handingOver) return; // a second call while the sheet is being prepared does nothing
    handingOver = true;
    busy = true;
    paintButton('working');
    const prev = match.currentIndex;
    const recap = buildRecap(prev);
    const extra = sheetExtra();
    flow.newTurn(); // the old fox note goes away: it belongs to the player who just finished
    match = endTurn(match);
    store.save(match);
    switchPlayer();
    handingOver = false;
    await handoverAndRoll({ recap, extra });
  }

  /** Hot-seat: this player is out. Tell everyone, then hand over to the next player still in the game. */
  async function outFlow() {
    busy = true;
    paintButton('working');
    await playerOutModal({ name: nameOf(), color: colorOf() });
    if (destroyed) return;
    const prev = match.currentIndex;
    match = endTurn(match);
    store.save(match);
    if (match.status !== 'playing') { await finishIfOver(); return; }
    switchPlayer();
    // The same player again (everyone else is out): nobody to hand the phone to.
    if (match.currentIndex === prev) { busy = false; settleButton(); return; }
    await handoverAndRoll({});
  }

  /** Events whose cards are queued but not yet seen; saved with the match when the player goes home mid-turn. */
  let unseen = Array.isArray(match.unseen) ? match.unseen : [];
  async function showEvent(ev, noMatch) {
    if (ev.type === 'baby') {
      pushLog(t('game.logBaby'));
      await babyModal(state, { max: false, extra: ev.extra });
      flow.feedback(feedbackForEvent(ev, state));
    } else if (ev.type === 'babyMax') {
      await babyModal(state, { max: true, extra: 0 });
      flow.feedback(feedbackForEvent(ev, state));
    } else if (ev.type === 'expensePaid') {
      pushLog(tn('game.logExpense', { title: ev.card.title, amount: signedMoney(-ev.amount) }), 'bad');
      flow.trigger('expense');
      hints.offer('h-expense-paid', state.turn, { amount: ev.amount, cashLeft: state.cash }); // shown after the card, once the turn is free
      await expenseModal(state, { card: ev.card, amount: ev.amount, paid: true });
      haptic('error');
      await syncCash();
      flow.feedback(feedbackForEvent(ev, state));
    } else if (ev.type === 'market') {
      pushLog(t('game.logMarket', { title: ev.card.title }));
      const prior = ev.card.effect === 'stockPrice' ? (priorPrices[ev.card.symbol] ?? engine.data.cards.find((c) => c.type === 'stock' && c.symbol === ev.card.symbol)?.price ?? null) : null;
      if (prior != null && ev.card.newPrice < prior) flow.trigger('stockDrop');
      await marketInfoModal(state, { card: ev.card, noMatch });
      if (ev.card.effect === 'cash') { haptic(ev.card.amount >= 0 ? 'purchase' : 'error'); sound(ev.card.amount >= 0 ? 'coin' : 'error'); }
      await syncCash();
      flow.feedback(feedbackForEvent(ev, state, { priorPrice: prior }));
    }
  }
  async function runEventQueue() {
    while (unseen.length && !destroyed) {
      const q = unseen[0];
      await showEvent(q.ev, q.noMatch);
      if (destroyed) return; // not shown to the end: it stays queued for the saved match
      unseen.shift();
    }
  }
  async function handleEvents(s) {
    const noMatch = s.events.some((x) => x.type === 'noMatchingAsset');
    for (const ev of s.events) {
      if (ev.type !== 'effectEnded') continue; // a timed market card ran out (it counts down when the player rolls)
      const title = engine.data.cards.find((c) => c.id === ev.cardId)?.title;
      if (title) pushLog(t('market.effectEnded', { title }));
    }
    // a junior game asks no tax question (owner 2026-10-26): the square just says so
    if (s.events.some((x) => x.type === 'taxAuditRest')) { pushLog(t('taxAudit.juniorRest')); setStatus(t('taxAudit.juniorRest')); }
    const shown = (ev) => ev.type === 'baby' || ev.type === 'babyMax' || (ev.type === 'expensePaid' && ev.card)
      || (ev.type === 'market' && s.pending?.kind !== 'offer');
    unseen = s.events.filter(shown).map((ev) => ({ ev, noMatch }));
    await runEventQueue();
    await syncCash();
  }

  async function loanFlow(required = 0, { card = null, qty = 1 } = {}) {
    flow.trigger('loan');
    // a loan that buys the pending card: the dialog shows the state right after the purchase (the asset's cash flow counts)
    const amount = await loanDialog(state, { required, gain: card ? purchaseCashFlow(card, qty) : null, hint: loanHintFor() });
    if (amount) apply((s) => engine.takeLoan(s, amount));
    return !!amount;
  }

  async function sellFlow({ autoClose = false } = {}) {
    await sellSheet(
      () => state,
      (id, qty) => { apply((s) => engine.sellAsset(s, id, qty)); return state; },
      { shouldClose: (s) => autoClose && (s.status !== 'playing' || s.phase !== 'mustPay' || s.assets.length === 0) },
    );
  }

  /** The 'עסקה טובה?' guess for an opportunity card: on for apartments / businesses when the setting is on (never stocks). */
  function guessFor(card) {
    if (!guessEnabled(state.mode) || !isDeal(card)) return null;
    if (tourCards.has(card.id)) return null; // the first card of the first game: the tour shows the numbers, the guess starts with the second
    const seed = state.seed + state.turn;
    const intro = hints.claim('h-guess-intro', state.turn) ? { body: fillNodes(hintDef('h-guess-intro').text) } : null;
    const eye = (wasEarned) => eyeModel(state.learn?.guesses ?? [], { wasEarned });
    return {
      enabled: true, seed, prior: guessForCard(state, card.id), intro,
      eye: () => eye(true),
      onGuess: (pick, light) => {
        state = recordGuess(state, { cardId: card.id, light, guess: pick });
        const model = eye(hasShown(state, 'badge:eye'));
        if (model.justEarned) { state = markShown(state, 'badge:eye'); earnBadge('investor_eye'); haptic('win'); sound('win'); }
        commit();
        flow.trigger('reveal');
        return model;
      },
    };
  }

  async function resolvePending() {
    let first = true;
    while (!destroyed && state.status === 'playing' && state.pending) {
      const p = state.pending;
      const flip = first;
      first = false;
      let r;
      if (p.kind === 'opportunity') {
        flow.trigger('opportunity', { card: p.card });
        // first apartment / business card of the first game: a 3-step tour instead of the guess window
        let tour = null;
        if (isDeal(p.card) && !tourCards.has(p.card.id) && hints.claim('h-card', state.turn)) { tour = cardTourFor(p.card); tourCards.add(p.card.id); }
        else if (tourCards.has(p.card.id)) tour = null;
        r = await opportunityModal(state, { flip, guess: guessFor(p.card), tour });
        if (tour) flow.trigger('reveal'); // the numbers were shown without a guess: the yield / payback explainers may follow
        if (!r) break; // closed by debug force
        const bought = (qty) => { if (apply((s) => engine.buy(s, qty))) { flow.trigger('purchase', { card: p.card }); if (isDeal(p.card) && !guessEnabled(state.mode)) flow.trigger('reveal'); } };
        if (r.action === 'buy') bought(r.qty);
        else if (r.action === 'pass') apply((s) => engine.pass(s));
        else if (r.action === 'buyLoan') {
          // Short of cash but one loan covers the gap: ask for exactly that loan, then complete the purchase.
          // Cancelling the loan dialog leaves the card open (the loop below shows it again).
          if (await loanFlow(r.need, { card: p.card, qty: r.qty })) bought(r.qty);
        }
      } else if (p.kind === 'expense') {
        flow.trigger('expense');
        hints.offer('h-expense-loan', state.turn, { amount: p.amount });
        r = await expenseModal(state, { card: p.card, amount: p.amount, paid: false, flip });
        if (!r) break; // closed by debug force
        if (r.action === 'loan') await loanFlow(p.amount - state.cash);
        else if (r.action === 'sell') await sellFlow({ autoClose: true });
      } else if (p.kind === 'shortfall') {
        r = await shortfallModal(state, { flip });
        if (!r) break; // closed by debug force
        if (r.action === 'loan') await loanFlow(-state.cash);
        else if (r.action === 'sell') await sellFlow({ autoClose: true });
      } else if (p.kind === 'charity') {
        r = await charityModal(state, { flip });
        if (!r) break; // closed by debug force
        if (r.action === 'donate') apply((s) => engine.donate(s)); else apply((s) => engine.declineCharity(s));
      } else if (p.kind === 'offer') {
        r = await offerModal(state, { flip });
        if (!r) break; // closed by debug force
        if (r.action === 'accept') apply((s) => engine.acceptOffer(s)); else apply((s) => engine.declineOffer(s));
      } else if (p.kind === 'decision') {
        // v4 stage 4: a decision card; its option's fox line follows in the corner guide (one note, no second feedback)
        r = await decisionModal(state, engine);
        if (!r) break; // closed by debug force
        const before = state;
        if (apply((s) => engine.decide(s, r.option))) {
          pushLog(decisionLog(p.card, r.option, state.mode));
          const text = fillSlots(decisionFox(p.card, r.option, state.mode), foxSlotsText(before, state));
          flow.notes.push({ kind: 'feedback', group: 'decision', pose: 'think', tone: 'neutral', plain: text, body: feedbackNodes(decisionFox(p.card, r.option, state.mode), foxSlotsText(before, state)) });
        }
      } else if (p.kind === 'taxAudit') {
        // v4 stage 4: the tax-audit quiz; knowledge points only (the engine never moves money here)
        r = await taxAuditModal(state);
        if (!r) break; // closed by debug force
        if (apply((s) => engine.answerAudit(s, r))) {
          pushLog(t('taxAudit.logPoints', { points: state.taxAudit?.points ?? 0 }), r.correct ? 'good' : '');
          if (r.correct) {
            const earned = countCorrect(learnContent().quizTax, state.mode);
            if (earned) { haptic('win'); flow.notes.push({ kind: 'milestone', group: 'badge', pose: 'celebrate', tone: 'good', plain: earned, body: earned, extra: badgeChip(learnContent().quizTax.reward.badge.badgeName) }); }
          }
        }
      } else {
        break;
      }
      await pause(120);
    }
    await syncCash();
    if (!destroyed && state.status === 'playing') setStatus(afterTurnStatus());
  }

  let ending = false;
  async function finishIfOver() {
    if (destroyed || ending || match.status === 'playing') return;
    ending = true;
    if (isDaily) nav.commit?.(match); // result first, then the daily slot is cleared (one ordered step, before the pause)
    else store.clear(match);
    await pause(500);
    if (destroyed) return;
    if (match.status === 'won') nav.win(match); else nav.over(match);
  }

  // ---------- statement ----------
  function openStmt() {
    flow.trigger('statement');
    const closeIfOver = () => { if (state.status !== 'playing' || match.status !== 'playing') layer.close(); };
    const layer = openStatement({
      getState: () => state,
      title: multi ? t('statement.titleFor', { name: nameOf() }) : t('statement.title'),
      ops: {
        takeLoan: async () => { await loanFlow(0); closeIfOver(); },
        repay: async (l) => {
          const amt = await repayDialog(state, l);
          if (amt) apply((s) => engine.repayLoan(s, l.id, amt));
          closeIfOver();
        },
        sell: async () => { await sellFlow(); closeIfOver(); },
      },
    });
    layer.closed.then(() => finishIfOver());
  }

  // ?debug=1 only: force-win / force-lose helpers for QA. No effect without the flag.
  let debugTools = null;
  if (debugEnabled()) {
    const force = (outcome) => {
      if (state.status !== 'playing' || destroyed) return false;
      state = engine.debugForce(state, outcome);
      commit();
      closeAllLayers();
      refreshHud();
      if (match.status !== 'playing') finishIfOver();
      else if (!busy) outFlow(); // hot-seat: only this player is out; an active turn flow notices it itself
      return true;
    };
    debugTools = mountDebugTools({ forceWin: () => force('win'), forceLose: () => force('lose') });
  }

  // ---------- back to the start screen ----------
  let homeOpen = false;
  let releaseGate = null;
  async function askHome() {
    if (homeOpen || destroyed || match.status !== 'playing') return;
    homeOpen = true;
    homeGate = new Promise((resolve) => { releaseGate = resolve; });
    const r = await homeConfirmSheet({ daily: isDaily, menu: true });
    homeOpen = false;
    releaseGate?.(); homeGate = null; releaseGate = null; // queued cards may open now
    if (r === 'home') goHome();
    else if (r === 'settings') openGameSettings();
    else if (r === 'giveup' && await giveUpConfirmSheet()) giveUp();
  }
  /** Daily challenge: the attempt is used up. The day ends as 'not today' and the result screen follows. */
  function giveUp() {
    if (destroyed || !isDaily || state.status !== 'playing') return;
    state = engine.forfeit(state);
    commit();
    closeAllLayers();
    refreshHud();
    unseen = [];
    finishIfOver();
  }

  /** Saves the whole match and returns to the start screen (where the resume button appears). */
  function goHome() {
    if (destroyed) return;
    if (unseen.length) match.unseen = unseen; // cards queued but not yet seen come back after resume
    store.save(match);
    teardown(); // every open card / dialog / sheet is removed and this controller goes inert before the start screen mounts
    nav.menu();
  }
  function teardown() {
    destroyed = true; // (the coin scale is set by the next screen: app.js)
    clearTimeout(liveTimer);
    document.removeEventListener('visibilitychange', onHidden);
    dockObserver.disconnect();
    removeEventListener('resize', sizeBoard);
    document.documentElement.removeAttribute('data-flow-pop');
    famHud?.destroy();
    mqShort?.removeEventListener?.('change', refreshHud);
    mqMin?.removeEventListener?.('change', refreshHud);
    guide.destroy();
    flow.destroy();
    clearLearnHooks();
    debugTools?.remove();
    window.removeEventListener('popstate', onPop);
    releaseGate?.(); homeGate = null;
    destroyAllLayers();
  }
  // Android back button / browser back: opens the same confirm sheet instead of leaving the game.
  const marker = { passivo: 'board' };
  if (history.state?.passivo !== 'board') history.pushState(marker, '');
  const onPop = () => {
    if (destroyed) return;
    history.pushState(marker, '');
    if (closeTopLayer()) return; // back closes the open sheet / dialog first; only a bare board offers "return home"
    askHome();
  };
  window.addEventListener('popstate', onPop);

  return {
    el,
    /** Called once the screen is mounted. Resumes a pending decision if the save had one. */
    async start() {
      sizeBoard(); // mounted: the height check can measure now
      warmFox(REACTIONS);
      // First launch of the device: מקסי says hello from the corner guide (moved off home, which shows the logo; the flag
      // keeps its old key passivo.seenIntro on purpose). It queues like any note and waits while the story layer is open.
      // The first guided family game skips it: its story layer ("המשחק הראשון עם מקסי") is the introduction there, and the
      // guided hints of turn 1 must not wait behind an extra bubble.
      if (!readRaw('seenIntro')) {
        writeRaw('seenIntro', '1');
        if (!hintsOn()) {
          const hello = t('fox.hello');
          flow.notes.push({ kind: 'feedback', group: 'hello', pose: 'celebrate', tone: 'good', plain: hello, body: hello });
        }
      }
      flow.trigger('start');
      if (unseen.length) { // a card that was queued when the player went home: show it now, then drop it from the save
        setBusy(true);
        await runEventQueue();
        if (destroyed) return;
        delete match.unseen; unseen = [];
        store.save(match);
      }
      const plan = resumePlan(match);
      if (plan === 'finish') { setBusy(false); await finishIfOver(); return; }
      if (plan === 'out') { await outFlow(); return; } // the current player is already out: announce it and hand over (or end the match)
      if (plan === 'resolve') {
        setBusy(true);
        await resolvePending();
        await afterTurn();
        return;
      }
      if (plan === 'settle') { settleButton(); return; } // rolled and resolved: hot-seat waits for "continue", single player rolls on
      if (multi && !lastPlayerStanding(match)) {
        // Fresh match or a resume between turns: the sheet names whose turn it is and its one button rolls for them.
        setBusy(true);
        pushLog(t('game.playerTurn', { name: nameOf() }), '', { record: false });
        if (state.turn === 0) hints.offer('h-roll', 0);
        await handoverAndRoll({ extra: sheetExtra() });
        return;
      }
      if (state.turn === 0) { hints.offer('h-roll', 0); offerSquareHint(); showFloatingHint(); }
      maybeTip();
    },
    destroy: () => teardown(),
    get state() { return state; },
    get match() { return match; },
    monthlyCashFlow: () => monthlyCashFlow(state),
  };
}
