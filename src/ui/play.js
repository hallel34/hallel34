// Board screen + game flow controller. The engine is the source of truth; this file only
// presents engine events (die, hops, cash) and applies the player's choices through the engine.
import { h, html } from './dom.js';
import { t, tp } from '../i18n/index.js';
import {
  BOARD, EngineError, statement, monthlyCashFlow, currentState, setCurrentState, endTurn, canEndTurn, isMultiplayer, passiveIncome,
  totalExpenses, resumePlan, lastPlayerStanding, nextActiveIndex,
} from '../engine/index.js';
import { icon } from './icons.js';
import { money, moneyText, tn, signedMoney, paydayCalc } from './format.js';
import { button, iconButton, meter, cashDisplay, miniMeter, fitText } from './widgets.js';
import { createDice } from './die.js';
import { motionOK } from './prefs.js';
import {
  haptic, sound, animate, cssMs, cssPx, floatText, coinBurst, shake, pulse, pause,
} from './fx.js';
import * as raw from './modals.js';
import { openStatement } from './statement.js';
import { openSettings } from './settings.js';
import { ringPos, avatarColor, pawnOffsets, progressPct, CROWD_FROM } from './layout.js';
import { playerToken, playerName, nameBdi } from './players.js';
import { closeAllLayers, destroyAllLayers, closeTopLayer } from './modal.js';
import { debugEnabled, mountDebugTools } from './debug.js';
import { foxImg, createReactor, warmFox, dirSign } from './fox.js';
import { createLearnFlow } from './learn-flow.js';
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
import coinUrl from '../assets/coin.svg?url';
import pawnUrl from '../assets/pawn.svg?url';
import dieUrl from '../assets/die-3.svg?url';

const SQUARES = import.meta.glob('../assets/square-*.svg', { eager: true, query: '?url', import: 'default' });
const squareUrl = (sq) => SQUARES[`../assets/square-${sq}.svg`];

// Variation A "night city": static skyline with lit windows behind the bottom row (design/mockups/Board.dc.html).
const SKYLINE = `<svg class="board-skyline" aria-hidden="true" focusable="false" viewBox="0 0 336 110" preserveAspectRatio="xMidYMax slice">
<g class="sk-b" opacity=".9"><rect x="4" y="60" width="28" height="50"/><rect x="36" y="42" width="22" height="68"/><rect x="62" y="70" width="34" height="40"/><rect x="100" y="36" width="24" height="74"/><rect x="128" y="64" width="30" height="46"/><rect x="162" y="50" width="20" height="60"/><rect x="186" y="72" width="36" height="38"/><rect x="226" y="40" width="24" height="70"/><rect x="254" y="66" width="32" height="44"/><rect x="290" y="48" width="42" height="62"/></g>
<g class="sk-w" opacity=".85"><rect x="42" y="52" width="3" height="4"/><rect x="46" y="64" width="3" height="4"/><rect x="106" y="48" width="3" height="4"/><rect x="112" y="62" width="3" height="4"/><rect x="232" y="52" width="3" height="4"/><rect x="298" y="60" width="3" height="4"/><rect x="316" y="74" width="3" height="4"/></g>
</svg>`;


/**
 * @param engine createEngine(...) result
 * @param match  starting match (new or resumed): 1-4 players, each with their own engine state
 * @param nav    { menu(), win(match), over(match) }
 * @param store  { save(match), clear() }
 * `state` below is always the ACTIVE player's engine state; every dialog and action works on that player.
 */
export function createPlay({ engine, match: initialMatch, nav, store: rawStore, professionIds = [], fresh = false }) {
  let match = initialMatch;
  let state = currentState(match);
  const multi = isMultiplayer(match);
  let busy = false;
  let destroyed = false;
  let btnMode = 'roll'; // roll | rolling | working | continue
  // A destroyed controller (after "home", or when another screen replaced it) must never touch the save again:
  // late taps, timers and promise continuations all end up here.
  const store = {
    save: (m) => { if (!destroyed) rawStore.save(m); },
    clear: () => { if (!destroyed) rawStore.clear(); },
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
  const playerOutModal = gated(raw.playerOutModal);
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
  const flowChip = h('span', { class: 'flow-chip' });
  const cashWrap = h('span', { class: 'cash-wrap', 'aria-label': t('game.cash') }, cash.el);
  fitText(cash.el, { minScale: 0.5, box: cashWrap }); // very narrow screens (320px): a long amount shrinks to fit instead of overflowing
  const passiveVal = h('b', { class: 'tone-income' });
  const expenseVal = h('b', { class: 'tone-expense' });
  const m = meter();
  const settingsBtn = iconButton('gear', t('game.settings'), () => openSettings({ onQuit: () => goHome(), version: __APP_VERSION__, mode: state.mode }), 'icon-btn-glass');
  const stmtBtn = iconButton('statement', t('game.statement'), () => openStmt(), 'icon-btn-glass');
  stmtBtn.dataset.action = 'statement';
  const homeBtn = iconButton('home', t('game.home'), () => askHome(), 'icon-btn-glass');
  homeBtn.dataset.action = 'home';

  const hud = h('header', { class: 'hud glass' },
    h('div', { class: 'hud-top' },
      h('div', { class: 'hud-avatar' }, avatar, babies), // kids: a small badge on the avatar, so the text column keeps all its width
      h('div', { class: 'hud-id' }, hudProf, h('span', { class: 'hud-sub' }, profEl, turnEl)),
      h('div', { class: 'hud-btns' }, stmtBtn, homeBtn, settingsBtn)),
    h('div', { class: 'hud-cash' },
      h('img', { class: 'hud-coin', src: coinUrl, alt: '', width: 30, height: 30 }),
      cashWrap,
      flowChip),
    h('div', { class: 'meter-labels' },
      h('span', null, t('game.passive'), ' ', passiveVal),
      h('span', null, t('game.expenses'), ' ', expenseVal)),
    m.el);

  // ---------- Board (variation A: night city) ----------
  const tiles = BOARD.map((sq, i) => {
    const [col, row] = ringPos(i);
    return h('div', { class: `tile tile-${sq}`, 'aria-hidden': 'true', 'data-i': i, vars: { '--c': col, '--r': row } },
      h('img', { src: squareUrl(sq), alt: '', width: 42, height: 42, draggable: 'false' }));
  });
  // One pawn per player. Pawns sharing a tile are offset (see pawnOffsets) so each stays visible.
  const pawns = match.players.map((p, i) => h('div', { class: `pawn-slot pc-${p.color}`, 'data-player': String(i), 'aria-hidden': 'true' },
    h('img', { class: 'pawn', src: pawnUrl, alt: '', width: 36, height: 40, draggable: 'false' }),
    multi ? h('i', { class: 'pawn-badge' }, String(p.color)) : null));
  const pawnAt = match.players.map((p) => p.state.position);
  const activePawn = () => pawns[match.currentIndex];
  const dice = createDice();
  dice.setValues(state.lastRoll?.dice || [1]);
  const status = h('p', { class: 'board-status', 'aria-live': 'polite' }, t('game.statusStart'));
  // Hot-seat: compact strip with the other players (tap to expand into a panel over the board, never over the roll button).
  const othersCells = h('span', { class: 'os-cells' }); // each cell starts with a visually hidden player name, so the button's name contains its visible text
  const othersBtn = multi ? h('button', { type: 'button', class: 'others-strip', 'aria-expanded': 'false', 'aria-controls': 'others-panel', 'data-action': 'others', onClick: () => toggleOthers() }, h('span', { class: 'vh' }, `${t('game.othersOpen')}: `), othersCells) : null;
  const othersList = h('ul', { class: 'others-list' });
  const othersClose = h('button', { type: 'button', class: 'icon-btn others-close', 'aria-label': t('game.othersClose'), onClick: () => toggleOthers(false) }, icon('close', { size: 22 }));
  const othersPanel = multi ? h('div', { class: 'others-panel glass glass-strong', id: 'others-panel', role: 'region', 'aria-label': t('game.others'), hidden: true },
    h('div', { class: 'others-head' }, h('strong', null, t('game.others')), othersClose), othersList) : null;
  const center = h('div', { class: 'board-center' }, dice.el, status, charityChip, othersBtn);
  const board = h('div', { class: `board${multi ? ' board-multi' : ''}`, role: 'group' }, html(SKYLINE), ...tiles, center, othersPanel);
  let currentTile = null;

  const rollLabel = h('span', null, t('game.roll'));
  const dieIcon = h('img', { src: dieUrl, alt: '', width: 30, height: 30, class: 'btn-die' });
  const rollBtn = button([dieIcon, rollLabel], { variant: 'primary', cls: 'btn-roll', 'data-action': 'roll', onClick: () => (btnMode === 'continue' ? continueTurn() : turn()) });
  const actions = h('div', { class: 'board-actions' }, rollBtn);

  // Roll zone (above the roll button): fox roll pose + latest-event chip; family tips replace them.
  const rollFoxImg = foxImg('roll', { height: 128, cls: 'bob' });
  const rollFox = h('div', { class: 'fox-roll' }, rollFoxImg);
  const chip = h('div', { class: 'status-chip glass' }, t('game.noEvents'));
  const tipBubble = h('div', { class: 'tip-bubble', role: 'note' });
  const tipFox = h('div', { class: 'fox-tip' }, foxImg('tip', { height: 150, lazy: true }), tipBubble);
  const reactHost = h('div', { class: 'react-host', 'aria-hidden': 'true' });
  const zone = h('div', { class: 'roll-zone', 'data-pose': 'roll' }, reactHost, rollFox, chip, tipFox);
  const reactor = createReactor(reactHost, { size: 56 });
  // The fox note (feedback / explainer) takes the zone while it is shown; the pose that was wanted meanwhile returns after it.
  let noteShown = false;
  let poseAfterNote = 'roll';
  const setPose = (p) => { if (noteShown) { poseAfterNote = p; return; } zone.dataset.pose = p; };
  setLearnMode(state.mode);
  const flow = createLearnFlow({
    zone, mode: state.mode, seed: state.seed,
    getState: () => state,
    setState: (next) => { state = next; commit(); },
    onDismiss: () => rollBtn.focus?.({ preventScroll: true }),
    onActive: (on) => {
      if (on === noteShown) return;
      noteShown = on;
      if (on) { if (zone.dataset.pose !== 'note') poseAfterNote = zone.dataset.pose || 'roll'; zone.dataset.pose = 'note'; reactor.hide(); }
      else zone.dataset.pose = busy ? 'none' : (poseAfterNote === 'none' ? 'roll' : poseAfterNote);
    },
  });
  setLearnHooks({ onUnlock: (id) => { if (!destroyed) { state = unlockConcept(state, id); commit(); } } });
  /** Brief fox reaction in the strip under the board (never over the HUD, tiles, die or numbers; not while a fox note is up). */
  const react = (pose) => { if (!flow.notes.active) reactor.show(pose); };

  function pushLog(text, tone = '') {
    if (!text) return;
    chip.replaceChildren(text); // a string or DOM nodes (amounts wrapped in <bdi dir="ltr">)
    chip.dataset.tone = tone;
    if (motionOK()) animate(chip, [{ transform: 'scale(.94)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }

  const el = h('section', { class: 'screen screen-board', 'data-screen': 'board' },
    h('h1', { class: 'vh' }, `${t('app.title')} · ${t('game.boardTitle')}`), hud, board, zone, actions);

  // ---- family tips ----
  let tipTimer = 0;
  function hideTip() {
    clearTimeout(tipTimer);
    if (zone.dataset.pose !== 'tip') return;
    setPose(busy ? 'none' : 'roll');
  }
  function maybeTip() {
    if (destroyed || busy || state.mode !== 'family' || state.status !== 'playing' || state.phase !== 'roll') return;
    const idx = tipIndexForTurn(state.turn + 1);
    if (idx < 0) return;
    tipBubble.textContent = t(`fox.tip${idx + 1}`);
    setPose('tip');
    if (motionOK()) animate(tipFox, [{ opacity: 0, transform: `translateX(${dirSign() * -24}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 6000);
  }
  // Tap anywhere dismisses the tip (the roll button still works on the same tap).
  el.addEventListener('pointerdown', (e) => { hideTip(); if (!e.target.closest?.('.note')) flow.notes.dismiss(); });

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
    if (multi) {
      avatar.textContent = String(colorOf());
      avatar.className = `avatar pc-${colorOf()}`;
      hudProf.textContent = nameOf();
      hud.dataset.pc = String(colorOf());
    } else {
      avatar.textContent = state.profession.title.trim()[0];
      avatar.style.background = avatarColor(state.profession.id, professionIds);
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
        ps.status === 'lost' ? h('span', { class: 'out-tag', 'aria-hidden': 'true' }, t('standings.out')) : h('bdi', { class: 'money os-cash', dir: 'ltr' }, moneyText(ps.cash)),
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
          miniMeter(pct, t('game.otherRow', { name: nameOf(i), cash: moneyText(ps.cash), pct: Math.round(pct * 100) })),
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
    flowChip.replaceChildren(tn('game.perMonth', { amount: money(st.monthlyCashFlow, { sign: true }) }));
    flowChip.classList.toggle('is-negative', st.monthlyCashFlow < 0);
    passiveVal.replaceChildren(money(st.passiveIncome));
    expenseVal.replaceChildren(money(st.totalExpenses));
    m.set(st.passiveIncome, st.totalExpenses);
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
  refreshHud();
  lastPct = (() => { const st = statement(state); return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0; })();

  /** The engine state of the active player is saved into the match, then the whole match is persisted. */
  function commit() {
    match = setCurrentState(match, state);
    store.save(match);
  }

  const setStatus = (text) => { status.replaceChildren(text); };

  // The primary button always says what is happening: roll / rolling / advancing (disabled), or continue (enabled).
  const BTN_LABEL = { roll: 'game.roll', rolling: 'game.rolling', working: 'game.advancing', continue: 'game.continue' };
  function paintButton(mode) {
    btnMode = mode;
    rollLabel.textContent = t(BTN_LABEL[mode]);
    rollBtn.disabled = mode === 'rolling' || mode === 'working';
    rollBtn.dataset.action = mode === 'continue' ? 'continue' : 'roll';
    dieIcon.hidden = mode === 'continue';
    el.dataset.btn = mode;
  }
  function setBusy(b, mode = 'working') {
    const was = busy;
    busy = b;
    paintButton(b ? mode : 'roll');
    el.classList.toggle('is-busy', b);
    if (b) {
      clearTimeout(tipTimer);
      if (!was) rollLeaves();
      setPose('none');
    } else {
      // The fox returns 250ms after the button re-enables (or the tip shows instead).
      setTimeout(() => { if (!destroyed && !busy) { setPose('roll'); maybeTip(); } }, motionOK() ? 250 : 0);
    }
  }
  /**
   * Called whenever a turn has fully played out (or a game is resumed): puts the button into a state the player can act on.
   * Single player: the turn is closed silently and the roll button returns. Hot-seat: "continue" hands the phone on.
   */
  function settleButton() {
    if (destroyed) return;
    // One player (or the last one standing): the turn closes silently and the roll button returns, no hand-over.
    if ((!multi || lastPlayerStanding(match)) && canEndTurn(match) && state.status === 'playing') {
      match = endTurn(match); store.save(match); state = currentState(match); refreshHud();
    }
    if (multi && state.status === 'playing' && canEndTurn(match)) {
      busy = false;
      paintButton('continue');
      el.classList.remove('is-busy');
      setPose('roll');
      setStatus(afterTurnStatus());
    } else setBusy(false);
  }
  /** Status line once a turn has played out: who is next in hot-seat, otherwise the roll prompt. */
  function afterTurnStatus() {
    if (multi && !lastPlayerStanding(match)) {
      const next = nextActiveIndex(match);
      if (next >= 0 && next !== match.currentIndex) return t('game.statusNext', { name: nameOf(next) });
    }
    return t('game.statusBack');
  }
  /** On tap: tilt -6deg to 4deg over 200ms and nudge 8px toward the board centre, then fade out (CSS). */
  function rollLeaves() {
    if (!motionOK()) return;
    animate(rollFox, [{ transform: 'translateX(0) rotate(0deg)' }, { transform: 'translateX(0) rotate(-6deg)', offset: 0.4 }, { transform: `translateX(${dirSign() * 8}px) rotate(4deg)` }], { duration: 200, easing: 'ease-out', fill: 'none' });
  }

  const cardTitle = (id) => engine.data.cards.find((c) => c.id === id)?.title ?? '';

  // ---------- state application ----------
  const syncCash = (dur) => cash.to(state.cash, dur);

  /** Runs an engine action. On EngineError: shake + haptic, state unchanged. Returns true on success. */
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
    // Passive-income milestones (25/50/75% of expenses): celebrate once per crossing.
    const st = statement(state);
    const pct = st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0;
    const crossed = [0.25, 0.5, 0.75].find((mark) => lastPct < mark && pct >= mark && pct < 1);
    lastPct = pct;
    if (crossed) { pushLog(t('game.milestone', { pct: Math.round(crossed * 100) }), 'good'); react('celebrate'); }
    return true;
  }

  // ---------- hop ----------
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
    await animate(pawn, [
      { transform: `translate(${dx}px, ${dy}px) scale(1, 1)` },
      { transform: `translate(${dx / 2}px, ${dy / 2 - hop}px) scale(.95, 1.08)`, offset: 0.5 },
      { transform: 'translate(0, 0) scale(1.1, .9)', offset: 0.88 },
      { transform: 'translate(0, 0) scale(1, 1)' },
    ], { duration: dur, easing: 'ease-out', fill: 'none' }).finished.catch(() => {});
  }

  async function paydayFx(amount, months, monthly = amount / months) {
    haptic('land'); sound('payday');
    pushLog(tn('game.logPayday', { calc: paydayCalc(monthly, months, amount) }), amount >= 0 ? 'good' : 'bad');
    setStatus(tn('game.statusPayday', { calc: paydayCalc(monthly, months, amount) }));
    floatText(cash.el, h('div', { class: 'float-stack' }, signedMoney(amount), h('span', { class: 'float-sub' }, t('game.paydayFloatLabel'))), amount >= 0 ? 'income' : 'expense', { below: hud });
    pulse(el.querySelector('.hud-cash'), 1.04);
    if (amount > 0) react('celebrate');
    await cash.to(cash.value + amount, 450);
  }

  // ---------- turn ----------
  let priorPrices = {};
  async function turn() {
    if (busy || destroyed || state.phase !== 'roll' || state.status !== 'playing') return;
    setBusy(true, 'rolling');
    flow.newTurn();
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
    const paydays = next.events.filter((e) => e.type === 'payday');
    let pi = 0;
    for (const idx of move.path) {
      if (destroyed) return;
      await hopTo(idx);
      if (BOARD[idx] === 'payday' && paydays[pi]) { const pd = paydays[pi++]; flow.trigger('summary'); await paydayFx(pd.amount, pd.months, pd.monthly); }
    }
    if (destroyed) return;
    paintButton('working'); // the dice have stopped; the label now says we are moving on (cards, payday) instead of rolling
    haptic('land'); sound('land');
    setStatus(t('game.statusRolled', { steps: move.steps, square: t(`square.${BOARD[move.to]}`) }));
    pushLog(t('game.logMove', { steps: move.steps, square: t(`square.${BOARD[move.to]}`) }));
    state = next;
    commit();
    refreshHud();
    // The fox reacts to the square first, then the card (which carries its own reaction) opens.
    const landed = LAND_REACTION[BOARD[move.to]];
    if (landed && (next.pending || next.events.some((e) => e.type === 'baby' || e.type === 'expensePaid' || e.type === 'market'))) {
      react(landed);
      await pause(420);
      reactor.hide();
    }
    await handleEvents(next);
    await resolvePending();
    await afterTurn();
  }

  /** The turn's events are all resolved: end the match, send a player home, or let the player continue / roll again. */
  async function afterTurn() {
    if (destroyed) return;
    if (match.status !== 'playing') { setBusy(false); await finishIfOver(); return; }
    if (state.status === 'lost') { await outFlow(); return; }
    settleButton();
    flow.pumpExplain();
  }

  /** Switches the screen to the (new) current player of the match. */
  function switchPlayer() {
    state = currentState(match);
    refreshHud();
    markActive();
    cash.set(state.cash);
    dice.setValues(state.lastRoll?.dice || [1]);
    lastPct = (() => { const st = statement(state); return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0; })();
    setStatus(t('game.statusStart'));
    pushLog(t('game.playerTurn', { name: nameOf() }));
    hideTip();
    toggleOthers(false);
  }

  /** Pass-the-phone: switch to the next player, then ask them to confirm they are ready. */
  async function passTo(prevIndex) {
    switchPlayer();
    // The same player again (everyone else is out): nobody to hand the phone to.
    if (match.currentIndex !== prevIndex) await showHandoff();
  }
  async function showHandoff() {
    if (!multi || destroyed) return;
    await handoffSheet({ name: nameOf(), color: colorOf() });
  }

  /** "Continue": the player has seen the outcome; the turn passes to the next player. */
  async function continueTurn() {
    if (busy || destroyed || btnMode !== 'continue' || !canEndTurn(match)) return;
    busy = true;
    paintButton('working');
    const prev = match.currentIndex;
    match = endTurn(match);
    store.save(match);
    await passTo(prev);
    if (destroyed) return;
    busy = false;
    settleButton();
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
    await passTo(prev);
    if (destroyed) return;
    busy = false;
    settleButton();
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
      await expenseModal(state, { card: ev.card, amount: ev.amount, paid: true });
      haptic('error');
      await syncCash();
      flow.feedback(feedbackForEvent(ev, state));
    } else if (ev.type === 'market') {
      pushLog(t('game.logMarket', { title: ev.card.title }));
      const prior = ev.card.effect === 'stockPrice' ? (priorPrices[ev.card.symbol] ?? engine.data.cards.find((c) => c.type === 'stock' && c.symbol === ev.card.symbol)?.price ?? null) : null;
      if (prior != null && ev.card.newPrice < prior) flow.trigger('stockDrop');
      await marketInfoModal(state, { card: ev.card, noMatch, familyOffer: ev.card.effect === 'offer' && !noMatch });
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
    const shown = (ev) => ev.type === 'baby' || ev.type === 'babyMax' || (ev.type === 'expensePaid' && ev.card)
      || (ev.type === 'market' && s.pending?.kind !== 'offer');
    unseen = s.events.filter(shown).map((ev) => ({ ev, noMatch }));
    await runEventQueue();
    await syncCash();
  }

  async function loanFlow(required = 0, { card = null, qty = 1 } = {}) {
    flow.trigger('loan');
    // a loan that buys the pending card: the dialog shows the state right after the purchase (the asset's cash flow counts)
    const amount = await loanDialog(state, { required, gain: card ? purchaseCashFlow(card, qty) : null });
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
    const seed = state.seed + state.turn;
    const eye = (wasEarned) => eyeModel(state.learn?.guesses ?? [], { wasEarned });
    return {
      enabled: true, seed, prior: guessForCard(state, card.id),
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
        r = await opportunityModal(state, { flip, guess: guessFor(p.card) });
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
    store.clear();
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
    const r = await homeConfirmSheet({ daily: isDaily });
    homeOpen = false;
    releaseGate?.(); homeGate = null; releaseGate = null; // queued cards may open now
    if (r === 'home') goHome();
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
    destroyed = true;
    clearTimeout(tipTimer);
    reactor.hide();
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
      warmFox(REACTIONS);
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
        // Fresh match or a resume between turns: confirm whose turn it is before anyone can roll.
        setBusy(true);
        pushLog(t('game.playerTurn', { name: nameOf() }));
        await showHandoff();
        if (destroyed) return;
        setBusy(false);
      }
      maybeTip();
    },
    destroy: () => teardown(),
    get state() { return state; },
    get match() { return match; },
    monthlyCashFlow: () => monthlyCashFlow(state),
  };
}
