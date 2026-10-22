// Family-mode HUD additions (spec sections 4 and 6): the 'נשאר בחודש' chip and its popover (money in, money out, what is left),
// the goal line above the meter and the 'עוד X בחודש לחופש' line under it. Pure presentation of engine numbers.
import { h } from './dom.js';
import { icon } from './icons.js';
import { money, moneyText, numberText } from './format.js';
import { animate } from './fx.js';
import { motionOK } from './prefs.js';
import { statement, PAYDAY_MONTHS } from '../engine/index.js';
import { freedomView } from '../learn/tutorial.js';
import { tut, fillNodes } from './hint-ui.js';
import { fillSlots } from '../learn/slots.js';
import { t } from '../i18n/index.js';

/** At or below this viewport height the goal line is the minimal one-liner. */
export const GOAL_MIN_HEIGHT = 600;

/** 'משכורת {salary}' -> ['משכורת', node]: the label at the inline-start, the amount at the inline-end of one row. */
function splitRow(template, slot, node) {
  const [before, after = ''] = template.split(`{${slot}}`);
  return [`${before}${after}`.replace(/\s+/g, ' ').trim(), node];
}

/** The chip text 'נשאר בחודש +₪4,090' (plain, for aria and tests). */
export const flowChipText = (monthly) => fillSlots(tut().hudFamily.chip, { monthlySigned: moneyText(monthly, { sign: true }) });

/**
 * @param hud       the .hud element (the popover anchors under it)
 * @param chip      the flow chip <button>
 */
export function createFamilyHud({ hud, chip, goalLine, freeLine }) {
  let open = false;
  let pop = null;
  let last = null;
  const popId = 'flow-popover';

  /** The compact 'בכל חודש' popover: (money in) - (money out) = what is left, in two short rows so it never covers the board. */
  function build(st) {
    const hf = tut().hudFamily;
    const income = st.salary + st.passiveIncome;
    const left = st.monthlyCashFlow;
    const [salaryLabel, salaryAmt] = splitRow(hf.incomeRows[0], 'salary', money(st.salary));
    const [passiveLabel, passiveAmt] = splitRow(hf.incomeRows[1], 'passive', money(st.passiveIncome, { sign: st.passiveIncome < 0 }));
    return h('div', { class: 'flow-popover', id: popId, role: 'group', 'aria-label': hf.popoverTitle, 'data-flow-popover': '', 'data-negative': String(left < 0) },
      h('span', { class: 'fp-tail', 'aria-hidden': 'true' }),
      h('div', { class: 'fp-eq' },
        h('section', { class: 'fp-cell fp-in' },
          h('h3', { class: 'fp-head' }, h('i', { class: 'fp-dot' }), hf.incomeTitle),
          h('p', { class: 'fp-total' }, fillNodes(hf.incomeTotal, { income: money(income) })),
          h('p', { class: 'fp-sub' }, salaryLabel, ' ', salaryAmt, ' + ', passiveLabel, ' ', passiveAmt)),
        h('span', { class: 'fp-op', 'aria-hidden': 'true' }, '−'),
        h('section', { class: 'fp-cell fp-out' },
          h('h3', { class: 'fp-head' }, h('i', { class: 'fp-dot' }), hf.outTitle),
          h('p', { class: 'fp-total' }, fillNodes(hf.outRows[0], { expenses: money(st.totalExpenses) })))),
      h('p', { class: `fp-left ${left < 0 ? 'is-negative' : 'is-positive'}`, 'data-fp': 'left' }, fillNodes(hf.resultRow, { monthly: money(left, { sign: true }) })),
      // '{monthly} × 24' is one unbreakable unit: it never wraps in the middle
      h('p', { class: 'fp-foot' }, fillNodes(hf.arrivalLine.replace('{monthly} × {months}', '{calc}'), { calc: h('bdi', { class: 'nowrap money', dir: 'ltr' }, `${moneyText(left)} × ${numberText(PAYDAY_MONTHS)}`), monthly: money(left), months: numberText(PAYDAY_MONTHS) })));
  }

  function paintPop(st) {
    if (!pop) return;
    const next = build(st);
    pop.replaceWith(next);
    pop = next;
  }

  function setOpen(want) {
    if (want === open) return;
    open = want;
    chip.setAttribute('aria-expanded', String(open));
    chip.classList.toggle('is-open', open);
    if (open) {
      pop = build(last);
      hud.append(pop);
      if (motionOK()) animate(pop, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      else animate(pop, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    } else {
      const gone = pop;
      pop = null;
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      if (gone) {
        if (motionOK()) animate(gone, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' }).finished.then(() => gone.remove(), () => gone.remove());
        else gone.remove();
      }
    }
  }
  function onOutside(e) { if (!pop) return; if (!pop.contains(e.target) && !chip.contains(e.target)) setOpen(false); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); chip.focus?.({ preventScroll: true }); } }
  chip.setAttribute('aria-controls', popId);
  chip.addEventListener('click', () => setOpen(!open));

  return {
    /** Paints the chip, the goal line and the 'how far' line for the current state. `goal` = show the first-timer lines. */
    refresh(state, { goal = false } = {}) {
      const st = statement(state);
      last = st;
      chip.replaceChildren(h('span', { class: 'fc-text' }, fillNodes(tut().hudFamily.chip, { monthlySigned: money(st.monthlyCashFlow, { sign: true }) })), icon('arrow', { size: 14, width: 3, cls: 'fc-chev' }));
      chip.classList.toggle('is-negative', st.monthlyCashFlow < 0);
      chip.setAttribute('aria-label', flowChipText(st.monthlyCashFlow));
      if (open) paintPop(st);
      const gl = tut().goalLine;
      goalLine.hidden = !goal;
      freeLine.hidden = !goal;
      if (goal) {
        const short = window.matchMedia?.(`(max-height: ${gl.shortFromHeightPx}px)`).matches;
        const minimal = window.matchMedia?.(`(max-height: ${GOAL_MIN_HEIGHT}px)`).matches; // never hidden: at the smallest screens it is one short line
        goalLine.textContent = minimal ? t('goal.min') : short ? gl.textShort : gl.text;
        const fv = freedomView(state);
        goalLine.setAttribute('aria-label', fillSlots(gl.a11y, { left: moneyText(fv.left) }));
        freeLine.replaceChildren(freeText(fv, gl.progress));
        freeLine.dataset.kind = fv.kind;
      }
    },
    close: () => setOpen(false),
    get isOpen() { return open; },
    destroy() { setOpen(false); },
  };
}

/** 'עוד ₪6,410 בחודש לחופש' / 'כמעט חופשיים! עוד ...' / 'ממש על הקו! עוד קצת' / 'חופשיים!' */
function freeText(fv, p) {
  const tpl = { won: p.won, onTheLine: p.onTheLine, almost: p.almost, left: p.text }[fv.kind];
  return fillNodes(tpl, { left: money(fv.left) });
}
