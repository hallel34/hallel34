// Tunable rule constants. Pure data, no DOM.
export const SCHEMA_VERSION = 1;

// 24-square loop. 6 paydays, 7 opportunities, 4 expenses, 3 market,
// 2 baby, 2 charity.
export const BOARD = [
  'payday', 'opportunity', 'expense', 'market', 'payday', 'opportunity',
  'charity', 'opportunity', 'payday', 'expense', 'baby', 'opportunity',
  'payday', 'market', 'opportunity', 'expense', 'payday', 'charity',
  'opportunity', 'market', 'payday', 'expense', 'baby', 'opportunity',
];

export const MAX_KIDS = 3;
export const CHARITY_PCT = 0.1; // of total monthly income
export const CHARITY_TURNS = 3; // turns with two dice
export const LOAN_STEP = 1000;
export const LOAN_PAYMENT_RATE = 0.1; // monthly payment = 10% of principal
export const LOAN_LIMIT_SALARY_PCT = 0.2; // cash flow may drop to -20% of salary
export const SELL_FACTOR = 0.9; // voluntary sale of property/business (full mode)
export const MAX_STOCK_QTY = 1000;
