# Tutorial art: story screens, summary card, HUD popover, highlight ring

Files: `src/assets/tutorial/{tree-coins,bills-stack,bank}.svg` (viewBox 320x240, 2.3-2.4 KB each, no text, validated with xmllint, checked on `#0F1E46` and `#FFF6E3`). Style: 3px navy `#0F1E46` outline, flat fills from the tokens (gold `#F2B53A/#F8CB62/#A56A0A`, mint, cream, coral), one white highlight stroke, soft gold radial halo, dark ground shadow. Same coin as `coin.svg`.
Use as `<img alt="" ...>` (decorative, the screen text carries the meaning) unless noted. Never recolour or flip them (coins and the bank are not directional). Render at width 100% of the art slot, `height:auto`.

## 1. Alt-text (use only if a screen shows the art without the matching sentence)
| File | Alt (he) | Meaning |
|---|---|---|
| tree-coins | עץ שהפירות שלו הם מטבעות זהב | money that works while you sleep |
| bills-stack | ערימת שטרות ולוח שנה חודשי | bills that come every month |
| bank | בניין בנק, מטבע ומטבע קטן עם פלוס | borrowed money, repaid with a little extra |
Default is `alt=""` (spec: all story text is in the DOM). The SVGs carry their own `aria-label` but as `<img>` it is ignored, so no double announcement.

## 2. Story screens (5), 360x640 and 320x568
Common: background `--grad-night`; fox cutout with `drop-shadow(0 12px 16px rgb(0 0 0/.45))` and the `--glow-fox` halo (1.1x fox height) behind it; art slot centred; title 22px Rubik 900 `--title-grad`; body 18px; example card (cream `--card-bg`, ink navy) holds the big numbers; "המשיכו" 56px at the bottom; "דלגו" 48px at inline-end top; 5 progress dots 8px (active one 22px wide pill gold, others `--navy-500`) above the button. Safe-area padding top/bottom. One fox pose per screen (fox-usage). Poses follow spec: tip, tired, hammock, tip, roll. The wave/think/ponder/celebrate poses are not used in the story (think/ponder/celebrate are 512 circle crops with baked navy, they would clash with the art slot); `wave` is reserved for the first-launch start screen.

Heights: 640 = fox 150, 568 = fox 120 (width auto, 4:7 poses ~0.6). Art slot: 640 = 200x150 (scaled from 320x240), 568 = 160x120. If body text wraps to 4+ lines at 320 wide, drop art to 120x90 before touching text.

Layout at 360x640 (y from top, all px):
| Zone | y | Content |
|---|---|---|
| top bar | 8-56 | progress dots centred, "דלגו" at inline-end, back arrow at inline-start (both 48x48) |
| fox + art | 60-250 | fox (150) at inline-start 24px, art (200x150) at inline-end, overlapping by 24px, fox in front. Screen 3 and 5: fox only, centred, no art |
| title | 262-296 | 22px, max 2 lines, centred |
| body | 300-400 | 18px/1.45, max-width 312, centred |
| example card | 408-500 | cream card, radius 20, padding 14, big numbers 28px Rubik 900 tabular, label 14px |
| button | 556-612 | 56px full width minus 2x20, gold primary |
At 568: fox 120, art 160x120, title 20px y 214; card shrinks to 80 tall; button bottom 12px from edge. No scrolling at either size: if card + text overflow, hide card sub-label first.

| # | Pose | Art | Fox position | Art motion | Fox motion |
|---|---|---|---|---|---|
| 1 money works | tip | tree-coins, inline-end | inline-start, pointing toward the tree (tip points to the art side, do not mirror) | tree rises 24px + fade 400ms; then coins pop one by one (scale .6 to 1, 70ms stagger, `--ease-bounce`), 2 sparkles twinkle 2.4s | slide in 24px 300ms, bob 2400ms |
| 2 monthly bills | tired | bills-stack, inline-end | inline-start | notes slide in from below with 80ms stagger, calendar flips in last (rotateX -40deg to 0, 260ms) | bob; tiny sigh: 1 squash 1.02 on calendar land |
| 3 freedom | hammock | none, hammock centred at width 220 (640) / 180 (568) with gold halo 280 | centred | none | drop-in -40px 500ms bounce, sway -1.5 to 1.5deg 3200ms |
| 4 loan | tip | bank, inline-end | inline-start | bank fades up; the big coin slides from the bank 16px toward the fox and the small coin + plus pops after 300ms (the "little extra") | slide in, bob |
| 5 when money arrives | roll | none; the chain shown as 4 chips (house, +, pile, cash) inside the card, linked by arrows that MIRROR in RTL | inline-start, height 120/100 | chips enter 150ms staggered, row of 24 small dots fills left-to-right logical start | bob |
Reduced motion: everything fade 120ms, no bob/sway/pop/sparkle.

Next-screen transition: content cross-slides 24px (inline-end to inline-start for forward, reversed for back), 260ms ease-out; fox does not re-enter if the pose is the same (3 to 4 changes tip<->hammock: crossfade 200ms).

## 3. Itemised summary card ("סיכום שנתיים")
Container: cream `--card-bg`, radius 20, 3px gold ring (`--card-ring`), padding 14/16, `--shadow-glow-gold`; sits above the button, max height ~200 at 640, ~220 at 800, never over the HUD. Rows 36px tall (tap target not needed), label at inline-start 15px weight 500 navy, amount at inline-end 18px Rubik 700 tabular, `<bdi>`, `₪` at .6em. Rows slide in 12px + fade 150ms each (stagger 150ms); the whole card finishes in ~900ms. Reduced motion: all rows fade together 120ms.
Rows:
1. המשכורת שלך: amount navy, small mint coin-dot icon (income-ink `#0B6B43`)
2. כסף שעובד: amount `--passive` light variant `#0A7560`, row tinted `--card-income-bg`; this row is where the first-time ring (section 5) lands
3. הוצאות: amount `--expense-ink` `#B3261E`, shown with a leading minus sign
4. thin divider (2px dashed `#EBDDBF`)
5. נשארו בחודש: label 16px 900; amount 26px 900
6. footer band (full width, radius 14, navy `#0F1E46` fill, white text): `₪4,090 × 24 = ₪98,160`, result number 24px gold `#F6C453` (11:1), counts up 500ms
7. caption 13px `--card-muted`: cash line "הכסף מגיע למזומן: ₪X → ₪Y"
Variants:
- Positive: row 5 amount `--income-ink` with "+" prefix; footer band navy as above; a gold glint sweeps the band once (500ms).
- Negative (no shame): row 5 amount in `--expense-ink`, prefix "-"; footer band stays navy, result number in coral `#FF9C8C` (7.4:1 on navy); NO red fill, NO failure icon, no shake; a small `worried` crop is not used here (fox note handles feedback). Text per spec: "יצא מינוס...".
- Zero passive: row 2 amount replaced by muted text "עוד אין" (`--card-muted`), no tint.
Layout never wraps: if the amount is wider than 120px, label truncates to the short form (spec's one-line variant is for toast only).

## 4. Family HUD popover ("כסף שנכנס / כסף שיוצא / נשאר")
Trigger: flow-chip (48px tall, glass chip, text "נשאר בחודש +₪4,090", chevron that rotates 180deg on open). Popover: anchored under the HUD at the chip's inline-start edge, width min(320, 100% - 24px), radius 18, `--surface-2` fill + `--glass-border`, 8px triangle tail pointing at the chip, shadow `--shadow-lg`, scrim none (tap outside closes; Esc closes). Enter 220ms: fade + scale .96 to 1 from the tail, ease-out; exit 160ms ease-in.
Structure (3 stacked blocks, 12px apart, 14px padding):
1. כסף שנכנס, header 13px `--text-muted` with a mint down-arrow-into-wallet dot (`--income`); two sub-rows "משכורת" and "כסף שעובד" (14px, amounts 16px 700), then the block total 20px 900 `--income` with a 2px mint underline.
2. כסף שיוצא, header with coral dot (`--expense`); one amount line, 20px 900 `--expense`.
3. נשאר, a pill 44px tall, radius 22: positive fill `--income-fill` text `#032A1A` (AA), negative fill `#FFD3CB` text `#6B120C`; amount 22px 900 with sign.
Between blocks a 2px operator badge: "+" is implicit, a "−" circle (22px) between 1 and 2 and "=" between 2 and 3, so the arithmetic reads like a sum. Footer 12px line `--text-muted`: "הכסף מצטבר ומגיע למזומן בסיכום שנתיים הבא: ₪4,090 × 24".
Height ~250 at 360 wide; must stay clear of the roll button and board tiles. Never covers the cash figure itself (anchored below).
Do not use red for the flow chip when negative; use `--expense` text on glass. Do not mix with the goal meter.

## 5. First-time highlight ring (replaces any arrow or finger)
Spec rule: outline only, never over numbers, HUD or buttons (it surrounds the target, it does not cover it).
- Ring: `outline: 3px solid var(--c-gold-300); outline-offset: 4px; border-radius: inherit` + 10px glow `0 0 0 6px rgb(242 181 58 / .25)`. On cream surfaces use `--c-gold-500` ring plus `0 0 0 6px rgb(227 160 32 / .25)` so it holds 3:1 against cream (gold-300 on cream does not).
- Motion: appears with a 220ms scale-in from 1.08 to 1 plus fade, then the outer glow pulses (`opacity .25 to .6`, 1400ms ease-in-out) for 3 loops, then holds static; stops when the hint is dismissed or after 12s. Reduced motion: static ring, no pulse.
- Never animates width/height, only opacity/transform/box-shadow (60fps).
- `pointer-events:none`; the target keeps its own 48px hit area; ring has `aria-hidden`. Do not add a dimming scrim over the rest of the screen (keeps the board readable and avoids a modal feel). Optional 2-line cream bubble with the hint sits in the fox slot per fox-usage, bubble tail toward the target, max-width 220.

## 6. Developer notes (must follow)
- Art is original SVG, `<img src>`; do not inline or tint. Keep alt empty unless the sentence is missing.
- Use logical properties only (`inset-inline-*`). The art composition (tree left, calendar right, bank left / coin right) is not mirrored in RTL; place the art slot at inline-end and let the fox take inline-start. Directional arrows in the chain (screen 5) and the back chevron mirror; fox, coins, bank do not.
- Preload only the current and next fox pose; lazy-load `hammock@2x` and `tip@2x`.
- Check no horizontal scroll at 320x568 and 360x640 after adding art (art slot must be `max-width:100%`).
