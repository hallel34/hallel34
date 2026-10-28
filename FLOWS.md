# Main flows and first-asset acceptance checks

## Additional short missions: acceptance checks
- Home → mission chooser → first asset, debt repayment or unexpected expense.
- No lock, countdown, new reward mechanism, or financial advice asserting a universally correct choice.
- Original first-asset save still resumes unchanged after switching to the chooser.
- Repay credit-card principal 5,000: cash 4,000, debt 18,000, monthly flow 1,640; keeping cash changes no finances.
- Pay expense 4,500 from cash: cash 4,500, no new debt; financing: cash 9,500, added debt 5,000, monthly flow 1,440.
- Every decision uses the actual engine, commits once under double click, and restores after reload.
- All three mission saves, normal save and daily save are independent, including freeplay rematches.
- Mission history persists on this device without extra badges, money, pressure, or collecting personal data.
- Blocked storage allows explicit unsaved exit/freeplay; invalid saves never crash the chooser.
- Check chooser, offers, results and the home daily-result case at 320/375px and desktop in both themes.

Original request: תמשיך את הפיתוח

## Existing flows
- Home: family/full mode switches, glossary, how-to, settings, daily entry remain available.
- New game: players → profession → optional story → board → roll and resolve an event.
- Resume: saved normal game survives opening a mission and refreshing.
- Daily: starts/resumes in its own slot, independently of missions and normal games.
- Board: financial statement opens; menu saves progress; normal game resumes.

## First asset
- Home offers an explicitly labelled practice mission, independent of selected normal-game mode.
- Mission opens a fixed, original-data opportunity, without a die roll or extra cash.
- Before buying, show business income, business-loan payment, additional bank loan and payment, and net monthly improvement.
- Buying uses the existing engine, once; refreshing restores the result without applying the transaction twice.
- Declining is allowed, gives no purchase badge, and allows retry or exit.
- Purchase earns a cosmetic, device-level badge, visible on home after reload/new game.
- Exit reports failed persistence honestly and never overwrites the normal/daily slots.
- Continue opens the same mission state on the normal board using a separate save slot.
- No nonexistent next-mission button, penalties, or pressure to continue.

## Responsive and exploratory checks
- Check home, offer and outcome at 375×812 and desktop; no horizontal overflow or clipped controls.
- Test rapid double-click purchase, refresh before/after purchase, decline/retry, old normal save preservation.
- Test invalid mission save and blocked localStorage; no crash or false save confirmation.

## Recorded results
- Main regression smoke: passed, including game completion and offline.
- Business-demo regression smoke: passed.
- Mission: all acceptance checks passed at 375px and 1440px, including double
  click, restoration, decline/retry, corrupt save and denied persistence.
- Mission freeplay win/rematch: normal save stays unchanged.
- Dark mobile and light desktop: screenshots visually inspected.
- Extended daily suite found a short-phone daily-result home regression. Fixed;
  its exact 320×568 case now passes the mission suite. The full daily rerun
  finished with `DAILY SMOKE PASSED`.
