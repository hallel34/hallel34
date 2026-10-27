// Player setup (hot-seat): how many players (1-4, default 1), a name for each (one player skips the name) and, after each name,
// the age band (owner 2026-10-26): 'עד 10' plays in coins on round rules, under 14 is suggested family mode. Not picking = today's game.
import { h } from '../dom.js';
import { t } from '../../i18n/index.js';
import { button, iconButton, stepper } from '../widgets.js';
import { haptic } from '../fx.js';
import { MIN_PLAYERS, MAX_PLAYERS, NAME_MAX, uniqueNames, AGE_BANDS, JUNIOR_AGE, FAMILY_SUGGESTED_AGES, COIN_VALUE } from '../../engine/index.js';
import { inShekels, moneyText } from '../format.js';
import { playerToken, playerName } from '../players.js';

/**
 * @param count   initial number of players
 * @param names   initial names (array; may be shorter than count)
 * @param onBack  () => void
 * @param onNext  ({ count, names, ages }) => void   names are final (never empty); a single player has names ['']; ages: band or null.
 * @param mode    the mode picked on the start screen; onMode(m) switches it (an age under 14 suggests family mode)
 */
const AGE_KEY = { upTo10: 'players.ageUpTo10', '11to13': 'players.age11to13', '14plus': 'players.age14plus' };
export function createPlayers({ count = 1, names = [], ages = [], mode = 'family', onMode = null, onBack, onNext }) {
  let n = count;
  let curMode = mode;
  const values = Array.from({ length: MAX_PLAYERS }, (_, i) => names[i] || '');
  const agesOf = Array.from({ length: MAX_PLAYERS }, (_, i) => (AGE_BANDS.includes(ages[i]) ? ages[i] : null));
  const ageNote = h('p', { class: 'age-note', role: 'status', 'aria-live': 'polite' });
  let suggested = false; // the switch to family mode happened on this screen
  function paintNote() {
    const junior = agesOf.slice(0, n).includes(JUNIOR_AGE);
    const lines = [];
    if (suggested) lines.push(t('players.familySuggested'));
    if (junior) lines.push(t('players.juniorOn'), t('players.ageNote', { perCoin: t('coins.perCoin', { value: inShekels(() => moneyText(COIN_VALUE)) }) }));
    ageNote.replaceChildren(...lines.map((l) => h('span', null, l)));
    ageNote.hidden = !lines.length;
  }
  function pickAge(i, band) {
    agesOf[i] = band;
    haptic('tap');
    if (FAMILY_SUGGESTED_AGES.includes(band) && curMode !== 'family') { curMode = 'family'; suggested = true; onMode?.('family'); }
    paintNote();
  }
  /** The age chips of player i: a native radio group (keyboard, screen readers), each chip a 48px target. */
  function ageChips(i, label) {
    const name = `age-${i}`;
    return h('fieldset', { class: 'age-group', 'data-age-for': String(i) },
      h('legend', { class: 'age-legend' }, label),
      h('div', { class: 'age-chips' }, AGE_BANDS.map((band) => {
        const input = h('input', { type: 'radio', name, value: band, class: 'age-input', 'data-age': band, checked: agesOf[i] === band || null });
        input.addEventListener('change', () => { if (input.checked) pickAge(i, band); });
        return h('label', { class: 'age-chip' }, input, h('span', { class: 'age-chip-text', dir: 'ltr' }, t(AGE_KEY[band])));
      })));
  }

  const fields = h('div', { class: 'name-fields', role: 'group', 'aria-label': t('players.namesTitle') });
  const next = button(t('players.next'), { variant: 'primary', size: 'lg', 'data-action': 'players-next', onClick: () => finish() });

  const ageSingle = h('div', { class: 'age-single' });
  function paint() {
    fields.replaceChildren();
    fields.hidden = n === 1;
    ageSingle.replaceChildren(...(n === 1 ? [ageChips(0, t('players.ageGroupSingle'))] : []));
    ageSingle.hidden = n !== 1;
    for (let i = 0; i < n; i++) {
      const input = h('input', {
        type: 'text', class: 'name-input', maxlength: String(NAME_MAX), value: values[i] || playerName({ name: '' }, i),
        autocomplete: 'off', autocapitalize: 'words', enterkeyhint: i === n - 1 ? 'done' : 'next',
        'aria-label': t('players.nameLabel', { n: i + 1 }), 'data-player': String(i),
      });
      input.addEventListener('input', () => {
        values[i] = input.value;
        // the age legend names the player as typed (screen readers hear "הגיל של דנה", not a stale label)
        const legend = fields.querySelector(`[data-age-for="${i}"] .age-legend`);
        if (legend) legend.textContent = t('players.ageGroup', { name: input.value.trim() || playerName({ name: '' }, i) });
      });
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const nextInput = fields.querySelector(`[data-player="${i + 1}"]`);
        if (nextInput) nextInput.focus(); else finish();
      });
      fields.append(h('div', { class: 'name-row' }, playerToken(i + 1, { label: t('players.colorLabel', { n: i + 1 }) }), input));
      // one player: the chips live in ageSingle (the name fields are hidden), never twice with the same radio name
      if (n > 1) fields.append(ageChips(i, t('players.ageGroup', { name: playerName({ name: values[i] }, i) })));
    }
    paintNote();
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
    onNext({ count: n, names: out, ages: agesOf.slice(0, n) });
  }

  const el = h('section', { class: 'screen screen-players', 'data-screen': 'players' },
    h('div', { class: 'pick-top' },
      iconButton('arrow', t('pick.back'), onBack, 'icon-btn-glass'),
      h('div', null, h('h1', { class: 'screen-title' }, t('players.title')), h('p', { class: 'muted' }, t('players.subtitle')))),
    h('div', { class: 'glass players-card' },
      h('span', { class: 'stat-label' }, t('players.count')),
      st.el,
      ageSingle,
      fields,
      ageNote),
    h('div', { class: 'players-cta' }, next));
  return { el };
}
