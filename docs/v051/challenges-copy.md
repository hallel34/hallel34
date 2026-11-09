# MaxiFox 0.5.1: copy for friend challenges

Date: 2026-11-09. Owner: educator (financial-literacy-design). Source of truth for strings: `docs/v051/challenge.he.json`.
Based on: plan "NEXT: 0.5.1", docs/MaxiFox_v0.5_Plan.md §4, the `win.*` / `daily.*` tone in he.json, and the family override layer with its forbidden words (tutorial.he.json, tests/kid-vocabulary.test.js).

## 1. How the fragment merges

| Part of the JSON | Where it goes | What it holds |
|---|---|---|
| `challenge` | `src/i18n/he.json`, a new top-level group | the full-mode (adult) wording, plus the `…Junior` sibling keys |
| `familyOverrides` | `tutorial.he.json` > `familyStrings.overridesRound11` | the family wording (11–13), in the existing `key / was / family` shape |
| `_meta` | not merged | slots, the takeaway selection rule and the open questions |

How a string is chosen:
- **Full mode:** `challenge.<key>`.
- **Family mode:** the override if there is one, otherwise the base.
- **Junior:** `challenge.<key>Junior` if it exists, otherwise the family string. This is the same pattern as `loan.limitLeftJunior` and `standings.rowJunior`.

Rules I followed:
- **No forbidden words:** no family or junior string contains a word from `FORBIDDEN` (checked by grep). Every adult string with an adult term has a family override. The one exception is `takeaway.repayLoan` and `timeline.repay*`, which exist only in full mode. Their key names contain `repay`, so the test's `FULL_ONLY` filter skips them.
- **No ₪ in the text:** every amount comes from a slot, and `format.js` formats it for the age band of the person playing. Junior players see coins even when the link was made in a full game, as the plan's §1.7 requires.
- **Key names:** no key is called `a11y`, `note`, `when`, `example` or `share`, so the test's `walk` and `FULL_ONLY` don't skip it by accident. The share texts live under `invite.*` and `reply.*` for this reason.
- **Test:** add `'challenge'` to `HE_GROUPS` in `tests/kid-vocabulary.test.js`. I did not edit tests, as instructed.

## 2. Language decisions

- **Names have no grammatical gender.** The creator types any name, so no verb agrees with `{name}`. The plan's examples "נועה סיימה" and "פה היא קנתה" are rewritten:
  - the slot `{them}` is "אצל {name}" or "במשחק מהקישור" (junior: "במשחק ששלחו לכם");
  - the verbs are passive or impersonal ("נקנתה {them}", "{them} היה דילוג");
  - the result line uses a noun ("התוצאה של {name}: …").
- **Share texts are in the first person.** The adult version uses "הגעתי", which has no gender in Hebrew. Family and junior use "הגענו", the same as the existing `win.shareText` override.
- **No pressure:**
  - no "תצליחו יותר?", no time limit, no "רק היום" and no money promise;
  - the invitation ends with "רוצים לנסות?" and the intro with "מה תעשו אתם?";
  - the hook is fairness ("אותן קוביות ואותם קלפים, ההחלטות שלכם").
- **Kind results:**
  - when the other side is ahead, the headline is about their path ("המסלול {them} היה מהיר יותר"), not about the player losing;
  - the sub-line turns it into learning ("מכל הבדל לומדים משהו");
  - when a result can't be checked, there is no winner.
- **Deal names in quotes.** Deal names appear in ״ ״, and a line never uses a pronoun that depends on the deal's gender ("העסקה הזאת", "של העסקה").

## 3. The copy, by section

The legend for the version columns:
- **מלא:** the base string.
- **משפחה:** the family override; "=" means the same as the full version.
- **צעירים:** the `Junior` key; "=" means it uses the family string.

### 3.1 Share text (`challenge.invite.*`, `challenge.reply.*`, `challenge.create.*`)

| Key | מלא | משפחה | צעירים |
|---|---|---|---|
| invite.win | אתגר ב-MaxiFox: הגעתי לחופש כלכלי {turns} ({mode}). אותן קוביות ואותם קלפים, ההחלטות שלכם. רוצים לנסות? {url} | אתגר ב-MaxiFox: הגענו לחופש כלכלי {turns} ({mode}). רוצים לשחק בדיוק את אותו משחק? ההחלטות שלכם. {url} | שיחקנו ב-MaxiFox ({mode}) והגענו לחופש {turns}! רוצים לשחק בדיוק את אותו משחק? {url} |
| invite.progress | …הגעתי ל-{pct}% מהדרך לחופש כלכלי ({mode})… | …הגענו ל-{pct}% מהדרך לחופש כלכלי… | …והגענו ל-{pct}% מהדרך לחופש… |
| invite.*Named | the same text with the prefix "אתגר מ-{name}" | the same | "אתגר מ-{name}: שיחקנו…" |
| reply.win | תשובה לאתגר ב-MaxiFox: הגעתי לחופש כלכלי {turns} ({mode}). ההשוואה בינינו כאן: {url} | …הגענו… ההשוואה כאן: {url} | שיחקנו את האתגר והגענו לחופש {turns}! בואו לראות את ההשוואה: {url} |
| reply.progress / *Named | the same pattern with {pct}, or with "תשובה מ-{name}" | | |
| mode.full / family / junior | משחק מלא / משחק משפחתי / משחק צעירים | | |
| create.button | שלחו אתגר | = | = |
| create.nameLabel | השם שלכם בקישור (לא חובה) | = | = |
| create.nameHint | עד 16 תווים. מי שיקבל את הקישור יראה אותו | = | אפשר לכתוב רק שם פרטי, או להשאיר ריק |

Notes on the share text:
- **The button name:** "שלחו אתגר" replaces the plan's "אתגרו חבר", because "חבר" is masculine.
- **Turn phrase:** `{turns}` is `plural.turnsIn` ("ב-23 תורות").
- **Length:** each invite is about 130 characters with the URL. That fits in one WhatsApp bubble.

### 3.2 Intro card (`challenge.intro.*`, `challenge.rules.*`, `challenge.error.*`)

| Key | מלא = משפחה | צעירים |
|---|---|---|
| intro.title / titleNamed | קיבלתם אתגר / אתגר מ-{name} | = |
| intro.resultWin(Named) | התוצאה בקישור: חופש כלכלי {turns} / התוצאה של {name}: … | במשחק הזה הגיעו לחופש {turns} / {name}: חופש {turns} |
| intro.resultProgress(Named) | התוצאה בקישור: {pct}% מהדרך לחופש כלכלי | במשחק הזה הגיעו ל-{pct}% מהדרך לחופש |
| intro.sameGame | אותו משחק בדיוק: {profession}, {mode}, אותן קוביות ואותם קלפים. ההחלטות שלכם. | אותו משחק בדיוק: אותן קוביות ואותם קלפים. אתם מחליטים. |
| intro.curious | מה תעשו אתם? | = |
| intro.cta / later | שחקו את האתגר / לא עכשיו | בואו נשחק / = |
| rules.title | באתגר יש שני כללים | שני כללים באתגר |
| rules.charity | תרומה לא נותנת קובייה נוספת. | תרומה לא נותנת עוד קובייה. |
| rules.reroll | אין גלגול שוב. | אי אפשר לזרוק שוב. |
| rules.why | כדי ששניכם תשחקו בדיוק באותם תנאים. | ככה לשניכם יש בדיוק אותו משחק. |
| rules.charityStill | אפשר עדיין לתרום, אם רוצים. | = |
| rules.charityModal | תרמו {amount} (10% מההכנסה). באתגר תרומה לא נותנת קובייה נוספת | אפשר לתרום {amount}. באתגר זה לא נותן עוד קובייה |
| error.invalidTitle / Body | הקישור לא נפתח / אולי חסר בו חלק, או שהוא נקטע בדרך. בקשו ממי ששלח לשלוח אותו שוב. | הקישור הזה לא עובד. בקשו ממי ששלח לשלוח אותו שוב. |
| error.tamperedTitle / Body | משהו בקישור השתנה / הקישור לא תואם למשחק המקורי, ולכן אי אפשר לשחק בו אתגר הוגן. בקשו קישור חדש. | משהו בקישור השתנה. בקשו קישור חדש. |
| error.versionTitle / Body | קישור מגרסה אחרת / הקישור נוצר בגרסה אחרת של MaxiFox. נסו לרענן את האפליקציה ולפתוח אותו שוב. | הקישור מגרסה אחרת של המשחק. בקשו ממבוגר לרענן את האפליקציה. |
| error.toPlay / toHome | למשחק רגיל / לדף הבית | = |

- **The tampered-link error doesn't accuse anyone.** A link can change by accident when it's copied or cut off.
- **The version error** is for format 3 and above, or for rngVersion 1, which `verifyResult` refuses.

### 3.3 HUD chip (`challenge.hud.*`)

| Key | מלא = משפחה | צעירים |
|---|---|---|
| chip | אתגר | = |
| aria / ariaNamed | משחק אתגר (מול {name}). תרומה בלי קובייה נוספת, ואין גלגול שוב | משחק אתגר: אותן קוביות כמו במשחק ששלחו לכם / של {name} |
| resume / resumeInfo | המשיכו את האתגר / אתגר · תור {turn} | = |

### 3.4 Compare screen (`challenge.compare.*`)

| Key | מלא | משפחה | צעירים |
|---|---|---|---|
| title, you, themAnon | ההשוואה · אתם · מהקישור | = | = |
| turns | תורות עד חופש כלכלי | = | תורות עד החופש |
| notReached | עוד לא | = | = |
| freedom + freedomValue | חופש כלכלי · {pct}% | = | כמה קרוב לחופש |
| freedomHelp | כמה מההוצאות החודשיות ההכנסה הפסיבית מכסה | כמה מההוצאות של כל חודש הכסף שעובד בשבילכם מכסה | כמה מהחשבונות של כל חודש הנכסים כבר מכסים |
| deals | עסקאות שנקנו | = | נכסים שנקנו |
| loans / loansValue / loansNone | הלוואות מהבנק / {n} · {amount} / בלי הלוואות | = | הלוואות |
| verified + verifiedText | אומת · שחזרנו את המשחק מהקישור לפי כללי המשחק, והתוצאה נכונה. | = | בדקנו: זה בדיוק מה שקרה במשחק. |
| unverified + unverifiedText | לא אומת · לא הצלחנו לשחזר את המשחק מהקישור, ולכן התוצאה מוצגת בלי בדיקה. | = | לא הצלחנו לבדוק את התוצאה הזאת. |
| headlineYouAheadWin / Progress | הפעם הגעתם לחופש מהר יותר / הפעם הגעתם רחוק יותר בדרך לחופש | = | הגעתם לחופש מהר יותר! כל הכבוד / הגעתם רחוק יותר! כל הכבוד |
| subYouAhead | כל הכבוד. בצפייה החוזרת רואים מה היה שונה. | = | = |
| headlineThemAheadWin / Progress | הפעם המסלול {them} היה מהיר יותר / הפעם ההתקדמות {them} הייתה גדולה יותר | = | הפעם המשחק {them} היה מהיר יותר / הגיע רחוק יותר |
| subThemAhead | בואו נראה איפה ההחלטות נפרדו. מכל הבדל לומדים משהו. | = | בואו נראה מה היה שונה. ככה לומדים. |
| headlineTie / subTie | תיקו: אותה תוצאה בדיוק / בואו נראה אם הדרך הייתה שונה. | = | תיקו! בדיוק אותה תוצאה |
| headlineUnverified / sub | הנה שתי התוצאות / את התוצאה מהקישור לא הצלחנו לבדוק, ולכן אין כאן מנצח. | = | = |
| simplification | במשחק המספרים מפושטים, ובאתגר המזל זהה לשניכם. בחיים אי אפשר לשחק שוב עם אותו מזל בדיוק. | = | במשחק המספרים פשוטים יותר מבחיים. |
| btnReply / btnReplay / btnBoard / btnHome | שלחו את התוצאה שלכם / צפייה חוזרת / לטבלת המשפחה / לדף הבית | = | = |

Proposed rule for the headline (an owner decision):
1. If both sides reached freedom, fewer turns is ahead.
2. If only one side reached freedom, that side is ahead.
3. If neither did, the higher % is ahead.
4. An equal result is a tie.
5. If either side failed verification, show `headlineUnverified`.

### 3.5 "מה זה מלמד" (`challenge.takeaway.*`): 12 lines

| Key (trigger) | Concept | מלא | משפחה | צעירים |
|---|---|---|---|---|
| passedGoodDeal: you passed, they bought, the light is green or yellow | תקופת החזר | בתור {turn} דילגתם על ״{deal}״. תקופת ההחזר של העסקה: {years}, כלומר המקדמה חוזרת מהר יחסית. | …שם התשלום הראשון חוזר תוך {years}, וזה די מהר. | = |
| boughtGoodDeal: you bought, they passed | תזרים חודשי | בתור {turn} קניתם את ״{deal}״: עוד {monthly} בחודש לתזרים. בכל סיכום שנתי זה כפול {months}. | …עוד {monthly} שנשארים בכל חודש… | …מאז נכנסים לכם עוד {monthly} בכל חודש. |
| boughtNegative: you bought, monthly < 0 | תזרים חודשי | …עסקה עם תזרים שלילי: {monthlyAbs} יוצאים בכל חודש. כדאי לבדוק את שורת התזרים לפני שקונים. | …העסקה הזאת עולה לכם {monthlyAbs} בכל חודש במקום להכניס. שווה לבדוק את ׳נשאר בחודש׳ לפני שקונים. | …לוקחת {monthlyAbs} בכל חודש. בפעם הבאה בודקים קודם כמה נשאר בחודש. |
| passedNegative: you passed, they bought, monthly < 0 | תזרים חודשי | …עסקה שמוציאה {monthlyAbs} בכל חודש (תזרים שלילי). הדילוג שמר על הכסף שלכם. | …עסקה שעולה {monthlyAbs} בכל חודש במקום להכניס… | = |
| loanYou: only you took a loan | ריבית | בתור {turn} לקחתם הלוואה של {amount}. הריבית: {monthlyPayment} בכל חודש, {perSummary} בכל סיכום שנתי, עד שמחזירים. | התוספת: … עד שמחזירים אותה. | בכל חודש משלמים עליה עוד {monthlyPayment}, עד שמחזירים. |
| loanForDeal: the loan paid for the deal | ריבית מול תזרים | ההלוואה מתור {turn} עולה {monthlyPayment} ריבית בחודש, והעסקה ״{deal}״ מכניסה {monthly}. הלוואה לנכס מוסיפה לתזרים רק כשהנכס מכניס יותר מהריבית. | …מוסיפה למה שנשאר בחודש רק כשהנכס מכניס יותר מהתוספת. | …נשאר יותר כסף רק כשהעסקה מכניסה יותר. |
| cushionLoan: you paid an expense with a loan, they paid with cash | כרית ביטחון | בתור {turn} שילמתם הוצאה בעזרת הלוואה של {amount}. כרית ביטחון במזומן הייתה חוסכת {monthlyPayment} ריבית בחודש. | …קורה לכולם. כסף בצד לשעת צורך היה חוסך {monthlyPayment} תוספת בחודש. | = |
| cushionCash: you paid with cash, they took a loan | כרית ביטחון | …זו כרית ביטחון בפעולה: בלי ריבית חדשה. | …זה כסף בצד לשעת צורך: בלי תוספת חדשה. | בתור {turn} היה לכם מספיק כסף לשלם הוצאה, בלי הלוואה. ככה לא משלמים תוספת. |
| firstAssetEarlier: you bought earlier | הכנסה פסיבית | הנכס הראשון שלכם נקנה בתור {turnYou}, ו{them} בתור {turnThem}. הכנסה פסיבית שמתחילה מוקדם יכולה להגיע ביותר סיכומים שנתיים. | …כסף שעובד בשבילכם ומתחיל מוקדם… | קניתם נכס ראשון בתור {turnYou}… נכס שקונים מוקדם מכניס כסף יותר זמן. |
| firstAssetLater: they bought earlier | הכנסה פסיבית | {them} הנכס הראשון נקנה בתור {turnThem}, ואצלכם בתור {turnYou}. כל תור מוקדם יותר נותן להכנסה הפסיבית יותר זמן לעבוד. | …לכסף שעובד בשבילכם… | …נכס שקונים מוקדם מכניס כסף יותר זמן. |
| repayLoan: full mode only | ריבית | בתור {turn} החזרתם {amount} מההלוואה, והריבית החודשית ירדה ב-{monthlyPayment}. | (none) | (none) |
| sameDecisions: no split at all | תזרים חודשי | אותן החלטות בכל התורות, ולכן אותה תוצאה. באתגר המזל זהה, ורק ההחלטות משנות את התזרים. | …ורק ההחלטות משנות כמה נשאר בחודש. | = |

How the lines are chosen (`_meta.takeawaySelection`):
1. If either side is not verified, show no takeaway line, only `compare.simplification`.
2. If nothing split, show `sameDecisions`.
3. Otherwise, the decisive split is the first one in the timeline that involves buying or passing, a loan, or an expense. Charity never counts, because in a challenge it doesn't change the dice.
4. An optional second line is `firstAsset*`, shown only when both sides bought an asset on different turns.
5. Show at most 2 lines.

### 3.6 Replay timeline (`challenge.timeline.*`)

| Key | מלא = משפחה (צעירים the same unless noted) |
|---|---|
| title / sub | צפייה חוזרת / רק לצפייה: כאן רואים איפה ההחלטות נפרדו |
| turnLabel, laneYou, laneThemAnon | תור {turn} · אתם · מהקישור |
| legendSplit / noSplit | סימן = כאן ההחלטות נפרדו / כל ההחלטות היו זהות |
| act.* | קנייה · דילוג · הלוואה · הוצאה מהמזומן · הוצאה בהלוואה · תרומה · החזר · חופש! · סוף המשחק |
| themBought | בתור {turn} העסקה ״{deal}״ נקנתה {them}, ואתם דילגתם |
| youBought | בתור {turn} קניתם את ״{deal}״, ו{them} היה דילוג |
| themLoan / youLoan | בתור {turn} נלקחה הלוואה של {amount} {them}, ואצלכם לא / בתור {turn} לקחתם הלוואה של {amount}, ו{them} לא |
| expenseLoanYou / Them | בתור {turn} שילמתם הוצאה בהלוואה, ו{them} מהמזומן / בתור {turn} {them} הוצאה שולמה בהלוואה, ואצלכם מהמזומן |
| charityYou / Them | בתור {turn} תרמתם, ו{them} לא / בתור {turn} {them} הייתה תרומה, ואצלכם לא |
| repayYou / Them (full only) | בתור {turn} החזרתם {amount} מההלוואה, ו{them} לא / … {them} הוחזרו {amount} מההלוואה, ואצלכם לא |
| freedomYou / Them | בתור {turn} הגעתם לחופש כלכלי / בתור {turn} הגיע החופש הכלכלי {them} (צעירים: …לחופש! / הגיע החופש {them}) |
| endYou / Them | בתור {turn} המשחק שלכם נגמר / בתור {turn} המשחק {them} נגמר |
| srSummary / srSummaryNone | ציר של {total} תורות. ההחלטות נפרדו {splits}: {list}. / ציר של {total} תורות. כל ההחלטות היו זהות. |
| srCell | {lane}, תור {turn}: {action} |

Example, with `{them}` = "אצל נועה": "בתור 6 העסקה ״עגלת פופקורן ליד בית ספר״ נקנתה אצל נועה, ואתם דילגתם".

### 3.7 Weekly family board (`challenge.board.*`)

| Key | מלא = משפחה | צעירים |
|---|---|---|
| title | טבלת המשפחה של השבוע | = |
| week / weekAria | השבוע: {range} / השבוע, מיום ראשון {start} עד שבת {end} | = |
| how | מתוצאות של אתגרים שקיבלתם השבוע. רק תוצאות שנבדקו, ורק במכשיר הזה. | מהאתגרים שקיבלתם השבוע. הטבלה נשמרת רק במכשיר הזה. |
| sort | קודם מי שהגיעו לחופש בפחות תורות, אחר כך מי שעוד בדרך | = |
| you / anonName | אתם / קישור בלי שם | = |
| place / placeTie | מקום {n} / יחד במקום {n} | = |
| rowWin / rowProgress | חופש כלכלי {turns} / עוד בדרך: {pct}% מהדרך | חופש {turns} / = |
| rowAria | {name}: {result} | = |
| empty* | עוד אין תוצאות השבוע / שלחו אתגר למישהו מהמשפחה, והתוצאות יופיעו כאן. / שלחו אתגר | = |
| reset / cheer | ביום ראשון הטבלה מתחילה מחדש / כל משחק הוא הזדמנות ללמוד. כל הכבוד לכל מי ששיחקו | = |

How the board avoids shaming:
- An unfinished game shows as "עוד בדרך" with its %, never as "הפסד".
- The last row gets no label, colour or icon of its own (a note for the designer).
- The cheer line appears under every board.

## 4. Fact checks (game math against the text)

- **Payback:** "המקדמה חוזרת אחרי {years}" uses the same definition as glossary `payback`: down payment ÷ (monthly × 12). "מהר יחסית" is shown only for green or yellow deals, and the doc calls that the game's rule of thumb.
- **Payday:** "בכל סיכום שנתי זה כפול {months}" is true. The payday amount is the monthly cash flow × `PAYDAY_MONTHS`, and the deal's share of it is its monthly × 12.
- **Loan cost:**
  - `{monthlyPayment}` and `{perSummary}` come from `loanTerms` at the rate of that turn. The loan is interest-only, so "עד שמחזירים" is correct.
  - `repayLoan` doesn't say "since then" (מאז), because the live rate can change.
- **"מוסיפה לתזרים רק כשהנכס מכניס יותר מהריבית":** this is exact arithmetic for one month. It makes no promise about the future.
- **"באתגר המזל זהה":** this is true only under the challenge rules, through keyed RNG plus no bonus die and no reroll. It is labelled as a game fact, and `compare.simplification` separates it from real life.
- **No line says a decision "caused" the result.** The lines describe the difference and the concept. They make no claim of cause or of getting rich.

## 5. needs_review

1. **CEO/developer (blocking for the wording):** "כדי ששניכם תשחקו בדיוק באותם תנאים" is true only if the creator's game also ran without a charity bonus die or a reroll.
   - If a normal game that used either one can create a link, the receiver's dice will differ.
   - Proposal: offer the link only for logs without them, or for challenge games. Otherwise use `rules.whyAlt`.
2. **developer:** Does the charity square still offer a donation in a challenge? `rules.charityStill` and `rules.charityModal` assume it does.
3. **developer:** `error.versionBody` assumes a refresh brings in the new PWA version.
4. **owner:** Should junior games show a name field at all? The link gets forwarded.
5. **owner:** How are unfinished games ranked on the board? `board.sort` assumes turns first, then %.
6. **developer:** I had no shell in this session, so `git pull`, `JSON.parse` and vitest were not run. I worked from the checkout as it was. Run the vocabulary test after merging.
