# Balance (MaxiFox)

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


## After v4 stage 4 (decision cards, milestones, the tax-audit square), 2026-10-25
`npm run simulate -- --games=300 --perProfession --perProfessionBots=sensible,alwaysBuy,alwaysPass` (300 games per bot and mode, same seeds `1000 + g*7919`, professions rotated, 200-turn cap). Raw output: `docs/v4/sim/after-stage4.txt` / `.json`.

What changed in the rules: the family safety net (owner, 2026-10-25: in family mode a purchase loan may not leave the monthly cash flow below `FAMILY_NET_FLOOR` = ₪0 once the deal pays; full mode, expense and shortfall loans unchanged; the floor was not tuned, 0 met the target first time); 9 decision cards (10 entries, card 9 has a family variant) join the opportunity pile (family 6 of 29, full 8 of 43) and 1 joins the unexpected-expense pile (both modes); decision cards are not inflated and the daily challenge deals none. Square 12 (was an unexpected expense) is 'ביקורת רשות המסים': a quiz that never moves money. Bots: on a decision card the sensible / cautious bots take the option with the best monthly gain inside their reserve and payback rules, the reckless bots the one that commits the most money, alwaysPass the free one.

### Which square becomes the tax audit (sweep over all 24 candidates, 300 games, sensible / alwaysBuy / overBorrow, median / lost)
Raw: `docs/v4/sim/tax-square-sweep.txt`. With the decision cards and no tax square: family 22 / 26 (sensible median family / full). Every candidate kept the sensible medians inside the targets (family 21-26, full 24-30) with 0-1% sensible bankruptcy, so the pick came from the other checks:
| candidate | sensible family / full | alwaysBuy lost family / full | overBorrow lost family / full | tests/data.test.js "always-buy clearly loses" (80 games) |
|---|---|---|---|---|
| 3 (market) | 22 / 26 | 24% / 14% | 46% / 31% | passes |
| 12 (expense) **chosen** | 21 / 26 | 23% / 12% | 40% / 28% | passes (full: 10% lost, 36.1 vs 26.4 turns) |
| 19 (expense) | 22 / 25 | 22% / 12% | 39% / 31% | passes |
| 20 (market) | 22 / 26 | 24% / 12% | 42% / 31% | **fails** in full (9% lost, 32.3 vs 26.3) |
| paydays 0/4/7/10/17 | 24-26 / 29-30 | | | slower, fewer summaries |
Square 12 keeps both medians in the band, keeps always-buy clearly behind the sensible bot, and lowers reckless-play bankruptcy in family mode (the band that was missed). It is a corner of the 6x8 ring.

### Bots, after stage 4 (before = "After (v3 phase 3 economy)" above)
| mode | bot | win | lost | median | p90 | loans/game | cash @ t10 | before: lost / median / p90 |
|---|---|---|---|---|---|---|---|---|
| family | sensible | 100% | 0% | 21 | 30 | 1.0 | ₪140k | 0% / 23 / 35 |
| family | cautious | 99% | 1% | 27 | 41 | 0.2 | ₪147k | 1% / 29 / 44 |
| family | alwaysBuy | 77% | 23% | 21 | 35 | 1.4 | ₪118k | 38% / 24 / 41 |
| family | overBorrow | 71% | 29% | 22 | 38 | 1.3 | ₪134k | 60% / 25 / 52 |
| family | overBorrowLite | 75% | 25% | 21 | 36 | 1.5 | ₪114k | 57% / 24 / 40 |
| family | alwaysPass | 0% | 6% (94% timeout) | - | - | 1.4 | ₪158k | 6% |
| full | sensible | 100% | 0% | 26 | 40 | 0.9 | ₪156k | 0% / 26 / 41 |
| full | cautious | 100% | 0% | 34 | 53 | 0.1 | ₪160k | 2% / 35 / 57 |
| full | alwaysBuy | 88% | 12% | 30 | 60 | 2.7 | ₪116k | 14% / 32 / 73 |
| full | overBorrow | 72% | 28% | 31 | 77 | 4.1 | ₪116k | 38% / 34 / 66 |
| full | overBorrowLite | 78% | 22% | 31 | 67 | 4.1 | ₪97k | 28% / 34 / 95 |
| full | alwaysPass | 0% | 4% (96% timeout) | - | - | 1.1 | ₪163k | 6% |

Per profession, sensible (median / p90 / lost): family teacher 22/31/0, engineer 23/31/0, driver 25/37/0, nurse 20/28/0, programmer 24/34/0, police 20/28/0, cook 17/26/0, lawyer 23/32/0 (spread 17-25); full teacher 26/41/0, engineer 27/40/0, driver 31/47/1, nurse 24/35/0, programmer 29/42/0, police 23/36/0, cook 20/32/0, lawyer 28/39/0 (spread 20-31). Multiplayer (4 sensible bots, 50 matches): family winner's median 17, full 18; all decided.

### Against the targets
| Metric | Target | Family | Full | Met? |
|---|---|---|---|---|
| Median turns to win, sensible | 20-30 / 25-40 | 21 | 26 | yes / yes |
| Bankruptcy, sensible | < 5% / < 10% | 0% | 0% | yes / yes |
| Bankruptcy, over-borrowing bot | 15-35% / 25-50% | alwaysBuy 23%, overBorrow 29%, overBorrowLite 25% | overBorrow 28%, overBorrowLite 22%, alwaysBuy 12% | **yes** (all three in the band; was 38-60%) / yes (overBorrow) |
| alwaysBuy / alwaysPass worse than sensible | both | 77% / 0% win vs 100% | 88% / 0% vs 100%; median 30 vs 26 | yes / yes |

Family is at the low edge of its band (21; cook 17). Without the safety net (same build otherwise) family overBorrow / overBorrowLite lost 40% / 41%; the net brings them to 29% / 25% and leaves the sensible bot at 21 turns, 0% lost (it never takes such a loan). Full-mode rows are identical with and without the net. The daily challenge (family mode) gets the net too; it is a pure rule, so the day stays the same for everyone.

### Decision cards in play (300 games, sensible bot; option counts)
Decision cards per game: family 1.7, full 1.8; tax-audit questions per game: family 0.9, full 1.0; every sensible game reaches both milestones (25% and 50%).
- Card 5 (repay 40,000 or buy the cart): the bots always take B (the cart, +900 a month) over A (-400 a month in expenses). As the doc's open point 2 expected, B is always correct inside the game (assets never fail). For finance / the educator: if A should be a real choice, the game needs a risk on small businesses.
- Card 2: two small apartments (B) is never picked by a bot (A pays 300 more and costs the same), as open point 1 says; its value is flexibility only.
- Card 8: the big down payment (B) is picked when the cash is there; the plain pass is common because many players cannot pay 200,000 when it comes.

## Junior round rules ('צעירים', owner 2026-10-26), `npm run simulate -- --games=300 --modes=junior --multiplayer=0`

These are family games on the junior round rules, which apply when a player is 10 or under:
- The profession's figures are rounded to ₪100, and debts' principal to ₪1,000.
- Deals' price and down payment are rounded to ₪1,000, and their monthly money to ₪100.
- Expenses, charity, market cash and rent changes are rounded to ₪100.
- Bank loans come in ₪10,000 steps.
- The cheap-loan card is not dealt, and neither are decision cards whose amounts are not whole coins (dec-002, dec-004, dec-006).
- The tax-audit square asks no question.

Targets: sensible median 20-30 turns with under 5% lost; reckless bots lost 15-35%.

| bot | win | lost | median | p90 | loans |
|---|---|---|---|---|---|
| sensible | 100% | 0% | 23 | 34 | 1.0 |
| cautious | 99% | 1% | 29 | 42 | 0.1 |
| alwaysBuy | 76% | 24% | 23 | 38 | 1.5 |
| overBorrow | 69% | 31% | 25 | 39 | 1.3 |
| overBorrowLite | 76% | 24% | 23 | 39 | 1.5 |
| alwaysPass | 0% | 6% (94% timeout) | - | - | 0.9 |

Every target is met. Two runs on the way:
- **No decision cards at all:** this was the first rule, and reckless losses rose to 41-48%. The decision cards whose amounts are whole coins are dealt again, which brings losses back to 24-31%.
- **Raising the junior net floor:** `JUNIOR_NET_FLOOR` at 500, 1,000, 1,500 and 2,500 changed reckless losses by at most 3 points (they sit at 40-48% without the decision cards), so it stays 0.

The 10,000 loan step itself barely matters: a 1,000 step gave the same loss rates (38-48%). An engine test (tests/junior.test.js) checks that every amount a junior game reaches is a multiple of ₪100, with every bot and in hot-seat.
