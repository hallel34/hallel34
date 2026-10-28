# Short-mission library

This branch builds on PR 13. It adds two optional decisions and a chooser, without
merging PR 13, changing the live site, or adding new financial rewards or badges.
No claim of improved retention is made: family observations in the work plan
remain outstanding.

## Available practice

- First asset: the existing original-card lesson and badge remain intact.
- Small debt, big decision: repay the original teacher's 5,000 credit-card debt,
  or keep the cash. Repayment leaves 4,000 cash, 18,000 personal debt and monthly
  flow 1,640, compared with 9,000 cash, 23,000 debt and monthly flow 1,490.
- Unexpected expense: use the original 4,500 washing-machine expense. Paying cash
  leaves 4,500 cash and unchanged monthly flow. A 5,000 bank loan, in the game's
  original 1,000 steps, leaves 9,500 cash and 28,000 personal debt, while monthly
  flow falls by 50 to 1,440. Interest does not repay principal.

Every lesson starts independently with the original teacher's 9,000 savings.
The expense's funding choices are explicitly scripted practice, using
`engine.decide` for atomic payment/financing. Repayment uses `engine.repayLoan`.
Ordinary-game decks, original card records and economy rules are unchanged.
Both sides of each tradeoff are explained; no choice is universally endorsed.

## Save compatibility

| Data | Device-local key |
| --- | --- |
| Ordinary game | `passivo.save` (unchanged) |
| Daily challenge | `passivo.dailySave` (unchanged) |
| Existing first asset | `passivo.missionSave` (unchanged) |
| Debt practice | `passivo.missionSave.repay-debt-v1` |
| Expense practice | `passivo.missionSave.cash-buffer-v1` |
| Practiced-lesson history | `passivo.learn.missions` |

Each freeplay continuation and rematch remains in its originating mission slot.
No save-schema migration is needed. The chooser reads existing first-asset saves.
Starting over asks for confirmation and replaces only that mission's save.
Cancelling preserves it byte-for-byte. Device history is informational, not a new
reward system, and has no personal data, analytics or streak penalty.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4182
# In another terminal:
MISSION_URL=http://127.0.0.1:4182/ npm run smoke:mission
MISSION_URL=http://127.0.0.1:4182/ npm run smoke:missions
```

Install Chromium with `npx playwright install chromium` as needed. To use an
existing executable, set `CHROMIUM_PATH`. Both mission suites run in PR CI.

## Acceptance coverage

- All four new choices, with actual financing/payment amounts.
- Offer/result refresh, double click and no duplicated loan or expense.
- Simultaneous preservation of the ordinary, daily and three practice saves.
- Freeplay, debug win/rematch and safe replay confirmation/cancellation.
- No new badges or financial rewards; practiced history survives retries.
- Corrupt metadata recovery and explicit unsaved play when storage is blocked.
- Responsive chooser, previews and results at mobile and desktop sizes.
- Existing first-asset suite and short-phone daily-result home regression.
