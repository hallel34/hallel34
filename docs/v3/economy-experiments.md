# Economy experiments (v3, Phase 3 design input)

Owner: finance. Date: 2026-10-23. Nothing in `src/` was changed. All runs used a copy of the repo with experiment knobs added (`docs/v3/economy-experiments.patch` is the diff against `src/engine` + `scripts`; raw JSON results are in `docs/v3/economy-runs/`).

## Method
- Runner: `scripts/exp.js` in the copy. It uses the real engine and bots, the same seeds as `npm run simulate` (`1000 + g*7919`), professions rotated, a 200-turn cap and **300 games per bot per mode** for every row.
- Sanity check: with the knobs at baseline (24 months, 5 paydays, no inflation) and 100 games, the runner reproduces the `docs/BALANCE.md` "Before" table **exactly** (family sensible median 20 / p90 32; full alwaysBuy 15% bankrupt, and so on).
- Knobs added in the copy (env vars):
  - `PAYDAY_MONTHS` (12 / 24).
  - `PAYDAY_TILES`: 2 / 3 / 5 paydays on a 24-square board. The 5-payday board is today's. The 3-payday board has 11 opp / 3 exp / 3 mkt / 2 baby / 2 charity. The 2-payday board has 12 opp / 3 exp / 3 mkt / 2 baby / 2 charity. Paydays are spread roughly evenly.
  - `PRICE_INFLATION` per lap (1.00 / 1.05 / 1.08). After every pass of square 0 (`d.lap += 1`), each NEW opportunity card is shown at `price, downPayment, monthlyCashFlow, rent, loanPayment × f^lap`. Prices round to ₪1,000 and flows to ₪10. Mortgage = price − down. Stocks scale price and dividend, so the yield is unchanged. Assets already owned keep their numbers.
  - `EXPENSE_INFLATION` per lap (unexpected-expense cards only, default 1.0).
  - `FAMILY_MARKET=1`: an approximation of the proposed `family_market` deck. In family mode a market square draws 1 of 9: the 5 existing cash cards, 2 "property value ±10–20% for 3 turns", 1 "cheap bank loan 0.5%/month for 3 turns" and 1 "rents −10% for 3 turns". The property-value cards change net worth only, which no rule or bot reads, so in the sim they are no-ops. The cheap-loan card stores 0.5% as the rate of any loan taken in that window. The rent cut lowers payday income by 10% of the rent of owned apartments while it is active. It does not touch the win check (approximation).
  - Also `LOAN_CAP` (salaries, default 12) and `LOAN_LIMIT_PCT` (default 0.2), used only to probe the over-borrowing target.
- Bots: `sensible`, `cautious`, `alwaysBuy` and `alwaysPass` are unchanged. Two new over-borrowing bots were added in the copy only:
  - `overBorrow`: buys everything, skips the "does the deal still pay after the loan payment" check, and takes the **maximum** loan whenever it is short.
  - `overBorrowLite`: the same, but borrows only what the down payment needs.
- "Bankrupt" = `status: lost` (game over). "Timeout" = no result by turn 200. "Cash @ turn 10" = median `cash` at the first roll phase on or after turn 10, over games that reached it.

## Headline: which knobs matter
1. **Months of cash settled per lap (= PAYDAY_MONTHS × paydays per lap) is THE pacing knob.** How it is split (12×5 vs 24×2 vs 24×3) is almost irrelevant. Sensible-bot median turns to win, inflation 1.00:

| months per lap | combos | family median | full median | sensible cash @ turn 10 |
|---|---|---|---|---|
| 120 (today) | 24×5 | 19–20 | 21–22 | ~400k |
| 72 | 24×3 | 21 | 23 | ~175k |
| 60 | **12×5** | **24** | **27** | ~160k |
| 48 | 24×2 | 26 | 29 | ~105k |
| 36 | 12×3 | 30 | 34 | ~80k |
| 24 | 12×2 | 39 | 44 | ~54k |

   Today's 120 months per lap leaves the **full-mode median at 21–22, below the 25–40 target**. It also leaves ~₪400k idle cash at turn 10, so every deal is affordable and there is little tension. Anything in 48–60 months per lap hits both targets.
2. **Price inflation per lap is a weak balance knob.** It cuts the median by 0–1 turn and p90 by 1–3 turns and leaves bankruptcy unchanged. Card cash flow inflates with price, but salary, fixed expenses and the win threshold do not, so late deals are "bigger" relative to expenses. That speeds the win and cancels the "idle cash loses buying power" effect. Its value is the lesson ("prices rise, idle cash buys less"), not pacing. `EXPENSE_INFLATION` (expense cards only) had no measurable effect (±0 turns, ±1pp bankruptcy).
3. **family_market (approximation) is balance-neutral.** Family sensible median 23 → 23/22, bankruptcy 0%, alwaysBuy 33 → 36/37%. It is safe to ship for its teaching value.
4. **Loan cap / loan floor barely move anything.** At 12×5 with inflation 1.05, the 12 / 18 / 24-salary caps and the −10/−20/−30/−40% salary floors moved family reckless-bot bankruptcy by at most ±5pp. The over-borrowing outcome is driven by the cards and the board, not by these limits.

## Targets vs the recommended settings
**Recommended: `PAYDAY_MONTHS = 12`, board unchanged (5 paydays), `PRICE_INFLATION_PER_LAP = 1.08`, `EXPENSE_INFLATION_PER_LAP = 1.0`, add the family_market deck, keep `LOAN_CAP_SALARIES = 12` and `LOAN_LIMIT_SALARY_PCT = 0.2`.** Shortlist runs, 300 games per row (`economy-runs/shortlist/a_12_5_108.json`, `fm_12_5_108.json`):

| mode | bot | win | bankrupt | median | p10 | p90 | wins after turn 40 | loans/game | cash @ t10 | target | met? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| family | sensible | 100% | 0% | 23 | 15 | 34 | 2% | 1.1 | 158k | median 20–30, bankrupt <5% | yes |
| family | cautious | 97% | 3% | 29 | 19 | 41 | 11% | 0.5 | 166k | — | — |
| family | alwaysBuy | 66% | 33% | 23 | 14 | 40 | 6% | 1.8 | 132k | over-borrower 15–35% | yes (near top) |
| family | overBorrowLite | 47% | 52% | 23 | 14 | 39 | 4% | 1.8 | 115k | over-borrower 15–35% | no (too high) |
| family | overBorrow | 46% | 54% | 24 | 15 | 45 | 7% | 1.4 | 138k | over-borrower 15–35% | no (too high) |
| family | alwaysPass | 0% | 11% | – | – | – | 0% | 1.9 | 166k | worse than sensible | yes |
| full | sensible | 100% | 0% | 26 | 17 | 40 | 10% | 1.0 | 163k | median 25–40, bankrupt <10% | yes |
| full | cautious | 96% | 4% | 35 | 22 | 55 | 30% | 0.7 | 174k | — | — |
| full | alwaysBuy | 82% | 18% | 31 | 18 | 58 | 24% | 3.7 | 99k | over-borrower 25–50% | no (too low) |
| full | overBorrowLite | 68% | 31% | 33 | 19 | 76 | 24% | 5.5 | 92k | over-borrower 25–50% | yes |
| full | overBorrow | 62% | 38% | 33 | 20 | 69 | 23% | 5.2 | 117k | over-borrower 25–50% | yes |
| full | alwaysPass | 0% | 11% | – | – | – | 0% | 1.8 | 163k | worse than sensible | yes |

With the family_market deck on (`fm_12_5_108`), the family rows become: sensible 100% / 0% / median 22 / p90 34; alwaysBuy 37% bankrupt; overBorrowLite 56%. The full rows are identical, because the deck is family-only.

Honest reading of the over-borrowing target: **no single reckless policy lands in both bands.**
- The "borrow even when the loan eats the deal" policies (overBorrow / overBorrowLite) go bankrupt ~52–54% in family and 31–38% in full.
- alwaysBuy goes bankrupt 33% in family and 18% in full.
- Family is harsher on reckless play than full, because full mode can sell assets to survive a shortfall.
- If the owner wants one policy in both bands, the lever is a family-only safety valve, not the loan constants (which did not move it). For example: a family-only first-shortfall grace (one forced loan at the cheap rate), or fewer / smaller family expense cards. I did not test those. They need card or rule changes outside this brief.

Median cash at turn 10 (sensible): **family ₪158k, full ₪163k** with the recommendation (today ~₪400k).

### Why 12×5 over the other combos that pass (24×2, 12×3)
- **One constant changes and nothing else.** The board, its UI, the tile art, the Playwright paths and the daily-challenge streams all stay as they are. 24×2 and 12×3 need a new board (fewer payday tiles, more opportunity tiles).
- **"Payday = one year of cash flow" is the clearest possible lesson.** It also matches the copy in the loan dialogs (`loan.paydayNext`, `howto.step*` use `{months}`).
- **Inflation 1.08 per lap at 60 months per lap ≈ 1.55% a year**, almost exactly the Bank of Israel's verified 12-month inflation of 1.6% (see `real-world-verified.md`). 1.05 ≈ 1.0% a year is also fine. On 24×2, 1.08 per lap would mean ≈1.9% a year.
- **Daily-challenge safety.** p90 is 34 family turns, and only 2% of family wins come after turn 40 (the `DAILY_TURN_CAP`). On 12×3, 9% of family wins come after turn 40 and the p90 is 40, which would turn many daily attempts into "not this time".
- 24×2 is the runner-up (family 25 / full 28, cash @10 ~105k) if the designer wants fewer, bigger paydays.

## Per-profession spread (sensible bot, 300 games each)

| profession | family today (med / p90 / bankrupt) | family recommended | full today | full recommended |
|---|---|---|---|---|
| teacher | 18 / 28 / 0% | 23 / 35 / 0% | 20 / 33 / 0% | 27 / 42 / 0% |
| engineer | 20 / 31 / 0% | 23 / 33 / 0% | 23 / 40 / 0% | 26 / 40 / 0% |
| driver | 19 / 31 / 0% | 27 / 40 / 0% | 23 / 39 / 1% | 33 / 49 / 4% |
| nurse | 17 / 28 / 0% | 21 / 31 / 0% | 18 / 33 / 0% | 24 / 37 / 0% |
| programmer | 21 / 33 / 0% | 25 / 35 / 0% | 25 / 41 / 0% | 28 / 42 / 0% |
| police | 16 / 27 / 0% | 21 / 30 / 0% | 18 / 32 / 0% | 24 / 37 / 0% |
| cook | 15 / 24 / 0% | 19 / 30 / 0% | 16 / 28 / 0% | 22 / 35 / 0% |
| lawyer | 22 / 35 / 0% | 25 / 35 / 0% | 26 / 42 / 0% | 27 / 41 / 0% |

Spread with the recommendation: family 19–27 (8 turns), full 22–33 (11 turns). Today it is 15–22 and 16–26. **Driver** is the outlier: hardest, and the only profession with any sensible-bot bankruptcy (4% in full, still under the 10% target). **Cook** is the easiest, just below the family band at 19. Suggested JSON-only tweaks, not simulated: driver −₪100 of monthly expenses, cook +₪100. Re-run `--perProfession` after any change.

## Shortlist runs (all 300 games per row; JSON in `economy-runs/shortlist/`)

| run | knobs | family sensible med / p90 | family alwaysBuy / overBorrowLite bankrupt | full sensible med / p90 | full alwaysBuy / overBorrowLite bankrupt |
|---|---|---|---|---|---|
| base | 24×5, infl 1.00 | 19 / 31 | 31% / 43% | 21 / 38 | 13% / 24% |
| a_12_5_100 | 12×5, 1.00 | 24 / 37 | 36% / 55% | 27 / 42 | 15% / 33% |
| a_12_5_105 | 12×5, 1.05 | 23 / 35 | 33% / 50% | 26 / 41 | 15% / 31% |
| **a_12_5_108** | **12×5, 1.08** | **23 / 34** | **33% / 52%** | **26 / 40** | **18% / 31%** |
| b_24_2_105 | 24×2, 1.05 | 25 / 33 | 36% / 61% | 28 / 41 | 18% / 39% |
| c_12_3_105 | 12×3, 1.05 | 30 / 40 | 34% / 62% | 34 / 47 | 20% / 37% |
| fm_12_5_105 | + family_market | 23 / 35 | 36% / 56% | (= a_12_5_105) | |
| fm_12_5_108 | + family_market | 22 / 34 | 37% / 56% | (= a_12_5_108) | |
| fm_base | 24×5 + family_market | 19 / 31 | 30% / 42% | (= base) | |
| cap18_12_5_105 | loan cap 18 salaries | 22 / 33 | 35% / 56% | 26 / 40 | 17% / 41% |
| cap24_12_5_105 | loan cap 24 salaries | 22 / 32 | 31% / 59% | 25 / 39 | 19% / 41% |
| cap18_12_5_108 | cap 18, infl 1.08 | 22 / 32 | 35% / 56% | 25 / 39 | 19% / 40% |
| pct_0.1 / 0.3 / 0.4 | loan floor −10/−30/−40% salary | 23 / 35 | 33–34% / 50–51% | 26 / 40–41 | 13–19% / 29–35% |
| exp_1.05 / exp_1.08 | expense cards inflate too | 23 / 34–35 | 33% / 51–53% | 26 / 40–41 | 15–19% / 32–34% |

Across all of these, sensible-bot bankruptcy is 0% (family) and ≤1% (full), and alwaysBuy and alwaysPass always win less often than sensible.

## Risks
1. **Daily challenge: lap-based inflation breaks "same for everyone".** In the daily, dice come from `dailyDie(seed, turn, k)`, but a charity donation adds a second die (`k = 1`) for 3 turns, so two players' positions, and therefore their lap counts, diverge. Measured in the copy over 60 daily seeds, a donating sensible bot vs a never-donating bot: the lap number differed on **397 of 1,129 compared turns, in 47 of 60 days (max 2 laps apart)**. Prices shown on the same turn would then differ between players.
   - **Fix (recommended):** price inflation in a daily uses a *virtual* lap that depends only on the date: `lapForPricing = floor(Σ_{i≤turn} dailyDie(seed, i, 0) / 24)`, i.e. the first-die stream that every player shares. In normal games it equals `d.lap` whenever no charity was taken, so use `d.lap` there.
   - Alternative: disable inflation in the daily.
   - In both cases inflation reads only (seed, turn), never a choice. Add a unit test: two daily runs with different choices see identical card prices on every turn.
2. **Saves.** `lap` (and the family_market timers `rentCutTurns` / `cheapLoanTurns`) are new state fields, so the schema version goes 3 → 4. Migration: derive `lap` from `turn` is impossible exactly, so use `lap = 0` for old saves (prices simply start inflating from the load). Old saves keep their 24-month payday history. The change is only forward.
3. **UI copy and teaching.** Every string that interpolates `{months}` (statement payday line, loan dialogs, how-to steps, family HUD) changes from 24 to 12 automatically. Check any hard-coded "24" in `he.json`, tips or lessons. The loan dialog's "interest until next payday" halves, which is correct.
4. **QA baselines.** The `docs/BALANCE.md` "After" table, any test pinned to turns-to-win, and the 100-game simulation numbers in the QA report must be regenerated. Seeds stay the same.
5. **Inflation realism vs pacing.** Inflating card cash flow but not salary or expenses makes late deals relatively stronger (−1 turn). If later someone also inflates salaries or fixed expenses, re-run: that version slows the game instead.
6. **Over-borrowing band.** As shown, it is met by alwaysBuy in family and by overBorrow / overBorrowLite in full, not by one bot. QA should use the same bot-to-mode mapping, or the owner should accept it.
7. **family_market is approximated.** The rent cut here hits payday cash only. A real implementation that also lowers `passiveIncome` during the 3 turns can delay a win by up to 3 turns. Expect family median +0–1, and re-simulate after the developer implements it.

## Full sweep: every combination × every bot (300 games per row, family_market off)
`economy-runs/sweep/*.json`. "Implied infl/yr" = f^(12 / months per lap) − 1.

| PAYDAY_MONTHS | PAYDAY_TILES | PRICE_INFL/lap | months/lap | implied infl/yr | mode | bot | win | bankrupt | timeout | median | p90 | loans/game | median cash @ turn 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 2 | 1.00 | 24 | 0.0% | family | sensible | 100% | 0% | 0% | 39 | 51 | 2.2 | 54k |
| 12 | 2 | 1.00 | 24 | 0.0% | family | cautious | 93% | 7% | 0% | 56 | 80 | 1.5 | 59k |
| 12 | 2 | 1.00 | 24 | 0.0% | family | alwaysBuy | 68% | 30% | 2% | 43 | 78 | 3.7 | 53k |
| 12 | 2 | 1.00 | 24 | 0.0% | family | overBorrow | 35% | 64% | 1% | 48 | 96 | 2.8 | 79k |
| 12 | 2 | 1.00 | 24 | 0.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.3 | 56k |
| 12 | 2 | 1.00 | 24 | 0.0% | full | sensible | 100% | 0% | 0% | 44 | 62 | 2.1 | 53k |
| 12 | 2 | 1.00 | 24 | 0.0% | full | cautious | 90% | 8% | 2% | 67 | 109 | 1.6 | 57k |
| 12 | 2 | 1.00 | 24 | 0.0% | full | alwaysBuy | 72% | 16% | 13% | 56 | 118 | 6.4 | 43k |
| 12 | 2 | 1.00 | 24 | 0.0% | full | overBorrow | 43% | 45% | 12% | 71 | 158 | 9.1 | 51k |
| 12 | 2 | 1.00 | 24 | 0.0% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.4 | 54k |
| 12 | 2 | 1.05 | 24 | 2.5% | family | sensible | 100% | 0% | 0% | 39 | 53 | 2.0 | 54k |
| 12 | 2 | 1.05 | 24 | 2.5% | family | cautious | 90% | 8% | 1% | 58 | 83 | 1.7 | 59k |
| 12 | 2 | 1.05 | 24 | 2.5% | family | alwaysBuy | 65% | 35% | 0% | 41 | 71 | 3.3 | 55k |
| 12 | 2 | 1.05 | 24 | 2.5% | family | overBorrow | 37% | 62% | 1% | 43 | 72 | 2.2 | 80k |
| 12 | 2 | 1.05 | 24 | 2.5% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.3 | 56k |
| 12 | 2 | 1.05 | 24 | 2.5% | full | sensible | 99% | 0% | 0% | 44 | 65 | 2.0 | 54k |
| 12 | 2 | 1.05 | 24 | 2.5% | full | cautious | 84% | 9% | 7% | 67 | 106 | 1.8 | 57k |
| 12 | 2 | 1.05 | 24 | 2.5% | full | alwaysBuy | 77% | 15% | 8% | 56 | 104 | 5.8 | 44k |
| 12 | 2 | 1.05 | 24 | 2.5% | full | overBorrow | 49% | 39% | 12% | 74 | 156 | 8.6 | 54k |
| 12 | 2 | 1.05 | 24 | 2.5% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.4 | 54k |
| 12 | 2 | 1.08 | 24 | 3.9% | family | sensible | 100% | 0% | 0% | 39 | 52 | 2.1 | 54k |
| 12 | 2 | 1.08 | 24 | 3.9% | family | cautious | 88% | 9% | 3% | 60 | 89 | 1.9 | 59k |
| 12 | 2 | 1.08 | 24 | 3.9% | family | alwaysBuy | 66% | 34% | 0% | 41 | 64 | 2.8 | 54k |
| 12 | 2 | 1.08 | 24 | 3.9% | family | overBorrow | 40% | 58% | 2% | 46 | 80 | 1.8 | 79k |
| 12 | 2 | 1.08 | 24 | 3.9% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.3 | 56k |
| 12 | 2 | 1.08 | 24 | 3.9% | full | sensible | 99% | 1% | 0% | 45 | 68 | 1.9 | 56k |
| 12 | 2 | 1.08 | 24 | 3.9% | full | cautious | 80% | 9% | 11% | 71 | 116 | 2.0 | 57k |
| 12 | 2 | 1.08 | 24 | 3.9% | full | alwaysBuy | 81% | 13% | 6% | 59 | 125 | 4.6 | 45k |
| 12 | 2 | 1.08 | 24 | 3.9% | full | overBorrow | 52% | 40% | 8% | 75 | 151 | 8.0 | 56k |
| 12 | 2 | 1.08 | 24 | 3.9% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.4 | 54k |
| 12 | 3 | 1.00 | 36 | 0.0% | family | sensible | 100% | 0% | 0% | 30 | 41 | 1.8 | 79k |
| 12 | 3 | 1.00 | 36 | 0.0% | family | cautious | 95% | 5% | 0% | 41 | 58 | 1.0 | 94k |
| 12 | 3 | 1.00 | 36 | 0.0% | family | alwaysBuy | 66% | 34% | 0% | 32 | 63 | 3.1 | 65k |
| 12 | 3 | 1.00 | 36 | 0.0% | family | overBorrow | 38% | 62% | 0% | 33 | 75 | 2.1 | 95k |
| 12 | 3 | 1.00 | 36 | 0.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.2 | 89k |
| 12 | 3 | 1.00 | 36 | 0.0% | full | sensible | 100% | 0% | 0% | 34 | 47 | 1.6 | 85k |
| 12 | 3 | 1.00 | 36 | 0.0% | full | cautious | 94% | 6% | 0% | 49 | 74 | 1.1 | 92k |
| 12 | 3 | 1.00 | 36 | 0.0% | full | alwaysBuy | 78% | 19% | 3% | 39 | 86 | 5.3 | 62k |
| 12 | 3 | 1.00 | 36 | 0.0% | full | overBorrow | 50% | 46% | 4% | 47 | 101 | 8.2 | 70k |
| 12 | 3 | 1.00 | 36 | 0.0% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.2 | 89k |
| 12 | 3 | 1.05 | 36 | 1.6% | family | sensible | 100% | 0% | 0% | 30 | 40 | 1.7 | 82k |
| 12 | 3 | 1.05 | 36 | 1.6% | family | cautious | 95% | 5% | 0% | 41 | 60 | 1.0 | 95k |
| 12 | 3 | 1.05 | 36 | 1.6% | family | alwaysBuy | 66% | 34% | 0% | 30 | 59 | 2.7 | 69k |
| 12 | 3 | 1.05 | 36 | 1.6% | family | overBorrow | 39% | 61% | 0% | 32 | 60 | 1.9 | 98k |
| 12 | 3 | 1.05 | 36 | 1.6% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.2 | 89k |
| 12 | 3 | 1.05 | 36 | 1.6% | full | sensible | 100% | 0% | 0% | 34 | 47 | 1.5 | 85k |
| 12 | 3 | 1.05 | 36 | 1.6% | full | cautious | 92% | 7% | 1% | 48 | 72 | 1.3 | 92k |
| 12 | 3 | 1.05 | 36 | 1.6% | full | alwaysBuy | 79% | 20% | 1% | 40 | 75 | 4.9 | 64k |
| 12 | 3 | 1.05 | 36 | 1.6% | full | overBorrow | 53% | 44% | 3% | 47 | 118 | 6.8 | 77k |
| 12 | 3 | 1.05 | 36 | 1.6% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.2 | 89k |
| 12 | 3 | 1.08 | 36 | 2.6% | family | sensible | 100% | 0% | 0% | 29 | 40 | 1.7 | 86k |
| 12 | 3 | 1.08 | 36 | 2.6% | family | cautious | 94% | 5% | 0% | 41 | 61 | 1.1 | 95k |
| 12 | 3 | 1.08 | 36 | 2.6% | family | alwaysBuy | 66% | 33% | 0% | 29 | 54 | 2.7 | 74k |
| 12 | 3 | 1.08 | 36 | 2.6% | family | overBorrow | 37% | 62% | 0% | 31 | 64 | 1.8 | 102k |
| 12 | 3 | 1.08 | 36 | 2.6% | family | alwaysPass | 0% | 11% | 89% | - | - | 2.2 | 89k |
| 12 | 3 | 1.08 | 36 | 2.6% | full | sensible | 100% | 0% | 0% | 34 | 48 | 1.5 | 86k |
| 12 | 3 | 1.08 | 36 | 2.6% | full | cautious | 89% | 7% | 4% | 48 | 73 | 1.4 | 92k |
| 12 | 3 | 1.08 | 36 | 2.6% | full | alwaysBuy | 82% | 17% | 1% | 39 | 82 | 4.5 | 66k |
| 12 | 3 | 1.08 | 36 | 2.6% | full | overBorrow | 58% | 40% | 2% | 48 | 122 | 6.2 | 77k |
| 12 | 3 | 1.08 | 36 | 2.6% | full | alwaysPass | 0% | 12% | 88% | - | - | 2.2 | 89k |
| 12 | 5 | 1.00 | 60 | 0.0% | family | sensible | 100% | 0% | 0% | 24 | 37 | 1.1 | 159k |
| 12 | 5 | 1.00 | 60 | 0.0% | family | cautious | 98% | 2% | 0% | 31 | 46 | 0.3 | 167k |
| 12 | 5 | 1.00 | 60 | 0.0% | family | alwaysBuy | 64% | 36% | 0% | 25 | 50 | 2.0 | 122k |
| 12 | 5 | 1.00 | 60 | 0.0% | family | overBorrow | 47% | 53% | 0% | 27 | 51 | 1.6 | 132k |
| 12 | 5 | 1.00 | 60 | 0.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.9 | 166k |
| 12 | 5 | 1.00 | 60 | 0.0% | full | sensible | 100% | 0% | 0% | 27 | 42 | 0.9 | 165k |
| 12 | 5 | 1.00 | 60 | 0.0% | full | cautious | 97% | 3% | 0% | 38 | 64 | 0.4 | 172k |
| 12 | 5 | 1.00 | 60 | 0.0% | full | alwaysBuy | 84% | 15% | 1% | 30 | 69 | 3.6 | 99k |
| 12 | 5 | 1.00 | 60 | 0.0% | full | overBorrow | 62% | 38% | 0% | 35 | 73 | 5.1 | 106k |
| 12 | 5 | 1.00 | 60 | 0.0% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.8 | 163k |
| 12 | 5 | 1.05 | 60 | 1.0% | family | sensible | 100% | 0% | 0% | 23 | 35 | 1.1 | 159k |
| 12 | 5 | 1.05 | 60 | 1.0% | family | cautious | 98% | 2% | 0% | 30 | 44 | 0.4 | 165k |
| 12 | 5 | 1.05 | 60 | 1.0% | family | alwaysBuy | 67% | 33% | 0% | 23 | 46 | 2.0 | 125k |
| 12 | 5 | 1.05 | 60 | 1.0% | family | overBorrow | 46% | 54% | 0% | 26 | 46 | 1.5 | 136k |
| 12 | 5 | 1.05 | 60 | 1.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.9 | 166k |
| 12 | 5 | 1.05 | 60 | 1.0% | full | sensible | 100% | 0% | 0% | 26 | 41 | 1.0 | 165k |
| 12 | 5 | 1.05 | 60 | 1.0% | full | cautious | 96% | 4% | 0% | 35 | 56 | 0.7 | 173k |
| 12 | 5 | 1.05 | 60 | 1.0% | full | alwaysBuy | 85% | 15% | 1% | 32 | 64 | 3.6 | 98k |
| 12 | 5 | 1.05 | 60 | 1.0% | full | overBorrow | 61% | 38% | 0% | 33 | 70 | 4.9 | 112k |
| 12 | 5 | 1.05 | 60 | 1.0% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.8 | 163k |
| 12 | 5 | 1.08 | 60 | 1.6% | family | sensible | 100% | 0% | 0% | 23 | 34 | 1.1 | 158k |
| 12 | 5 | 1.08 | 60 | 1.6% | family | cautious | 97% | 3% | 0% | 29 | 41 | 0.5 | 166k |
| 12 | 5 | 1.08 | 60 | 1.6% | family | alwaysBuy | 66% | 33% | 1% | 23 | 40 | 1.8 | 132k |
| 12 | 5 | 1.08 | 60 | 1.6% | family | overBorrow | 46% | 54% | 1% | 24 | 45 | 1.4 | 138k |
| 12 | 5 | 1.08 | 60 | 1.6% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.9 | 166k |
| 12 | 5 | 1.08 | 60 | 1.6% | full | sensible | 100% | 0% | 0% | 26 | 40 | 1.0 | 163k |
| 12 | 5 | 1.08 | 60 | 1.6% | full | cautious | 96% | 4% | 0% | 35 | 55 | 0.7 | 174k |
| 12 | 5 | 1.08 | 60 | 1.6% | full | alwaysBuy | 82% | 18% | 1% | 31 | 58 | 3.7 | 99k |
| 12 | 5 | 1.08 | 60 | 1.6% | full | overBorrow | 62% | 38% | 0% | 33 | 69 | 5.2 | 117k |
| 12 | 5 | 1.08 | 60 | 1.6% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.8 | 163k |
| 24 | 2 | 1.00 | 48 | 0.0% | family | sensible | 100% | 0% | 0% | 26 | 35 | 1.5 | 103k |
| 24 | 2 | 1.00 | 48 | 0.0% | family | cautious | 96% | 4% | 0% | 34 | 49 | 0.5 | 106k |
| 24 | 2 | 1.00 | 48 | 0.0% | family | alwaysBuy | 63% | 37% | 0% | 27 | 56 | 2.4 | 91k |
| 24 | 2 | 1.00 | 48 | 0.0% | family | overBorrow | 37% | 63% | 0% | 28 | 55 | 1.9 | 113k |
| 24 | 2 | 1.00 | 48 | 0.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.4 | 104k |
| 24 | 2 | 1.00 | 48 | 0.0% | full | sensible | 100% | 0% | 0% | 29 | 41 | 1.5 | 109k |
| 24 | 2 | 1.00 | 48 | 0.0% | full | cautious | 95% | 5% | 0% | 41 | 61 | 0.6 | 103k |
| 24 | 2 | 1.00 | 48 | 0.0% | full | alwaysBuy | 78% | 21% | 0% | 33 | 69 | 4.0 | 80k |
| 24 | 2 | 1.00 | 48 | 0.0% | full | overBorrow | 55% | 44% | 1% | 38 | 80 | 4.5 | 81k |
| 24 | 2 | 1.00 | 48 | 0.0% | full | alwaysPass | 0% | 12% | 88% | - | - | 1.4 | 100k |
| 24 | 2 | 1.05 | 48 | 1.2% | family | sensible | 100% | 0% | 0% | 25 | 33 | 1.5 | 102k |
| 24 | 2 | 1.05 | 48 | 1.2% | family | cautious | 96% | 4% | 0% | 33 | 47 | 0.5 | 107k |
| 24 | 2 | 1.05 | 48 | 1.2% | family | alwaysBuy | 64% | 36% | 0% | 25 | 48 | 2.3 | 97k |
| 24 | 2 | 1.05 | 48 | 1.2% | family | overBorrow | 41% | 58% | 0% | 26 | 48 | 1.6 | 114k |
| 24 | 2 | 1.05 | 48 | 1.2% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.4 | 104k |
| 24 | 2 | 1.05 | 48 | 1.2% | full | sensible | 100% | 0% | 0% | 28 | 41 | 1.5 | 109k |
| 24 | 2 | 1.05 | 48 | 1.2% | full | cautious | 94% | 5% | 0% | 41 | 60 | 0.6 | 104k |
| 24 | 2 | 1.05 | 48 | 1.2% | full | alwaysBuy | 82% | 18% | 0% | 34 | 68 | 3.3 | 81k |
| 24 | 2 | 1.05 | 48 | 1.2% | full | overBorrow | 56% | 44% | 0% | 38 | 118 | 3.9 | 82k |
| 24 | 2 | 1.05 | 48 | 1.2% | full | alwaysPass | 0% | 12% | 88% | - | - | 1.4 | 100k |
| 24 | 2 | 1.08 | 48 | 1.9% | family | sensible | 100% | 0% | 0% | 25 | 33 | 1.6 | 105k |
| 24 | 2 | 1.08 | 48 | 1.9% | family | cautious | 96% | 4% | 0% | 33 | 48 | 0.5 | 109k |
| 24 | 2 | 1.08 | 48 | 1.9% | family | alwaysBuy | 66% | 34% | 0% | 25 | 43 | 2.4 | 100k |
| 24 | 2 | 1.08 | 48 | 1.9% | family | overBorrow | 41% | 59% | 0% | 25 | 48 | 1.5 | 118k |
| 24 | 2 | 1.08 | 48 | 1.9% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.4 | 104k |
| 24 | 2 | 1.08 | 48 | 1.9% | full | sensible | 100% | 0% | 0% | 29 | 42 | 1.4 | 108k |
| 24 | 2 | 1.08 | 48 | 1.9% | full | cautious | 94% | 6% | 1% | 40 | 60 | 0.7 | 104k |
| 24 | 2 | 1.08 | 48 | 1.9% | full | alwaysBuy | 78% | 21% | 0% | 33 | 74 | 3.5 | 84k |
| 24 | 2 | 1.08 | 48 | 1.9% | full | overBorrow | 55% | 45% | 1% | 37 | 97 | 4.1 | 84k |
| 24 | 2 | 1.08 | 48 | 1.9% | full | alwaysPass | 0% | 12% | 88% | - | - | 1.4 | 100k |
| 24 | 3 | 1.00 | 72 | 0.0% | family | sensible | 100% | 0% | 0% | 21 | 30 | 1.1 | 175k |
| 24 | 3 | 1.00 | 72 | 0.0% | family | cautious | 98% | 2% | 0% | 28 | 39 | 0.2 | 169k |
| 24 | 3 | 1.00 | 72 | 0.0% | family | alwaysBuy | 66% | 34% | 0% | 21 | 44 | 2.1 | 123k |
| 24 | 3 | 1.00 | 72 | 0.0% | family | overBorrow | 48% | 52% | 0% | 23 | 44 | 1.3 | 143k |
| 24 | 3 | 1.00 | 72 | 0.0% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 171k |
| 24 | 3 | 1.00 | 72 | 0.0% | full | sensible | 100% | 0% | 0% | 23 | 35 | 0.9 | 179k |
| 24 | 3 | 1.00 | 72 | 0.0% | full | cautious | 98% | 2% | 0% | 33 | 49 | 0.2 | 172k |
| 24 | 3 | 1.00 | 72 | 0.0% | full | alwaysBuy | 80% | 20% | 0% | 27 | 62 | 3.5 | 113k |
| 24 | 3 | 1.00 | 72 | 0.0% | full | overBorrow | 61% | 39% | 0% | 29 | 63 | 4.0 | 111k |
| 24 | 3 | 1.00 | 72 | 0.0% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 173k |
| 24 | 3 | 1.05 | 72 | 0.8% | family | sensible | 100% | 0% | 0% | 20 | 29 | 1.1 | 175k |
| 24 | 3 | 1.05 | 72 | 0.8% | family | cautious | 98% | 2% | 0% | 27 | 38 | 0.3 | 175k |
| 24 | 3 | 1.05 | 72 | 0.8% | family | alwaysBuy | 64% | 36% | 0% | 21 | 36 | 1.9 | 122k |
| 24 | 3 | 1.05 | 72 | 0.8% | family | overBorrow | 45% | 55% | 0% | 21 | 36 | 1.3 | 146k |
| 24 | 3 | 1.05 | 72 | 0.8% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 171k |
| 24 | 3 | 1.05 | 72 | 0.8% | full | sensible | 100% | 0% | 0% | 23 | 34 | 0.9 | 179k |
| 24 | 3 | 1.05 | 72 | 0.8% | full | cautious | 98% | 2% | 0% | 31 | 48 | 0.3 | 173k |
| 24 | 3 | 1.05 | 72 | 0.8% | full | alwaysBuy | 81% | 19% | 0% | 25 | 62 | 3.1 | 119k |
| 24 | 3 | 1.05 | 72 | 0.8% | full | overBorrow | 63% | 37% | 0% | 27 | 62 | 3.7 | 109k |
| 24 | 3 | 1.05 | 72 | 0.8% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 173k |
| 24 | 3 | 1.08 | 72 | 1.3% | family | sensible | 100% | 0% | 0% | 20 | 28 | 1.1 | 173k |
| 24 | 3 | 1.08 | 72 | 1.3% | family | cautious | 97% | 3% | 0% | 26 | 38 | 0.3 | 175k |
| 24 | 3 | 1.08 | 72 | 1.3% | family | alwaysBuy | 63% | 37% | 0% | 21 | 35 | 1.7 | 123k |
| 24 | 3 | 1.08 | 72 | 1.3% | family | overBorrow | 45% | 55% | 0% | 21 | 34 | 1.3 | 151k |
| 24 | 3 | 1.08 | 72 | 1.3% | family | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 171k |
| 24 | 3 | 1.08 | 72 | 1.3% | full | sensible | 100% | 0% | 0% | 22 | 33 | 1.0 | 180k |
| 24 | 3 | 1.08 | 72 | 1.3% | full | cautious | 97% | 3% | 0% | 31 | 47 | 0.4 | 173k |
| 24 | 3 | 1.08 | 72 | 1.3% | full | alwaysBuy | 81% | 19% | 0% | 25 | 54 | 3.1 | 121k |
| 24 | 3 | 1.08 | 72 | 1.3% | full | overBorrow | 63% | 36% | 0% | 27 | 61 | 3.7 | 108k |
| 24 | 3 | 1.08 | 72 | 1.3% | full | alwaysPass | 0% | 11% | 89% | - | - | 1.3 | 173k |
| 24 | 5 | 1.00 | 120 | 0.0% | family | sensible | 100% | 0% | 0% | 19 | 31 | 0.6 | 406k |
| 24 | 5 | 1.00 | 120 | 0.0% | family | cautious | 99% | 1% | 0% | 23 | 37 | 0.1 | 364k |
| 24 | 5 | 1.00 | 120 | 0.0% | family | alwaysBuy | 69% | 31% | 0% | 18 | 41 | 1.2 | 274k |
| 24 | 5 | 1.00 | 120 | 0.0% | family | overBorrow | 55% | 45% | 0% | 19 | 41 | 1.0 | 271k |
| 24 | 5 | 1.00 | 120 | 0.0% | family | alwaysPass | 0% | 10% | 90% | - | - | 1.1 | 329k |
| 24 | 5 | 1.00 | 120 | 0.0% | full | sensible | 100% | 0% | 0% | 21 | 38 | 0.5 | 397k |
| 24 | 5 | 1.00 | 120 | 0.0% | full | cautious | 99% | 1% | 0% | 28 | 47 | 0.1 | 367k |
| 24 | 5 | 1.00 | 120 | 0.0% | full | alwaysBuy | 87% | 13% | 0% | 23 | 54 | 2.2 | 221k |
| 24 | 5 | 1.00 | 120 | 0.0% | full | overBorrow | 70% | 30% | 0% | 22 | 49 | 2.9 | 205k |
| 24 | 5 | 1.00 | 120 | 0.0% | full | alwaysPass | 0% | 10% | 90% | - | - | 1.0 | 321k |
| 24 | 5 | 1.05 | 120 | 0.5% | family | sensible | 100% | 0% | 0% | 18 | 28 | 0.6 | 406k |
| 24 | 5 | 1.05 | 120 | 0.5% | family | cautious | 99% | 1% | 0% | 22 | 34 | 0.1 | 363k |
| 24 | 5 | 1.05 | 120 | 0.5% | family | alwaysBuy | 68% | 32% | 0% | 17 | 31 | 1.2 | 287k |
| 24 | 5 | 1.05 | 120 | 0.5% | family | overBorrow | 55% | 45% | 0% | 18 | 34 | 0.9 | 269k |
| 24 | 5 | 1.05 | 120 | 0.5% | family | alwaysPass | 0% | 10% | 90% | - | - | 1.1 | 329k |
| 24 | 5 | 1.05 | 120 | 0.5% | full | sensible | 100% | 0% | 0% | 20 | 34 | 0.5 | 395k |
| 24 | 5 | 1.05 | 120 | 0.5% | full | cautious | 99% | 1% | 0% | 26 | 42 | 0.1 | 364k |
| 24 | 5 | 1.05 | 120 | 0.5% | full | alwaysBuy | 85% | 15% | 0% | 21 | 47 | 2.3 | 221k |
| 24 | 5 | 1.05 | 120 | 0.5% | full | overBorrow | 69% | 31% | 0% | 22 | 50 | 2.7 | 205k |
| 24 | 5 | 1.05 | 120 | 0.5% | full | alwaysPass | 0% | 10% | 90% | - | - | 1.0 | 321k |
| 24 | 5 | 1.08 | 120 | 0.8% | family | sensible | 100% | 0% | 0% | 18 | 27 | 0.6 | 406k |
| 24 | 5 | 1.08 | 120 | 0.8% | family | cautious | 99% | 1% | 0% | 21 | 33 | 0.1 | 359k |
| 24 | 5 | 1.08 | 120 | 0.8% | family | alwaysBuy | 68% | 32% | 0% | 17 | 31 | 1.1 | 286k |
| 24 | 5 | 1.08 | 120 | 0.8% | family | overBorrow | 52% | 48% | 0% | 18 | 30 | 0.9 | 273k |
| 24 | 5 | 1.08 | 120 | 0.8% | family | alwaysPass | 0% | 10% | 90% | - | - | 1.1 | 329k |
| 24 | 5 | 1.08 | 120 | 0.8% | full | sensible | 100% | 0% | 0% | 19 | 33 | 0.5 | 396k |
| 24 | 5 | 1.08 | 120 | 0.8% | full | cautious | 99% | 1% | 0% | 25 | 40 | 0.1 | 364k |
| 24 | 5 | 1.08 | 120 | 0.8% | full | alwaysBuy | 84% | 16% | 0% | 20 | 45 | 2.2 | 220k |
| 24 | 5 | 1.08 | 120 | 0.8% | full | overBorrow | 69% | 31% | 0% | 20 | 45 | 2.6 | 198k |
| 24 | 5 | 1.08 | 120 | 0.8% | full | alwaysPass | 0% | 10% | 90% | - | - | 1.0 | 321k |
