# QA report — MaxiFox v0.5 step 1, keyed RNG (HEAD f76c6d4) — **RED** (P0 0 · P1 1 · P2 4 · P3 2)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/rng/` (9 WebP, commit 99d0d3b). The QA scripts, generator and seeds are independent of the developer's. Compatibility was checked against the pre-v0.5 engine (a9f8483) side by side.

## Results
| # | Check | Result |
|---|---|---|
| 1 | Dice: 500 seeds × 3 decision pairs × 2 modes (~96k player-turns) | **100%** identical; every die equals the key `dice:{turn}:{k}` |
| 2 | Same deck tile + same turn | 87.7–94.7% overall; 96.7–99.4% same tier; **100%** when tier + fit + `requires` match; no mismatch without a documented cause |
| 3 | Replay fuzz, 400 games (family, full, junior) | **400/400**, also after encode → decode |
| 4 | Link tampering | 2,400 bit flips, 240 truncations and 120 appends all rejected; a wrong version is rejected even with a valid CRC; forced dice and debugForce refused |
| 5a | v1 on the new engine vs the old engine, 120 games step by step | **120/120** identical |
| 5b | v0.4 save resumed in the new engine | **40/40** identical, rngVersion 1 |
| 5c | v0.4 schema-8 fixture | Loads, 3 turns per seat identical to the old engine |
| 5d | Daily | Before 2026-11-17: **byte-identical**. From 11-17: v2 |
| 5e | Build and PWA offline | OK |
| 6 | Purity | No Math.random, Date or crypto in src/engine; cosmetic randomness isolated |
| 7 | Balance, 300 games | `--rng=v1` byte-identical; v2 equals the "after" column in BALANCE.md (family reckless 27/31/28%) |
| 8 | Gate | vitest 750/750, contrast 0, axe 0, no scroll in 16 combos, Lighthouse 0.91–0.93; all smokes pass except **2p** |
| 8b | Real browser, save → reload → resume | Identical; the browser log replays in Node to the same state hash |
| 8c | 2p start button | Pinned and tappable at 360x800, 360x640, 320x568 |

## P1
- **Two-player full smoke red, 3/3:** L3 "same line twice" on the decision line "גם לחכות זו החלטה…".
- **Cause:** `lastDecisionLine` lives inside `createPlay` (play.js:762) and resets when the board is re-created on resume. dec-001 option C has only one line, and the v2 dice reach that card twice.
- **Fix:** keep the last decision line per device, like the commentary picker.

## P2
1. **Full mode got faster for reckless bots:**
   - alwaysBuy median 35 → 29, mean 44.5 → 39.0;
   - overBorrow median 35 → 31;
   - the loss rates are unchanged.
   This is outside the owner-approved family recalibration, and the owner should confirm it.
2. **F5 is real, a forged link wins on turn 0:** a single `auctionWin` with a fake card at price 1 passes the CRC and replays to "won". `auctionWin` has no phase or auction check, so it must be refused in single-player links before 0.5.1.
3. **Two test changes narrow coverage:**
   - Row 20: economy, v04 and v4-stage4 now run only on rngVersion 1.
   - Row 26: the bound loosened (mean <30 over 40 → median 12–30 over 120).
4. **Tutorial smoke lost coverage:** 99 → 62 ok, 67 → 56 distinct checks. The v2 dice no longer reach the opportunity card with the help strip.

## P3
- The daily date is still a placeholder.
- At 320 the "11–13" chip wraps, and the game-length chips sit under the fade.

## Test-change rows
- Rows 21–25 and 27–33: forced; none weakens a test.
- Rows 20 and 26: see P2-3.
