# Fox usage — פסיבו השועל, per screen (360x800, RTL)
Art is approved and fixed; never recolour, redraw or stretch it (keep aspect ratio, `height` driven, `width:auto`). All sizes in CSS px. Positions use logical properties (`inset-inline-start` = right in RTL).
Files: `src/assets/fox/`. Cutouts are transparent, ship `@2x`; use `srcset="x.webp 1x, x@2x.webp 2x"` (only `tired`, `wave`, `roll`, `hammock`, `tip` have @2x). Reaction crops (`think`, `celebrate`, `worried`, `ponder` .webp, 512x512) have a navy background baked in, so they are ALWAYS shown as a circle crop with a 3px gold ring (`border-radius:50%; border:3px solid var(--c-gold-400)`), which matches the art's own gold-ring motif.
`hero.webp` (1254) is for the splash/loading and store art only.

Common motion tokens: idle bob = `translateY(calc(var(--bob-height) * -1))` over `--dur-bob` (2400ms) ease-in-out infinite; entrance = fade + 24px rise over 400ms `--ease-out`; reaction pop = `--dur-pop` (320ms) `--ease-bounce`, visible `--dur-toast` (2200ms), exit 180ms `--ease-in`. Under `prefers-reduced-motion` / `data-motion="reduced"` the tokens collapse: no bob, no rise, 120ms fades only. Every fox image is `alt=""` when decorative, or a short Hebrew alt when it carries meaning (start/win).
Shadow under every fox cutout: `filter: drop-shadow(0 12px 16px rgb(0 0 0 / .45))`. Halo behind hero poses: `--glow-fox` radial, about 1.1x the fox height.

| Screen | Pose | Size | Position | Motion |
|---|---|---|---|---|
| Start (returning) | `tired` (coffee, glasses pushed up) | height 296 (width ~181) | `inset-inline-start:30px; top:262px`; halo 330 behind; bubble (116 wide) at inline-end/top 300 | entrance rise 400ms, then bob 2400ms; tap = squash 1.04 over 120ms; bubble line rotates through 3 jokes every 6s (fade 180ms) |
| Start (first launch only) | `wave` then `tired` | wave height 300, same slot as tired | same slot | wave enters from inline-end 40px + fade 500ms, plays 1800ms with bubble "היי, אני פסיבו!", crossfade 200ms to tired + normal bubble. Flag in localStorage `passivo.seenIntro`. |
| Mode + profession pick | `ponder` crop (circle) | 56 | overlaps the top inline-end corner of the profession preview sheet by 50%, never over salary/expense numbers | pop-in when a profession is selected; swaps to `think` crop when the user opens the expenses list |
| Board, roll zone | `roll` | height 128 (width ~123) | `inset-inline-start:14px; bottom:104px` (sits on the line above the roll button, left of the status chip) | bob while idle; on tap: tilt -6deg to 4deg 200ms + nudge 8px while the die leaves toward the board centre; fades to 0 over 180ms while pawn moves / card resolves; returns 250ms after the button re-enables |
| Board, reactions | `think` / `celebrate` / `worried` / `ponder` circle crops | 56 | `inset-inline-end:16px; top:` board bottom + 6px (the strip between board and roll zone). HARD RULE: never over HUD, tiles, die or any number | pop 320ms, hold 2200ms, exit 180ms. Triggers: celebrate = purchase, payday, passive-income milestone 25/50/75%; think = landed on opportunity; worried = unexpected expense, loan, baby; ponder = market event |
| Card modal | one reaction crop | 64 | bottom inline-end of the category banner (corner of the art, above the title, clear of the numbers grid) | pop 320ms after the card flip lands (+150ms) |
| Family-mode tips | `tip` (pointing, lightbulb) | height 150 (width ~94) | replaces the roll pose slot (`inset-inline-start:14px; bottom:104px`); tip bubble to its inline-end, max-width 200, cream `#FFF6E3` on navy ink text, tail toward the fox | slide in from inline-start 24px 300ms; shown on turns 1, 2, 3 then every ~5th turn; dismiss by tap anywhere or after 6s; smile only, never a smirk |
| Income statement sheet | none (numbers first) | - | - | - |
| Loan dialog | `worried` crop | 56 | top inline-end corner of the dialog, overlapping the edge by 50% | pop 320ms; no bob |
| Win | `hammock` | width 276 (height ~250) | centred, `top:22px`; gold halo 340; confetti behind, title below at `top:296px` | drop-in from -40px with `--ease-bounce` 500ms, then gentle hammock sway (rotate -1.5deg to 1.5deg over 3200ms, transform-origin top centre); coins on the pile glint once (opacity pulse) |
| Game over | `tired` | height 200 | centred, `top:84px`, muted halo | slow sway 3200ms; copy is supportive ("גם לשועלים יש ימים כאלה. ננסה שוב?") never mocking; `celebrate` is never used here |
| Splash / loading | `hero` | 220 circle | centre | scale .94 to 1 + fade 400ms |

## Rules of thumb
- One fox per screen at a time (hero pose OR a reaction pop, not both), except Board where roll pose + one reaction circle may coexist because they live in different strips.
- Fox is decoration, not an input: any tap target nearby keeps its own >=48px box and the fox has `pointer-events:none` (except the start screen tap-squash, which is non-essential).
- Reaction circles never carry information that is not also in text (screen readers get the text toast; the fox is `aria-hidden`).
- Preload `tired@2x`, `roll@2x` on the start screen; lazy-load `hammock@2x` and `tip@2x`.
