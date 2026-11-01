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

/**
 * The terse full-mode lines of a group: `commentary.<group>` plus its variants `<key>_2`, `<key>_3`, ... (locale file only,
 * so adding a variant is a JSON edit). `lookup(key)` returns the string or undefined.
 */
export function commentaryVariants(group, lookup) {
  const base = 'commentary.' + group.replaceAll('.', '_');
  const out = [];
  const first = lookup(base);
  if (typeof first !== 'string') return out;
  out.push(first);
  for (let i = 2; ; i++) {
    const s = lookup(`${base}_${i}`);
    if (typeof s !== 'string') break;
    out.push(s);
  }
  return out;
}

/**
 * Picks the terse line of a group: rotates through its variants and never repeats the last line shown for that group
 * (the filled text, shared by all players on the device, so a hot-seat match never shows the same line twice in a row).
 * `fill(template)` -> the plain text that will be on screen; `start` = the first rotation index (a seeded pick).
 */
export function createCommentaryPicker() {
  const next = new Map(); // group -> rotation index
  const lastText = new Map(); // group -> last plain text shown
  return (group, variants, fill, start0 = 0) => {
    if (!variants.length) return null;
    const start = next.get(group) ?? start0;
    let pick = start % variants.length;
    for (let k = 0; k < variants.length; k++) {
      const i = (start + k) % variants.length;
      if (fill(variants[i]) !== lastText.get(group)) { pick = i; break; }
    }
    next.set(group, pick + 1);
    lastText.set(group, fill(variants[pick]));
    return variants[pick];
  };
}
