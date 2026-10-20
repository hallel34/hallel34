# Screen specs — 360x800, RTL (he), dark + light

Global: safe-area padding; gutter `--gutter` (16px); primary button `--btn-primary-h` (56px) full-width in bottom 30% of screen; secondary actions >=48px; <=2 modal levels; one primary action per screen. Buttons: 3D edge (`box-shadow: 0 var(--edge-depth) 0 var(--btn-primary-edge)`), press = `scale(var(--press-scale))` + edge collapses to 1px, `--dur-press`. Copy: plural address ("בחרו", "לחצו"), 1-2 word button labels, light humour. Money via `.money` + `Intl.NumberFormat` ILS, wrapped in `<bdi>`. Reduced motion: fades only. Haptics (toggle in settings): roll 15ms tick, land 10ms, purchase [20,40,20], win [30,60,30,60,90], error 40ms.

Assets: `src/assets/` (square-*.svg, pawn.svg, die-1..6.svg, card-*.svg, coin*.svg, app-icon-*).

## 1. Start
- Layout: top 40% mascot (pawn.svg scaled 3x) bobbing on a sun-ray background; title "יוצאים מהמרוץ" (Rubik 800, `--fs-2xl`) with tagline "ממירוץ העכברים לחופש כלכלי"; bottom stack: primary "משחק חדש", secondary "המשך משחק" (only if save exists), icon row (sound, vibration, theme, how-to) each 48px.
- Motion: mascot idle bob 2s loop; coins drift up in the background (cheap CSS transforms). Button entrance stagger 60ms, `--ease-out`.
- States: no save (continue hidden), save exists (continue shows turn number).

## 2. Mode + profession pick (2 steps, one screen scroll-snap)
- Step 1 mode: two big sticker cards side by side stacked vertically at 360: "משפחתי" (ages 9+, apartments and small businesses) and "מלא" (stocks, selling, loans). Selected = gold outline + glow `--shadow-glow-gold`, check badge.
- Step 2 professions: 2-column grid of cards (>=48px tall each, ~150x120): avatar circle with profession glyph, name, salary in `.money`. Selected card expands into a bottom sheet preview: itemised salary, expenses, savings, the first goal "הכנסה פסיבית > הוצאות". Primary "יוצאים לדרך" pinned bottom.
- Motion: cards pop in 40ms stagger; selection squash 1.06 -> 1 with `--ease-bounce`.

## 3. Board (main)
- Top HUD (height ~96): cash (`--fs-xl`, count-up `--dur-countup`), passive-income meter below it: track `--passive-track`, fill `--passive`, fills from inline-start, tick marks at 25/50/75% and a flag at "expenses" (the goal). Statement button (48px) at inline-end. Turn counter small at inline-start.
- Board: 24-tile rounded loop fitting 328px wide: 7 tiles top row, 5 per side vertical, 7 bottom, tile ~40x40 (tap target exception: tiles are not interactive; tap-to-inspect uses the 48px-wide long-press-free tooltip on the pawn only). Tile = `square-*.svg` on `--sq-*` colour with outline; payday tile larger ("start"). Current tile glows.
- Centre: die (die-N.svg, 72px) and a status line ("תור 7 - משכורת בדרך").
- Bottom: primary full-width "זרקו קוביה" 56px. During movement it disables to "..." state.
- Motion: die tumble with CSS 3D rotate for `--dur-die`, settle with `--ease-bounce`, haptic tick; pawn hops each tile `--dur-fast` (translate-Y arc `--hop-height`, squash on land 0.9/1.1); payday = glow sweep across the cash + floating "+₪" rising 40px and fading; passive meter pulses at 25/50/75%.
- States: idle, rolling, moving, resolving card, charity bonus (2-dice badge with remaining turns), baby counter (0-3 icons beside cash).

## 4. Card modal (opportunity / expense / market / baby / charity)
- Centered sheet 328x~520, `--r-xl`, `--shadow-3`; header = `card-<type>.svg` (320x140) with type label chip; title (Rubik 700 `--fs-lg`); 2-3 lines of description (`--fs-md`); a key-numbers table (cost, down payment, monthly income/payment) with semantic colours; bottom actions: primary "קנו" (gold) + secondary "לא הפעם" (plum). Expense card: single danger-styled "שלמו"; if short on cash it transitions to the loan dialog (second modal level).
- Full mode market event: quantity stepper (48px +/- buttons, `.money` live total).
- Motion: flip-in from deck (rotateY 90deg -> 0, `--dur-slow`, `--ease-out`); exit slides down `--ease-in`; on buy: coin burst (8-12 `coin-small.svg` flying toward the assets button at inline-end of the HUD, 500ms), cash count-up, haptic purchase.
- Tone: witty one-liners, never shaming.

## 5. Income statement (bottom sheet over board)
- Sheet from bottom, 85dvh, drag handle (48px target), dim `--scrim`. Sections: income (salary, passive in `--income`), expenses (itemised, `--expense`), assets (`--asset`), liabilities (`--liability`), summary row: monthly cash flow and the passive-vs-expenses meter (large). Family mode shows simplified rows (no stocks, no loans).
- Numbers right-aligned in logical `text-align: end`, tabular; negative with "-" inside `<bdi>`.
- Motion: slide up `--dur-base` `--ease-out`; rows stagger 30ms; passive meter animates fill on open.

## 6. Loan dialog
- Triggered when cash is short or from statement (full mode). Small centered modal: title "צריך הלוואה?", stepper in NIS 1,000 multiples (48px buttons, big amount `--fs-2xl`), line "תשלום חודשי: 10%", live new monthly cash flow (turns coral if negative), limit bar showing used/max. Actions: primary "קחו הלוואה", secondary "ביטול". If limit reached and still short: shows the game-over path (button "לסיום").
- Motion: bank-door slide/scale `--ease-bounce`; amount count-up on each step; error shake 6px x2 `--dur-fast` (opacity-only under reduced motion).
- Repay variant (full mode): same layout, mint primary "החזירו".

## 7. Win
- Full screen: purple/gold sunburst, mascot jumping with a gold headband flag, "יצאתם מהמרוץ!" `--fs-2xl`, confetti (canvas or 30-40 CSS particles, `--dur-confetti`, GPU transforms only), stats card (turns, final passive income, assets owned, babies, charity given), buttons: primary "שחקו שוב", secondary "שתפו" (>=48px).
- Haptic win pattern; confetti suppressed under reduced motion (static sparkles + fade).

## 8. Game over
- Calm dim-plum screen, mascot sitting with a deflated coin, title "המרוץ ממשיך..." (light, not punitive), short cause line ("אין מזומן, אין הלוואות, והתזרים שלילי"), stats card, primary "ננסה שוב", secondary "חזרה לתפריט". Tone: encouraging, tip of the day.
- Motion: slow fade/slide `--dur-slow`; mascot gentle sway.

## Accessibility checklist
Contrast AA via tokens (text on bg >=12:1; muted >=6:1), visible `:focus-visible`, icons paired with text/shape (never colour alone), `aria-live="polite"` for cash/turn changes, die result announced, decorative SVGs `aria-hidden`.
