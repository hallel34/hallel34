Original prompt: תמשיך את הפיתוח

## Scope
Continue the approved MaxiFox work plan with R1–R4 in a separate branch.
Use existing engine rules and original deal data, isolated mission persistence,
clear net financing feedback, a cosmetic first-purchase badge and voluntary exit.
Do not merge to main without approval.

## Follow-up: additional short missions
User replied "כן" to adding the next short missions. Work continues on
`maxifox-short-missions`, based on PR 13, without merging it.

- Added an optional three-lesson chooser, original first-asset save compatibility,
  credit-card repayment practice and unexpected-expense funding practice.
- Each new lesson uses the actual engine and a separate save slot.
- No new badges or financial rewards; no universally correct-choice claims,
  locks, countdowns, account data or retention claims.
- Added informational device history and confirmed, cancel-safe lesson retries.
- Added 14 unit cases and a browser suite for both new lessons and all choices.
- Updated the original lesson suite to navigate through the chooser.
- Details and reproducible commands: `qa/SHORT-MISSIONS.md`.
- Verification so far: 663 unit tests / 33 files passed; production build passed;
  both mission browser suites passed against the production build, including
  320×568 home, 375px/1440px decisions, denied storage and isolated rematches.
  Full regular, extended daily and business-demo regressions also passed.
  Deployed preview was verified in a fresh cloud browser: three lessons, actual
  repayment figures, expense financing and explicit unsaved freeplay all work.

## Implemented
- Fixed, explicitly labelled family-mode practice scenario using the original
  popcorn-cart card and teacher finances. No extra cash or modified rules.
- Real-engine financing preview: 1,600 business income - 700 business financing
  - 310 monthly interest on a 31,000 additional loan = 590 net monthly improvement.
- An isolated `missionSave` slot, reload-safe one-time purchase, voluntary refusal,
  retry and exit, plus freeplay with the actual purchased asset and debt.
- Device-level cosmetic purchase badge, no financial reward.
- Honest failure messages for blocked storage and an explicit unsaved exit.
- Explicit unsaved freeplay option for storage-restricted preview environments.
- Freeplay rematches retain the mission slot rather than replacing a normal save.
- CI smoke coverage and configurable Chromium path in the business-demo smoke.

## Verification
- 649 unit tests passed across 32 files, including six new economic/storage tests.
- Production build passed; existing >500 kB chunk warning remains.
- Full legacy smoke passed, including regular play to win, multiplayer, glossary,
  notes, offline/service-worker checks, and zero console/network failures.
- Business-demo smoke passed in both normal and promotional modes.
- New mission browser smoke passed at 375px and 1440px: preview, purchase,
  double-click, reload, refusal/retry, badge, normal/daily slot preservation,
  freeplay, debug win/rematch isolation, corrupt save, blocked storage.
- Visually checked dark mobile, light desktop, small 320×568 home and the
  supplied game's Playwright screenshot client. No mission browser JS errors.
- `npm audit --omit=dev`: zero production vulnerabilities. Existing development
  dependencies have audit findings; not force-upgraded as part of this change.
- Extended daily smoke found a single regression: Start fell below the viewport
  after a daily result at 320×568. Tightened only the short-phone hero minimum,
  added a mission-suite regression, and verified Start and non-overlapping logo.
  The full extended daily suite was rerun after the fix and finished with
  `DAILY SMOKE PASSED`, including 320×568, save isolation and the next day.

## Remaining roadmap
- Additional short missions, progressive feature unlocks, and a returning-player
  home screen are not included in this first milestone.
- No default-branch merge or production-site deployment is authorized or performed.
