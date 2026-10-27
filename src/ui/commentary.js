// Presentation-only pacing. Decisions and figures remain in the engine/report.
// Each player owns their own history; warnings never get hidden by a recent success.
export function createCommentaryGate({ cooldown = 4 } = {}) {
  const last = new Map();
  return (request, { player, turn }) => {
    if (request.tone === 'warn' || request.group === 'expense.forcedSale') return true;
    const category = request.group.startsWith('buy.') && request.group !== 'buy.diversify'
      ? 'buy' : request.group.startsWith('pass.') ? 'pass' : request.group;
    const key = `${player}|${category}`;
    const previous = last.get(key);
    if (previous != null && turn >= previous && turn - previous < cooldown) return false;
    last.set(key, turn);
    return true;
  };
}

