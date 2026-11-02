# First-asset mission QA

This branch implements R1–R4 of the short-mission roadmap. It does not change
ordinary-game money, profession rules, card data or random deck order.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4182
# in another terminal
MISSION_URL=http://127.0.0.1:4182/ npm run smoke:mission
```

Install Chromium first with `npx playwright install chromium` if needed. An
existing browser executable can be supplied through `CHROMIUM_PATH`.
The smoke also works against an existing preview's URL.

## Expected economics

The scenario uses the teacher's original 9,000 cash and original popcorn-cart
card (`opp-biz-006`). Its 40,000 down payment requires a 31,000 bank loan.
Monthly business income is 1,600, existing business financing costs 700, and
the additional bank interest costs 310. Net monthly improvement is 590;
remaining monthly cash flow moves from 1,490 to 2,080. Bank interest does not
repay the 31,000 principal, as the offer explicitly explains.

## Data safety

The mission and subsequent freeplay/rematches use `passivo.missionSave`.
Neither `passivo.save` nor `passivo.dailySave` is replaced or cleared by the
mission. The cosmetic `first-asset` badge uses the existing device badge store.
All data is device/browser-local, not account-synced.

The smoke tests failed persistence, explicit unsaved exit/freeplay, invalid JSON recovery,
double-click purchase, save/load idempotency, refusal/retry, badge persistence,
freeplay and a freeplay win/rematch without replacing a normal save.

## Deliberate limits

- One practice mission, no fabricated next-mission button.
- Practice always uses family rules and shekels, independently of the chosen
  normal-game mode. The entry and introduction label this as separate practice.
- Cosmetic badge only; no money, penalty, countdown or pressure loop.
- No merge to the default branch (`ccr-1d500e6e-hred4o` at the time of this
  milestone) or deployment to live GitHub Pages without owner approval.
- Existing development-dependency audit findings and build-size warning remain
  outside this milestone; production dependency audit reports zero findings.

## Final local results

649 unit tests passed. The regular full-flow smoke, business-demo smoke, extended
daily smoke and mission smoke all passed. The daily suite initially caught Start
falling below a 320×568 viewport after a daily result; the short-phone hero minimum
was corrected, the exact regression added to mission CI, and the entire daily
suite rerun successfully. The storage-restricted preview also has an explicit
continue-without-saving path, covered by the mission browser smoke.
