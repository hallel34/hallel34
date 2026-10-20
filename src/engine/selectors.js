// Derived values. Never stored in state.
import {
  LOAN_STEP, LOAN_PAYMENT_RATE, LOAN_LIMIT_SALARY_PCT, SELL_FACTOR,
} from './config.js';

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

export const passiveIncome = (s) => sum(s.assets, (a) => a.monthlyCashFlow);
export const totalIncome = (s) => s.profession.salary + passiveIncome(s);
export const childExpenses = (s) => s.kids * s.profession.perChild;
export const fixedExpenses = (s) => sum(s.profession.expenses, (e) => e.amount);
export const loanPayments = (s) => sum(s.liabilities, (l) => l.monthlyPayment);
export const totalExpenses = (s) => fixedExpenses(s) + loanPayments(s) + childExpenses(s);
export const monthlyCashFlow = (s) => totalIncome(s) - totalExpenses(s);
export const hasWon = (s) => passiveIncome(s) > totalExpenses(s);

export function statement(s) {
  return {
    salary: s.profession.salary,
    passiveIncome: passiveIncome(s),
    totalIncome: totalIncome(s),
    expenseItems: s.profession.expenses.map((e) => ({ ...e })),
    childExpenses: childExpenses(s),
    loanPayments: loanPayments(s),
    totalExpenses: totalExpenses(s),
    monthlyCashFlow: monthlyCashFlow(s),
    cash: s.cash,
    kids: s.kids,
  };
}

/** Largest new loan (multiple of LOAN_STEP) allowed; 0 when limit reached. */
export function maxLoan(s) {
  const floor = -s.profession.salary * LOAN_LIMIT_SALARY_PCT;
  const room = monthlyCashFlow(s) - floor; // payment budget
  const steps = Math.floor(room / (LOAN_STEP * LOAN_PAYMENT_RATE));
  return Math.max(0, steps * LOAN_STEP);
}

export const stockPrice = (s, symbol, fallback) =>
  s.stockPrices[symbol] ?? fallback;

/** Net proceeds of voluntarily selling an asset (or part of a stock holding). */
export function saleValue(s, asset, qty = asset.qty ?? 1) {
  if (asset.type === 'stock') return qty * stockPrice(s, asset.symbol, asset.avgCost);
  return Math.round(asset.price * SELL_FACTOR) - asset.mortgage;
}

export const canSell = (s) => s.mode === 'full' && s.assets.length > 0;

export function netWorth(s) {
  const assets = sum(s.assets, (a) =>
    a.type === 'stock' ? a.qty * stockPrice(s, a.symbol, a.avgCost) : a.price - a.mortgage);
  return s.cash + assets - sum(s.liabilities, (l) => l.principal);
}

export const isOver = (s) => s.status !== 'playing';
