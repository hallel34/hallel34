// Tunable rule constants. Pure data, no DOM.
// 7 (owner idea 2026-10-27): a player may carry `bot` (a BOTS policy name = a seat the device plays itself), and the
// match may carry an `auction` (a passed deal out for bids) / `lastAuction` (its result). Assets may carry
// `renovations` ({ level, style }) from the coffee-business renovation; older assets simply have none.
// 6 (owner 2026-10-26): every player carries `age` (an AGE_BANDS id or null = not given: today's rules and ₪), and a game with a
// player of 10 or under is a 'צעירים' game: every player's state carries `junior: true` (round rules, see JUNIOR_* below).
// 5 (v4 stage 4): every player's state carries `milestones` (25 / 50% celebrated once per game) and `taxAudit` (quiz points).
// 4: every player's state carries `lap` (board laps completed, drives price inflation) and `effects` (timed market effects).
// 3: every player's state carries a `learn` record (decisions, guesses, concepts). 2: saves hold a whole match (1-4 players).
// Version 1 saves were a single game state; 1 -> 2 -> 3 -> 4 migrate step by step on load.
export const SCHEMA_VERSION = 7;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const NAME_MAX = 12;
// Display only: the monthly payment shown for an asset's mortgage / business loan. The asset's monthlyCashFlow is
// already net of it, so it never enters the game maths (win check, payday, loan limit).
// 0.0055 of the principal per month = a ~25-year mortgage at ~4.5%. Business loans: 72 months at ~8% = 1.75%.
export const MORTGAGE_PAYMENT_RATE = 0.0055;
export const BUSINESS_LOAN_PAYMENT_RATE = 0.0175;

// 24-square loop. 5 paydays, 9 opportunities, 2 expenses, 3 market, 2 baby, 2 charity, 1 tax audit.
// v4 stage 4: square 12 (was the second of three unexpected-expense squares) is 'ביקורת רשות המסים' ('taxAudit'): a quiz,
// knowledge points only, never money. Picked by simulation among all 24 candidates (docs/BALANCE.md "After v4 stage 4"):
// every candidate kept the sensible medians in the targets; 12 keeps them there (family 21, full 26), lowers reckless-play
// bankruptcy in family mode, and keeps always-buy clearly behind the sensible bot.
export const BOARD = [
  'payday', 'opportunity', 'expense', 'market', 'payday', 'opportunity',
  'charity', 'payday', 'opportunity', 'baby', 'payday', 'opportunity',
  'taxAudit', 'opportunity', 'opportunity', 'market', 'charity', 'payday',
  'opportunity', 'expense', 'market', 'baby', 'opportunity', 'opportunity',
];
export const TAX_AUDIT_SQUARE = 12;

export const MAX_KIDS = 3;
export const CHARITY_PCT = 0.1; // of total monthly income
export const CHARITY_TURNS = 3; // turns with two dice
export const LOAN_STEP = 1000;
// Bank loan: interest only, 1% of the principal per month (12% a year nominal). The principal stays until repaid.
export const LOAN_PAYMENT_RATE = 0.01;
export const MONTHS_PER_YEAR = 12;
// Nominal yearly rate in percent, derived (never typed into copy): 1% a month -> 12.
export const LOAN_APR_NOMINAL = Math.round(LOAN_PAYMENT_RATE * MONTHS_PER_YEAR * 1e6) / 1e4;
// Ceiling on the total bank-loan principal for BUYING (loans for expenses / shortfalls are exempt so nobody gets stuck),
// in monthly salaries. Measured: without it bots borrowed up to 120-160 salaries (100% leverage on every down payment)
// and the always-buy bot stopped losing. null = no cap (the cash-flow limit alone applies).
export const LOAN_CAP_SALARIES = 12;

// Starting debts (professions.he.json) follow one model: monthly payment = principal x the rate of its kind.
// car 2% = a 60-month installment at ~6-7%; card 3% = a typical minimum payment; student 1% = cheap, long, like a bank loan.
// Rounded to the nearest 10 NIS. The principal is not amortized in the game (payments stay until the debt is repaid).
export const BASE_DEBT_RATES = { car: 0.02, student: 0.01, card: 0.03 };
export const LOAN_LIMIT_SALARY_PCT = 0.2; // cash flow may drop to -20% of salary
export const SELL_FACTOR = 0.9; // voluntary sale of property/business (full mode)
export const MAX_STOCK_QTY = 10000;

// A payday square settles this many months of cash flow. The single biggest pacing knob (months per lap = this x 5 paydays).
// v3 phase 3 (docs/v3/economy-experiments.md): 24 -> 12. At 24 the full-mode median was 21-22 turns, below the 25-40 target,
// with ~400k of idle cash at turn 10.
export const PAYDAY_MONTHS = 12;

// ---- Inflation (v3 phase 3). Depends on the lap number only (state.lap = passes of square 0), never on a choice. ----
// NEW opportunity deals (apartments and businesses) are shown at price, down payment, rent / profit, loan payment and cash flow
// x PRICE_INFLATION_PER_LAP ^ lap. Assets already owned keep their numbers. Stocks are not inflated (their price is set by market
// cards, and price and dividend would scale together anyway, so the yield is the same).
// 1.08 a lap at 60 months a lap = ~1.55% a year, close to the Bank of Israel's verified 12-month figure (real-world-verified.md).
export const PRICE_INFLATION_PER_LAP = 1.08;
// Unexpected-expense cards x this ^ lap. 1.0 = off (finance measured no effect on balance).
export const EXPENSE_INFLATION_PER_LAP = 1.0;
// Rounding of inflated numbers, so family mode keeps round numbers: prices and down payments to 1,000 (mortgage = price - down),
// rent / profit / loan payment to 10 (cash flow = rent or profit - loan payment, so the card's breakdown still adds up),
// a card without a breakdown rounds its cash flow to 10. Inflated expense cards round to 50.
export const INFLATION_PRICE_ROUND = 1000;
export const INFLATION_FLOW_ROUND = 10;
export const INFLATION_EXPENSE_ROUND = 50;
// The daily challenge has no inflation (docs/decisions.md 2026-10-23): a charity die changes the lap count between players, so
// lap-keyed prices would break "the same challenge for everyone".
export const DAILY_INFLATION_FACTOR = 1.0;

// ---- Timed market effects (family market cards, v3 phase 3). The numbers live on the cards; these are the schema bounds. ----
// An effect drawn on turn T with `turns: N` is active for the rest of turn T and the next N - 1 turns (it counts down when the
// player rolls, like the charity dice). A new card of the same kind replaces the running one (no stacking).
export const TIMED_EFFECT_KINDS = ['propertyValue', 'cheapLoan', 'rentChange'];
export const TIMED_EFFECT_MAX_TURNS = 10;
export const TIMED_EFFECT_MAX_PCT = 0.5; // |pct| of propertyValue / rentChange cards
// Rounding of the effect amounts: a property value to 1,000, a rent change to 10.
export const PROPERTY_VALUE_ROUND = 1000;
export const RENT_CHANGE_ROUND = 10;

// Payback badge thresholds (years of cash flow to earn back the down payment).
export const PAYBACK_OK_YEARS = 8;
export const PAYBACK_SLOW_YEARS = 14;

// ---- Learning layer (docs/v2/learn/spec.md). Pure data; none of this changes a rule or a bot decision. ----
// Correct guesses in a row (on green / red deals) that earn the 'investor eye' badge.
export const INVESTOR_EYE_STREAK = 3;
// A bank loan is rated 'costly' when its monthly payment eats more than this share of what it is borrowed for
// (the asset's monthly cash flow for a purchase, the player's positive cash flow otherwise). Tunable with finance.
export const LOAN_COSTLY_PAYMENT_SHARE = 0.5;
// Report tip 'highInterest': more than this many bank loans in one game (or interest above one monthly salary).
export const REPORT_MANY_LOANS = 2;
// Report tip 'manyRed': at least this many bought deals in tier bad/trap.
export const REPORT_MANY_RED = 2;
// Report tip 'noDiversify' (full mode): one asset kind and at least this many assets.
export const REPORT_NO_DIVERSIFY_ASSETS = 3;
// Report tip 'allGood': green share (0-1) of the rated decisions.
export const REPORT_ALL_GOOD_SHARE = 0.8;

// ---- v4 stage 4 ----
// Passive income as a % of total monthly expenses, celebrated once per game (docs/v4/milestones.md).
export const MILESTONES = [25, 50];
// 'ביקורת רשות המסים': the engine draws a number 0..TAX_AUDIT_PICKS-1; the UI maps it onto the questions of the mode.
// The answer earns knowledge points only (never money).
export const TAX_AUDIT_PICKS = 1000000;
export const TAX_AUDIT_POINTS = 1;

// Family safety net (owner, 2026-10-25): in family mode a purchase loan may not leave the monthly cash flow (after the deal's own
// monthly money and the new loan payment) below this many shekels a month. Full mode, expense and shortfall loans: no net.
export const FAMILY_NET_FLOOR = 0;

// ---- 'צעירים' (owner 2026-10-26, docs/decisions.md): a game with a player aged 10 or under ----
// The age is a band picked after each name. 'upTo10' makes the game a junior game (family rules on round numbers, and that
// player sees amounts in coins); '11to13' is family mode in shekels; '14plus' is today's game. null = not given (today's game).
export const AGE_BANDS = ['upTo10', '11to13', '14plus'];
export const JUNIOR_AGE = 'upTo10';
/** Ages under 14 are suggested family mode. */
export const FAMILY_SUGGESTED_AGES = ['upTo10', '11to13'];
// One coin = this many shekels. Every amount of a junior game is a multiple of it, so coins are exact.
export const COIN_VALUE = 100;
// Junior round rules (an engine flag on every player's state, like the daily's): deals' price and down payment to 1,000, their
// monthly money to 100, expenses / charity / market cash / rent changes to 100, the profession's figures to 100 (debts' principal
// to 1,000), and bank loans in 10,000 steps (1% a month = 1 coin a month per step). Decision cards (their texts name shekel
// figures) and the cheap-loan card (half a coin a month) are not dealt; the tax-audit square asks no question (real figures).
export const JUNIOR_LOAN_STEP = 10000;
export const JUNIOR_ROUND = 100;
export const JUNIOR_PRICE_ROUND = 1000;
// The family safety net's floor in a junior game (tuned by simulation, docs/BALANCE.md 'Junior round rules').
export const JUNIOR_NET_FLOOR = 0; // not raised: 0 already meets the reckless target (15-35%); 500-2,500 changed nothing
