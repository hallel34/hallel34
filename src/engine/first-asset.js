// Explicit practice scenario. No random-deck manipulation in ordinary games.
import { newMatch, currentState, setCurrentState } from './match.js';
import { cardView } from './card-view.js';
import { purchasePlan, monthlyCashFlow, passiveRatio, loanPayments } from './selectors.js';

export const FIRST_ASSET_ID = 'first-asset-v1';
export const FIRST_ASSET_BADGE = 'first-asset';

export function newFirstAsset(engine) {
  const match = newMatch(engine, {
    mode: 'family', seed: 34001, players: [{ professionId: 'teacher' }],
  });
  const card = engine.data.cards.find((c) => c.id === 'opp-biz-006');
  if (!card) throw new Error('First-asset opportunity is missing');
  const state = {
    ...currentState(match), phase: 'decision',
    pending: { kind: 'opportunity', card: cardView(card, 'family') },
  };
  return {
    ...setCurrentState(match, state),
    mission: { id: FIRST_ASSET_ID, stage: 'offer' },
  };
}

/** Run the real loan and purchase rules for an accurate preview and commit. */
export function firstAssetPurchase(engine, match) {
  if (match.mission?.id !== FIRST_ASSET_ID || match.mission.stage !== 'offer') {
    throw new Error('First-asset purchase is not available');
  }
  const before = currentState(match);
  const card = before.pending?.card;
  if (!card || before.pending.kind !== 'opportunity') throw new Error('No practice opportunity');
  const plan = purchasePlan(before, card.downPayment);
  if (plan.status === 'blocked') throw new Error('Practice purchase cannot be financed');
  let after = before;
  if (plan.loanAmount > 0) after = engine.takeLoan(after, plan.loanAmount);
  after = engine.buy(after);
  const feedback = {
    gross: card.profit,
    businessPayment: card.loanPayment,
    assetNet: card.monthlyCashFlow,
    bankLoan: plan.loanAmount,
    bankPayment: loanPayments(after) - loanPayments(before),
    netChange: monthlyCashFlow(after) - monthlyCashFlow(before),
    beforeFlow: monthlyCashFlow(before),
    afterFlow: monthlyCashFlow(after),
    beforeProgress: passiveRatio(before) * 100,
    afterProgress: passiveRatio(after) * 100,
  };
  return {
    ...setCurrentState(match, after),
    mission: { id: FIRST_ASSET_ID, stage: 'complete', feedback },
  };
}

export function declineFirstAsset(engine, match) {
  if (match.mission?.stage !== 'offer') throw new Error('No practice offer to decline');
  return {
    ...setCurrentState(match, engine.pass(currentState(match))),
    mission: { id: FIRST_ASSET_ID, stage: 'declined' },
  };
}

export function continueFirstAsset(match) {
  if (!['complete', 'declined'].includes(match.mission?.stage)) throw new Error('Finish the practice decision first');
  return { ...match, mission: { ...match.mission, stage: 'freeplay' } };
}
