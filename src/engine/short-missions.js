// Explicit, independent practice scenarios. Never alter ordinary-game card data.
import { newMatch, currentState, setCurrentState } from './match.js';
import { monthlyCashFlow, loanPayments, loanStep } from './selectors.js';

export const REPAY_MISSION = 'repay-debt-v1';
export const BUFFER_MISSION = 'cash-buffer-v1';
export const SHORT_MISSIONS = [REPAY_MISSION, BUFFER_MISSION];
export const isShortMission = (id) => SHORT_MISSIONS.includes(id);
/** A junior variant (a 'צעירים' match) keeps its own slot, so switching the age band never overwrites the other variant's save. */
export const practiceSlot = (id, { junior = false } = {}) => {
  if (!isShortMission(id)) throw new Error('Unknown short mission');
  return `missionSave.${id}${junior ? '.junior' : ''}`;
};

/**
 * @param age the player's age band or null. 'upTo10' is the junior variant: the same scenario on the junior round rules (whole
 *   coins; bank loans in 10,000 steps, so the buffer mission borrows one junior step instead of 5,000).
 */
export function newShortMission(engine, id, { age = null } = {}) {
  if (!isShortMission(id)) throw new Error('Unknown short mission');
  let match = newMatch(engine, {
    mode: 'family', seed: id === REPAY_MISSION ? 34002 : 34003,
    players: [{ professionId: 'teacher', age }],
  });
  if (id === BUFFER_MISSION) {
    const original = engine.data.cards.find((c) => c.id === 'exp-001');
    if (!original) throw new Error('Missing practice expense');
    // The scenario explicitly offers two funding choices for the original cost.
    // Existing engine.decide applies both the expense and financing atomically.
    // The smallest whole number of loan steps that covers the cost: 5,000 (1,000 steps), or 10,000 in the junior variant.
    const step = loanStep(currentState(match));
    const card = {
      ...original, id: 'practice-cash-buffer', square: 'expense', type: 'decision', expenseLoan: true,
      options: [
        { id: 'cash', effects: { pay: original.amount } },
        { id: 'loan', effects: { loan: Math.ceil(original.amount / step) * step, pay: original.amount } },
      ],
    };
    match = setCurrentState(match, {
      ...currentState(match), phase: 'decision', pending: { kind: 'decision', card },
    });
  }
  return { ...match, mission: { id, stage: 'offer' } };
}

const owed = (s) => s.liabilities.reduce((sum, l) => sum + l.principal, 0);
const figures = (s) => ({
  cash: s.cash, debt: owed(s), flow: monthlyCashFlow(s), payment: loanPayments(s),
});

/** Previews and commits share the same pure real-engine operation. */
export function resolveShortMission(engine, match, choice) {
  const id = match?.mission?.id;
  if (!isShortMission(id) || match.mission.stage !== 'offer') throw new Error('No practice decision available');
  const before = currentState(match);
  let after;
  if (id === REPAY_MISSION) {
    if (choice === 'repay') {
      const debt = before.liabilities.find((l) => l.id === 'card');
      if (!debt) throw new Error('Practice credit-card debt missing');
      after = engine.repayLoan(before, debt.id, debt.principal);
    } else if (choice === 'keep') {
      after = before;
    } else throw new Error('Unknown repayment choice');
  } else {
    if (!['cash', 'loan'].includes(choice)) throw new Error('Unknown expense choice');
    after = engine.decide(before, choice);
  }
  const from = figures(before);
  const to = figures(after);
  return {
    ...setCurrentState(match, after),
    mission: { id, stage: 'complete', choice, feedback: { before: from, after: to, netChange: to.flow - from.flow } },
  };
}

export function continueShortMission(match) {
  if (!isShortMission(match?.mission?.id) || match.mission.stage !== 'complete') {
    throw new Error('Finish the practice decision first');
  }
  return { ...match, mission: { ...match.mission, stage: 'freeplay' } };
}

/** Validate persisted metadata before rendering it. The game save version stays unchanged. */
export function validShortMission(engine, match, expectedId) {
  try {
    if (!match || !isShortMission(expectedId) || match.mission?.id !== expectedId
      || match.daily || match.mode !== 'family' || match.players?.length !== 1 || match.currentIndex !== 0
      || currentState(match).profession?.id !== 'teacher'
      || !['offer', 'complete', 'freeplay'].includes(match.mission.stage)) return false;
    const s = currentState(match);
    if (!Array.isArray(s.liabilities) || !Array.isArray(s.assets) || !Number.isFinite(s.cash)) return false;
    if (match.mission.stage === 'offer') {
      const choices = expectedId === REPAY_MISSION ? ['repay', 'keep'] : ['cash', 'loan'];
      return choices.every((c) => Number.isFinite(resolveShortMission(engine, match, c).mission.feedback.netChange));
    }
    // A freeplay rematch intentionally has no previous decision feedback.
    if (match.mission.stage === 'freeplay') return true;
    const f = match.mission.feedback;
    const choices = expectedId === REPAY_MISSION ? ['repay', 'keep'] : ['cash', 'loan'];
    return choices.includes(match.mission.choice) && Number.isFinite(f?.netChange)
      && ['before', 'after'].every((side) => ['cash', 'debt', 'flow', 'payment'].every((key) => Number.isFinite(f?.[side]?.[key])));
  } catch { return false; }
}

/**
 * The figures a short mission's texts name ({cash}, {debt}, ...), read from a fresh copy of the scenario (the same variant as
 * `match`) and its real-engine previews, so the words always match the rules, in shekels or in a junior game's coins.
 */
export function shortMissionFacts(engine, match) {
  const id = match?.mission?.id;
  const fresh = newShortMission(engine, id, { age: match.players?.[0]?.age ?? null });
  const s = currentState(fresh);
  if (id === REPAY_MISSION) {
    const card = s.liabilities.find((l) => l.id === 'card');
    const repaid = currentState(resolveShortMission(engine, fresh, 'repay'));
    return { cash: s.cash, debt: card.principal, payment: card.monthlyPayment, left: repaid.cash };
  }
  const card = s.pending.card;
  const opt = (o) => card.options.find((x) => x.id === o).effects;
  const viaCash = resolveShortMission(engine, fresh, 'cash').mission.feedback;
  const viaLoan = resolveShortMission(engine, fresh, 'loan').mission.feedback;
  return {
    cost: opt('cash').pay, step: loanStep(s), loan: opt('loan').loan,
    cashLeft: viaCash.after.cash, loanCash: viaLoan.after.cash, interest: viaLoan.after.payment - viaLoan.before.payment,
  };
}
