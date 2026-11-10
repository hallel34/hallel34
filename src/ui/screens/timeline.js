// 0.5.1 replay timeline "צפייה חוזרת" (spec §5): read-only, built by replaying both logs. A vertical list of turns (no horizontal
// scroll at any width): the shared spine (both players are always on the same square in a challenge), one lane per player, and
// the split rows marked by a tint, a bar, the split icon and a sentence (never colour alone). Lazy chunk.
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { t, tp } from '../../i18n/index.js';
import { icon } from '../icons.js';
import { openLayer, closeButton } from '../modal.js';
import { money, tn } from '../format.js';
import { motionOK } from '../prefs.js';
import { tileIcon, tileLabel } from '../tiles.js';
import { professionBust } from '../professions.js';
import { ct, ckey, themPhrase, isJuniorView } from '../challenge/copy.js';
import { takeawayNodes, pairRows } from './compare.js';
import { takeawayOf } from '../../engine/index.js';

/** The decision words of one lane on one turn ("הלוואה · קנייה"), and its subline (the card title, or "10% מההכנסה"). */
export function laneText(lane) {
  if (!lane) return { act: '—', sub: '' };
  const acts = [];
  let sub = '';
  if (lane.loans.some((l) => l.purpose !== 'expense')) acts.push(ct('timeline.act.loan'));
  if (lane.bought) { acts.push(ct('timeline.act.bought')); sub = lane.bought.title; }
  else if (lane.passed) { acts.push(ct('timeline.act.passed')); sub = lane.passed.title; }
  if (lane.expense) { acts.push(ct(lane.expense.via === 'loan' ? 'timeline.act.expenseLoan' : 'timeline.act.expenseCash')); sub ||= lane.expense.title ?? ''; }
  if (lane.charity === 'donated') { acts.push(ct('timeline.act.charity')); sub ||= ct('timeline.charitySub'); }
  if (lane.repaid.length) acts.push(ct('timeline.act.repay'));
  if (lane.end) acts.push(ct(lane.end === 'won' ? 'timeline.act.freedom' : 'timeline.act.end'));
  if (!acts.length) return { act: '—', sub: lane.card?.title ?? tileLabel(lane.square) };
  return { act: acts.join(' · '), sub };
}

/** The why-line of a split row (impersonal, no gender), as nodes. */
function whyLine(row, themName) {
  const { you: y, them: th, turn, split } = row;
  const them = themPhrase(themName);
  const k = split[0];
  const line = (key, params) => tn(ckey(`timeline.${key}`), { turn: String(turn), them, ...params });
  if (k === 'deal') return y.bought ? line('youBought', { deal: y.bought.title }) : line('themBought', { deal: th.bought?.title ?? th.passed?.title ?? '' });
  if (k === 'loan') {
    const mine = y.loans.find((l) => l.purpose !== 'expense');
    const theirs = th.loans.find((l) => l.purpose !== 'expense');
    return mine ? line('youLoan', { amount: money(mine.amount) }) : line('themLoan', { amount: money(theirs?.amount ?? 0) });
  }
  if (k === 'expense') return line(y.expense?.via === 'loan' ? 'expenseLoanYou' : 'expenseLoanThem', {});
  if (k === 'charity') return line(y.charity === 'donated' ? 'charityYou' : 'charityThem', {});
  return y.repaid.length ? line('repayYou', { amount: money(y.repaid[0].amount) }) : line('repayThem', { amount: money(th.repaid[0]?.amount ?? 0) });
}

/**
 * @param me / them  verifyResult of both logs (both verified: the button is disabled otherwise)
 * @param focusTurn  the takeaway turn to scroll to (or null)
 */
export function createTimeline({ engine, me, them, themName = '', professionId, focusTurn = null, onBack }) {
  const rows = pairRows(engine, me, them) ?? [];
  const lastTurn = (side) => rows.reduce((n, r) => (r[side] ? r.turn : n), 0);
  const visible = rows.filter((r) => r.you || r.them);
  const splits = visible.filter((r) => r.split.length);
  const total = visible.length;
  const lane = (side) => (side === 'you' ? ct('timeline.laneYou') : themName || ct('timeline.laneThemAnon'));
  const takeTurn = focusTurn ?? takeawayOf(rows, { verified: true })[0]?.turn ?? null;
  const takeLine = takeawayOf(rows, { verified: true })[0] ?? null;

  const srText = splits.length
    ? ct('timeline.srSummary', { total: String(total), splits: tp('plural.turnsIn', splits.length), list: splits.map((r) => h('span', null, whyLine(r, themName)).textContent).join('; ') })
    : ct('timeline.srSummaryNone', { total: String(total) });

  const strip = h('div', { class: 'tl-strip', 'aria-hidden': 'true' }, visible.map((r) => h('i', { class: r.split.length ? 'is-split' : '' })));
  const list = h('ol', { class: 'tl-list', 'aria-label': srText, 'data-timeline': '' });
  const items = [];
  for (const r of visible) {
    const y = laneText(r.you);
    const th = laneText(r.them);
    const split = r.split.length > 0;
    const why = split ? whyLine(r, themName) : null;
    const square = (r.you ?? r.them).square;
    // QA 0.5.1 P2-2 (WCAG 2.5.3): no aria-label; the name is the row's own text, with the lane names as visually hidden
    // prefixes ("אתם, תור 4: דילוג. …"), so voice control can say what it sees
    const vh = (text) => h('span', { class: 'vh' }, text);
    const btn = h('button', { type: 'button', class: `tl-row${split ? ' is-split' : ''}`, 'data-turn': String(r.turn), 'data-split': String(split), onClick: () => openTurn(r) },
      h('span', { class: 'tl-lane', 'data-side': 'you' }, vh(`${ct('timeline.srCell', { lane: lane('you'), turn: String(r.turn), action: '' }).trim()} `), h('b', null, y.act), y.sub ? h('span', { class: 'tl-sub' }, vh(' '), y.sub) : null, vh('. ')),
      h('span', { class: 'tl-spine', 'aria-hidden': 'true' }, h('bdi', { class: 'tl-turn', dir: 'ltr' }, String(r.turn)), tileIcon(square, { size: 18 })),
      h('span', { class: 'tl-lane', 'data-side': 'them' }, vh(`${ct('timeline.srCell', { lane: lane('them'), turn: String(r.turn), action: '' }).trim()} `), h('b', null, th.act), th.sub ? h('span', { class: 'tl-sub' }, vh(' '), th.sub) : null, vh('. ')),
      why ? h('span', { class: 'tl-why' }, icon('split', { size: 16, width: 2 }), h('span', null, why)) : null,
      !split && r.otherCard ? h('span', { class: 'tl-other' }, ct('timeline.sameTurnOtherCard')) : null);
    const li = h('li', { class: 'tl-item', 'data-split': String(split) }, btn);
    list.append(li);
    items.push(li);
    for (const side of ['you', 'them']) {
      if (r[side]?.end) {
        const key = r[side].end === 'won' ? (side === 'you' ? 'freedomYou' : 'freedomThem') : (side === 'you' ? 'endYou' : 'endThem');
        list.append(h('li', { class: 'tl-item tl-end', 'data-end': side, 'data-split': 'end' }, icon('verified', { size: 18, width: 2 }), h('span', null, ct(`timeline.${key}`, { turn: String(r.turn), them: themPhrase(themName) }))));
      }
    }
  }
  void lastTurn;

  // ---- filter: "כל התורות" (default) / "רק ההבדלים"; hidden with no split ----
  let filter = null;
  if (splits.length) {
    const chip = (id, label) => {
      const input = h('input', { type: 'radio', name: 'tl-filter', value: id, class: 'age-input', 'data-filter': id, checked: id === 'all' || null });
      input.addEventListener('change', () => { if (input.checked) list.dataset.only = id === 'splits' ? 'splits' : ''; });
      return h('label', { class: 'age-chip tl-chip' }, input, h('span', { class: 'age-chip-text' }, label));
    };
    filter = h('fieldset', { class: 'tl-filter' }, h('legend', { class: 'vh' }, ct('timeline.title')), h('div', { class: 'tl-chips' }, chip('splits', ct('timeline.filterSplits')), chip('all', ct('timeline.filterAll'))));
  }
  const sub = h('p', { class: 'tl-subhead' }, ct('timeline.sub'), ' · ', splits.length ? ct('timeline.count', { n: String(splits.length), total: String(total) }) : ct('timeline.noSplit'));
  const laneHead = h('div', { class: 'tl-lanes', 'aria-hidden': 'true' },
    h('span', { class: 'tl-lane-head' }, h('span', { class: 'cmp-avatar sm' }, professionBust(professionId)), lane('you')),
    h('span', { class: 'tl-lane-head tl-spine-head' }, tp('plural.label.turns', 1)),
    h('span', { class: 'tl-lane-head' }, h('span', { class: 'cmp-avatar sm' }, professionBust(professionId)), lane('them')));

  function openTurn(r) {
    let layer;
    const col = (side) => {
      const x = r[side];
      const txt = laneText(x);
      const deal = x?.bought ?? null;
      const loan = x?.loans.find((l) => l.purpose !== 'expense') ?? x?.loans[0] ?? null;
      return h('section', { class: 'tl-col', 'data-side': side },
        h('h3', { class: 'tl-col-head' }, lane(side)),
        h('p', { class: 'tl-col-act' }, txt.act),
        // the card's own labels (family: "התשלום הראשון", "נשאר בחודש"); a junior viewer gets no loan principal (spec §7)
        deal ? h('p', { class: 'tl-col-line' }, `${t('card.downPayment')}: `, money(deal.downPayment)) : null,
        deal ? h('p', { class: 'tl-col-line' }, `${t('card.monthlyCashFlow')}: `, money(deal.monthly, { sign: true })) : null,
        loan && !isJuniorView() ? h('p', { class: 'tl-col-line' }, `${ct('timeline.act.loan')}: `, money(loan.amount)) : null,
        x ? h('div', { class: 'tl-after' }, h('p', { class: 'tl-after-head' }, ct('timeline.after')),
          h('p', null, tn(ckey('timeline.afterCash'), { cash: money(x.cash) })),
          h('p', null, ct('timeline.afterFreedom', { pct: String(x.freedomPct) }))) : null);
    };
    const card = (r.you ?? r.them).card;
    const content = h('div', { class: 'sheet tl-sheet', 'data-sheet': 'turn' },
      h('div', { class: 'sheet-head' }, h('h2', { class: 'dialog-title' }, `${ct('timeline.turnLabel', { turn: String(r.turn) })} · ${tileLabel((r.you ?? r.them).square)}`), closeButton(() => layer.close())),
      h('div', { class: 'tl-sheet-body' },
        card ? h('p', { class: 'tl-card-title' }, card.title) : null,
        h('div', { class: 'tl-cols' }, col('you'), col('them')),
        takeLine && r.turn === takeTurn ? h('p', { class: 'tl-take' }, takeawayNodes(takeLine, themName)) : null));
    layer = openLayer(content, { kind: 'sheet', label: ct('timeline.turnLabel', { turn: String(r.turn) }), cls: 'layer-tl' });
  }

  const back = h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': t('common.back'), 'data-action': 'tl-back', onClick: onBack }, icon('arrow', { size: 22 }));
  const el = h('section', { class: 'screen screen-ch screen-timeline', 'data-screen': 'timeline' },
    h('div', { class: 'ch-top tl-top' }, back, h('h1', { class: 'ch-kicker tl-title', tabindex: '-1', 'data-autofocus': '' }, ct('timeline.title')), h('span', { class: 'tl-top-pad' })),
    sub, strip, filter, laneHead, list);
  return {
    el,
    start() {
      const target = takeTurn ? list.querySelector(`[data-turn="${takeTurn}"]`) : null;
      if (target) {
        target.scrollIntoView?.({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
        target.classList.add('is-focus');
        setTimeout(() => target.classList.remove('is-focus'), 1200);
      }
    },
  };
}
