// Board screen + game flow controller. The engine is the source of truth; this file only
// presents engine events (die, hops, cash) and applies the player's choices through the engine.
import { h, html } from './dom.js';
import { t } from '../i18n/index.js';
import { BOARD, EngineError, statement, monthlyCashFlow } from '../engine/index.js';
import { icon } from './icons.js';
import { money, moneyText, tn } from './format.js';
import { button, iconButton, meter, cashDisplay } from './widgets.js';
import { createDice } from './die.js';
import { motionOK } from './prefs.js';
import {
  haptic, sound, animate, cssMs, cssPx, floatText, coinBurst, shake, pulse, pause,
} from './fx.js';
import {
  opportunityModal, expenseModal, shortfallModal, charityModal, offerModal, marketInfoModal,
  babyModal, loanDialog, repayDialog, sellSheet,
} from './modals.js';
import { openStatement } from './statement.js';
import { openSettings } from './settings.js';
import { ringPos, avatarColor } from './layout.js';
import { closeAllLayers } from './modal.js';
import { debugEnabled, mountDebugTools } from './debug.js';
import { foxImg, createReactor, warmFox, dirSign } from './fox.js';
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
 * @param state  starting engine state (new or resumed)
 * @param nav    { menu(), win(state), over(state) }
 * @param store  { save(state), clear() }
 */
export function createPlay({ engine, state: initial, nav, store, professionIds = [] }) {
  let state = initial;
  let busy = false;
  let destroyed = false;

  // ---------- HUD ----------
  const avatar = h('div', { class: 'avatar', 'aria-hidden': 'true' }, state.profession.title.trim()[0]);
  avatar.style.background = avatarColor(state.profession.id, professionIds);
  const turnEl = h('span', { 'aria-live': 'polite' });
  const babies = h('span', { class: 'hud-babies', role: 'img', 'aria-label': t('game.kids', { n: 0 }) });
  const charityChip = h('span', { class: 'chip chip-charity', 'data-active': 'false' });
  const cash = cashDisplay(state.cash);
  const flowChip = h('span', { class: 'flow-chip' });
  const passiveVal = h('b', { class: 'tone-income' });
  const expenseVal = h('b', { class: 'tone-expense' });
  const m = meter();
  const settingsBtn = iconButton('gear', t('game.settings'), () => openSettings({ onQuit: () => nav.menu(), version: __APP_VERSION__ }), 'icon-btn-glass');
  const stmtBtn = iconButton('statement', t('game.statement'), () => openStmt(), 'icon-btn-glass');
  stmtBtn.dataset.action = 'statement';

  const hud = h('header', { class: 'hud glass' },
    h('div', { class: 'hud-top' },
      avatar,
      h('div', { class: 'hud-id' }, h('span', { class: 'hud-prof' }, state.profession.title), h('span', { class: 'hud-sub' }, turnEl, babies)),
      h('div', { class: 'hud-btns' }, stmtBtn, settingsBtn)),
    h('div', { class: 'hud-cash' },
      h('img', { class: 'hud-coin', src: coinUrl, alt: '', width: 30, height: 30 }),
      h('span', { class: 'cash-wrap', 'aria-label': t('game.cash') }, cash.el),
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
  const pawn = h('img', { class: 'pawn', src: pawnUrl, alt: '', width: 36, height: 40, draggable: 'false' });
  const dice = createDice();
  dice.setValues(state.lastRoll?.dice || [1]);
  const status = h('p', { class: 'board-status', 'aria-live': 'polite' }, t('game.statusStart'));
  const center = h('div', { class: 'board-center' }, dice.el, status, charityChip);
  const board = h('div', { class: 'board', role: 'group' }, html(SKYLINE), ...tiles, center);
  let currentTile = null;

  const rollLabel = h('span', null, t('game.roll'));
  const rollBtn = button([h('img', { src: dieUrl, alt: '', width: 30, height: 30, class: 'btn-die' }), rollLabel], { variant: 'primary', cls: 'btn-roll', 'data-action': 'roll', onClick: () => turn() });
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
  /** Brief fox reaction in the strip under the board (never over the HUD, tiles, die or numbers). */
  const react = (pose) => reactor.show(pose);
  const setPose = (p) => { zone.dataset.pose = p; };

  function pushLog(text, tone = '') {
    if (!text) return;
    chip.textContent = text;
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
  el.addEventListener('pointerdown', () => hideTip());

  function place(idx) {
    currentTile?.classList.remove('is-current');
    currentTile = tiles[idx];
    currentTile.classList.add('is-current');
    currentTile.append(pawn);
    board.setAttribute('aria-label', t('game.boardLabel', { n: idx + 1, total: BOARD.length, square: t(`square.${BOARD[idx]}`) }));
  }
  place(state.position);

  let lastPct = 0;
  function refreshHud() {
    const st = statement(state);
    turnEl.textContent = state.turn ? t('game.turn', { turn: state.turn }) : t('game.yourTurn');
    flowChip.replaceChildren(tn('game.perMonth', { amount: money(st.monthlyCashFlow, { sign: true }) }));
    flowChip.classList.toggle('is-negative', st.monthlyCashFlow < 0);
    passiveVal.replaceChildren(money(st.passiveIncome));
    expenseVal.replaceChildren(money(st.totalExpenses));
    m.set(st.passiveIncome, st.totalExpenses);
    babies.replaceChildren(...Array.from({ length: state.kids }, () => icon('baby', { size: 18, width: 2.2 })));
    babies.setAttribute('aria-label', t('game.kids', { n: state.kids }));
    babies.hidden = state.kids === 0;
    // The chip keeps its slot (visibility, not display) so the board centre never changes height.
    charityChip.dataset.active = String(state.charityTurns > 0);
    charityChip.setAttribute('aria-hidden', String(state.charityTurns <= 0));
    if (state.charityTurns > 0) charityChip.replaceChildren(icon('charity', { size: 16, width: 2.6 }), ` ${t('game.charityBoost', { turns: state.charityTurns })}`);
    el.dataset.turn = String(state.turn);
    el.dataset.cash = String(state.cash);
    el.dataset.phase = state.phase;
    el.dataset.passive = String(st.passiveIncome);
    el.dataset.expenses = String(st.totalExpenses);
    el.dataset.position = String(state.position);
  }
  refreshHud();
  lastPct = (() => { const st = statement(state); return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0; })();

  const setStatus = (text) => { status.textContent = text; };
  function setBusy(b) {
    const was = busy;
    busy = b;
    rollBtn.disabled = b;
    rollLabel.textContent = b ? t('game.rolling') : t('game.roll');
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
    try {
      state = fn(state);
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      haptic('error'); sound('error');
      shake(el.querySelector('.hud'));
      return false;
    }
    store.save(state);
    refreshHud();
    for (const ev of state.events) {
      if (ev.type === 'bought') {
        pushLog(t('game.logBought', { title: cardTitle(ev.cardId) }), 'good');
        haptic('purchase'); sound('coin');
        coinBurst(center, stmtBtn, 10);
        react('celebrate');
      } else if (ev.type === 'sold' || ev.type === 'loan') {
        pushLog(ev.type === 'loan' ? t('game.logLoan', { amount: moneyText(ev.amount) }) : t('game.logSold', { amount: moneyText(ev.proceeds) }), ev.type === 'loan' ? 'bad' : 'good');
        haptic('purchase'); sound('coin');
        coinBurst(ev.type === 'loan' ? rollBtn : stmtBtn, cash.el, 6);
        if (ev.type === 'loan') react('worried');
      } else if (ev.type === 'passed') {
        pushLog(t('game.logPassed'));
      } else if (ev.type === 'donated') {
        pushLog(t('game.logDonated', { amount: moneyText(ev.cost) }));
        haptic('purchase'); sound('coin');
      }
    }
    syncCash();
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

  async function paydayFx(amount, months) {
    haptic('land'); sound('payday');
    pushLog(t('game.logPayday', { amount: moneyText(amount, { sign: true }), months: t('game.paydayMonths', { months }) }), amount >= 0 ? 'good' : 'bad');
    setStatus(t('game.statusPayday', { months, amount: moneyText(amount, { sign: true }) }));
    floatText(cash.el, h('div', { class: 'float-stack' }, money(amount, { sign: true }), h('span', { class: 'float-sub' }, t('game.paydayFloatLabel', { months }))), amount >= 0 ? 'income' : 'expense');
    pulse(el.querySelector('.hud-cash'), 1.04);
    if (amount > 0) react('celebrate');
    await cash.to(cash.value + amount, 450);
  }

  // ---------- turn ----------
  async function turn() {
    if (busy || destroyed || state.phase !== 'roll' || state.status !== 'playing') return;
    setBusy(true);
    haptic('roll'); sound('roll');
    let next;
    try { next = engine.roll(state); } catch (e) { console.error(e); setBusy(false); return; }
    const move = next.events.find((e) => e.type === 'move');
    setStatus(t('game.statusMoving'));
    await dice.roll(move.dice);
    const paydays = next.events.filter((e) => e.type === 'payday');
    let pi = 0;
    for (const idx of move.path) {
      await hopTo(idx);
      if (BOARD[idx] === 'payday' && paydays[pi]) { const pd = paydays[pi++]; await paydayFx(pd.amount, pd.months); }
    }
    haptic('land'); sound('land');
    setStatus(t('game.statusRolled', { steps: move.steps, square: t(`square.${BOARD[move.to]}`) }));
    pushLog(t('game.logMove', { steps: move.steps, square: t(`square.${BOARD[move.to]}`) }));
    state = next;
    store.save(state);
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
    setBusy(false);
    await finishIfOver();
  }

  async function handleEvents(s) {
    for (const ev of s.events) {
      if (destroyed) return;
      if (ev.type === 'baby') {
        pushLog(t('game.logBaby'));
        await babyModal(state, { max: false, extra: ev.extra });
      } else if (ev.type === 'babyMax') {
        await babyModal(state, { max: true, extra: 0 });
      } else if (ev.type === 'expensePaid' && ev.card) {
        pushLog(t('game.logExpense', { title: ev.card.title, amount: moneyText(-ev.amount) }), 'bad');
        await expenseModal(state, { card: ev.card, amount: ev.amount, paid: true });
        haptic('error');
        await syncCash();
      } else if (ev.type === 'market' && s.pending?.kind !== 'offer') {
        pushLog(t('game.logMarket', { title: ev.card.title }));
        const noMatch = s.events.some((x) => x.type === 'noMatchingAsset');
        await marketInfoModal(state, { card: ev.card, noMatch, familyOffer: ev.card.effect === 'offer' && !noMatch });
        if (ev.card.effect === 'cash') { haptic(ev.card.amount >= 0 ? 'purchase' : 'error'); sound(ev.card.amount >= 0 ? 'coin' : 'error'); }
        await syncCash();
      }
    }
    await syncCash();
  }

  async function loanFlow(required = 0) {
    const amount = await loanDialog(state, { required });
    if (amount) apply((s) => engine.takeLoan(s, amount));
    return !!amount;
  }

  async function sellFlow() {
    await sellSheet(
      () => state,
      (id, qty) => { apply((s) => engine.sellAsset(s, id, qty)); return state; },
      { shouldClose: (s) => s.status !== 'playing' || s.phase !== 'mustPay' },
    );
  }

  async function resolvePending() {
    let first = true;
    while (!destroyed && state.status === 'playing' && state.pending) {
      const p = state.pending;
      const flip = first;
      first = false;
      let r;
      if (p.kind === 'opportunity') {
        r = await opportunityModal(state, { flip });
        if (!r) break; // closed by debug force
        if (r.action === 'buy') apply((s) => engine.buy(s, r.qty));
        else if (r.action === 'pass') apply((s) => engine.pass(s));
        else if (r.action === 'loan') await loanFlow(Math.max(0, (p.card.type === 'stock' ? p.card.price : p.card.downPayment) - state.cash));
      } else if (p.kind === 'expense') {
        r = await expenseModal(state, { card: p.card, amount: p.amount, paid: false, flip });
        if (!r) break; // closed by debug force
        if (r.action === 'loan') await loanFlow(p.amount - state.cash);
        else if (r.action === 'sell') await sellFlow();
      } else if (p.kind === 'shortfall') {
        r = await shortfallModal(state, { flip });
        if (!r) break; // closed by debug force
        if (r.action === 'loan') await loanFlow(-state.cash);
        else if (r.action === 'sell') await sellFlow();
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
    if (state.status === 'playing') setStatus(t('game.statusBack'));
  }

  let ending = false;
  async function finishIfOver() {
    if (destroyed || ending || state.status === 'playing') return;
    ending = true;
    store.clear();
    await pause(500);
    if (state.status === 'won') nav.win(state); else nav.over(state);
  }

  // ---------- statement ----------
  function openStmt() {
    const closeIfOver = () => { if (state.status !== 'playing') layer.close(); };
    const layer = openStatement({
      getState: () => state,
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
      closeAllLayers();
      store.save(state);
      refreshHud();
      finishIfOver();
      return true;
    };
    debugTools = mountDebugTools({ forceWin: () => force('win'), forceLose: () => force('lose') });
  }

  return {
    el,
    /** Called once the screen is mounted. Resumes a pending decision if the save had one. */
    async start() {
      warmFox(REACTIONS);
      if (state.status !== 'playing') return;
      if (!state.pending) maybeTip();
      if (state.pending) {
        setBusy(true);
        await resolvePending();
        setBusy(false);
        await finishIfOver();
      }
    },
    destroy() { destroyed = true; clearTimeout(tipTimer); reactor.hide(); debugTools?.remove(); },
    get state() { return state; },
    monthlyCashFlow: () => monthlyCashFlow(state),
  };
}
