// App shell: screen routing, persistence (save/resume), engine wiring.
import { h, clear } from './dom.js';
import { createEngine, serialize, deserialize } from '../engine/index.js';
import { loadData } from '../data/index.js';
import { readRaw, writeRaw, remove } from '../services/storage.js';
import { createStart } from './screens/start.js';
import { createPick } from './screens/pick.js';
import { createPlay } from './play.js';
import { createWin, createOver } from './screens/end.js';
import { showInterstitial } from '../services/ads.js';
import { getLocale } from '../i18n/index.js';

export function createApp(host) {
  const data = loadData(getLocale());
  const engine = createEngine(data);
  const professionIds = data.professions.map((p) => p.id);
  let active = null;
  let mode = readRaw('mode') === 'full' ? 'full' : 'family';
  let last = { mode, professionId: null };

  const store = {
    save: (s) => writeRaw('save', serialize(s)),
    clear: () => remove('save'),
  };

  function loadSave() {
    const raw = readRaw('save');
    if (!raw) return null;
    const s = deserialize(raw);
    if (!s || s.status !== 'playing' || !engine.data.professions.some((p) => p.id === s.profession?.id)) return null;
    return s;
  }

  function mount(screen, { start } = {}) {
    active?.destroy?.();
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
      onPlay: (m) => { mode = m; writeRaw('mode', m); goPick(); },
      onResume: () => { const s = loadSave(); if (s) goPlay(s); },
    });
    mount(start, { start: () => start.start() });
  }

  function goPick() {
    mount({ el: createPick({
      engine, mode,
      onBack: () => goStart(),
      onGo: (professionId) => startNew(mode, professionId),
    }) });
  }

  function startNew(m, professionId) {
    last = { mode: m, professionId };
    const s = engine.newGame({ mode: m, professionId, seed: nextSeed() });
    store.save(s);
    goPlay(s);
  }

  function goPlay(s) {
    const play = createPlay({ engine, state: s, nav, store, professionIds });
    mount({ el: play.el, destroy: () => play.destroy() }, { start: () => play.start() });
  }

  async function goWin(s) {
    store.clear();
    countGame();
    const win = createWin({ state: s, onAgain: () => goStart() });
    mount({ el: win.el }, { start: () => win.start() });
    showInterstitial('win');
  }

  function goOver(s) {
    store.clear();
    countGame();
    const over = createOver({
      state: s,
      onRetry: () => startNew(s.mode, s.profession.id),
      onMenu: () => goStart(),
    });
    mount({ el: over.el }, { start: () => over.start() });
  }

  return { start: goStart, engine, data, last: () => last, h };
}
