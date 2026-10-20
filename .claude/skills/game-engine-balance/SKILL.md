---
name: game-engine-balance
description: Game engine architecture, rules model, card data schema and balance simulation for יוצאים מהמרוץ. Use when building engine code, writing cards, testing rules, or checking that games last 15–25 turns.
---
# Engine & balance

## Architecture
- `state` is a plain serializable object. Every action is a pure
  function `(state, action, rng) => newState`. No DOM, no Date.now()
  inside the engine — pass a seeded RNG (e.g. mulberry32) so games and
  tests are reproducible.
- Derived values (totals, cash flow, passive income) computed by
  selectors, never stored.
- Save = `JSON.stringify(state)` + `schemaVersion`; migrate on load.

## Core formulas
- totalIncome = salary + passiveIncome
- passiveIncome = Σ asset.monthlyCashFlow
- totalExpenses = Σ fixedExpenses + Σ liability.monthlyPayment + kids × perChild
- monthlyCashFlow = totalIncome − totalExpenses
- WIN when passiveIncome > totalExpenses
- Bank loan: amount in ₪1,000 steps, monthlyPayment = 10% of amount.
  Loan limit: cash flow after the new payment must stay ≥ −(salary×0.2)
  (tunable). LOSE when cash < 0 after forced payment, cash flow < 0,
  and loan limit reached.

## Card schema (JSON)
```json
{
  "id": "opp-apt-001",
  "deck": "opportunity",        // opportunity | expense | market
  "type": "apartment",          // apartment | stock | business
  "modes": ["family", "full"],
  "title": "...", "text": "...",
  "price": 650000, "downPayment": 65000,
  "mortgage": 585000, "monthlyCashFlow": 900
}
```
Expense: `{ "amount": 1200 }`. Market: `{ "effect": "offer", "targetType": "apartment", "offerPrice": 800000 }`
or `{ "effect": "stockPrice", "symbol": "...", "newPrice": 12 }`.
Validate every file at load; fail loudly in dev.

## Balance targets
- Median turns to win: 15–25. Loss rate: 5–15% (full), <5% (family).
- Starting cash flow per profession: ₪300–₪2,500/month after expenses.
- Small deals should pay back their down payment in ~3–6 years of
  monthly cash flow; big deals in ~8–12; a few "great deals" rarer.
- No dominant strategy: always-buy and always-pass must both lose vs.
  a simple sensible bot.

## Simulation (required)
`npm run simulate` runs 100+ games per profession per mode with bots
(always-buy, sensible, cautious). Output a table: median turns,
p90 turns, loss %, avg loans. Tune JSON numbers, not code, to hit targets.
