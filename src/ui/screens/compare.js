// 0.5.1 compare screen (spec §4): a challenge game ends here instead of win / over. Both logs are replayed (verifyResult);
// the key row (turns) carries the only better/worse mark; deals and loans are facts. Maxi's crop + the educator's takeaway.
// Lazy chunk (import('./screens/compare.js')), loaded at the game's end.
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { button, fitText } from '../widgets.js';
import { confetti, haptic, sound, animate, countUp, toast } from '../fx.js';
import { motionOK } from '../prefs.js';
import { foxImg } from '../fox.js';
import { money, tn } from '../format.js';
import { professionBust } from '../professions.js';
import { replayTurns, splitTurns, takeawayOf, compareOutcome } from '../../engine/index.js';
import { yearsPhrase } from '../../learn/slots.js';
import { ct, ckey, isJuniorView, themPhrase } from '../challenge/copy.js';
import { badge } from './challenge-intro.js';

const MONEY_SLOTS = new Set(['amount', 'monthly', 'monthlyAbs', 'monthlyPayment', 'perSummary']);

/** A takeaway line ({ key, params } from takeawayOf) as nodes: money through money(), years through plural.years. */
export function takeawayNodes(line, themName) {
  const params = { them: themPhrase(themName) };
  for (const [k, v] of Object.entries(line.params)) params[k] = MONEY_SLOTS.has(k) ? money(v) : k === 'years' ? yearsPhrase(v) : String(v);
  return tn(ckey(`takeaway.${line.key}`), params);
}

/** Both sides' timelines and the split rows (null when either log does not replay). */
export function pairRows(engine, mine, theirs) {
  try {
    return splitTurns(replayTurns(engine, mine.log).turns, replayTurns(engine, theirs.log).turns);
  } catch { return null; }
}

/**
 * @param engine
 * @param me        verifyResult of my log (always verified: it replays locally)
 * @param them      verifyResult of their log, or null
 * @param themName  their display name ('' = from the link)
 * @param professionId
 * @param variant   'end' (my challenge game just ended) | 'reply' (a reply to my challenge arrived) | 'view' (from the board)
 * @param handlers  { onReply, onReplay(turn), onBoard, onHome, onPlaySame, onNewChallenge }
 */
export function createCompare({ engine, me, them, themName = '', professionId, variant = 'end', onReply, onReplay, onBoard, onHome, onPlaySame, onNewChallenge }) {
  const junior = isJuniorView();
  const theirFresh = !them || (them.ok && (them.empty || !them.comparable));
  const myFresh = me.ok && !me.comparable; // my own game was not comparable (the bonus die / a reroll)
  const theirOk = !!them?.ok && !theirFresh;
  const outcome = myFresh ? null : compareOutcome(me, them);
  const singleColumn = variant === 'end' && theirFresh;
  const rows = theirOk && !myFresh ? pairRows(engine, me, them) : null;
  const lines = rows && outcome !== null ? takeawayOf(rows, { verified: true, mode: me.mode }) : [];
  const themLabel = themName || ct('compare.themAnon');

  // ---- headline + sub (copy rule; no winner when either side is not verified) ----
  let head; let sub;
  if (variant !== 'end' && myFresh) { head = ct('compare.headlineReplyFresh'); sub = ct('compare.subReplyFresh'); }
  else if (singleColumn) { head = ct('compare.headlineFresh'); sub = ct('compare.subFresh'); }
  else if (outcome === 'you') { head = ct(me.status === 'won' ? 'compare.headlineYouAheadWin' : 'compare.headlineYouAheadProgress'); sub = ct('compare.subYouAhead'); }
  else if (outcome === 'them') { head = ct(them.status === 'won' ? 'compare.headlineThemAheadWin' : 'compare.headlineThemAheadProgress', { them: themPhrase(themName) }); sub = ct('compare.subThemAhead'); }
  else if (outcome === 'tie') { head = ct('compare.headlineTie'); sub = ct('compare.subTie'); }
  else { head = ct('compare.headlineUnverified'); sub = ct('compare.subUnverified'); }

  // ---- the grid ----
  const cell = (v, side, { key = false, ahead = false, muted = false } = {}) => h('div', { class: `cmp-val${key ? ' is-key' : ''}${ahead ? ' is-ahead' : ''}${muted ? ' is-muted' : ''}`, 'data-side': side },
    ahead ? icon('check', { size: 16, width: 3 }) : null, v);
  const num = (n) => h('bdi', { dir: 'ltr', class: 'cmp-num' }, String(n));
  const sideOk = (side) => (side === 'you' ? me.ok : theirOk || (them?.ok && !theirFresh));
  const value = (r, side, what) => {
    if (!r || (side === 'them' && (theirFresh || !them?.ok) && them?.code === 'REPLAY')) return num('?');
    if (side === 'them' && theirFresh) return num('—');
    if (what === 'turns') return r.status === 'won' ? num(r.turns) : h('span', { class: 'cmp-word' }, ct('compare.notReached'));
    if (what === 'freedom') return h('div', { class: 'cmp-freedom' }, num(`${Math.min(100, r.freedomPct ?? 0)}%`), h('div', { class: 'ch-meter', 'aria-hidden': 'true' }, h('i', { style: `inline-size:${Math.min(100, r.freedomPct ?? 0)}%` })));
    if (what === 'deals') return num(r.stats?.dealsBought ?? 0);
    const n = r.stats?.loansTaken ?? 0;
    if (!n) return h('span', { class: 'cmp-loans' }, num('—'), h('span', { class: 'cmp-small' }, ct('compare.loansNone')));
    return h('span', { class: 'cmp-loans' }, num(n), junior ? null : h('span', { class: 'cmp-small' }, money(r.stats.loanTotal ?? 0)));
  };
  const helpBtn = h('button', { type: 'button', class: 'cmp-label cmp-label-btn', 'data-action': 'freedom-help', 'aria-describedby': 'cmp-freedom-help', onClick: () => toast(ct('compare.freedomHelp'), 3500) }, ct('compare.freedom'));
  const labels = { turns: ct('compare.turns'), freedom: helpBtn, deals: ct('compare.deals'), loans: ct('compare.loans') };
  const head2 = (side) => h('div', { class: 'cmp-head', 'data-side': side },
    h('span', { class: 'cmp-avatar', 'aria-hidden': 'true' }, professionBust(professionId)),
    h('span', { class: 'cmp-name' }, side === 'you' ? ct('compare.you') : themLabel),
    side === 'you' || !theirFresh ? badge(sideOk(side), { sm: true }) : null);
  const keyVals = [];
  const grid = h('div', { class: `cmp-grid${singleColumn ? ' is-single' : ''}` },
    h('div', { class: 'cmp-row cmp-heads' }, head2('you'), h('span', { class: 'cmp-vs', 'aria-hidden': 'true' }, singleColumn ? '' : ct('compare.vs')), singleColumn ? h('span') : head2('them')),
    ...['turns', 'freedom', 'deals', 'loans'].map((what) => {
      const key = what === 'turns';
      const youCell = cell(value(me, 'you', what), 'you', { key, ahead: key && outcome === 'you' });
      const themCell = singleColumn ? h('span') : cell(value(them, 'them', what), 'them', { key, ahead: key && outcome === 'them', muted: !theirOk });
      if (key) keyVals.push(youCell, themCell);
      return h('div', { class: `cmp-row${key ? ' cmp-key' : ''}`, 'data-row': what },
        youCell, h('div', { class: 'cmp-label-cell' }, typeof labels[what] === 'string' ? h('span', { class: 'cmp-label' }, junior ? ct(`compare.${what}`) : labels[what]) : labels[what]), themCell);
    }),
    h('span', { class: 'vh', id: 'cmp-freedom-help' }, ct('compare.freedomHelp')));
  grid.querySelectorAll('.cmp-num').forEach((n) => fitText(n, { minScale: 0.7 }));

  // ---- Maxi + takeaway (no takeaway when either side is not verified; never more than 2 lines) ----
  const pose = outcome === 'you' ? 'celebrate' : outcome === 'them' ? 'think' : 'ponder';
  const bubble = h('div', { class: 'cmp-bubble', role: 'status', 'data-takeaway': lines.map((l) => l.key).join(',') },
    lines.length
      ? lines.map((l) => h('p', { class: 'cmp-take' }, takeawayNodes(l, themName)))
      : h('p', { class: 'cmp-take' }, ct('compare.simplification')));
  if (lines.length && onReplay) {
    bubble.classList.add('is-link');
    bubble.addEventListener('click', () => onReplay(lines[0].turn));
  }
  const maxi = h('div', { class: 'cmp-maxi' }, foxImg(pose, { size: 52, cls: 'cmp-crop' }), bubble);
  const unverifiedNote = them && !them.ok && !theirFresh ? h('p', { class: 'cmp-note', 'data-unverified-note': '' }, icon('unverified', { size: 20, width: 2 }), h('span', null, `${ct('compare.unverifiedText')} ${ct('compare.unverifiedBoard')}`)) : null;
  const simpl = lines.length ? h('p', { class: 'cmp-simpl' }, ct('compare.simplification')) : null;

  // ---- footer: one gold primary; home is the X ----
  const replayBtn = button([icon('replay', { size: 20, width: 2 }), ct('compare.btnReplay')], { variant: 'secondary', 'data-action': 'ch-replay', disabled: !rows, onClick: () => onReplay?.(null) });
  const boardBtn = button([icon('familyBoard', { size: 20, width: 2 }), ct('compare.btnBoard')], { variant: 'secondary', 'data-action': 'ch-board', onClick: () => onBoard?.() });
  let primary; let ghosts;
  if (variant !== 'end' && myFresh) {
    primary = button(ct('compare.btnPlaySame'), { variant: 'primary', size: 'lg', 'data-action': 'ch-play-same', onClick: () => { haptic('tap'); onPlaySame?.(); } });
    ghosts = [boardBtn];
  } else if (variant === 'end') {
    primary = button(ct('compare.btnReply'), { variant: 'primary', size: 'lg', 'data-action': 'ch-reply', onClick: () => { haptic('tap'); onReply?.(); } });
    ghosts = [replayBtn, boardBtn];
  } else {
    replayBtn.className = 'btn btn-primary btn-lg';
    primary = replayBtn;
    ghosts = [boardBtn, button([icon('challenge', { size: 20, width: 2 }), ct('create.button')], { variant: 'secondary', 'data-action': 'ch-new', onClick: () => onNewChallenge?.() })];
  }
  const headline = h('h1', { class: 'cmp-headline', tabindex: '-1', 'data-autofocus': '' }, head);
  const card = h('div', { class: 'cmp-card' }, grid);
  const el = h('section', { class: 'screen screen-ch screen-compare', 'data-screen': 'compare', 'data-outcome': outcome ?? 'none', 'data-variant': variant, 'data-fresh': String(singleColumn || myFresh) },
    h('div', { class: 'ch-top' }, h('p', { class: 'ch-kicker cmp-title' }, ct('compare.title')),
      h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': ct('compare.btnHome'), 'data-action': 'ch-home', onClick: onHome }, icon('close', { size: 22 }))),
    h('div', { class: 'ch-scroll' }, headline, h('p', { class: 'cmp-sub' }, sub), card, unverifiedNote, maxi, simpl),
    h('div', { class: 'ch-foot' }, primary, h('div', { class: 'end-row' }, ghosts)));
  return {
    el,
    start() {
      if (motionOK()) {
        animate(card, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'cubic-bezier(.16,1,.3,1)' });
        animate(bubble, [{ opacity: 0, transform: 'translateX(calc(var(--dir, -1) * 8px))' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 250, fill: 'backwards' });
        for (const [v, r] of [[keyVals[0], me], [keyVals[1], them]]) {
          const n = v?.querySelector('.cmp-num');
          if (n && r?.status === 'won' && /^\d+$/.test(n.textContent)) countUp(0, r.turns, (x) => { n.textContent = String(x); });
        }
      }
      if (variant === 'end' && outcome === 'you') { confetti(el); haptic('win'); sound('win'); }
    },
  };
}

export { tp };
