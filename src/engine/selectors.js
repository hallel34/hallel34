// Derived values. Never stored in state.
import {
  LOAN_STEP, LOAN_PAYMENT_RATE, LOAN_LIMIT_SALARY_PCT, MORTGAGE_PAYMENT_RATE, BUSINESS_LOAN_PAYMENT_RATE, SELL_FACTOR,
  PAYDAY_MONTHS, PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS, MONTHS_PER_YEAR, LOAN_APR_NOMINAL, LOAN_CAP_SALARIES,
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
    liabilities: liabilityReport(s),
    balance: balanceSheet(s),
  };
}

/**
 * Display-only monthly payment of an asset's mortgage / business loan (already inside the asset's net cash flow).
 * A card may carry its own `loanPayment` (the asset keeps it); otherwise it is the configured rate, rounded to 100.
 */
export const assetLoanPayment = (asset) => {
  if (Number.isFinite(asset.loanPayment)) return asset.loanPayment;
  const rate = asset.type === 'business' ? BUSINESS_LOAN_PAYMENT_RATE : MORTGAGE_PAYMENT_RATE;
  return Math.round((asset.mortgage * rate) / 100) * 100;
};
export const mortgagePayment = assetLoanPayment;

/** Starting-debt payment for a principal of the given kind (see BASE_DEBT_RATES), rounded to 10. */
export const baseDebtPayment = (principal, rate) => Math.round((principal * rate) / 10) * 10;

/**
 * Every liability the player owes, in one list: starting debts, bank loans and the mortgages that came with assets.
 * `includedInAssets` payments are already netted into the asset's monthlyCashFlow (they are not subtracted again),
 * so: monthlyCashFlow = salary + passive - fixed - kids - totals.paidFromCashFlow.
 */
export function liabilityReport(s) {
  const debts = s.liabilities.map((l) => ({
    id: l.id, kind: l.kind === 'base' ? 'base' : 'loan', label: l.label, principal: l.principal,
    monthlyPayment: l.monthlyPayment, includedInAssets: false,
    ...(l.kind === 'loan' ? { rate: loanRate(l) } : {}),
  }));
  // An apartment's loan is a mortgage; a business's is a business loan (kind 'bizloan'). Both are already in the asset's flow.
  const mortgages = s.assets.filter((a) => a.type !== 'stock' && a.mortgage > 0).map((a) => ({
    id: `${a.type === 'business' ? 'bizloan' : 'mortgage'}-${a.id}`, kind: a.type === 'business' ? 'bizloan' : 'mortgage',
    assetId: a.id, assetTitle: a.title, assetType: a.type, label: a.title,
    principal: a.mortgage, monthlyPayment: assetLoanPayment(a), includedInAssets: true,
  }));
  const items = [...debts, ...mortgages];
  const sumOf = (list, f) => list.reduce((a, x) => a + f(x), 0);
  return {
    items,
    totals: {
      principal: sumOf(items, (x) => x.principal),
      monthlyPayments: sumOf(items, (x) => x.monthlyPayment),
      paidFromCashFlow: sumOf(items.filter((x) => !x.includedInAssets), (x) => x.monthlyPayment),
      includedInAssets: sumOf(items.filter((x) => x.includedInAssets), (x) => x.monthlyPayment),
    },
  };
}

/**
 * Can the player pay `cost` right now? 'ok' = cash covers it; 'loan' = short, but one bank loan covers the gap;
 * 'blocked' = short even after the maximum loan. `loanAmount` is the smallest loan (multiple of LOAN_STEP) that covers it.
 */
export function purchasePlan(s, cost) {
  const need = Math.max(0, cost - s.cash);
  const loanRoom = maxLoan(s);
  const status = need === 0 ? 'ok' : need <= loanRoom ? 'loan' : 'blocked';
  return { cost, need, loanRoom, status, loanAmount: need === 0 ? 0 : Math.ceil(need / LOAN_STEP) * LOAN_STEP };
}

/**
 * Monthly interest rate of a bank loan (a fraction): the one stored with the loan, else what its payment says. Loans taken
 * before the 1%/month rule (10% of the principal) carry no `rate`; they must be labelled with THEIR rate, not today's.
 */
export function loanRate(l) {
  if (Number.isFinite(l.rate) && l.rate > 0) return l.rate;
  return l.principal > 0 && l.monthlyPayment > 0 ? Math.round((l.monthlyPayment / l.principal) * 1e4) / 1e4 : LOAN_PAYMENT_RATE;
}

/** Bank-loan principal owed right now (kind 'loan'; starting debts are not counted). */
export const bankLoanPrincipal = (s) => sum(s.liabilities.filter((l) => l.kind === 'loan'), (l) => l.principal);

/** Monthly payment of a bank loan of `amount` (interest only). Rounded to the cent so floats never leak into the UI. */
export const loanMonthlyPayment = (amount) => Math.round(amount * LOAN_PAYMENT_RATE * 100) / 100;

/**
 * What a bank loan of `amount` costs. Interest only: the principal comes back whole when repaid.
 * perPayday = interest until the next payday settlement (PAYDAY_MONTHS months).
 */
export function loanTerms(amount) {
  const monthly = loanMonthlyPayment(amount);
  const perYear = monthly * MONTHS_PER_YEAR;
  const perPayday = monthly * PAYDAY_MONTHS;
  return {
    amount, monthly, perYear, perPayday, totalAtPayday: amount + perPayday, months: PAYDAY_MONTHS,
    aprNominal: LOAN_APR_NOMINAL,
    aprEffective: Math.round(((1 + LOAN_PAYMENT_RATE) ** MONTHS_PER_YEAR - 1) * 1e6) / 1e4,
  };
}

/**
 * The two limits behind maxLoan: `byFlow` (cash flow may not fall below -20% of salary) and `byCap` (the 12-salary ceiling on
 * borrowing to buy; Infinity when it does not apply: no cap configured, or the loan covers an expense / shortfall).
 * `capBinds` is true when the cap is what stops a bigger loan.
 */
export function loanLimits(s) {
  const floor = -s.profession.salary * LOAN_LIMIT_SALARY_PCT;
  const room = monthlyCashFlow(s) - floor; // payment budget
  const byFlow = Math.floor(room / (LOAN_STEP * LOAN_PAYMENT_RATE) + 1e-9) * LOAN_STEP;
  // The cap limits borrowing to invest. A loan to cover an expense or a shortfall is never capped, so the player cannot get stuck.
  const forced = s.pending?.kind === 'expense' || s.pending?.kind === 'shortfall';
  const capOn = LOAN_CAP_SALARIES != null && !forced;
  const capAmount = capOn ? s.profession.salary * LOAN_CAP_SALARIES : null;
  const byCap = capOn ? Math.floor((capAmount - bankLoanPrincipal(s)) / LOAN_STEP) * LOAN_STEP : Infinity;
  return { byFlow, byCap, capAmount, capSalaries: capOn ? LOAN_CAP_SALARIES : null, capBinds: capOn && byCap < byFlow };
}

/** Largest new loan (multiple of LOAN_STEP) allowed; 0 when limit reached. */
export function maxLoan(s) {
  const { byFlow, byCap } = loanLimits(s);
  return Math.max(0, Math.min(byFlow, byCap));
}

/**
 * What taking a loan of `amount` does to the next payday (which settles PAYDAY_MONTHS of cash flow).
 * `spend` is what the loan is taken to pay right away (a card's price, an expense).
 * `risky` is true when the cash after that payday would be negative (an unaffordable settlement).
 */
export function loanPaydayImpact(s, amount, spend = 0) {
  const flow = monthlyCashFlow(s) - loanMonthlyPayment(amount);
  const payday = flow * PAYDAY_MONTHS;
  const cashAfter = s.cash + amount - spend + payday; // `spend`: cash the loan is about to pay for
  return { flow, payday, cashAfter, risky: cashAfter < 0 };
}

/** Payback of a down payment in years of cash flow; Infinity when the deal does not pay. */
export function paybackYears(downPayment, monthlyCashFlow) {
  return monthlyCashFlow > 0 ? downPayment / (monthlyCashFlow * 12) : Infinity;
}

/** 'ok' (<= 8 years), 'slow' (<= 14), 'bad' (longer or never). */
export function paybackTier(years) {
  return years <= PAYBACK_OK_YEARS ? 'ok' : years <= PAYBACK_SLOW_YEARS ? 'slow' : 'bad';
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

/**
 * Balance sheet for the statement: what you own (cash + assets at purchase value / market price) against what you owe
 * (starting debts, bank loans, mortgages and business loans). netWorth = assets - liabilities (same as netWorth()).
 */
export function balanceSheet(s) {
  const items = s.assets.map((a) => ({
    id: a.id, title: a.title, type: a.type,
    value: a.type === 'stock' ? a.qty * stockPrice(s, a.symbol, a.avgCost) : a.price,
  }));
  const assetsTotal = s.cash + sum(items, (x) => x.value);
  const liabilitiesTotal = liabilityReport(s).totals.principal;
  return { cash: s.cash, items, assetsTotal, liabilitiesTotal, netWorth: assetsTotal - liabilitiesTotal };
}

export const isOver = (s) => s.status !== 'playing';
