# Rename inventory: פסיבו / Passivo → MaxiFox, פסיבו השועל → מקסי

Source: `grep -rnI -E "פסיבו|Passivo|passivo|PASSIVO"` over `src`, `index.html`, `public/manifest.webmanifest`, `README.md`, `business/`, `docs/` (23.10.2026, branch `ccr-6e0ec1cd-enmcaj`). Extra hits found while checking the build and tests (`package.json`, `vite.config.js`, `public/sw.js`, `scripts/`, `tests/`, `design/`) are listed at the end because the rename breaks them if they are skipped.

Rules (docs/decisions.md, 2026-10-23):
- **brand** → `MaxiFox` (Latin in both languages; inside Hebrew text wrap it in `<bdi>` or `unicode-bidi: isolate`; in plain share text use `MaxiFox` as is).
- **character** → `מקסי` / `מקסי השועל` (English: Maxi).
- **"פסיבו אומר" style lines** (the fox speaks, explains or points) → `מקסי אומר`, `מקסי מסביר`, `מקסי מצביע`, `המילון של מקסי`, `המדריך של מקסי`, `הסברים של מקסי`, `המשחק הראשון עם מקסי`.
- **Kept on purpose:** every `passivo.*` localStorage key (`passivo.save`, `passivo.prefs`, `passivo.tutorial`, `passivo.seenIntro`, `passivo.learn.seen`, `passivo.learn.badges`, `passivo.dailyResults`, `passivo.dailyStreak`, `passivo.dailySave`, and the `PREFIX = 'passivo.'` in `src/services/storage.js`) so player saves survive. Also kept: the daily seed string `passivo-daily|` (changing it changes every daily board, and the challenge must stay the same for everyone) and the `history.state.passivo` marker (internal, never shown).

Types: **UI** = shown to players (or read by screen readers). **store** = store listing, manifest, page title/description. **docs** = internal documents. **code** = identifiers, comments, file content not shown to players.

## 1. src

| Place | Current text | Type | Replace with |
|---|---|---|---|
| src/i18n/he.json:4 | `"title": "פסיבו"` | UI (h1 accessible name, document title) | `MaxiFox` |
| src/i18n/he.json:29 | `פסיבו: הודעה אחרונה` | UI (aria-label of the fox note button) | `מקסי: הודעה אחרונה` |
| src/i18n/he.json:32 | `פסיבו השועל, עייף עם כוס קפה` | UI (alt) | `מקסי השועל, עייף עם כוס קפה` |
| src/i18n/he.json:33 | `פסיבו השועל מנופף לשלום` | UI (alt) | `מקסי השועל מנופף לשלום` |
| src/i18n/he.json:34 | `פסיבו השועל נח בערסל ליד ערימת מטבעות` | UI (alt) | `מקסי השועל נח בערסל ליד ערימת מטבעות` |
| src/i18n/he.json:35 | `פסיבו השועל חושב עם מטבע ביד` | UI (alt) | `מקסי השועל חושב עם מטבע ביד` |
| src/i18n/he.json:37 | `היי, אני פסיבו!` | UI (character line) | `היי, אני מקסי!` |
| src/i18n/he.json:418 | `הגעתי לחופש כלכלי {turns} ב״פסיבו״! ...` | UI (share text, brand) | `הגעתי לחופש כלכלי {turns} ב-MaxiFox! ...` |
| src/i18n/he.json:454 | `פסיבו אתגר יומי` | UI (share title, brand) | `MaxiFox אתגר יומי` |
| src/i18n/he.json:467 | `פסיבו אתגר יומי {date} \| ...` | UI (share text, brand) | `MaxiFox אתגר יומי {date} \| ...` |
| src/i18n/he.json:540 | `הסברים של פסיבו` | UI (settings toggle) | `הסברים של מקסי` |
| src/i18n/he.json:544 | `המילון של פסיבו` | UI | `המילון של מקסי` |
| src/i18n/he.json:570 | `פסיבו אומר` | UI | `מקסי אומר` |
| src/data/learn/glossary.he.json:19 | `explainTitle: פסיבו מסביר` | UI | `מקסי מסביר` |
| src/data/learn/glossary.he.json:20 | `dictionaryTitle: המילון של פסיבו` | UI | `המילון של מקסי` |
| src/data/learn/report.he.json:76 | `...במילון של פסיבו.` | UI | `...במילון של מקסי.` |
| src/data/learn/quiz-tax.he.json:19 | `נחשו לפני שפסיבו מסביר.` | UI | `נחשו לפני שמקסי מסביר.` |
| src/data/learn/guide.he.json:35 | `המדריך של פסיבו` | UI | `המדריך של מקסי` |
| src/data/learn/guide.he.json:42 | `לפני שפסיבו מסביר?` | UI | `לפני שמקסי מסביר?` |
| src/data/learn/tutorial.he.json:48 | `title: המשחק הראשון עם פסיבו` | UI | `המשחק הראשון עם מקסי` |
| src/data/learn/tutorial.he.json:58 | `...רמזים של פסיבו בתורות הראשונים` | UI | `...רמזים של מקסי...` |
| src/data/learn/tutorial.he.json:71 | `storyLayer: המשחק הראשון עם פסיבו, מסך {n}...` | UI (aria-label) | `המשחק הראשון עם מקסי, מסך {n}...` |
| src/data/learn/tutorial.he.json:72 | `hintFoxLabel: פסיבו מצביע` | UI (aria-label) | `מקסי מצביע` |
| src/data/learn/tutorial.he.json:285 | `נסו לענות לפני שפסיבו מסביר.` | UI | `...לפני שמקסי מסביר.` |
| src/data/learn/tutorial.he.json:655 | override `win.shareText` (was/family) `ב״פסיבו״` | UI (share text, brand) | `ב-MaxiFox` in both `was` and `family` |
| src/data/learn/tutorial.he.json:4, 43, 674 | `purpose`, rules, `howto` notes (`עם פסיבו`, `של פסיבו`, `המילון של פסיבו`) | code (meta notes; 674 quotes a UI label) | `מקסי` (674 must match the renamed label) |
| src/data/learn/tutorial.he.json:39 | `passivo.tutorial` | code (storage key) | **keep** |
| src/assets/wordmark.svg:1 | `aria-label="פסיבו Passivo"`; the art itself spells פסיבו / PASSIVO | UI (art) | replace the start-screen wordmark with `design/brand/maxifox-logo-alpha-1x/2x.webp` (spec 4.1). `tests/brand.test.js` requires the file `src/assets/wordmark.svg` to exist: keep a file or log the test change |
| src/assets/pawn.svg:1 | `aria-label="Passivo"` | UI (a11y) | `מקסי` |
| src/ui/screens/start.js:68 | comment: h1 accessible name `'פסיבו'` | code (comment; the name comes from he.json) | `MaxiFox` |
| src/styles/tokens.css:1 | header comment `פסיבו (Passivo)` | code (comment) | `MaxiFox` |
| src/ui/fox.js:1, src/styles/fox.css:1 | `Passivo the fox` | code (comment) | `Maxi the fox (מקסי)` |
| src/ui/learn.js:1, 26; src/ui/rich.js:3; src/ui/prefs.js:4; src/styles/board.css:198 | comments quoting `המילון של פסיבו` / `פסיבו מסביר` | code (comment) | `מקסי` |
| src/ui/app.js:182; src/ui/tutorial/story.js:1; src/ui/tutorial/index.js:40; src/learn/tutorial.js:1; src/learn/tutorial-store.js:1; src/learn/validate-tutorial.js:1; src/styles/tutorial.css:1 | comments `המשחק הראשון עם פסיבו` / `first game with Passivo` | code (comment) | `מקסי` / `Maxi` (index.js:40 also names `passivo.tutorial`: keep the key) |
| src/ui/debug.js:7, 13, 14 | `window.__passivoDebug` | code identifier (debug only, used by e2e) | keep, or rename with the e2e tests in one change; not user-visible |
| src/ui/play.js:1099-1100; src/ui/report.js:90, 101; src/ui/history.js:8 | `history.state.passivo` marker | code identifier | **keep** (internal; renaming gains nothing) |
| src/engine/daily.js:32 | `hashString('passivo-daily\|' + dateKey)` | code (seed) | **keep on purpose** (daily boards must not change) |
| src/services/storage.js:2 | `PREFIX = 'passivo.'` | code (storage) | **keep on purpose** |
| src/daily/store.js:1 | comment listing `passivo.daily*` keys | code | keep |

## 2. index.html, manifest

| Place | Current text | Type | Replace with |
|---|---|---|---|
| index.html:8 | `<meta name="description" content="פסיבו – משחק הכסף שעובד בשבילך. ...">` | store (SEO / share) | `MaxiFox – משחק הכסף שעובד בשבילך. ...` |
| index.html:12 | `<title>פסיבו – משחק הכסף שעובד בשבילך</title>` | store | `MaxiFox – משחק הכסף שעובד בשבילך` |
| index.html:27 | `<noscript>פסיבו דורש JavaScript</noscript>` | UI | `MaxiFox דורש JavaScript` |
| public/manifest.webmanifest:2 | `"name": "פסיבו – משחק הכסף שעובד בשבילך"` | store (install prompt) | `MaxiFox – משחק הכסף שעובד בשבילך` |
| public/manifest.webmanifest:3 | `"short_name": "פסיבו"` | store (home-screen label) | `MaxiFox` |
| public/manifest.webmanifest icons | `icons/*.png` | store | already replaced with the MaxiFox icons (same names and sizes) |

## 3. README.md

| Place | Current text | Type | Replace with |
|---|---|---|---|
| README.md:1 | `# פסיבו (Passivo)` | docs | `# MaxiFox` (one line: "formerly פסיבו / Passivo, renamed 2026-10-23") |
| README.md:7 | `the fox character Passivo` | docs | `the fox character מקסי (Maxi)`, plus the logo/character split (`design/fox-usage.md`) |
| README.md:159, 169 | `'המילון של פסיבו'`, `'הסברים של פסיבו'` | docs (quotes UI labels) | `מקסי` (must match he.json) |
| README.md:172 | `## The first game with Passivo` | docs | `## The first game with Maxi` |
| README.md:189 | `## The fox (Passivo)` | docs | `## The fox (מקסי / Maxi)`; add "the app icon and home logo are the gold MaxiFox logo, see design/brand" |
| README.md:168, 182, 197, 217, 222, 234 | `passivo.learn.*`, `passivo.tutorial`, `passivo.seenIntro`, `passivo.dailySave`, `passivo.dailyStreak`, `__passivoDebug` | docs (code names) | **keep**; add one note that the `passivo.*` keys are kept on purpose |

## 4. business/

| Place | Current text | Type | Replace with |
|---|---|---|---|
| business/marketing/store-listing.he.md:5, 71 | `פסיבו – משחק הכסף שעובד בשבילך` (name, 30 chars) | store | `MaxiFox – משחק הכסף שעובד בשבילך` (32 chars: **over the 30-char Play limit**, marketing must shorten, e.g. `MaxiFox – הכסף עובד בשבילך` (26)) |
| business/marketing/store-listing.he.md:73 | short-name fallback `פסיבו` | store | `MaxiFox` |
| business/marketing/store-listing.he.md:15, 56 | `פסיבו הוא משחק...` | store | `MaxiFox הוא משחק...` |
| business/marketing/store-listing.he.md:25 | `פסיבו השועל אומר` | store (character line) | `מקסי השועל אומר` |
| business/marketing/store-listing.he.md:26, 81 | `במילון של פסיבו`, `משפט משוב מפסיבו` | store | `במילון של מקסי`, `משפט משוב ממקסי` |
| business/marketing/store-listing.he.md:68 | keyword note: the name already contains `פסיבו` | store (ASO) | redo the keyword note: the Latin name no longer covers a Hebrew keyword |
| business/marketing/store-listing.he.md:94 | check the name `פסיבו`/`Passivo` is free | store | check `MaxiFox` (trademark check still open, decisions 2026-10-23) |
| business/marketing/store-listing.en.md:5, 63 | `Passivo – Money Board Game` | store | `MaxiFox – Money Board Game` (26 chars, fits) |
| business/marketing/store-listing.en.md:15, 49 | `Passivo is ...` | store | `MaxiFox is ...` |
| business/marketing/positioning.md:1, 4, 6, 11 | name and pitch lines | docs (feeds store copy) | `MaxiFox`; line 11: "one Latin wordmark in both languages, character מקסי" |
| business/marketing/positioning.md:48 | reason 7: "the name פסיבו says passive income" | docs | rewrite: the argument no longer holds; new reason (the character name, the fox/"max" idea) is marketing's call |
| business/marketing/screenshots-plan.md:1, 18, 26 | title, `"פסיבו מסביר"` screen, `הלוגו "פסיבו" גדול` | docs (store art brief) | `MaxiFox`, `מקסי מסביר`, use `design/brand/maxifox-logo-alpha-2x.webp` and `design/brand/feature-1024x500.png` |
| business/marketing/launch-plan.md:1, 10 | title; search `Passivo`/`פסיבו` in the stores | docs | `MaxiFox`; search `MaxiFox` / `מקסיפוקס` / `Maxi Fox` |
| business/sales/pricing.md:1 | `מחירון קנוני — פסיבו (Passivo)` | docs | `MaxiFox` |
| business/sales/b2b.md:29 | `אנחנו מפתחים את "פסיבו"...` | store-like (school outreach letter) | `MaxiFox` |
| business/sales/b2b.md:36 | signature `[שם], פסיבו` | store-like (outreach) | `[שם], MaxiFox` |
| business/finance/summary.md:1 | `סיכום פיננסי - פסיבו (Passivo)` | docs | `MaxiFox` |

## 5. docs/

Recommendation: rename the titles of **living** docs (still read for current work) and leave the **historical** record as written.

| Place | Current text | Type | Replace with |
|---|---|---|---|
| docs/decisions.md:9, 10, 11, 22, 31, 34, 36, 43 | earlier decisions naming פסיבו / Passivo | docs (historical log) | **keep as written** (a log is not rewritten); row 53 already records the rename |
| docs/plan.md:1 | `תוכנית — פסיבו (Passivo)` | docs (living) | `MaxiFox` |
| docs/BALANCE.md:1 | `# Balance (Passivo)` | docs (living) | `MaxiFox` |
| docs/v3/design/spec.md:1, 164, 263 | title, start screen, mascot section | docs | **done in this pass** (logo on home, section 5 "Brand and mascot usage") |
| docs/v4/design/board-spec.md:1 | title `Passivo v4` | docs (living) | `MaxiFox v4` |
| docs/v4/design/board-spec.md:283 | `aria-label="פסיבו: הודעה אחרונה"` | docs (quotes UI) | `מקסי: הודעה אחרונה` |
| docs/v4/design/board-spec.md:297 | `"פסיבו מסביר"` | docs (quotes UI) | `מקסי מסביר` |
| docs/v4/decision-cards.md:1; docs/v4/milestones.md:1; docs/v4/strings-proposals.md:1 | titles `Passivo v4` | docs (living) | `MaxiFox v4`. Check milestone fox lines for a self-named `פסיבו` before they ship (none found by grep) |
| docs/v4/strings-proposals.md:5 | file name `דוח-QA-פסיבו.md` | docs (name of a missing file) | keep (it is the owner's file name) |
| docs/v3/learn/glossary-fix.md:1, 44 | title; quotes `פסיבו מסביר`, `המילון של פסיבו` | docs (historical) | keep, or add "(now מקסי)" |
| docs/v2/* (ideas.md 1, 5, 16; roadmap.md 1, 4, 35, 38, 175; roadmap-status.md 14; numbers-proposal.md 1; learn/spec.md 138, 142, 179; tutorial/spec.md 1, 31, 35, 37, 65, 66, 178) | v2 planning texts and specs | docs (historical) | keep. Exception: roadmap-status.md:14 `passivo.app` domain is an open owner question: the invite link now needs a MaxiFox domain (money matter, owner) |
| docs/v2/learn/spec.md:142; docs/v2/tutorial/spec.md | `passivo.learn.seen`, `passivo.tutorial.storyDone` | docs (storage keys) | **keep** |

## 6. Outside the requested scope, but affected

| Place | Current text | Type | Replace with |
|---|---|---|---|
| package.json:2, 6 | `"name": "passivo"`, description `פסיבו (Passivo)` | code | `maxifox`, `MaxiFox - financial board game` |
| vite.config.js:23, 61 | plugin names `passivo-pwa`, `passivo-prune-learn` | code identifier | optional, cosmetic |
| vite.config.js:31-39 | LCP preload of `tired`/`wave` keyed on `passivo.seenIntro` | code | the home LCP image is now the logo: preload `maxifox-logo-alpha-2x.webp` instead (key stays) |
| public/sw.js:4, 18 | cache name `passivo-${BUILD}`, cleanup filter `passivo-` | code identifier | keep; if renamed to `maxifox-`, the cleanup filter must still delete old `passivo-` caches |
| scripts/make-icons.mjs, scripts/make-icons.py (`npm run icons`) | rebuilds icons from `design/character/passivo-fox-hero.jpg` | code | **retire or repoint**: running it now overwrites the new MaxiFox icons. Replacement: `design/brand/scripts/` |
| scripts/make-wordmark.py | builds the פסיבו / PASSIVO wordmark | code | retire (the wordmark is the logo now) |
| scripts/v3-screens.mjs:64-71 | `passivo.*` keys | code | keep |
| tests (60 hits): tests/daily.test.js:355-380, tests/round11.test.js:108, tests/e2e/daily-smoke.mjs:275, 349 (`פסיבו אתגר יומי`); tests/round7.test.js:175 (`המילון של פסיבו`); tests/e2e/smoke.mjs:637, 675, 683 (`פסיבו מסביר`, `הסברים של פסיבו`), 1217 (h1 `'פסיבו'` + wordmark); plus comments in tests/tutorial.test.js, tests/learn.test.js, tests/e2e/*-smoke.mjs | code (assertions) | the rename is owner-approved, so these assertions change with it; log each in `docs/v4/test-changes.md` (decisions 2026-10-23 test rule). smoke.mjs:1217 also checks `h1.wm` (the wordmark), which changes with the logo on home |
| design/directions.md:1, design/character/needed.md:1 | titles naming פסיבו / Passivo | docs (design history) | designer updates titles; `design/fox-usage.md` is done |
| design/character/passivo-fox-hero.jpg (file name) | file name | code (path) | keep (renaming breaks scripts; not shipped) |
