# QA report — round 19 (HEAD df2482a = main 9f562cd + 5 commits) — **GREEN** for this branch (P0 0 · P1 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round19/` (18 WebP, commit 6a3bebc).

## Gate
| Check | Result |
|---|---|
| vitest | 645/645 |
| build | OK |
| smoke family (incl. junior) / 640 | 325 / 325 ok |
| smoke full / 640 full / 2p | 247 / 247 / 176 ok, 1 FAIL each: L3, pre-existing on main |
| daily / r11 / r12 / tutorial | 119 / 119 / 134 / 99 ok |
| smoke:business | PASSED |
| contrast | 0 fail |
| axe | 0, except 1 serious on renovation `.reno-or`, pre-existing on main |
| scroll / console | none / 0 |
| Lighthouse home | a11y / BP / SEO 1.00; perf 0.89–0.90 on the branch and on main (P2, pre-existing) |

## Re-tests (all fixed)
- **Round-18 P1:** junior decision cards (dec-001/005/008/009f) show no ₪. The only numbers over 999 are option first payments (allowed).
- **P2-1:** "× 12" shows at 320.
- **P2-2:** no adult terms after switching mode by age.
- **P2-3:** the loan cap reads "אפשר להוסיף עוד N פעמים 100 מטבעות".
- **P3:** one coin in the HUD at 320, and ASCII "-".

## New surfaces
- **Renovation:** junior and family are correct. P2 (pre-existing): `.reno-or` contrast is 3.82:1. P3: the single-player text mentions "המכרז בין שאר השחקנים".
- **Auctions (junior + adult, junior + bot):** each bidder sees their own scale, with no adult words and axe 0. P3: the HUD behind an auction shows the passer's cash in the bidder's scale; "נועה ויתר" is masculine; a junior bid button can show 4 digits.

## L3 "same feedback line twice in a row" — pre-existing on main
Commit a84d118 (PRs 8–12) changed the full-mode feedback to a single fixed line per group, so the line repeats. This is a conflict between the requirement and the test, not a bug introduced by this branch. Classified P2 for the owner: restore variants, or change L3 with the owner's approval.
