// Formatting of the slot values used by the learning texts ({years}, {yield}, {amount}, {rate}, ...).
// All rates and thresholds come from src/engine/config.js; nothing is typed here (spec 1, "Numbers policy").
import { tp } from '../i18n/index.js';
import { moneyText, numberText } from '../ui/format.js';
import {
  PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS, LOAN_APR_NOMINAL, LOAN_PAYMENT_RATE, PAYDAY_MONTHS,
} from '../engine/config.js';
import { loanTerms } from '../engine/selectors.js';

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Years shown with at most one decimal, never crossing a traffic-light threshold:
 * 8.04 years is a yellow deal, so it reads 8.1 and never "8".
 */
export function yearsValue(years) {
  let r = round1(years);
  for (const limit of [PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS]) {
    if (years > limit && r <= limit) r = round1(limit + 0.1);
  }
  return r;
}
/** "שנה אחת" / "שנתיים" / "4.2 שנים" (plural.years in the locale file). */
export const yearsPhrase = (years) => tp('plural.years', yearsValue(years));
/** "20.4%" (one decimal at most). */
export const pctText = (pct) => `${numberText(round1(pct))}%`;

/** Slots of a bank loan of `loanAmount` (spec 2.1): loanTerms() is the only source. */
export function loanSlots(loanAmount, { amount = loanAmount } = {}) {
  const lt = loanTerms(loanAmount);
  return {
    amount: moneyText(amount), loanAmount: moneyText(loanAmount), monthlyPayment: moneyText(lt.monthly),
    interest: moneyText(lt.perPayday), total: moneyText(lt.totalAtPayday), rate: pctText(lt.aprNominal),
  };
}

/** Glossary example / simplification slots: {months} {monthlyRate} {rate} and the example loan (5,000 in glossary.interest). */
export function glossarySlots(concept) {
  const base = { months: numberText(PAYDAY_MONTHS), monthlyRate: pctText(LOAN_PAYMENT_RATE * 100), rate: pctText(LOAN_APR_NOMINAL) };
  const amount = concept?.example?.computed?.amount;
  if (!Number.isFinite(amount)) return base;
  const lt = loanTerms(amount);
  return { ...base, amount: moneyText(amount), monthlyPayment: moneyText(lt.monthly), interest: moneyText(lt.perPayday), total: moneyText(lt.totalAtPayday) };
}

/** Slots of the traffic-light legend: the thresholds as phrases, from the config. */
export const lightSlots = () => ({ okYears: yearsPhrase(PAYBACK_OK_YEARS), slowYears: yearsPhrase(PAYBACK_SLOW_YEARS) });

/** Replaces {name} in a template; unknown names stay as they are (a test catches those). */
export const fillSlots = (template, values) => String(template).replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
