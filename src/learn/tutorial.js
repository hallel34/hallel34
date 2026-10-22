// 'המשחק הראשון עם פסיבו': the pure rules (no DOM, no storage, no Date). Story numbers, the itemised summary, the goal line,
// the hint scheduler and the quiz. docs/v2/tutorial/spec.md is the authority; the wording lives in tutorial.he.json.
import {
  passiveIncome, totalExpenses, loanPayments, loanTerms, paybackYears, PAYDAY_MONTHS,
} from '../engine/index.js';

// ---------- device rules ----------
/** Finished games after which the goal line goes away (CEO decision, spec question 3). */
export const GOAL_LINE_GAMES = 3;
/** The guided hints belong to the first game only. */
export const HINT_GAMES = 1;
/** In the first game the concept explainers wait until this turn (the story and the hints cover the early ones). */
export const EXPLAIN_FROM_TURN = 7;
/** Concepts the story covers: marked as seen once the story was played to the end. */
export const STORY_COVERED = ['cashflow', 'passive_income', 'down_payment', 'interest', 'cushion'];
/** The generic family tips of turns 1-3 give way to the hints in the first game. */
export const TIPS_REPLACED_UNTIL_TURN = 3;

/** Goal line + 'עוד X בחודש לחופש': family mode, the settings switch on, fewer than GOAL_LINE_GAMES finished games. */
export const goalLineVisible = ({ mode, helpOn = true, gamesFinished = 0 }) => mode === 'family' && helpOn !== false && gamesFinished < GOAL_LINE_GAMES;
/** Guided hints: family mode, not the daily challenge, the switch on, the first game of this device. */
export const hintsActive = ({ mode, helpOn = true, gamesFinished = 0, daily = false }) => mode === 'family' && !daily && helpOn !== false && gamesFinished < HINT_GAMES;
/** True when the generic family tip of this turn is replaced by the hints. */
export const tipReplaced = ({ active, turn }) => !!active && turn >= 1 && turn <= TIPS_REPLACED_UNTIL_TURN;
/** May a concept explainer show this turn? (First game with hints: only from EXPLAIN_FROM_TURN.) */
export const explainerAllowed = ({ active, turn }) => !active || turn >= EXPLAIN_FROM_TURN;

// ---------- how close to freedom ----------
/** max(0, expenses - passive): what is still missing, per month. */
export const leftToFreedom = (s) => Math.max(0, totalExpenses(s) - passiveIncome(s));
/**
 * Where am I? kind: 'won' (passive above expenses), 'onTheLine' (exactly equal: winning needs MORE), 'almost' (75% or more),
 * 'left' (otherwise). `left` is always max(0, expenses - passive).
 */
export function freedomView(s) {
  const passive = passiveIncome(s);
  const expenses = totalExpenses(s);
  const left = Math.max(0, expenses - passive);
  const pct = expenses > 0 ? passive / expenses : 0;
  const kind = passive > expenses ? 'won' : passive === expenses && expenses > 0 ? 'onTheLine' : pct >= 0.75 ? 'almost' : 'left';
  return { kind, left, pct, passive, expenses };
}

// ---------- the itemised summary card ----------
/**
 * The figures of one 'סיכום שנתיים': salary + passive - expenses = monthly; monthly x months = amount. They come from the
 * player's state (the same numbers as the HUD) and the engine's payday event; `check` is true when both agree.
 */
export function summaryFigures(state, payday, cashBefore = state.cash) {
  const salary = state.profession.salary;
  const passive = passiveIncome(state);
  const expenses = totalExpenses(state);
  const monthly = salary + passive - expenses;
  const months = payday?.months ?? PAYDAY_MONTHS;
  const amount = payday ? payday.amount : monthly * months;
  return {
    salary, passive, expenses, monthly, months, amount, cashBefore, cashAfter: cashBefore + amount,
    negative: monthly < 0, hasPassive: passive > 0, hasLoss: passive < 0,
    check: salary + passive - expenses === monthly && monthly * months === amount && (!payday || payday.monthly === monthly),
  };
}

/**
 * The three rows of the summary card as data: salary + money that works (signed: a money-losing asset makes it negative) - expenses.
 * `reconciles` = the rows add up to the monthly result AND monthly x months = the amount that reaches the cash.
 */
export function summaryRowModel(f) {
  const kind = f.passive < 0 ? 'loss' : f.passive > 0 ? 'income' : 'none';
  const rows = [
    { id: 'salary', value: f.salary },
    { id: 'passive', value: f.passive, kind },
    { id: 'expenses', value: -f.expenses },
  ];
  const sum = rows.reduce((a, r) => a + r.value, 0);
  return { rows, sum, reconciles: sum === f.monthly && f.monthly * f.months === f.amount };
}

/**
 * 'apartment' | 'business' when exactly ONE asset has a cash flow (the first-income hint may name it), else 'many':
 * with several income assets (or a money-losing one next to them) the total belongs to all of them, never to the last one bought.
 */
export function assetKindOf(state) {
  const flowing = (state.assets ?? []).filter((a) => a.type !== 'stock' && a.monthlyCashFlow !== 0);
  return flowing.length === 1 ? flowing[0].type : flowing.length > 1 ? 'many' : 'apartment';
}

// ---------- story numbers (spec section 1 and 2) ----------
export const STORY_CARDS = { cart: 'opp-biz-006', apartment: 'opp-apt-004' };

/**
 * Slot values of the story screens for a profession (a newGame state) and the cards. Money is returned as numbers; the UI
 * formats them. Screen 4 is the fixed 10,000 example (loanTerms), the rest follows the chosen profession.
 */
export function storyFigures(state, cards) {
  const card = (id) => cards.find((c) => c.id === id);
  const cart = card(STORY_CARDS.cart);
  const apt = card(STORY_CARDS.apartment);
  const expenses = totalExpenses(state);
  const salary = state.profession.salary;
  const loan = loanTerms(10000);
  const passive = apt.monthlyCashFlow;
  const monthly = salary + passive - expenses;
  return {
    profession: state.profession.title, salary, expenses, debts: loanPayments(state), monthly, months: PAYDAY_MONTHS,
    left: Math.max(0, expenses - cart.monthlyCashFlow), cart: cart.monthlyCashFlow, passive, amount: monthly * PAYDAY_MONTHS,
    loan: { amount: loan.amount, monthly: loan.monthly, perSummary: loan.perPayday, total: loan.totalAtPayday },
  };
}

// ---------- hints (spec section 5) ----------
/** Hints that float in the roll zone (at most one per turn); the others are strips inside a card, the summary or the loan window. */
export const FLOATING_HINTS = ['h-roll', 'h-expense-paid', 'h-expense-loan', 'h-meter', 'h-almost', 'h-summary-square'];
/** The two expense hints are one lesson: whichever shows first retires the other. */
export const EXPENSE_GROUP = ['h-expense-paid', 'h-expense-loan'];
/** The summary hints: the income one retires the plain one. */
export const SUMMARY_GROUP = ['h-summary', 'h-summary-income'];

/**
 * Scheduler of the guided hints. `seen` = { id: turn } (device), `active()` says whether hints are on, `mark(id, turn)`
 * persists. Inline hints (card, guess, summary, loan) are claimed at their moment; floating ones are offered and
 * taken at most once per turn, lower priority number first. A hint whose moment has not happened simply waits.
 */
export function createHintScheduler({ seen = {}, active = () => true, mark = () => {}, unmark = () => {}, priorityOf = () => 9 } = {}) {
  const book = { ...seen };
  let floatedThisTurn = false;
  let pending = [];
  const taking = new Map(); // floating hints handed out this turn: id -> { turn, ctx } (so a release can queue them again)
  // the expense hints retire each other; the income summary hint retires the plain one, but not the other way round
  const group = (id) => (EXPENSE_GROUP.includes(id) ? EXPENSE_GROUP : id === 'h-summary-income' ? SUMMARY_GROUP : [id]);
  const retire = (id, turn) => { for (const g of group(id)) if (book[g] == null) { book[g] = turn; mark(g, turn); } };
  const isSeen = (id) => book[id] != null;
  return {
    isSeen,
    get seen() { return { ...book }; },
    newTurn() { floatedThisTurn = false; },
    /** Re-reads the device record (the settings may have reset the hints). */
    sync(next = {}) { for (const k of Object.keys(book)) delete book[k]; Object.assign(book, next); },
    /**
     * A taken hint that never reached the screen (the player rolled on first) is given back AND put back in the queue with
     * priority: it is never lost, and it shows within the next two turns (an overdue hint outranks the others).
     */
    release(id, turn = 0) {
      const taken = taking.get(id);
      for (const g of group(id)) if (book[g] != null) { delete book[g]; unmark(g); }
      if (active() && !pending.some((p) => p.id === id)) pending.push({ id, turn: taken?.turn ?? turn, ctx: taken?.ctx ?? {}, requeued: true });
      taking.delete(id);
    },
    /** Inline hint at its moment: true (and remembered) when it should show now. */
    claim(id, turn = 0) {
      if (!active() || isSeen(id)) return false;
      retire(id, turn);
      return true;
    },
    /** A floating hint whose moment has come; it waits for a free turn slot. */
    offer(id, turn = 0, ctx = {}) {
      if (!active() || isSeen(id) || pending.some((p) => p.id === id)) return;
      pending.push({ id, turn, ctx });
    },
    /** The floating hint to show now (at most one per turn), or null. Marks it seen. */
    takeFloating(turn = 0) {
      if (!active() || floatedThisTurn) return null;
      pending = pending.filter((p) => !isSeen(p.id));
      if (!pending.length) return null;
      // a re-queued or overdue hint (waiting 2+ turns) outranks everything else: nothing waits forever behind a busier hint
      const rank = (p) => priorityOf(p.id) - (p.requeued ? 20 : 0) - (turn - p.turn >= 2 ? 20 : 0);
      pending.sort((a, b) => rank(a) - rank(b) || a.turn - b.turn);
      const next = pending.shift();
      taking.set(next.id, { turn: next.turn, ctx: next.ctx });
      retire(next.id, turn);
      floatedThisTurn = true;
      return next;
    },
    /** Forget a waiting floating hint whose moment is over (e.g. the square it points at has been passed). */
    drop(id) { pending = pending.filter((p) => p.id !== id); },
    get floatedThisTurn() { return floatedThisTurn; },
    get pending() { return pending.map((p) => p.id); },
  };
}

/** Which summary hint applies: the income variant once an asset pays, the plain one before. Returns { id, variant } or null. */
export function summaryHintId(figures, scheduler) {
  if (figures.hasPassive && !scheduler.isSeen('h-summary-income')) return { id: 'h-summary-income', variant: 'income' };
  if (!scheduler.isSeen('h-summary') && !scheduler.isSeen('h-summary-income')) return { id: 'h-summary', variant: figures.negative ? 'negative' : 'positive' };
  return null;
}

/** Numbers of the 'h-card' tour: down payment, monthly flow (or loss), payback years (Infinity = never). */
export const cardTourFigures = (card) => ({
  downPayment: card.downPayment, monthly: card.monthlyCashFlow, loss: Math.max(0, -card.monthlyCashFlow),
  years: paybackYears(card.downPayment, card.monthlyCashFlow),
});

// ---------- quiz (spec section 7) ----------
/** Deterministic shuffle (Fisher-Yates) with a [0,1) generator; the input is not touched. */
export function shuffled(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The quiz as a pure state machine: guess first, instant feedback, ONE retry per question, then the explanation.
 * answer(optionId) -> { correct, done, retry, feedback }. A question counts when it was right on the first try or the retry.
 */
export function createQuiz(questions) {
  let index = 0;
  let tries = 0;
  let answered = false;
  const results = [];
  const q = () => questions[index];
  return {
    get question() { return q(); },
    get index() { return index; },
    get total() { return questions.length; },
    get finished() { return index >= questions.length; },
    answer(optionId) {
      const option = q().options.find((o) => o.id === optionId);
      tries += 1;
      const correct = !!option?.correct;
      const done = correct || tries >= 2;
      if (done) { results.push({ id: q().id, correct, tries, shown: false }); answered = true; }
      return { correct, done, retry: !done, feedback: option?.feedback ?? '' };
    },
    /** 'הראו לי': the player skips to the explanation; the question does not count as right. */
    showMe() { results.push({ id: q().id, correct: false, tries, shown: true }); answered = true; },
    next() { index += 1; tries = 0; answered = false; },
    get answered() { return answered; },
    get results() { return [...results]; },
    get score() { return results.filter((r) => r.correct).length; },
    /** The first question that was missed (for the 'see the screen again' link), or null. */
    firstMissed() { const r = results.find((x) => !x.correct); return r ? questions.find((x) => x.id === r.id) : null; },
  };
}
