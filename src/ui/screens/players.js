// Player setup (hot-seat): how many players (1-4, default 1) and a name for each. One player skips the name fields.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { button, iconButton, stepper } from '../widgets.js';
import { haptic } from '../fx.js';
import { MIN_PLAYERS, MAX_PLAYERS, NAME_MAX, uniqueNames } from '../../engine/index.js';
import { playerToken, playerName } from '../players.js';

/**
 * @param count   initial number of players
 * @param names   initial names (array; may be shorter than count)
 * @param onBack  () => void
 * @param onNext  ({ count, names }) => void   names are final (never empty); a single player has names [''].
 */
export function createPlayers({ count = 1, names = [], onBack, onNext }) {
  let n = count;
  const values = Array.from({ length: MAX_PLAYERS }, (_, i) => names[i] || '');

  const fields = h('div', { class: 'name-fields', role: 'group', 'aria-label': t('players.namesTitle') });
  const next = button(t('players.next'), { variant: 'primary', size: 'lg', 'data-action': 'players-next', onClick: () => finish() });

  function paint() {
    fields.replaceChildren();
    fields.hidden = n === 1;
    for (let i = 0; i < n; i++) {
      const input = h('input', {
        type: 'text', class: 'name-input', maxlength: String(NAME_MAX), value: values[i] || playerName({ name: '' }, i),
        autocomplete: 'off', autocapitalize: 'words', enterkeyhint: i === n - 1 ? 'done' : 'next',
        'aria-label': t('players.nameLabel', { n: i + 1 }), 'data-player': String(i),
      });
      input.addEventListener('input', () => { values[i] = input.value; });
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const nextInput = fields.querySelector(`[data-player="${i + 1}"]`);
        if (nextInput) nextInput.focus(); else finish();
      });
      fields.append(h('div', { class: 'name-row' }, playerToken(i + 1, { label: t('players.colorLabel', { n: i + 1 }) }), input));
    }
    next.firstChild.textContent = n === 1 ? t('players.toProfession') : t('players.next');
  }

  const st = stepper({
    min: MIN_PLAYERS, max: MAX_PLAYERS, step: 1, value: n,
    render: (v) => h('span', { dir: document.documentElement.dir }, v === 1 ? t('players.one') : t('players.many', { n: v })),
    onChange: (v) => { n = v; haptic('tap'); paint(); },
    decLabel: t('players.fewer'), incLabel: t('players.more'),
  });
  paint();

  function finish() {
    // final names: empty -> the default label, repeats get " 2", " 3" (two players must never share a name)
    const out = n === 1 ? [''] : uniqueNames(Array.from({ length: n }, (_, i) => (values[i] || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || playerName({ name: '' }, i)));
    onNext({ count: n, names: out });
  }

  const el = h('section', { class: 'screen screen-players', 'data-screen': 'players' },
    h('div', { class: 'pick-top' },
      iconButton('arrow', t('pick.back'), onBack, 'icon-btn-glass'),
      h('div', null, h('h1', { class: 'screen-title' }, t('players.title')), h('p', { class: 'muted' }, t('players.subtitle')))),
    h('div', { class: 'glass players-card' },
      h('span', { class: 'stat-label' }, t('players.count')),
      st.el,
      fields),
    h('div', { class: 'players-cta' }, next));
  return { el };
}
