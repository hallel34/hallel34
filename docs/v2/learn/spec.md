# Learning layer, phase 1 (P0), v2 numbers: implementation spec

Owner of content: `educator`. Consumer: `developer`. All text is Hebrew, age 9+, plural/gender-neutral. Files live in `src/data/learn/`. Nothing here changes engine rules. Updated 2026-10-21 for the v2 numbers (`docs/v2/numbers-proposal.md`, `docs/decisions.md` rows of 2026-10-21).

## 0. What changed in v2 (read first)

| Topic | Before | Now |
|---|---|---|
| Name of the 24-month square | ״יום משכורת״ | **״סיכום שנתיים״** (same as `src/i18n/he.json`). Never use the old name in learn files |
| Loan | 10% a month | **1% a month, interest only** (`LOAN_PAYMENT_RATE = 0.01`), 12% a year nominal (`LOAN_APR_NOMINAL`) |
| Slots `{total}` | total until the loan is paid off | **principal + interest of one summary**, valid only if repaid at that summary (section 2.1) |
| Loan "costly" rule | share of cash flow before the loan | payment vs the **asset's** cash flow (section 2.2) |
| Stocks | payback light by dividend | **no light, no guess** (section 5.1) |
| Real-world facts | none | `real-world.he.json` (section 8) |
| Card numbers | old | rescaled; new `rent` / `profit` / `loanPayment`; examples recomputed (section 9) |

## 1. Files and schemas

| File | Purpose | Top-level shape |
|---|---|---|
| `glossary.he.json` | L1: 13 concepts and dictionary UI strings | `{ version, notes, ui{}, concepts[] }` |
| `feedback.he.json` | L3: fox one-liners | `{ version, notes, lines{ "<group>": { family?, full?, all? : string[] } } }` |
| `report.he.json` | L4: "מה למדתי" report | `{ version, title, subtitle{win,lose}, sections{}, nextStep{tips{}}, conversation{ family{theme}, full{theme} } }` |
| `guess.he.json` | L2: "עסקה טובה?" and the stock explainer | `{ version, prompt{}, reveal{}, lights{}, verdict{}, guessResult{}, investorEye{}, stock{} }` (`stockNote` was replaced by `stock`) |
| `real-world.he.json` | L6: "בעולם האמיתי" fact cards | `{ version, notes, ui{}, facts[] }` |

Concept object: `{ id, order, term, level: "family"|"full", short, why, example{ cardId|professionId, text, computed{}, slotsFrom? }, gameSimplification: string|null, needs_review: string|null }`.
`level` = the first mode where the concept can appear. Family mode shows 10 concepts, full mode 13 (dividend, net_worth, diversification are full only).

Template slots use `{name}`, same as `src/i18n`. Slots are formatted by the UI before substitution (the `notes.slots` block in each file lists them). Money slots already include the currency sign; `{yield}`, `{rate}`, `{over}`, `{monthlyRate}`, `{dividendYield}` include `%`; `{years}` is a full phrase with unit from a plural helper (`שנה אחת`, `שנתיים`, `4.2 שנים`), so the texts never say `ב-{years}`.

Numbers policy: the examples in `glossary.he.json` and the `game` lines in `real-world.he.json` quote card and profession numbers as literals, each with a `computed` block, and `scripts`/QA must compare them to the data (section 9). Rates, loan costs, the summary length (`{months}`) and the traffic-light thresholds are never typed: they come from `src/engine/config.js` through slots. The one deliberate exception is `rw-loan-rate.game`, which states the game rate (1%, 12%, 10/240 per 1,000) as literals next to the real-world comparison, and is covered by the same check.

Loading: import the JSON files through `src/data/index.js` (validated like cards: unknown slot names or missing groups fail the build). `lt(key, vars)` helper or reuse `t`. If the locale changes later, files become `*.en.json` with the same ids.

## 2. Feedback lines (L3): trigger to text

Show one line (fox bubble, 3-4 s, tap to dismiss, also in the event log) right after the decision resolves. Pick a random line from `lines[group][mode]`, falling back to `[group].all`, then `[group].family`; never repeat the previous line of the same group.

Deal rating (shared by buy.*, pass.*, guess; apartments and businesses only, **not stocks**):
- `cf <= 0` -> **trap**
- `paybackTier(years) === 'ok'` (years <= `PAYBACK_OK_YEARS`) -> **good** (green)
- `'slow'` (years <= `PAYBACK_SLOW_YEARS`) -> **ok** (yellow)
- `'bad'` -> **bad** (red). This is exactly `paybackTier` in `src/engine/selectors.js` (engine names `ok`, `slow`, `bad`; feedback groups use good, ok, bad) plus the trap case.
- `years = downPayment / (monthlyCashFlow * 12)`, `yield = monthlyCashFlow * 12 / downPayment`.

| Trigger | Group | Slots |
|---|---|---|
| Buy apartment/business, tier good | `buy.good` | title, years, yield, monthly |
| Buy, tier ok | `buy.ok` | same |
| Buy, tier bad | `buy.bad` | same |
| Buy, cash flow <= 0 | `buy.trap` | title, loss |
| Buy stock | `buy.stock` | qty, symbol, monthly |
| After any buy, if player now owns >= 2 asset kinds (apartment, business, or distinct stock symbols) and `diversify` was not yet shown for this combination | `buy.diversify` | none |
| Pass: deal was good | `pass.goodDeal` | years, yield |
| Pass: deal ok | `pass.neutral` | years |
| Pass: deal bad | `pass.bad` | years, yield |
| Pass: trap | `pass.trap` | loss |
| Pass because cash is short | `pass.cantAfford` | none |
| Loan taken voluntarily or to buy (rated, see 2.2) | `loan.sensible` / `loan.costly` | amount, monthlyPayment, interest, total; rate (full only) |
| Loan repaid (partly or fully; also family) | `loan.repaid` | amount, saved |
| Expense paid fully from cash | `expense.cushion` | amount, cashLeft |
| Expense needed a loan | `expense.loan` | amount (the expense), loanAmount, monthlyPayment, interest, total; rate (full only) |
| Expense forced a sale (only if the engine offers sell-to-pay; otherwise unused) | `expense.forcedSale` | amount |
| Charity donated / declined | `charity.donate` / `charity.skip` | amount |
| Baby | `baby` (`baby.max` when kids already at MAX_KIDS) | amount |
| Market: sold at offer / kept | `market.sold` / `market.kept` | title, amount, over / monthly |
| Market: stock price up/down | `market.priceUp` / `market.priceDown` | symbol, price |
| Market: cash event > 0 / < 0 | `market.cashGood` / `market.cashBad` | amount |
| Win / Game over | `win` / `lose` | passive, expenses |

### 2.1 Loan slot semantics (precise; the developer renders these from `loanTerms(loanAmount)`)

The loan is **interest only**: each month the player pays `LOAN_PAYMENT_RATE` of the principal, and the principal stays owed until the player repays it (partly, in multiples of `LOAN_STEP`). There is no end date. A summary settles `PAYDAY_MONTHS` months at once.

| Slot | Definition | Source in code | Example, loan of 1,000 | Example, loan of 5,000 |
|---|---|---|---|---|
| `{loanAmount}` | principal of this loan (multiple of 1,000). In `expense.loan` it may exceed the expense | player's chosen amount | 1,000 | 5,000 |
| `{amount}` | in `loan.*`: the same as `{loanAmount}`. In `expense.loan` and `expense.cushion`: the **expense**. In `loan.repaid`: the amount just repaid | | | |
| `{rate}` | **nominal** yearly rate = monthly rate x 12, with `%`. Not the effective rate (12.68%). Full-mode lines only | `LOAN_APR_NOMINAL` (`loanTerms.aprNominal`) | 12% | 12% |
| `{monthlyRate}` | monthly rate with `%` (glossary only) | `LOAN_PAYMENT_RATE x 100` | 1% | 1% |
| `{monthlyPayment}` | what this loan adds to the monthly payments (interest only) | `loanTerms.monthly` | 10 ₪ | 50 ₪ |
| `{interest}` | interest charged at each summary while the loan is open = `monthlyPayment x PAYDAY_MONTHS`. Same number as the loan window row "ריבית עד הסיכום הבא" | `loanTerms.perPayday` | 240 ₪ | 1,200 ₪ |
| `{total}` | `loanAmount + interest`. The sum to hand back **only if the loan is repaid at the next summary**: the principal plus one summary of interest. It is not a total until the loan ends. Same number as the loan window row "סך הכול להחזיר" | `loanTerms.totalAtPayday` | 1,240 ₪ | 6,200 ₪ |
| `{saved}` | monthly payment that disappears after a repayment | `loanMonthlyPayment(repaid)` | | |

Rules for text and rendering:
- Every sentence that shows `{total}` must contain "אם תפרעו" or "אם מחזירים" and "בסיכום הקרוב" (already true in the lines). Never describe `{total}` as "the price of the loan" or "total until paid off".
- Per 1,000 ₪: 10 ₪ a month, 120 ₪ a year, 240 ₪ per summary, 1,240 ₪ if repaid at that summary. The player pays the interest through the monthly payments (they reduce cash flow, and the summary settles 24 months of cash flow), so keeping a loan open through a second summary costs another 240 ₪ per 1,000.
- Do not put `{rate}` in family lists (kept so already). Family lines may use `{interest}` and `{total}`.
- Do not say "הלוואה בנקאית אמיתית" or compare to real rates in feedback lines. Comparisons live in `real-world.he.json` (`rw-loan-rate`).

### 2.2 Loan rating: costly or sensible

Named parameter `LOAN_COSTLY_PAYMENT_SHARE = 0.5` in `config.js` (new, tunable with finance; no text mentions the 50%).

Let `P = loanTerms(amount).monthly`.
- **Loan to buy an asset** (apartment/business, with the card's `monthlyCashFlow` = `F`): **costly** if `F <= 0`, or the card is tier `bad`, or `P > LOAN_COSTLY_PAYMENT_SHARE x F`, or `loanPaydayImpact(...).risky`. Otherwise **sensible**. In words: a loan is costly when its monthly payment eats more than half of what the asset brings in.
- **Loan with no asset** (voluntary loan, shortfall): **costly** if `P > LOAN_COSTLY_PAYMENT_SHARE x` (positive cash flow before the loan), or cash flow after is not positive, or `risky`. Otherwise **sensible**.
- `expense.loan` is its own group and is not rated. It is a forced loan, never shown in red.

Worked values (share 0.5, interest-only 1%), so QA can test:

| Case | P | Threshold 0.5 x F | Rating |
|---|---|---|---|
| apt-001 (F = 3,400), borrow the whole down payment 200,000 | 2,000 | 1,700 | costly |
| apt-001, borrow 100,000 | 1,000 | 1,700 | sensible |
| apt-001, largest sensible loan | 1,700 | | 170,000 principal |
| biz-006 (F = 900), borrow the whole down payment 40,000 | 400 | 450 | sensible |
| apt-004 (F = 2,600), borrow the whole down payment 140,000 | 1,400 | 1,300 | costly |
| apt-008 (F = 900), any loan | | | costly (payback 29.6 years, tier bad) |

Largest sensible principal for a purchase = `LOAN_COSTLY_PAYMENT_SHARE x F / LOAN_PAYMENT_RATE` (= 50 x F with the current values). The game also caps total borrowing for purchases at `LOAN_CAP_SALARIES` (12) monthly salaries.

Fox reaction crop: good/cushion/win -> `celebrate`, ok/pass.* -> `think`, bad/trap/costly/lose -> `worried`, market -> `ponder` (see `src/ui/fox-rules.js`). Never use red-shaming visuals for the player; the red state is on the deal, not on them.

## 3. Glossary and first-time concept triggers (L1)

Marking in UI strings: `[[term:id|display]]`, e.g. `"נכס שמכניס [[term:yield|תשואה]] טובה"`. The renderer turns it into a dashed-underline button (`<button class="term" data-term="yield">`, min 48px tap area via padding/pseudo-element, `aria-haspopup="dialog"`). If the id is unknown, render the plain display text and log in dev. The display part is optional: `[[term:yield]]` renders the glossary `term`. Mark a term only on its first occurrence per screen. Tapping opens "פסיבו מסביר" (fox `tip` pose, term, `short`, `why`, example, the `gameSimplification` block labelled "במשחק זה מפושט" only if present, and the matching `real-world.he.json` fact labelled "בעולם האמיתי" if one has `concept` equal to the term and `status` is not hidden). The same sheet opens from the menu as "המילון של פסיבו" (list of all concepts of the current mode; unseen ones are locked with `lockedTerm`).

Glossary slots: `{months}` (`PAYDAY_MONTHS`), `{rate}`, `{monthlyRate}`, `{amount}`, `{monthlyPayment}`, `{interest}`, `{total}`. The `interest` example is rendered from `loanTerms(5000)` (see `example.slotsFrom`); in the sheet show the per-1,000 line too (`computed.perThousand`).

Auto-explain (once per concept per device, stored in `localStorage` key `passivo.learn.seen`, plus the set recorded in the game state for the report). Show at most one explainer per turn, queued after the decision feedback, never over a decision sheet. Family mode explains all family concepts, in this order of first trigger:

| Concept | First trigger |
|---|---|
| cashflow | first time the statement is opened or first summary (״סיכום שנתיים״) |
| passive_income | first opportunity card shown |
| asset | first purchase |
| liability | first time liabilities appear in the statement (game start screen of the profession) |
| down_payment | first opportunity card with a down payment |
| mortgage | first card with a `mortgage` > 0 |
| yield | first reveal in "עסקה טובה?" (or first purchase if guess flow is off) |
| payback | same moment as yield, but the turn after (one concept per turn) |
| cushion | first expense card |
| interest | first loan window |
| dividend (full) | first stock card |
| net_worth (full) | first time the report or statement shows net worth |
| diversification (full) | first time the player owns two kinds of assets, or the first stock price drop |

Unlocking for the report: a concept counts as unlocked when its explainer was shown or its dictionary entry opened. Auto-explain can be turned off in settings (dictionary stays).

### 3.1 How ״סיכום שנתיים״ is explained (game simplification, stated truthfully)

The square settles `PAYDAY_MONTHS` (24) months of cash flow at once: `monthly cash flow x 24`. It is a simplification so a game takes about 20 turns; the real world pays and charges month by month. Where it is explained:
- `glossary.cashflow.gameSimplification`: "במשחק מחשבים תזרים של חודש אחד, ובמשבצת ״סיכום שנתיים״ מסכמים {months} חודשים בבת אחת ... בחיים הכסף נכנס ויוצא כל חודש".
- `real-world.rw-time`: one turn is about a year and a half of life (5 summaries x 24 months per 24 squares = 5 months a square, 3.5 squares a die = 17.5 months); a 20-turn game is about 29 years.
- The label in the app is always ״סיכום שנתיים״; never "יום משכורת" in any learn text.

## 4. "עסקה טובה?" flow (L2)

Family mode: ON, always shown on opportunity cards of type apartment/business, before the numbers. Full mode: shown by default for the first game only, with a settings toggle (`prompt.optOutLabel`). Flow:
1. Card shows title + story only. Buttons `prompt.good`, `prompt.bad`, and a quiet `prompt.reveal` (skip).
2. Reveal the numbers and a traffic light (`lights.*.label` plus an icon shape per color, never color only; `a11y` text for screen readers): annual yield, payback years, down payment, monthly cash flow.
3. Verdict line from `verdict.<light>` (random of 3). For cash flow <= 0 use `verdict.redNever` (no yield or years slots) and `reveal.paybackNever`.
4. Result line from `guessResult`: `correct` (green + "good", or red + "bad"), `wrong`, `yellowAny` (yellow: either answer is fine, streak unchanged), `skipped`.
5. Then the normal buy / pass buttons. The buy/pass feedback line (section 2) follows after the decision.
6. **Stocks do not enter this flow** (section 5.1).

"עין של משקיע" badge: streak of correct guesses on green/red cards (skips and yellow do not change the streak; a wrong guess resets it). `INVESTOR_EYE_STREAK` = 3. Show `investorEye.progress` as a small chip, `earned` once as a celebration with the fox. Persist in `localStorage` (key `passivo.learn.badges`). `endOfGame` line goes into the report.

Current deal ratings, for QA (thresholds 8 and 14 years): apt-001 4.9 years green; apt-003 5.4 green; apt-004 4.5 green; biz-006 3.7 green; biz-007 6.2 green; biz-015 7.4 green; biz-012 17.9 red; apt-012 22.2 red; apt-008 29.6 red; apt-013 32.1 red; apt-009 (cash flow -6,000) trap.

## 5. Traffic-light thresholds (named parameters)

Never hard-code numbers in text. All come from `src/engine/config.js`:

| Parameter | Current | Meaning |
|---|---|---|
| `PAYBACK_OK_YEARS` | 8 | green if years <= this |
| `PAYBACK_SLOW_YEARS` | 14 | yellow if years <= this; red above |
| `INVESTOR_EYE_STREAK` (new) | 3 | badge goal |
| `LOAN_COSTLY_PAYMENT_SHARE` (new) | 0.5 | loan rating (section 2.2) |
| `PAYDAY_MONTHS` | 24 | months settled by one ״סיכום שנתיים״ |
| `LOAN_PAYMENT_RATE` / `LOAN_APR_NOMINAL` | 0.01 / 12 | loan cost slots |

All lights, legends and verdicts read these at runtime, with `okYears`/`slowYears` formatted through the same plural helper as `years`. Required test: changing the config values changes the legend text and the light for a fixed card, with no text edits.

### 5.1 Decision: stocks get no traffic light

Decision (educator, for CEO confirmation): **stocks have no payback traffic light and are not part of the "עסקה טובה?" guess, the investor-eye streak, the green-decision count or the best/worst deal in the report.**

Why: with the current cards, payback by dividend alone gives ELM 500 / (2 x 12) = 20.8 years (red), MAV 300 / 24 = 12.5 years (yellow), SOL 1,000 / 36 = 27.8 years (red). That tells children the stocks are bad deals, which hides what a stock is: its payoff is mostly the price moving, and the price risk is the lesson. A light would be a wrong signal either way. Dividend yield of the game stocks is also not comparable with a rental payback.

What the stock card shows instead (strings in `guess.he.json` under `stock`):
1. Dividend line: "דיבידנד: 2 ₪ למניה בחודש, כלומר 4.8% ממחיר המניה בשנה" (ELM 4.8%, MAV 8%, SOL 3.6%). Label it "דיבידנד", never "תשואה" or "החזר".
2. The volatility sentence from the card text (the cards already say תנודתית / יציבה / אדרנלין) plus `stock.volatility`.
3. `stock.notGuaranteed`: in the game the dividend is fixed, in the real world it is not guaranteed.
4. Link to the glossary entries `dividend` and `diversification`.
Buying a stock gives the `buy.stock` fox line only (not rated). Passing on a stock gives no line. `buy.diversify` still triggers.
If finance later wants a light for stocks it needs a different rule (price risk), not the payback rule.

## 6. Report (L4)

Shown on the win and game-over screens, below the existing stats, as an expandable "מה למדתי" card (collapsed by default on game-over to avoid shaming; the title line is neutral). Sections in this order:
1. `bestDeal` and `worstDeal`: among purchased **apartments and businesses** (stocks excluded); best = shortest payback, worst = longest payback or negative cash flow (`templateNegative`). If only one deal was bought show only `bestDeal`; if the worst is tier good/ok, show `worstDeal.empty`.
2. `interest`: `stats.interestPaid` (exists in v2: bank-loan payments x `PAYDAY_MONTHS` at each summary; starting debts not counted). `zero` when no bank loan was taken. Hide the section only for old saves without the field.
3. `greenDecisions`: a decision is green when: buy of an apartment/business in tier good; pass on tier bad or trap; an expense paid from cash; a loan rated sensible (2.2). A decision is rated when it is one of those or a counterpart (buy ok/bad/trap, pass good, loan costly, expense by loan). Passes on `ok` deals, stock buys and passes, charity, baby and market events are not rated. `allGreen` when green = total and total > 0; `noneGreen` when green = 0 and total > 0; `noData` when total = 0.
4. `concepts`: unlocked concept terms (names in glossary order), with a button to the dictionary.
5. `nextStep`: one tip. Priority: `highInterest` (`interestPaid` greater than one monthly salary of the profession, or more than 2 bank loans taken; tunable defaults, not educational claims), `noCushion` (an expense needed a loan while cash was below the expense), `manyRed` (>= 2 buys in tier bad/trap), `noDiversify` (full mode, one asset kind and >= 3 assets), `allGood` (green share >= 80%), else `fallback`.
6. `conversation`: family mode shows the 3 questions of one theme; full mode shows 3 questions from the full pool. Theme choice is in `conversation.rules`. Add a "next question" button for the other themes.

Do not render the report during play. No colored shame states; red only appears on the deal rows.

## 7. Engine and state additions (developer, no rule changes)

Record per game (in the saved state, so resume works): `learn.decisions[]` of `{ turn, kind: "buy"|"pass"|"loan"|"expense", cardId, tier, green: bool|null }` (stocks: `green: null`); `learn.guesses[]` of `{ cardId, light, guess, correct }`; `learn.seenConcepts[]`. `stats.interestPaid` already exists in the engine. Pure helpers (rating, years, yield, loan rating, report builder) go in `src/engine` or `src/learn` with unit tests. New config constants: `INVESTOR_EYE_STREAK`, `LOAN_COSTLY_PAYMENT_SHARE`.

Checks for QA: every `[[term:id]]` in `he.json` and card data resolves to a glossary id; every slot used in a text is provided by the caller (test per group, including `loanAmount`, `interest`, `monthlyRate`); all 13 concepts open from the dictionary; every red/trap card produces `verdict.red` or `redNever`; `years`/`yield` equal engine `paybackYears`; `{interest}` and `{total}` equal `loanTerms` and the loan window; no text contains a hard-coded interest rate or threshold (except the allowed `rw-loan-rate.game`); no learn text contains "יום משכורת"; no emoji characters; stock cards never get a light, a guess or a rated decision.

## 8. "בעולם האמיתי" set (L6): `real-world.he.json`

One fact per group of the 22 cards flagged `realWorld: true` (apt-001, 004, 007, 008, 009, 011, 012, 013, 016; biz-001, 012, 013, 014, 015; stk-001..003; mkt-001..005) plus two general facts: `rw-loan-rate` (loan window) and `rw-time` (summary square). QA check: every flagged card appears in exactly one fact's `cardIds`.

Fact object: `{ id, cardIds[], appliesTo?, concept, game, real, type: "fact"|"tip", status, computed{}, numbers: null | { publish, text, tag }, sources[], needs_review }`.
- `game` holds the game's figure(s), recomputed from the card. `real` holds what is true in the world. The UI shows them as two labelled blocks, "במשחק" and "בעולם האמיתי" (never merged), after a purchase or when the card is passed, once per fact per game, and inside the dictionary sheet of the `concept`.
- `real` contains only claims that need no number, so it is safe to show now. Any real-world figure sits in `numbers` with `publish: false` and must not be shown until finance flips it to true after finding a primary source with a date.
- `status`: `qualitative` (no figure) or `pending_finance` (a figure is waiting). Sources carry a tag: `source`, `secondary`, `estimate`, `not found`.
- Always show the fixed line `ui.disclaimer` ("הסבר לימודי בלבד, לא ייעוץ השקעות ולא הבטחה לרווח") once on the first fact of a session.

What is and is not claimed (from `docs/v2/numbers-proposal.md`, finance, 2026-10-21, and an educator search the same day):
- Rental yield: the game shows about 8.1% gross on the price; real-world "בדרך כלל כמה אחוזים" is shown without a figure. The estimate 2.5% to 4% (periphery up to about 5%; national about 2.7%, finance's own calculation from 4,919 x 12 / about 2.2M) is **estimate only**, not published.
- Down payment: the investment-apartment 50% comes from an older text of Bank of Israel directive 329; a June 2026 amendment exists and was not read. Not published as a number.
- Loan rates (8.23% average July 2026, secondary source; Bank of Israel 3.25% and prime 4.75% from 1.9.2026; next decision 21.10.2026, result unchecked): held in `numbers`, hidden.
- Franchise royalties 5% to 8%, real dividend yield 2% to 4%, share of small businesses that close early: estimates or unverified, not published (the last one is removed entirely).

## 9. Numbers used in the texts (recomputed 2026-10-21 from the current data)

Source: `src/data/cards.he.json`, `professions.he.json`, `config.js` (tiers 8 and 14 years; mortgage payment 0.55% of the mortgage, business loan 1.75%, both rounded to 100 and display only). Every value is also stored in the `computed` block next to its text; A node check (`verify-learn.mjs`: recompute the figures above from the JSON, compare to `computed`, assert that every `realWorld` card is covered, that no `numbers.publish` is true, that feedback slots are declared, and that "יום משכורת" and emoji are absent) is handed to the developer with the final report; it belongs in `scripts/` and in CI.

| Item | Figures |
|---|---|
| Teacher cash flow | salary 8,800; expenses 900 + 3,500 + 1,300 + 500 + 600 = 6,800; debt payments 360 (car, 2% of 18,000) + 150 (card, 3% of 5,000) = 510; cash flow 8,800 - 6,800 - 510 = **1,490**; per summary 1,490 x 24 = 35,760 |
| Teacher liabilities | 18,000 + 5,000 = 23,000 debt; 510 a month |
| Teacher net worth | 9,000 - 23,000 = **-14,000** (principals unchanged by v2; only the monthly payments changed) |
| Cushion | exp-002 7,500; teacher savings 9,000, left 1,500; cook savings 5,000, short 2,500 |
| apt-001 | price 1,800,000; down payment 200,000; mortgage 1,600,000; rent 12,200 - payment 8,800 = **3,400**; yearly 40,800; yield on down payment **20.4%**; payback **4.9 years**; gross rent on price 146,400 / 1,800,000 = 8.1% |
| biz-006 | down payment 40,000; profit 1,600 - loan 700 = **900**; yearly 10,800; payback **3.7 years** |
| apt-008 (trap-like) | down payment 320,000; rent 16,700 - payment 15,800 = **900**; yearly 10,800; payback **29.6 years** |
| apt-003 | 2,800,000 = 280,000 + 2,520,000 (10%) |
| apt-004 | rent 9,500 - payment 6,900 = 2,600; payback 4.5 years |
| biz-007 | profit 6,200 - loan 3,500 = 2,700 |
| Stocks | ELM 500, 2 a month, 4.8% a year; MAV 300, 2 a month, 8%; SOL 1,000, 3 a month, 3.6%; 100 MAV = 30,000, 200 a month, 2,400 a year; ELM in a rainy winter 500 to 380 (mkt-009) |
| Loan, per 1,000 | 10 a month; 120 a year; 240 per summary (24 months); 1,240 if repaid at that summary; 12% nominal (12.68% effective, not used in text) |
| Loan, 5,000 (glossary example) | 50 a month; 600 a year; 1,200 per summary; 6,200 if repaid at that summary |

If cards, professions or config change, rerun the check and update the texts that fail it.

## 10. needs_review (for finance)

1. `down_payment` and `rw-down-payment`: confirm the current Bank of Israel directive 329 (a June 2026 amendment exists; the 75% / 70% / 50% text found is older and undated). Provide the primary source and the date before `numbers.publish` is set. Source URLs are in the file.
2. `yield` and `rw-rental-yield`: confirm the gross rental yield range in Israel (estimate 2.5% to 4%, periphery to about 5%, national about 2.7% is our own calculation) with a primary source (CBS or Bank of Israel) and a date. The tel-aviv, periphery and hard-to-rent facts also need a citation if used in store or school material.
3. `interest` and `rw-loan-rate`: confirm the average household loan rate (8.23% July 2026, secondary source icf.co.il) and the Bank of Israel rate (3.25% since 1.9.2026; the 21.10.2026 decision was not checked). The glossary and feedback state only the game rate, so they stay true when real rates move. Confirm that calling a 12% rate "higher than usual" is acceptable (only the real-world file implies it, behind `publish: false`).
4. `dividend` and `rw-stock-dividend`: the engine treats `dividend` as ILS per share per month (qty x dividend); confirmed against the current cards (ELM 2, MAV 2, SOL 3). Game yields 4.8%, 8%, 3.6% are above the estimated real 2% to 4%; the texts say the game dividend is fixed and the real one is not, with no real number.
5. Stocks and the traffic light: decision in section 5.1 (no light). CEO to confirm; finance to confirm that "דיבידנד שנתי ממחיר המניה" is acceptable wording.
6. `rw-franchise`: royalty range 5% to 8% unverified. `rw-market-offers`: wording about capital-gains tax (מס שבח) needs the Tax Authority citation. `rw-building-fees`: wording about who pays building fees needs legal confirmation. All `real` texts that carry no number still lack citations for B2B and store material.
7. `lose`/`win` full lines mention real-world risk in general terms only; no figures to verify.
8. Starting debts are modeled as fixed payments that never reduce the principal (`BASE_DEBT_RATES`: car 2%, student 1%, card 3%). The liability text says so and says real installment loans reduce the debt with each payment; please confirm that this is how finance wants it described.
