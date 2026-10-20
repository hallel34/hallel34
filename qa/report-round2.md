# QA report — round 2 (commit f10a27a) — **GREEN** (P0 0, P1 0, P2 9)
Relayed by CEO from qa-tester.
- npm test 71/71; build OK; 12 full playthroughs (family+full, dark+light, 360x800/360x640/412x915) all reach win; no horizontal scroll (also 320x568); no touch target <48px; 0 console errors; axe 0 violations on all screens; Lighthouse mobile 0.99 / 1.00 / 1.00 / 1.00; PWA installable, offline + resume OK; ?debug=1 win/lose OK.
- All round-1 P1/P2 verified fixed.
- Simulation (300 games): family sensible 100% win median 19; alwaysBuy 66% win/34% lost; full sensible 100% median 22; cautious 99%; alwaysBuy 78%/22% lost; alwaysPass never wins.

## Open P2
1. Payday ×24 months not explained on screen (log hidden at ≤700px height; float text unlabeled; statement silent).
2. Loan dialog/limit ignores the 24-month payday: a max loan (e.g. driver ₪26,000) loses the game at the next payday with no warning.
3. HUD wraps at 5-digit cash → 17px (family) / 30px (full) vertical scroll at 360x640 and a layout jump.
4. Full-mode loss rate for sensible/cautious bots 0–1% (target 5–15%).
5. Buy cards lack a payback indicator; green cash-flow badge misleading on trap cards.
6. opp-apt-012 text promises a balloon payment the engine doesn't have.
7. opp-apt-007 text ("rent almost pays the mortgage") contradicts its +₪10,000 cash flow.
8. Win screen: 4th stat tile orphaned in the 3-column grid.
9. Profession spread (lawyer ~6 turns slower than cook).
