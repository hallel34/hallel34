# Live QA copy fixes (PR #20): F3, F4, F5, F6

Status: proposed copy, not wired in. The developer applies it. Hebrew, plural address, no cash-bonus claims.
Rule facts used (all read from the code on 2026-11-13):
- A short game is `roundCap = SHORT_ROUNDS = 12` (`src/engine/config.js:27`). When every surviving player has done 12 rounds, `endTurn` sets `match.status='won'` and `match.shortFinish=true` for the leader (`src/engine/match.js:160-166`). That is why the solo end screen calls `createWin`.
- A solo player in a short finish still has `state.status === 'playing'`. So passive income is below total monthly expenses by definition (otherwise they would have won earlier). This makes "עוד לא הגעתם לחופש" always true.
- `feedbackForEnd` gives such a player `end.neutral` (`src/learn/feedback.js:156-159`).

---

## F3. End screen of a short solo game

Real win keeps `win.title` = "חופש כלכלי!" and `win.text`. Only when `match.shortFinish` (and the player's own state is not `won`) use the keys below.

Layer rule: full = `he.json` as is. Family = one new entry in `tutorial.he.json` `familyStrings.overrides`. Junior (`coinScale()`) = separate key, same pattern as `standings.row` / `standings.rowJunior`.

### New / changed keys in `src/i18n/he.json` (section "win")

| key | string | variant |
|---|---|---|
| `win.shortTitle` (new) | נגמרו הסיבובים | all (full, family, junior) |
| `win.shortText` (replace; old text is false) | עוד לא הגעתם לחופש כלכלי: ההכנסה הפסיבית עדיין קטנה מההוצאות החודשיות | full |
| `win.shortTextJunior` (new) | הכסף שעובד עוד לא מכסה את ההוצאות. עוד משחק? | junior |
| `win.shortShareText` (new) | שיחקתי {rounds} סיבובים ב-MaxiFox. הכנסה פסיבית: {passive}, הוצאות: {expenses} | full |

Family override entry (add to `tutorial.he.json` `familyStrings.overrides`, same shape as the existing `win.text` entry):

```json
{ "key": "win.shortText",
  "was": "עוד לא הגעתם לחופש כלכלי: ההכנסה הפסיבית עדיין קטנה מההוצאות החודשיות",
  "family": "עוד לא הגעתם לחופש כלכלי: הכסף שעובד בשבילכם עוד לא מכסה את כל ההוצאות. אפשר לנסות שוב!" },
{ "key": "win.shortShareText",
  "was": "שיחקתי {rounds} סיבובים ב-MaxiFox. הכנסה פסיבית: {passive}, הוצאות: {expenses}",
  "family": "שיחקנו {rounds} סיבובים ב-MaxiFox. כסף שעובד: {passive}, הוצאות: {expenses}" }
```

Wiring in `src/ui/screens/end.js` `createWin` (lines 71-72), for the developer:
- `title`: `match.shortFinish && state.status !== 'won' ? t('win.shortTitle') : t('win.title')`.
- `tagline`: short finish -> `coinScale() ? t('win.shortTextJunior') : t('win.shortText')`; else `t('win.text')`.
- Share (line 52, `win.shareText`) says "הגעתי לחופש כלכלי" and also shows on a short finish. That is false there. Use `win.shortShareText` (slots `rounds` = `match.roundCap`, `passive`, `expenses`) when `shortFinish`.
- Design suggestion (not copy): the hammock pose plus confetti means "freedom". Consider the calm fox pose and no confetti on a short finish. Designer's call.

Multiplayer `win.shortWinner` ("אחרי {rounds} סיבובים — מי שהגיע הכי רחוק בדרך לחופש כלכלי מנצח") is true: `standings()` ranks by progress, then net worth. Keep it.

---

## F4. Feedback after a short game (`end.neutral` is wrong when nobody reached freedom)

Problem found beyond the brief: `end.neutral` is also served to a non-leading player in a MULTIPLAYER short finish, where nobody reached freedom, and there it is just as false. So do not only add solo lines. Add a new group `end.rounds`, used whenever `match.shortFinish` and the player's state is neither `won` nor `lost` (solo or multiplayer). Keep `end.neutral` untouched for real multiplayer wins ("someone else reached freedom" is true there).

Wiring: `src/learn/feedback.js` line 26 slots `'end.rounds': ['passive','expenses']`; `src/learn/validate.js` line 14 group list; `feedbackForEnd(state, match)` picks `end.rounds` when `match.shortFinish`. Add a line to the `notes.endGroups` text in `feedback.he.json`.

`{passive}` and `{expenses}` are the same monthly money texts the existing `win` and `lose` groups receive. Both are per month, so the lines say "בחודש".

```json
"end.rounds": {
  "family": [
    "הסיבובים נגמרו. הכסף שעובד בשבילכם הגיע ל-{passive} בחודש, וההוצאות הן {expenses}. בפעם הבאה אפשר לנסות לקנות עסקה טובה מוקדם יותר.",
    "נגמרו הסיבובים, ועוד לא הגעתם לחופש כלכלי: {passive} בחודש מכסף שעובד מול {expenses} הוצאות. בדקו בדוח איזו החלטה אפשר לשנות.",
    "המשחק נעצר כאן: כסף שעובד {passive}, הוצאות {expenses}. כדי להגיע לחופש צריך שהכסף שעובד יהיה גדול מההוצאות. נסו לחפש עסקאות שמכניסות יותר בכל חודש."
  ],
  "full": [
    "הסיבובים נגמרו לפני שהגעתם לחופש כלכלי: הכנסה פסיבית של {passive} בחודש מול הוצאות של {expenses}. בדוח אפשר לעבור על ההחלטות שלכם.",
    "במשחק קצר יש מעט סיבובים, ולכן {passive} הכנסה פסיבית מול {expenses} הוצאות הם עדיין שלב בדרך. בפעם הבאה נסו לקנות נכס מניב מוקדם יותר, אחרי שבדקתם את תקופת ההחזר שלו.",
    "נגמרו הסיבובים. כדי להגיע לחופש כלכלי צריך הכנסה פסיבית גבוהה מההוצאות החודשיות ({expenses}), ואצלכם היא {passive}. לפני משחק נוסף בחרו החלטה אחת לשנות."
  ]
}
```

Junior uses the `family` lines (same as the other groups).

### Audit: wording in `he.json` that assumes something false or multi-player

| key (file:line) | issue | fix |
|---|---|---|
| `win.title` (he.json:626) | Shown on short solo finish: false | F3 above |
| `win.shortText` (628) | "ההתקדמות שלכם בדרך לחופש היא הניצחון": no winner in solo, vague | F3 above |
| `win.shareText` (639) + family override (tutorial.he.json:1134) | "הגעתי/הגענו לחופש כלכלי" is shown on a short finish: false | `win.shortShareText` |
| `win.again` (636) | "שחק שוב" is masculine singular; the rest of the app uses plural | "שחקו שוב" (also a button, 2 words) |
| `win.shortWinner` (629) | multi only (`createMatchWin`); true | keep |
| `standings.*` (721-735) | used only by `standingsList` and match screens, so multi-only by design; `standings.winnerText` shows only when NOT `shortFinish`, true | keep |
| `standings.allOutText` "לכל השחקנים" (734) | multi only (`createMatchOver`); true | keep |
| `gameOver.*` (736-746) | solo and multi share `retry`/`menu` only; `gameOver.text` is solo only and true for `lost` ("נגמר המזומן ותקרת ההלוואות, והתזרים שלילי") | keep |
| `feedback end.neutral` | see F4: false for a short finish, solo and multi | `end.rounds` |
| report / `report.he.json` end text | not audited here; the report may reuse a win line for a short finish. Developer: check that the "what I learned" report does not say freedom was reached when `shortFinish` and `state.status !== 'won'` | check |

---

## F5. `yield` (תשואה) and `roi` (החזר השקעה): two distinct definitions

Idea, in the order a child meets them: `yield` is about the ASSET ("כמה נכס מכניס בשנה, באחוזים"). `roi` is about MY MONEY ("מה יצא לי מהכסף ששמתי מהכיס"). Everything else stays: examples, computed numbers, `unlockWith: "yield"`. All numbers rechecked: 3,400 x 12 = 40,800; 40,800 / 200,000 = 20.4%. 900 x 12 = 10,800; 10,800 / 40,000 = 27%; 10,800 / 320,000 = 3.375, so about 3.4%; 100 / 27 = 3.7 years.

### `src/data/learn/glossary.he.json`, concept `yield`
| field | new value |
|---|---|
| `short` | תשואה היא כמה נכס מכניס בשנה, באחוזים: על כל 100 שקלים ששילמתם עליו, כמה שקלים הוא מכניס בשנה. |
| `why` | כשמחשבים באחוזים אפשר להשוות בין נכסים במחירים שונים לגמרי. |
| `family.why` | באחוזים אפשר להשוות בין נכס קטן לנכס גדול, כמו שמשווים ציונים בין מבחנים שונים. |
| `example.text` | keep the existing text; add one clause: "כלומר 20.4 שקלים בשנה על כל 100 שקלים של התשלום הראשון." (20.4 per 100 = 20.4%, true) |
| `family.exampleText`, `gameSimplification`, `family.gameSimplification` | keep as is |

### concept `roi`
| field | new value |
|---|---|
| `short` | החזר השקעה (ROI) מראה מה יצא לכם מהכסף שלכם עצמכם: מחלקים את מה שהרווחתם במה ששמתם מהכיס. |
| `why` | כשבוחרים בין עסקאות שואלים "כמה חוזר לי מכל שקל שאני שם?". אותם ₪10,800 בשנה הם הרבה על ₪40,000 ומעט על ₪320,000. |
| `family.kidName` | כמה חוזר מהכסף ששמתי |
| `family.why` | לפני שקונים שואלים: כמה חוזר לי מהכסף ששמתי? ככה בוחרים עסקה שמשתלמת לכם. |
| `formula` / `family.formula` | keep |
| `gameSimplification` (full, replace first sentence only) | במשחק החזר השקעה ותשואה הם אותו חישוב, ולכן תראו אותו אחוז: ההבדל הוא בשאלה. תשואה מתארת את הנכס, והחזר השקעה מתאר מה יצא לכם מהכסף ששמתם בו. [then the existing sentence: "המשחק מחשב לפי המקדמה בלבד, ..."] |
| `family.gameSimplification` | במשחק שני השמות מחשבים אותו דבר: מה שנשאר בשנה ÷ התשלום הראשון, ולכן תראו אותו אחוז. תשואה מתארת את הנכס, וההחזר מתאר את הכסף ששמתם. [then the existing family sentence] |
| `example`, `link`, `family.link`, `family.exampleText`, `related`, `unlockWith` | keep |

`needs_review` (replace the roi one with this, for finance):
"finance: (1) In the game, yield and ROI are one number (`dealMetrics.yieldPct` = yearly cash flow x 12 / down payment, `src/engine/learn.js:29`). The split into 'about the asset' and 'about my money' is a teaching device. (2) In the real world ROI is usually total gain (price change plus income, minus costs) over the whole holding period, divided by what was invested, not a one-year figure. 'תשואה' in Hebrew finance often means total return of an investment, and sometimes only the income part (e.g. 'תשואת שכירות'). Please confirm the wording 'תשואה = הכנסה שנתית באחוזים' is acceptable for the child-facing text and that the game note is enough. (3) Stock cards compute the badge yield on the FULL price (dividend x 12 / price, `src/ui/deal-badge.js:25`), not on a down payment; if any glossary or card text shows a stock 'תשואה', it must say 'לפי מחיר המניה'."

---

## F6. Deal card `card.debtAfter` (`src/ui/modals.js:386-389`)

What the number really is: `balanceSheet(state).liabilitiesTotal` (today's debts: starting debts, loans of assets already owned, bank loans) + `c.mortgage` (the deal's own loan: mortgage for an apartment, business loan for a business) + `plan.need` (a bank loan to cover the down payment when cash is short).

Problems: the label does not say it includes the deal's own loan, nor that a bank loan may be added.

Proposal: replace the single line with a small "ledger" block of 3 or 4 rows, built like `priceEquation` (label at the inline-start, amount at the inline-end, labels wrap, nothing wider than 320px).

| row | key | full | family override (via `[[term:...]]` pattern) | show when |
|---|---|---|---|---|
| 1 | `card.debtNow` (new) | חובות היום | חובות היום | always |
| 2 | reuse `card.mortgage` (apartment) or `card.businessLoan` (business) with a "+" prefix; amount `{c.mortgage}` | משכנתא | הלוואה לדירה | `c.mortgage > 0` |
| 3 | `card.debtBank` (new) | הלוואה מהבנק למקדמה | הלוואה מהבנק לתשלום הראשון | `plan.status === 'loan'` |
| 4 (total, bold) | `card.debtAfter` (replace string) | סך החובות אחרי הקנייה | סך החובות אחרי הקנייה | always |

Row 4 string: `"card.debtAfter": "סך החובות אחרי הקנייה"` (no placeholder; the amount sits in the end cell). If the developer prefers to keep the placeholder, use `"סך החובות אחרי הקנייה: {debt}"`.

Add to the family override list:
```json
{ "key": "card.debtBank", "was": "הלוואה מהבנק ל[[term:down_payment|מקדמה]]", "family": "הלוואה מהבנק ל[[term:down_payment|תשלום הראשון]]" }
```
(Hebrew grammar: "לתשלום הראשון". Write it as a full string, "הלוואה מהבנק לתשלום הראשון", with the `[[term:down_payment|...]]` token around "תשלום הראשון" only if the markup supports a "ל" prefix inside it. Otherwise use plain text: the family override can just be a plain string.)

One-line fallback if the block is too tall: `"סך החובות אחרי הקנייה: {debt} ({now} היום + {deal} הלוואה לדירה{bank})"`, with `{bank}` = `" + {amount} מהבנק"` only when a bank loan is needed. At 320px this wraps to 2 lines; the ledger is clearer for age 9+.

Tell the developer:
1. Show row 2 always for apartments and businesses (it is part of the debt); show row 3 only when `plan.status === 'loan'`. Do NOT show the block for stocks, for `blocked`, or for a junior game (already hidden by `coinScale()`).
2. Possible real bug: the code adds `plan.need`, but the loan actually taken is `plan.loanAmount`, rounded UP to a multiple of the loan step (`selectors.js:126`, `LOAN_STEP = 1000`). The shown total can be up to 999 shekels too low. Use `plan.loanAmount` unless the buy flow takes exactly `need`. Please trace this together with the composition.
3. Row 1 must equal the "total debts" the player sees in the statement (the same `liabilitiesTotal`), so the sum visibly matches. Verify that `liabilitiesTotal` also includes the starting debts; I assumed it does (`liabilityReport(...).totals.principal`).
4. Add `data-debt-after` to the total row as today (tests read it).

---

## Verification table

| claim in the copy | rule it relies on | file |
|---|---|---|
| "עוד לא הגעתם לחופש" on a solo short finish is always true | A solo player with `status==='playing'` at the cap has passive < expenses; a win needs passive > expenses | `src/engine/match.js:160-166`, win condition in `CLAUDE.md` |
| "במשחק קצר יש מעט סיבובים" | short game = 12 rounds | `src/engine/config.js:27` |
| passive and expenses are per month ("בחודש") | statement shows monthly figures | `src/engine/selectors.js` (`passiveIncome`, `totalExpenses`) |
| "מי שהגיע הכי רחוק מנצח" (multi) | ranking by progress, then net worth | `src/engine/match.js:172-188` |
| yield = 20.4% = 20.4 per 100 | 3,400 x 12 / 200,000 | `src/data/learn/glossary.he.json` (`yield.example.computed`) |
| roi = 27% and 3.4% | 900 x 12 / 40,000 and / 320,000 | glossary (`roi.example.computed`), `src/engine/learn.js:29` |
| yield and ROI are the same number in the game | both = `dealMetrics.yieldPct` | `src/engine/learn.js:29-30` |
| debt total = today's debts + deal loan + bank loan | `balanceSheet.liabilitiesTotal + c.mortgage + plan.need` | `src/ui/modals.js:386` |
| bank loan comes in multiples of 1,000 (so the number may be off by up to 999) | `loanAmount = ceil(need/step)*step` | `src/engine/selectors.js:121-126`, `config.js:50` |
| real-world wording of ROI vs yield | not verified | flagged `needs_review` for finance |
