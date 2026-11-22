# QA report - PR21 review fixes (branch maxifox-pr21-fixes, head 940b983, base 06e7e15)

Status: RED (1 x P1). Report is PARTIAL: see "Still running / not yet done" at the end.

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

### [P2] Observation: expense loans are uncapped by design, so 519,000 is a legitimate value
- Not a defect in the formula. See Task 4.

## Verified OK
(see sections below)
