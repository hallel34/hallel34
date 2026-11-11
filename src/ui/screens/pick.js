// Profession pick: 2-column grid, tap opens a bottom-sheet preview with a pinned primary CTA.
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { money, tn } from '../format.js';
import { createTermScope } from '../rich.js';
import { button, iconButton, xpBar } from '../widgets.js';
import { openLayer } from '../modal.js';
import { professionFox } from '../professions.js';
import { statement, RANK_XP_NEEDED, MAX_RANK } from '../../engine/index.js';
import { weekNumber } from '../../daily/calendar.js';
import { promoWeekProfession } from '../../career/lite.js';
import { haptic } from '../fx.js';
import { playerToken } from '../players.js';

/**
 * @param career 0.5.0: { profile, today } when a profile exists (the rank row, the XP bar, the start rank chips, the promotion week); null otherwise
 * @param onGo (professionId, rank) => void: the rank is the chosen start rank (0 without a career)
 */
export function createPick({ engine, mode, onBack, onGo, player = null, junior = false, career = null }) {
  const profile = career?.profile ?? null;
  const standingOf = (id) => { const r = profile?.ranks?.[id] ?? { rank: 0, xp: 0 }; return { rank: r.rank ?? 0, xp: r.xp ?? 0 }; };
  const promoId = career ? promoWeekProfession(weekNumber(career.today), engine.data.professions.map((x) => x.id)) : null;
  const chosen = {}; // the start rank picked per profession (default: the current rank)
  const rankNow = (id) => chosen[id] ?? standingOf(id).rank;
  // a junior game (owner 2026-10-26) starts from the profession on round rules: the pick shows THOSE numbers (in coins); a rank shows ITS figures
  const start = (id, rank = 0) => engine.newGame({ mode, professionId: id, seed: 1, ...(rank > 0 ? { rank } : {}), ...(junior ? { junior: true } : {}) });
  const memo = new Map();
  /** { p: profession figures at the rank, st: its statement }, one statement() per (profession, rank), computed once. */
  const figs = (id, rank) => {
    const key = `${id}:${rank}`;
    if (!memo.has(key)) {
      const base = engine.data.professions.find((x) => x.id === id);
      const s = start(id, rank);
      const p = rank === 0 && !junior ? base : { ...base, salary: s.profession.salary, perChild: s.profession.perChild, expenses: s.profession.expenses, savings: s.cash, liabilities: s.liabilities, rankTitle: s.profession.rankTitle };
      memo.set(key, { p, st: statement(s) });
    }
    return memo.get(key);
  };
  const professions = engine.data.professions.map((p) => ({ ...p, ...figs(p.id, rankNow(p.id)).p, title: p.title }));
  const rankTitle = (id, rank) => (rank > 0 ? engine.data.professions.find((x) => x.id === id).ranks[rank - 1].title : null);

  function preview(p0) {
    const id = p0.id;
    const p_ = () => ({ ...p0, ...figs(id, rankNow(id)).p, title: p0.title });
    const st_ = () => figs(id, rankNow(id)).st;
    const scope = createTermScope();
    let layer;
    const row = (l, v, tone = '') => h('div', { class: `st-row${tone ? ` st-${tone}` : ''}` }, h('span', { class: 'st-label' }, l), h('span', { class: 'st-value' }, v));
    const scroll = h('div', { class: 'sheet-scroll', tabindex: '0', role: 'region', 'aria-label': t('pick.previewTitle', { profession: p0.title }) });
    // the rank block (0.5.0): the start rank chips, locked above the player's current rank
    const rankBlock = () => {
      const { rank: cur, xp } = standingOf(id);
      const sel = rankNow(id);
      const need = cur >= MAX_RANK ? 0 : RANK_XP_NEEDED[cur];
      const chips = h('fieldset', { class: 'rank-chips', 'aria-describedby': 'rank-note' }, h('legend', { class: 'vh' }, t('career.pick.startRank')),
        Array.from({ length: MAX_RANK + 1 }, (_, r) => {
          const locked = r > cur || (r > 0 && !engine.data.professions.find((x) => x.id === id).ranks[r - 1]);
          const input = h('input', { type: 'radio', name: `rank-${id}`, value: String(r), 'data-rank': String(r), checked: r === sel || null, disabled: locked || null, 'aria-label': locked ? `${t('career.pick.word', { n: r + 1 })}, ${t('career.pick.locked')}` : t('career.pick.word', { n: r + 1 }) });
          input.addEventListener('change', () => { if (input.checked) { chosen[id] = r; haptic('tap'); renderSheet(); } });
          return h('label', { class: `rank-chip${locked ? ' is-locked' : ''}` }, input, icon(locked ? 'achievementLocked' : `rank${r}`, { size: 20, width: 2 }), h('span', null, t('career.pick.word', { n: r + 1 })));
        }));
      return h('div', { class: 'rank-block', 'data-rank-block': '' },
        h('div', { class: 'rank-block-head' }, h('span', null, t('career.pick.startRank')), h('span', null, sel === cur ? t('career.pick.yours') : t('career.pick.lower'))),
        chips,
        cur < MAX_RANK ? h('p', { class: 'rank-note', id: 'rank-note' }, t('career.xp.toNext', { left: tp('career.plural.xp', need - xp), nextTitle: rankTitle(id, cur + 1) })) : h('p', { class: 'rank-note', id: 'rank-note' }, t('career.xp.top')),
        cur < MAX_RANK ? xpBar(Math.round((100 * xp) / need), { lg: true, label: t('career.xp.progressAria', { have: xp, need, nextTitle: rankTitle(id, cur + 1) }) }) : null,
        h('p', { class: 'rank-note' }, `${t('career.intro.harder')}${sel < cur ? ` ${t('career.pick.lowerXp')}` : ''}`),
        promoId === id ? h('div', { class: 'banner banner-info' }, icon('promoWeek', { size: 20, width: 2 }), h('span', null, t('career.promoWeek.banner', { profession: p0.title }))) : null);
    };
    function renderSheet() {
      const p = p_();
      const st = st_();
      scope.reset?.();
      // Expenses are itemised behind a tertiary text toggle (no fox on the sheet: spec 4.2 / 5).
      const expenseRows = h('div', { class: 'st-rows', id: 'pick-expense-rows', hidden: true },
        ...p.expenses.map((e) => row(e.label, money(e.amount))),
        ...p.liabilities.map((l) => row(l.label, money(l.monthlyPayment))));
      const toggle = h('button', { type: 'button', class: 'st-toggle', 'aria-expanded': 'false', 'aria-controls': 'pick-expense-rows' },
        h('span', null, t('pick.showExpenses')), icon('plus', { size: 20, width: 3 }));
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.firstChild.textContent = open ? t('pick.hideExpenses') : t('pick.showExpenses');
        toggle.lastChild.replaceWith(icon(open ? 'minus' : 'plus', { size: 20, width: 3 }));
        expenseRows.hidden = !open;
      });
      const rk = rankNow(id);
      scroll.replaceChildren(
        h('div', { class: 'pick-head' },
          h('span', { class: 'pick-fox', 'aria-hidden': 'true' }, professionFox(id, { width: 104, eager: true })),
          h('div', null, h('h2', { class: 'dialog-title' }, rk > 0 ? rankTitle(id, rk) : p0.title), h('p', { class: 'muted' }, tn('pick.perMonth', { amount: money(p.salary) })))),
        profile ? rankBlock() : null,
        h('section', { class: 'st-section st-sec-income' },
          row(t('pick.salary'), money(p.salary), 'income'),
          row(t('pick.savings'), money(p.savings))),
        h('section', { class: 'st-section st-sec-expense' },
          h('h3', { class: 'st-title' }, t('pick.expenses')),
          toggle, expenseRows,
          row(t('statement.totalExpenses'), money(st.totalExpenses), 'total')),
        p.liabilities.length ? h('section', { class: 'st-section st-sec-liability' },
          h('h3', { class: 'st-title' }, tn('pick.liabilities', {}, { scope })),
          ...p.liabilities.map((l) => row(l.label, money(l.principal)))) : null,
        row(tn('pick.cashflow', {}, { scope }), money(st.monthlyCashFlow, { sign: true }), 'total'),
        h('div', { class: 'banner banner-info' }, icon('star', { size: 24 }), h('span', null, tn('pick.goal', {}, { scope }))));
    }
    const content = h('div', { class: 'sheet pick-sheet' },
      h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t('a11y.sheetHandle'), onClick: () => layer.close() }, h('i')),
      scroll,
      h('div', { class: 'sheet-cta' }, button(t('pick.go'), { variant: 'primary', size: 'lg', 'data-action': 'go', 'data-autofocus': '', onClick: () => { layer.close(); onGo(id, rankNow(id)); } })));
    renderSheet();
    layer = openLayer(content, { kind: 'sheet', label: p0.title });
  }

  // owner override 2026-10-24b (docs/v4/design/professions.md 2): art well with the profession fox on a hairline floor, the name,
  // salary and expenses on two lines, and the "נשאר בכיס" pill (the same statement() as the preview sheet)
  const cards = professions.map((p, i) => {
    // owner reference (design/character/professions-ref/owner-pick-screen-ref.jpg): the big fox at the top, the name, "שכר ₪X •",
    // "הוצאות ₪Y", and the full-width "נשאר בכיס ₪Z" pill. Every number comes from the live data (the same statement() as the sheet).
    const well = h('span', { class: 'prof-well', 'aria-hidden': 'true' });
    well.append(professionFox(p.id, { width: 108, fallbackHost: well, eager: i < 4 }));
    const flow = figs(p.id, rankNow(p.id)).st.monthlyCashFlow;
    const cur = standingOf(p.id);
    const needNow = cur.rank >= MAX_RANK ? 1 : RANK_XP_NEEDED[cur.rank];
    const pct = cur.rank >= MAX_RANK ? 100 : Math.round((100 * cur.xp) / needNow);
    const title = cur.rank > 0 ? rankTitle(p.id, cur.rank) : t('career.pick.word', { n: 1 });
    const b = h('button', {
      type: 'button', class: `prof-card${promoId === p.id ? ' is-promo' : ''}`, 'data-prof': p.id, vars: { '--i': i },
      onClick: () => { haptic('tap'); preview(p); },
    },
    well,
    promoId === p.id ? h('span', { class: 'pick-promo-x2', 'aria-hidden': 'true' }, icon('promoWeek', { size: 12, width: 2 }), h('bdi', { dir: 'ltr' }, t('career.promoWeek.cardTag'))) : null,
    h('span', { class: 'prof-name' }, p.title),
    // the card stays one button named by its own text (WCAG 2.5.3): the rank title is visible text, the progress is a hidden sentence
    profile ? h('span', { class: 'pick-rank' }, icon(`rank${cur.rank}`, { size: 14, width: 2 }), h('span', null, title)) : null,
    profile ? h('span', { class: 'xp pick-xp', 'aria-hidden': 'true' }, h('i', { style: `--xp:${pct}%` })) : null,
    profile ? h('span', { class: 'vh' }, `${t('career.xp.aria', { pct })}. `) : null,
    h('span', { class: 'prof-rows' },
      h('span', { class: 'prof-row prof-row--salary prof-salary' }, h('span', { class: 'prof-row-label' }, t('pick.cardSalary')), money(p.salary), h('span', { class: 'prof-sep', 'aria-hidden': 'true' }, '•')),
      h('span', { class: 'prof-row prof-row--expenses' }, h('span', { class: 'prof-row-label' }, t('pick.cardExpenses')), money(figs(p.id, rankNow(p.id)).st.totalExpenses))),
    h('span', { class: `prof-pocket${flow < 0 ? ' is-neg' : ''}` }, tn('pick.cardLeftPocket', { amount: money(flow) })));
    return b;
  });

  return h('section', { class: 'screen screen-pick', 'data-screen': 'pick' },
    h('div', { class: 'pick-top' },
      player ? playerToken(player.color, { cls: 'ptoken-lg' }) : null,
      h('div', { class: 'pick-heading' },
        h('h1', { class: 'screen-title' }, player ? t('players.pickTitle', { name: player.name }) : t('pick.title')),
        h('p', { class: 'muted' }, player ? t('players.pickStep', { n: player.n, total: player.total }) : t('pick.subtitleFox')),
        promoId ? h('p', { class: 'pick-promo-strip', 'data-promo-strip': '' }, icon('promoWeek', { size: 16, width: 2 }), h('span', null, t('career.promoWeek.strip', { profession: engine.data.professions.find((x) => x.id === promoId).title }))) : null),
      // the back button at the inline-end (left in RTL), a 48px round ghost centred with the title
      iconButton('arrow', t('pick.back'), onBack, 'icon-btn-glass pick-back')),
    h('div', { class: 'prof-grid' }, cards));
}
