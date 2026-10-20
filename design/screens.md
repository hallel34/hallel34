# Screen specs — 360x800, RTL (he), dark + light

Global: safe-area padding; gutter `--gutter` (16px); primary button `--btn-primary-h` (64px) full-width in bottom 30% of screen; secondary actions >=48px; <=2 modal levels; one primary action per screen. Buttons: 3D edge (`box-shadow: 0 var(--edge-depth) 0 var(--btn-primary-edge)`), press = `scale(var(--press-scale))` + edge collapses to 1px, `--dur-press`. Copy: plural address ("בחרו", "לחצו"), 1-2 word button labels, light humour. Money via `.money` + `Intl.NumberFormat` ILS, wrapped in `<bdi>`. Reduced motion: fades only. Haptics (toggle in settings): roll 15ms tick, land 10ms, purchase [20,40,20], win [30,60,30,60,90], error 40ms.

Assets: `src/assets/` (square-*.svg, pawn.svg = fox-head token, die-1..6.svg, card-*.svg, coin*.svg, wordmark.svg, fox/*.webp, app-icon-*.png). Look: `design/DIRECTION-v3.md` (Navy & Gold, Night-city board). Fox placement: `design/fox-usage.md`. Primary button is 64px (`--btn-primary-h`).

## 1. Start
- Layout: dusk-navy sky (`--grad-sky`) with a small skyline and lit windows; `wordmark.svg` (232px wide) at top 76; tagline "הכסף עובד בשבילך. אתם רק צריכים להתחיל."; tired fox (height 296) inside a gold halo with a speech bubble; bottom stack: mode chips (family/full, 72px tall, selected = gold outline), primary "התחילו משחק" (64px), "המשך משחק" secondary only if a save exists; settings icon 48px top inline-start corner, games-played chip top inline-end.
- First launch: wave pose plays once, then crossfades to tired (see fox-usage.md).
- Motion: fox bob 2400ms, entrance rise 400ms; button stagger 60ms `--ease-out`; stars twinkle (opacity only).
- States: no save (continue hidden), save exists (continue shows turn number), reduced motion (no bob/twinkle).
- Copy: warm, light self-irony about the daily grind ("עוד יום בשגרה... בואו נשנה את זה").

## 2. Mode + profession pick (2 steps, one screen)
- Step 1 mode: two cards stacked at 360: "משפחתי" (ages 9+, apartments and small businesses) and "מלא" (stocks, selling, loans). Selected = gold outline + `--shadow-glow-gold`, check badge.
- Step 2 professions: 2-column grid (~156x112): avatar circle (fox-orange chip with the profession initial/glyph), name, salary in `.money`. Selecting opens a bottom preview sheet: salary, itemised expenses, savings, first goal "הכנסה פסיבית > הוצאות"; fox `ponder` circle (56) on the sheet's top inline-end corner. Primary "יוצאים לדרך" pinned bottom.
- Motion: cards pop in 40ms stagger; selection squash 1.06 -> 1 `--ease-bounce`; haptic tick 10ms.

## 3. Board (main) — Night city
- HUD (about 150px: profession chip + statement button 48px, cash `--cash-color` 30px with count-up `--dur-countup` and monthly delta chip, passive-vs-expenses line, 14px meter). Meter: `--passive-track`/`--passive-fill`, fills from inline-start, ticks at 25/50/75%, goal flag at the expenses mark.
- Board: 24-tile loop in a 7x7 grid, tile 42px, gap 4px, panel 336x344 at top 176; navy night gradient with skyline + gold windows behind the bottom row. Tile = `square-*.svg`; tiles are not interactive (exempt from 48px). Start tile (payday) at the top inline-start corner. Active tile: white 3px ring + gold glow. Pawn: `pawn.svg` fox-head token 36x40, hovering ~16px above the tile top.
- Centre: die (`die-N.svg` 64px) and status line "תור 7 · משכורת בדרך".
- Roll zone: fox `roll` pose (height 128) at inline-start, status chip, primary "זרקו קוביה" full width 64px at bottom 24px. Reaction circle strip directly below the board (see fox-usage.md).
- Motion: die tumble CSS 3D for `--dur-die`, settle `--ease-bounce`, haptic tick; pawn hop per tile `--dur-fast` (arc `--hop-height`, squash on land 0.9/1.1); payday glow sweep across cash + floating "+₪" rising 40px; passive meter pulses at 25/50/75%.
- States: idle, rolling, moving (button disabled with spinner), resolving card, charity bonus (2-dice badge + turns left), baby counter (0-3 icons beside cash).
- Variation B (tabletop felt) is specified in `directions.md`/mockups only; not built.

## 4. Card modal (opportunity / expense / market / baby / charity)
- Sheet 328x~720 at 360x800, `--r-xl`, ring `--shadow-3` (gold 4px), header banner `card-<type>.svg` (320x140, `object-fit:cover`, 176px tall) with a navy type chip (gold text) at top inline-start; fox reaction circle (64) at the banner's bottom inline-end. Title 26px/900, description 15px `--card-muted`, key-numbers grid (down payment, monthly income in income-ink on mint tile, mortgage, monthly payment), navy "passive income will rise to" strip with coin, cash-after-purchase row, actions: secondary "לא הפעם" (104px, white) + primary "קונים!" (mint buy button). Expense card: single danger button "שלמו"; if short on cash it transitions to the loan dialog (second and last modal level).
- Full mode market event: quantity stepper (48px +/- buttons, `.money` live total).
- Motion: flip-in from deck (rotateY 90deg to 0, `--dur-slow`, `--ease-out`); exit slides down `--ease-in`; on buy: coin burst (8-12 `coin-small.svg` flying to the statement button, 500ms), cash count-up, haptic purchase.
- Tone: witty one-liners, never shaming.

## 5. Income statement (bottom sheet over board)
- Sheet from bottom, 85dvh, drag handle (48px target), dim `--scrim`. Sections: income (salary, passive in `--income`), expenses (itemised, `--expense`), assets (`--asset`), liabilities (`--liability`), summary: monthly cash flow + large passive-vs-expenses meter. Family mode: simplified rows (no stocks, no loans). No fox here: numbers first.
- Numbers aligned with `text-align: end`, tabular; negatives with "-" inside `<bdi>`.
- Motion: slide up `--dur-base` `--ease-out`; rows stagger 30ms; meter animates on open.

## 6. Loan dialog
- Centered modal when cash is short or from statement (full mode): "צריך הלוואה?", stepper in NIS 1,000 multiples (48px buttons, amount 36px count-up), "תשלום חודשי: 10%", live new monthly cash flow (coral if negative), limit bar used/max, fox `worried` circle on the corner. Actions: primary "קחו הלוואה", secondary "ביטול". At the limit and still short: button "לסיום" leading to game over.
- Motion: scale-in `--ease-bounce`; error shake 6px x2 `--dur-fast` (opacity only under reduced motion).
- Repay variant (full mode): same layout, mint primary "החזירו".

## 7. Win
- Full screen `--grad-sunburst` with gold rays (13% opacity), confetti in brand colours (30-40 CSS/SVG particles, `--dur-confetti`, transforms only), fox `hammock` (276 wide) in a gold halo, title "חופש כלכלי!" (46px gold gradient), line "ההכנסה הפסיבית עקפה את ההוצאות. הכסף עובד בשבילכם.", stats panel (passive vs expenses, turns, assets, kids) on `--glass-bg-strong`, primary "משחק חדש", secondary "שתפו את התוצאה" (secondary uses a navy 62% fill for contrast over the orange gradient).
- Haptic win pattern; confetti suppressed under reduced motion (static sparkles + fade).

## 8. Game over
- Calm dim-navy screen (`--grad-night`), fox `tired` (200) swaying slowly, title "עוד סיבוב ננסה" (supportive, not punitive), cause line ("אין מזומן, אין הלוואות, והתזרים שלילי"), tip of the day, stats card, primary "ננסה שוב", secondary "חזרה לתפריט".
- Motion: slow fade/slide `--dur-slow`.

## Accessibility checklist
Contrast AA via tokens (see DIRECTION-v3.md audit table: text on bg 16.9:1, muted 11.1:1 dark / 7.9:1 light), visible `:focus-visible` (gold on dark, navy on light), icons paired with text/shape (never colour alone; tile icons are navy for >=4.6:1 on red), `aria-live="polite"` for cash/turn changes, die result announced, decorative SVG/WebP `aria-hidden`/`alt=""`.
