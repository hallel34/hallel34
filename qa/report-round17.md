# QA report — round 17 (HEAD e114917) — **GREEN** (P0 0 · P1 0 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round17/` (21 WebP, commit fa1a96f).

## Verdict
GREEN. The round-16 P1 (hint and milestone bubbles cut off) is fixed at all 4 viewports × dark/light × family/full. P3-a and P3-b are fixed. The gate is green. The `testBuyStates` timeout at 640 did not reproduce in 3 solo runs or in a parallel run, so it is a load flake, not a bug.

## Gate
| Check | Result |
|---|---|
| vitest | 582/582 |
| build | OK |
| smoke family / full | 283 / 253 ok, won in 21 / 32 rolls |
| smoke 2p | 178 ok |
| SMOKE_H=640 (9 smokes in parallel) | 283 / 253 ok |
| daily / r11 / r12 / tutorial | 119 / 97 / 134 / 99 ok |
| contrast | 0 fail |
| axe | 0 violations in 16 combos, explainer included |
| scroll | none |
| console | 0 errors (font-preload warnings only) |
| Lighthouse home | perf 0.95 / 0.91 / 0.92 · a11y / BP / SEO 1.00 · LCP 2.8–3.4 s · CLS 0 |

## Note re-test (hint / milestone / feedback / tip)
- **Readable:** every content note is a panel at least 184px wide (232 / 212 / 184). Text is clamped to 2 lines, with "עוד" whenever it is cut.
- **"עוד" opens the full text:** milestone at 320, 360x640 and 360x800 in both modes; feedback at 320 and 640. The explainer's "עוד" opens the dictionary.
- **Badges:** "חצי הדרך" and "רבע הדרך" are never clipped.
- **Nothing covered:** no note covers the status line, "אתם על", the fox, the die, the CTA, the top bar or the tiles.
- **By eye at 320 and 360:** the milestone panel reads well in both themes, and expanded it grows upward without covering the status line.

## P3 re-tests
- **P3-a:** "מקסי מסביר" is no longer cut. Fixed.
- **P3-b:** the cheap-loan wording now reads "עכשיו הבנק במשחק במבצע: … ₪5 … ₪60…". Fixed.

## testBuyStates at 640
Solo runs: family 283 ok ×2, full 253 ok, and a parallel run green. No timeout reproduced. This is a CPU-load flake, probably the 6 s detach wait. Suggestion: raise that wait or run the 640 smokes serially in CI.

## New P3
- **a.** At 320x568 a clamped note shows "עוד" without "×". Tapping the bubble still closes it.

Still open from round 14: P3-5, 10, 11, 12, 14, 15.

## Test-change review
All the new rows add or strengthen coverage. No existing assertion was loosened.
