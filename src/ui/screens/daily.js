// Daily challenge result (D2 + D4): turns to freedom, net worth, the learning headline, the day streak with its badges and
// a share button (WhatsApp text, no cards or choices revealed). Never shaming: a day without freedom is "not today".
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { foxImg, riseIn } from '../fox.js';
import { button } from '../widgets.js';
import { icon } from '../icons.js';
import { money, numberText } from '../format.js';
import { confetti, haptic, sound } from '../fx.js';
import { STREAK_BADGES } from '../../daily/streak.js';
import { shortDate } from '../../daily/calendar.js';
import { buildShareText } from '../../daily/share.js';
import { greenText } from '../../learn/report.js';
import { nextChallengeText, streakText, badgeLabel } from '../daily-format.js';

/** Share through the system sheet, else the clipboard (click handler only). Resolves 'shared' | 'copied' | 'failed' | 'cancelled'. */
export async function shareText(text, { nav = globalThis.navigator, doc = globalThis.document } = {}) {
  try {
    if (nav?.share) { await nav.share({ title: t('daily.shareTitle'), text }); return 'shared'; }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled'; // the player closed the share sheet: nothing to report
    // any other failure: fall through to the clipboard
  }
  try {
    await nav.clipboard.writeText(text);
    return 'copied';
  } catch { /* clipboard blocked: try the old way */ }
  try {
    const ta = doc.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
    doc.body.append(ta); ta.select();
    const ok = doc.execCommand?.('copy');
    ta.remove();
    if (ok) return 'copied';
  } catch { /* fall through */ }
  return 'failed';
}

export function createDailyResult({ entry, professionTitle = '', streak, newBadges = [], celebrate = false, url, onMenu }) {
  const { record } = entry;
  const won = record.turns != null;
  const text = buildShareText(entry, url);
  let timer = 0;

  const fox = won
    ? foxImg('hammock', { height: 120, altKey: 'fox.alt.hammock', cls: 'hammock', lazy: true })
    : h('div', { class: 'fox-pop', style: '--pop:96px' }, foxImg('think', { size: 96, altKey: 'fox.alt.think' }));
  const title = won ? t('daily.resultFreedom', { turns: tp('plural.turnsIn', record.turns) }) : t('daily.resultFail');
  const next = h('p', { class: 'daily-next-line' }, nextChallengeText());

  const badge = (days) => {
    const earned = streak.badges.includes(days);
    return h('li', { class: 'daily-badge', 'data-earned': String(earned), 'data-new': String(newBadges.includes(days)), 'data-days': String(days) },
      h('span', { class: 'daily-badge-icon', 'aria-hidden': 'true' }, icon('star', { size: 18, width: 2.4 })),
      h('span', { class: 'daily-badge-text' }, badgeLabel(days), h('span', { class: 'vh' }, earned ? '' : ` (${t('daily.badgeLocked')})`)));
  };
  const streakLine = streakText(streak);

  const confirm = h('p', { class: 'daily-copied', role: 'status', 'aria-live': 'polite', 'data-visible': 'false' });
  const box = h('textarea', { class: 'daily-sharebox', readonly: '', hidden: true, rows: 5, 'aria-label': t('daily.shareBox') });
  box.value = text;
  const say = (msg, ms = 3200) => {
    confirm.textContent = msg; confirm.dataset.visible = 'true';
    clearTimeout(timer);
    timer = setTimeout(() => { confirm.dataset.visible = 'false'; }, ms);
  };
  const share = async () => {
    haptic('tap');
    const r = await shareText(text);
    if (r === 'copied') say(t('daily.copied'));
    else if (r === 'failed') { say(t('daily.copyFailed'), 8000); box.hidden = false; box.focus({ preventScroll: true }); box.select(); }
  };

  const el = h('section', { class: `screen screen-daily ${won ? 'screen-win' : 'screen-over'}`, 'data-screen': 'daily', 'data-outcome': entry.outcome },
    h('div', { class: 'end-hero daily-hero' },
      h('div', { class: 'daily-fox' }, fox),
      h('h1', { class: `title ${won ? 'title-win' : 'title-over'} daily-h1` }, title),
      h('p', { class: 'tagline daily-sub' }, won ? t('daily.resultFreedomText') : t('daily.resultFailText'))),
    h('div', { class: 'glass glass-strong end-card daily-card-result' },
      h('div', { class: 'win-compare' },
        h('div', null, h('span', { class: 'stat-label' }, t('daily.netWorth')), h('div', { class: 'win-mid daily-net' }, money(record.netWorth))),
        h('div', { class: 'align-end' }, h('span', { class: 'stat-label' }, t('daily.resultSub', { date: shortDate(record.date) })), h('div', { class: 'daily-prof' }, professionTitle))),
      h('p', { class: 'daily-learn' }, h('b', null, `${t('daily.learned')}: `), greenText(entry.green)),
      streakLine ? h('p', { class: 'daily-streakline' }, h('span', { class: 'daily-flame', 'aria-hidden': 'true' }, icon('star', { size: 18, width: 2.4 })), streakLine) : null,
      h('ul', { class: 'daily-badges', 'aria-label': t('daily.badges') }, STREAK_BADGES.map(badge)),
      newBadges.length ? h('p', { class: 'daily-newbadge', role: 'status' }, t('daily.badgeEarned', { badge: badgeLabel(newBadges[newBadges.length - 1]) })) : null,
      next),
    h('div', { class: 'end-actions daily-actions' },
      confirm, box,
      button([icon('share', { size: 22, width: 2.6 }), t('daily.share')], { variant: 'primary', size: 'lg', 'data-action': 'share', 'data-autofocus': '', onClick: share }),
      button(t('daily.menu'), { variant: 'secondary', 'data-action': 'menu', onClick: onMenu })));

  return {
    el,
    start() {
      riseIn(fox);
      if (celebrate && won) { haptic('win'); sound('win'); confetti(el); }
      timer = 0;
    },
    destroy() { clearTimeout(timer); },
  };
}
