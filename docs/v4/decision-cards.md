# MaxiFox v4: decision cards (text proposals + engine effects)

Date: 2026-10-23. Owner: financial-education specialist. Wiring: developer. Balance check: finance (re-run the simulation after the cards are in).

Status: proposal. Nothing here is wired; no file under `src/` was changed for this document.

## 0. How to read this

A decision card is a card with 2 or 3 real options. Each option has a trade-off and none is a trap. Every option below gives:

- **Engine effect** in game terms:
  - `cash`: the change in cash, signed.
  - `passive`: the change in passive income per month. This is the sum of the `monthlyCashFlow` values of the assets.
  - `loan`: the bank-loan principal added (+) or repaid (−). The monthly payment follows the existing rule, `loanMonthlyPayment(principal)` = 1% of the principal (`LOAN_PAYMENT_RATE`). It counts in expenses, not in passive income.
  - `asset`: a new asset, in exactly the shape `engine.buy()` pushes today: `{ type, category, price, downPayment, mortgage, monthlyCashFlow, loanPayment }`.
- **Net monthly**: `passive − loan payment`. This is what the win check feels: passive income has to rise above total expenses, and expenses include bank-loan payments.
- **Available if**: when the option can be chosen. When it cannot, the button shows the existing `card.unavailable` label ("לא זמין") with a reason (see `docs/v4/strings-proposals.md`).
- **Fox line**: one line after the choice, naming the number behind it (skill rule 3). Family lines avoid the adult words of the family vocabulary list.
- **מה זה מלמד**: the one concept the card teaches.

Rules shared by all cards:

1. Loans go through `engine.takeLoan` (multiples of `LOAN_STEP` = ₪1,000, the purchase loan cap `LOAN_CAP_SALARIES` and `maxLoan` still apply). If the cap blocks the loan, that option is "לא זמין". No new loan type.
2. Every number stays inside the ranges of the current `cards.he.json`. I recomputed each one by hand (no shell). Apartments use `loanPayment = mortgage × MORTGAGE_PAYMENT_RATE (0.0055)` and businesses use the card's own `profit − loanPayment`, like the existing cards.
3. Months per summary are never typed. Use `{months}` = `PAYDAY_MONTHS`. Note: config.js still says 24, and docs/decisions.md (23.10.2026) moves it to 12.
4. If `PRICE_INFLATION_PER_LAP` ships, it scales `price`, `downPayment`, `mortgage`, `monthlyCashFlow` (and `rent` / `profit` / `loanPayment`) of these cards the same way as other NEW deals. The ratios, and so the lessons, stay the same.
5. Rewards are never "free money". The cards only move money between cash, assets and debt, using the card's own numbers.
6. Traffic-light thresholds (`PAYBACK_OK_YEARS` 8, `PAYBACK_SLOW_YEARS` 14) are game rules of thumb. The cards do not call any option "good" in absolute terms.

Suggested data shape (one JSON per card in `cards.he.json`, `deck: "decision"`; or a separate deck file: developer's call):

```json
{
  "id": "dec-001",
  "deck": "decision",
  "modes": ["family", "full"],
  "title": "...", "titleFamily": "...",
  "text": "...", "textFamily": "...",
  "requires": null,
  "options": [
    { "id": "loan", "label": "...", "labelFamily": "...",
      "effects": { "cash": 0, "loan": 80000, "asset": { "type": "business", "category": "coffee", "price": 160000, "downPayment": 80000, "mortgage": 80000, "monthlyCashFlow": 1800, "profit": 3200, "loanPayment": 1400 } },
      "availableIf": "maxLoan >= 80000",
      "fox": "...", "foxFamily": "..." }
  ],
  "teaches": "...", "teachesConcept": "interest"
}
```

---

## Card 1: עכשיו בהלוואה, או לחכות לבאה?

- id `dec-001` · modes: family + full · concept: `interest` (family: "תוספת על הלוואה")
- Title: **"עגלת קפה בתחנה החדשה"**
- Text (full): "התחנה נפתחת בחודש הבא, והעגלה מחכה לכם: מקדמה של ₪80,000, ונשארים ₪1,800 בחודש אחרי תשלום הלוואת העסק. אפשר לממן מהחיסכון, בהלוואה מהבנק, או לחכות להזדמנות הבאה."
- Text (family): "התחנה נפתחת בחודש הבא, והעגלה מחכה לכם: תשלום ראשון של ₪80,000, ונשארים ₪1,800 בחודש. אפשר לשלם מהחיסכון, לקחת הלוואה מהבנק, או לחכות להזדמנות הבאה."
- Asset (same as `opp-biz-002`): `{ type: "business", category: "coffee", price: 160000, downPayment: 80000, mortgage: 80000, monthlyCashFlow: 1800, profit: 3200, loanPayment: 1400 }`

| option | label (full / family) | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "משלמים מהחיסכון" / same | cash −80,000; passive +1,800; asset as above | +₪1,800 | cash ≥ 80,000 |
| B | "לוקחים הלוואה על כל המקדמה" / "לוקחים הלוואה על כל התשלום הראשון" | loan +80,000 (payment +₪800/month); cash −80,000 + 80,000 = 0; passive +1,800; asset as above | +₪1,000 | maxLoan ≥ 80,000 |
| C | "מחכים להזדמנות הבאה" / same | none | ₪0 | always |

- Fox A: "₪1,800 בחודש בלי חוב חדש. רק בדקו שנשאר לכם כסף בצד להפתעות."
- Fox B (full): "ההלוואה עולה ₪800 בחודש, ולכן מה-₪1,800 נשארים ₪1,000. העסקה עדיין מכניסה, אבל פחות."
- Fox B (family): "ההלוואה עולה ₪800 תוספת בחודש, ולכן מה-₪1,800 נשארים ₪1,000."
- Fox C: "גם לחכות זו החלטה. החיסכון נשאר שלם להזדמנות הבאה."
- **מה זה מלמד:** הלוואה הופכת עסקה לאפשרית, אבל התשלום עליה אוכל חלק מהרווח: כאן ₪800 מתוך ₪1,800 בכל חודש, וב-{months} חודשים ₪800 × {months}.

## Card 2: דירה גדולה אחת, או שתיים קטנות?

- id `dec-002` · modes: family + full · concept: `diversification` (family: "לא לשים הכול במקום אחד")
- Title: **"אותו כסף, שתי דרכים"**
- Text: "יש לכם ₪400,000 לתשלום הראשון. אפשר לקנות דירת שלושה חדרים גדולה, או שתי דירות קטנות באותה שכונה."

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "דירה גדולה אחת" | cash −400,000; passive +5,100; asset `{ type: "apartment", category: "apartment", price: 3800000, downPayment: 400000, mortgage: 3400000, rent: 23800, loanPayment: 18700, monthlyCashFlow: 5100 }` (= `opp-apt-002`) | +₪5,100 | cash ≥ 400,000 |
| B | "שתי דירות קטנות" | cash −400,000; passive +4,800; **two** assets, each `{ type: "apartment", category: "apartment", price: 1900000, downPayment: 200000, mortgage: 1700000, rent: 11750, loanPayment: 9350, monthlyCashFlow: 2400 }` | +₪4,800 | cash ≥ 400,000 |
| C | "לא עכשיו" | none | ₪0 | always |

Check for B: 1,700,000 × 0.0055 = 9,350; 11,750 − 9,350 = 2,400; × 2 = 4,800.

- Fox A: "₪5,100 בחודש מדירה אחת. כל הכסף נמצא עכשיו במקום אחד."
- Fox B (full): "₪4,800 בחודש, ₪300 פחות, אבל משתי דירות. במצב מלא אפשר גם למכור אחת ולהשאיר את השנייה."
- Fox B (family): "₪4,800 בחודש משתי דירות. אם משהו קורה לאחת, השנייה ממשיכה להכניס."
- Fox C: "שווה לחשוב. הכסף מחכה בצד."
- **מה זה מלמד:** פיזור. במשחק דירה גדולה אחת מכניסה קצת יותר (₪300 בחודש), ושתי דירות נותנות גמישות. בעולם האמיתי דירה יכולה לעמוד ריקה, ואז שתי דירות מקטינות את הנזק. זה פישוט: המשחק לא מדמה דירה ריקה.
- Note for the developer: the family line for B says "if something happens to one". The game has no vacancy event, so this is a real-world reason. Keep the "במשחק / בעולם האמיתי" split in the reveal, or drop the family line if the CEO prefers that only game-true lines are shown.

## Card 3: למכור ברווח, או להשאיר את הכסף החודשי?

- id `dec-003` · modes: **full only** (selling is full mode) · concept: `net_worth` + `passive_income`
- Requires: the player owns at least one apartment. The engine picks the most expensive one, as `market` offers do (`matches.reduce` by price).
- Title: **"קונה רציני דופק בדלת"**
- Text: "משפחה רוצה את הדירה שלכם ומציעה 25% מעל מחיר הקנייה. אם תמכרו, הכסף החודשי מהדירה נגמר."
- Offer: `offerPct: 1.25` (inside the 1.15 to 1.4 range of `mkt-001..003`).

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "מוכרים" | cash + (round(price × 1.25) − mortgage); passive − asset.monthlyCashFlow; asset removed (same as `acceptOffer`) | −asset.monthlyCashFlow | owns an apartment |
| B | "משאירים" | none | ₪0 | always |
| C | "מוכרים ומחזירים את הלוואות הבנק" | as A, then `repayLoan` on every bank loan, up to the cash from the sale: cash − repaid; loan − repaid; expenses −1% × repaid | −asset.monthlyCashFlow + 1% × repaid | owns an apartment AND has a bank loan |

Worked example with `opp-apt-001` (Be'er Sheva studio): price 1,800,000 × 1.25 = 2,250,000; minus mortgage 1,600,000 = **+₪650,000** cash; passive **−₪3,400**. ₪650,000 ÷ ₪3,400 = about 191 months (about 16 years) of that apartment's monthly money.

- Fox A: "₪{proceeds} במזומן עכשיו, ו-{monthly} פחות בכל חודש. מה תעשו עם הכסף? זו ההחלטה הבאה."
- Fox B: "הדירה ממשיכה להכניס {monthly} בחודש. רווח על הנייר הוא לא כסף בכיס, וגם לא הפסד."
- Fox C: "מכרתם והחזרתם {repaid} לבנק: {saved} פחות הוצאות בכל חודש."
- Slots: `{proceeds}`, `{monthly}`, `{repaid}`, `{saved}` (same meaning as `feedback.he.json` slots: `saved` = `loanMonthlyPayment(repaid)`).
- **מה זה מלמד:** סכום חד-פעמי מול כסף שנכנס כל חודש. כדי להשוות, מחשבים כמה חודשים של הכסף החודשי שווה המכירה. בעולם האמיתי למכירה יש עלויות, ולפעמים גם מס על הרווח (ראו `rw-market-offers`).

## Card 4: הוצאה פתאומית: מהחיסכון או מהלוואה?

- id `dec-004` · modes: family + full · concept: `cushion` (family: "כסף בצד")
- Title: **"המקרר נפרד מאיתנו"**
- Text: "המקרר הפסיק לקרר בדיוק לפני החג. מקרר חדש עולה ₪6,000." (Inside the expense range ₪1,500 to ₪7,500.)

| option | label (full / family) | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "משלמים מהחיסכון" | cash −6,000 | ₪0 | cash ≥ 6,000 |
| B | "לוקחים הלוואה" | loan +6,000 (payment +₪60/month); cash 0 | −₪60 | always (expense loans are exempt from the purchase cap, like today) |
| C | "חצי-חצי" | cash −3,000; loan +3,000 (payment +₪30/month) | −₪30 | cash ≥ 3,000 |

- Fox A: "שילמתם מהכסף שבצד, ואין תשלום חדש. בשביל זה שומרים אותו."
- Fox B (full): "ההלוואה עולה ₪60 בחודש, כלומר ₪60 × {months} בכל סיכום, עד שתחזירו."
- Fox B (family): "ההלוואה עולה ₪60 תוספת בחודש, עד שתחזירו אותה."
- Fox C: "חצי מהחיסכון וחצי בהלוואה: ₪30 בחודש, ועוד נשאר לכם קצת בצד."
- **מה זה מלמד:** כסף בצד הופך הוצאה פתאומית לבעיה קטנה. בלי כסף בצד, ההוצאה הופכת לתשלום חודשי.

## Card 5: להחזיר הלוואה, או לקנות עוד נכס?

- id `dec-005` · modes: family + full · concept: `interest` + `passive_income`
- Requires: a bank loan with principal ≥ ₪40,000 (otherwise the card is skipped and the next card is drawn).
- Title: **"₪40,000 ושתי דרכים"**
- Text: "יש לכם ₪40,000 פנויים. אפשר להחזיר חלק מההלוואה מהבנק, או לקנות עגלת פופקורן ליד בית ספר."

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "מחזירים ₪40,000 לבנק" | cash −40,000; loan −40,000 (payment −₪400/month) | +₪400 (lower expenses) | cash ≥ 40,000 AND a bank loan ≥ 40,000 |
| B | "קונים את העגלה" | cash −40,000; passive +900; asset `{ type: "business", category: "snack-cart", price: 80000, downPayment: 40000, mortgage: 40000, monthlyCashFlow: 900, profit: 1600, loanPayment: 700 }` (= `opp-biz-006`) | +₪900 | cash ≥ 40,000 |
| C | "שומרים את הכסף בצד" | none | ₪0 | always |

- Fox A: "₪400 פחות הוצאות בכל חודש, וזה בטוח: החוב קטן."
- Fox B: "₪900 בחודש מהעגלה. במשחק הסכום קבוע; בעולם האמיתי עסק יכול להרוויח גם פחות."
- Fox C: "כסף בצד שומר עליכם מהפתעות, אבל הוא לא מכניס."
- **מה זה מלמד:** להחזיר הלוואה זה כמו "רווח בטוח" בגובה התשלום שנחסך (כאן ₪400 בחודש). נכס יכול להכניס יותר (₪900), אבל בעולם האמיתי יש בו סיכון. במשחק B מקרב לניצחון יותר מהר, ו-A מקטין את הסיכון למינוס.

## Card 6: שותפות, או לבד?

- id `dec-006` · modes: family + full · concept: `diversification` (family: "לא לשים הכול במקום אחד")
- Title: **"משאית הגלידה מחפשת שותף"**
- Text: "חברה ותיקה מציעה לקנות איתכם את משאית הגלידה, חצי-חצי. אפשר גם לקנות לבד."

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "קונים לבד" | cash −120,000; passive +2,300; asset `{ type: "business", category: "snack-cart", price: 240000, downPayment: 120000, mortgage: 120000, monthlyCashFlow: 2300, profit: 4400, loanPayment: 2100 }` (= `opp-biz-003`) | +₪2,300 | cash ≥ 120,000 |
| B | "קונים בשותפות, חצי" | cash −60,000; passive +1,150; asset `{ type: "business", category: "snack-cart", price: 120000, downPayment: 60000, mortgage: 60000, monthlyCashFlow: 1150, profit: 2200, loanPayment: 1050, share: 0.5 }` | +₪1,150 | cash ≥ 60,000 |
| C | "מוותרים" | none | ₪0 | always |

Check for B: half of every number of `opp-biz-003`: 2,200 − 1,050 = 1,150.

- Fox A: "₪2,300 בחודש, כולם שלכם, וגם כל הסיכון."
- Fox B: "חצי מהכסף, ₪60,000, וחצי מהרווח, ₪1,150 בחודש. ונשארו לכם ₪60,000 לדבר הבא."
- Fox C: "בסדר גמור. לא כל עסקה מתאימה לכל רגע."
- **מה זה מלמד:** בשותפות משקיעים פחות ומקבלים פחות, ונשאר כסף לנכס נוסף או לכסף בצד. בעולם האמיתי שותפות דורשת גם הסכם ברור.
- Developer note: `share` is a new optional display field (the card can say "חצי שלכם"). If selling a half-owned asset in full mode is out of scope, `saleValue` already works on the halved numbers.

## Card 7: מניה יציבה, תנודתית, או גם וגם?

- id `dec-007` · modes: **full only** (stocks) · concept: `diversification` + `dividend`
- Title: **"₪30,000 לבורסה"**
- Text: "יש לכם ₪30,000 להשקיע במניות. מי-אביב יציבה ומשלמת דיבידנד נאה. שמש-נגב קופצת למעלה ולמטה."

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "100 מניות מי-אביב" | cash −30,000; buy MAV qty 100 at ₪300; passive +200 (100 × ₪2) | +₪200 | cash ≥ 30,000 |
| B | "30 מניות שמש-נגב" | cash −30,000; buy SOL qty 30 at ₪1,000; passive +90 (30 × ₪3) | +₪90 | cash ≥ 30,000 |
| C | "חצי-חצי" | cash −30,000; MAV qty 50 (₪15,000, +₪100) + SOL qty 15 (₪15,000, +₪45) | +₪145 | cash ≥ 30,000 |

Price ranges in the current market cards: MAV ₪270 to ₪330 (`mkt-007`, `mkt-017`); SOL ₪500 to ₪1,700 (`mkt-016`, `mkt-008`). So 30 SOL can be worth ₪15,000 to ₪51,000. 100 MAV can be worth ₪27,000 to ₪33,000.

- Fox A: "₪200 בחודש מדיבידנד, ומחיר שזז מעט. דיבידנד במשחק קבוע; בעולם האמיתי הוא לא מובטח."
- Fox B: "₪90 בחודש, והמחיר יכול לקפוץ מ-₪500 עד ₪1,700 למניה. מתאים רק למי שמוכן לירידות."
- Fox C: "חצי פה וחצי שם: ₪145 בחודש, וירידה של מניה אחת לא פוגעת בכל הכסף."
- **מה זה מלמד:** תנודתיות ופיזור. מניה שמשלמת יותר דיבידנד היא לא בהכרח "טובה יותר", ומניה תנודתית יכולה גם לרדת.

## Card 8: מקדמה גדולה, או קטנה?

- id `dec-008` · modes: family + full · concept: `down_payment` + `yield` (family: "התשלום הראשון")
- Title: **"שני חדרים באשדוד, שתי דרכים לשלם"**
- Text (full): "אותה דירה, ₪2,000,000. הבנק מוכן למקדמה של ₪200,000 או של ₪400,000. מקדמה גדולה יותר = משכנתא קטנה יותר."
- Text (family): "אותה דירה, ₪2,000,000. אפשר לשלם בהתחלה ₪200,000 או ₪400,000. ככל שמשלמים יותר בהתחלה, התשלום החודשי לבנק קטן יותר."

| option | label (full / family) | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "מקדמה קטנה" / "תשלום ראשון קטן" | cash −200,000; passive +3,800; asset `{ type: "apartment", category: "apartment", price: 2000000, downPayment: 200000, mortgage: 1800000, rent: 13700, loanPayment: 9900, monthlyCashFlow: 3800 }` (= `opp-apt-014`) | +₪3,800 | cash ≥ 200,000 |
| B | "מקדמה גדולה" / "תשלום ראשון גדול" | cash −400,000; passive +4,900; asset `{ ..., downPayment: 400000, mortgage: 1600000, rent: 13700, loanPayment: 8800, monthlyCashFlow: 4900 }` | +₪4,900 | cash ≥ 400,000 |

Checks: 1,600,000 × 0.0055 = 8,800; 13,700 − 8,800 = 4,900. Yield on the down payment: A 3,800 × 12 / 200,000 = 22.8%; B 4,900 × 12 / 400,000 = 14.7%. Payback: A 200,000 / 45,600 = 4.4 years; B 400,000 / 58,800 = 6.8 years. Both green with the current thresholds.

- Fox A (full): "₪3,800 בחודש, תשואה של 22.8% על המקדמה, ונשארו לכם ₪200,000 לדבר הבא."
- Fox A (family): "₪3,800 בחודש, והכסף חוזר תוך 4.4 שנים. ונשארו לכם ₪200,000."
- Fox B (full): "₪4,900 בחודש, ₪1,100 יותר, אבל התשואה על המקדמה ירדה ל-14.7%, ו-₪200,000 נוספים תקועים בדירה."
- Fox B (family): "₪4,900 בחודש, ₪1,100 יותר. אבל הכסף חוזר רק תוך 6.8 שנים."
- **מה זה מלמד:** תשלום ראשון גדול מקטין את ההלוואה ומגדיל את מה שנשאר בחודש, אבל כל שקל נוסף בדירה מרוויח פחות באחוזים, ולא זמין לעסקה הבאה.

## Card 9: מרכז, או פריפריה?

- id `dec-009` · modes: full (family uses the variant below) · concept: `yield` + `cushion`
- Title: **"רמת גן או קריית שמונה?"**
- Text: "שתי דירות על השולחן. ברמת גן: ₪2,400,000. בקריית שמונה: ₪1,400,000. ההבדל הגדול הוא לא רק המחיר."

| option | label | engine effect | net monthly | available if |
|---|---|---|---|---|
| A | "רמת גן" | cash −240,000; passive +4,300; asset = `opp-apt-016` (price 2,400,000, down 240,000, mortgage 2,160,000, rent 16,200, loanPayment 11,900, cf 4,300) | +₪4,300 | cash ≥ 240,000 |
| B | "קריית שמונה" | cash −140,000; passive +2,600; asset = `opp-apt-004` (price 1,400,000, down 140,000, mortgage 1,260,000, rent 9,500, loanPayment 6,900, cf 2,600) | +₪2,600 | cash ≥ 140,000 |
| C | "אף אחת" | none | ₪0 | always |

Checks: yield A 51,600 / 240,000 = 21.5%, B 31,200 / 140,000 = 22.3%. Payback A 4.7 years (4.65), B 4.5 years (4.49).

- Fox A: "₪4,300 בחודש, 21.5% בשנה על המקדמה."
- Fox B: "₪2,600 בחודש, אבל 22.3% בשנה על המקדמה, ונשארו לכם ₪100,000 יותר בצד."
- Fox C: "אין חובה לקנות. ההזדמנות הבאה תגיע."
- **מה זה מלמד:** משווים עסקאות באחוזים, לא רק בשקלים. בעולם האמיתי לדירה בפריפריה יש גם סיכון של חודשים בלי שוכר (ראו `rw-periphery`).
- Family variant: replace A with `opp-apt-014` (Ashdod: down 200,000, cf 3,800, 22.8%, payback 4.4), because `opp-apt-016` is full only. Then the lesson becomes "the cheaper one leaves ₪60,000 more aside". Family fox lines must say "התשלום הראשון" instead of "מקדמה" and drop the percentages.

---

## Open points for the CEO / developer / finance

1. Card 2 B is a little worse inside the game (₪300 a month) because the engine has no vacancy. Either accept "flexibility" as its only in-game value (as written), or let a future market event hit one apartment.
2. Card 5 favours B inside the game (the cart never fails). Finance: check that this does not turn into an always-correct answer in the simulation. If it does, raise A's appeal (for example, show the yearly saving: ₪400 × 12 = ₪4,800).
3. Card 3 C chains two existing actions (`acceptOffer` + `repayLoan`). One undo step or two?
4. Decision cards are a new deck. Board squares, frequency and bot behaviour are for the developer and finance, and so is a re-run of the 100-game simulation (target 15 to 25 turns, docs/decisions.md for v4 pace).
5. All the money numbers were checked by hand only. A test should recompute each `asset` block from the formulas above (as `tests/glossary-examples.test.js` does for the glossary).
