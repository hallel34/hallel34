---
name: game-art-direction
description: Art direction and "game feel" for a premium casual mobile board game — palette, typography, illustration, motion and juice. Use when designing or reviewing any screen of פסיבו (Passivo).
---
# Game art direction

## Aim
It must feel like a polished store game on first glance: rich color,
depth, characterful illustration, and motion that rewards every tap.
Avoid: flat Bootstrap look, default blue buttons, emoji as icons,
generic gradients, text-heavy screens.

## Direction exploration
Propose two contrasting directions, e.g.:
- **"Tel Aviv Pop"** — bold warm palette, chunky rounded shapes,
  playful isometric city board, sticker-style cards.
- **"Golden Hour Finance"** — deep navy + warm gold, soft 3D coins,
  elegant cards, calmer and more premium.
Each: 5–7 core colors with roles, type pairing, icon style, board look.

## Palette rules
- Semantic tokens: `--income` (green family), `--expense` (red/coral),
  `--asset` (gold), `--liability` (muted purple/gray), `--passive`
  (signature color for the win meter). Same meaning everywhere.
- Light + dark themes; check AA contrast for all text on surfaces.

## Typography
- Hebrew: Rubik (display, rounded) + Assistant or Heebo (body).
- Money: `font-variant-numeric: tabular-nums`, larger weight, ₪ symbol
  styled smaller. Big numbers count up, never jump.

## Board
- Rectangular loop hugging the screen edges (fits 360px), center holds
  dice + current status. Each square type has a unique color + icon.
- Pawn: original character (not a generic circle) with a hop arc.

## Juice checklist (each must exist)
- Die: tumble with 3D rotate, settle bounce, haptic tick.
- Pawn: hop per square (~180ms each), squash on land.
- Card: flip-in from deck, category art header.
- Purchase: coin burst flying to the assets area, cash count-up.
- Payday: glow sweep + "+₪" floater.
- Passive meter: fills smoothly, pulses at milestones (25/50/75%).
- Win: confetti + character celebration + stats card.
- Buttons: press scale 0.96, 120ms; disabled states clear.
Durations 120–400ms, ease-out for enter, ease-in for exit. Under
`prefers-reduced-motion`: fades only.

## Layout
- Primary action (roll / buy) in bottom thumb zone, full-width, ≥56px.
- Income statement as a bottom sheet over the board, not a new page.
- Max two levels of modal. One clear primary action per screen.

## Deliverable quality check
Would this screenshot stand next to the top 10 casual games on Google
Play without looking cheaper? If not, iterate.
