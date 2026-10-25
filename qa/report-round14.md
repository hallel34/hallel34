# QA report — round 14 (HEAD 62bbf1d) — **RED** (P0 0 · P1 1 · P2 9 · P3 15)

Author: the independent qa-tester. The harness blocked the agent from writing this file, so the CEO saved its delivered report text without editing its findings. Evidence: `qa/screens/round14/` (40 WebP files, commit 6d03c97).

## Gate
| Check | Result |
|---|---|
| vitest | 576/576 (92fcf2a and 62bbf1d) |
| build | OK |
| smoke (family) | PASS 254 ok, won in 22 rolls |
| SMOKE_MODE=full smoke | PASS 224 ok, won in 33 rolls |
| SMOKE_PLAYERS=2 (hot-seat, full) | PASS 174 ok |
| smoke:daily / r11 / r12 / tutorial | PASS 119 / 99 / 134 / 99 ok |
| SMOKE_H=640 smoke, family + full | **FAIL, 1 check each (bug 6)** |
| contrast-check.py + the v3/v4 contrast scripts | 0 fail |
| axe-core | 0 violations, except the legend sheet (1 serious, scrollable-region-focusable) |
| Horizontal scroll | 0 (16 combos + 6 autoplay games) |
| Touch targets <48px | 0 |
| Console errors | 0 (4 font-preload warnings) |

## Lighthouse mobile (home)
| Build | Perf | A11y | BP | SEO | LCP |
|---|---|---|---|---|---|
| 92fcf2a | 0.90 / 0.92 / 0.93 | 1.00 | 1.00 | 1.00 | 3.0–3.4 s |
| 62bbf1d | 0.94 / 0.92 / 0.92 | 1.00 | 1.00 | 1.00 | 2.9–3.2 s |

CLS is 0 on every run. Lighthouse 13 has no PWA category. The installability check reports only `in-incognito`, which comes from the test browser; the manifest has no errors. An offline reload and a new game offline work.

## Per criterion
| | Criterion | Result |
|---|---|---|
| a | 3-second test | **Not met (P1).** The goal and the next action are clear. The state fails: the cash is clipped (1), the status line is lost on short screens (5), and the compact top bar has no numbers (9). |
| b | Distinguishable without colour | **Met.** Greyscale, deuteranopia and protanopia all pass. The legend icons don't match the tiles (4). |
| c | No horizontal scroll / no console errors | **Met** |
| d | Tests and smokes green | **Met** for the required set. The 640 variant is red (6). |
| e | The fox is present but not centre stage | **Met** |

## P1
1. **The cash in the top bar is cut off on narrow screens.** At 360x800 the ₪ sign is missing, and ₪158,420 reads ",58,420". At 320x568, ₪14,000 reads "4,000". A negative balance loses its minus sign. Cause: `.cash-wrap` has `flex:0 0 auto` and is wider than `.cash-col` (169 vs 134px), and `.hud-id{overflow:hidden}` clips it. Evidence: `hud-cash-*.webp`.

## P2
2. The fox bubble disappears when a sheet opens and doesn't come back. Spec 7.3 says the timer pauses and resumes.
3. The 25% / 50% milestone bubbles don't appear if the player rolls within about 1.5 s of the crossing purchase. No smoke covers this.
4. Legend at 360x800: the sheet scrolls by 64–83px, so the 7th row (tax audit) is hidden with no scroll cue, and axe reports a serious issue. The legend icons don't match the tiles for 4 of the 7 types.
5. At 360x640 / 320x568 the status line repeats the bubble text instead of the next action.
6. The SMOKE_H=640 smoke is red: it expects a 200px logo, and the logo renders at 166px.
7. The family statement still shows adult words (התחייבויות, שווי נקי, משכנתא, הכנסה פסיבית).
8. Win share has no manual-copy box when copying fails; only a toast.
9. The compact top bar at 360x640, turns 1–3, shows the goal caption without the "₪0 מתוך ₪X" numbers.

## P3
1. The bubble is narrow, so a 3-word greeting wraps onto 2 lines.
2. During the cheap-loan effect, the loan explainer still says ₪10 per ₪1,000 while the dialog shows ₪5.
3. "תפרעו" in the family loan dialog.
4. When both milestones cross in one purchase, the 25% line shows 57%.
5. The family dec-001 button label wraps onto 2 lines.
6. The hand-over says "זרקו קובייה" while the board says "הטילו קובייה".
7. The home tagline mixes "בשבילך" with "אתם"; in the light theme at 320 the tagline is hidden.
8. The die's single pip is red in family mode.
9. The family-dark goal caption is in gold.
10. The pawn is a fox head, so there are two foxes on the board.
11. The profession foxes are slightly soft (upscaled at DPR 2/3).
12. 4 font-preload warnings.
13. The "unavailable" reason wording differs between modes.
14. The Lighthouse perf margin is thin.
15. A family driver who always passes is bankrupt 42% of the time.

## Profession select (62bbf1d)
Matches the reference, and the "נשאר בכיס ₪X" spacing is fixed. No issues at the 4 sizes, and 0 axe violations. Small differences: the pill is 155 of 173px wide; 2.5 rows show instead of 3; the art is soft (P3-11).

## Passed checks
- **Board:** 6x8 ring with corners 0/5/12/17, tiles 57/52/45px, the neutral opportunity tile, amber family expense tiles.
- **Bubble timing:** 6.16 s full and 8.19 s family; tap to close and tap the fox to reopen work.
- **Die:** 1100ms; under reduced motion it only fades.
- **A/B/C badges:** correct.
- **Decision cards:** really disabled, with "לא זמין" and the reason.
- **Family safety net:** works.
- **Loan dialog:** 1% (0.5% during the cheap-loan effect).
- **Payday chip and equation:** correct.
- **Tax popover:** every figure matches the 2026 verified values, with the tag and a link.
- **Real-world figures:** all match `real-world-verified.json` and all links return 200. 3.25% appears only in its tagged lesson.
- **Tax-audit quiz:** never changes money.
- **v2.5 save:** loads and resaves as schema 5.
- **Other flows:** hot-seat, offline, win and game over, and reduced motion all work.
- **RTL:** correct.
- **Old brand and banned phrases:** no "פסיבו", "Passivo" or banned phrases, except the kept keys.
- **Daily challenge:** deterministic, based on smoke:daily and the unit tests.

## Balance (100 games per row; the 300-game rerun matches after-stage4.txt)
| Mode | Sensible median / mean | p90 | Lost | Reckless lost |
|---|---|---|---|---|
| Family | 22 / 22.6 | 32 | 0% | alwaysBuy 28%, overBorrow 34% |
| Full | 24 / 25.8 | 38 | 0% | alwaysBuy 13%, overBorrow 26% |

## Test-change review
Every change traces to an owner-approved requirement, and no assertion was loosened to hide a failure. Flags:
- **Minor weakening:** the hidden-figures guard exempts any percent equal to a verified value, wherever it appears (2.5% is no longer guarded).
- **Minor weakening:** the "no mouse mascot" check on home was dropped.
- **Minor weakening:** the fox-strip overlap check no longer covers bubble vs status line.
- **Acceptable:** the scenario changes (engineer → lawyer helper, longer smoke loop).
- **Regression:** the 200px logo check (bug 6).
- **Coverage gaps:** milestone bubble, legend at 360x800, 6-digit cash in the top bar.
