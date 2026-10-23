# v3.1 self-review checklist (run on EVERY Phase 2 screenshot before it is called done)
Capture each screen at **390x844**, **360x800** and **320x568**, dark theme, plus light for the key screens, family AND full mode where the screen differs. Look at the image; do not infer from the DOM. A screen is done only when every applicable line is a yes. Rule numbers refer to `docs/v3/design/spec.md` section 0.

## A. Hierarchy (rule 1-2)
- [ ] Exactly ONE solid-gold filled control on the screen (wordmark, title art and fox art do not count). Count them.
- [ ] No gold border, gold glow, gold fill or gold text on any non-primary element (selected states are white-ringed; cash is white; meter is teal).
- [ ] Secondary actions are hairline ghosts; tertiary actions are plain text; none looks like a primary.
- [ ] Guess prompt: two EQUAL ghost buttons, no red/green, no gold.
- [ ] Home: the daily-challenge row is a ghost, not gold.
- [ ] The primary sits in the bottom thumb zone and is >= 56px high (64 for roll/start/play again).
- [ ] Nothing else on the screen is louder than the primary or the two key numbers.

## B. Flat and opaque (rule 3-4)
- [ ] No gradient on any button or card (zoom to 200% on button edges: no highlight line, no drop shadow edge, no bevel).
- [ ] Backgrounds show at most a faint tonal shift.
- [ ] Every card, dialog and sheet is fully opaque: nothing from the board is readable through it; scrim reads as near-black.
- [ ] Charity card checked specifically (owner report), in both modes.

## C. Deal card (rule 5-6, spec 3.2)
- [ ] 3px ribbon on the top edge, colour = verdict (neutral before the reveal); the card body is NOT tinted.
- [ ] 1px top highlight visible on the cream card; hairline border; no 4px gold ring.
- [ ] Verdict pill has an icon AND a text label (green check / yellow minus / red close; family: amber + hourglass).
- [ ] Family mode: NO red anywhere on the card, pill, banner, ribbon, button.
- [ ] Down payment and monthly cash flow are the two largest elements; everything else is visibly quieter.
- [ ] No fox crop, no banner art, no big category illustration; category chip + label present (opportunity cards only).
- [ ] Long card: bottom fade + chevron visible while more content exists; both gone at the end of the scroll. Screenshot top AND bottom (`06b`/`06c` equivalents).
- [ ] Footer (banner + buttons) <= 148px at 844, the card is never more than half buttons/banner.
- [ ] Buy disabled state is a real `disabled` (50%) and the reason banner is visible.
- [ ] Entrance is a <= 200ms fade/rise (record a trace: no flip).

## D. Category system (rule 8)
- [ ] Revealed deal, assets list and monthly-report rows show the right icon + colour for the card (check 5 different cards against `category-map.md`).
- [ ] **Board tiles: the opportunity tile is the neutral house glyph on every tile; no category icon on any tile.**
- [ ] Same stroke weight and corner style across category, profession and existing icons.
- [ ] Light theme: category icons use the `-ink` colours and are legible on paper.

## E. Money typography (rule 7)
- [ ] Every amount is tabular, has separators, no abbreviation, `₪` before the number, never wraps.
- [ ] Negatives show `−` AND are muted red (`#E57373` on dark, `#B42318` on cream/white); family: amber, still with the sign.
- [ ] Every amount inside a Hebrew sentence is isolated: read the screenshot RTL, the sign/symbol stay glued to the digits (look at: statement `.st-sub` lines, "חסרים לכם", loan intro and limit label, charity text, report fox lines, family chip).
- [ ] Stacked payday equation: never wraps mid-equation at 390, 360, 320; labels contain no amount.
- [ ] Count-up / live loan values keep the `₪` styling after updates.

## F. Buttons and states (rule 6)
- [ ] Disabled = 50% of the variant, no focus (Tab skips it), `disabled` attribute present, no `aria-disabled`.
- [ ] Arming (hand-over, payday summary) is visibly NOT disabled: outlined gold + bar, then snaps to solid; `disabled` + `aria-busy` during the window; focus lands on the button when armed.
- [ ] Pressed states exist for primary / ghost / text.
- [ ] Focus ring visible on every control (Tab through the whole screen, screenshot one mid-tab): 3px, gold-300 on dark, navy inside cards.

## G. Professions (spec 4.2)
- [ ] Eight distinct glyphs, one avatar treatment (circle, same colour, no letters, no orange discs).
- [ ] Each grid card shows salary, total monthly expenses and starting cash flow; numbers equal the preview sheet.
- [ ] No fox on the preview sheet.

## H. Mascot (rule 9)
- [ ] Fox appears only on: home, guide/tour, feedback/tips notes, win, game over. Not on card modals, loan dialog, profession sheet, pick screen.
- [ ] At most one fox pose per screen (plus the note crop in the strip on the board).
- [ ] Fox never overlaps a number, the HUD, the die or the roll button.

## I. Phase 2 items
- [ ] Payday float stays inside the plaza (never over the top tile row, HUD or pawn): screenshot mid-animation at 3 sizes.
- [ ] 3+ payday copy variants render without overflow (A equation, B headline, C before/after), family and full.
- [ ] Loan dialog: three numbers (monthly payment, annual rate, 12-month cost) are the only 20px figures; fits 360x800 without scrolling, 320x568 with details closed; risky state is amber/muted red, primary stays gold.
- [ ] Net-worth panel shows net worth, assets vs liabilities bar and the delta; labels correct; family mode no red.

## J. Accessibility (rule 10)
- [ ] Run `python3 scripts/contrast-check.py` (updated pairs) and `python3 docs/v3/design/contrast-v3.py`: exit 0.
- [ ] axe/Lighthouse accessibility >= 95 on home, board, card, loan, statement.
- [ ] All targets >= 48x48 (script: query `button, [role=button], a` bounding boxes) and 8px apart.
- [ ] `prefers-reduced-motion: reduce`: capture the card entrance, ribbon change, float, confetti, arming: fades only / static.
- [ ] No horizontal scroll at 320, 360, 390 (`scrollWidth == clientWidth`).
- [ ] Hebrew RTL: directional icons mirrored (arrows, chevrons, meters fill from the right), dice/coins/numbers not mirrored.
- [ ] Nothing conveyed by colour alone (verdict, negative, category, family slow tier, selected).

## K. Premium bar
- [ ] Put the screenshot next to a top-10 casual game screenshot. If it reads cheaper (flat grey boxes, uneven spacing, text-heavy, default-looking), iterate before handing to QA.
- [ ] Spacing is on the 4px scale; alignments are optical-checked at 390; no orphan single-word lines in titles (use `text-wrap: balance`).
