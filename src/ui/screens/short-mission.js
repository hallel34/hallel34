import { h, clear } from '../dom.js';
import { button } from '../widgets.js';
import { t } from '../../i18n/index.js';
import { moneyText, setCoinScale } from '../format.js';
import { currentState } from '../../engine/index.js';
import { REPAY_MISSION, resolveShortMission } from '../../engine/short-missions.js';
import { recordShortMission, completedShortMissions } from '../../services/mission-progress.js';

export function createShortMission({ engine, match: initial, store, onMenu, onContinue }) {
  let match = initial;
  let alive = true;
  let acting = false;
  setCoinScale(false);
  const repay = match.mission.id === REPAY_MISSION;
  const key = repay ? 'repay' : 'buffer';
  const text = (name, args) => t(`missions.${name}`, args);
  const el = h('section', { class: 'screen screen-mission', 'data-screen': 'short-mission' });
  const notice = h('p', { class: 'mission-notice', role: 'status', 'aria-live': 'polite' });
  const row = (label, value) => h('div', { class: 'mission-row' },
    h('dt', null, text(label)), h('dd', { dir: 'ltr' }, moneyText(value)));

  function save() {
    const ok = store.save(match);
    notice.textContent = ok ? '' : t('mission.saveFailed');
    return ok;
  }
  function record() {
    if (match.mission.stage === 'complete') recordShortMission(match.mission.id);
  }
  function exit() {
    if (save()) onMenu(); else render();
  }
  function decide(choice) {
    if (!alive || acting || match.mission.stage !== 'offer') return;
    acting = true;
    try {
      match = resolveShortMission(engine, match, choice);
      save();
      record();
      render();
    } catch { notice.textContent = t('mission.actionFailed'); }
    finally { acting = false; }
  }
  function render() {
    clear(el);
    const done = match.mission.stage === 'complete';
    const content = h('div', { class: 'mission-content' },
      h('p', { class: 'mission-eyebrow' }, text('eyebrow')),
      h('h1', { tabindex: '-1', 'data-autofocus': '' }, text(`${key}.${done ? 'resultTitle' : 'title'}`)),
      h('p', { class: 'mission-intro' }, text(`${key}.${done ? 'resultIntro' : 'intro'}`)),
    );
    if (done) {
      const f = match.mission.feedback;
      content.append(
        h('p', { class: 'mission-net' }, text(`${key}.${match.mission.choice}.outcome`)),
        h('div', { class: 'mission-comparison' },
          h('section', null, h('h2', null, text('before')),
            h('dl', { class: 'mission-figures' }, row('cash', f.before.cash), row('debt', f.before.debt), row('flow', f.before.flow))),
          h('section', null, h('h2', null, text('after')),
            h('dl', { class: 'mission-figures' }, row('cash', f.after.cash), row('debt', f.after.debt), row('flow', f.after.flow))),
        ),
        h('p', null, text('netChange', { amount: `\u2066${moneyText(f.netChange)}\u2069` })),
        h('p', { class: 'mission-detail' }, text(`${key}.${match.mission.choice}.lesson`)),
        h('p', { class: 'mission-detail' }, text(completedShortMissions().includes(match.mission.id) ? 'progressSaved' : 'progressFailed')),
      );
    } else {
      const state = currentState(match);
      content.append(h('dl', { class: 'mission-figures' },
        row('cash', state.cash), row('debt', state.liabilities.reduce((sum, l) => sum + l.principal, 0))));
      if (!repay) content.append(h('h2', null, state.pending.card.title), h('p', null, state.pending.card.text));
      const choices = repay ? ['repay', 'keep'] : ['cash', 'loan'];
      const previews = h('div', { class: 'mission-comparison' });
      for (const choice of choices) {
        const f = resolveShortMission(engine, match, choice).mission.feedback;
        previews.append(h('section', { class: 'mission-choice' },
          h('h2', null, text(`${key}.${choice}.title`)),
          h('dl', { class: 'mission-figures' },
            row('cashAfter', f.after.cash), row('debtAfter', f.after.debt),
            row('flowAfter', f.after.flow), row('monthlyPayments', f.after.payment)),
          h('p', { class: 'mission-detail' }, text(`${key}.${choice}.preview`)),
          button(text(`${key}.${choice}.choose`), { 'data-choice': choice, onClick: () => decide(choice) }),
        ));
      }
      content.append(previews, h('p', { class: 'mission-detail' }, text(`${key}.tradeoff`)));
    }
    const actions = h('div', { class: 'mission-actions' });
    if (done) actions.append(button(text('freeplay'), {
      'data-action': 'short-continue', onClick: () => { if (save()) onContinue(match); else render(); },
    }));
    actions.append(button(text('backSaved'), { variant: 'secondary', onClick: exit }));
    if (notice.textContent) {
      if (done) actions.append(button(t('mission.continueUnsaved'), { variant: 'secondary', onClick: () => onContinue(match) }));
      actions.append(button(t('mission.leaveUnsaved'), { variant: 'secondary', onClick: onMenu }));
    }
    content.append(notice, actions);
    el.append(content);
    if (el.isConnected) el.querySelector('h1')?.focus();
  }
  save();
  record();
  render();
  return { el, destroy() { alive = false; } };
}
