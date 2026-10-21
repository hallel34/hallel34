// L1: which concepts a moment of the game introduces (spec section 3). Pure.
import { conceptAvailable } from './content.js';

/**
 * Concept ids (in order) a trigger brings up. Triggers:
 *   start            the game begins (the starting debts are on the statement)
 *   statement        the statement is opened (also: the first summary)
 *   summary          the first 'סיכום שנתיים' settles
 *   opportunity      an opportunity card is shown (`card`)
 *   purchase         something was bought (`card`)
 *   reveal           the 'עסקה טובה?' numbers were revealed (or the first purchase when the guess is off)
 *   expense          an expense card is shown
 *   loan             a loan window opens
 *   stockDrop        a stock price fell
 *   diversified      two kinds of assets are owned
 *   networth         the report / statement shows net worth
 */
export function conceptsForTrigger(trigger, { card = null, mode = 'family' } = {}) {
  let ids = [];
  switch (trigger) {
    case 'start': ids = ['liability']; break;
    case 'statement': ids = mode === 'full' ? ['cashflow', 'net_worth'] : ['cashflow']; break;
    case 'summary': ids = ['cashflow']; break;
    case 'opportunity':
      ids = ['passive_income'];
      if (card && card.type !== 'stock') ids.push('down_payment');
      if (card && card.mortgage > 0) ids.push('mortgage');
      if (card?.type === 'stock') ids.push('dividend');
      break;
    case 'purchase': ids = ['asset']; break;
    case 'reveal': ids = ['yield', 'payback']; break;
    case 'expense': ids = ['cushion']; break;
    case 'loan': ids = ['interest']; break;
    case 'stockDrop': ids = ['diversification']; break;
    case 'diversified': ids = ['diversification']; break;
    case 'networth': ids = ['net_worth']; break;
    default: ids = [];
  }
  return ids.filter((id) => conceptAvailable(id, mode));
}

/** First queued concept that was not seen yet and exists in this mode, or null. */
export function nextExplainer(queue, seen, mode) {
  return queue.find((id) => !seen.has(id) && conceptAvailable(id, mode)) ?? null;
}

/** Adds ids to a queue (no duplicates, nothing already seen). Returns the new queue. */
export function enqueue(queue, ids, seen) {
  const out = [...queue];
  for (const id of ids) if (!seen.has(id) && !out.includes(id)) out.push(id);
  return out;
}
