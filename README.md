# פסיבו (Passivo)

A single-player financial board game. Start in the daily grind ("השגרה") with a salary and expenses, buy assets
that create passive income, and win when **passive income > total monthly expenses**.
Hebrew (RTL) first, English-ready. Vite + vanilla JS, no backend, installable offline PWA.

Look and feel: "Navy & Gold" dark-first with the fox character Passivo (see `design/DIRECTION-v3.md`, `design/fox-usage.md` and `design/mockups/`), plus a light theme. The board is the "night city" variation.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine, data and UI-helper unit tests (Vitest)
npm run build        # production build to dist/
npm run preview      # serve dist/ locally
npm run simulate     # balance simulation (bots, 100 games per profession and mode)
npm run smoke        # Playwright full-flow test at 360x800 (see below)
npm run icons        # re-rasterize PWA icons from src/assets/app-icon-*.svg
```

Handy URL parameter: `?seed=123` makes the shuffle and dice deterministic (game *n* of the session uses `seed + n - 1`).

### Smoke test

`npm run smoke` serves `dist/` with `vite preview`, opens a 360x800 touch viewport and plays a full game
(start, settings, mode, profession, statement, card modals, loans, save/resume, win screen, light theme, offline reload).
It asserts no horizontal scroll on every screen, no console errors, no failed requests, that Rubik loads and that
the service worker serves the app offline. Screenshots land in `test-results/`.

Run `npm run build` first. It uses the Chromium that Playwright finds; set `CHROMIUM_PATH` to use another binary
(the sandbox default is `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Options (env): `SMOKE_MODE=family|full`,
`SMOKE_H=800|640` (viewport height; both must pass),
`SMOKE_MOTION=full` (default is reduced motion for speed), `SMOKE_SEED`, `SMOKE_URL` (test a deployed URL).
In CI run `npx playwright install --with-deps chromium` once.

## Project layout

```
src/engine/     pure game rules (no DOM): state, dice, movement, cards, loans, cash flow, win/lose, save/load
src/data/       cards.<locale>.json, professions.<locale>.json (+ index.js that validates them at load)
src/i18n/       <locale>.json UI strings (+ index.js: t(), setLocale)
src/ui/         screens, modals, widgets, effects (die, pawn hop, count-up, coin burst, confetti), fox.js (fox poses + reactions)
src/styles/     tokens.css (design tokens, dark + light), fonts.css (self-hosted Rubik), base/components/screens.css
src/services/   ads.js (stub), storage.js, pwa.js
src/assets/     SVG art (dice, coins, tiles, pawn, wordmark, icons) + fox/*.webp poses (@1x/@2x) + app icon
public/         manifest.webmanifest, sw.js (service worker), icons/ (PWA PNGs)
tests/          Vitest unit tests; tests/e2e/smoke.mjs is the Playwright flow
```

The engine is the single source of truth: every action is `(state, ...args) => newState`, randomness comes from a
seeded RNG stored in the state, and the UI only presents engine events.

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
  "price": 1800000, "downPayment": 200000, "mortgage": 1600000, "monthlyCashFlow": 4000 }

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

Professions live in `src/data/professions.he.json` (salary, savings, perChild, itemised expenses, starting liabilities).
After changing numbers run `npm run simulate` to check balance (targets: median 15-25 turns to win).
Money formatting, card layout and the statement all adapt to the data.

**Balance rules of thumb** (enforced by `tests/data.test.js`):
- Payback = `downPayment / monthlyCashFlow / 12` years. Good deals: 3-6 years (small), 7-12 (down payment >= 150,000).
- About 35-40% of the opportunity cards per mode are traps: obvious ones (negative cash flow) and subtle ones
  (positive but payback over 14 years: high fees, balloon payments, over-priced). Traps need no code, just numbers.
- Family-mode cards use round numbers (prices in 1,000s; down payment, loan and cash flow in 500s).
- Stocks pay a 0.4-0.8% monthly dividend; give each a different volatility through its `stockPrice` market cards.
- Pacing knob: `PAYDAY_MONTHS` in `src/engine/config.js`. A payday square settles that many months of cash flow
  (the board lap stands for a stretch of years), so deal sizes and pace can be tuned without touching the cards' payback.
  `BOARD` in the same file sets how often each square type appears.

## The fox (Passivo)

Poses live in `src/assets/fox/` as transparent WebP (`tired`, `wave`, `roll`, `hammock`, `tip` with `@2x`) plus four
512px circle crops (`think`, `celebrate`, `worried`, `ponder`). `src/ui/fox.js` is the only place that builds fox images
(`<img srcset>` 1x/2x, width/height attributes, `decoding=async`, lazy when off-screen, alt text from `fox.alt.*` in
`he.json` or `alt=""` when decorative). Where each pose goes and how it moves: `design/fox-usage.md`; the rules that
are not DOM (which crop for which square, when family tips show) are in `src/ui/fox-rules.js` and unit-tested.

- Start: `tired` (idle bob), `wave` once on first launch (flag `passivo.seenIntro` in localStorage).
- Board: `roll` pose above the roll button, a reaction crop in the strip under the board (never over the HUD, tiles
  or die), `tip` in family mode on turns 1-3 and every 5th turn.
- Win: `hammock`. Game over: `tired`. Cards, loan dialog and the profession preview carry one reaction crop.
- Everything honours `prefers-reduced-motion` and the "less animation" setting (fades only, no bob or sway).
- `hero.webp` is store/splash art only: it is intentionally not bundled.

To add a pose: drop `name.webp` (+ `name@2x.webp`) in that folder, add it to `POSES` in `src/ui/fox.js`
(intrinsic size; `tests/fox.test.js` checks it against the file) and use `foxImg('name', { height })`.

## Debug helpers

Open the app with `?debug=1` (for example `/?debug=1&seed=11`) to get two dev-only buttons on the board
("ניצחון" / "הפסד") and `window.__passivoDebug.forceWin()` / `forceLose()`. Without the flag nothing is created
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
