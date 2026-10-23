// Derived values. Never stored in state.
import {
  LOAN_STEP, LOAN_PAYMENT_RATE, LOAN_LIMIT_SALARY_PCT, MORTGAGE_PAYMENT_RATE, BUSINESS_LOAN_PAYMENT_RATE, SELL_FACTOR,
  PAYDAY_MONTHS, PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS, MONTHS_PER_YEAR, LOAN_CAP_SALARIES,
  PRICE_INFLATION_PER_LAP, EXPENSE_INFLATION_PER_LAP, DAILY_INFLATION_FACTOR, PROPERTY_VALUE_ROUND, RENT_CHANGE_ROUND,
} from './config.js';

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const roundTo = (x, q) => Math.round(x / q) * q;

// ---- inflation and timed effects (v3 phase 3) ----
/** Price factor of NEW deals: PRICE_INFLATION_PER_LAP ^ lap; the daily challenge always 1 (same prices for everyone). */
export const priceFactor = (s) => (s.daily ? DAILY_INFLATION_FACTOR : PRICE_INFLATION_PER_LAP ** (s.lap ?? 0));
/** Factor of unexpected-expense cards (1 while EXPENSE_INFLATION_PER_LAP is 1). */
export const expenseFactor = (s) => (s.daily ? DAILY_INFLATION_FACTOR : EXPENSE_INFLATION_PER_LAP ** (s.lap ?? 0));
/** The running timed effect of a kind ('propertyValue' | 'cheapLoan' | 'rentChange'), or null. */
export const activeEffect = (s, kind) => (Array.isArray(s.effects) ? s.effects.find((e) => e.kind === kind && e.turnsLeft > 0) : null) ?? null;
/** Monthly rate of a bank loan taken NOW: the cheap-loan card's rate while it runs, else LOAN_PAYMENT_RATE. */
export const loanRateNow = (s) => activeEffect(s, 'cheapLoan')?.rate ?? LOAN_PAYMENT_RATE;
/** Change of an apartment's monthly money while a rent card runs: rent x pct (the bank payment stays), rounded to 10. */
export function rentChangeAmount(s, a) {
  const e = activeEffect(s, 'rentChange');
  if (!e || a.type !== 'apartment' || !Number.isFinite(a.rent)) return 0;
  return roundTo(a.rent * e.pct, RENT_CHANGE_ROUND);
}
/** An asset's monthly cash flow right now (its stored flow + a running rent change). */
export const assetCashFlow = (s, a) => a.monthlyCashFlow + rentChangeAmount(s, a);
/** What an asset is worth right now: stocks at market price, apartments with a running property-value card, else the price. */
export function assetValue(s, a) {
  if (a.type === 'stock') return a.qty * stockPrice(s, a.symbol, a.avgCost);
  const e = activeEffect(s, 'propertyValue');
  return e && a.type === 'apartment' ? a.price + roundTo(a.price * e.pct, PROPERTY_VALUE_ROUND) : a.price;
}

export const passiveIncome = (s) => sum(s.assets, (a) => assetCashFlow(s, a));
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
export const loanMonthlyPayment = (amount, rate = LOAN_PAYMENT_RATE) => Math.round(amount * rate * 100) / 100;

/**
 * What a bank loan of `amount` costs. Interest only: the principal comes back whole when repaid.
 * perPayday = interest until the next payday settlement (PAYDAY_MONTHS months).
 */
export function loanTerms(amount, rate = LOAN_PAYMENT_RATE) {
  const monthly = loanMonthlyPayment(amount, rate);
  const perYear = monthly * MONTHS_PER_YEAR;
  const perPayday = monthly * PAYDAY_MONTHS;
  return {
    amount, monthly, perYear, perPayday, totalAtPayday: amount + perPayday, months: PAYDAY_MONTHS,
    rate, // monthly; LOAN_PAYMENT_RATE unless a cheap-loan card runs (pass loanRateNow(s))
    aprNominal: Math.round(rate * MONTHS_PER_YEAR * 1e6) / 1e4, // = LOAN_APR_NOMINAL at the normal rate
    aprEffective: Math.round(((1 + rate) ** MONTHS_PER_YEAR - 1) * 1e6) / 1e4,
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
  const byFlow = Math.floor(room / (LOAN_STEP * loanRateNow(s)) + 1e-9) * LOAN_STEP;
  // The cap limits borrowing to invest. A loan to cover an expense or a shortfall is never capped, so the player cannot get stuck.
  const forced = s.pending?.kind === 'expense' || s.pending?.kind === 'shortfall';
  const capOn = LOAN_CAP_SALARIES != null && !forced;
  // The cap is shown and enforced as a multiple of LOAN_STEP (12 salaries of 8,800 = 105,600 is the number the rule is built
  // from, but the largest loan the player can actually take in total is 105,000): one number for the screen and for the engine.
  const capAmount = capOn ? Math.floor((s.profession.salary * LOAN_CAP_SALARIES) / LOAN_STEP) * LOAN_STEP : null;
  const byCap = capOn ? Math.floor((capAmount - bankLoanPrincipal(s)) / LOAN_STEP) * LOAN_STEP : Infinity;
  const max = Math.max(0, Math.min(byFlow, byCap));
  return { byFlow, byCap, capAmount, capSalaries: capOn ? LOAN_CAP_SALARIES : null, capBinds: capOn && byCap < byFlow, max };
}

/** Largest new loan (multiple of LOAN_STEP) allowed; 0 when limit reached. */
export function maxLoan(s) {
  return loanLimits(s).max;
}

/**
 * THE loan-limit selector for the dialog: what the screen shows is exactly what takeLoan() enforces.
 * `limit` = largest loan that can be taken now (= maxLoan), `used` = bank-loan principal already owed, `total` = the cap on all
 * borrowing to invest (null when it does not apply), `capBinds` = the cap (not the cash-flow floor) is what stops a bigger loan.
 */
export function loanCap(s) {
  const l = loanLimits(s);
  return { limit: l.max, used: bankLoanPrincipal(s), total: l.capAmount, salaries: l.capSalaries, capBinds: l.capBinds };
}

/**
 * What taking a loan of `amount` does to the next payday (which settles PAYDAY_MONTHS of cash flow).
 * `spend` is what the loan is taken to pay right away (a card's price, an expense).
 * `risky` is true when the cash after that payday would be negative (an unaffordable settlement).
 */
export function loanPaydayImpact(s, amount, spend = 0, gain = 0) {
  // `gain`: monthly cash flow of the asset the loan buys (already net of its own mortgage); 0 when not buying. The figures
  // then describe the real state right after the purchase.
  const flow = monthlyCashFlow(s) + gain - loanMonthlyPayment(amount, loanRateNow(s));
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
  return Math.round(assetValue(s, asset) * SELL_FACTOR) - asset.mortgage;
}

export const canSell = (s) => s.mode === 'full' && s.assets.length > 0;

export function netWorth(s) {
  const assets = sum(s.assets, (a) => (a.type === 'stock' ? assetValue(s, a) : assetValue(s, a) - a.mortgage));
  return s.cash + assets - sum(s.liabilities, (l) => l.principal);
}

/**
 * Balance sheet for the statement: what you own (cash + assets at purchase value / market price) against what you owe
 * (starting debts, bank loans, mortgages and business loans). netWorth = assets - liabilities (same as netWorth()).
 */
export function balanceSheet(s) {
  const items = s.assets.map((a) => ({
    id: a.id, title: a.title, type: a.type,
    value: assetValue(s, a),
  }));
  const assetsTotal = s.cash + sum(items, (x) => x.value);
  const liabilitiesTotal = liabilityReport(s).totals.principal;
  return { cash: s.cash, items, assetsTotal, liabilitiesTotal, netWorth: assetsTotal - liabilitiesTotal };
}

export const isOver = (s) => s.status !== 'playing';
