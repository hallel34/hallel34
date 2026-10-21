# Learning layer, phase 1 (P0): implementation spec

Owner of content: `educator`. Consumer: `developer`. All text is Hebrew, age 9+, plural/gender-neutral. Files live in `src/data/learn/`. Nothing here changes engine rules; the engine only needs the small stats additions listed at the end.

## 1. Files and schemas

| File | Purpose | Top-level shape |
|---|---|---|
| `glossary.he.json` | L1: 13 concepts and dictionary UI strings | `{ version, ui{}, concepts[] }` |
| `feedback.he.json` | L3: fox one-liners | `{ version, notes, lines{ "<group>": { family?, full?, all? : string[] } } }` |
| `report.he.json` | L4: "מה למדתי" report | `{ version, title, subtitle{win,lose}, sections{}, nextStep{tips{}}, conversation{ family{theme}, full{theme} } }` |
| `guess.he.json` | L2: "עסקה טובה?" | `{ version, prompt{}, reveal{}, lights{}, verdict{}, guessResult{}, investorEye{}, stockNote }` |

Concept object: `{ id, order, term, level: "family"|"full", short, why, example{ cardId|professionId, text }, gameSimplification: string|null, needs_review: string|null }`.
`level` = the first mode where the concept can appear. Family mode shows 10 concepts, full mode 13 (dividend, net_worth, diversification are full only).

Template slots use `{name}`, same as `src/i18n`. Slots are formatted by the UI before substitution (the `notes.slots` block in each file lists them). Money slots already include the currency sign; `{yield}`, `{rate}`, `{over}` include `%`; `{years}` is a full phrase with unit from a plural helper (`שנה אחת`, `שנתיים`, `4.2 שנים`), so the texts never say `ב-{years}`.
Do not add rates or thresholds to the JSON. `{rate}`, `{okYears}`, `{slowYears}` come from config.

Loading: import the four JSON files through `src/data/index.js` (validated like cards: unknown slot names or missing groups fail the build). Add a `src/i18n`-style `lt(key, vars)` helper or reuse `t`. If the locale changes later, files become `*.en.json` with the same ids.

## 2. Feedback lines (L3): trigger to text

Show one line (fox bubble, 3-4 s, tap to dismiss, also in the event log) right after the decision resolves. Pick a random line from `lines[group][mode]`, falling back to `[group].all`, then `[group].family`; never repeat the previous line of the same group.

Deal rating (shared by buy.*, pass.*, guess):
- `cf <= 0` -> **trap**
- `years <= PAYBACK_OK_YEARS` -> **good** (green)
- `years <= PAYBACK_SLOW_YEARS` -> **ok** (yellow)
- else -> **bad** (red). This is exactly `paybackTier` in `src/engine/selectors.js` (`ok`, `slow`, `bad`) plus the trap case.
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
| Loan taken (sensible or costly, see rule) | `loan.sensible` / `loan.costly` | amount, monthlyPayment, rate, total |
| Loan repaid (full) | `loan.repaid` | amount, saved |
| Expense paid fully from cash | `expense.cushion` | amount, cashLeft |
| Expense needed a loan | `expense.loan` | amount, monthlyPayment, rate, total |
| Expense forced a sale (only if the engine offers sell-to-pay; otherwise unused) | `expense.forcedSale` | amount |
| Charity donated / declined | `charity.donate` / `charity.skip` | amount |
| Baby | `baby` (`baby.max` when kids already at MAX_KIDS) | amount |
| Market: sold at offer / kept | `market.sold` / `market.kept` | title, amount, over / monthly |
| Market: stock price up/down | `market.priceUp` / `market.priceDown` | symbol, price |
| Market: cash event > 0 / < 0 | `market.cashGood` / `market.cashBad` | amount |
| Win / Game over | `win` / `lose` | passive, expenses |

Loan rule (named parameters in config, tune with finance): `LOAN_COSTLY_PAYMENT_SHARE` = 0.5. A loan is **costly** if after taking it the new monthly payment is more than this share of the player's positive cash flow before the loan, or if cash flow turns negative, or if it funds a trap or bad-tier purchase. Otherwise **sensible**. In family mode do not show `{rate}` lines (use the family lists). `{total}` = total repaid until the loan is paid off, the same number the loan window shows (N1).

Fox reaction crop: good/cushion/win -> `celebrate`, ok/pass.* -> `think`, bad/trap/costly/lose -> `worried`, market -> `ponder` (see `src/ui/fox-rules.js`). Never use red-shaming visuals for the player; the red state is on the deal, not on them.

## 3. Glossary and first-time concept triggers (L1)

Marking in UI strings: `[[term:id|display]]`, e.g. `"נכס שמכניס [[term:yield|תשואה]] טובה"`. The renderer turns it into a dashed-underline button (`<button class="term" data-term="yield">`, min 48px tap area via padding/pseudo-element, `aria-haspopup="dialog"`). If the id is unknown, render the plain display text and log in dev. The display part is optional: `[[term:yield]]` renders the glossary `term`. Mark a term only on its first occurrence per screen. Tapping opens "פסיבו מסביר" (fox `tip` pose, term, `short`, `why`, example, and the `gameSimplification` block labelled "במשחק זה מפושט" only if present). Same sheet opens from the menu as "המילון של פסיבו" (list of all concepts of the current mode; unseen ones are locked with `lockedTerm`).

Auto-explain (once per concept per device, stored in `localStorage` key `passivo.learn.seen`, plus the set recorded in the game state for the report). Show at most one explainer per turn, queued after the decision feedback, never over a decision sheet. Family mode explains all family concepts, in this order of first trigger:

| Concept | First trigger |
|---|---|
| cashflow | first time the statement is opened or first payday |
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

Unlocking for the report: a concept counts as unlocked when its explainer was shown or its dictionary entry opened.
Auto-explain can be turned off in settings (dictionary stays).

## 4. "עסקה טובה?" flow (L2)

Family mode: ON, always shown on opportunity cards of type apartment/business, before the numbers. Full mode: shown by default for the first game only, with a settings toggle (`prompt.optOutLabel`). Flow:
1. Card shows title + story only. Buttons `prompt.good`, `prompt.bad`, and a quiet `prompt.reveal` (skip).
2. Reveal the numbers and a traffic light (`lights.*.label` plus an icon shape per color, never color only; `a11y` text for screen readers): annual yield, payback years, down payment, monthly cash flow.
3. Verdict line from `verdict.<light>` (random of 3). For cash flow <= 0 use `verdict.redNever` (no yield or years slots) and `reveal.paybackNever`.
4. Result line from `guessResult`: `correct` (green + "good", or red + "bad"), `wrong`, `yellowAny` (yellow: either answer is fine, streak unchanged), `skipped`.
5. Then the normal buy / pass buttons. The buy/pass feedback line (section 2) follows after the decision.
6. Stocks (full mode only): same flow with `years = price / (dividend * 12)` and `yield = dividend * 12 / price`; always add `stockNote` under the verdict. Note: with the current card numbers MAV and ELM land in yellow and SOL in red, which treats the stock risk by yield only. Open question for CEO and finance (see needs_review below).

"עין של משקיע" badge: streak of correct guesses on green/red cards (skips and yellow do not change the streak; a wrong guess resets it). `INVESTOR_EYE_STREAK` = 3. Show `investorEye.progress` as a small chip, `earned` once as a celebration with the fox. Persist in `localStorage` (key `passivo.learn.badges`). `endOfGame` line goes into the report.

## 5. Traffic-light thresholds (named parameters)

Never hard-code numbers in text. All come from `src/engine/config.js`:

| Parameter | Current | Meaning |
|---|---|---|
| `PAYBACK_OK_YEARS` | 8 | green if years <= this |
| `PAYBACK_SLOW_YEARS` | 14 | yellow if years <= this; red above |
| `INVESTOR_EYE_STREAK` (new) | 3 | badge goal |
| `LOAN_COSTLY_PAYMENT_SHARE` (new) | 0.5 | loan rating |

The CEO will update the first two after finance's review in `docs/v2/numbers-proposal.md`. All lights, legends and verdicts read these parameters at runtime, with `okYears`/`slowYears` formatted through the same plural helper as `years`. Required test: changing the config values changes the legend text and the light for a fixed card, with no text edits.

## 6. Report (L4)

Shown on the win and game-over screens, below the existing stats, as an expandable "מה למדתי" card (collapsed by default on game-over to avoid shaming; the title line is neutral). Sections in this order:
1. `bestDeal` and `worstDeal`: among purchased apartments/businesses/stocks; best = shortest payback, worst = longest payback or negative cash flow (`templateNegative`). If only one deal was bought show only `bestDeal`; if the worst is tier good/ok, show `worstDeal.empty`.
2. `interest`: total interest paid. Hidden when the engine does not track it (`hiddenIfUnavailable`). Needs the N1 loan model (see below). `zero` when no loans taken.
3. `greenDecisions`: a decision is green when: buy in tier good; pass on tier bad or trap; an expense paid from cash; a loan rated sensible. A decision is rated when it is one of those or a counterpart (buy ok/bad/trap, pass good, loan costly, expense by loan). Passes on `ok` deals, charity, baby and market events are not rated. `allGreen` when green = total and total > 0; `noneGreen` when green = 0 and total > 0; `noData` when total = 0.
4. `concepts`: unlocked concept terms (names in glossary order), with a button to the dictionary.
5. `nextStep`: one tip. Priority: `highInterest` (interest paid > 15% of total cash spent on loans or more than 2 loans), `noCushion` (an expense needed a loan while cash was below the expense), `manyRed` (>= 2 buys in tier bad/trap), `noDiversify` (full mode, one asset kind and >= 3 assets), `allGood` (green share >= 80%), else `fallback`. The percentages here are tunable defaults, not educational claims.
6. `conversation`: family mode shows the 3 questions of one theme; full mode shows 3 questions from the full pool. Theme choice is in `conversation.rules`. Add a "next question" button for the other themes.

Do not render the report during play. No colored shame states; red only appears on the deal rows.

## 7. Engine and state additions (developer, no rule changes)

Record per game (in the saved state, so resume works): `learn.decisions[]` of `{ turn, kind: "buy"|"pass"|"loan"|"expense", cardId, tier, green: bool|null }`; `learn.interestPaid` (only if N1 defines interest; compute from the loan model: total repaid minus principal for loans closed or accrued so far, otherwise leave `null` and hide the section); `learn.guesses[]` of `{ cardId, light, guess, correct }`; `learn.seenConcepts[]`. Pure helpers (rating, years, yield, report builder) go in `src/engine` or `src/learn` with unit tests.

Checks for QA: every `[[term:id]]` in `he.json` and card data resolves to a glossary id; every slot used in a text is provided by the caller (test per group); all 13 concepts open from the dictionary; every red/trap card produces `verdict.red` or `redNever`; `years`/`yield` equal engine `paybackYears`; no text contains a hard-coded interest rate or threshold; no emoji characters in these files.

## 8. needs_review (for finance)

1. `down_payment`: wording that banks require a larger down payment in real life, especially for an investment property. Kept general (no percentages); confirm against current Bank of Israel rules, with source and date.
2. `yield`: "בדרך כלל כמה אחוזים בשנה" for gross rental yield on an apartment in Israel; confirm range, source and date (links to N2).
3. `interest`: no game rate is stated. After N1 add a concrete example through `{rate}`; check that `loan.*` lines with `{rate}`/`{total}` stay true under the chosen model (in particular what `{total}` means if the loan has no fixed term).
4. `dividend`: the engine treats `dividend` as ILS per share per month (qty * dividend into monthly cash flow). Confirm intent; the text says "2 ₪ למניה בחודש" for MAV.
5. Traffic light for stocks: payback by dividend only makes MAV and ELM yellow and SOL red, ignoring price risk and price gains. Decide whether stocks use the same thresholds or skip the light.
6. `lose`/`win` full lines mention real-world risk in general terms only; no figures to verify.
7. Example arithmetic used in texts (all from current cards/professions): teacher cash flow 8,800 - 6,800 - 600 = 1,400; apt-001 yield 48,000/200,000 = 24%, payback 4.2 years; biz-006 payback 3.3 years; apt-008 payback 26.7 years; teacher net worth 9,000 - 23,000 = -14,000. If cards or professions change in the numbers review, update `glossary.he.json` examples (a QA script comparing the numbers is suggested).
