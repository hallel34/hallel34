// App shell: screen routing, persistence (save/resume), engine wiring.
import { loadBoardStyles } from './board-styles.js';
import { prepareBoardImage } from './board-ready.js';
import { h, clear } from './dom.js';
import { toast } from './fx.js';
import {
  createEngine, serialize, deserialize, newMatch, rematch, isMultiplayer, currentState, dailySeed, dailyProfessionId, DAILY_MODE, seesCoins, isJuniorSetup, JUNIOR_AGE, cleanAge,
  SHORT_ROUNDS, botProfessionId,
} from '../engine/index.js';
import { setCoinScale } from './format.js';
import { loadData } from '../data/index.js';
import { readRaw, writeRaw, remove } from '../services/storage.js';
import { createMatchStore } from '../services/match-store.js';
import { createStart } from './screens/start.js';
import { createPick } from './screens/pick.js';
import { createPlayers } from './screens/players.js';
import { playerName } from './players.js';
import { createWin, createOver } from './screens/end.js';
import { createDailyResult } from './screens/daily.js';
import { dayKey } from '../daily/calendar.js';
import { streakView } from '../daily/streak.js';
import { dailyStatus } from '../daily/attempt.js';
import { loadResults, loadStreak, endDailyGame, resetDay } from '../daily/store.js';
import { showInterstitial } from '../services/ads.js';
import { getLocale, t } from '../i18n/index.js';
import { destroyAllLayers, openLayer } from './modal.js';
import { button } from './widgets.js';
import { initTermButtons } from './learn.js';
import { setLearnMode } from '../learn/context.js';
import { loadTutorial } from '../learn/tutorial-store.js';
import { setSession } from './session.js';
import { newFirstAsset, firstAssetPurchase, continueFirstAsset, FIRST_ASSET_ID } from '../engine/first-asset.js';
import { createFirstAsset } from './screens/first-asset.js';
import { FIRST_ASSET_BADGE } from '../engine/first-asset.js';
import { hasBadge } from '../learn/store.js';
import { isShortMission, practiceSlot, newShortMission, continueShortMission, validShortMission, REPAY_MISSION } from '../engine/short-missions.js';
import { SLOT_MISSION } from '../services/match-store.js';
import { completedShortMissions } from '../services/mission-progress.js';
import { createMissions } from './screens/missions.js';
import { createShortMission } from './screens/short-mission.js';
import { loadMissionStyles } from './mission-styles.js';
import { challengeEligibility, linkLogOf, encodeActionLog, configOf, challengeKey } from '../engine/index.js';
import { SLOT_CHALLENGE } from '../services/match-store.js';
import { loadChallenges, saveChallenges, upsertEntry, findEntry, summaryOf } from '../services/challenge-store.js';
import { parseChallengeHash, routeChallenge, guardLinkKind, LONGEST_NAME } from '../services/challenge-route.js';
import { setJuniorView, viewerAge, viewerIsJunior, ct, linkUrl, shareMessage } from './challenge/copy.js';

// The board (play.js: board, cards, bots, auctions, renovation, learning flow) is its own chunk, off the home screen's critical
// path (QA round 19 perf). main.js warms it up at idle time; the service worker precaches it, so it opens offline too.
let playChunk = null;
export const loadPlay = () => (playChunk ??= import('./play.js').catch((err) => { playChunk = null; throw err; }));

export function createApp(host) {
  const data = loadData(getLocale());
  initTermButtons(); // glossary term buttons + validation of the learning content (fails loudly)
  const engine = createEngine(data);
  setSession({ engine });
  const professionIds = data.professions.map((p) => p.id);
  let active = null;
  let mode = readRaw('mode') === 'full' ? 'full' : 'family';
  // Hot-seat setup being built: count, names, and each player's chosen profession.
  let setup = { count: 1, names: [''], ages: [null], bots: [null], professionIds: [], length: 'standard' };

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

  /**
   * The player's age band for the practice missions (QA r22 P2, CEO): the age last chosen on the players screen (kept on the
   * device), else the age stored with the saved game's first human player, else none. 'עד 10' plays the junior variant (coins).
   */
  function missionAge() {
    const last = readRaw('lastAge');
    if (last != null) return cleanAge(last);
    return cleanAge(loadSave()?.players.find((p) => !p.bot)?.age);
  }
  const missionJunior = () => missionAge() === JUNIOR_AGE;

  /** A saved mission of the variant `junior` (each variant has its own slot), or null. */
  function loadMission(id = FIRST_ASSET_ID, junior = missionJunior()) {
    if (isShortMission(id)) {
      const m = deserialize(readRaw(practiceSlot(id, { junior })));
      return validShortMission(engine, m, id) && !!m.junior === junior ? m : null;
    }
    try {
      const m = deserialize(readRaw(junior ? `${SLOT_MISSION}.junior` : SLOT_MISSION));
      if (!m || m.daily || !!m.junior !== junior || m.players.length !== 1 || m.currentIndex !== 0 || m.mode !== 'family'
        || m.mission?.id !== FIRST_ASSET_ID
        || !['offer', 'complete', 'declined', 'freeplay'].includes(m.mission.stage)) return null;
      const s = currentState(m);
      if (s.profession?.id !== 'teacher' || !Array.isArray(s.assets) || !Array.isArray(s.liabilities)) return null;
      if (m.mission.stage === 'offer') {
        if (s.pending?.card?.id !== 'opp-biz-006') return null;
        // A malformed scenario must not crash the home screen's resume check.
        firstAssetPurchase(engine, m);
      }
      if (m.mission.stage === 'complete' && ![
        'gross', 'businessPayment', 'assetNet', 'bankLoan', 'bankPayment', 'netChange',
        'beforeFlow', 'afterFlow', 'beforeProgress', 'afterProgress',
      ].every((k) => Number.isFinite(m.mission.feedback?.[k]))) return null;
      return m;
    } catch { return null; }
  }

  /** The mission screens' stylesheet is a lazy chunk (home perf); a failed load still opens the (plainer) screen. */
  const missionStyles = () => loadMissionStyles().catch((err) => console.warn(err));

  async function goMissions() {
    await missionStyles();
    const junior = missionJunior();
    setLearnMode('family'); // the missions run on the family rules: the family vocabulary layer (QA r22 P1)
    setCoinScale(junior); // a junior player reads the chooser in coins (QA r22 P2)
    mount(createMissions({
      saved: (id) => loadMission(id, junior),
      cash: currentState(newShortMission(engine, REPAY_MISSION, { age: missionAge() })).cash,
      completed: [...completedShortMissions(), ...(hasBadge(FIRST_ASSET_BADGE) ? [FIRST_ASSET_ID] : [])],
      onSelect: goMission, onMenu: goStart, onRestart: restartMission,
    }));
  }

  async function restartMission(id) {
    // the game's dialog surface (components.css .dialog): without it the text sat on the scrim, over the chooser (QA r22 axe)
    const layer = openLayer(h('div', { class: 'dialog mission-content' },
      h('h2', null, t('missions.restartTitle')),
      h('p', null, t('missions.restartWarning')),
      h('div', { class: 'mission-actions' },
        button(t('missions.cancelRestart'), { variant: 'secondary', 'data-action': 'cancel-restart', onClick: () => layer.close(false) }),
        button(t('missions.confirmRestart'), { 'data-action': 'confirm-restart', onClick: () => layer.close(true) }),
      ),
    ), { label: t('missions.restartTitle'), cls: 'layer-dialog' });
    if (await layer.closed) goMission(id, { fresh: true });
  }

  async function goMission(id = FIRST_ASSET_ID, { fresh = false } = {}) {
    const short = isShortMission(id);
    const age = missionAge();
    const m = (!fresh && loadMission(id, age === JUNIOR_AGE)) || (short ? newShortMission(engine, id, { age }) : newFirstAsset(engine, { age }));
    if (m.mission.stage === 'freeplay') {
      if (m.status === 'won') goWin(m); else if (m.status === 'lost') goOver(m); else goPlay(m);
      return;
    }
    await missionStyles();
    setLearnMode('family');
    const screen = (short ? createShortMission : createFirstAsset)({
      engine, match: m, store, onMenu: short ? goMissions : goStart, onMissions: goMissions,
      onContinue: (saved) => goPlay(short ? continueShortMission(saved) : continueFirstAsset(saved)),
    });
    mount(screen);
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
    const chSave = loadChallengeSave();
    const start = createStart({
      save: loadSave(),
      challengeSave: chSave ? { name: chSave.challenge.name || '', turn: currentState(chSave).turn } : null,
      onChallengeResume: () => { const m = loadChallengeSave(); if (m) goPlay(m); },
      onBoard: () => goBoard(),
      mode,
      gamesPlayed: gamesPlayed(),
      daily: dailyInfo(),
      onMission: goMissions,
      onDaily: () => goDaily(),
      onDailyReset: () => { resetDay(dayKey()); goStart(); },
      onRefresh: () => goStart(),
      onMode: (m) => { mode = m; writeRaw('mode', m); setLearnMode(m); }, // an age under 14 -> family: the kid vocabulary too (QA r18 P2-2)
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
      count: setup.count, names: setup.names, ages: setup.ages ?? [], bots: setup.bots ?? [], mode, length: setup.length ?? 'standard',
      onMode: (m) => { mode = m; writeRaw('mode', m); setLearnMode(m); }, // an age under 14 -> family: the kid vocabulary too (QA r18 P2-2)
      onBack: () => goStart(),
      onNext: ({ count, names, ages, bots, length }) => {
        setup = { count, names, ages, bots, professionIds: [], length: length ?? 'standard' };
        // the practice missions follow the last chosen age band (QA r22 P2): the first human player's ('' = none given)
        writeRaw('lastAge', ages.find((a, i) => !bots?.[i]) ?? '');
        goPick(0);
      },
    }).el });
  }

  // A bot seat picks no profession on screen: startNew derives one from the match seed and the seat (v0.5, docs/RNG.md),
  // so a seed replays the same table and the bot seat never draws on Math.random.
  function goPick(i) {
    if (i >= setup.count) { startNew(); return; } // the last seats were bots (they sit at the end): every pick is done
    if (setup.bots?.[i]) { setup.professionIds[i] = null; goPick(i + 1); return; }
    setLearnMode(mode); // the pick sheet speaks the mode it shows (family: the children's words, QA r18 P2-2)
    const multi = setup.count > 1;
    const junior = isJuniorSetup(mode, (setup.ages ?? []).map((age) => ({ age })));
    setCoinScale(junior && setup.ages?.[i] === JUNIOR_AGE); // this player's own scale
    mount({ el: createPick({
      engine, mode, junior,
      player: multi ? { name: playerName({ name: setup.names[i] }, i), color: i + 1, n: i + 1, total: setup.count } : null,
      onBack: () => {
        // back to the previous person's pick; bot seats pick nothing on screen (going "back" onto one would bounce forward again)
        let j = i - 1;
        while (j >= 0 && setup.bots?.[j]) j--;
        if (j < 0) goPlayers(); else goPick(j);
      },
      onGo: (professionId) => {
        setup.professionIds[i] = professionId;
        if (i + 1 < setup.count) goPick(i + 1); else startNew();
      },
    }) });
  }

  async function startNew() {
    const seed = nextSeed();
    setup.professionIds = setup.professionIds.map((id, i) => (setup.bots?.[i] ? botProfessionId(seed, i, professionIds) : id));
    const m = newMatch(engine, {
      mode, seed, roundCap: setup.length === 'short' ? SHORT_ROUNDS : null,
      players: setup.professionIds.map((professionId, i) => ({ name: setup.names[i], professionId, age: setup.ages?.[i] ?? null, bot: setup.bots?.[i] ?? null })),
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
    let createPlay;
    try { ({ createPlay } = await loadPlay()); } catch (err) { console.error(err); toast(t('app.loadError'), 4000); return; }
    const play = createPlay({ engine, match: m, nav, store, professionIds, fresh });
    mount({ el: play.el, destroy: () => play.destroy() }, { start: () => play.start() });
  }

  /** Same players, mode and professions, new seed. */
  function again(m) {
    let next = rematch(engine, m, nextSeed());
    // Retrying after a practice freeplay win/loss must not overwrite a
    // separately saved ordinary game.
    if (m.mission?.id === FIRST_ASSET_ID || isShortMission(m.mission?.id)) {
      next = { ...next, mission: { id: m.mission.id, stage: 'freeplay' } };
    }
    goPlay(next, { fresh: true });
  }

  function settingsOf(m) {
    mode = m.mode;
    setup = {
      count: m.players.length,
      names: m.players.map((p, i) => (m.players.length > 1 && !p.bot ? playerName(p, i) : '')),
      ages: m.players.map((p) => p.age ?? null),
      bots: m.players.map((p) => p.bot ?? null),
      professionIds: m.players.map((p) => p.professionId),
      length: m.roundCap ? 'short' : 'standard',
    };
  }

  async function goWin(m) {
    if (m.daily) { finishDaily(m); return; }
    if (m.challenge) { goChallengeEnd(m); return; }
    store.clear(m);
    countGame();
    const multi = isMultiplayer(m);
    setCoinScale(seesCoins(m, m.players[m.winnerIndex ?? 0])); // the winner's own scale
    const win = createWin({
      match: m,
      onAgain: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    }, { onChallenge: challengeHandler(m) });
    mount({ el: win.el }, { start: () => win.start() });
    showInterstitial('win');
  }

  function goOver(m) {
    if (m.daily) { finishDaily(m); return; }
    if (m.challenge) { goChallengeEnd(m); return; }
    store.clear(m);
    countGame();
    const multi = isMultiplayer(m);
    setCoinScale(!multi && seesCoins(m, m.players[0]));
    const over = createOver({
      match: m,
      onRetry: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    }, { onChallenge: challengeHandler(m) });
    mount({ el: over.el }, { start: () => over.start() });
  }

  // ---------- 0.5.1 friend challenges by link ----------
  const chStore = { load: () => loadChallenges(), save: (st) => saveChallenges(st) };
  const professionTitle = (id) => engine.data.professions.find((p) => p.id === id)?.title ?? '';
  const verify = (x) => engine.verifyResult(x);

  /** A challenge game in progress (its own slot), or null. */
  function loadChallengeSave() {
    const m = deserialize(readRaw(SLOT_CHALLENGE));
    const ok = m && m.challenge && typeof m.challenge.log === 'string' && m.status === 'playing' && m.players.length === 1
      && currentState(m).challenge && engine.data.professions.some((x) => x.id === currentState(m).profession?.id);
    return ok ? m : null;
  }

  /** The challenge screens follow the viewer's age band: coins + kid words for 'עד 10' (spec §7). */
  function viewerScale(config) {
    const junior = viewerIsJunior();
    setJuniorView(junior);
    setCoinScale(junior);
    setLearnMode(junior || config?.mode !== 'full' ? 'family' : 'full');
    return junior;
  }

  /** Boot / hashchange: '#c=' or '#r=' in the address. The hash is cleared right after reading (a reload never re-opens it). */
  function openLinkFromHash() {
    const link = parseChallengeHash(location.hash);
    if (!link && !/^#[cr]=/.test(location.hash)) return false;
    try { history.replaceState(null, '', `${location.pathname}${location.search}`); } catch { /* ignore */ }
    if (!link) { goChallengeError({ variant: 'invalid', code: 'FORMAT' }); return true; }
    const save = loadChallengeSave();
    const r = routeChallenge({ link, verify, store: chStore.load(), saveKey: save?.challenge?.key ?? null });
    if (r.screen === 'error') goChallengeError(r);
    else if (r.screen === 'own') { goStart(); toast(ct('intro.ownLink'), 3500); }
    else if (r.screen === 'compare') {
      const now = Date.now();
      chStore.save(upsertEntry(chStore.load(), 'sent', r.key, { them: { link: link.text, name: r.them.log.name ?? '', result: summaryOf(r.them), at: now } }));
      goCompare({ entry: findEntry(chStore.load(), 'sent', r.key), variant: 'reply' });
    } else goChallengeIntro({ ...r, text: link.text }, save);
    return true;
  }
  addEventListener('hashchange', () => { if (/^#[cr]=/.test(location.hash)) openLinkFromHash(); });

  async function goChallengeError({ variant, code }) {
    viewerScale(null);
    const { createChallengeError } = await import('./screens/challenge-intro.js');
    mount(createChallengeError({ variant, code, onHome: () => goStart(), onPlay: () => goPlayers() }));
  }

  async function goChallengeIntro(r, save = loadChallengeSave()) {
    const cfg = r.them.log.config;
    viewerScale(cfg);
    const { createChallengeIntro } = await import('./screens/challenge-intro.js');
    const intro = createChallengeIntro({
      route: r, profession: { id: cfg.professionId, title: professionTitle(cfg.professionId) }, pendingName: save?.challenge?.name ?? '',
      onPlay: () => startChallenge(r),
      onPlayAgain: () => startChallenge(r),
      onContinue: () => { const m = loadChallengeSave(); if (m) goPlay(m); },
      onResult: () => goCompare({ entry: r.entry, variant: 'view' }),
      onLater: () => { rememberReceived(r); goStart(); },
      onAge: (band) => { writeRaw('lastAge', band); goChallengeIntro(r, save); },
    });
    mount(intro, { start: () => intro.start() });
  }

  /** "לא עכשיו" / start: the received challenge is kept (the board shows the creator's verified result anyway). */
  function rememberReceived(r) {
    const log = r.them.log;
    const now = Date.now();
    const st = chStore.load();
    const old = findEntry(st, 'received', r.key);
    const keepMine = old?.them?.link === r.text;
    chStore.save(upsertEntry(st, 'received', r.key, {
      seed: log.seed, config: { mode: log.config.mode, professionId: log.config.professionId, ...(log.config.junior ? { junior: true } : {}) },
      at: now, them: { link: r.text, name: log.name ?? '', result: summaryOf(r.them), at: old?.them?.link === r.text ? old.them.at : now, fresh: r.fresh },
      ...(keepMine ? {} : { me: null }),
    }));
  }

  /** A challenge match on the link's seed and rules (profession, mode and junior locked; the receiver's age only scales the display). */
  async function startChallenge(r) {
    rememberReceived(r);
    const log = r.them.log;
    const cfg = log.config;
    const v = r.them;
    const m = newMatch(engine, {
      mode: cfg.mode, seed: log.seed, junior: !!cfg.junior,
      players: [{ name: '', professionId: cfg.professionId, age: viewerAge() }],
      challenge: {
        log: r.text, name: log.name ?? '', key: r.key, fresh: !!r.fresh,
        target: v.ok && !r.fresh ? { status: v.status, turns: v.turns, freedomPct: v.freedomPct } : null,
      },
    });
    setCoinScale(seesCoins(m, m.players[0]));
    setJuniorView(viewerIsJunior());
    // a brand-new user arriving by link still gets the first family game's story (spec §2.1)
    if (cfg.mode === 'family' && !loadTutorial().storyDone) {
      try {
        const { runFirstGameIntro } = await import('./tutorial/index.js');
        await runFirstGameIntro({ engine, professionId: cfg.professionId });
      } catch (err) { console.error(err); }
    }
    goPlay(m, { fresh: true });
  }

  /** A challenge game ended: my log is replayed next to theirs, stored, and compare replaces win / over. */
  function goChallengeEnd(m) {
    store.clear(m);
    countGame();
    const s = currentState(m);
    const mine = encodeActionLog(linkLogOf(s));
    const me = verify(mine);
    const them = verify(m.challenge.log);
    const now = Date.now();
    const st = chStore.load();
    chStore.save(upsertEntry(st, 'received', m.challenge.key, {
      seed: s.seed, config: { mode: s.mode, professionId: s.profession.id, ...(s.junior ? { junior: true } : {}) }, at: now,
      me: { link: mine, result: summaryOf(me), at: now },
      them: { link: m.challenge.log, name: m.challenge.name ?? '', result: summaryOf(them), at: findEntry(st, 'received', m.challenge.key)?.them?.at ?? now, fresh: !!m.challenge.fresh },
    }));
    goCompare({ entry: findEntry(chStore.load(), 'received', m.challenge.key), variant: 'end' });
    showInterstitial(s.status === 'won' ? 'win' : 'over');
  }

  /** Compare from a stored entry: both sides re-verified from their link texts (nothing stored is trusted). */
  async function goCompare({ entry, variant }) {
    if (!entry?.me?.link) { goStart(); return; }
    const me = verify(entry.me.link);
    const them = entry.them?.link ? verify(entry.them.link) : null;
    viewerScale(entry.config);
    const { createCompare } = await import('./screens/compare.js');
    const themName = entry.them?.name ?? '';
    const cmp = createCompare({
      engine, me, them, themName, professionId: entry.config?.professionId ?? me.professionId, variant,
      onHome: () => goStart(),
      onBoard: () => goBoard(),
      onReplay: (turn) => goTimeline({ entry, me, them, themName, turn, back: () => goCompare({ entry: findEntry(chStore.load(), entry.role, entry.key) ?? entry, variant }) }),
      onReply: () => openReply(entry, me, them),
      onPlaySame: () => startChallenge({ them, key: entry.key, text: entry.them.link, fresh: false, verified: !!them?.ok }),
      onNewChallenge: () => goPlayers(),
    });
    mount(cmp, { start: () => cmp.start() });
  }

  async function goTimeline({ me, them, themName, turn, back, entry }) {
    const { createTimeline } = await import('./screens/timeline.js');
    const tl = createTimeline({ engine, me, them, themName, professionId: entry.config?.professionId ?? me.professionId, focusTurn: turn, onBack: back });
    mount(tl, { start: () => tl.start() });
  }

  async function goBoard() {
    viewerScale({ mode: 'family' });
    const { createFamilyBoard } = await import('./screens/family-board.js');
    const st = chStore.load();
    mount(createFamilyBoard({
      store: st, professionTitle,
      onRow: (row) => { const e = findEntry(chStore.load(), row.role, row.key); if (e?.me?.link && e.them?.link) goCompare({ entry: e, variant: 'view' }); },
      onHome: () => goStart(),
      onStart: () => goStart(),
    }));
  }

  /** "שלחו את התוצאה שלכם": my log as a reply link (#r=), with my optional name. */
  async function openReply(entry, me, them) {
    const { openShareSheet } = await import('./challenge/share-sheet.js');
    const base = me.log;
    const fresh = !them?.ok || !!them.empty || !them.comparable;
    const build = (name) => {
      const text = encodeActionLog({ ...base, ...(name ? { name } : {}) });
      return { text: shareMessage({ kind: 'reply', fresh, result: me, name, config: base.config, url: linkUrl(text, 'r') }), link: text };
    };
    openShareSheet({
      build,
      onSend: (name, built) => chStore.save(upsertEntry(chStore.load(), entry.role, entry.key, { me: { sentLink: built.link, name } })),
    });
  }

  /** The end screen's "שלחו אתגר" for a game that can send one (null otherwise: the v3.1 layout stays). */
  function challengeHandler(m) {
    let kind = false;
    try { kind = challengeEligibility(engine, m); } catch (err) { console.error(err); }
    if (!kind) return null;
    return async () => {
      const s = currentState(m);
      // a very busy game whose URL would pass LINK_MAX goes out as the seed-only "new challenge" (QA 0.5.1 P2-4)
      kind = guardLinkKind(kind, (k) => linkUrl(encodeActionLog(linkLogOf(s, { kind: k, name: LONGEST_NAME })), 'c'));
      const junior = seesCoins(m, m.players[0]) || viewerIsJunior();
      setJuniorView(junior);
      const { openShareSheet } = await import('./challenge/share-sheet.js');
      const full = encodeActionLog(linkLogOf(s));
      const me = verify(full);
      const config = configOf(s);
      const build = (name) => {
        const text = encodeActionLog(linkLogOf(s, { kind, name }));
        return { text: shareMessage({ kind: 'invite', fresh: kind === 'fresh', result: me, name, config, url: linkUrl(text, 'c') }), link: text };
      };
      openShareSheet({
        build, fresh: kind === 'fresh',
        onSend: (name, built) => {
          const now = Date.now();
          chStore.save(upsertEntry(chStore.load(), 'sent', challengeKey({ seed: s.seed, config }), {
            seed: s.seed, config: { mode: s.mode, professionId: s.profession.id, ...(s.junior ? { junior: true } : {}) }, at: now,
            me: { link: full, sentLink: built.link, name, result: summaryOf(me), at: now, fresh: kind === 'fresh' },
          }));
        },
      });
    };
  }

  return { start: () => { if (!openLinkFromHash()) goStart(); }, engine, data, h };
}
