# Promotion card copy review (0.5.0, no cash perk)

Reviewer: financial-education specialist. Date: 2026-11-11. Branch: maxifox-v050-career.
Nothing under `src/` was edited. The strings below are proposals for the developer to merge.

## 1. Engine facts the copy must match

Read from `src/engine/engine.js` (`promotionTerms`, `answerPromotion`), `config.js`, `selectors.js`.

- Keep: `salary += raise`. No expense is added. Monthly cash flow rises by `raise`. The freedom target (`hasWon`: passive income > `totalExpenses`) does not move.
- Upgrade: `salary += raise` and one permanent expense `lifestyle` of `upgradeCost` is added to `profession.expenses`. Cash flow rises by `raise - upgradeCost` (`kept`). The freedom target rises by exactly `upgradeCost`. No cash is paid, in any branch.
- `upgradeCost` is about 80% of `raise`, rounded to ₪100, and always leaves at least ₪100 (`min(raise - 100, ...)`). So "kept" is always a positive number, but copy must NOT say "80%" (rounding makes it inexact).
- Worked example, teacher (salary ₪8,800): raise = round(1,056 to 100) = ₪1,100; upgradeCost = round(880 to 100) = ₪900; kept = ₪200. Junior shows coins (1 coin = ₪100): 11, 9, 2.
- `perSummary = raise x 12` (PAYDAY_MONTHS) is correct for "per yearly summary".
- The promotion happens once per game. The fox accessory is recorded only as `promotion.status === 'upgraded'` (`hasFoxAccessory`).

## 2. Findings

| # | Severity | Finding |
|---|---|---|
| 1 | P1 | "השועל מקבל אביזר חדש / קיבל אביזר חדש" is currently not true on screen. `hasFoxAccessory` exists in `selectors.js` but nothing in `src/ui` calls it (grep for `hasFoxAccessory`, `accessory`, `אביזר`: no UI hit). Either render the accessory before release, or drop that sentence in all five places (base and junior consequence and feedback, family feedback and consequence). |
| 2 | P2 | `src/i18n/he.json` base `promotion.feedbackUpgrade` has no accessory sentence, but the family override, `feedbackUpgradeJunior` and both consequences do. Inconsistent. Fixed in section 3. |
| 3 | P2 | Nothing on the upgrade option says "no cash". Players who saw the old perk may expect it. Added one plain clause. |
| 4 | P2 | "נשארים לכם רק {kept}": "רק" reads as mild blame. Replaced by a neutral number. |
| 5 | P2 | `upgradeConsequenceJunior`: "ונשארים {kept}" does not say what remains. Now "מהתוספת נשארים {kept}". |
| 6 | P3 | Junior guess answer "החופש מתרחק" is true but sounds like a punishment. Softened to "קצת יותר רחוק". |
| 7 | P2 | `promotion.teaches` plus `simplificationPace` on the card is about 330 characters. Too long for 320px and for a 10-second read. Proposed one short lesson line (section 5); keep `teaches` for the post-choice feedback or a "more" area. |
| 8 | P2 | Stale spec: `docs/v050/career.he.json` still has `{perk}`, `feedbackUpgradePerk`, `simplificationPerk`, `perkMonths`, `plural.months` and the old family overrides, plus the CEO note on the perk (`_meta` lines 32 and 50). `src/i18n/he.json` is already clean. Update the doc so a later merge does not bring the perk back. I did not edit it (out of scope of this task). |
| 9 | Note | Achievement `promo-keep` pays only for "keep" (already noted in `achievements.he.json` line 38). With no cash perk, "upgrade" now has no reward at all except a cosmetic. Risk of reading as "upgrade = wrong". The achievement text and the feedback must stay neutral. Recommend the achievement title describes the action ("השארתי את רמת החיים") and not a virtue. CEO call. |
| 10 | OK | `keepConsequence`, `feedbackKeep`, `legend*`, `statement.*`, `log.*`, `simplificationTax` are true against the engine. In the engine the tax line is a fixed expense and does not change with salary, so "במשחק כל התוספת מגיעה אליכם" is accurate. The unused `simplificationTax` may be shown in the glossary only. |
| 11 | OK | No get-rich promise, no shaming found. "לשדרג זו לא טעות" is good and should stay. |

## 3. Proposed final strings

Group `promotion` in `src/i18n/he.json`. Only changed keys are listed. All other keys stay as they are.

### Base (full mode)

```json
{
  "promotion.upgradeConsequence": "הוצאה חדשה של {upgradeCost} בכל חודש. מהתוספת נשארים {kept} בחודש. השדרוג לא נותן כסף, רק אביזר חדש לשועל.",
  "promotion.feedbackUpgrade": "שדרגתם את רמת החיים, וזו בחירה לגיטימית. המספרים: {upgradeCost} יוצאים בכל חודש, לתזרים נוספו {kept}, וההכנסה הפסיבית שצריך כדי להגיע לחופש כלכלי עלתה ב-{upgradeCost}. השועל קיבל אביזר חדש.",
  "promotion.lesson": "הוצאה חדשה מעלה את הסכום שהנכסים צריכים להכניס."
}
```

### Family overrides (tutorial.he.json `familyOverrides`: key, was, family)

```json
[
  {
    "key": "promotion.upgradeConsequence",
    "family": "הוצאה חדשה של {upgradeCost} בכל חודש. מהתוספת נשארים {kept} בחודש. השדרוג לא נותן כסף, רק אביזר חדש לשועל."
  },
  {
    "key": "promotion.feedbackUpgrade",
    "family": "שדרגתם, וזו בחירה לגיטימית. המספרים: {upgradeCost} יוצאים בכל חודש, ומהתוספת נשארים {kept}. כדי להגיע לחופש כלכלי הנכסים צריכים עכשיו להכניס עוד {upgradeCost} בחודש. השועל קיבל אביזר חדש."
  },
  {
    "key": "promotion.lesson",
    "family": "הוצאה חדשה בכל חודש: הנכסים צריכים להכניס יותר."
  }
]
```

Unchanged and verified: family `keepConsequence`, `feedbackKeep`, `teaches`, `guess.question`. For `upgradeConsequence` the family text now equals the base text, so the override can be dropped if the base has no adult word (it has none).

### Junior (coins)

```json
{
  "promotion.upgradeConsequenceJunior": "בכל חודש יוצאים עוד {upgradeCost}. מהתוספת נשארים {kept}. השדרוג לא נותן כסף, רק אביזר חדש לשועל.",
  "promotion.feedbackUpgradeJunior": "מעכשיו יוצאים עוד {upgradeCost} בכל חודש, ונשארים {kept} מהתוספת. הנכסים צריכים להכניס יותר כדי להגיע לחופש. השועל קיבל אביזר חדש.",
  "promotion.guess.otherJunior": "החופש קצת יותר רחוק: הנכסים צריכים לכסות את כל החשבונות, ועכשיו יהיו יותר חשבונות.",
  "promotion.lessonJunior": "יותר חשבונות בכל חודש: הנכסים צריכים לכסות יותר."
}
```

Unchanged and verified: `keepConsequenceJunior`, `feedbackKeepJunior`, `teachesJunior`, `legend*Junior`, `statement.upgradeJunior`.
Vocabulary check by hand against `FORBIDDEN` in `tests/kid-vocabulary.test.js`: none of the new family or junior strings contain ריבית, תזרים, כרית, תשואה, מקדמה, פסיבית, משכנתא, התחייבות, החזר השקעה, דיבידנד, שווי נקי, פיזור, "מהי ". I could not run the test (no shell). The developer should run it.

Example with the teacher, as the player sees it: upgrade consequence = "הוצאה חדשה של ₪900 בכל חודש. מהתוספת נשארים ₪200 בחודש." Junior: "בכל חודש יוצאים עוד 9. מהתוספת נשארים 2." (money() renders the coin unit).

## 4. Glossary entry `lifestyle_creep`

Replaces the `glossaryProposal` in `docs/v050/career.he.json`. Same shape as the entries in `src/data/learn/glossary.he.json` (`id, order, term, level, short, why, example, gameSimplification, needs_review`, plus the `family` and `junior` blocks as in `cashflow`). Add after `diversification` (order 14).

```json
{
  "id": "lifestyle_creep",
  "order": 15,
  "term": "זחילת רמת החיים",
  "alias": "נקראת גם אינפלציית סגנון חיים",
  "level": "family",
  "short": "זחילת רמת החיים היא כשההכנסה עולה וההוצאות עולות יחד איתה, בלי שהחלטתם על זה.",
  "why": "מי ששם לב לזה יכול להחליט כמה מכל העלאה הולך להנאה עכשיו, וכמה נשאר לחיסכון ולנכסים.",
  "example": {
    "professionId": "teacher",
    "text": "למורה המשכורת עולה ב-₪1,100 בחודש. מי שממשיך לחיות כמו קודם נשאר עם כל ה-₪1,100. מי שמשדרג מוסיף הוצאה של ₪900 בחודש, ונשארים לו ₪200. כדי להגיע לחופש כלכלי הנכסים צריכים להכניס ₪900 יותר.",
    "computed": { "salary": 8800, "raise": 1100, "upgradeCost": 900, "kept": 200, "freedomTargetRise": 900 }
  },
  "gameSimplification": "במשחק מחליטים על זה פעם אחת, בקלף אחד, והשדרוג נותן רק אביזר לשועל. בחיים זה קורה בדרך כלל לאט, בהרבה החלטות קטנות, ושדרוג נותן הנאה אמיתית, ולכן הוא לא טעות. במשחק גם כל התוספת מגיעה אליכם, ובעולם האמיתי חלק מכל העלאה במשכורת הולך למסים ולביטוח לאומי.",
  "family": {
    "kidName": "כשההוצאות עולות יחד עם המשכורת",
    "kidShort": "כשמרוויחים יותר, קל להתחיל גם להוציא יותר, לאט ובלי לשים לב.",
    "why": "מי ששם לב לזה יכול להחליט כמה מהכסף החדש הולך להנאה עכשיו, וכמה נשאר בצד ולנכסים.",
    "exampleText": "למורה המשכורת עולה ב-₪1,100 בחודש. מי שממשיך כמו קודם נשאר עם כל ה-₪1,100. מי שמשדרג מוסיף הוצאה של ₪900 בחודש, ונשארים לו ₪200. עכשיו הנכסים צריכים להכניס ₪900 יותר כדי להגיע לחופש.",
    "gameSimplification": "במשחק מחליטים על זה פעם אחת, בקלף אחד. בחיים זה קורה בדרך כלל לאט, בהרבה החלטות קטנות."
  },
  "junior": {
    "exampleText": "למורה מגיעות עוד 11 מטבעות בחודש. מי שממשיך כמו קודם שומר את כולן. מי שמשדרג משלם 9 מטבעות בכל חודש, ונשארות לו 2."
  },
  "needs_review": "finance: (1) המונח אינו רשמי. 'זחילת רמת החיים' ו'אינפלציית סגנון חיים' הם תרגומים של lifestyle creep ו-lifestyle inflation, ולא נמצא מקור עברי מוסמך (חיפוש ב-10.11.2026, לפי career.he.json). (2) המספרים מחושבים מ-promotionTerms(8800) בהנחה ש-roundTo מעגל לקרוב (Math.round, אומת בקוד): 1,056 ל-1,100 ו-880 ל-900. QA script: להשוות ל-promotionTerms(professions.teacher.salary). (3) 'בעולם האמיתי חלק מההעלאה הולך למסים וביטוח לאומי' נכון כעיקרון, ללא מספר. finance לאמת לפני שמוסיפים מספר. (4) משפט האביזר תלוי בכך שה-UI מציג אותו (ממצא 1)."
}
```

Check on the junior sentence: "מי שמשדרג משלם 9 מטבעות ... נשארות 2" matches 900/200 at 100 per coin. In the junior block the word "נכסים" is not used; the vocabulary check should pass.

## 5. Shorter lesson line for the promotion card (fits 320px)

Card body width at 320px is about 288px of text. At the card's body size that is about 36-40 Hebrew characters per line, so a 2-line limit means at most about 70 characters.

| Mode | id | Text | Chars |
|---|---|---|---|
| Full | `promotion.lesson` | הוצאה חדשה מעלה את הסכום שהנכסים צריכים להכניס. | 47 |
| Family | `promotion.lesson` (override) | הוצאה חדשה בכל חודש: הנכסים צריכים להכניס יותר. | 48 |
| Junior | `promotion.lessonJunior` | יותר חשבונות בכל חודש: הנכסים צריכים לכסות יותר. | 49 |

Use: in `src/ui/career/promotion.js`, the `teaches` banner shows `word('promotion.lesson')` only, with no title prefix needed, or with the existing "מה זה מלמד:" title if it still fits on one extra line. Move the long `teaches` and `simplificationPace` to the fox feedback after the choice, where the player already has the numbers. This also keeps the "guess before explaining" order: the lesson line is a hint after the guess question, not before it.

Optional second line if space allows (true in every mode, no shame): "שדרוג הוא לא טעות. כדאי רק לבחור בכוונה." (40 chars). Junior: "אפשר ליהנות מהכסף. כדאי לבחור בכוונה." (38 chars).

## 6. Open items for the CEO and developer

1. Render the fox accessory or drop the accessory sentences (finding 1). Until then the copy promises something the player cannot see.
2. Update `docs/v050/career.he.json` to match section 3 and 4 (finding 8).
3. Decide the `promo-keep` achievement wording (finding 9).
4. Run `tests/kid-vocabulary.test.js` after merging the strings (I could not run tests).
5. Finance: confirm the two real-world sentences (tax and social security on a raise; the term "lifestyle creep" in Hebrew), flagged in `needs_review`.
