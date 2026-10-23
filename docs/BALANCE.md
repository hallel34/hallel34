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

## After (v3 phase 3 economy), `npm run simulate -- --games=300 --perProfession --perProfessionBots=sensible,alwaysBuy,alwaysPass`
Config: `PAYDAY_MONTHS = 12` (was 24), board unchanged (5 paydays, 60 months a lap), `PRICE_INFLATION_PER_LAP = 1.08` on NEW apartment/business deals (not in the daily challenge, not stocks), `EXPENSE_INFLATION_PER_LAP = 1.0`, family market deck on (4 timed cards), 2026 tax lines (engineer 1,950, programmer 2,300, cook 600, driver 700). Same seeds as before (`1000 + g*7919`), professions rotated, 200-turn cap. Raw output: `docs/v4/sim/before.*` and `docs/v4/sim/after.*`. "cash @ t10" = median cash at the first roll on or after turn 10.

### Bots, before -> after (300 games per row)
| mode | bot | win | lost | median | p90 | loans/game | cash @ t10 | before: lost / median / p90 / cash @ t10 |
|---|---|---|---|---|---|---|---|---|
| family | sensible | 100% | 0% | 23 | 35 | 1.1 | ₪156k | 0% / 19 / 31 / ₪406k |
| family | cautious | 99% | 1% | 29 | 44 | 0.2 | ₪166k | 1% / 23 / 37 / ₪364k |
| family | alwaysBuy | 62% | 38% | 24 | 41 | 1.9 | ₪122k | 31% / 18 / 41 / ₪274k |
| family | overBorrow | 40% | 60% | 25 | 52 | 1.6 | ₪125k | 45% / 19 / 41 / ₪271k |
| family | overBorrowLite | 43% | 57% | 24 | 40 | 2.2 | ₪115k | 43% / 18 / 35 / ₪266k |
| family | alwaysPass | 0% | 6% (94% timeout) | – | – | 1.4 | ₪162k | 10% / – / – / ₪329k |
| full | sensible | 100% | 0% | 26 | 41 | 1.0 | ₪160k | 0% / 21 / 38 / ₪397k |
| full | cautious | 97% | 2% | 35 | 57 | 0.5 | ₪174k | 1% / 28 / 47 / ₪367k |
| full | alwaysBuy | 85% | 14% | 32 | 73 | 2.9 | ₪104k | 13% / 23 / 54 / ₪221k |
| full | overBorrow | 62% | 38% | 34 | 66 | 4.9 | ₪117k | 30% / 22 / 49 / ₪205k |
| full | overBorrowLite | 70% | 28% | 34 | 95 | 4.6 | ₪87k | 24% / 22 / 49 / ₪184k |
| full | alwaysPass | 0% | 6% (94% timeout) | – | – | 1.3 | ₪158k | 10% / – / – / ₪321k |

Multiplayer (4 sensible bots, 50 matches): family winner's median 18 turns (was 13), full 19 (was 13); all decided.

### Per profession, sensible bot (median / p90 / lost), before -> after
| profession | start cash flow (after) | family before | family after | full before | full after |
|---|---|---|---|---|---|
| teacher | 1,490 | 18 / 28 / 0% | 23 / 34 / 0% | 20 / 33 / 0% | 27 / 42 / 0% |
| engineer | 2,050 (was 2,300) | 20 / 31 / 0% | 24 / 34 / 0% | 23 / 40 / 0% | 27 / 42 / 0% |
| driver | 1,100 (was 1,000) | 19 / 31 / 0% | 26 / 38 / 0% | 23 / 39 / 1% | 32 / 48 / 1% |
| nurse | 2,080 | 17 / 28 / 0% | 21 / 31 / 0% | 18 / 33 / 0% | 24 / 37 / 0% |
| programmer | 1,860 (was 2,160) | 21 / 33 / 0% | 26 / 36 / 0% | 25 / 41 / 0% | 30 / 45 / 0% |
| police | 1,960 | 16 / 27 / 0% | 21 / 31 / 0% | 18 / 32 / 0% | 24 / 37 / 0% |
| cook | 2,020 (was 1,920) | 15 / 24 / 0% | 19 / 28 / 0% | 16 / 28 / 0% | 21 / 34 / 0% |
| lawyer | 2,450 | 22 / 35 / 0% | 25 / 34 / 0% | 26 / 42 / 0% | 27 / 41 / 0% |

Spread: family 19-26 (7 turns), full 21-32 (11 turns). Per-profession alwaysBuy lost: family 36-41%, full 7-23%; per-profession alwaysPass never wins (driver goes bankrupt 52% family / 57% full, everyone else times out).

### Against the v3 targets
| Metric | Target | Family | Full | Met? |
|---|---|---|---|---|
| Median turns to win, sensible | 20-30 / 25-40 | 23 | 26 | yes / yes |
| Bankruptcy, sensible | < 5% / < 10% | 0% | 0% | yes / yes |
| Bankruptcy, over-borrowing bot | 15-35% / 25-50% | alwaysBuy 38%, overBorrow 60%, overBorrowLite 57% | overBorrow 38%, overBorrowLite 28%, alwaysBuy 14% | **no** (family, every policy too high) / yes (overBorrow, overBorrowLite) |
| Median cash at turn 10 | report | ₪156k (sensible) | ₪160k (sensible) | reported (was ~₪400k) |
| alwaysBuy / alwaysPass worse than sensible | both | 62% / 0% win vs 100%; median 24 vs 23 | 85% / 0% vs 100%; median 32 vs 26 | yes / yes |

### Family over-borrowing miss: what was tried (new constants only)
Family-only runs, 300 games, same seeds (alwaysBuy / overBorrow / overBorrowLite lost; sensible median):
| variant | alwaysBuy | overBorrow | overBorrowLite | sensible median |
|---|---|---|---|---|
| shipped: inflation 1.08, family market on | 38% | 60% | 57% | 23 |
| inflation 1.05 | 33% | 59% | 54% | 23 |
| inflation 1.00 | 32% | 57% | 51% | 24 |
| inflation 1.08, family market off | 34% | 54% | 53% | 23 |

None of the new constants brings a "skip the loan check" policy into 15-35% in family (finance found the same for the loan cap and floor). alwaysBuy is in the band at 1.05 / 1.00, but the difference (33% vs 38%) is within ~3pp of seed noise and inflation 1.08 is the approved, verified-against-Bank-of-Israel value, so it stays. The family market deck adds ~4pp of reckless-play bankruptcy (the rent card cuts flow for 3 turns) and nothing for the sensible bot. The lever finance named (a family-only safety valve, such as a first-shortfall grace or softer family expense cards) is a rule / card change outside this phase: owner decision.

