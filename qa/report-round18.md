# QA report — round 18 (HEAD 83b4854) — **RED** (P0 0 · P1 1 · P2 3)

Author: the independent qa-tester. The CEO saved the report text as delivered. Evidence: `qa/screens/round18/` (28 WebP, commit bee7811).

## Gate
vitest 604/604, build OK. Smokes: family/full 310/253, 2p 178, 640 310/253, daily/r11/r12/tutorial 119/133/134/99, all 0 FAIL. Contrast 0 fail, axe 0 violations, no scroll, 0 console errors. Lighthouse perf 0.90–0.95, a11y 1.00. CI run 40302920704 green.

## Passed
- **Junior path (5 games × 4 viewports):** coins with no ₪ on HUD, cards, payday, statement, loan dialog and pick screen. Payday X × 12 = total, and cash moves exactly that much. Loans are 1 coin a month per 100 coins. The "להורים" toggle and the parent card "כל מטבע = ₪100" work. No die in the roll button.
- **Age picker:** fieldset with 3 radios, ≥48px, under 14 → family, "עד 10" → coins.
- **Hot-seat with mixed ages:** display per player, rules game-wide.
- **Old saves:** v2.5 and schema 5 → schema 6 with today's behaviour.

## [P1] Junior decision cards show shekels and large numbers
- **What:** the story and the "מה זה מלמד" text of dec-001/005/008/009f keep ₪ amounts (₪2,000,000 / ₪80,000 / ₪40,000…) while the options are in coins.
- **Cause:** the coin text conversion isn't applied to the decision card title, text or teaches.
- **Test gap:** testJunior has no decision card.

## P2
1. Payday at 320x568 drops "× 12".
2. The junior pick sheet shows "תזרים התחלתי" / "הכנסה פסיבית" when starting from full mode and switching by age; the learn mode doesn't switch.
3. The loan dialog cap "מתוך 1,000 מטבעות" is a 4-digit number outside the allowed list.

## P3
- Two coins in the HUD at 320.
- U+2212 on one payday line.
- `.vh` text not scanned for adult words.

## Test-change review
No row weakens coverage.
