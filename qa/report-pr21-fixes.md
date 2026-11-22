# QA report - PR21 review fixes (branch maxifox-pr21-fixes, head 940b983, base 06e7e15)

Status: **RED** (zero P0, one P1, three P2). GREEN needs zero P0 and zero P1.

Tested head 940b983 in a fresh worktree (/home/user/maxifox-pr21-fixes-qa), baseline 06e7e15 in /home/user/maxifox-pr21-base-qa. Probes: `qa/pr21-qa.mjs` (92 browser checks, 91 pass, the 1 failure is the P1 below), `qa/pr21-dbl.mjs`, `qa/pr21-tip.mjs`, `qa/pr21-loanfuzz.mjs`. Screenshots: `qa/screens/pr21/`.

## Bugs

### [P1] Accidental second tap on "go" erases the saved game without reading the dialog
- Screen: profession pick -> overwrite dialog (bottom sheet), 390x844 touch.
- Steps: seed a game in progress in `passivo.save` (full mode, engineer). Home -> family -> Start -> players -> pick teacher. Tap "go" (the gold CTA at the bottom) twice, 60 to 800 ms apart (`qa/pr21-dbl.mjs`).
- Expected: the dialog's destructive button cannot be hit by the tap that belongs to the previous screen; the saved game survives a double tap.
- Actual: the dialog sheet slides in under the same screen position. At y=804 the second tap lands on `overwrite-confirm` ("למחוק ולהתחיל חדש"). With delays 60, 150, 400 and 800 ms the dialog closes, a new game starts, and `passivo.save` is replaced (the earlier game is gone). Only a simultaneous double tap (0 ms) hits the scrim and is safe. The developer's double-tap guard (`decided`) only covers two taps on the dialog's own buttons; their smoke (h) taps confirm twice, which does not exercise this path.
- Why P1: it is exactly the data loss Task 1 exists to prevent, triggered by one extra tap on a CTA. By the mobile-qa scale ("P0 = data loss") it could be argued as P0; I rate P1 because it needs a second tap, and the dialog works for deliberate use.
- Suggested direction (not applied): ignore taps for about 600-800 ms after the sheet opens, and/or place the erase button away from the pick CTA position.
- Screenshots: `qa/screens/pr21/dialog-390x844-dark.png` (dialog; confirm button sits where "go" was).

### [P2] Back button does not close the dialog (it leaves the page); code comment says "Back = keep"
- `overwrite-sheet.js` comment: "The scrim / Escape / Back button = keep". Only the board registers a popstate handler (`play.js`, `report.js`, `history.js`). On the pick screen Back navigates away (in the test: to about:blank); on an installed Android PWA it leaves or backgrounds the app. The saved game and the story flag are untouched, so nothing is lost, but the dialog is not dismissed by Back and the comment is inaccurate. Same as the other home sheets (pre-existing).

### [P2] A saved game from a newer schema (or a corrupt one) is silently overwritten
- Steps: `passivo.save` = `{"schemaVersion":999,"status":"playing","players":[]}`, start a new game. Expected: no data loss for a newer-version save (an older client should not delete it), or at least a warning. Actual: no dialog, replaced. Garbage, v1 and `{}` saves behave the same (they are unusable, so acceptable); only the future-version case is a concern. Low likelihood (needs an app downgrade).

### [P2] Observation (UX, not a formula defect): the expense-loan limit is not tied to the expense
- An expense or shortfall loan is deliberately uncapped by the 12-salary rule, so the dialog can offer up to cash-flow limit (up to 929,000 in my fuzz) for a 5,000 expense. This is the most likely explanation of the 519,000 sighting. Product decision whether the offer should be bounded by the expense amount; not changed by this PR.

## Gate results
- vitest: 55 files, 1043 tests pass. `npm run build` OK.
- Smokes, all exit 0 (CHROMIUM_PATH set to the installed Chromium; AXE_PATH set for axe checks; dedicated ports): smoke, tutorial, daily, r11, r12, business, payday, mission, missions, players, challenge, career, live, save. smoke:save passes (a)-(j).
- Contrast: `python3 scripts/contrast-check.py` exits 0 (all AA). Dialog axe wcag2a/2aa: 0 violations in every viewport/theme below.
- Lighthouse mobile home, 360x800, default throttling, x3 on 940b983: Performance 0.91 / 0.91 / 0.91, Accessibility 1.00, Best practices 1.00, SEO 1.00. Baseline 06e7e15 x3: 0.71 (one noisy run, TBT 1,020 ms), 0.91, 0.91. Note: a run with `--preset=perf` gave 0.87-0.88 on the new build, so the margin over 0.90 is thin and run-to-run noisy, but it is no regression vs baseline. PWA: manifest.webmanifest and sw.js present in dist (Lighthouse 13 has no PWA category; installability not separately audited).
- Scope: `git diff 06e7e15 940b983` touches no file in `src/engine` or `src/data` and no formulas, mechanics or balance. Product changes are only: save-guard.js, overwrite-sheet.js, `startNew`/`again`/`confirmReplaceSave` in app.js, `export` of `resumeInfo` in start.js, one CSS rule in hud-b.css, and five he.json keys (the four menu.overwrite* plus menu.overwriteMode, which the coordinator told me was added). Everything else is tests, docs screenshots and the `smoke:save` script. smoke.mjs gained a tip-bubble check only.

## Task 1 - save overwrite dialog
Pass: dialog only for a `playing` normal save when a new normal game would replace it; none for plain resume, no save, finished (won/lost) save, daily save present (passivo.dailySave untouched), daily start and daily end (debug-win) with a normal save present (passivo.save byte-identical, resume still offered afterwards). Slots are independent in code (`slotOf`: save / dailySave / challengeSave / missionSave[.junior] / practice slots) and in the browser. Challenge play-again and daily have no path to `again()`; challenge "new challenge" goes to the players screen and so to the guarded `startNew`.
- Cancel (keep button, scrim, Escape): `passivo.save` byte-identical, returns to the last human seat's profession pick; story flag (`storyDone`) stays false. Checked with 1p save/new 1p, 2p hot-seat save, 2p+bot save, new 2p, new 2p with a bot seat. Confirm replaces the save in all of them.
- Play again after win, loss and 2-player win: the end screen has already cleared the slot, so no dialog and the board opens. A game in progress written elsewhere meanwhile asks (smoke j).
- Layout at 360x800, 390x844, 430x932, 1280x800, dark and light, plus reduced motion at 360 dark and 1280 both themes: no horizontal scroll, both buttons 48px high, sheet inside viewport, text not clipped, dir rtl, focus on "keep" (primary, gold), axe 0 violations, 0 console errors. At 1280 the sheet is a centered 480px bottom sheet.
- Hebrew reads correctly: "למחוק את המשחק השמור? יש לכם משחק באמצע (מצב מלא · מהנדס/ת). אם תתחילו משחק חדש, הוא יימחק ואי אפשר יהיה להחזיר אותו." Buttons "להשאיר את המשחק השמור" (primary) and "למחוק ולהתחיל חדש" (secondary). The details are bidi-isolated and in correct order. Multi-player details read "מצב משפחה · 2 שחקנים".
- Malformed/v1/garbage/empty/null saves: no crash, no console error, new game starts (see P2 for the future schema).
- Double tap directly on keep or confirm acts once, no errors. Double tap on the pick "go" with a gap is the P1.
- Remaining silent-overwrite path found: only the P1 (an accidental tap) and the P2 future-schema case. No other entry point (home Start, players, pick, tutorial, play again, junior, challenge link) overwrites `passivo.save` without the dialog.

## Task 2 - fox tip bubble
- Cause confirmed: `.note-bubble` is `overflow:auto` and its tail `::after` is scrollable overflow, so scrollWidth - clientWidth = 10 (9 at some widths) in 06e7e15. After the fix overflow-x is `hidden`, overflow-y stays `auto`.
- Checked 360/390/430/1280, dark and light, with short, mid, long (593 chars) and longest (700 chars) strings and a 120-char unbreakable word. Overflow-x is hidden everywhere, no document horizontal scroll, bubble rects, radius, background and tail colour identical to baseline. Vertical scrolling stays available when text overflows vertically (the unbreakable-word case, scrollHeight > clientHeight with overflow-y auto).
- Pixel comparison base vs new screenshots (`qa/screens/pr21/tip/`): identical in all but 3 cases, whose differences (19 px at 360 dark, 3 px at 1280 light) lie in the fox sprite area, not the bubble (fox idle animation frame).

## Task 3 - daily length (investigation only)
No daily-length change in the diff. Claims confirmed: `DAILY_TURN_CAP = 40` at src/engine/daily.js:12, enforced at engine.js:417 (`turnCap: daily.turnCap ?? DAILY_TURN_CAP`) and engine.js:481 (`d.phase === 'roll' && d.turn >= d.daily.turnCap`); docs/decisions.md:29 records 40 chosen over 25 (bot median 20, p90 32); short mode `SHORT_ROUNDS = 12` at src/engine/config.js:27, enforced in match.js:160 as `p.state.turn >= roundCap` per player. Both count the same per-player turn counter, so a "round" of the short mode and a "turn" of the daily are the same unit: 12 vs 40 is a genuine difference in two different modes (short game vs daily challenge), not a unit mismatch. Which one the staged plan meant for the daily remains the owner's open question.

## Task 4 - loan cap
No calculation change (`src/engine` untouched). `tests/loan-cap-bounds.test.js` recomputes the formula from the inputs (byFlow, 12-salary cap for buying, uncapped for expense/shortfall); it shares the engine constants and `monthlyCashFlow`/`bankLoanPrincipal`/`loanRateNow` helpers, so it checks the composition of the formula, not those helpers (those are covered by regression-guard identities). My independent fuzz (`qa/pr21-loanfuzz.mjs`): 66,039 states from bot games, all professions, both modes, three bot policies (including cheap-loan rate 0.005 states, pending expense/shortfall/opportunity/offer/decision states) with my own formula: 0 states where the offered max exceeds the documented limit and 0 non-multiples of the step. Expense/shortfall loan limits reached 929,000 and 48 states were at or over 400,000, so 519,000 is reachable as documented. Junior and daily states were not separately fuzzed (daily uses the family engine; junior covered by the PR's test). No concrete defect.

## Task 5 - regression guard
`tests/regression-guard.test.js` plays bot games to a real ending in family, full, hot-seat and daily modes with money identities each step; sound and passing. Earlier fixes still hold: smoke.mjs (dock/reroll row, fitText checks) passes.

## Still not covered
Real-phone persistence, installability audit beyond manifest/sw presence, junior and daily loan-cap fuzz, hot-seat with 3-4 players in the dialog.
