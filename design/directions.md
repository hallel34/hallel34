# Art directions — פסיבו (Passivo)

> ## DECISION: Direction "Navy & Gold", Night-city board (A)
> The direction is fixed by the approved fox art. Full spec: `design/DIRECTION-v3.md`. Tokens: `src/styles/tokens.css`. Fox placement: `design/fox-usage.md`.
> History: v1 "Tel Aviv Pop" (plum/sun, mouse mascot) and v2 "Golden Hour" (purple/magenta sunset) are superseded and must not be used.

## Direction: Navy & Gold
- **Mood**: premium, warm, night-lit; a savvy friend, not a banker.
- **Palette** (roles): navy `#0F1E46` background; gold `#F2B53A` reward/primary/assets; fox orange `#E8702A` character accent only; cream `#FFF6E3` cards; mint `#5FE0AE` income; coral `#FF9C8C` expense; teal-to-gold meter for passive income; lavender-grey for liabilities.
- **Typography**: Rubik 900/700/500 (Hebrew + Latin); tabular numerals for money; gold-gradient hero titles with a navy hard shadow.
- **Illustration**: painterly fox raster art + chunky navy-outlined vector UI (3px stroke, soft offset shadows), gold ring/halo motif.
- **Sample hero screen** (start, 360x800): navy dusk sky fading to a fox-orange horizon, small skyline with lit gold windows; gold wordmark; the tired fox holding coffee, bobbing slowly inside a gold halo with a speech bubble "עוד יום בשגרה... בואו נשנה את זה"; two mode chips (family highlighted with a gold outline); full-width glossy gold "התחילו משחק" button in the thumb zone. Mockup: `design/mockups/Main.dc.html`.

## Two variations of board + cards (same direction)
### A. Night city (RECOMMENDED)
Navy night board with a static skyline and lit windows, glowing gold active tile, fox-head pawn. Cream cards with a gold ring and halo. Mockups: `Board.dc.html`, `Card.dc.html` (left frame).
### B. Tabletop felt
Blue-green baize board with wood rim and dashed brass stitching; cards dealt from a two-card deck stack with stitched edge. Mockups: right frame of the same files.

## Recommendation: A
It is the fox art's own world, so pawn, coins and gold ring read as one family; navy gives the six tile colours and the active-tile glow the strongest contrast at 42px tiles; it is cheaper to render than a textured felt (60fps on mid-range Android); and it keeps numbers visually quiet. Felt stays a candidate cosmetic board skin for later.
