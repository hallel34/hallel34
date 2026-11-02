# QA report — round 23 (missions integration, HEAD cc343a4) — **GREEN** (P0 0 · P1 0 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round23/` (17 WebP, commit 6dc6350).

## Gate
vitest 684/684, build OK. Smokes: family (incl. junior and junior missions) 349, 640 family 349, full/640 full/2p 248/248/177, daily 119, r11 117, r12 134, tutorial 99, business PASSED, payday 54, mission and missions PASSED, all 0 FAIL. Contrast 0 fail, axe 0, no scroll, targets ≥48px, 0 console errors. Lighthouse home perf 0.93–0.95, a11y/BP/SEO 1.00, CLS 0.

## Round-22 findings: all fixed
- **Dated smoke fixture:** now `dayKey()`.
- **Adult words in family missions:** 0 across 18 runs; kid-vocabulary scans the mission groups.
- **Age band:** "עד 10" plays coin versions with 0 ₪ and nothing over 999. 11–13 and no age keep ₪.
- **data-action:** "missions".
- **Docs:** moved to docs/missions/.
- **Restart-confirm contrast:** fixed.

## Save isolation
Separate slots for junior and ₪, the normal save byte-identical, and age switching corrupts nothing.

## Double tap
A real double-click is fixed. P3 residual: two separate single clicks 60 ms apart still pass on the first-asset result; a time-only guard would close it.

## r11 104 vs 105
No check disappeared: the distinct-check set is identical. Only per-turn repetition counts vary with run length. Not a weakening.

## Test-change review
All rows are forced fixes or added coverage. No assertion was loosened.

## Observation
Picker copy: a completed junior first asset reads "יש התקדמות שמורה", and an unplayed variant reads "כבר תרגלתם". Worth a copy look.
