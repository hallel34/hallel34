// v4 fox corner guide on the board (docs/v4/design/board-spec.md section 7): a 64-80px circle crop in the fox strip (between the
// board plate and the roll button), at the inline-end corner. It is a real button: tapping it re-opens the last message. The
// smoked-glass bubble beside it is the fox note (notes.js); this file owns the fox itself: its pose, the tap, and the "too short"
// rule (a strip shorter than the fox + 16px hides the fox; the messages then go to the status line).
// The big poses (home, profession, win) are untouched; the 128px roll pose and the 150px tip pose no longer appear on the board.
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { foxUrls, REACTIONS } from './fox.js';
import { animate } from './fx.js';
import { motionOK } from './prefs.js';

export const GUIDE_DEFAULT = 'think';
/** Any pose name (hints carry cutout poses such as 'tip') -> one of the four reaction crops the guide can show. */
export const guidePose = (pose) => (REACTIONS.includes(pose) ? pose : GUIDE_DEFAULT);

/**
 * @param zone      the fox strip (.roll-zone); watched for its height
 * @param onReopen  () => void, the fox was tapped
 * @param onCompact (compact: boolean) => void, the strip became too short for the fox (or tall enough again)
 */
export function createFoxGuide({ zone, onReopen, onCompact }) {
  const img = h('img', {
    class: 'fox pose-think guide-img', src: foxUrls(GUIDE_DEFAULT).src, width: 80, height: 80, alt: '', 'aria-hidden': 'true',
    decoding: 'async', loading: 'eager', draggable: 'false',
  });
  const btn = h('button', { type: 'button', class: 'fox-guide', 'aria-label': t('fox.lastMessage'), 'data-action': 'fox', 'data-pose': GUIDE_DEFAULT }, img);
  // .react-host: the strip slot that must never cover the HUD, the board, the die or the roll button (smoke 'reactionStripClear')
  const host = h('div', { class: 'react-host fox-guide-host' }, btn);
  let base = GUIDE_DEFAULT; // the pose of the message on screen (or the default)
  let timer = 0;
  let compact = false;

  function paint(pose) {
    const p = guidePose(pose);
    if (btn.dataset.pose === p) return;
    btn.dataset.pose = p;
    img.src = foxUrls(p).src;
    img.className = `fox pose-${p} guide-img`;
    if (motionOK()) animate(btn, [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'none' });
  }

  btn.addEventListener('click', () => onReopen?.());

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      const size = btn.getBoundingClientRect().width || parseFloat(getComputedStyle(zone).getPropertyValue('--fox-guide')) || 72;
      const tooShort = zone.clientHeight > 0 && zone.clientHeight < size + 16;
      if (tooShort === compact) return;
      compact = tooShort;
      zone.dataset.compact = String(compact);
      onCompact?.(compact);
    });
    ro.observe(zone);
  }

  return {
    el: host,
    button: btn,
    /** The pose that belongs to the message on screen (null = back to the default). */
    setBase(pose) { base = guidePose(pose ?? GUIDE_DEFAULT); clearTimeout(timer); paint(base); },
    /** A short reaction (purchase, payday, shortfall...): the pose for `hold` ms, then back to the message's pose. */
    react(pose, hold = 2200) { clearTimeout(timer); paint(pose); timer = setTimeout(() => paint(base), hold); },
    /** Back to the message's pose at once. */
    settle() { clearTimeout(timer); paint(base); },
    get compact() { return compact; },
    destroy() { clearTimeout(timer); },
  };
}
