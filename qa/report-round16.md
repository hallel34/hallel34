# QA report — round 16 (HEAD f36111d) — **RED** (P0 0 · P1 1 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round16/` (17 WebP, commit 084454e).

## Verdict
RED: one new P1. The fox bubble cuts off hints and milestones at 360x800 and below. Every round-15 item is fixed, and the gate is green.

## Gate
| Check | Result |
|---|---|
| vitest | 580/580 |
| build | OK |
| smoke family / full | 271 / 241 ok, won in 21 / 33 rolls |
| hot-seat 2p | 176 ok |
| SMOKE_H=640 | 271 / 241 ok |
| daily / r11 / r12 / tutorial | 119 / 105 / 134 / 99 ok |
| contrast | 0 fail |
| axe | 0 in 16 combos, explainer included |
| scroll | none |
| console | 0 errors |
| Lighthouse home | perf 0.90 / 0.92 / 0.93 · a11y 1.00 · BP 1.00 · SEO 1.00 · CLS 0 |

## Re-tests
| Item | Status |
|---|---|
| r15 P1 explainer | Fixed in all 16 combos (full-width panel, never overlaps; 2-line clamp plus "עוד" on short screens) |
| P3-2 cheap-loan wording | Fixed (₪5 / ₪60). The "התוספת גבוהה במכוון" wording remains at 6% (P3-b) |
| P3-3 "תפרעו" | Fixed (0 occurrences in src/) |
| Kid-vocabulary gap | Fixed |

The widened note check covers hints and milestones only at 360x800/640, not at 390/320, and it checks overlap only, not truncation.

## [P1] The fox bubble truncates hints and milestones at 360x800 and below
- **Viewports:** 360x800, 360x640, 320x568. 390x844 is acceptable.
- **Milestone repro:** full mode, cash ₪500k, buy opp-apt-015, wait.
- **Hint repro:** family mode, tutorial help on, the first turns.
- **Actual:**
  - The bubble is about 132 / 120px wide, so each line holds 1–2 words.
  - The milestone text is cut at the top and the badge at the bottom.
  - The hint reads "חפשו / על / הלוח…" and can't be followed.
  - There is no "עוד". The full text appears nowhere else.
- **Expected:** 3 lines (2 compact) with "עוד" for the full text (board-spec 14.4 #7); never hide essential info (7.4).
- **Suggested fix:** use the explainer's full-width panel, or "עוד", for these notes, and add a truncation check (`.note-text` scrollHeight vs clientHeight).
- **Evidence:** NEW-P1-*.webp (5 files); comparison: milestone-bubble-390x844.webp

## P3
- **a.** "מקסי מסביר" truncates to "מקסי מ…" at 360 (family).
- **b.** "התוספת גבוהה במכוון" during the cheap-loan effect.
- **c.** `testNotesAtSizes` sees no hints or milestones, and there is no truncation check.
- Still open from round 14: 5, 10, 11, 12, 14, 15.

## Test-change review
No row weakens coverage.
