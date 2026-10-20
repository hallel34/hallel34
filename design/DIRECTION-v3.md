# Direction v3 — "Navy & Gold" (supersedes v2 "Golden Hour" and v1 "Tel Aviv Pop")
Derived directly from the approved fox art (`design/character/`). The purple/magenta sunset palette and the mouse mascot are retired.
Source of truth: `src/styles/tokens.css` (values) + `design/mockups/*.dc.html` (360x800 plain HTML, open locally; they load the real tokens and fox WebPs).
Audit: `python3 scripts/contrast-check.py` (add `--md` for the table below). Exit code 1 on any AA failure; currently 0.

## 1. Mood
Premium, warm, night-lit. A confident fox in a navy jacket under a gold halo: deep navy fields, gold as the reward colour, fox orange used only for the character and rare celebratory accents. Soft glow, tactile 3D gold buttons, cream cards that feel like "paper under a lamp". Never neon, never purple.

## 2. Core colours and roles
| Token | Hex | Role |
|---|---|---|
| `--c-navy-900` / `--bg` | `#0F1E46` | App background (fox-art navy). Surfaces step up: `#16295E`, `#1D3573`; sunken `#0A1533`. |
| `--c-gold-400` / `--asset` | `#F2B53A` | Primary action, coins, assets, ring/glow motif. Ramp `#FFD479` > `#F2B53A` > `#E3A020`, edge `#A56A0A`, ink-on-gold `#2A1700`. |
| `--c-fox-500` / `--fox` | `#E8702A` | Mascot accent only (avatar chip, pawn, celebratory highlights). Text-safe on light: `--fox-ink` `#B3501A`. Carries no money meaning. |
| `--c-cream-100` / `--card-bg` | `#FFF6E3` | Cards, light-theme background family. Ink on cream: navy `#0F1E46`. |
| `--income` | `#5FE0AE` (light: `#0B6B43`) | Money in. Buy button = mint gradient. |
| `--expense` | `#FF9C8C` (light: `#B3261E`) | Money out; danger button. Tile `#F0524A`. |
| `--passive` | `#35D6B0` (light `#0A7560`) | Signature win meter, gradient to gold (`--passive-fill`: teal > `#F2D36B`). |
| `--liability` | `#C3BDF0` (light `#55508A`) | Debt, muted lavender-grey, intentionally low-energy. |
Tile colours (always paired with an icon and a navy outline): payday gold `#F2B53A`, opportunity mint `#4FD6A0`, expense red `#F0524A`, market sky `#4DA3FF`, baby pink `#FF9CCB`, charity violet `#9B7BFF`. Icon ink on tiles is always navy (`--sq-icon-dark`): white on red/sky/violet fails 3:1 (3.49 / 2.63 / 3.15), navy passes (4.6 / 6.2 / 5.2).

## 3. Type
Rubik everywhere (already bundled by `@fontsource/rubik`, Hebrew + Latin subsets): 900 for hero titles and money, 700 UI, 500 body, 400 captions. Money: tabular lining numerals, `₪` at 0.6em. Titles use the gold gradient (`--title-grad`) with a hard navy drop (`--title-shadow`); in the light theme the title flips to navy with a gold drop.

## 4. Illustration and icon style
Painterly fox art (raster WebP) set against flat, chunky vector UI: 3px navy outline, one highlight stroke, soft offset shadow, rounded 16px tile corners. UI icons stay SVG; no emoji. Gold ring/halo motif (`--glow-fox`, `--shadow-glow-gold`) frames the fox, selected cards, the active tile and the win moment. The wordmark (`src/assets/wordmark.svg`) is outlined Rubik Black in gold gradient with a navy keyline so it works on navy and on cream.

## 5. Board and card variations (within this one direction)
**A. Night city (RECOMMENDED).** Navy night board (`#0A1533` > `#12275A`) with a low skyline of lit gold windows behind the bottom row, gold glowing active tile, pawn token on top. Cards arrive as gold-ringed cream cards under a halo.
**B. Tabletop felt.** Blue-green baize (`--grad-felt`) with a wood rim (`#7A5A2E`) and dashed brass stitching; cards are dealt from a visible two-card deck stack with a stitched inner edge.
**Pick: A, Night city.**
Why: (1) it is the fox art's own world (navy night + gold glow), so the pawn, coins and ring motif read as one family, B introduces a third material (wood, green-blue) that dilutes the palette; (2) navy board makes all six tile colours and the gold active-tile glow pop with the highest contrast and the cleanest silhouette at 42px tiles; (3) it costs less to render and animate (flat gradient plus a static SVG skyline) than a textured felt, good for 60fps on mid-range Android; (4) the felt variant's stitched edge and rotated deck add visual noise around the numbers. Keep felt as a possible unlockable board skin later (monetisation idea: cosmetic only).

## 6. Where the fox lives
See `design/fox-usage.md` (sizes, positions, motion, per screen).

## 7. Theme rules
Dark is the default and the hero look. Light theme = warm paper `#FBF3E1` with navy ink and the same gold/navy components; the card stays cream in both themes; tiles keep their navy outline so colour needs no extra contrast on paper.

## 8. Assets the developer must use
See the file list in the hand-off message and `design/screens.md` (Assets line).

## 9. WCAG AA audit (generated)

### DARK
| Pair | Ratio | Need | Pass |
|---|---|---|---|
| text / bg (`#FFFFFF` on `#0F1E46`) | 16.22:1 | 4.5 | yes |
| text / surface (`#FFFFFF` on `#16295E`) | 13.88:1 | 4.5 | yes |
| text / surface-2 (`#FFFFFF` on `#1D3573`) | 11.61:1 | 4.5 | yes |
| text-muted / bg (`#C4D0F0` on `#0F1E46`) | 10.53:1 | 4.5 | yes |
| text-muted / surface (`#C4D0F0` on `#16295E`) | 9.01:1 | 4.5 | yes |
| text-muted / surface-2 (`#C4D0F0` on `#1D3573`) | 7.53:1 | 4.5 | yes |
| text-soft / bg (`#FFE6BD` on `#0F1E46`) | 13.37:1 | 4.5 | yes |
| income / bg (`#5FE0AE` on `#0F1E46`) | 9.86:1 | 4.5 | yes |
| income / surface (`#5FE0AE` on `#16295E`) | 8.43:1 | 4.5 | yes |
| expense / bg (`#FF9C8C` on `#0F1E46`) | 8.02:1 | 4.5 | yes |
| expense / surface (`#FF9C8C` on `#16295E`) | 6.86:1 | 4.5 | yes |
| asset(gold) / bg (`#F2B53A` on `#0F1E46`) | 8.84:1 | 4.5 | yes |
| asset / surface (`#F2B53A` on `#16295E`) | 7.57:1 | 4.5 | yes |
| liability / bg (`#C3BDF0` on `#0F1E46`) | 9.16:1 | 4.5 | yes |
| liability / surface (`#C3BDF0` on `#16295E`) | 7.84:1 | 4.5 | yes |
| passive / bg (`#35D6B0` on `#0F1E46`) | 8.80:1 | 4.5 | yes |
| cash-color / bg (`#F6C453` on `#0F1E46`) | 10.00:1 | 4.5 | yes |
| text / glass (`#FFFFFF` on `#273458`) | 12.22:1 | 4.5 | yes |
| text-muted / glass (`#C4D0F0` on `#273458`) | 7.93:1 | 4.5 | yes |
| text / glass-strong (`#FFFFFF` on `#0c193c`) | 17.21:1 | 4.5 | yes |
| btn-primary text / gold (mid) (`#2A1700` on `#F2B53A`) | 9.37:1 | 4.5 | yes |
| btn-primary text / gold (top) (`#2A1700` on `#FFD479`) | 12.24:1 | 4.5 | yes |
| btn-primary text / gold (bottom) (`#2A1700` on `#E3A020`) | 7.63:1 | 4.5 | yes |
| btn-buy text / mint (`#032A1A` on `#4FD6A0`) | 8.49:1 | 4.5 | yes |
| btn-buy text / mint bottom (`#032A1A` on `#2FB885`) | 6.16:1 | 4.5 | yes |
| btn-danger text / coral (`#2E0502` on `#FF8A78`) | 8.04:1 | 4.5 | yes |
| btn-danger text / coral bottom (`#2E0502` on `#F0645A`) | 5.86:1 | 4.5 | yes |
| btn-disabled text (`#B4C0E4` on `#2A3A6B`) | 6.05:1 | 4.5 | yes |
| card text / card-bg (`#0F1E46` on `#FFF6E3`) | 15.10:1 | 4.5 | yes |
| card-muted / card-bg (`#46527E` on `#FFF6E3`) | 7.06:1 | 4.5 | yes |
| income-ink / card-income-bg (`#0B6B43` on `#E1F8EC`) | 5.89:1 | 4.5 | yes |
| income-ink / card-bg (`#0B6B43` on `#FFF6E3`) | 6.11:1 | 4.5 | yes |
| expense-ink / card-bg (`#B3261E` on `#FFF6E3`) | 6.08:1 | 4.5 | yes |
| gold-ink on fox-orange (`#2A1700` on `#E8702A`) | 5.55:1 | 4.5 | yes |
| white on fox-orange-700 (`#FFFFFF` on `#B3501A`) | 5.15:1 | 4.5 | yes |
| focus ring / bg (non-text) (`#FFD479` on `#0F1E46`) | 11.55:1 | 3 | yes |
| border-strong / bg (non-text) (`#8696C8` on `#0F1E46`) | 5.57:1 | 3 | yes |
| tile payday / bg (non-text) (`#F2B53A` on `#0F1E46`) | 8.84:1 | 3 | yes |
| tile opp / bg (`#4FD6A0` on `#0F1E46`) | 8.85:1 | 3 | yes |
| tile expense / bg (`#F0524A` on `#0F1E46`) | 4.64:1 | 3 | yes |
| tile market / bg (`#4DA3FF` on `#0F1E46`) | 6.18:1 | 3 | yes |
| tile baby / bg (`#FF9CCB` on `#0F1E46`) | 8.40:1 | 3 | yes |
| tile charity / bg (`#9B7BFF` on `#0F1E46`) | 5.15:1 | 3 | yes |
| tile icon navy / payday (`#0F1E46` on `#F2B53A`) | 8.84:1 | 3 | yes |
| tile icon navy / opp (`#0F1E46` on `#4FD6A0`) | 8.85:1 | 3 | yes |
| tile icon navy / baby (`#0F1E46` on `#FF9CCB`) | 8.40:1 | 3 | yes |
| tile icon navy / market (`#0F1E46` on `#4DA3FF`) | 6.18:1 | 3 | yes |
| tile icon navy / expense (`#0F1E46` on `#F0524A`) | 4.64:1 | 3 | yes |
| tile icon navy / charity (`#0F1E46` on `#9B7BFF`) | 5.15:1 | 3 | yes |

### LIGHT
| Pair | Ratio | Need | Pass |
|---|---|---|---|
| text / bg (`#0F1E46` on `#FBF3E1`) | 14.69:1 | 4.5 | yes |
| text / surface (`#0F1E46` on `#FFFFFF`) | 16.22:1 | 4.5 | yes |
| text / sunken (`#0F1E46` on `#F1E5C8`) | 12.96:1 | 4.5 | yes |
| text-muted / bg (`#3F4C78` on `#FBF3E1`) | 7.55:1 | 4.5 | yes |
| text-muted / surface (`#3F4C78` on `#FFFFFF`) | 8.35:1 | 4.5 | yes |
| text-muted / sunken (`#3F4C78` on `#F1E5C8`) | 6.67:1 | 4.5 | yes |
| income / bg (`#0B6B43` on `#FBF3E1`) | 5.94:1 | 4.5 | yes |
| income / surface (`#0B6B43` on `#FFFFFF`) | 6.57:1 | 4.5 | yes |
| expense / bg (`#B3261E` on `#FBF3E1`) | 5.92:1 | 4.5 | yes |
| expense / surface (`#B3261E` on `#FFFFFF`) | 6.54:1 | 4.5 | yes |
| asset / bg (`#8A5200` on `#FBF3E1`) | 5.78:1 | 4.5 | yes |
| asset / surface (`#8A5200` on `#FFFFFF`) | 6.39:1 | 4.5 | yes |
| liability / bg (`#55508A` on `#FBF3E1`) | 6.55:1 | 4.5 | yes |
| liability / surface (`#55508A` on `#FFFFFF`) | 7.24:1 | 4.5 | yes |
| passive text / bg (`#0A7560` on `#FBF3E1`) | 5.10:1 | 4.5 | yes |
| passive text / surface (`#0A7560` on `#FFFFFF`) | 5.64:1 | 4.5 | yes |
| cash-color / bg (`#7A4A00` on `#FBF3E1`) | 6.77:1 | 4.5 | yes |
| text / glass (`#0F1E46` on `#fefcf7`) | 15.82:1 | 4.5 | yes |
| btn-primary text / gold (`#2A1700` on `#F2B53A`) | 9.37:1 | 4.5 | yes |
| btn-secondary text / white (`#0F1E46` on `#FFFFFF`) | 16.22:1 | 4.5 | yes |
| btn-disabled text (`#4F4A3C` on `#E6DCC6`) | 6.49:1 | 4.5 | yes |
| focus ring / bg (non-text) (`#0F1E46` on `#FBF3E1`) | 14.69:1 | 3 | yes |
| border / bg (non-text) (`#6F7899` on `#FBF3E1`) | 3.94:1 | 3 | yes |
| passive fill / track (non-text) (`#087F66` on `#E3E0DB`) | 3.76:1 | 3 | yes |
| tile outline navy / bg (tiles keep a 3px navy outline in light) (`#0F1E46` on `#FBF3E1`) | 14.69:1 | 3 | yes |
| fox orange 700 text / bg (`#B3501A` on `#FBF3E1`) | 4.66:1 | 4.5 | yes |
