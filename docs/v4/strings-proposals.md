# Passivo v4: string proposals for audit items O2 and O4

Date: 2026-10-23. Owner: financial-education specialist (copy only). The CEO passes these to the developer.

Caveat: the audit report (`דוח-QA-פסיבו.md`) is not in the repo (docs/decisions.md, 23.10.2026). These proposals follow the CEO's description: O2 = the "הועתק ללוח" confirmation, O4 = the "לא זמין" label. Nothing under `src/i18n` was edited.

Copy rules: plural, gender-neutral address; button labels of 1 or 2 words; no emoji; full spelling (כתיב מלא).

## O2: "הועתק ללוח" (copy confirmation)

Current state in `src/i18n/he.json`:

| key | current | issue |
|---|---|---|
| `win.copied` | "הועתק ללוח" | ok |
| `win.copyFailed` | "לא הצלחנו לשתף. נסו שוב בעוד רגע" | says "share" even when copying failed |
| `daily.copied` | "הועתק" | different wording from `win.copied` for the same action |
| `daily.copyFailed` | "לא הצלחנו להעתיק. אפשר להעתיק מכאן" | ok |

Proposal:

| key | proposed text | where |
|---|---|---|
| `win.copied` | "הועתק ללוח" | visible chip after copying (unchanged) |
| `daily.copied` | "הועתק ללוח" | same wording on both screens |
| `common.copiedA11y` (new) | "הטקסט הועתק ללוח" | `aria-live="polite"` announcement (a full sentence for screen readers) |
| `win.copyFailed` | "לא הצלחנו להעתיק. אפשר לסמן את הטקסט ולהעתיק" | when the clipboard is refused |
| `win.shareFailed` (new, optional) | "לא הצלחנו לשתף. נסו שוב בעוד רגע" | keep the current text only for a failed `navigator.share` |
| `daily.copyFailed` | "לא הצלחנו להעתיק. אפשר להעתיק מכאן" | unchanged |

Test impact: `tests/e2e/daily-smoke.mjs` line 271 checks that `.daily-copied` text is exactly "הועתק". Changing `daily.copied` needs that assertion updated, under the test-change rule (docs/v4/test-changes.md). If the CEO does not want a test change, keep `daily.copied` = "הועתק" and change only the a11y line and `win.copyFailed`.

Display: show the chip for about 2 seconds next to the button that was tapped, and do not move the layout. With `prefers-reduced-motion`, show it without a fade.

## O4: "לא זמין" (unavailable label)

Current state: `card.unavailable` = "לא זמין" (one label, no reason).

Proposal: keep "לא זמין" as the short label on the disabled button or option, and always add a one-line reason under it, so a player (or a child) knows what to do next. The reason is a caption, not a toast.

| key (new, under `card.unavailableReason.*`) | full mode | family mode (kid words) |
|---|---|---|
| `notEnoughCash` | "חסר מזומן: צריך {amount}" | "אין מספיק כסף: צריך {amount}" |
| `loanCap` | "הגעתם לתקרת ההלוואות" | "הבנק לא נותן עוד הלוואות כרגע" |
| `noLoanToRepay` | "אין הלוואה להחזיר" | "אין הלוואה להחזיר" |
| `noMatchingAsset` | "אין לכם נכס שמתאים" | "אין לכם נכס שמתאים" |
| `fullModeOnly` | "זמין רק במצב מלא" | "זמין רק במצב מלא" |
| `notYourTurn` | "מחכים לתור שלכם" | "מחכים לתור שלכם" |
| `offline` | "צריך חיבור לאינטרנט" | "צריך חיבור לאינטרנט" |

- `notEnoughCash` uses the existing `{amount}` slot (formatted money, wrapped in `<bdi>` per the RTL skill).
- The family column was checked against the family forbidden-word list: none of them is used.
- Accessible name of the disabled control: "{label}, לא זמין: {reason}" (new key `card.unavailableA11y`). Use real `disabled` / `aria-disabled="true"`, as decided for v4. The reason line must also be announced (`aria-describedby`).
- Contrast: a disabled label still needs 4.5:1 for its text (it carries information). Do not rely on grey-on-grey.
- Where it appears in the v4 decision cards: every option with an "available if" condition in `docs/v4/decision-cards.md` uses `notEnoughCash` or `loanCap`.

## Not proposed

- No change to `statement.takeLoanLimit` ("תקרת הלוואות מלאה"). It is clear. It could reuse `loanCap` for consistency, if the CEO wants one wording.
