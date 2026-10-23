# v4: changed existing tests (developer, v3 Phases 1, 2 and 4 + the v4 brief)

Rule (owner, v4 brief C): an existing test changes only when a change that the owner already approved forces it. Each change is minimal. New test files are not listed here (`tests/glossary-examples.test.js`, `tests/categories.test.js`): they only add checks.

| # | File | Test | Old expectation | New expectation | Why the requirement forces it |
|---|---|---|---|---|---|
| 1 | tests/round11-fix.test.js | arming guards > the hand-over button ignores taps for 700 ms and the sheet has a home link | source contains `armed` and `'aria-disabled': 'true'` | source contains `arm([`, and widgets.js sets `disabled` + `aria-busy` + `data-arming` | Spec 3.1 / 9.2: arming uses a real `disabled` instead of aria-disabled (approved example: real `disabled` replacing is-blocked) |
| 2 | tests/round12.test.js | the home link arms with the same sweep as the primary button | `btn-handoff-home is-arming` in modals.js; `.btn-handoff-home.is-arming::after` in tutorial.css | both hand-over buttons go through `arm([...content.querySelectorAll('.sheet-cta .btn')]`; the bar is `.btn-text[data-arming]::after` in components.css | same as 1 |
| 3 | tests/tutorial.test.js | one-tap hand-over > play.js: no continue mode... | `if (tapped \|\| !armed) return;` | `if (tapped) return;` (taps during arming reach a real `disabled`) | same as 1 |
| 4 | tests/ui-flow.test.js | buy button is truthful > uses a blocked (aria-disabled) state... | `'aria-disabled': a.blocked ? 'true' : null` and the `shake()` / error-haptic path | `disabled: !!(a.disabled \|\| a.blocked)` | Spec 9.1: a blocked Buy is a real `disabled`; a disabled button cannot be tapped, so the shake path is gone |
| 5 | tests/kid-vocabulary.test.js | FORBIDDEN list | no `תקופת החזר` | `תקופת החזר` added | Phase 4 brief + glossary-fix.md 4 (approved תקופת החזר wording) |
| 6 | tests/e2e/smoke.mjs | 'theme-color is navy' | `#0f1e46` | `#0f172a` | Phase 1 brief: theme-color literals #0F1E46 -> #0F172A |
| 7 | tests/e2e/smoke.mjs | 'unaffordable even after the max loan: buy is aria-disabled' | `aria-disabled="true"` | the button is `disabled` | same as 4 |
| 8 | tests/e2e/smoke.mjs | 'blocked buy looks disabled (dashed outline, flat colour)' | dashed border | the disabled Buy carries the "לא זמין" tag | spec 9.1 retires the dashed is-blocked style; v4 O4 asks for the "לא זמין" label |
| 9 | tests/e2e/smoke.mjs | L1: the dictionary lists N concepts | family 10 / full 13 | family 11 / full 14 | approved: concept counts (new `roi` concept, glossary v3) |
| 10 | tests/e2e/smoke.mjs | L2: green light label; L2: red deal label | `החזר מהיר` / `החזר איטי או אין החזר` | the guess.he.json labels: family `הכסף חוזר מהר` / `הכסף חוזר לאט או לא חוזר`, full `תקופת החזר קצרה` / `תקופת החזר ארוכה או שהכסף לא חוזר` | approved תקופת החזר wording (these two checks already failed on the base commit) |
| 11 | tests/e2e/round11-smoke.mjs | hand-over: aria-disabled while arming... / armed once the fill is done | `getAttribute('aria-disabled')` `'true'` / `null` | `button.disabled` true / false | same as 1 |
| 12 | tests/e2e/round12-smoke.mjs | hand-over: the home link shows the arming sweep / is armed together | `.is-arming` class + `aria-disabled` | `data-arming` attribute + `disabled` | same as 1 |

One test fixture change I made earlier was reverted: `tests/engine.test.js` is back to its original content, because the loader now accepts a card without `category` (the neutral icon is shown). Every shipped card still has one, and `tests/categories.test.js` checks that.

## Blocked items (each would need an existing test to change, so it was not wired in: owner decision needed)
| Item (brief / spec) | Test that pins the old behaviour | State |
|---|---|---|
| Payday float confined to the board plaza (spec 4.9, Phase 2) | tests/ui.test.js 'B2: the payday float is placed under the HUD' (source check for `{ below: hud }` and `below.getBoundingClientRect().bottom`) | `floatText(..., { within })` is implemented in fx.js, but play.js still passes `{ below: hud }` |
| Payday chip with 3 copy variants + stacked-equation popover (spec 4.9, Phase 2) | tests/e2e/smoke.mjs 'B1: payday amounts are wrapped in <bdi> (chip ...)' and 'N3: log shows the maths' (the roll-zone chip must contain `סיכום שנתיים`, `× 24` and `=`) | `src/ui/payday.js` (variants A/B/C, chip, popover, strings in he.json `payday.*`) is ready but not wired; the chip keeps the one-line log |
| Stacked equation in the statement hero (spec 4.6 / 4.9) | tests/ui.test.js 'payday messages ... are built from <bdi dir=ltr> nodes' (source check for `paydayCalc(st.monthlyCashFlow, PAYDAY_MONTHS` in statement.js) | the hero keeps the one-line `paydayCalc`; the stacked equation is used in the payday summary sheet only |
| True minus U+2212 in the money component (spec 6.1 rule 3) | smoke.mjs summary-card / statement number parsers (`replace(/[^\d-]/g, '')`), tests/ui.test.js moneyText `-₪800` | the component keeps the ASCII hyphen-minus |
