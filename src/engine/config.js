// Tunable rule constants. Pure data, no DOM.
// 7 (owner idea 2026-10-27): a player may carry `bot` (a BOTS policy name = a seat the device plays itself), and the
// match may carry an `auction` (a passed deal out for bids) / `lastAuction` (its result). Assets may carry
// `renovations` ({ level, style }) from the coffee-business renovation; older assets simply have none.
// 6 (owner 2026-10-26): every player carries `age` (an AGE_BANDS id or null = not given: today's rules and ₪), and a game with a
// player of 10 or under is a 'צעירים' game: every player's state carries `junior: true` (round rules, see JUNIOR_* below).
// 5 (v4 stage 4): every player's state carries `milestones` (25 / 50% celebrated once per game) and `taxAudit` (quiz points).
// 4: every player's state carries `lap` (board laps completed, drives price inflation) and `effects` (timed market effects).
// 3: every player's state carries a `learn` record (decisions, guesses, concepts). 2: saves hold a whole match (1-4 players).
// Version 1 saves were a single game state; 1 -> 2 -> 3 -> 4 migrate step by step on load.
// 8 (v0.4): a match may carry `roundCap` (short mode: the match ends after that many rounds, highest freedom % wins).
// 9 (v0.5): every player's state carries `rngVersion` (1 = the single mulberry32 stream + deck arrays: every save up to
// v0.4 keeps it; 2 = keyed decision-independent values, docs/RNG.md) and `log` (the dispatched actions, replay).
// 10 (v0.5.0 career): a player's state may carry `rank` (0-3, absent = 0), `dealScale` (the rank's deal factor, absent = 1) and
// `promotion` (the in-game promotion record, absent = the game has no promotion); `profession.rankTitle` names a rank above 0.
// Old saves simply have none of them (rank 0, no promotion), so the 9 -> 10 migration only stamps the version.
export const SCHEMA_VERSION = 10;
// v0.5: the first daily-challenge date (a 'YYYY-MM-DD' day key, docs/RNG.md) played on rngVersion 2. Every earlier date keeps
// its v2.5 keyed streams byte-identical (streaks, shared results and stored records stay fair). Set to the first day after the
// v0.5 release; a date in the past at release time would change a day some players already played.
// TODO(v0.5 release): placeholder (owner 2026-11-03). Set to the first day after the release date before shipping. Note:
// the day key is the device's local date (src/daily/calendar.js), not Asia/Jerusalem.
export const DAILY_RNG_V2_FROM = '2026-11-17';
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const NAME_MAX = 12;
export const SHORT_ROUNDS = 12; // v0.4 short mode: rounds in a short game (plan: a full, satisfying arc in 12 rounds)
// Display only: the monthly payment shown for an asset's mortgage / business loan. The asset's monthlyCashFlow is
// already net of it, so it never enters the game maths (win check, payday, loan limit).
// 0.0055 of the principal per month = a ~25-year mortgage at ~4.5%. Business loans: 72 months at ~8% = 1.75%.
export const MORTGAGE_PAYMENT_RATE = 0.0055;
export const BUSINESS_LOAN_PAYMENT_RATE = 0.0175;

// 24-square loop. 5 paydays, 9 opportunities, 2 expenses, 3 market, 2 baby, 2 charity, 1 tax audit.
// v4 stage 4: square 12 (was the second of three unexpected-expense squares) is 'ביקורת רשות המסים' ('taxAudit'): a quiz,
// knowledge points only, never money. Picked by simulation among all 24 candidates (docs/BALANCE.md "After v4 stage 4"):
// every candidate kept the sensible medians in the targets; 12 keeps them there (family 21, full 26), lowers reckless-play
// bankruptcy in family mode, and keeps always-buy clearly behind the sensible bot.
export const BOARD = [
  'payday', 'opportunity', 'expense', 'market', 'payday', 'opportunity',
  'charity', 'payday', 'opportunity', 'baby', 'payday', 'opportunity',
  'taxAudit', 'opportunity', 'opportunity', 'market', 'charity', 'payday',
  'opportunity', 'expense', 'market', 'baby', 'opportunity', 'opportunity',
];
export const TAX_AUDIT_SQUARE = 12;

export const MAX_KIDS = 3;
export const CHARITY_PCT = 0.1; // of total monthly income
export const CHARITY_TURNS = 3; // turns with two dice
export const LOAN_STEP = 1000;
// Bank loan: interest only, 1% of the principal per month (12% a year nominal). The principal stays until repaid.
export const LOAN_PAYMENT_RATE = 0.01;
export const MONTHS_PER_YEAR = 12;
// Nominal yearly rate in percent, derived (never typed into copy): 1% a month -> 12.
export const LOAN_APR_NOMINAL = Math.round(LOAN_PAYMENT_RATE * MONTHS_PER_YEAR * 1e6) / 1e4;
// Ceiling on the total bank-loan principal for BUYING (loans for expenses / shortfalls are exempt so nobody gets stuck),
// in monthly salaries. Measured: without it bots borrowed up to 120-160 salaries (100% leverage on every down payment)
// and the always-buy bot stopped losing. null = no cap (the cash-flow limit alone applies).
export const LOAN_CAP_SALARIES = 12;

// Starting debts (professions.he.json) follow one model: monthly payment = principal x the rate of its kind.
// car 2% = a 60-month installment at ~6-7%; card 3% = a typical minimum payment; student 1% = cheap, long, like a bank loan.
// Rounded to the nearest 10 NIS. The principal is not amortized in the game (payments stay until the debt is repaid).
export const BASE_DEBT_RATES = { car: 0.02, student: 0.01, card: 0.03 };
export const LOAN_LIMIT_SALARY_PCT = 0.2; // cash flow may drop to -20% of salary
export const SELL_FACTOR = 0.9; // voluntary sale of property/business (full mode)
export const MAX_STOCK_QTY = 10000;

// A payday square settles this many months of cash flow. The single biggest pacing knob (months per lap = this x 5 paydays).
// v3 phase 3 (docs/v3/economy-experiments.md): 24 -> 12. At 24 the full-mode median was 21-22 turns, below the 25-40 target,
// with ~400k of idle cash at turn 10.
export const PAYDAY_MONTHS = 12;

// ---- Inflation (v3 phase 3). Depends on the lap number only (state.lap = passes of square 0), never on a choice. ----
// NEW opportunity deals (apartments and businesses) are shown at price, down payment, rent / profit, loan payment and cash flow
// x PRICE_INFLATION_PER_LAP ^ lap. Assets already owned keep their numbers. Stocks are not inflated (their price is set by market
// cards, and price and dividend would scale together anyway, so the yield is the same).
// 1.08 a lap at 60 months a lap = ~1.55% a year, close to the Bank of Israel's verified 12-month figure (real-world-verified.md).
export const PRICE_INFLATION_PER_LAP = 1.08;
// Unexpected-expense cards x this ^ lap. 1.0 = off (finance measured no effect on balance).
export const EXPENSE_INFLATION_PER_LAP = 1.0;
// Rounding of inflated numbers, so family mode keeps round numbers: prices and down payments to 1,000 (mortgage = price - down),
// rent / profit / loan payment to 10 (cash flow = rent or profit - loan payment, so the card's breakdown still adds up),
// a card without a breakdown rounds its cash flow to 10. Inflated expense cards round to 50.
export const INFLATION_PRICE_ROUND = 1000;
export const INFLATION_FLOW_ROUND = 10;
export const INFLATION_EXPENSE_ROUND = 50;
// The daily challenge has no inflation (docs/decisions.md 2026-10-23): a charity die changes the lap count between players, so
// lap-keyed prices would break "the same challenge for everyone".
export const DAILY_INFLATION_FACTOR = 1.0;

// ---- Timed market effects (family market cards, v3 phase 3). The numbers live on the cards; these are the schema bounds. ----
// An effect drawn on turn T with `turns: N` is active for the rest of turn T and the next N - 1 turns (it counts down when the
// player rolls, like the charity dice). A new card of the same kind replaces the running one (no stacking).
export const TIMED_EFFECT_KINDS = ['propertyValue', 'cheapLoan', 'rentChange'];
export const TIMED_EFFECT_MAX_TURNS = 10;
export const TIMED_EFFECT_MAX_PCT = 0.5; // |pct| of propertyValue / rentChange cards
// Rounding of the effect amounts: a property value to 1,000, a rent change to 10.
export const PROPERTY_VALUE_ROUND = 1000;
export const RENT_CHANGE_ROUND = 10;

// Payback badge thresholds (years of cash flow to earn back the down payment).
export const PAYBACK_OK_YEARS = 8;
export const PAYBACK_SLOW_YEARS = 14;

// ---- Learning layer (docs/v2/learn/spec.md). Pure data; none of this changes a rule or a bot decision. ----
// Correct guesses in a row (on green / red deals) that earn the 'investor eye' badge.
export const INVESTOR_EYE_STREAK = 3;
// A bank loan is rated 'costly' when its monthly payment eats more than this share of what it is borrowed for
// (the asset's monthly cash flow for a purchase, the player's positive cash flow otherwise). Tunable with finance.
export const LOAN_COSTLY_PAYMENT_SHARE = 0.5;
// Report tip 'highInterest': more than this many bank loans in one game (or interest above one monthly salary).
export const REPORT_MANY_LOANS = 2;
// Report tip 'manyRed': at least this many bought deals in tier bad/trap.
export const REPORT_MANY_RED = 2;
// Report tip 'noDiversify' (full mode): one asset kind and at least this many assets.
export const REPORT_NO_DIVERSIFY_ASSETS = 3;
// Report tip 'allGood': green share (0-1) of the rated decisions.
export const REPORT_ALL_GOOD_SHARE = 0.8;

// ---- v4 stage 4 ----
// Passive income as a % of total monthly expenses, celebrated once per game (docs/v4/milestones.md).
export const MILESTONES = [25, 50];
// 'ביקורת רשות המסים': the engine draws a number 0..TAX_AUDIT_PICKS-1; the UI maps it onto the questions of the mode.
// The answer earns knowledge points only (never money).
export const TAX_AUDIT_PICKS = 1000000;
export const TAX_AUDIT_POINTS = 1;

// Family safety net (owner, 2026-10-25): in family mode a purchase loan may not leave the monthly cash flow (after the deal's own
// monthly money and the new loan payment) below this many shekels a month. Full mode, expense and shortfall loans: no net.
export const FAMILY_NET_FLOOR = 0;

// ---- 'צעירים' (owner 2026-10-26, docs/decisions.md): a game with a player aged 10 or under ----
// The age is a band picked after each name. 'upTo10' makes the game a junior game (family rules on round numbers, and that
// player sees amounts in coins); '11to13' is family mode in shekels; '14plus' is today's game. null = not given (today's game).
export const AGE_BANDS = ['upTo10', '11to13', '14plus'];
export const JUNIOR_AGE = 'upTo10';
/** Ages under 14 are suggested family mode. */
export const FAMILY_SUGGESTED_AGES = ['upTo10', '11to13'];
// One coin = this many shekels. Every amount of a junior game is a multiple of it, so coins are exact.
export const COIN_VALUE = 100;
// Junior round rules (an engine flag on every player's state, like the daily's): deals' price and down payment to 1,000, their
// monthly money to 100, expenses / charity / market cash / rent changes to 100, the profession's figures to 100 (debts' principal
// to 1,000), and bank loans in 10,000 steps (1% a month = 1 coin a month per step). Decision cards (their texts name shekel
// figures) and the cheap-loan card (half a coin a month) are not dealt; the tax-audit square asks no question (real figures).
export const JUNIOR_LOAN_STEP = 10000;
export const JUNIOR_ROUND = 100;
export const JUNIOR_PRICE_ROUND = 1000;
// The family safety net's floor in a junior game (tuned by simulation, docs/BALANCE.md 'Junior round rules').
export const JUNIOR_NET_FLOOR = 0; // not raised: 0 already meets the reckless target (15-35%); 500-2,500 changed nothing

// ---- 0.5.0 career and promotions (docs/decisions.md 2026-11-10 / 2026-11-11, docs/v050/) ----
/** Ranks of a profession: 0 (the base profession) to MAX_RANK. A rank is 2 bits in an action-log link (format 3). */
export const MAX_RANK = 3;
/**
 * The in-game promotion: once per game, on the first payday on or after a keyed turn, a raise of PROMOTION_RAISE_PCT of the salary
 * (rounded to PROMOTION_ROUND, so a junior game shows whole coins). 'Keep' leaves the whole raise as free cash. 'Upgrade' turns
 * PROMOTION_UPGRADE_SHARE of it into a new monthly expense and gives a cosmetic fox accessory: no cash perk (decision 2026-11-11).
 * The offer turn is keyed by the game's seed: PROMOTION_FROM_TURN + (0 .. PROMOTION_TURN_SPAN - 1), so two players on one link get
 * it on the same turn. Daily, missions and every game created without `promotion: true` have none.
 */
export const PROMOTION_RAISE_PCT = 0.12;
export const PROMOTION_UPGRADE_SHARE = 0.8;
export const PROMOTION_ROUND = 100;
export const PROMOTION_FROM_TURN = 5;
export const PROMOTION_TURN_SPAN = 5;
export const PROMOTION_EXPENSE_ID = 'lifestyle';
/**
 * Deal scale of a rank (docs/BALANCE.md, '0.5.0 ranks'): the prices, down payments and monthly money of NEW deals are multiplied by
 * it, so a higher rank's bigger target is reachable in about the same number of turns. A rank's data may set `dealScale`; without
 * one it is RANK_DEAL_SCALE_FACTOR x (rank salary / rank 0 salary) ^ RANK_DEAL_SCALE_EXPONENT.
 */
export const RANK_DEAL_SCALE_EXPONENT = 1;
/** ... times this factor (docs/BALANCE.md, '0.5.0 ranks': 1.0 keeps the sensible bot's medians but lets the reckless bots lose 36-40% at ranks 2-3; 1.3 keeps both in band). */
export const RANK_DEAL_SCALE_FACTOR = 1.3;
/** Unit a rank's deal scale is rounded to. */
export const RANK_DEAL_SCALE_ROUND = 0.05;

// ---- career store (src/career/): XP, seniority, profiles ----
/** The oldest age band whose career is protected: that band and every younger one never lose a rank or progress (CEO guard). Widening to 13 = '11to13'. */
export const CAREER_PROTECTED_AGE = JUNIOR_AGE;
/** XP of a finished game. A win gives more than a loss; both give XP (a loss counts for seniority too, decision 2026-11-11). */
export const XP_WIN = 30;
export const XP_LOSS = 10;
/** XP of an achievement, once per profile, paid into the profession of the game that earned it. */
export const XP_ACHIEVEMENT = 20;
/** A game below the profession's current rank pays this share of the game XP (achievements are paid in full). */
export const XP_LOWER_RANK_SHARE = 0.5;
/** The promotion week's profession pays this multiple of the XP of its games. */
export const PROMO_WEEK_XP_MULTIPLIER = 2;
/** XP needed to leave rank 0, 1, 2 (index = the current rank). Rank 3 is the top. */
export const RANK_XP_NEEDED = [60, 100, 160];
/** Seniority: full weeks without a finished game. The first resets the progress to the next rank in every profession, the second in a row drops every rank above 0 by one. */
export const SENIORITY_RESET_AFTER = 1;
export const SENIORITY_DROP_AFTER = 2;
/**
 * After a drop the missed-week count restarts at this number. 1 (CEO, 2026-11-11: "keep the approved rule") = one drop per further missed
 * week; 0 = the next drop needs two more missed weeks (the educator's first reading).
 */
export const SENIORITY_COUNT_AFTER_DROP = 1;
/** At most this many drops when a player returns after several missed weeks (default unlimited; the owner may choose 1 = one drop per return). */
export const CAREER_MAX_DROPS_PER_RETURN = Infinity;
/** The home chip warns from this weekday (0 = Sunday ... 6 = Saturday): Thursday. */
export const CAREER_WARN_FROM_WEEKDAY = 4;
/** The weekday the warning counts its days to and names in its wording ("עד סוף יום ..."): Saturday (6) or, for Shabbat-keeping families, Friday (5). The week itself always ends Saturday. */
export const CAREER_DEADLINE_WEEKDAY = 6;
/** A date this many weeks past the last one seen cannot be a real clock: it is ignored. */
export const CAREER_MAX_WEEK_JUMP = 104;
/** Profiles on one device. */
export const MAX_PROFILES = 4;
export const PROFILE_NAME_MAX = 12;
