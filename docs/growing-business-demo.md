# Growing business concept

A separate, Hebrew-first playable prototype at `business-demo.html`. The existing game entry and PR8 stay unchanged.

The player starts with a coffee kiosk and 4 demo momentum points. Free rolls move on a 12-stop track. Each actual landing awards 4, 5, 6 or 8 momentum points, shown in the event panel. At 12 points the player builds a cafe. At 24 points they choose the appearance of a terrace or takeaway window. At 36 points they add an upper floor and roof garden. The prototype ends and can be replayed immediately.

All points are prototype progression, not shekels, income, expenses or financial advice. No game-engine imports, game-save reads/writes, purchases, ads, login, network calls, notifications, streaks, energy system or timers. No claim that this loop proves retention. The scene uses original SVG buildings and existing MaxiFox character art, not Monopoly GO assets.

This deliberately tests a short anticipation/result/visible-growth loop, not a complete business simulation or a change to existing financial rules. Both style choices have the same point cost and rewards. No artificial scarcity or loss pressure. Sound is optional and off by default; reduced motion is respected. State is ephemeral and resets on reload.

## Checks

`npm test`, `npm run build`, `npm run smoke:business`.
The independent demo smoke covers 320, 393 and 480px, both choices, cancel/reopen, ending/replay, no horizontal overflow, JS errors, unrelated localStorage isolation and double-tap protection. The regular full game smoke continues to run in CI as well.
