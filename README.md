# יוצאים מהמרוץ (Exit the Race)

A single-player financial board game. Start in the "rat race" with a salary and expenses, buy assets
that create passive income, and win when **passive income > total monthly expenses**.
Hebrew (RTL) first, English-ready. Vite + vanilla JS, no backend, installable offline PWA.

Look and feel: "Golden Hour" dark-first (see `design/DIRECTION-v2.md` and `design/mockups/`), with a light theme.

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
`SMOKE_MOTION=full` (default is reduced motion for speed), `SMOKE_SEED`, `SMOKE_URL` (test a deployed URL).
In CI run `npx playwright install --with-deps chromium` once.

## Project layout

```
src/engine/     pure game rules (no DOM): state, dice, movement, cards, loans, cash flow, win/lose, save/load
src/data/       cards.<locale>.json, professions.<locale>.json (+ index.js that validates them at load)
src/i18n/       <locale>.json UI strings (+ index.js: t(), setLocale)
src/ui/         screens, modals, widgets, effects (die, pawn hop, count-up, coin burst, confetti)
src/styles/     tokens.css (design tokens, dark + light), fonts.css (self-hosted Rubik), base/components/screens.css
src/services/   ads.js (stub), storage.js, pwa.js
src/assets/     SVG art (mascot pieces, dice, coins, icons, app icon)
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
  "price": 450000, "downPayment": 20000, "mortgage": 430000, "monthlyCashFlow": 2300 }

// Opportunity: stock (full mode)
{ "id": "opp-stk-099", "deck": "opportunity", "type": "stock", "modes": ["full"],
  "title": "...", "text": "...", "symbol": "ABC", "price": 40, "dividend": 1.8, "maxQty": 500 }

// Unexpected expense
{ "id": "exp-099", "deck": "expense", "modes": ["family", "full"], "title": "...", "text": "...", "amount": 4500 }

// Market event: offer on one of your assets | stock price change | cash gain or loss
{ "id": "mkt-099", "deck": "market", "modes": ["full"], "effect": "offer", "title": "...", "text": "...", "targetType": "apartment", "offerPct": 1.25 }
{ "id": "mkt-098", "deck": "market", "modes": ["full"], "effect": "stockPrice", "title": "...", "text": "...", "symbol": "ABC", "newPrice": 55 }
{ "id": "mkt-097", "deck": "market", "modes": ["family", "full"], "effect": "cash", "title": "...", "text": "...", "amount": -800 }
```

Professions live in `src/data/professions.he.json` (salary, savings, perChild, itemised expenses, starting liabilities).
After changing numbers run `npm run simulate` to check balance (targets: median 15-25 turns to win).
Money formatting, card layout and the statement all adapt to the data.

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
