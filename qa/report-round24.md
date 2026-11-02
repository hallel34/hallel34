# QA report — round 24 (PR 17, HEAD 4f8b571) — **GREEN** (P0 0 · P1 0 · P2 0)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round24/` (19 WebP, commit 239fe82).

## Gate
vitest 692/692, build OK. Smokes: family 349, full 248, 2p 177, 640 349/248, daily 119, r11 109, r12 134, tutorial 99, business PASSED, payday 54, mission/missions PASSED, players (new) 34, all 0 FAIL. Contrast 0 fail, axe 0, no scroll, 0 console errors. Lighthouse home perf 0.92–0.94, a11y/BP/SEO 1.00. The CI step for smoke:players is green locally.

## Seats
11 configs (HB, BH, HBB, BHB, BBH, HHB, HBH, BHBH, HBBB, BBBH, HHHH) at 360 dark, with 3 of them also at 390 light and 320 dark and light. The first person was "עד 10" in each.
- **Fresh setup:** every seat is a person; seats render top to bottom.
- **Forward:**
  - Picks only for people, in seat order, with no phantom pick for a trailing bot.
  - The person always plays first.
  - Ages and policies are kept, and the game is junior.
- **Back from pick and after a hot-seat game:** reopens with the person in seat 1 and bots below; data is kept.
- **Last-person rule and count reduction:** covered by smoke:players and seats.test.js.

## Notes (P3)
- The native radio inside the bot chip is 45×52, but the tappable label is 49×56: it passes with a 1px margin.
- When seat 1 is set to a bot, the match silently moves the person to first. This follows the spec, but the screen doesn't say so.

## Test rows
`tests/seats.test.js` and `smoke:players` add coverage. No existing test was changed.
