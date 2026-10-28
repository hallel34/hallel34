import { h } from '../dom.js';
import { button } from '../widgets.js';
import { t } from '../../i18n/index.js';
import { FIRST_ASSET_ID } from '../../engine/first-asset.js';
import { REPAY_MISSION, BUFFER_MISSION } from '../../engine/short-missions.js';

export function createMissions({ saved, completed, onSelect, onMenu, onRestart }) {
  const el = h('section', { class: 'screen screen-mission', 'data-screen': 'missions' });
  const items = [[FIRST_ASSET_ID, 'first'], [REPAY_MISSION, 'repay'], [BUFFER_MISSION, 'buffer']];
  const content = h('div', { class: 'mission-content' },
    h('p', { class: 'mission-eyebrow' }, t('missions.eyebrow')),
    h('h1', { tabindex: '-1', 'data-autofocus': '' }, t('missions.title')),
    h('p', { class: 'mission-intro' }, t('missions.intro')),
  );
  for (const [id, key] of items) {
    const state = saved(id)?.mission?.stage;
    const status = state === 'freeplay' ? 'freeplaySaved' : state ? 'decisionSaved' : completed.includes(id) ? 'practiced' : 'available';
    content.append(h('article', { class: 'mission-tile' },
      h('p', { class: 'mission-eyebrow' }, t(`missions.${status}`)),
      h('h2', null, t(`missions.${key}.title`)),
      h('p', null, t(`missions.${key}.summary`)),
      button(t(state ? 'missions.resume' : 'missions.open'), {
        'data-mission': id, onClick: () => onSelect(id),
      }),
      state && onRestart ? button(t('missions.restart'), {
        variant: 'secondary', 'data-restart': id, onClick: () => onRestart(id),
      }) : null,
    ));
  }
  content.append(h('p', { class: 'mission-detail' }, t('missions.independent')),
    button(t('missions.home'), { variant: 'secondary', onClick: onMenu }));
  el.append(content);
  return { el };
}
