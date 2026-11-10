// 0.5.1 weekly family board "טבלת המשפחה" (spec §6): built on this device from the verified results of this week's challenges
// (passivo.challenges; no server). Per mode, turns first, then unfinished games by freedom %. Read-only: home is the X.
// Lazy chunk: opened from home's 4th icon button, so home never reads the store and never loads this module (Lighthouse).
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { t, tp, getMeta } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { button } from '../widgets.js';
import { tn } from '../format.js';
import { professionBust } from '../professions.js';
import { ct, turnsIn } from '../challenge/copy.js';
import { loadChallenges, boardRows, weekOf } from '../../services/challenge-store.js';

const SHOW = 20;

/**
 * @param now       the clock (ms)
 * @param onRow     (row) => void   opens that challenge's compare (null: rows are plain)
 * @param onHome / onStart
 */
export function createFamilyBoard({ now = Date.now(), onRow = null, onHome, onStart, professionTitle = () => '', store = loadChallenges() }) {
  const week = weekOf(now);
  const fmt = new Intl.DateTimeFormat(getMeta().numberLocale || 'he-IL', { day: 'numeric', month: 'numeric' });
  const start = fmt.format(new Date(week.start));
  const end = fmt.format(new Date(week.end));
  const rows = boardRows(store, week);
  const modes = ['family', 'full'].filter((m) => rows[m].length);
  let mode = modes.length ? modes.reduce((a, b) => (rows[b].length > rows[a].length ? b : a)) : 'family';

  const weekLine = h('p', { class: 'fb-week', 'aria-label': ct('board.weekAria', { start, end }) },
    tn('challenge.board.week', { range: h('bdi', { dir: 'ltr' }, `${start}–${end}`) }));
  const listHost = h('div', { class: 'fb-list-host' });

  const rowEl = (r) => {
    const name = r.you ? ct('board.you') : r.name || ct('board.anonName');
    const won = r.status === 'won';
    const place = r.tie ? ct('board.placeTie', { n: String(r.rank) }) : ct('board.place', { n: String(r.rank) });
    const subline = [professionTitle(r.professionId) || null, r.junior ? ct('board.juniorTag') : t(r.mode === 'full' ? 'menu.modeFull' : 'menu.modeFamily')].filter(Boolean).join(' · ');
    // the row's name is its own text (WCAG 2.5.3, QA 0.5.1 P2-2): "מקום 1" is a visually hidden prefix, the rank digit is hidden
    const body = [
      h('span', { class: 'vh' }, `${place}. `),
      h('span', { class: 'fb-rank', 'aria-hidden': 'true' }, r.rank === 1 ? icon('star', { size: 16, width: 2 }) : null, h('bdi', { dir: 'ltr' }, String(r.rank))),
      h('span', { class: 'cmp-avatar', 'aria-hidden': 'true' }, professionBust(r.professionId)),
      h('span', { class: 'fb-who' }, h('span', { class: 'fb-name' }, name), h('span', { class: 'fb-sub' }, subline)),
      h('span', { class: 'fb-result' }, h('bdi', { class: 'fb-num', dir: 'ltr' }, won ? String(r.turns) : `${r.pct}%`),
        h('span', { class: 'fb-unit' }, won ? tp('plural.label.turns', r.turns) : ct('board.unitProgress'))),
    ];
    const cls = `fb-row${r.you ? ' is-you' : ''}`;
    return h('li', { class: 'fb-item', 'data-you': String(r.you) }, onRow
      ? h('button', { type: 'button', class: cls, 'data-board-row': r.key, onClick: () => onRow(r) }, body)
      : h('div', { class: cls }, body));
  };
  function paint() {
    const list = rows[mode];
    let shown = SHOW;
    const ol = h('ol', { class: 'fb-list', 'data-board-mode': mode });
    const more = h('div');
    const fill = () => {
      ol.replaceChildren(...list.slice(0, shown).map(rowEl));
      more.replaceChildren(list.length > shown ? button(ct('board.more', { n: String(list.length - shown) }), { variant: 'text', 'data-action': 'fb-more', onClick: () => { shown = list.length; fill(); } }) : '');
    };
    fill();
    listHost.replaceChildren(h('div', { class: 'cmp-card fb-card' }, ol), more);
  }

  const chips = modes.length > 1 ? h('fieldset', { class: 'tl-filter fb-modes' }, h('legend', { class: 'vh' }, ct('board.title')),
    h('div', { class: 'tl-chips' }, modes.map((m) => {
      const input = h('input', { type: 'radio', name: 'fb-mode', value: m, class: 'age-input', 'data-fb-mode': m, checked: m === mode || null });
      input.addEventListener('change', () => { if (input.checked) { mode = m; paint(); } });
      return h('label', { class: 'age-chip tl-chip' }, input, h('span', { class: 'age-chip-text' }, t(m === 'full' ? 'menu.modeFull' : 'menu.modeFamily')));
    }))) : null;

  const empty = !modes.length;
  if (!empty) paint();
  const content = empty
    ? h('div', { class: 'ch-error fb-empty', 'data-board-empty': '' },
      h('div', { class: 'ch-error-icon', 'aria-hidden': 'true' }, icon('familyBoard', { size: 40, width: 2 })),
      h('h2', { class: 'ch-title' }, ct('board.emptyTitle')),
      h('p', { class: 'ch-lede' }, ct('board.emptyBody')))
    : h('div', { class: 'fb-body' }, chips, listHost,
      h('p', { class: 'fb-how' }, icon('verified', { size: 16, width: 2 }), h('span', null, ct('board.how'))),
      h('p', { class: 'fb-cheer' }, ct('board.cheer')));
  const el = h('section', { class: 'screen screen-ch screen-board-family', 'data-screen': 'family-board' },
    h('div', { class: 'ch-top fb-top' }, h('h1', { class: 'ch-kicker fb-title', tabindex: '-1', 'data-autofocus': '' }, ct('board.title')),
      h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': ct('compare.btnHome'), 'data-action': 'ch-home', onClick: onHome }, icon('close', { size: 22 }))),
    h('div', { class: 'fb-head' }, weekLine, h('p', { class: 'fb-reset' }, ct('board.reset'))),
    h('div', { class: 'ch-scroll' }, content),
    empty ? h('div', { class: 'ch-foot' }, button(ct('board.emptyCta'), { variant: 'primary', size: 'lg', 'data-action': 'fb-start', onClick: onStart })) : null);
  return { el };
}
