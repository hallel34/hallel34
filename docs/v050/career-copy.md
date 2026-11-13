# MaxiFox 0.5.0: copy for career, profiles, achievements and the promotion card

Date: 2026-11-10. Owner: educator (financial-literacy-design). Sources of truth for strings: `docs/v050/career.he.json` and `docs/v050/achievements.json`.
Based on: CLAUDE.md (brand and naming rules), `docs/decisions.md` 2026-11-10 (career row), `docs/MaxiFox_v0.5_Plan.md` §5, the 0.5.1 copy (`docs/v051/`), `src/data/professions.he.json`, the glossary and feedback files, and the engine's learn record (`src/engine/learn.js`, `config.js`).

Nothing under `src/` was edited. No shell was available, so `JSON.parse` and vitest were not run.

## 1. How the files merge

| Part | Where it goes | What it holds |
|---|---|---|
| `career`, `profile`, `achievement`, `promotion` | `src/i18n/he.json`, four new top-level groups | the full-mode wording plus the `…Junior` sibling keys |
| `familyOverrides` | `tutorial.he.json` > `familyStrings.overridesRound11` | 6 family overrides, `key / was / family` |
| `glossaryProposal` | proposed new concept for `src/data/learn/glossary.he.json` | `lifestyle_creep`, in the glossary's own shape |
| `achievements.json` | a data file for the developer | 16 achievements, each with full / family / junior texts |
| `_meta` | not merged | slots, word choices, needs_review |

String resolution is the same as 0.5.1: full = the base key; family = the override if there is one; junior = `<key>Junior` if it exists, otherwise the family string.

Only `promotion.*` needs family overrides. `career.*`, `profile.*` and `achievement.*` are written without adult money words, so one base string serves full and family.

## 2. The term for lifestyle inflation

**Chosen: "זחילת רמת החיים"**, used once, in full mode only (`promotion.teaches`), with "אינפלציית סגנון חיים" kept as an alias in the glossary proposal.

Why:
1. **"אינפלציה" already has a meaning in this game.** New deals get more expensive every lap (`PRICE_INFLATION_PER_LAP`), and that is the game's inflation lesson. A second "אינפלציה" that means "my own spending went up" would give one word two meanings.
2. **"רמת חיים" is everyday Hebrew.** The owner's own description of the choice already says "לשדרג את רמת החיים", so the term reuses the words on the button.
3. **"זחילה" is the lesson.** It says slow and unnoticed, which is the point of the concept. "אינפלציה" says nothing about pace.

Limits of this choice:
- Neither phrase is an official Hebrew term. Both are translations (lifestyle creep, lifestyle inflation). A web search on 2026-11-10 found no authoritative Hebrew source for either one. I can't say which is more common.
- Family and junior get **no term at all**, only the description ("כשמרוויחים יותר, קל גם להוציא יותר"). A 9-year-old needs the idea, not the label. The family glossary entry uses the `kidName` "כשההוצאות עולות יחד עם המשכורת".

## 3. Tone rules I followed

**The loss mechanic**
- **The rule is stated before it can bite.** `career.rules.*` is the plain rule in five short lines, meant for the first time the career opens and behind "איך עובד הוותק?" on the chip at all times.
- **The warning is one sentence: what happens, and by when.** `warnProgress` and `warnRank` carry nothing else: no "אל תפספסו", no "מהרו", no exclamation mark, no countdown wording beyond the real number of days.
- **Things happen; nobody "loses".** The copy never uses "איבדתם", "הפסדתם", "נכשלתם", "חבל" or "פספסתם". The sentences describe the state: "ההתקדמות התחילה מאפס", "כל מקצוע ירד דרגה אחת".
- **Every return screen opens with "טוב לראות אתכם שוב"**, then what happened, then what was kept, then the way forward.
- **No fake urgency.** "שבוע קידום" really ends on Saturday, so "עד סוף יום שבת" is a fact. Nothing else has a deadline.
- **Junior (up to 10) never sees a loss word.** The chip says "הקריירה שמורה". The return screen says the career waited. The junior rules don't mention weeks at all. One line for parents states the guard.
- **The rule is labelled as a game rule** (`rules.gameRule`): real seniority at work is not erased by a week off.

**The promotion card**
- **Both choices are legitimate.** Upgrading is called "בחירה שלכם", and the lesson line says "לשדרג זו לא טעות". The feedback after "upgrade" gives numbers, not a verdict.
- **Feedback names the number behind it:** the raise per month and per yearly summary; the new expense; what is left of the raise; by how much the freedom target moved.
- **No claim about the future.** The copy says the target rose by `{upgradeCost}`. It does not say "you will get there later", because the engine can't know that.
- **Three simplifications are labelled** (pace, tax, the cash perk), each in its own string so the developer can drop one if the engine changes.
- **Guess before explaining** (optional keys `promotion.guess.*`): one question before the choice. If it is used, show the two consequence lines only after the answer, since `keepConsequence` gives the answer away.

**General**
- Plural address everywhere; no verb agrees with a name. First-person titles ("הגעתי", "זיהיתי", "החזרתי") have no gender in Hebrew.
- No typed money. Every amount is a slot, so junior players see coins and no number over 999 (as long as the promotion amounts are multiples of ₪100, see `_meta.money`).
- Banned phrases from CLAUDE.md do not appear. The start phase is not named in this copy at all.
- **"קידום" means two things only:** "שבוע קידום" and "קידום בעבודה" (the in-game card). Moving up the ladder is always "עליתם דרגה", never "קידום", so three different things don't share a name.

## 4. Rank titles

Rank 0 is the title in `professions.he.json`. All titles are 16 characters or fewer and use that file's slash style.

| Profession | Rank 1 | Rank 2 | Rank 3 |
|---|---|---|---|
| מורה | מחנך/ת כיתה | רכז/ת שכבה | מנהל/ת בית ספר |
| מהנדס/ת | מהנדס/ת בכיר/ה | מנהל/ת פרויקטים | מהנדס/ת ראשי/ת |
| נהג/ת מונית | בעל/ת מונית | מנהל/ת תחנה | בעל/ת צי מוניות |
| אח/ות | אחראי/ת משמרת | אח/ות אחראי/ת | מנהל/ת הסיעוד |
| מפתח/ת תוכנה | מפתח/ת בכיר/ה | ראש/ת צוות | מנהל/ת פיתוח |
| שוטר/ת | רב-סמל/ת | מפקח/ת | מפקד/ת תחנה |
| טבח/ית | אחראי/ת פס | סו-שף/ית | שף/ית |
| עורך/ת דין | עו״ד בכיר/ה | שותף/ה | שותף/ה בכיר/ה |

These come from my own knowledge of the Israeli job market. I did not check them against an official source (a wage agreement, the police rank table, a hospital's nursing structure).

**Titles I'm unsure are the real career step:**
1. **נהג/ת מונית, all three.** Taxi driving has no formal ladder. The steps I used are business steps (owning the car, running a station, owning several taxis), so "the salary goes up" is a simplification for this profession: an owner earns profit, not a wage. I'm also not sure "מנהל/ת תחנה" sits above "בעל/ת מונית" in practice.
2. **שוטר/ת.** "רב-סמל" and "מפקח" are real police ranks, but the ladder skips many ranks in between, and the jump from מפקח to station commander skips several officer ranks. Rank 3 is a role, while ranks 1 and 2 are ranks. I'm not certain of the feminine forms the police use ("רב-סמלת", "מפקחת").
3. **טבח/ית, rank 1.** "סו-שף" and "שף" are standard. "אחראי/ת פס" is kitchen speech for the cook in charge of a station; I'm not sure it is used as a job title.
4. **מורה, rank 1.** "מחנך/ת כיתה" is a role with a pay supplement. Many teachers hold it from their first years, so it is a real step but not always a promotion.
5. **עורך/ת דין, ranks 2 and 3.** Partner is the real step, but a partner takes a share of profit, not a salary. Rank 1 uses the abbreviation "עו״ד" because "עורך/ת דין בכיר/ה" is 17 characters.

## 5. What the promotion decision teaches, in three voices

**מלא**

כשהמשכורת עולה, קל להעלות איתה גם את ההוצאות. לזה קוראים זחילת רמת החיים. בקלף הקידום רואים את זה במספרים: מי שממשיך לחיות כמו קודם מוסיף את כל ההעלאה לתזרים, והסכום שצריך כדי להגיע לחופש כלכלי לא משתנה. מי שמשדרג מוסיף הוצאה חודשית, ולכן גם ההכנסה הפסיבית שצריך כדי להגיע לחופש כלכלי עולה באותו סכום. לשדרג זו לא טעות, וכדאי רק להחליט על זה בכוונה. במשחק מחליטים פעם אחת ורואים את התוצאה מיד. בחיים זה קורה בדרך כלל לאט, בהרבה החלטות קטנות, וחלק מכל העלאה הולך למסים ולביטוח לאומי.

**משפחה**

כשהמשכורת עולה, קל להעלות איתה גם את ההוצאות, בלי לשים לב. בקלף הקידום רואים את זה במספרים: מי שממשיך כמו קודם, נשאר לו יותר כסף בכל חודש, והמטרה לא זזה. מי שמשדרג מוסיף הוצאה לכל חודש, ולכן הנכסים שלו צריכים להכניס יותר כדי להגיע לחופש כלכלי. לשדרג זו לא טעות. כדאי רק להחליט על זה בכוונה, ולדעת מה זה משנה. במשחק מחליטים פעם אחת, ובחיים זה קורה בדרך כלל לאט, בהרבה החלטות קטנות.

**צעירים**

כשמרוויחים יותר, קל גם להוציא יותר. בקלף הקידום המשכורת גדלה, ואתם מחליטים מה עושים עם הכסף החדש. אם ממשיכים כמו קודם, הכסף החדש נשאר אצלכם בכל חודש. אם מוציאים יותר, יש יותר חשבונות לשלם בכל חודש, ולכן הנכסים צריכים להכניס יותר כדי להגיע לחופש. אפשר ליהנות מהכסף החדש, וכדאי להחליט מראש כמה ממנו נשאר.

## 6. Parts of the feature that I think teach something untrue

1. **The cash perk for upgrading.** In real life, upgrading your lifestyle costs money; nobody pays you for it. A child can take away "spending more gets me a prize". The copy labels it (`simplificationPerk`), but a label under a reward is weak. Options that keep the temptation and stay true:
   - make the perk the fun, not cash (a new home or car picture on the player's card, a visible "רמת חיים" badge for the rest of the game);
   - or give the same one-time bonus on both choices, as a promotion bonus, so it isn't a reward for spending.
2. **Seniority that decays.** Real seniority at work grows with time employed and is not erased by a week or two away; vacation and parental leave don't cancel it. The mechanic uses a real work word for a return rule. `rules.gameRule` says so in one line. A name that claims less ("רצף שבועי") would be more honest, but "ותק" is the owner's word.
3. **Higher rank = higher expenses, automatically.** The ladder builds lifestyle inflation into every rank, while the promotion card teaches that it is a choice. `rankUp.simplification` separates the two: some costs really do rise with salary (taxes), the rest are a decision. If the developer raises mainly the tax line at higher ranks, the ladder becomes true to life instead of needing the label.
4. **"The whole raise is free cash."** A real raise is taxed. True in the game only if the tax line doesn't move; labelled in `simplificationTax`.
5. **The promotion-keep achievement** pays XP for one of the two choices. Together with the ladder, a player could learn "never raise your standard of living", which isn't the lesson. The feedback lines keep "upgrade" legitimate to balance this.

Not untrue, but worth the CEO's attention: children aged 11–13 get the reset and rank-drop screens. The owner's guard stops at 10. See `_meta.needs_review` in `career.he.json`.

## 7. Claims I checked

**Against the game's rules and data**

| Claim in the copy | Checked against | Result |
|---|---|---|
| Freedom comes when the money from assets is greater than all expenses, so a new monthly expense raises the amount needed by exactly that expense | CLAUDE.md win rule; `hasWon` (passive income > total expenses) | True, provided the upgrade is stored as a monthly expense (flagged for the developer) |
| `{raise}` a month is `{perSummary}` at each yearly summary | `PAYDAY_MONTHS = 12`; payday pays monthly cash flow × months | True |
| Keeping the lifestyle leaves expenses and the target unchanged | follows from the owner's rule for "keep" | True by definition |
| The perk "is worth about `{perkMonths}` of the new expense" | arithmetic: perk ÷ upgradeCost, rounded | True; shown only when the result is 1 or more |
| Green light = payback of 8 years or less; red = more than 14 years or never | `paybackTier`, `PAYBACK_OK_YEARS = 8`, `PAYBACK_SLOW_YEARS = 14` | True. The plan said "shorter than 8"; I wrote "עד" to match the light |
| "עסקת פח" = red light | `LIGHT_OF` in learn.js (bad and trap are both red); existing line `pass.trap` | Consistent |
| No bank loan means no interest paid on bank loans | `stats.loansTaken`; existing line `win.noBankLoan` | True. The text says "עליהן", because starting debts still have payments |
| After a bank loan is repaid in full, nothing more is paid on it | `repayLoan` removes the liability at principal 0 | True |
| The most expensive starting debt per shekel owed is the card, then the car, then the student loan | `BASE_DEBT_RATES` (3% / 2% / 1% a month) | True in the game; see the real-life note in achievements.json |
| Family and junior games have no stocks, so "דירה, עסק ומניה" is full mode only | CLAUDE.md modes | True |
| 25% milestone fires once, the first time passive income covers a quarter of expenses | `settle()` in engine.js, `MILESTONES` | True |
| Junior: 1 coin = ₪100 | `COIN_VALUE = 100` | True; no amount is typed |
| Each profession has 4 ranks; rank 0 is today's title | owner decision 2026-11-10 | As decided |
| Week = Sunday to Saturday; one missed week resets progress in every profession, ranks stay; two in a row drop every profession one rank; up to age 10 nothing is lost; no push notifications | owner decision 2026-11-10 and the task brief | As decided |
| Promotion week gives double XP in one profession until Saturday | task brief | As decided |

**Against the real world**

| Claim in the copy | Basis | Confidence |
|---|---|---|
| Seniority at work is not erased by a week of vacation | general employment practice in Israel | High. No source attached; worded narrowly on purpose |
| Part of every raise goes to taxes and national insurance | income tax and ביטוח לאומי are charged as a share of wages | High. No rate is quoted |
| Some expenses rise with salary, such as taxes; the rest are a decision | same | High |
| Lifestyle creep usually happens slowly, in many small decisions | the definition of the concept | Medium: it is a description, so it says "בדרך כלל" |
| Upgrading your lifestyle does not give cash in real life | plain fact | High |

**Assumptions that are not verified** (each one is in `_meta.needs_review`):
- A game that ends without a win counts for seniority (`rules.whatCounts`).
- After a rank drop the week count starts again (`warnAfterDrop`, `back.drop.next`).
- Achievements and the "הגעתי פעם ל…" list survive a rank drop.
- The seniority chip is on the home screen (`rules.noPush`).
- The rank titles (section 4).

## 8. Notes for the developer

- **Chip states:** `chipKept` (a game was finished this week), `chipOpen` (not yet, early in the week), `chipWarn` + `warnProgress` or `warnRank` (not yet, late in the week). When the warning starts is a design call; I'd suggest the last three days. `warnRank` is for a week that follows a missed week.
- **`{days}`** counts the days left including today (Sunday 7, Saturday 1) and comes from `career.plural.daysLeft`.
- **Age change:** when a profile moves out of "עד 10", show `rules.fromAge11` with the rules before the rule starts to apply.
- **Achievement titles carry typed numbers** ("5", "3", "10"). If a `params` value changes, change the title too.
- **Rank number on screen** is `rank + 1` ("דרגה 1 מתוך 4" is rank 0).
- **Tests:** add the four groups to `HE_GROUPS` in `tests/kid-vocabulary.test.js`.
