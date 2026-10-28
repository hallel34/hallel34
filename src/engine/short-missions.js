// Explicit, independent practice scenarios. Never alter ordinary-game card data.
import { newMatch, currentState, setCurrentState } from './match.js';
import { monthlyCashFlow, loanPayments } from './selectors.js';

export const REPAY_MISSION = 'repay-debt-v1';
export const BUFFER_MISSION = 'cash-buffer-v1';
export const SHORT_MISSIONS = [REPAY_MISSION, BUFFER_MISSION];
export const isShortMission = (id) => SHORT_MISSIONS.includes(id);
export const practiceSlot = (id) => {
  if (!isShortMission(id)) throw new Error('Unknown short mission');
  return `missionSave.${id}`;
};

export function newShortMission(engine, id) {
  if (!isShortMission(id)) throw new Error('Unknown short mission');
  let match = newMatch(engine, {
    mode: 'family', seed: id === REPAY_MISSION ? 34002 : 34003,
    players: [{ professionId: 'teacher' }],
  });
  if (id === BUFFER_MISSION) {
    const original = engine.data.cards.find((c) => c.id === 'exp-001');
    if (!original) throw new Error('Missing practice expense');
    // The scenario explicitly offers two funding choices for the original cost.
    // Existing engine.decide applies both the expense and financing atomically.
    const card = {
      ...original, id: 'practice-cash-buffer', square: 'expense', type: 'decision', expenseLoan: true,
      options: [
        { id: 'cash', effects: { pay: original.amount } },
        { id: 'loan', effects: { loan: 5000, pay: original.amount } },
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
