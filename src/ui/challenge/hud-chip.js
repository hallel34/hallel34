// 0.5.1 HUD chip "אתגר" (spec §3): a quiet outline chip in HUD row 1, never gold; a tap opens a small popover with the two
// challenge rules (the halves of hud.ariaNamed) and, when the link carries a result, the target. Outside tap / Esc closes it.
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { animate } from '../fx.js';
import { motionOK } from '../prefs.js';
import { ct, turnsIn } from './copy.js';

/**
 * @param challenge match.challenge ({ name, fresh, target: { status, turns, freedomPct } | null })
 */
export function challengeChip(challenge) {
  const name = challenge?.name || '';
  const aria = name ? ct('hud.ariaNamed', { name }) : ct('hud.aria');
  const chip = h('button', {
    type: 'button', class: 'ch-chip', 'data-action': 'challenge-rules', 'aria-expanded': 'false', 'aria-controls': 'ch-pop', 'aria-label': aria,
  }, icon('challenge', { size: 16, width: 2 }), h('span', { class: 'ch-chip-label', 'aria-hidden': 'true' }, ct('hud.chip')));
  let pop = null;
  const [head, rules] = (() => {
    const i = aria.indexOf('. ');
    return i > 0 ? [aria.slice(0, i), aria.slice(i + 2)] : [aria, ''];
  })();
  const target = challenge?.target && !challenge.fresh
    ? (challenge.target.status === 'won' ? ct('hud.goal', { turns: turnsIn(challenge.target.turns) }) : ct('hud.goalPct', { pct: challenge.target.freedomPct }))
    : null;
  const close = () => {
    if (!pop) return;
    const gone = pop; pop = null;
    chip.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', key, true);
    gone.remove();
  };
  const outside = (e) => { if (pop && !pop.contains(e.target) && !chip.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); chip.focus?.({ preventScroll: true }); } };
  chip.addEventListener('click', () => {
    if (pop) { close(); return; }
    pop = h('div', { class: 'ch-pop', id: 'ch-pop', role: 'group', 'aria-label': head, 'data-ch-pop': '' },
      h('p', { class: 'ch-pop-head' }, icon('challenge', { size: 16, width: 2 }), h('span', null, head)),
      rules ? h('p', { class: 'ch-pop-rules' }, rules) : null,
      target ? h('p', { class: 'ch-pop-target', 'data-ch-target': '' }, target) : null);
    chip.closest('.hud')?.append(pop);
    chip.setAttribute('aria-expanded', 'true');
    animate(pop, motionOK() ? [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: motionOK() ? 220 : 120, easing: 'ease-out' });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
  });
  return { el: chip, destroy: close };
}
