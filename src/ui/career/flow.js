// 0.5.0 career flow: one lazy chunk (with the career strings and styles) that the app shell loads on demand: the weekly settling on
// launch and its return screen, the profile / picker / edit screens, the end-of-game block and rank-up after a finished game.
// Home never loads it (it reads the active profile from the device store itself, src/career/lite.js).
import { ensureCareerStrings as ensureStringsOnly } from '../../i18n/index.js';
import { ensureRanks } from '../ranks.js';
import { toast } from '../fx.js';
import { setCoinScale } from '../format.js';
import { setLearnMode } from '../../learn/context.js';
import { dayKey } from '../../daily/calendar.js';
import { currentState } from '../../engine/index.js';
import { activeProfile, withProfile, removeProfile, setActive, setAge, editProfile, isProtectedAge, recordOf } from '../../career/career.js';
import { finishGame } from '../../career/finish.js';
import { loadCareer, saveCareer, syncActive, addProfile, updateCareer } from '../../career/store.js';
import { setCareerJunior, t } from './copy.js';
import {
  createReturnScreen, createProfileScreen, createPicker, openEditSheet, openAchievementSheet, createEndBlock, createCreatePrompt, openRankUp,
} from './screens.js';

export function createCareerFlow(ctx) {
  const { engine, mount, goStart, goPlayers } = ctx;
  /** The career strings and the rank data (titles, figures) load together. */
  const ensureCareerStrings = () => Promise.all([ensureStringsOnly(), ensureRanks(engine)]);
  let pickedThisSession = false;
  const professionIds = engine.data.professions.map((p) => p.id);

  /** Words and coins for a protected / junior profile (up to 10), the plain ones otherwise. */
  function speak(profile) {
    const kid = !!profile && isProtectedAge(profile.age);
    setCareerJunior(kid);
    setCoinScale(profile?.age === 'upTo10');
    setLearnMode(profile && profile.age === '14plus' ? 'full' : 'family');
    return kid;
  }

  // ---------- launch ----------
  /** Settles the weeks that ended; shows the picker (two or more profiles) or the return screen. Resolves true when it showed a screen. */
  async function boot() {
    await ensureCareerStrings();
    const today = dayKey();
    const before = activeProfile(loadCareer());
    if (!before) return false;
    const { career, profile, events } = syncActive(today);
    if (career.profiles.length >= 2 && !pickedThisSession) { pickedThisSession = true; openPicker(events.length ? { events, before, after: profile } : null); return true; }
    pickedThisSession = true;
    if (events.length) { showReturn({ events, before, after: profile }); return true; }
    return false;
  }

  function showReturn({ events, before, after }) {
    speak(after);
    mount(createReturnScreen({ engine, events, before, after, today: dayKey(), onPlay: () => goPlayers(), onHome: () => goStart() }));
  }

  // ---------- the picker ----------
  function openPicker(pendingReturn = null) {
    const career = loadCareer();
    speak(activeProfile(career));
    mount(createPicker({
      engine, career,
      onSelect: (id) => {
        updateCareer((c) => setActive(c, id));
        const picked = activeProfile(loadCareer());
        if (pendingReturn && picked?.id === pendingReturn.after?.id) showReturn(pendingReturn); else goStart();
      },
      onAdd: () => createProfileSheet(() => openPicker(pendingReturn)),
      onClose: () => goStart(),
    }));
  }

  // ---------- the profile ----------
  function openProfile({ focusAchievement = null } = {}) {
    const career = loadCareer();
    const profile = activeProfile(career);
    if (!profile) { createProfileSheet(() => openProfile()); return; }
    speak(profile);
    const screen = createProfileScreen({
      engine, career, profile, today: dayKey(), focusAchievement,
      onBack: () => goStart(),
      onEdit: () => editSheet(profile),
      onSwitch: () => openPicker(),
      onAchievement: (a, earnedOn, variant) => openAchievementSheet({ a, earnedOn, variant }),
    });
    mount(screen, { start: () => screen.start?.() });
  }

  function editSheet(profile) {
    openEditSheet({
      engine, profile,
      onSave: ({ name, age, fox }) => {
        const today = dayKey();
        updateCareer((c) => {
          let p = c.profiles.find((x) => x.id === profile.id);
          p = editProfile(p, { name, fox });
          if (age && age !== p.age) p = setAge(p, age, today).profile; // age edits are free; growing out of the guard gets a grace week
          return withProfile(c, p);
        });
        openProfile();
      },
      onDelete: () => { updateCareer((c) => removeProfile(c, profile.id)); goStart(); },
    });
  }

  function createProfileSheet(done, { onCreated = null } = {}) {
    openEditSheet({
      engine, profile: null,
      onSave: ({ name, age, fox }) => {
        const out = addProfile({ name, age, fox }, dayKey());
        if (out.profile) onCreated?.(out.profile);
        done?.(out.profile);
      },
    });
  }

  /** One dialog for the rank reached, even when the game raised several ranks at once (spec 3.3). */
  async function showRankUps(rankUps, win, kid) {
    if (!rankUps.length) return;
    const first = rankUps[0];
    const last = rankUps[rankUps.length - 1];
    await openRankUp({ engine, up: { professionId: last.professionId, from: first.from, to: last.to }, win, kid });
  }

  // ---------- after a finished game ----------
  /**
   * The career part of a finished single-player game: { el, run } for the end card (the block, or the "save your progress" prompt on a
   * device without a profile), or null when the game does not count. The game is credited here, once.
   */
  async function afterGame(m) {
    if (!m || m.players.length !== 1 || m.players[0].bot || m.daily || m.mission) return null;
    const state = currentState(m);
    if (!recordOf(state)) return null;
    await ensureCareerStrings();
    const today = dayKey();
    const profile = activeProfile(loadCareer());
    const win = m.status === 'won';
    if (!profile) {
      setCareerJunior(false);
      const holder = { el: null, run: null };
      const el = createCreatePrompt({
        onCreate: () => createProfileSheet(null, { onCreated: (created) => {
          // the first game counts for the new profile: credit it and swap the prompt for the block
          const res = finishGame({ engine, profile: created, state, today });
          if (!res) return;
          updateCareer((c) => withProfile(c, res.profile));
          const kid = speak(res.profile);
          const block = createEndBlock({ engine, res, before: created, kid, onAchievement: (a, earnedOn, variant) => openAchievementSheet({ a, earnedOn, variant }) });
          holder.el.replaceWith(block.el);
          holder.el = block.el;
          block.run().then(() => showRankUps(res.rankUps, win, kid));
        } }),
      });
      holder.el = el;
      return { el, run: () => {}, prompt: true };
    }
    const res = finishGame({ engine, profile, state, today, professionIds });
    if (!res) return null;
    updateCareer((c) => withProfile(c, res.profile));
    const kid = speak(res.profile);
    const block = createEndBlock({ engine, res, before: profile, kid, onAchievement: (a, earnedOn, variant) => openAchievementSheet({ a, earnedOn, variant }) });
    return { el: block.el, res, run: async () => { await block.run(); await showRankUps(res.rankUps, win, kid); } };
  }

  /** A friend-challenge game gives XP and keeps seniority, with one line (no career block on the compare screen). */
  async function afterChallenge(m) {
    const profile = activeProfile(loadCareer());
    if (!profile || !m || m.players.length !== 1) return;
    const state = currentState(m);
    const res = finishGame({ engine, profile, state, today: dayKey(), professionIds });
    if (!res) return;
    updateCareer((c) => withProfile(c, res.profile));
    await ensureCareerStrings();
    speak(res.profile);
    toast(t('career.endBlock.toast', { xp: res.xp.game + res.xp.achievements }), 3500);
  }

  return { boot, openProfile, openPicker, afterGame, afterChallenge, ready: ensureCareerStrings };
}
