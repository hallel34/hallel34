// Board screen + game flow controller. The engine is the source of truth; this file only
// presents engine events (die, hops, cash) and applies the player's choices through the engine.
import { h } from './dom.js';
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
import coinUrl from '../assets/coin.svg?url';
import pawnUrl from '../assets/pawn.svg?url';

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
  const turnEl = h('span', { class: 'hud-sub', 'aria-live': 'polite' });
  const babies = h('span', { class: 'hud-babies', role: 'img', 'aria-label': t('game.kids', { n: 0 }) });
  const charityChip = h('span', { class: 'chip chip-charity', 'data-active': 'false' });
  const cash = cashDisplay(state.cash);
  const flowChip = h('span', { class: 'flow-chip' });
  const passiveVal = h('b', { class: 'tone-income' });
  const expenseVal = h('b', { class: 'tone-expense' });
  const m = meter();
  const settingsBtn = iconButton('gear', t('game.settings'), () => openSettings({ onQuit: () => nav.menu(), version: __APP_VERSION__ }), 'icon-btn-glass');

  const hud = h('header', { class: 'hud glass' },
    h('div', { class: 'hud-top' },
      avatar,
      h('div', { class: 'hud-id' }, h('span', { class: 'hud-prof' }, state.profession.title), turnEl),
      h('div', { class: 'hud-badges' }, babies),
      settingsBtn),
    h('div', { class: 'hud-cash' },
      h('img', { class: 'hud-coin', src: coinUrl, alt: '', width: 34, height: 34 }),
      h('span', { class: 'cash-wrap', 'aria-label': t('game.cash') }, cash.el)),
    h('div', { class: 'hud-chips' }, flowChip, charityChip),
    h('div', { class: 'hud-meter' },
      h('div', { class: 'meter-labels' },
        h('span', null, t('game.passive'), ' ', passiveVal),
        h('span', null, t('game.expenses'), ' ', expenseVal)),
      m.el));

  // ---------- Board ----------
  const tiles = BOARD.map((sq, i) => {
    const [col, row] = ringPos(i);
    return h('div', { class: `tile tile-${sq}`, 'aria-hidden': 'true', 'data-i': i, vars: { '--c': col, '--r': row } }, icon(sq, { size: 24, width: 2.6 }));
  });
  const pawn = h('img', { class: 'pawn', src: pawnUrl, alt: '', width: 36, height: 40, draggable: 'false' });
  const dice = createDice();
  dice.setValues(state.lastRoll?.dice || [1]);
  const status = h('p', { class: 'board-status', 'aria-live': 'polite' }, t('game.statusStart'));
  const center = h('div', { class: 'board-center' }, dice.el, status);
  const board = h('div', { class: 'board', role: 'group' }, ...tiles, center);
  let currentTile = null;

  const rollBtn = button(t('game.roll'), { variant: 'primary', cls: 'btn-roll', 'data-action': 'roll', onClick: () => turn() });
  const stmtBtn = h('button', { type: 'button', class: 'btn-square', 'aria-label': t('game.statement'), 'data-action': 'statement', onClick: () => openStmt() }, icon('statement', { size: 28, width: 2.2 }));
  const actions = h('div', { class: 'board-actions' }, stmtBtn, rollBtn);

  // Recent-events strip: fills the space between the board and the roll button.
  const logList = h('ol', { class: 'log-list' });
  const logEl = h('section', { class: 'board-log', 'aria-label': t('game.lastEvents') },
    h('h2', { class: 'log-title' }, t('game.lastEvents')), logList);
  const logItems = [];
  function pushLog(text, tone = '') {
    if (!text) return;
    logItems.unshift({ text, tone });
    logItems.length = Math.min(logItems.length, 4);
    logList.replaceChildren(...logItems.map((x, i) => h('li', { class: `log-item${x.tone ? ` log-${x.tone}` : ''}${i === 0 ? ' is-new' : ''}` }, x.text)));
  }
  logList.append(h('li', { class: 'log-item log-empty' }, t('game.noEvents')));

  const el = h('section', { class: 'screen screen-board', 'data-screen': 'board' },
    h('h1', { class: 'vh' }, `${t('app.title')} · ${t('game.boardTitle')}`), hud, board, logEl, actions);

  function place(idx) {
    currentTile?.classList.remove('is-current');
    currentTile = tiles[idx];
    currentTile.classList.add('is-current');
    currentTile.append(pawn);
    board.setAttribute('aria-label', t('game.boardLabel', { n: idx + 1, total: BOARD.length, square: t(`square.${BOARD[idx]}`) }));
  }
  place(state.position);

  function refreshHud() {
    const st = statement(state);
    turnEl.textContent = state.turn ? t('game.turn', { turn: state.turn }) : t('game.yourTurn');
    flowChip.replaceChildren(tn('game.perMonth', { amount: money(st.monthlyCashFlow, { sign: true }) }));
    flowChip.classList.toggle('is-negative', st.monthlyCashFlow < 0);
    passiveVal.replaceChildren(money(st.passiveIncome));
    expenseVal.replaceChildren(money(st.totalExpenses));
    m.set(st.passiveIncome, st.totalExpenses);
    babies.replaceChildren(...Array.from({ length: state.kids }, () => icon('baby', { size: 20, width: 2.2 })));
    babies.setAttribute('aria-label', t('game.kids', { n: state.kids }));
    babies.hidden = state.kids === 0;
    // The chip keeps its slot (visibility, not display) so the HUD never changes height.
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

  const setStatus = (text) => { status.textContent = text; };
  function setBusy(b) {
    busy = b;
    rollBtn.disabled = b;
    rollBtn.textContent = b ? t('game.rolling') : t('game.roll');
    el.classList.toggle('is-busy', b);
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
      } else if (ev.type === 'sold' || ev.type === 'loan') {
        pushLog(ev.type === 'loan' ? t('game.logLoan', { amount: moneyText(ev.amount) }) : t('game.logSold', { amount: moneyText(ev.proceeds) }), ev.type === 'loan' ? 'bad' : 'good');
        haptic('purchase'); sound('coin');
        coinBurst(ev.type === 'loan' ? rollBtn : stmtBtn, cash.el, 6);
      } else if (ev.type === 'passed') {
        pushLog(t('game.logPassed'));
      } else if (ev.type === 'donated') {
        pushLog(t('game.logDonated', { amount: moneyText(ev.cost) }));
        haptic('purchase'); sound('coin');
      }
    }
    syncCash();
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
      if (state.status !== 'playing') return;
      if (state.pending) {
        setBusy(true);
        await resolvePending();
        setBusy(false);
        await finishIfOver();
      }
    },
    destroy() { destroyed = true; debugTools?.remove(); },
    get state() { return state; },
    monthlyCashFlow: () => monthlyCashFlow(state),
  };
}
