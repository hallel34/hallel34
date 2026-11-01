# QA report — round 20 (PR 15, HEAD a891dbf) — **GREEN** (P0 0 · P1 0 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round20/` (19 WebP, commit 94e9f88).

## Gate
vitest 648/648, build OK. Smokes: family 325, full 248, 2p 177, 640 325/248, daily 119, r11 105, r12 134, tutorial 99, business PASSED, all 0 FAIL. Contrast 0 fail, axe 0 (renovation included), no scroll, all targets ≥48px, 0 console errors. CI run 41275460973 green.

## Round-19 fixes
1. **L3 repeated feedback: fixed.** It passes in full, 640, 2p and family. Family mode shows no adult words (71 turns). Junior shows coins only.
2. **`.reno-or`: fixed.** axe clean in all modes and both themes.
3. **Home perf:** 0.92–0.94 over 11 local runs (FCP 1.7–1.8 s, LCP 3.0–3.2 s, CLS 0), up from 0.89–0.90 / FCP 2.2 s. One live-preview run scored 0.97.

## Lazy-loading regression checks (local and live pr-15)
All pass:
- first board open (styled from frame 1, all images)
- slow 3G (board 0.3 s after the tap)
- resume from a cold cache
- hard reload
- offline after one visit (the SW precaches the lazy chunks)
- daily, hot-seat and the business demo
- the base subpath

## P3 observations
- On slow 3G there's 0.3–0.7 s between the tap and the board, with no busy state.
- Still open: the auction backdrop HUD shows another player's scale, and the single-player renovation text mentions an auction.

## Test-change review
One new test (commentary-variants) adds coverage. No existing test was changed.
