# MaxiFox

Formerly פסיבו / Passivo, renamed 2026-10-23 (docs/decisions.md). The `passivo.*` localStorage keys, the daily seed `passivo-daily|` and the `history.state.passivo` marker keep the old name on purpose, so saves and daily boards survive the rename.

A financial board game for one player, or 2-4 players taking turns on one device (hot-seat). Start in the daily grind ("השגרה") with a salary and expenses, buy assets
that create passive income, and win when **passive income > total monthly expenses**.
Hebrew (RTL) first, English-ready. Vite + vanilla JS, no backend, installable offline PWA.

Look and feel: "Navy & Gold" dark-first with the fox character מקסי (Maxi). The app icon, the home logo, the splash and the store art use the gold MaxiFox logo (`design/brand/`); the orange character appears in the game only (see `design/DIRECTION-v3.md`, `design/fox-usage.md` and `design/mockups/`), plus a light theme. The board is the "night city" variation.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine, data and UI-helper unit tests (Vitest)
npm run build        # production build to dist/
npm run preview      # serve dist/ locally
npm run simulate     # balance simulation (bots, 100 games per profession and mode)
npm run smoke        # Playwright full-flow test at 360x800 (see below)
npm run icons        # rebuild the MaxiFox icons + alpha logo from design/brand/maxifox-logo-source.jpg (design/brand/scripts)
```

Handy URL parameter: `?seed=123` makes the shuffle and dice deterministic (game *n* of the session uses `seed + n - 1`).

### Smoke test

`npm run smoke` serves `dist/` with `vite preview`, opens a 360x800 touch viewport and plays a full game
(start, settings, mode, profession, statement, card modals, loans, save/resume, win screen, light theme, offline reload).
It asserts no horizontal scroll on every screen, no console errors, no failed requests, that Rubik loads and that
the service worker serves the app offline. Screenshots land in `test-results/`.

Run `npm run build` first. It uses the Chromium that Playwright finds; set `CHROMIUM_PATH` to use another binary
(the sandbox default is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Options (env): `SMOKE_MODE=family|full`,
`SMOKE_H=800|640` (viewport height; both must pass), `SMOKE_PLAYERS=1|2|3|4` (1 = single player, 2-4 = hot-seat),
`SMOKE_MOTION=full` (default is reduced motion for speed), `SMOKE_SEED`, `SMOKE_URL` (test a deployed URL).
In CI run `npx playwright install --with-deps chromium` once.

Further browser checks (all take `AXE=/path/to/axe.min.js` for an axe pass after the fades): `npm run smoke:tutorial` (first game, hints,
hand-over; `THEME=dark|light`, `SMOKE_W`/`SMOKE_H`, `PLAYERS`), `npm run smoke:daily`, `npm run smoke:r11`, `npm run smoke:r12`.
Every state those visit also measures the **rendered contrast of every amount** (`tests/e2e/contrast-lib.mjs`: screenshot with the text
hidden, pixels behind each `.money` element against its effective colour, fails below 4.5:1), because axe cannot judge text on a gradient.

## Project layout

```
src/engine/     pure game rules (no DOM): state, dice, movement, cards, loans, cash flow, win/lose, save/load
src/data/       cards.<locale>.json, professions.<locale>.json (+ index.js that validates them at load)
src/i18n/       <locale>.json UI strings (+ index.js: t(), setLocale)
src/ui/         screens, modals, widgets, effects (die, pawn hop, count-up, coin burst, confetti), fox.js (fox poses + reactions)
src/styles/     tokens.css (design tokens, dark + light), fonts.css (self-hosted Rubik), base/components/screens.css
src/daily/      daily challenge (client only): calendar, streak, share text, one-attempt rule, storage
src/services/   ads.js (stub), storage.js, pwa.js
src/assets/     SVG art (dice, coins, tiles, pawn, wordmark, icons) + fox/*.webp poses (@1x/@2x) + app icon
public/         manifest.webmanifest, sw.js (service worker), icons/ (PWA PNGs)
tests/          Vitest unit tests; tests/e2e/smoke.mjs is the Playwright flow
```

The engine is the single source of truth: every action is `(state, ...args) => newState`, randomness comes from a
seeded RNG stored in the state, and the UI only presents engine events.

## Local multiplayer (hot-seat)

Start screen, mode, then "כמה שחקנים?" (1-4, default 1; one player is the classic game). Each player gets a name
(default "שחקן n", max 12 characters), a colour token with a number, and picks their own profession (the same one is
allowed). Pass the phone when the sheet "תור של <name>" appears and tap "אני מוכן". The first player whose passive income
beats their expenses wins; players who hit game over are skipped.

- `src/engine/match.js` is the pure, serializable match layer: `newMatch`, `act(match, fn)` (applies an engine action to the
  current player), `canEndTurn` / `endTurn` (hands the turn on), `standings`, `rematch`. Player *i* uses `seed + i * 7919`
  (player 1 keeps the match seed, so single player is identical to the plain game).
- Saves are schema 2 and hold the whole match; schema 1 saves (a bare single-player state) migrate to a one-player match.
- Bots: `playMatch(engine, match, ['sensible', ...])` in `src/engine/bots.js`; `npm run simulate` also prints a 4-bot match table.
- The board HUD has a house button ("חזרה לבית"): an in-page confirm sheet, then the match is saved and the start screen shows
  the resume button. The browser/Android back button opens the same sheet.

## Deploy

Everything deploys to GitHub Pages from the `gh-pages` branch.

- **Repo settings (one time):** Settings > Pages > Source "Deploy from a branch" > `gh-pages` / root.
  Settings > Actions > General > Workflow permissions: **Read and write**.
- **PR previews:** `.github/workflows/pr-preview.yml` runs tests, builds, runs the smoke test, then publishes to
  `https://<user>.github.io/<repo>/pr-preview/pr-<N>/` and comments the URL on the PR. Closing the PR removes it.
- **Production:** `.github/workflows/deploy.yml` publishes `main` to the root of `gh-pages` (previews are kept).
- **Vite base:** `vite.config.js` reads `BASE_PATH` (default `./`). CI sets `/<repo>/` for production and
  `/<repo>/pr-preview/pr-<N>/` for previews. The manifest uses relative URLs, the service worker is registered at
  `${BASE_URL}sw.js`, so scope and `start_url` follow the base automatically.

Manual production build for a project page: `BASE_PATH=/<repo>/ npm run build`.

## PWA

`public/manifest.webmanifest` (standalone, RTL, any + maskable icons) and `public/sw.js`. The build injects the
precache list (all hashed assets, fonts included) and a build id into `dist/sw.js`, so the first visit caches the whole
app and later visits work offline. New deploys replace the old cache on activation.

## Add a card (no code changes)

Edit `src/data/cards.he.json` and add an object. It is validated when the game loads (and in `npm test`);
errors are listed with the card id. Required fields:

```jsonc
// Opportunity: apartment | business  (price must equal downPayment + mortgage)
{ "id": "opp-apt-099", "deck": "opportunity", "type": "apartment", "modes": ["family", "full"],
  "title": "...", "text": "...",
  "price": 1800000, "downPayment": 200000, "mortgage": 1600000, "monthlyCashFlow": 3400,
  // optional, shown on the buy card as "rent - mortgage = cash flow" (validated: rent - loanPayment == monthlyCashFlow);
  // a business uses "profit" instead of "rent" ("profit - loan payment = cash flow")
  "rent": 12200, "loanPayment": 8800,
  // optional: true marks a card that will get an "in the real world" fact later
  "realWorld": true }

// Opportunity: stock (full mode)
{ "id": "opp-stk-099", "deck": "opportunity", "type": "stock", "modes": ["full"],
  "title": "...", "text": "...", "symbol": "ABC", "price": 500, "dividend": 3, "maxQty": 400 }

// Unexpected expense
{ "id": "exp-099", "deck": "expense", "modes": ["family", "full"], "title": "...", "text": "...", "amount": 4500 }

// Market event: offer on one of your assets | stock price change | cash gain or loss
{ "id": "mkt-099", "deck": "market", "modes": ["full"], "effect": "offer", "title": "...", "text": "...", "targetType": "apartment", "offerPct": 1.25 }
{ "id": "mkt-098", "deck": "market", "modes": ["full"], "effect": "stockPrice", "title": "...", "text": "...", "symbol": "ABC", "newPrice": 55 }
{ "id": "mkt-097", "deck": "market", "modes": ["family", "full"], "effect": "cash", "title": "...", "text": "...", "amount": -1000 }
```

**Children's wording (family mode).** Any card may carry `"titleFamily"` and/or `"textFamily"`: a family game draws the card with
that wording in `title` / `text` (numbers are never touched; full mode shows the plain `title` / `text`). Use it when the plain
text needs an adult money word (תשואה, מקדמה, משכנתא, תזרים, הכנסה פסיבית ...); `tests/round12.test.js` scans every family-mode card
for the forbidden list in `docs/v2/tutorial/spec.md` and fails with the card id.

Professions live in `src/data/professions.he.json` (salary, savings, perChild, itemised expenses, starting liabilities).
Starting debts carry `"debt": "car" | "card" | "student"`; their monthly payment must equal principal x the rate of that kind
(`BASE_DEBT_RATES` in `config.js`: car 2%, card 3%, student 1%, rounded to 10). The validator enforces it.

**Loans (v2).** Bank loans are interest only: `LOAN_PAYMENT_RATE` = 1% of the principal a month (12% a year; 1,000 costs 10 a month,
240 until the next summary). `loanTerms(amount)` returns the figures the loan dialog shows; every number in the copy is derived from
the config. Loans can be repaid in both modes. `LOAN_CAP_SALARIES` caps the total bank-loan principal when borrowing to buy
(loans that cover an expense are never capped). The payday square is called "סיכום שנתיים" and settles `PAYDAY_MONTHS` months.
After changing numbers run `npm run simulate` to check balance (targets: median 15-25 turns to win).
Money formatting, card layout and the statement all adapt to the data.

**Balance rules of thumb** (enforced by `tests/data.test.js`):
- Payback = `downPayment / monthlyCashFlow / 12` years. Good deals: 3-6 years (small), 7-12 (down payment >= 150,000).
- About 35-40% of the opportunity cards per mode are traps: obvious ones (negative cash flow) and subtle ones
  (positive but payback over 14 years: high fees, balloon payments, over-priced). Traps need no code, just numbers.
- Family-mode cards use round numbers (prices in 1,000s; down payment and loan in 500s; cash flow, rent, profit and loan payment in 100s).
- `loanPayment` is the loan's payment (mortgage x 0.55% a month for apartments, business loan x 1.75%, rounded to 100). It is display only: the cash flow is already net of it.
- Stocks pay a 0.25-0.8% monthly dividend (whole shekels per share); give each a different volatility through its `stockPrice` market cards.
- Pacing knob: `PAYDAY_MONTHS` in `src/engine/config.js`. A payday square settles that many months of cash flow
  (the board lap stands for a stretch of years), so deal sizes and pace can be tuned without touching the cards' payback.
  `BOARD` in the same file sets how often each square type appears.

## The learning layer (v2 phase B)

Content is JSON in `src/data/learn/` (validated when the game loads and in `npm test`, schema in `src/learn/validate.js`;
the authoritative rules are in `docs/v2/learn/spec.md`). Adding content never needs code:

| File | What | How to extend |
|---|---|---|
| `glossary.he.json` | the 13 concepts of 'המילון של מקסי' (`level`: `family` shows in both modes, `full` only in full mode) | add an object to `concepts[]`; to make a word a dashed-underline button write `[[term:id\|display]]` in any string of `src/i18n/he.json` (display is optional). Unknown ids fail `npm test` |
| `feedback.he.json` | the fox line after each decision: `lines["buy.good"].family / .full / .all` (three phrasings rotate, deterministic per game seed) | add a phrasing to a group's array; slots come from `GROUP_SLOTS` in `src/learn/feedback.js` |
| `guess.he.json` | 'עסקה טובה?' (family mode, apartments and businesses only), traffic-light texts, verdicts, 'עין של משקיע' | edit texts; thresholds are never typed: `PAYBACK_OK_YEARS` / `PAYBACK_SLOW_YEARS` / `INVESTOR_EYE_STREAK` in `config.js` |
| `report.he.json` | 'מה למדתי' report and the conversation questions (family: three questions of one theme, picked by the report tip, the other themes rotate by the game seed) | add a theme or a question |
| `real-world.he.json` | 'בעולם האמיתי' fact per card flagged `"realWorld": true` in `cards.he.json` | add a fact whose `cardIds` lists the card. Real-world figures live in `numbers` with `publish: false` and are never rendered (a test enforces it); finance flips it after finding a primary source |

Where it lives: pure rules in `src/engine/learn.js` (rating a deal / a loan, the per-player record `state.learn`, the report counting)
and `src/learn/` (texts, slots, triggers, report view model); UI in `src/ui/learn.js` (dictionary), `learn-flow.js` + `notes.js`
(fox note: feedback and first-time explainers), `report.js`, `realworld.js` and the guess flow in `modals.js`. Progress that survives games
is in localStorage (`passivo.learn.seen`, `passivo.learn.badges`); the explainers and the guess can be switched off in settings
('הסברים של מקסי', 'ניחוש לפני קנייה': on by default in family mode, off in full mode). Save schema 3 added `state.learn`; older saves migrate.
Tuning parameters: `LOAN_COSTLY_PAYMENT_SHARE`, `INVESTOR_EYE_STREAK`, `REPORT_*` in `src/engine/config.js`.

## The first game with Maxi (learnability package)
Spec: `docs/v2/tutorial/spec.md`, art: `docs/v2/tutorial/art.md`, all wording: `src/data/learn/tutorial.he.json` (validated at load by
`src/learn/validate-tutorial.js`, pruned for the production bundle by `scripts/prune-learn.js`).
- **One-tap hand-over (hot-seat):** when a turn resolves the pass-the-phone sheet opens at once with a recap and one button
  `זרקו קובייה, <שם>` that rolls for the next player. Single player has no hand-over.
- **Summary card:** every `סיכום שנתיים` (all modes) shows salary + money that works - expenses = left a month, x 24 = amount, cash before -> after
  (`src/ui/summary-card.js`, figures from `summaryFigures()` in `src/learn/tutorial.js` = the engine's payday numbers).
- **Family HUD:** `נשאר בחודש` chip + popover, goal line (until 3 finished games), `עוד X בחודש לחופש` (`src/ui/hud-family.js`).
- **Story** (5 screens, family, first game per device, replayable from settings and the help button) and the optional **3-question check**
  live in `src/ui/tutorial/` and load with `import()`; the three illustrations are in `src/assets/tutorial/`.
- **Guided hints** (10, first game only, once per device): scheduler in `src/learn/tutorial.js`, device record `passivo.tutorial`
  (`storyDone`, `quizDone`, `hintsSeen`, `helpOn`). Settings: help switch, replay the story, replay the hints, parent card.
- **Family vocabulary:** 22 strings and 13 kid names swap in family mode only (`familyStrings.overrides`, `kidNames` in the same JSON); the dictionary
  shows the real term under the kid name. Add a word = edit the JSON.
- Tests: `tests/tutorial.test.js` (rules), `tests/tutorial-content.test.js` (every `computed` figure recomputed from the game data),
  `npm run smoke:tutorial` (Playwright, optional axe via `AXE=/path/to/axe.min.js`).

## The fox (מקסי / Maxi)

The app icon and the home logo are the gold MaxiFox logo (`design/brand/`, in-app copy `src/assets/brand/maxifox-logo-alpha-1x/2x.webp`); the character below is the orange fox מקסי.

Poses live in `src/assets/fox/` as transparent WebP (`tired`, `wave`, `roll`, `hammock`, `tip` with `@2x`) plus four
512px circle crops (`think`, `celebrate`, `worried`, `ponder`). `src/ui/fox.js` is the only place that builds fox images
(`<img srcset>` 1x/2x, width/height attributes, `decoding=async`, lazy when off-screen, alt text from `fox.alt.*` in
`he.json` or `alt=""` when decorative). Where each pose goes and how it moves: `design/fox-usage.md`; the rules that
are not DOM (which crop for which square, when family tips show) are in `src/ui/fox-rules.js` and unit-tested.

- Start: the MaxiFox logo only (no character). The first-launch greeting "היי, אני מקסי!" is the first bubble of the board's corner guide (flag `passivo.seenIntro` in localStorage, key kept).
- Board: `roll` pose above the roll button, a reaction crop in the strip under the board (never over the HUD, tiles
  or die), `tip` in family mode on turns 1-3 and every 5th turn.
- Win: `hammock`. Game over: `tired`. Cards, loan dialog and the profession preview carry one reaction crop.
- Everything honours `prefers-reduced-motion` and the "less animation" setting (fades only, no bob or sway).
- `hero.webp` is store/splash art only: it is intentionally not bundled.

To add a pose: drop `name.webp` (+ `name@2x.webp`) in that folder, add it to `POSES` in `src/ui/fox.js`
(intrinsic size; `tests/fox.test.js` checks it against the file) and use `foxImg('name', { height })`.

## Daily challenge (v2.5, client only)

A start-screen card ("אתגר יומי") opens one family-mode game per calendar day. There is no server: everything is on the device and works offline.

- **The day** is the LOCAL calendar date `YYYY-MM-DD` (`src/daily/calendar.js`). Players in different time zones get different days around
  midnight; this is accepted. Day maths uses UTC day numbers, so daylight-saving days never skip or repeat a day.
- **Same game for everyone.** `dailySeed(date)` hashes the date string (`src/engine/daily.js`). The profession, die k of turn i and the card
  drawn at turn i are pure functions of `(seed, i)`, never of the rng state, so two players see the same dice and the same cards whatever they
  buy, pass or borrow. It is an opt-in rules flag (`engine.newGame({ daily: { date } })`); normal games, bots and `npm run simulate` do not use it.
- **One attempt per day.** Finishing, running into the turn cap (`DAILY_TURN_CAP`, 40: no freedom by then = "לא הצלחתי היום") or giving up
  (home sheet, two steps) stores the result and uses the attempt. Leaving mid-game keeps a save in its own slot (`passivo.dailySave`, so a normal
  game in progress is never overwritten) and resumes. `?debug=1` adds a reset button on the card.
- **Result and share.** The result screen shows turns to freedom, net worth, the learning headline, the streak and badges (3 / 7 / 30 days,
  kept once earned). "שתפו" builds a WhatsApp text (first line, one coloured square per turn by traffic-light tier, the link) with
  `navigator.share`, else the clipboard, with a visible "הועתק". It never contains cards, choices or names (`src/daily/share.js`).
- **Streak** (`src/daily/streak.js`): schema-versioned (`passivo.dailyStreak`, `v: 1`), a missed day resets it (the "החמצתם יום?" line only after a streak of 2+ and 1-3 missed days, otherwise a neutral welcome back). A stored last play more than a day ahead of today is treated as clock tampering and ignored.
- **Saves never cross.** `src/services/match-store.js`: `store.save(match)` / `store.clear(match)` pick the slot (`save` or `dailySave`) from the match and throw without one; a unit test checks every call is explicit.
- **Charity changes the route.** Donating gives two dice for 3 turns, so the later squares differ from other players' (die 0 of every turn stays identical). The charity card and the how-to say so: "תרומה משנה את המסלול שלכם בגלל הקובייה הנוספת".
- **Ready for a leaderboard.** `dailyResult(state)` is the pure record `{ date, seed, turns, netWorth, professionId, mode, actionsLog }`;
  `replayDaily(engine, record)` re-runs the engine from the date and the action log, which is exactly what a server check would do.

Tests: `tests/daily.test.js` (unit) and `node tests/e2e/daily-smoke.mjs` after `npm run build` (UI flow at 360x800, 360x640 and 320x568;
set `AXE_PATH` to an `axe.min.js` to include the accessibility checks). Screenshots go to `qa/screens/daily/`.

## Debug helpers

Open the app with `?debug=1` (for example `/?debug=1&seed=11`) to get two dev-only buttons on the board
("ניצחון" / "הפסד") and `window.__passivoDebug.forceWin()` / `forceLose()`, and a reset button on the daily challenge card. Without the flag nothing is created
and the helpers do not exist.

## Add a language

1. Copy `src/i18n/he.json` to `src/i18n/en.json`, translate the values, and set the `meta` block:
   `{ "name": "English", "lang": "en", "dir": "ltr", "numberLocale": "en-IL" }`.
2. Copy `src/data/cards.he.json` and `professions.he.json` to `cards.en.json` / `professions.en.json`
   (keep the same ids and numbers; translate `title`, `text`, `label`). Missing content files fall back to Hebrew.
3. That is all: locales are discovered with `import.meta.glob`. A language switch appears in Settings as soon as there is
   more than one locale; `<html lang dir>` follow `meta`. Layout uses CSS logical properties, so LTR works without CSS changes.

`npm test` fails if the UI uses a key that is missing from `he.json`, or if a Hebrew literal sneaks into UI code.

## Haptics, sound and motion

Settings toggles: sound (tiny synthesized tones, no files), haptics (`navigator.vibrate`: roll 15ms, land 10ms,
purchase 20-40-20, win pattern, error 40ms) and "less animation". `prefers-reduced-motion` is honoured
automatically: the die, hops, coin burst and confetti become short fades or static sparkles.

## Ads

`src/services/ads.js` is a stub (`showRewarded`, `showInterstitial`); v1 shows no ads. Swap the implementation for
AdMob (Capacitor) later without touching the screens.

## Fonts

Rubik (Hebrew + Latin, weights 400/500/700/900) is self-hosted from the `@fontsource/rubik` npm package
(see `src/styles/fonts.css`); there is no runtime CDN. Hebrew and Latin subsets load by `unicode-range`; the bold
weights are preloaded in `index.html` by the build.
