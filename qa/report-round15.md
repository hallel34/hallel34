# QA report — round 15 (HEAD 0c904ec) — **RED** (P0 0 · P1 1 new · P2 0 · open P3 9)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round15/` (20 WebP, commit dce513c).

## Verdict
RED because of one new P1, a regression of the round-14 bubble change: the concept explainer ("מקסי מסביר") is too narrow, so its text is cut off and its buttons spill onto the status line. The round-14 P1 and all nine P2s are fixed. The full gate is green.

## Gate
| Check | Result |
|---|---|
| vitest | 576/576 |
| build | OK |
| smoke family / full | 268 / 238 ok, won in 21 / 33 rolls |
| hot-seat 2p | 175 ok |
| SMOKE_H=640 family / full | 268 / 238 ok |
| daily / r11 / r12 / tutorial | 119 / 97 / 134 / 99 ok |
| contrast (3 scripts) | 0 fail |
| axe | 0 violations (all 16 combos, every card type, legend fixed) |
| scroll | none in 16 combos |
| console errors | 0 (font-preload warnings only) |
| Lighthouse home | perf 0.94 / 0.93 / 0.94 · a11y 1.00 · BP 1.00 · SEO 1.00 · LCP 2.9–3.0 s · CLS 0 · PWA installable |

Board with the cash row:

| Viewport | Plate | Cell | CTA bottom | Scroll |
|---|---|---|---|---|
| 390x844 | 374×650 | 57 | 732 | none |
| 360x800 | 344×609 | 52 | 693 | none |
| 360x640 | 344×497 | 52 | 557 | none |
| 320x568 | 302×424 | 45 | 504 | none |

## Per criterion
| | Criterion | Result |
|---|---|---|
| a | 3-second test | Met for the board HUD (cash complete, the next action on the status line, compact goal numbers). The explainer P1 covers the status line at 320 when it opens. |
| b | Distinguishable without colour | Met; the legend uses the 3D tiles |
| c | No scroll / no console errors | Met |
| d | Tests and smokes green | Met, including the 640 variant |
| e | Fox present but not centre stage | Met |

## Round-14 retest
| # | Status |
|---|---|
| P1-1 HUD cash | Fixed (₪158,420, ₪1,234,560 and -₪4,500 complete at all 4 viewports) |
| P2-2 bubble under sheets | Fixed |
| P2-3 milestones on a fast roll | Fixed |
| P2-4 legend | Fixed (3D tiles; fits at 360; 320 scrolls with a cue; axe clean) |
| P2-5 status line | Fixed |
| P2-6 640 smoke | Fixed |
| P2-7 family statement | Fixed live. Test gap: the FULL_ONLY regex skips `statement.netWorthTitle` |
| P2-8 share fallback | Fixed |
| P2-9 compact goal | Fixed |
| P3-2 cheap-loan copy | Partly fixed: the "בעולם האמיתי / במשחק" box still says ₪10 / ₪120 |
| P3-3 "תפרעו" | Fixed in the loan dialog; remains in feedback.he.json (171, 184, 221, the loanTotalLabel note) |
| P3-4 / 6 / 7 / 8 / 9 / 13 | Fixed |

Still open: P3-1, 5, 10, 11, 12, 14, 15 (round 14), plus the remaining parts of P3-2 and P3-3.

## [P1] Concept explainer truncated and overlapping the status line (regression)
- **Viewports:** 360x800, 360x640, 320x568. At 390x844 there is overlap only.
- **Repro:** full mode, seed 11, engineer. Roll (payday), tap המשיכו, and the התחייבות explainer opens.
- **Actual:**
  - The box is 132 / 120px wide with a 52 / 40px text column, so the definition reads "התחייבו..." and "עוד" is faint.
  - "הבנתי" spills above the box and covers the status line at 320 (335–383 vs 338–376) and the "אתם על" line at 360.
  - At 390 the panel covers the status line and the fox.
  - "עוד" opens the dictionary, so the content is still reachable.
- **Expected:** readable, inside the fox row, never covering the status line, die or CTA (board-spec 7.4).
- **Missed by smoke:** `reactionStripClear` measures `.note-bubble` only, and only at turn 1 and on the multiplayer board.
- **Evidence:** NEW-P1-explainer-truncated-360x800.webp, NEW-P1-explainer-over-status-320x568.webp, explainer-over-status-390x844.webp, explainer-more-opens-dictionary-360x800.webp

## Coverage restores
1. Verified figures only in `.audit-reveal, #st-tax-pop, .dict-rw-entry`: restored, and stricter than before.
2. "No mouse mascot" on home: restored.
3. Bubble overlap: restored but too narrow. Recommendation: run it on every note open and measure the whole note, including its buttons.

## Test-change review
- The logo range 120–200 is a justified, slight loosening.
- The other rows are stricter or add coverage, apart from the minor FULL_ONLY gap.
