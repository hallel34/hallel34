// App shell: screen routing, persistence (save/resume), engine wiring.
import { h, clear } from './dom.js';
import { createEngine, serialize, deserialize, newMatch, rematch, isMultiplayer } from '../engine/index.js';
import { loadData } from '../data/index.js';
import { readRaw, writeRaw, remove } from '../services/storage.js';
import { createStart } from './screens/start.js';
import { createPick } from './screens/pick.js';
import { createPlayers } from './screens/players.js';
import { playerName } from './players.js';
import { createPlay } from './play.js';
import { createWin, createOver } from './screens/end.js';
import { showInterstitial } from '../services/ads.js';
import { getLocale } from '../i18n/index.js';
import { destroyAllLayers } from './modal.js';

export function createApp(host) {
  const data = loadData(getLocale());
  const engine = createEngine(data);
  const professionIds = data.professions.map((p) => p.id);
  let active = null;
  let mode = readRaw('mode') === 'full' ? 'full' : 'family';
  // Hot-seat setup being built: count, names, and each player's chosen profession.
  let setup = { count: 1, names: [''], professionIds: [] };

  const store = {
    save: (s) => writeRaw('save', serialize(s)),
    clear: () => remove('save'),
  };

  function loadSave() {
    const raw = readRaw('save');
    if (!raw) return null;
    const m = deserialize(raw);
    if (!m || !['playing', 'lost', 'won'].includes(m.status) || !m.players.every((p) => engine.data.professions.some((x) => x.id === p.state.profession?.id))) return null;
    return m;
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
    win: (s) => goWin(s),
    over: (s) => goOver(s),
  };

  const gamesPlayed = () => Math.max(0, parseInt(readRaw('gamesPlayed') || '0', 10) || 0);
  const countGame = () => writeRaw('gamesPlayed', String(gamesPlayed() + 1));

  function goStart() {
    const start = createStart({
      save: loadSave(),
      mode,
      gamesPlayed: gamesPlayed(),
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
    mount({ el: createPlayers({
      count: setup.count, names: setup.names,
      onBack: () => goStart(),
      onNext: ({ count, names }) => { setup = { count, names, professionIds: [] }; goPick(0); },
    }).el });
  }

  function goPick(i) {
    const multi = setup.count > 1;
    mount({ el: createPick({
      engine, mode,
      player: multi ? { name: playerName({ name: setup.names[i] }, i), color: i + 1, n: i + 1, total: setup.count } : null,
      onBack: () => (i === 0 ? goPlayers() : goPick(i - 1)),
      onGo: (professionId) => {
        setup.professionIds[i] = professionId;
        if (i + 1 < setup.count) goPick(i + 1); else startNew();
      },
    }) });
  }

  function startNew() {
    const m = newMatch(engine, {
      mode, seed: nextSeed(),
      players: setup.professionIds.map((professionId, i) => ({ name: setup.names[i], professionId })),
    });
    goPlay(m);
  }

  function goPlay(m, { fresh = false } = {}) {
    store.save(m);
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
      professionIds: m.players.map((p) => p.professionId),
    };
  }

  async function goWin(m) {
    store.clear();
    countGame();
    const multi = isMultiplayer(m);
    const win = createWin({
      match: m,
      onAgain: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    });
    mount({ el: win.el }, { start: () => win.start() });
    showInterstitial('win');
  }

  function goOver(m) {
    store.clear();
    countGame();
    const multi = isMultiplayer(m);
    const over = createOver({
      match: m,
      onRetry: () => again(m),
      onMenu: () => { if (multi) { settingsOf(m); goPlayers(); } else goStart(); },
    });
    mount({ el: over.el }, { start: () => over.start() });
  }

  return { start: goStart, engine, data, h };
}
