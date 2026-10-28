import { h, clear } from '../dom.js';
import { button } from '../widgets.js';
import { moneyText, setCoinScale } from '../format.js';
import { currentState } from '../../engine/index.js';
import { newFirstAsset, firstAssetPurchase, declineFirstAsset, FIRST_ASSET_BADGE } from '../../engine/first-asset.js';
import { hasBadge, earnBadge } from '../../learn/store.js';
import { t } from '../../i18n/index.js';

export function createFirstAsset({ engine, match: initial, store, onMenu, onContinue }) {
  let match = initial;
  let alive = true;
  let acting = false;
  setCoinScale(false);
  const el = h('section', { class: 'screen screen-mission', 'data-screen': 'first-asset' });
  const text = (key, args) => t(`mission.${key}`, args);
  const amount = (n) => moneyText(n);
  const notice = h('p', { class: 'mission-notice', role: 'status', 'aria-live': 'polite' });
  const row = (label, value) => h('div', { class: 'mission-row' }, h('dt', null, text(label)), h('dd', { dir: 'auto' }, amount(value)));

  function save() {
    const ok = store.save(match);
    notice.textContent = ok ? '' : text('saveFailed');
    return ok;
  }
  function badge() {
    if (match.mission.stage === 'complete' && !hasBadge(FIRST_ASSET_BADGE)) earnBadge(FIRST_ASSET_BADGE);
  }
  function change(fn) {
    if (!alive || acting) return;
    acting = true;
    try {
      match = fn();
      // Commit the complete state first. A reload cannot reapply a purchase.
      save();
      badge();
      render();
    } catch {
      notice.textContent = text('actionFailed');
    } finally { acting = false; }
  }
  function exit() {
    if (save()) onMenu(); else render();
  }
  function render() {
    clear(el);
    const stage = match.mission.stage;
    const done = stage === 'complete';
    const declined = stage === 'declined';
    const result = done || declined;
    const preview = stage === 'offer' ? firstAssetPurchase(engine, match) : null;
    const f = preview?.mission.feedback ?? match.mission.feedback;
    const card = currentState(match).pending?.card;
    const heading = result ? (done ? 'completed' : 'declined') : 'title';
    const content = h('div', { class: 'mission-content' },
      h('p', { class: 'mission-eyebrow' }, text('practice')),
      h('h1', { 'data-autofocus': '', tabindex: '-1' }, text(heading)),
      h('p', { class: 'mission-intro' }, text(result ? (done ? 'completedIntro' : 'declinedIntro') : 'intro')),
    );
    if (!result) {
      content.append(h('h2', null, card.title), h('p', null, card.text),
        h('dl', { class: 'mission-figures' },
          row('cash', currentState(match).cash), row('downPayment', card.downPayment),
          row('gross', f.gross), row('businessPayment', f.businessPayment),
          row('assetNet', f.assetNet), row('bankLoan', f.bankLoan), row('bankPayment', f.bankPayment),
        ),
        h('p', { class: 'mission-net' }, text('net', { amount: amount(f.netChange) })),
        h('p', { class: 'mission-detail' }, text('loanExplanation')),
        h('p', { class: 'mission-detail' }, text('risk')));
    }
    if (done) {
      content.append(h('p', { class: 'mission-badge' }, text('badge')),
        h('p', { class: 'mission-net' }, text('net', { amount: amount(f.netChange) })),
        h('dl', { class: 'mission-figures' },
          row('gross', f.gross), row('businessPayment', f.businessPayment),
          row('bankPayment', f.bankPayment), row('beforeFlow', f.beforeFlow), row('afterFlow', f.afterFlow),
        ),
        h('p', null, text('progress', { before: f.beforeProgress.toFixed(1), after: f.afterProgress.toFixed(1) })),
        h('progress', { max: '100', value: String(Math.min(100, f.afterProgress)), 'aria-label': text('progressLabel') }),
        h('p', { class: 'mission-detail' }, text(hasBadge(FIRST_ASSET_BADGE) ? 'badgeDetail' : 'badgeFailed')));
    }
    const actions = h('div', { class: 'mission-actions' });
    if (!result) {
      actions.append(
        button(text('buy'), { 'data-action': 'mission-buy', onClick: () => change(() => firstAssetPurchase(engine, match)) }),
        button(text('pass'), { variant: 'secondary', onClick: () => change(() => declineFirstAsset(engine, match)) }),
      );
    } else {
      actions.append(button(text(done ? 'freeplay' : 'freeplayWithoutAsset'), {
        'data-action': 'mission-continue', onClick: () => { if (save()) onContinue(match); else render(); },
      }));
      if (declined) actions.append(button(text('retry'), {
        variant: 'secondary', onClick: () => change(() => newFirstAsset(engine)),
      }));
    }
    actions.append(button(text('saveExit'), { variant: 'secondary', onClick: exit }));
    // Storage failures never trap a player. Leaving without saving is explicit.
    if (notice.textContent) {
      if (result) actions.append(button(text('continueUnsaved'), { variant: 'secondary', onClick: () => onContinue(match) }));
      actions.append(button(text('leaveUnsaved'), { variant: 'secondary', onClick: onMenu }));
    }
    content.append(notice, actions);
    el.append(content);
  }
  save();
  badge();
  render();
  return { el, destroy() { alive = false; } };
}
