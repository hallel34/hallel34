# Passivo v3, Phase 4: fixing "החזר השקעה" (payback period vs ROI)

Date: 2026-10-22. Owner: financial-education specialist. Code is wired by the developer.

Validation status: no shell was available in this session, so `node` was NOT run. All JSON edits were made as exact string replacements inside existing valid structures and all numbers below were computed by hand. The developer must run `JSON.parse` on `src/data/learn/*.json` and the test in section 5 before merge.

## 0. The problem and the fix

- The game's metric `paybackYears = downPayment / (monthlyCashFlow x 12)` is a TIME. Its correct name is **תקופת החזר** (payback period).
- **החזר השקעה** (ROI) is a PERCENTAGE: `monthlyCashFlow x 12 / downPayment`. In the game this is `dealMetrics().yieldPct` (the number the reveal tile calls "תשואה בשנה").
- One number, two views: `payback years = 100 / roi%` (true in the game because the cash flow is assumed constant). Popcorn cart: 27% a year = 3.7 years.

Worked numbers (hand-computed from `src/data/cards.he.json`, 2026-10-22):

| card | down payment | monthly cash flow | yearly | ROI | payback |
|---|---|---|---|---|---|
| opp-biz-006 עגלת פופקורן | 40,000 | 900 | 10,800 | 27% (0.27) | 3.7 (3.7037) |
| opp-apt-008 קומה תשיעית | 320,000 | 900 | 10,800 | 3.4% (3.375) | 29.6 (29.63) |

## 1. Glossary changes (`src/data/learn/glossary.he.json`, version 3)

- `payback`: term "החזר השקעה" -> **"תקופת החזר"**. New fields: `formula` ("מקדמה ÷ תזרים שנתי (תזרים חודשי × 12)"; family: "התשלום הראשון ÷ מה שנשאר בשנה"), `link`, `related`. Examples recomputed (3.7 and 29.6 years), game simplification now also says the traffic-light colours are a game rule of thumb (slots `{okYears}`, `{slowYears}`).
- NEW `roi`: term "החזר השקעה", order 9, level `family`, with a `family` block (`kidName` "כמה אחוזים הכסף מרוויח בשנה"). Formula "תזרים שנתי ÷ מקדמה" (family: "מה שנשאר בשנה ÷ התשלום הראשון"). Example popcorn 27%, plus the apartment at 3.4% for contrast. Game simplification: computed on the down payment only, loan payment already subtracted as if it were all expense, constant cash flow. Link line: "תקופת החזר ואחוז תשואה הם שתי דרכים להסתכל על אותו מספר: 27% בשנה = כ-3.7 שנים." (family wording has no adult terms).
- `order` renumbered: interest 10, dividend 11, cushion 12, net_worth 13, diversification 14.
- Concept counts: **full 14, family 11** (was 13 and 10). Do not hard-code; read from `level`.
- New optional fields the UI may use: `formula`, `link`, `related` (array of ids), `unlockWith` (roi is unlocked together with `yield`), `sameNumberAs` (internal note).
- New `ui` labels: `formulaLabel` "הנוסחה", `relatedLabel` "קשור" (see section 3).

## 2. `src/i18n/he.json` strings the developer must change

| key | old | new (full / adult) | new (family override in tutorial.he.json familyStrings, unchanged) |
|---|---|---|---|
| `card.payback` | `[[term:payback\|החזר]]: {years}` | `[[term:payback\|תקופת החזר]]: {years}` | `[[term:payback\|הכסף חוזר]] תוך {years}` |
| `card.paybackNever` | `[[term:payback\|החזר]]: אף פעם` | `[[term:payback\|תקופת החזר]]: אף פעם` | `[[term:payback\|הכסף חוזר]]: אף פעם` |

Everything else in `he.json` that contains "החזר" is about loan repayment, not payback, and must NOT change: `card.profitLine` ("החזר הלוואה"), `loan.repayTitle`, `loan.repayText`, `loan.repayAmount`, `loan.remaining`. `fox.tip4` ("נכס טוב מחזיר את המקדמה תוך כמה שנים") is a correct time statement and stays. `ui.years` plural helper stays. There are no guess/hint strings in `he.json`; they all live in `guess.he.json` (section 3).

The tutorial doc `src/data/learn/tutorial.he.json` `familyStrings.overrides[].was` was updated to the new `was` values above so the "was" check stays in sync.

## 3. Strings that live in the learn JSON (already changed here; the code just reads them)

### 3.1 Dictionary UI labels (`glossary.he.json` `ui`)

Existing, unchanged: `explainTitle` "פסיבו מסביר", `dictionaryTitle` "המילון של פסיבו", `dictionaryEmpty`, `whyLabel` "למה זה חשוב", `exampleLabel` "דוגמה מהמשחק", `simplificationLabel` "במשחק זה מפושט", `realWorldLabel` "בעולם האמיתי", `gotIt`, `newTerm`, `lockedTerm`.
New: `formulaLabel` "הנוסחה", `relatedLabel` "קשור". The dictionary sheet for `payback` and `roi` should show: term, short, formula, example, link line, simplification. In family mode the sheet title is `kidName` with "המילה המקצועית: {term}" underneath (existing rule), so family sees "תוך כמה שנים הכסף חוזר / המילה המקצועית: תקופת החזר" and "כמה אחוזים הכסף מרוויח בשנה / המילה המקצועית: החזר השקעה". Decision needed, see open question 1: whether the professional word is shown to children at all (the round 11/12 rule said family never shows `term` outside the dictionary subtitle).

### 3.2 `guess.he.json` (full mode; family has its own)

| key | old | new |
|---|---|---|
| `prompt.hint` | אפשר להשוות לפי כמה שנים לוקח עד שהמקדמה חוזרת | אפשר להשוות לפי תקופת ההחזר: כמה שנים לוקח עד שהמקדמה חוזרת |
| `reveal.paybackLabel` | החזר השקעה | תקופת החזר |
| `reveal.paybackNever` | אין החזר | הכסף לא חוזר |
| `reveal.note` | במשחק התשואה והחזר ההשקעה מחושבים לפי המקדמה, והחישוב מניח שהתזרים נשאר קבוע. | במשחק התשואה (החזר ההשקעה) ותקופת ההחזר מחושבות לפי המקדמה בלבד, והחישוב מניח שהתזרים נשאר קבוע. צבעי הרמזור הם כלל אצבע של המשחק. |
| `lights.green.label` / `a11y` | החזר מהיר | תקופת החזר קצרה |
| `lights.yellow.label` / `a11y` | החזר בינוני | תקופת החזר בינונית |
| `lights.red.label` / `a11y` / `legend` | החזר איטי או אין החזר / ההחזר ארוך מ-{slowYears} | תקופת החזר ארוכה או שהכסף לא חוזר / תקופת ההחזר ארוכה מ-{slowYears} |
| `verdict.green[1..2]`, `yellow[1..2]`, `red[0..2]`, `redNever[0,2]` | "החזר תוך", "החזר מהיר", "ההחזר ארוך מאוד", "אין החזר" | "תקופת ההחזר ...", "תקופת החזר קצרה/בינונית/ארוכה", "אין תקופת החזר" |
| `guessResult.wrong[2]` | בדקו את שנות ההחזר | בדקו את תקופת ההחזר |
| `investorEye.description` | לפי התשואה ושנות ההחזר | לפי התשואה ותקופת ההחזר |

Family additions (new): `family.lights.{green,yellow,red}.label` and `.a11y` ("הכסף חוזר מהר", "הכסף חוזר בינוני", "הכסף חוזר לאט או לא חוזר"), and `family.guessResult.wrong` (third line: "בדקו תוך כמה שנים הכסף חוזר"). They are needed because family inherits the full labels by deep merge, and the full labels now contain the adult term "תקופת החזר". Deep merge must REPLACE arrays (as it already must for `verdict`).

### 3.3 `feedback.he.json`

Full/adult lines now say "תקופת החזר ..." instead of "החזר ...": `buy.good.full[1,2]`, `buy.ok.full[0,2]`, `buy.bad.full[0,1,2]`, `pass.goodDeal.all[0]`, `pass.neutral.all[0,2]`, `pass.bad.all[0]`, `win.fastPayback.all[0,1]`, `lose.full[1]`. Family lines now say "הכסף חוזר ..." : `buy.ok.family[1]`, `buy.bad.family[0,2]`, `pass.bad.family[0]`. NEW group `pass.neutral.family` (before, family fell back to `all`, which now has an adult term). Slot docs for `{years}` and `{yield}` updated.

### 3.4 `report.he.json`

`sections.bestDeal.template`, `stocksOnly`, `worstDeal.templateSlow`, `greenDecisions.noneGreen`, `nextStep.tips.manyRed`, `nextStep.tips.fallback` now say "תקופת החזר". Family: new override `family.sections.greenDecisions.noneGreen`, and `family.sections.concepts.names.roi`. Counts note: `{all}` = 14 full, 11 family (read from glossary, never typed).

### 3.5 `tutorial.he.json`, `real-world.he.json`

`kidNames.concepts`: payback term -> "תקופת החזר"; NEW roi entry. `h-card.example.sampleText` step 3: "3. החזר: 3.7 שנים." -> "3. הכסף חוזר: 3.7 שנים." (it contradicted the step text). Real world: `rw-pressure.real` "והחזר השקעה" -> "ותקופת החזר"; "ההחזר על ההלוואה" -> "התשלום על ההלוואה" next to payback years (rw-franchise, rw-startup, rw-subscriptions) to avoid mixing with the new term; rw-periphery and rw-pressure now say 8.1% / 6.1% are "ממחיר הדירה" (see review finding F1).

## 4. Where the UI picks which concept (for the developer)

- Reveal tile "תשואה בשנה" -> `yield` (unchanged). Tile "תקופת החזר" -> `payback`. `roi` has no tile: it is listed in the dictionary and is unlocked together with `yield` (field `unlockWith`). If you prefer a separate unlock, add `roi` to `triggers.js` case `reveal` (currently `['yield','payback']`).
- `[[term:payback|...]]` link texts now must read "תקופת החזר" (adult) or "הכסף חוזר" (family). Nothing should link to `payback` with the text "החזר השקעה".
- Family forbidden-word scan (round 11/12 list) must now also include `תקופת החזר` (and `החזר השקעה`, already there).

## 5. Spec for the engine test: "every glossary example number is recomputed from card/profession data"

Put the test next to the other learn tests; read `cards.he.json`, `professions.he.json`, `config.js`, `selectors.js` (use `paybackYears`, `loanTerms`; do not re-implement). Rounding: `round1(x) = Math.round(x*10)/10`. For every concept with `example.computed`, assert each field below. Where the glossary has a `computed` block, the test should iterate that block and compare, so a card edit breaks the test instead of silently drifting.

| example id | cards / professions | formulas asserted (computed field = formula) |
|---|---|---|
| cashflow | profession `teacher` | `salary`; `expenses` (itemized, excluding debt payments); `debtPayments` = sum of the profession's debt payments (360+150); `cashFlow = salary - expenses - debtPayments`; `perSummary = cashFlow x PAYDAY_MONTHS` |
| passive_income | `opp-biz-007` | `profit`; `loanPayment`; `cashFlow = profit - loanPayment = card.monthlyCashFlow` |
| asset | `opp-apt-004` | `rent`; `loanPayment`; `cashFlow = rent - loanPayment = card.monthlyCashFlow` |
| liability | `teacher` | `carPrincipal`, `carPayment`, `cardPrincipal`, `cardPayment`; `totalDebt` = sum of principals; `totalPayment` = sum of payments |
| down_payment | `opp-apt-003` | `price`, `downPayment`, `mortgage = price - downPayment`, `downPaymentSharePct = round(downPayment/price x 100)` (10) |
| mortgage | `opp-apt-001` | `price`, `downPayment`, `mortgage`, `loanPayment`, `rent`, `cashFlow = rent - loanPayment` |
| yield | `opp-apt-001` | `yearly = monthlyCashFlow x 12`; `yieldOnDownPaymentPct = round1(yearly/downPayment x 100)` (20.4); `grossRentYieldOnPricePct = round1(rent x 12 / price x 100)` (8.1) |
| **payback** | `opp-biz-006`, `opp-apt-008` | for each: `yearly = monthlyCashFlow x 12` (10,800); `paybackYears = round1(paybackYears(downPayment, monthlyCashFlow))` (3.7; 29.6). Also assert the text contains the formatted `downPayment`, `yearly` and `paybackYears` values (formatted the same way as the UI plural helper) |
| **roi** | `opp-biz-006`, `opp-apt-008` | `roiPct = round1(yearly / downPayment x 100)` equals `dealMetrics(card).yieldPct` rounded (27 -> prints as "27%", 3.375 -> "3.4%"); AND the cross-check `round1(100 / roiPct) == paybackYears` for biz006 (100/27 = 3.70 -> 3.7). For apt008 the cross-check is `round1(100/3.375) = 29.6` (use the unrounded ROI) |
| link line | biz006 | the text "27% בשנה = כ-3.7 שנים" in `payback.link` / `roi.link` matches the two values above; if the card numbers change the test must fail (the sentence is typed, not slotted, so decide: slot it or keep the test as the guard) |
| interest | `loanTerms(5000)` | `monthlyPayment = 50`, `perYear = 600`, `interest = loanTerms.perPayday = 1200`, `total = 6200`, `rateNominalPct = LOAN_PAYMENT_RATE x 12 x 100 = 12`; `perThousand`: 10 / 240 / 1240 |
| dividend | `opp-stk-001..003` | per symbol `price`, `dividend`; MAV: `qty 100`, `cost = qty x price`, `monthly = qty x dividend`, `yearly = monthly x 12`, `dividendPctOfPrice = round1(dividend x 12 / price x 100)` (8) |
| cushion | `exp-002`, `teacher`, `cook` | `expense`; `teacherSavings`; `teacherLeft = savings - expense`; `cookSavings`; `cookShort = expense - cookSavings` |
| net_worth | `teacher` | `savings`, `debts = sum of principals`, `netWorth = savings - debts` (-14,000) |
| diversification | `opp-stk-001`, market card for rainy winter | `ELMprice`; `ELMafterRainyWinter`; `drop = price - after` |
| real-world | all facts with `computed` | rentYear = rent x 12; grossYieldPct = round1(rentYear/price x 100); paybackYears = round1(downPayment/(cashFlow x 12)); cashFlow = rent - loanPayment (or profit - loanPayment); `sharePct`. Facts with paybackYears: rw-periphery (apt-004: 4.5), rw-hard-to-rent (apt-008: 29.6), rw-long-loan (apt-012: 22.2), rw-pressure (apt-013: 32.1, grossYield 6.1), rw-owner-labor (biz-001: 4.9; biz-014: 4.6), rw-subscriptions (biz-015: 7.4), rw-franchise (biz-012: 17.9), rw-startup (biz-013: 20) |

Hand-check of the real-world paybacks against current cards (all agree): apt-004 140,000/31,200 = 4.49; apt-008 320,000/10,800 = 29.63; apt-012 240,000/10,800 = 22.22; apt-013 1,000,000/31,200 = 32.05 (prints 32.1: check the rounding rule rounds half up on the exact value; in floating point 32.0513 is above .05 so it is fine); biz-001 160,000/32,400 = 4.94; biz-014 100,000/21,600 = 4.63; biz-015 400,000/54,000 = 7.41; biz-012 300,000/16,800 = 17.86; biz-013 120,000/6,000 = 20.

Extra checks to add in the same test file:
1. Family-vocabulary scan: every string reachable in family mode (`family` blocks in glossary, guess.family merged over guess, feedback `family` lists and `all` lists used when `family` is missing, report.family merged) must not contain: `תקופת החזר`, `החזר השקעה`, `תשואה`, `תזרים`, `מקדמה`, `ריבית`, `משכנתא`, `הכנסה פסיבית`, `התחייבות`, `כרית`.
2. Every `{slot}` used in a template is documented in that file's `notes.slots`.
3. `PAYBACK_OK_YEARS`/`PAYBACK_SLOW_YEARS` slots in the legend equal the config (8 and 14) and `paybackTier` agrees: biz006 (3.7) is `ok`, apt008 (29.6) is `bad`.
4. No glossary entry has `term` "החזר השקעה" except `roi`; no learn string uses "החזר השקעה" to mean years.

## 6. Review of the other learn texts (factual accuracy w.r.t. the two terms)

- F1 (fixed): `rw-periphery` and `rw-pressure` put "8.1% בשנה" / "6.1% בשנה" and "payback 4.5 / 32.1 years" in one sentence. The percentages are rent over the full price, the years are down payment over cash flow after the loan payment. With ROI now a defined term a reader would compute 100/8.1 = 12 years and see a contradiction. The texts now say "ממחיר הדירה" and mention the cash flow after the loan payment. Also see open question 3.
- F2 (fixed): `tutorial` h-card sample step 3 said "החזר: 3.7 שנים" (adult word, contradicts the family step text "הכסף חוזר").
- F3 (fixed): family would have shown "תקופת החזר" through inherited light labels and the report "noneGreen" line; family overrides were added.
- F4 (fixed): "ההחזר על ההלוואה" (loan payment) next to payback years in three real-world cards could be read as payback; reworded.
- F5 (checked, no change): `yield` (תשואה) texts are correct as the annual percentage on the down payment; `interest`, `loan.*`, `loan.repaid` use "החזר" for repaying a loan, which is a different meaning and correct.
- F6 (checked, no change): `fox.tip4`, `h-card` step 3 ("אחרי כל כך הרבה זמן התשלום הראשון חוזר אליכם") are correct time statements.
- F7 (open): glossary payback says the down payment "returns", but the cash flow already has the loan payment taken off, and in the game the loan principal never shrinks. So "the down payment is back" means "the cumulative cash flow equals the down payment", while the asset and the full debt remain. The `gameSimplification` now says the asset is still yours; it does not say the debt is still there. Suggest finance decide whether to add "וההלוואה נשארת" (it is true in the game).
- F8 (open): the traffic-light thresholds (8 and 14 years) come from `config.js` and are game rules of thumb, not real standards. The simplification text says so. No real-world claim is made about what a "good" payback is; none should be added without a source.
- No numbers were added to `real-world.he.json` `numbers` and nothing was published; the existing `needs_review` flags for finance stand. The new `roi` and `payback` entries carry their own `needs_review`.

## 7. Open questions

1. Duplicate concept in family mode: `yield` ("כמה הנכס מכניס בשנה") and `roi` ("כמה אחוזים הכסף מרוויח בשנה") describe the same number and have near-identical child names. I followed the instruction (roi level family, kid name as given). Recommendation: either merge them for children (roi level `full` only, family keeps `yield`), or keep both but show roi only as an alias line under `yield`. If merged, the family count goes back to 10.
2. Should `roi` replace `yield` in the full-mode reveal tile ("החזר השקעה בשנה" instead of "תשואה בשנה")? I kept "תשואה" because the real-world rental-yield cards (rw-rental-yield, rw-periphery) are about "תשואה" and their `numbers` are pending finance.
3. Finance: confirm Hebrew terminology: "החזר השקעה" for ROI and "תקופת החזר" for payback period, and that using ROI for a yearly percentage on the down payment only (with the loan payment as an expense) is acceptable as a labelled simplification. In real finance ROI on a leveraged purchase is often computed on equity and includes price changes; the text says the game ignores these.
4. The sentence "27% בשנה = כ-3.7 שנים" is typed in the glossary (2 places x 2 modes). If Phase 3 economy changes card numbers, either slot it (`{roiPct}`, `{years}`) or rely on the test above. Recommend slots filled from the same card the example uses.
5. The tutorial `h-card` step 3 and `card.payback` family wording ("הכסף חוזר תוך {years}") are unchanged; the family badge still never shows ROI. Confirm that children should not see a percentage on the card itself.
6. No `quests.he.json` exists in `src/data/learn/`. If quests are produced in a later phase, quest quizzes must use "תקופת החזר" for years and "החזר השקעה" for percent.
