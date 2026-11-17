# Copy review: redesign strings (2026-11-16)

Checked against: src/i18n/he.json, src/ui/screens/{home-more,start,pick}.js, src/ui/summary-card.js (it lives in src/ui/, not src/ui/screens/), src/ui/app.js, src/ui/challenge/flow.js, docs/redesign/after/*.png, tests/kid-vocabulary.test.js.

Verdict: all 8 strings are readable, plural second person, gender-neutral, and contain no FORBIDDEN word (tested by hand; see the note at the end). One truthfulness problem (P1) and a few small wording fixes.

## P1. gamesFinished / gamesFinishedNone: the counter is not "non-challenge"

`passivo.gamesPlayed` is incremented by `countGame()` in `app.js` goWin (388) and goOver (411), and also in `challenge/flow.js:128` (goChallengeEnd). Daily games are excluded (they return earlier). So:
- It counts wins AND game-overs. "שהסתיימו" is true for both, so the wording is fine.
- It DOES count finished challenge games, contrary to the brief. The wording "משחקים שהסתיימו" is still true (a challenge game is a finished game), so the copy needs no change. But do not document or promise "regular games only" anywhere (code comment in home-more.js line 19 says "finished normal games": fix the comment, or exclude challenge games from the counter if that was the intent; a developer decision).
- Uncertain (not verified): goWin has no `m.mission` exclusion (only `careerEnd` does), so a first-asset mission that ends in a real win or loss may count too. Developer to confirm.
- It is a per-device count, not per-profile. `profile.gamesFinished` (he.json line ~1400, same text, career counter `profile.games`) can show a different number. Two different numbers under the same words: acceptable, but the career one is on another screen.
- `gamesFinishedNone` ("עדיין לא סיימתם משחק") is true exactly when the counter is 0 and the row is info only (no button, no chevron): matches the screenshot more-sheet-new-390x844.png. Warm, no shame. Keep.

## String by string

| Key | Current | Where | Check | Proposal |
|---|---|---|---|---|
| menu.more | עוד | Home top button label (start.js:90) | Short, true. Same word is used for other buttons (`bubbleMore`), fine. | Keep. |
| menu.moreMenuTitle | עוד | Sheet title and layer label (home-more.js:37, 42) | Same word as the button, so a screen-reader user hears the title match the button they pressed. True. | Keep. (Optional richer title: "עוד ממקסי".) |
| menu.moreAria | עוד: המילון של מקסי וטבלת המשפחה | aria-label of the button when onBoard exists | Starts with the visible text "עוד" (WCAG label-in-name OK). The board row is titled `challenge.board.title` = "טבלת המשפחה של השבוע", so the aria text shortens it. Not false, but use the same name. | "עוד: המילון של מקסי וטבלת המשפחה של השבוע" |
| menu.moreAriaNoBoard | עוד: המילון של מקסי | same, without the board | True: only the dictionary row (plus the info row, appended by `moreAriaLabel` when the count > 0). | Keep. |
| menu.gamesFinished | משחקים שהסתיימו: {n} | Info row and appended to the aria label ("...של מקסי. משחקים שהסתיימו: 3") | True (see P1). Length at 320px: about 22 chars + icon, fits one line in a ~288px row. With n=1 it reads "משחקים שהסתיימו: 1" (plural noun with 1; acceptable in a label-colon form, same as the profile string). | Optional nicer form with a separate key: n=1 "סיימתם משחק אחד", n>1 "סיימתם {n} משחקים". It pairs better with "עדיין לא סיימתם משחק". Keep the current text if you want zero code change. |
| menu.gamesFinishedNone | עדיין לא סיימתם משחק | Info row at 0 | True; see P1. About 20 chars, fits. | Keep. |
| menu.missionsProgress | {done} מתוך {total} תורגלו | Home missions panel subtitle (start.js:148); `done` = the same list the missions screen marks "כבר תרגלתם" | True (real count). Plural verb after a number is acceptable, but "1 מתוך 8 תורגלו" and "0 מתוך 8 תורגלו" read slightly stiff. Visible dots (`m-steps`) are aria-hidden, so the text is the only accessible form: it is complete. | "תרגלתם {done} מתוך {total}" (matches `missions.practiced` "כבר תרגלתם"; plural second person; shorter at 320px). |
| pick.previewing | בתצוגה מקדימה | Visually hidden note after the profession name on the card whose preview sheet is open (pick.js:121) | True: it is set only while the sheet is open and removed when it closes. Deliberately avoids "נבחר" (the profession is not chosen until "יוצאים לדרך"). Screen reader hears "<name> בתצוגה מקדימה" plus the pressed state. | Keep. (Optional clearer: "נפתחה תצוגה מקדימה".) |

## Summary card (annual summary)

Verified in summary-pos-320x568.png: 8,800 - 7,310 = +1,490; 1,490 x 12 = 17,880; cash 9,000 -> 26,880 (9,000 + 17,880). All numbers add up.

- Labels `payday.c.before` = "לפני" and `payday.c.after` = "אחרי": OK. They sit under the sentence "הכסף מגיע למזומן עכשיו:", so it is clear they mean the cash balance before and after. Screen reader order matches (before, then after). Note the screen reader gets `arrivalSr` ("מ-X ל-Y") from the hidden description, so "לפני/אחרי" are not read twice in a confusing way. Keep. (Do not shorten further; do not reuse them for anything else: `payday.c.caption` "אחרי סיכום שנתי" shares the word "אחרי" with a different meaning, but that caption is not on this card.)
- Equation: "1,490 x 12 חודשים = +17,880" agrees with the existing texts: `resultMonthly` "נשארו {monthly} בחודש", `oneLine` "... → נשארו {monthly} בחודש x {months} = {amount}", `b.captionFamily` "כסף של {months} חודשים בבת אחת". Same order (monthly x months = total), same unit. Negative case "x 12 = מינוס ..., זה יורד מהמזומן" is consistent too.
- Honest simplification: the card shows the whole year being paid at once. The game says so ("בבת אחת"), which is the labelled simplification. Do not add a line implying real salaries arrive yearly.
- Stale comment, not copy: summary-card.js line 1-2 says "סיכום שנתיים" and "x 24"; the card (and `payday.label` "סיכום שנתי") use 12 months. Fix the comment to avoid confusing the next editor.

## Family vocabulary (tests/kid-vocabulary.test.js)

- FORBIDDEN list: none of the 8 strings contains any entry (ריבית, תזרים, כרית, תשואה, מקדמה, פסיבית, משכנתא, התחייבות, החזר השקעה, דיבידנד, שווי נקי, פיזור, "מהי ").
- Test coverage gap: the test scans groups `game, card, loan, win, ... pick, ...` and `mission(s)`, but NOT the `menu` group. So `pick.previewing` is covered; all `menu.*` strings above (and `menu.missionsProgress`, which is shown in family mode and uses the mission vocabulary) are not. Suggest adding `'menu'` to HE_GROUPS (existing menu strings may include full-mode-only words like "מניות"; FULL_ONLY regex only skips keys, so check the failures) or adding a targeted check for these 5 keys. MISSION_WORDS (ריבית|תזרים|מקדמה|קרן|להיפרע) are also absent from them.
- The proposed replacements ("תרגלתם {done} מתוך {total}", "סיימתם ...", the longer aria label) are clean against both lists.
