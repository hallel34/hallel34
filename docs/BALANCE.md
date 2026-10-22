# Balance (Passivo)

## Before (v3 baseline, HEAD 677432b — v2.5 merged), `npm run simulate -- --games=100`, professions rotated, 200-turn cap
| mode | bot | win | lost | timeout | avg turns | median | p90 | loans/game |
|---|---|---|---|---|---|---|---|---|
| family | sensible | 100% | 0% | 0% | 20.5 | 20 | 32 | 0.6 |
| family | cautious | 99% | 1% | 0% | 23.7 | 22 | 36 | 0.1 |
| family | alwaysBuy | 66% | 34% | 0% | 22.7 | 19 | 42 | 1.1 |
| family | alwaysPass | 0% | 11% | 89% | – | – | – | 1.1 |
| full | sensible | 100% | 0% | 0% | 24.3 | 22 | 39 | 0.4 |
| full | cautious | 100% | 0% | 0% | 32.8 | 31 | 48 | 0.0 |
| full | alwaysBuy | 85% | 15% | 0% | 28.5 | 24 | 51 | 2.4 |
| full | alwaysPass | 0% | 10% | 90% | – | – | – | 1.1 |
Multiplayer (4 sensible bots, 50 matches): family winner's median 13 turns, full 13; all decided.

Config at baseline: `PAYDAY_MONTHS = 24`, board = 24 squares with 5 paydays / 9 opportunities / 3 expenses / 3 market / 2 baby / 2 charity, `LOAN_PAYMENT_RATE = 0.01`, `LOAN_CAP_SALARIES = 12`.

## v3 targets (owner spec)
| Metric | Family | Full |
|---|---|---|
| Median turns to win (sensible bot) | 20–30 | 25–40 |
| Bankruptcy, sensible bot | < 5% | < 10% |
| Bankruptcy, over-borrowing bot | 15–35% | 25–50% |
| Median cash at turn 10 | report | report |
| alwaysBuy / alwaysPass | both worse than sensible | same |

## After
(filled in Phase 3)
