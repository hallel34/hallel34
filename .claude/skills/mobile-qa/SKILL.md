---
name: mobile-qa
description: QA procedure for a mobile-first web game — Playwright E2E at 360x800, overflow and touch-target checks, Lighthouse, accessibility and bug reporting format. Use for every QA round of יוצאים מהמרוץ.
---
# Mobile QA

## Setup
- `npm i -D @playwright/test && npx playwright install chromium`
- Project config: `devices['Pixel 5']` overridden to 360x800, plus
  412x915 and 360x640. Locale `he-IL`. Run against `vite preview`.
- Engine exposes `?seed=123&debug=1` for deterministic runs (ask the
  developer to add it if missing — that's a P1 bug).

## Must-have checks (helpers to write once in `/tests/e2e/helpers.js`)
```js
// no horizontal scroll
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
// touch targets
const small = await page.$$eval('button, [role=button], a', els =>
  els.filter(e => { const r = e.getBoundingClientRect();
    return r.width && (r.width < 48 || r.height < 48); }).length);
expect(small).toBe(0);
```
Run both on every screen. Screenshot every screen in both themes to
`/qa/screens/<screen>-<theme>-<w>x<h>.png` and look at them.

## Flows
1. New game → each profession selectable → statement numbers match JSON.
2. Roll 30 turns with a seed; every square type is hit at least once.
3. Buy with enough cash; buy with short cash → loan prompt → buy.
4. Pass. Unexpected expense with no cash → loan.
5. Reload mid-game → same state. Win via seed → win screen.
6. Force bankruptcy via seed → game over → play again works.
7. Offline: load once, go offline, reload → game still works.

## Other
- Lighthouse CI mobile (`@lhci/cli`): perf ≥90, a11y ≥95, PWA pass.
- axe-core scan per screen: 0 serious/critical.
- Console: 0 errors during all flows.

## Bug format
`### [P0|P1|P2] Title` — Screen, Steps, Expected, Actual, Screenshot.
P0 = crash/blocked/data loss. P1 = wrong rule, layout broken at
360px, a11y blocker. P2 = polish.
