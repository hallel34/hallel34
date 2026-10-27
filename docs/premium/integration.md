# Physical board integration

Based on Claude PR7 commit 0466e9a. The engine, daily challenge, junior rules, profession images and current content are preserved.

## Changes
- Camera-rendered physical 6x8 board with live DOM anchors and live player pieces.
- Responsive action dock, short-phone layout and light/dark styling.
- Cash count animations cannot overwrite a subsequent player's amount.
- Profession expenses include monthly debt payments.
- Stock sell rows include isolated stock symbols.

## Verification, October 26, 2026
- 604 unit tests pass; production build passes.
- Existing family full-flow smoke reaches victory/offline. Single-player full mode reaches victory through saved/resumed natural play.
- Existing smoke checks for buying/loans, legacy saves, financial reports, crowded four-player geometry, dictionary, junior UI, explanations, learning notes and long/negative cash pass.
- Individual round 11 and 12 checks pass in dark/light themes. Original assertions are unchanged.
- Daily natural play reaches results at 360x800 and 360x640; replay, sharing and clipboard fallback checked. Daily small-screen layout, give-up, streaks/badges and normal/daily save isolation pass. The 360x640 second-visit checks were not completed in one run, so no claim that the entire daily script passed uninterrupted.
- Four-player natural full mode reached round 29 across saved/resumed segments. No complete multiplayer victory claim.
- Prepared charity handover confirms the next player's cash after donation; prepared lower-price stock sale confirms proceeds and distinct stock labels. This is not a natural stock-crash-card reproduction.

## Board generation
Runtime does not load WebGL or Three.js. The checked-in WebP and anchors are generated together. To regenerate, install `three@0.186.1` without saving it (`npm install --no-save --package-lock=false three@0.186.1`) and Python Pillow, then run `node scripts/design/render-board.mjs`. Set `CHROMIUM_PATH` if Chromium is not at Playwright's default path. The script crops the image and normalizes anchors in one pipeline.

Keep this work on a separate branch. Production and existing previews are not changed by this source checkpoint.
