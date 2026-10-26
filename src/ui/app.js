// App shell: screen routing, persistence (save/resume), engine wiring.
import { loadBoardStyles } from './board-styles.js';
import { prepareBoardImage } from './board-ready.js';
import { h, clear } from './dom.js';
import { toast } from './fx.js';
import {
  createEngine, serialize, deserialize, newMatch, rematch, isMultiplayer, currentState, dailySeed, dailyProfessionId, DAILY_MODE, seesCoins, isJuniorSetup, JUNIOR_AGE,
} from '../engine/index.js';
import { setCoinScale } from './format.js';
import { loadData } from '../data/index.js';
import { readRaw, writeRaw, remove } from '../services/storage.js';
import { createMatchStore } from '../services/match-store.js';
import { createStart } from './screens/start.js';
import { createPick } from './screens/pick.js';
import { createPlayers } from './screens/players.js';
import { playerName } from './players.js';
import { createPlay } from './play.js';
import { createWin, createOver } from './screens/end.js';
import { createDailyResult } from './screens/daily.js';
import { dayKey } from '../daily/calendar.js';
import { streakView } from '../daily/streak.js';
import { dailyStatus } from '../daily/attempt.js';
import { loadResults, loadStreak, endDailyGame, resetDay } from '../daily/store.js';
import { showInterstitial } from '../services/ads.js';
import { getLocale, t } from '../i18n/index.js';
import { destroyAllLayers } from './modal.js';
import { initTermButtons } from './learn.js';
import { setLearnMode } from '../learn/context.js';
import { loadTutorial } from '../learn/tutorial-store.js';
import { setSession } from './session.js';

export function createApp(host) {
  const data = loadData(getLocale());
  initTermButtons(); // glossary term buttons + validation of the learning content (fails loudly)
  const engine = createEngine(data);
  setSession({ engine });
  const professionIds = data.professions.map((p) => p.id);
  let active = null;
  let mode = readRaw('mode') === 'full' ? 'full' : 'family';
  // Hot-seat setup being built: count, names, and each player's chosen profession.
  let setup = { count: 1, names: [''], ages: [null], professionIds: [] };

  // a daily challenge keeps its own slot, so starting it never overwrites a normal game in progress; the slot always comes from the match
  const store = createMatchStore({ write: writeRaw, remove, serialize });

  function loadSave() {
    const raw = readRaw('save');
    if (!raw) return null;
    const m = deserialize(raw);
    if (!m || m.daily || !['playing', 'lost', 'won'].includes(m.status) || !m.players.every((p) => engine.data.professions.some((x) => x.id === p.state.profession?.id))) return null;
    return m;
  }

  /** Today's unfinished daily game, or null. A save from an earlier day is dropped (that day is over, nothing is consumed). */
  function loadDailySave(today = dayKey()) {
    const raw = readRaw('dailySave');
    if (!raw) return null;
    const m = deserialize(raw);
    const ok = m && m.daily?.date === today && m.status === 'playing' && m.players.length === 1
      && engine.data.professions.some((x) => x.id === m.players[0].state.profession?.id);
    if (!ok) { remove('dailySave'); return null; }
    return m;
  }

  function dailyInfo() {
    const today = dayKey();
    const results = loadResults();
    const hasSave = !results.byDate[today] && !!loadDailySave(today);
    return { date: today, status: dailyStatus({ results, hasSave }, today), entry: results.byDate[today] ?? null, streak: streakView(loadStreak(), today) };
  }

  function goDaily() {
    const info = dailyInfo();
    if (info.status === 'done') { goDailyResult(info.entry); return; }
    if (info.status === 'playing') { goPlay(loadDailySave(info.date)); return; }
    // one attempt per day: only a day without a result and without a saved game starts a new one
    const seed = dailySeed(info.date);
    const professionId = dailyProfessionId(seed, engine.data.professions);
    goPlay(newMatch(engine, { mode: DAILY_MODE, seed, players: [{ name: '', professionId }], daily: { date: info.date } }));
  }

  function goDailyResult(entry, { fresh = false, badges = [] } = {}) {
    const res = createDailyResult({
      entry, professionTitle: engine.data.professions.find((x) => x.id === entry.record.professionId)?.title ?? '', streak: streakView(loadStreak(), dayKey()),
      newBadges: badges, celebrate: fresh,
      url: new URL('.', location.href).href,
      onMenu: () => goStart(),
    });
    mount({ el: res.el, destroy: () => res.destroy() }, { start: () => res.start() });
  }

  // The result is written (then the save slot cleared) the instant the game ends, BEFORE the end-of-game pause, so a reload at any
  // moment keeps the attempt. The outcome is remembered so the screen shown after the pause still celebrates the fresh result.
  const dailyOutcomes = new WeakMap();
  function commitDaily(m) {
    if (!dailyOutcomes.has(m)) dailyOutcomes.set(m, endDailyGame(currentState(m), () => store.clear(m)));
    return dailyOutcomes.get(m);
  }
  function finishDaily(m) {
    // a daily finish is not a 'game played' for the interstitial cadence (decisions.md)
    const out = commitDaily(m);
    goDailyResult(out.entry, { fresh: true, badges: out.newBadges });
  }

  function mount(screen, { start } = {}) {
    active?.destroy?.();
    destroyAllLayers(); // no card, dialog or sheet of the previous screen may survive into the next one
    active = screen;
    clear(host);
    host.append(screen.el || screen);
    host.dataset.screen = (screen.el || screen).dataset.screen;
    window.scrollTo(0, 0);
    start?.();
    const af = host.querySelector('[data-autofocus]');
    af?.focus?.({ preventScroll: true });
  }

  const seedFromUrl = () => {
    const n = Number(new URLSearchParams(location.search).get('seed'));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : (Date.now() % 2147483647) + 1;
  };
  let seedCounter = 0;
  const nextSeed = () => {
    const base = seedFromUrl();
    seedCounter += 1;
    return base + (new URLSearchParams(location.search).has('seed') ? seedCounter - 1 : 0);
  };

  const nav = {
    menu: () => goStart(),
    commit: (m) => { if (m.daily) commitDaily(m); },
    win: (s) => goWin(s),
    over: (s) => goOver(s),
  };

  const gamesPlayed = () => Math.max(0, parseInt(readRaw('gamesPlayed') || '0', 10) || 0);
  const countGame = () => writeRaw('gamesPlayed', String(gamesPlayed() + 1));

  function goStart() {
    setCoinScale(false);
    const start = createStart({
      save: loadSave(),
      mode,
      gamesPlayed: gamesPlayed(),
      daily: dailyInfo(),
      onDaily: () => goDaily(),
      onDailyReset: () => { resetDay(dayKey()); goStart(); },
      onRefresh: () => goStart(),
      onMode: (m) => { mode = m; writeRaw('mode', m); },
      onPlay: (m) => { mode = m; writeRaw('mode', m); goPlayers(); },
      onResume: () => {
        const m = loadSave();
        if (!m) return;
        // a match that already ended (saved just before the end screen) resumes on its end screen
        if (m.status === 'won') goWin(m); else if (m.status === 'lost') goOver(m); else goPlay(m);
      },
    });
    mount(start, { start: () => start.start() });
  }

  function goPlayers() {
    setCoinScale(false);
    mount({ el: createPlayers({
      count: setup.count, names: setup.names, ages: setup.ages ?? [], mode,
      onMode: (m) => { mode = m; writeRaw('mode', m); },
      onBack: () => goStart(),
      onNext: ({ count, names, ages }) => { setup = { count, names, ages, professionIds: [] }; goPick(0); },
    }).el });
  }

  function goPick(i) {
    const multi = setup.count > 1;
    const junior = isJuniorSetup(mode, (setup.ages ?? []).map((age) => ({ age })));
    setCoinScale(junior && setup.ages?.[i] === JUNIOR_AGE); // this player's own scale
    mount({ el: createPick({
      engine, mode, junior,
      player: multi ? { name: playerName({ name: setup.names[i] }, i), color: i + 1, n: i + 1, total: setup.count } : null,
      onBack: () => (i === 0 ? goPlayers() : goPick(i - 1)),
      onGo: (professionId) => {
        setup.professionIds[i] = professionId;
        if (i + 1 < setup.count) goPick(i + 1); else startNew();
      },
    }) });
  }

  async function startNew() {
    const m = newMatch(engine, {
      mode, seed: nextSeed(),
      players: setup.professionIds.map((professionId, i) => ({ name: setup.names[i], professionId, age: setup.ages?.[i] ?? null })),
    });
    setCoinScale(seesCoins(m, m.players[0])); // the story of a junior first game is told in coins
    // 'המשחק הראשון עם מקסי': the first family game of this device opens with the five-screen story (lazy chunk, skippable)
    if (mode === 'family' && !loadTutorial().storyDone) {
      try {
        const { runFirstGameIntro } = await import('./tutorial/index.js');
        await runFirstGameIntro({ engine, professionId: setup.professionIds[0] });
      } catch (err) { console.error(err); } // never block the game on the introduction
    }
    goPlay(m);
  }

  async function goPlay(m, { fresh = false } = {}) {
    store.save(m);
    setLearnMode(m.mode);
    try { await loadBoardStyles(); } catch (err) { console.warn(err); } // the board is usable (if plainer) even without its v4 stylesheet
    try { await prepareBoardImage(); } catch (err) { console.error(err); toast(t('app.loadError'), 4000); return; }
    const play = createPlay({ engine, match: m, nav, store, professionIds, fresh });
    mount({ el: play.el, destroy: () => play.destroy() }, { start: () => play.start() });
  }

  /** Same players, mode and professions, new seed. */
  function again(m) {
    goPlay(rematch(engine, m, nextSeed()), { fresh: true });
  }

  function settingsOf(m) {
    mode = m.mode;
    setup = {
      count: m.players.length,
      names: m.players.map((p, i) => (m.players.length > 1 ? playerName(p, i) : '')),
      ages: m.players.map((p) => p.age ?? null),
      professionIds: m.players.map((p) => p.professionId),
    };
  }

  async function goWin(m) {
    if (m.daily) { finishDaily(m); return; }
    store.clear(m);
    countGame();
    const multi = isMultiplayer(m);
    setCoinScale(seesCoins(m, m.players[m.winnerIndex ?? 0])); // the winner's own scale
    const win = createWin({
      match: m,
      onAgain: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    });
    mount({ el: win.el }, { start: () => win.start() });
    showInterstitial('win');
  }

  function goOver(m) {
    if (m.daily) { finishDaily(m); return; }
    store.clear(m);
    countGame();
    const multi = isMultiplayer(m);
    setCoinScale(!multi && seesCoins(m, m.players[0]));
    const over = createOver({
      match: m,
      onRetry: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    });
    mount({ el: over.el }, { start: () => over.start() });
  }

  return { start: goStart, engine, data, h };
}
