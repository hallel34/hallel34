// Tunable rule constants. Pure data, no DOM.
export const SCHEMA_VERSION = 1;

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
export const LOAN_PAYMENT_RATE = 0.1; // monthly payment = 10% of principal
export const LOAN_LIMIT_SALARY_PCT = 0.2; // cash flow may drop to -20% of salary
export const SELL_FACTOR = 0.9; // voluntary sale of property/business (full mode)
export const MAX_STOCK_QTY = 10000;

// A payday square settles this many months of cash flow (one board lap is
// ~a year of life, compressed). The single biggest pacing knob.
export const PAYDAY_MONTHS = 24;
