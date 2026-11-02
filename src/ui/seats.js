// Seat order of the players screen (owner bug report 2026-11-02): the device owner is seat 1, at the top, a person with a name
// and an age; extra seats (people or bots) come below it. Pure functions (no DOM), unit-tested in tests/seats.test.js.
// The engine itself accepts an all-bot match (the simulations and the bot tests play them), so the "at least one person" rule
// lives here, on the screen that builds a match for people.

export const BOT_POLICIES = ['cautious', 'sensible', 'alwaysBuy'];
const botOf = (b) => (BOT_POLICIES.includes(b) ? b : null);

/**
 * The seats the screen opens with. A setup whose seat 1 is a bot (a menu return from a match, back from the profession pick)
 * is reordered: people first, bots after them, each seat keeping its own name, age and policy (stable). A setup of bots only
 * gets a person in seat 1. A bot seat's name is not kept (it is the policy's name, derived again on the way out), and neither is
 * a seat's default label (isDefaultName(name, i), e.g. "שחקן 2"): after a move it would name the wrong seat.
 * @returns {{ names: string[], ages: (string|null)[], bots: (string|null)[] }} each `max` long
 */
export function initialSeats({ count = 1, names = [], ages = [], bots = [], max = 4, ageBands = [], isDefaultName = () => false }) {
  const n = Math.max(1, Math.min(count, max));
  const seats = Array.from({ length: max }, (_, i) => {
    const bot = i < n ? botOf(bots[i]) : null;
    return { name: bot || isDefaultName(names[i], i) ? '' : (names[i] || ''), age: !bot && ageBands.includes(ages[i]) ? ages[i] : null, bot };
  });
  if (seats[0].bot) {
    const head = seats.slice(0, n);
    const ordered = [...head.filter((s) => !s.bot), ...head.filter((s) => s.bot)];
    seats.splice(0, n, ...ordered);
    if (seats[0].bot) seats[0] = { name: '', age: null, bot: null }; // bots only: seat 1 becomes the person
  }
  return { names: seats.map((s) => s.name), ages: seats.map((s) => s.age), bots: seats.map((s) => s.bot) };
}

/** May seat i (of the first n) become a bot? Only while another seat stays a person: a match of bots only is not playable. */
export const canBeBot = (bots, i, n) => n > 1 && bots.slice(0, n).some((b, j) => j !== i && !b);

/** The bots of the first n seats as the match gets them: one player is always a person; bots only -> seat 1 is the person. */
export function playableBots(bots, n) {
  const out = Array.from({ length: n }, (_, i) => (n > 1 ? botOf(bots[i]) : null));
  if (out.every(Boolean)) out[0] = null;
  return out;
}
