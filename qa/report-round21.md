# QA report — round 21 (HEAD c147ec0 = main 9b581fc + payday fix) — **GREEN** (P0 0 · P1 0 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round21/` (12 WebP, commit abc9c37).

## Gate
vitest 655/655, build OK. Smokes: family 325, full 248, 2p 177, 640 325/248, daily 119, r11 105, r12 134, tutorial 99, business PASSED, payday (new) 54, all 0 FAIL. Contrast 0 fail, axe 0 (42 runs), no scroll, 0 console errors. The local CI sequence is green.

## Payday re-test (42 runs: 7 cases × 6 viewport/theme/motion setups)
- **Crossing payday:** the pawn keeps hopping, with a float on the tile and a HUD count-up. After landing: one summary card per crossed payday, then the caption, then the landing card.
- **Cash:** credited exactly once per payday (engine = HUD) in every case. Checked for full, family, junior (coins), land-on-payday, charity crossing 3, charity 2 + land, and hot-seat.
- **Bots:** float and count-up, no card.
- **Daily and tutorial:** the hints are correct.
- **Order:** no card opened before landing, and no overlapping layers.

## 2p "action bar inside viewport"
Passed 3/3 alone and 2/2 in parallel. Flaky under load, not a product defect.

## P3
- The card for a crossed payday says "הכסף מגיע למזומן עכשיו: 600 → 768" after the HUD already shows 768. Suggestion: "נכנס למזומן".
- With several crossings, the first card can open while the count-up is still finishing (the final figures are correct).

## Test rows
`tests/payday-pass.test.js` and `smoke:payday` add coverage. No existing test was changed.
