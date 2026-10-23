# Passivo v4: 25% and 50% milestones (fox lines + badges)

Date: 2026-10-23. Owner: financial-education specialist. Wiring: developer (the trigger already exists: `src/ui/play.js` celebrates once per crossing of 25/50/75% and logs `game.milestone`, "{pct}% מהדרך לחופש!").

Status: text proposal. No file under `src/` was changed for this document.

## Rules for these lines

- The milestone is passive income ÷ total monthly expenses. That is the same ratio the HUD meter shows.
- A line fires once per game per milestone, at the first crossing. If passive income falls back below the line, nothing negative is shown. No shaming, and no "you lost it" line.
- Every line names the number behind it (skill rule 3). The slots are already used elsewhere:
  - `{pct}`: 25 or 50, as in `game.milestone`.
  - `{passive}`: passive income per month, formatted money.
  - `{expenses}`: total monthly expenses, formatted money.
  - `{left}`: `expenses − passive`, formatted money. It is the amount still missing, and it is ALWAYS followed by the existing goal helper ("ועוד קצת", `goal.andABit`), because winning needs passive income ABOVE expenses (`leftTemplate`, round 12).
- No promise of getting rich and no promise of time. The lines say the goal is closer, never that it is certain.
- Family lines use the kid words only. They avoid ריבית, תזרים, מקדמה, תשואה, משכנתא, הכנסה פסיבית, התחייבות, כרית, שווי נקי and פיזור (tests/kid-vocabulary.test.js), and they do not use "מהי".
- Pick one line at random, never the same twice in a row (same rule as `feedback.he.json`).
- Fox pose: `celebrate` (as today). In family mode it smiles and does not smirk.

Suggested keys: either a new `feedback.he.json` group `milestone.25` / `milestone.50` with `family` and `full` lists (then the validator's `FEEDBACK_GROUPS` gets two new names, and `notes.slots` gets `pct`, `left`), or `he.json` `game.milestone25.*` / `game.milestone50.*`. Developer's call: the `feedback.he.json` group fits the existing "one line per event" mechanism.

## 25%: רבע מהדרך

### Family
1. "רבע מהדרך! הנכסים שלכם כבר מכניסים {passive} בחודש, רבע מההוצאות."
2. "{pct}% מהדרך לחופש! הכסף שעובד בשבילכם מכסה כבר רבע ממה שיוצא בחודש."
3. "התחלה מצוינת: {passive} בחודש נכנסים בלי שתעבדו בשבילם. חסרים עוד {left} ועוד קצת."

### Full
1. "{pct}% מהדרך: הכנסה פסיבית של {passive} מול הוצאות של {expenses}. חסרים עוד {left} ועוד קצת בחודש."
2. "רבע מההוצאות כבר מכוסה בהכנסה פסיבית. עכשיו השאלה היא איזה נכס הבא מקרב הכי הרבה."
3. "{passive} בחודש מנכסים. זה רבע מהדרך, ובדרך כלל הרבע הראשון הוא הקשה ביותר."

Note on full line 3: "the first quarter is usually the hardest" is a claim about the game only (the first asset costs the most relative to the starting cash). If finance's simulation does not support it, drop line 3.

## 50%: חצי הדרך

### Family
1. "חצי מהדרך! הנכסים שלכם מכניסים {passive} בחודש, חצי מכל ההוצאות."
2. "{pct}% מהדרך לחופש! עוד {left} ועוד קצת בחודש, והכסף שעובד בשבילכם יכסה הכול."
3. "וואו, חצי דרך! כל נכס טוב מקרב אתכם לקו. כדאי להשאיר גם קצת כסף בצד להפתעות."

### Full
1. "{pct}% מהדרך: {passive} בחודש מכסים חצי מההוצאות ({expenses}). חסרים עוד {left} ועוד קצת."
2. "חצי מההוצאות כבר מכוסה בהכנסה פסיבית. עכשיו כדאי לבדוק שלא כל הכסף נמצא בנכס אחד."
3. "חצי דרך. עסקה עם תקופת החזר קצרה מקרבת, ועסקה מפסידה מרחיקה. הכרית שלכם עדיין חשובה."

## Badges

| milestone | badge name | short description | earned line |
|---|---|---|---|
| 25% | **רבע הדרך** | "הנכסים שלכם מכסים רבע מההוצאות" | "קיבלתם תג: רבע הדרך" |
| 50% | **חצי הדרך** | "הנכסים שלכם מכסים חצי מההוצאות" | "קיבלתם תג: חצי הדרך" |

- The same names work in family and full mode (no adult word).
- Alternatives if the CEO wants more flavour: 25% "הנכס הראשון עובד", 50% "חצי חופש". I recommend the plain names above, because they say exactly what was reached, and "חצי חופש" could sound like half a holiday.
- Accessibility: badge `aria-label` = "{badgeName}: {description}".
- The badge is knowledge or progress only. It never adds cash or income.

## Checks done

- Each family line was scanned by hand against the forbidden list above, and all are clean ("נכסים" and "הכסף שעובד בשבילכם" are allowed words, see `tests/kid-vocabulary.test.js` line 72).
- No line uses a real-world figure. No line contains a percent token from the hidden-figure guard. "{pct}%" renders 25% or 50%. Note: the literal "50%" would be a visible token. The guard only expects 2.5%, 3.25%, 4.75% and 8.2% to stay hidden, so "50%" is safe for the unit test, but it weakens the guard on the unpublished down-payment figure in `rw-down-payment`. For that reason every line above uses the `{pct}` slot and none types "50%".
