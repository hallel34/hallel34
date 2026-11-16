// 0.5.1 friend challenges by link: the app-shell side (routing a link, the intro, the challenge match, compare, the replay, the
// family board, the share sheets). One lazy chunk with the strings (QA 0.5.1 P2-3): home never loads it, so the engine's
// verifier and the action-log codec stay out of the main bundle too. `ctx` carries the shell's own navigation.
import { ensureStrings } from '../../i18n/index.js';
import { ensureRanks } from '../ranks.js';
import { toast } from '../fx.js';
import { setCoinScale } from '../format.js';
import { setLearnMode } from '../../learn/context.js';
import { loadTutorial } from '../../learn/tutorial-store.js';
import { showInterstitial } from '../../services/ads.js';
import { writeRaw } from '../../services/storage.js';
import { newMatch, seesCoins, currentState } from '../../engine/index.js';
import { encodeActionLog } from '../../engine/actionlog.js';
import { verifyResult, challengeEligibility, linkLogOf, configOf, challengeKey } from '../../engine/challenge.js';
import { loadChallenges, saveChallenges, upsertEntry, findEntry, summaryOf } from '../../services/challenge-store.js';
import { parseChallengeHash, routeChallenge, guardLinkKind, LONGEST_NAME } from '../../services/challenge-route.js';
import { setJuniorView, viewerAge, viewerIsJunior, ct, linkUrl, shareMessage } from './copy.js';

/**
 * @param ctx { engine, mount, goStart, goPlay, goPlayers, store, countGame, loadChallengeSave }
 * @returns { routeLink(hash), end(match), board(), openCreate(match), ready() }
 */
/** The part of a link's config a stored challenge keeps (its identity: seed + these). */
const storedConfig = (c) => ({ mode: c.mode, professionId: c.professionId, ...(c.junior ? { junior: true } : {}), ...(c.rank > 0 ? { rank: c.rank } : {}), ...(c.promotion ? { promotion: true } : {}) });

export function createChallengeFlow(ctx) {
  const { engine, mount, goStart, goPlay, goPlayers, store, countGame, loadChallengeSave } = ctx;
  engine.verifyResult ??= (x) => verifyResult(engine, x); // the main-bundle engine has no verifier until this chunk loads
  const chStore = { load: () => loadChallenges(), save: (st) => saveChallenges(st) };
  // a ranked link replays and plays with its rank's figures: the rank data loads with the strings (0.5.0)
  const challengeStrings = () => Promise.all([ensureStrings('challenge'), ensureRanks(engine)]).catch((err) => console.error(err));
  const professionTitle = (id) => engine.data.professions.find((p) => p.id === id)?.title ?? '';
  const verify = (x) => verifyResult(engine, x);

  /** The challenge screens follow the viewer's age band: coins + kid words for 'עד 10' (spec §7). */
  function viewerScale(config) {
    const junior = viewerIsJunior();
    setJuniorView(junior);
    setCoinScale(junior);
    setLearnMode(junior || config?.mode !== 'full' ? 'family' : 'full');
    return junior;
  }

  async function routeLink(hash) {
    await challengeStrings();
    const link = parseChallengeHash(hash);
    if (!link) { goChallengeError({ variant: 'invalid', code: 'FORMAT' }); return; }
    const save = loadChallengeSave();
    const r = routeChallenge({ link, verify, store: chStore.load(), saveKey: save?.challenge?.key ?? null });
    if (r.screen === 'error') goChallengeError(r);
    else if (r.screen === 'own') { goStart(); toast(ct('intro.ownLink'), 3500); }
    else if (r.screen === 'compare') {
      const now = Date.now();
      chStore.save(upsertEntry(chStore.load(), 'sent', r.key, { them: { link: link.text, name: r.them.log.name ?? '', result: summaryOf(r.them), at: now } }));
      goCompare({ entry: findEntry(chStore.load(), 'sent', r.key), variant: 'reply' });
    } else goChallengeIntro({ ...r, text: link.text }, save);
  }
  async function goChallengeError({ variant, code }) {
    await challengeStrings();
    viewerScale(null);
    const { createChallengeError } = await import('../screens/challenge-intro.js');
    mount(createChallengeError({ variant, code, onHome: () => goStart(), onPlay: () => goPlayers() }));
  }

  async function goChallengeIntro(r, save = loadChallengeSave()) {
    await challengeStrings();
    const cfg = r.them.log.config;
    viewerScale(cfg);
    const { createChallengeIntro } = await import('../screens/challenge-intro.js');
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
      seed: log.seed, config: storedConfig(log.config),
      at: now, them: { link: r.text, name: log.name ?? '', result: summaryOf(r.them), at: old?.them?.link === r.text ? old.them.at : now, fresh: r.fresh },
      ...(keepMine ? {} : { me: null }),
    }));
  }

  /** A challenge match on the link's seed and rules (profession, mode and junior locked; the receiver's age only scales the display). */
  async function startChallenge(r) {
    await challengeStrings();
    rememberReceived(r);
    const log = r.them.log;
    const cfg = log.config;
    const v = r.them;
    const m = newMatch(engine, {
      mode: cfg.mode, seed: log.seed, junior: !!cfg.junior,
      players: [{ name: '', professionId: cfg.professionId, age: viewerAge(), rank: cfg.rank ?? 0 }], // a ranked link: both friends play the same rank
      promotion: !!cfg.promotion,
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
        const { runFirstGameIntro } = await import('../tutorial/index.js');
        await runFirstGameIntro({ engine, professionId: cfg.professionId });
      } catch (err) { console.error(err); }
    }
    goPlay(m, { fresh: true });
  }

  /** A challenge game ended: my log is replayed next to theirs, stored, and compare replaces win / over. */
  async function goChallengeEnd(m) {
    await challengeStrings();
    store.clear(m);
    countGame();
    const s = currentState(m);
    const mine = encodeActionLog(linkLogOf(s));
    const me = verify(mine);
    const them = verify(m.challenge.log);
    const now = Date.now();
    const st = chStore.load();
    chStore.save(upsertEntry(st, 'received', m.challenge.key, {
      seed: s.seed, config: storedConfig(configOf(s)), at: now,
      me: { link: mine, result: summaryOf(me), at: now },
      them: { link: m.challenge.log, name: m.challenge.name ?? '', result: summaryOf(them), at: findEntry(st, 'received', m.challenge.key)?.them?.at ?? now, fresh: !!m.challenge.fresh },
    }));
    goCompare({ entry: findEntry(chStore.load(), 'received', m.challenge.key), variant: 'end' });
    showInterstitial(s.status === 'won' ? 'win' : 'over');
  }

  /** Compare from a stored entry: both sides re-verified from their link texts (nothing stored is trusted). */
  async function goCompare({ entry, variant }) {
    await challengeStrings();
    if (!entry?.me?.link) { goStart(); return; }
    const me = verify(entry.me.link);
    const them = entry.them?.link ? verify(entry.them.link) : null;
    viewerScale(entry.config);
    const { createCompare } = await import('../screens/compare.js');
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
    await challengeStrings();
    const { createTimeline } = await import('../screens/timeline.js');
    const tl = createTimeline({ engine, me, them, themName, professionId: entry.config?.professionId ?? me.professionId, focusTurn: turn, onBack: back });
    mount(tl, { start: () => tl.start() });
  }

  async function goBoard() {
    await challengeStrings();
    viewerScale({ mode: 'family' });
    const { createFamilyBoard } = await import('../screens/family-board.js');
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
    await challengeStrings();
    const { openShareSheet } = await import('./share-sheet.js');
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
  async function openCreate(m) {
    await challengeStrings();
    let kind = false;
    try { kind = challengeEligibility(engine, m); } catch (err) { console.error(err); }
    if (!kind) return;
    {
      const s = currentState(m);
      // a very busy game whose URL would pass LINK_MAX goes out as the seed-only "new challenge" (QA 0.5.1 P2-4)
      kind = guardLinkKind(kind, (k) => linkUrl(encodeActionLog(linkLogOf(s, { kind: k, name: LONGEST_NAME })), 'c'));
      const junior = seesCoins(m, m.players[0]) || viewerIsJunior();
      setJuniorView(junior);
      const { openShareSheet } = await import('./share-sheet.js');
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
            seed: s.seed, config: storedConfig(configOf(s)), at: now,
            me: { link: full, sentLink: built.link, name, result: summaryOf(me), at: now, fresh: kind === 'fresh' },
          }));
        },
      });
    }
  }


  return { routeLink, end: goChallengeEnd, board: goBoard, openCreate, ready: challengeStrings };
}
