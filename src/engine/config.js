// Tunable rule constants. Pure data, no DOM.
// 3: every player's state carries a `learn` record (decisions, guesses, concepts). 2: saves hold a whole match (1-4 players).
// Version 1 saves were a single game state; 1 -> 2 -> 3 migrate step by step on load.
export const SCHEMA_VERSION = 3;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const NAME_MAX = 12;
// Display only: the monthly payment shown for an asset's mortgage / business loan. The asset's monthlyCashFlow is
// already net of it, so it never enters the game maths (win check, payday, loan limit).
// 0.0055 of the principal per month = a ~25-year mortgage at ~4.5%. Business loans: 72 months at ~8% = 1.75%.
export const MORTGAGE_PAYMENT_RATE = 0.0055;
export const BUSINESS_LOAN_PAYMENT_RATE = 0.0175;

// 24-square loop. 5 paydays, 9 opportunities, 3 expenses, 3 market,
// 2 baby, 2 charity.
export const BOARD = [
  'payday', 'opportunity', 'expense', 'market', 'payday', 'opportunity',
  'charity', 'payday', 'opportunity', 'baby', 'payday', 'opportunity',
  'expense', 'opportunity', 'opportunity', 'market', 'charity', 'payday',
  'opportunity', 'expense', 'market', 'baby', 'opportunity', 'opportunity',
];

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

// A payday square settles this many months of cash flow (one board lap is
// ~a year of life, compressed). The single biggest pacing knob.
export const PAYDAY_MONTHS = 24;

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
