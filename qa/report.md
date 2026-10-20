# QA report — round 1 (branch ccr-6e0ec1cd-enmcaj)
**Verdict: RED** — P0: 0, P1: 2, P2: 9. (Report text relayed by CEO from qa-tester.)

## Passed
npm test 61/61; build OK; Playwright 360x800 family+full, dark+light; no horizontal scroll (360x800, 360x640, 412x915, 320x568); no touch target <48px; RTL OK; 0 console errors; save/resume and offline OK; PWA installable; Lighthouse mobile Perf 0.95 / A11y 1.00 / BP 1.00 / SEO 1.00 (re-run on the real PR preview); content minimums (24/15/15) and originality grep clean; visual quality matches DIRECTION-v2.

## Simulation (100 games, professions rotated)
| mode | bot | win% | lost% | avg turns |
|---|---|---|---|---|
| family | sensible | 100 | 0 | 20.2 |
| family | alwaysBuy | 92 | 8 | 22.5 |
| family | cautious | 93 | 7 | 47.2 |
| full | sensible | 100 | 0 | 21.2 |
| full | alwaysBuy | 97 | 3 | 21.5 |
| full | cautious | 87 | 10 | 62.7 |
alwaysPass never wins in either mode.

## P1
1. **Deal economics unrealistic; alwaysBuy ≈ sensible.** Good deals pay back in 0.5–0.7 years (target 3–8); only ~6/21 non-stock cards are traps. Fix in cards.he.json: raise down payments / lower cash flow, ~35–40% traps, re-simulate (alwaysBuy must lose ≥15% or be clearly slower; median stays 15–25).
2. **Progress meter has no accessible name** (axe aria-progressbar-name, serious) on board HUD, win, statement.

## P2
1. Family mode shows non-round numbers (₪40,500, ₪909,500). 2. Stock dividends 4.5%/month, all three stocks interchangeable. 3. Business cards label the loan "משכנתא". 4. Loan button enabled at the loan limit (dialog has only Cancel). 5. Copy: exp-004 gender ("זו חתיכה קטנה"); exp-015 title doesn't match body. 6. ~280px dead space between board and roll button at 360x800. 7. Low contrast on the "מלא" mode card over skyline. 8. No ?debug=1 force win/lose flag. 9. axe moderate: no <main>, no <h1> on board.
