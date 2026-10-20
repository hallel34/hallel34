# Art directions — יוצאים מהמרוץ

> ## DECISION: Direction A — "Tel Aviv Pop" (with the "Golden Hour" evening palette as the dark theme)
> Implemented in `src/styles/tokens.css` and `src/assets/*.svg`. Developers use those tokens; do not invent colours.

## A. Tel Aviv Pop (CHOSEN)
- **Mood**: sunny, cheeky, sticker-like, family-friendly but not childish. Think warm beach-city afternoon, bold outlines, tactile "pressable" 3D buttons.
- **Palette (roles)**: plum ink `#2B1B4D` (text, outlines), cream `#FFF4E0` (background), sun `#FFB300` (primary action, assets, coins), coral `#FF5A4E` (expenses), mint `#1FBF8F` (income/payday), sky `#2D9CFF` (market), violet `#7A4DFF` (passive-income meter, charity), pink `#FF7AB6` (baby).
- **Typography**: Rubik 700/800 for display and money (rounded, excellent Hebrew), Assistant 400/500/700 for body. Money always tabular, smaller ₪.
- **Illustration**: chunky 3px plum outline, flat fills + one white highlight stroke, offset hard shadow ("sticker"). Mascot: a cheeky mouse in a coral hoodie with a gold headband and a coin on its chest — the one who escapes the *rat race*. It is the pawn, the win-screen hero and the app icon.
- **Board**: rounded rectangular loop of 24 candy-coloured tiles on a warm sand board, each tile = colour + icon (never colour alone). Centre holds die and status.
- **Hero screen**: cream board with pale sun rays; top HUD with cash count-up and a violet passive-income meter racing toward the expense mark; the mouse stands on a mint payday tile; a full-width gold 3D "זרקו קוביה" button in the thumb zone.
- **Why it works**: highest "top-chart casual" appeal, instantly readable at 360px, suits both adults and families, differentiates strongly from the grey/blue look of existing finance board games.

## B. Golden Hour Finance (not chosen; reused only as dark theme)
- **Mood**: premium, calm, evening-lit; deep navy and warm gold, soft 3D coins, elegant cards.
- **Palette**: navy `#0E1B3D`, midnight `#16264F`, gold `#E8B84A`, champagne `#F6E7C1`, teal `#2FB5A3`, rose `#D9576B`.
- **Typography**: Heebo 700 display + Assistant body; thin gold hairlines.
- **Illustration**: soft-gradient semi-realistic coins, subtle glow, minimal line icons, silhouette pawn.
- **Hero screen**: navy board with gold-lit tiles, a glossy 3D gold die, serif-feeling numerals.
- **Why not**: reads as a fintech app; lower fun/juice, weaker for ages 9+, harder to make distinctive and easy to look "cheaper" than top casual games.

## Recommendation
Choose **A**. Take B's dark-evening feel only for `[data-theme="dark"]` (plum night with sun-gold accents), so we get premium calm at night without losing the playful identity.
