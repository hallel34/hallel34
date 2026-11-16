# MaxiFox redesign spec (design + audit only, no UI code changed)

Worktree `/home/user/maxifox-redesign`, branch `maxifox-redesign` from `2af50a7` (parent branch `maxifox-v050-career`, clean). Baseline: `npm test` 51 files / 976 tests green, `vite build` ok.
Files: `tokens.proposed.css` (token layer), `concept-home.html/.png`, `concept-game.html/.png` (+ `-short12`, `-320x568`, `-360x640`, `concept-home-320x568.png`), `baseline/` (screens + `measurements*.json/txt`), `concept-assets/` (derived assets, section 8).
Concepts are visual direction only. Their figures are the real initial values (teacher, Family) except `?cap=12`, which is illustrative.

## 1. Audit

**Stack**: Vite 5 + vanilla JS modules, no framework; DOM via `h()` (`src/ui/dom.js`); lazy chunks (play, flow, game). PWA, Capacitor-ready. Vitest. Fonts: only `@fontsource/rubik` 400/500/700/900 (hebrew+latin, `src/styles/fonts.css`); "Heebo" is in the stack but NOT bundled. RTL via `dir`, logical props, `.icon-dir` mirror class.

**Ownership**
| Area | Files |
|---|---|
| Home | `src/ui/screens/start.js`, `src/styles/screens.css`, `mission-home.css`, `challenge.css` |
| Setup (player count, ages, length) | `src/ui/screens/players.js` (player count is NOT on home) |
| Profession pick + preview sheet | `src/ui/screens/pick.js`, `screens.css` (`.prof-card`, `.pick-top`) |
| Play screen / HUD | `src/ui/play.js` (HUD built l.141-203, `refreshHud` l.623), `hud-family.js`, `widgets.js` `meter()`, `board.css` (stacked overrides: `.board-full`, `[data-hud]`) |
| Board | `board-premium.webp` (one baked raster) + `board-geo.js` (generated anchors); `.tile.scene-anchor` are invisible hit anchors; `layout.js` ring order; `play.js` `fitBoard`/`sizeBoard` |
| Dice | `die.js` (CSS cube, `die-N.svg`), `--die` in `board.css` |
| Fox | `fox-guide.js` (72/60px circle, tap = `notes.reopen()`), `notes.js`, `learn-flow.js`, `fox.css` |
| Annual summary | `summary-card.js` (`.summary-card`, `.eq`, `.sc-*`), `tutorial.css` l.65-125, `components.css` l.441 |
| Tokens | `src/styles/tokens.css` (489 lines, dark + light, many legacy aliases) |
| Formatting | `format.js`: `money()` returns `<bdi class="money" dir="ltr"><sgn><cur><num>`; `moneyText`, `moneyIsolated` (LRI/PDI) for plain strings; coin scale for junior |

**What each home icon actually opens** (DOM order, shown right to left): 1 book = `openDictionary()` glossary "המילון של מקסי"; 2 help = `openHowTo({mode})` "איך משחקים"; 3 familyBoard = `goBoard()` lazy screen "טבלת המשפחה של השבוע" (weekly board of friend challenges on this device, `passivo.challenges`); 4 gear = `openSettings`. Visual order is gear, board, help, book. Board button exists only if `onBoard` is passed.

**Games count**: `passivo.gamesPlayed` raw counter (`app.js` l.240), +1 in `goWin`/`goOver` for non-daily, non-challenge games. It is shown on home only as a text chip when >0 AND no career profile (the career chip replaces it). **There is no per-game history list or screen**; "history" has no destination. A count badge is truthful from this counter: hide at 0 (new player), no invented number. Daily and challenge finishes are not counted.

**In-game controls** (the brief's "?" and toolbar): "?" (`.legend-btn`, `data-action=legend`) opens the board legend "מה יש על הלוח?" (aria "מקרא המשבצות"), not How-to-play. Statement button = `openStmt`; menu = confirm-home + settings sheet (How-to lives in settings). Flow chip (Family) is a `data-action=flow` button opening `.flow-popover`.

**Round cap**: `match.roundCap` (12 in short games), daily has `state.daily.turnCap`. Unlimited shows turn text only. Baseline reference B is unlimited, so no badge there.

## 2. Baselines (deviceScaleFactor 1, Family, 1 player, teacher, seed 7, tutorial flags set so no story)

Same as supplied 390x844 captures (HUD, board, fox tip, CTA identical in layout and values); the only difference is my capture has no status bar and was taken after 1.8s idle.

| Viewport | HUD box | Upper region (HUD top to chip row bottom) first-game / steady | Board | Die | Pawn | Roll | scrollW |
|---|---|---|---|---|---|---|---|
| 390x844 | 166 | 222 / 198 | 374x353, `--tile-c` 57 | 54 (dice 62) | 26x40 | 56 | 390 |
| 360x800 | 166 | 222 / 198 | 344x324 | 54 | 26x40 | 56 | 360 |
| 430x932 | 166 | 222 / n.m. | 414x390 | 54 | 26x40 | 56 | 430 |
| 360x640 | 151 | 207 / 169 | 294x277 | 36 | 26x40 | 56 | 360 |
| 320x568 | 146 | 202 / 168 | 223x210 | 36 | 26x40 | 56 | 320 |
| 844x390 landscape | 146 | 202 | 201x190 | 36 | 26x40 | 56 | 844 (home scrolls: scrollH 494 > 390) |
| 1280x800 | 166 | 222 | 407x384 (phone column 464 wide) | 54 | 26x40 | 56 | 1280 |

Notes: the "?" and flow chip sit in a separate 48px row under the HUD box, so the true upper region is box + ~56px. Pawn is a fixed 26x40 at every width (larger than the tile at 320). Tile pieces are baked into the raster (not DOM). No JS errors at any size. Desktop is a stretched phone column; landscape board is tiny.

## 3. Shared tokens (see `tokens.proposed.css`)

- **Palette** exactly per brief section 2, mapped onto existing names (`--bg`, `--surface`=card, `--surface-2`=elevated, `--text`, `--text-muted`, `--income`, `--expense`, `--c-gold-400`) so existing CSS adopts by value. New: `--bg-2`, `--mf-*` raw, `--mf-border-ctl` (.36, 3:1 control boundary), `--mf-danger-strong` (#EE8686).
- **Contrast** (computed): text 17.6/13.6/11.8 on bg/card/elev; text-2 9.0/7.0/6.0; gold 10.5/8.2/7.1; success 9.0/7.0/6.0; danger 6.6/5.1/**4.4 on elevated (fails AA for normal text)**: use `--mf-danger-strong` (5.0) for danger text on elevated/tints; ink on gold 9.7. Surfaces differ only 1.09-1.29:1, so separation comes from 1px borders + elevation, never fill alone.
- **Type** (Rubik only): wordmark 44/900, h1 28/900, h2 20/700, title 18/700, body 16, label 13, caption 12 (floor; retire the 11px compact sizes), HUD cash 32/900 (28 at <=340), money tabular always.
- **Spacing** 4pt scale, gutter 16 (8 for the board), hit area 48, visual round button 40.
- **Radii** 8 / 14 / 18 card / 24 sheet / pill. **Elevation** 0-4 + `--elev-cta`. **Z** board 1, pawn 5, hud 10, fox 12, sheet 20, modal 30, toast 40, fx 50. **Focus** 3px `--focus-ring` (#FFD479), offset 2; navy on cream. **Motion** 120/180/250/320/400ms, existing easings; reduced motion = fades (existing collapse in tokens.css stays).
- Light theme: keep the shipped light block; do not use `--mf-*` directly in components (dark values).

## 4. Components and states

Each: default / pressed / selected / disabled / focus-visible; pressed = scale .96-.98, 120ms; disabled mirrors the engine rule (e.g. roll disabled while `busy` or phase != roll, never merely greyed).
- **Icon button**: 48 hit, 40 visual circle, glass fill, 1px border. Selected n/a. aria-label required.
- **Primary (gold) / secondary / destructive**: 56 / 48 / 48 high, radius 18, gold = ink text `#2A1700`; one solid gold per screen.
- **Mode card**: unselected card+border; selected = 2px gold border + gold icon tile + check badge (non-color cues) + `aria-pressed`.
- **Stat/flow chip** (HUD): sign + arrow glyph + word, success tint for >=0, danger tint with down arrow for <0.
- **Cards** (daily, mission, profession): 18 radius, 64/56/auto min heights, forward chevron at inline-end.
- **Sheet/modal**: top radius 24, max two levels, `--elev-3/4`, scrim existing.
- **Bubble (fox tip)**: 18 radius, tail toward fox, 48px close target.
- **Progress**: 8px track, ticks 25/50/75, fills from inline-start; 100% only when `freedomView.kind==='won'`.
- **Die / cell**: see section 6.

## 5. Screens

Arrow decision, used everywhere: **forward in Hebrew = left-pointing chevron** (raw `M15 5l-7 7 7 7`, no RTL mirror); **back = right-pointing chevron** at inline-start. Why: reading direction is right to left, so progress goes left; a media "play" triangle is ambiguous in RTL. Today every arrow is the single `icon('arrow')` which `.icon-dir` mirrors to `>` in RTL: correct for Back, wrong for forward (verified visually on Start CTA, daily chevron, pick Back). Fix: add `.icon-fwd` (`[dir=rtl] .icon-dir.icon-fwd{transform:none}`, mirrored in LTR) and apply to forward call sites: `start.js` l.126, 137, 149; `story.js` l.51 chain arrows; `learn.js` list rows (already inverted by `learn.css` l.65). Backs (`pick.js` l.154, `players.js` l.188, `career/screens.js` l.34, `timeline.js` l.142, `story.js` l.141, `learn.js` dict-back) keep `icon-dir`. Check `payday.js` l.46 and `hud-family.js` l.101 case by case.
Acceptance: screenshot of Start, daily row, pick/players Back in RTL (Start chevron `<`, Back `>`); `dir=ltr` smoke shows the inverse.

### 5.1 Home (`concept-home.png`)
- Header (48): inline-start gear + help (primary); inline-end **"עוד"** button (glass pill, grid icon) opening a sheet with: המילון של מקסי (`openDictionary`), טבלת המשפחה של השבוע (`goBoard`, only if `onBoard`), and "משחקים שהסתיימו: N" row. Count badge on the button only when `gamesPlayed()>0`; at 0 no badge, the sheet row reads a truthful empty line (new copy, owner OK). Career chip still takes the chip slot when a profile exists (keep behavior); count then lives only in the sheet. aria-label names both destinations.
- Hero: fox emblem (cropped from the existing logo, section 8) 112-212px (`clamp(112px,25dvh,212px)`) with gold glow, live wordmark "MaxiFox" Rubik 900 `--fs-wordmark` with `--wordmark-grad`, overlapping the collar; `h1` is the visible text (drop the `.vh` duplicate + `alt=""` img). Tagline existing; hidden <=640px tall. Keep the existing night sky/skyline, at .5 opacity.
- Modes: two cards, icon tile + name + existing description; selected state per section 4.
- Daily: existing title/date/status; gold start-edge bar; chevron forward. Streak line only via existing `streakText` when >0. No reward indicator (no data supports one).
- Missions: existing entry text + "N מתוך 3 תורגלו" with three dots from `completedShortMissions()` (real data); no XP/reward. Still hidden under 700px when a challenge-resume row exists (existing rule).
- CTA: 56 gold, label unchanged, forward chevron, press nudges 4px left. Resume button, challenge-resume, career chip, daily-reset (debug) stay in their current slots; resume stays below the CTA.
- States: no save / save (resume row) / profile chip / daily new-playing-done. Landscape: allow vertical scroll (today 494px), keep CTA reachable via sticky bottom.
Touch: `start.js`, `screens.css`, `challenge.css`, `mission-home.css`, `icons.js`, new `home-more.js`. Hooks to keep: `data-action` start/resume/daily/missions/profile/family-board, `.mode-card[aria-pressed]`.
Acceptance: 320/360/390/430 no overflow, all four old destinations reachable, tests `smoke`, `daily-smoke`, `players-seats` pass.

### 5.2 Active-game HUD (`concept-game*.png`)
Targets measured on the concept: **155px first-game (222 -> -30%) and 138px steady (198 -> -30%)** at 390x844; the same 155 at 320x568/360x640, where baseline was 202/207 (-23%/-25%), the 48px hit areas set the floor. Board gain: 360x640 294x277 -> 330x311, 320x568 223x210 -> 240x226. At >=780px tall the board is width-bound (374x353) so the reclaimed ~64px becomes breathing room and a roomier fox tip, not a bigger board (see risks).
- Row A (44): avatar 44 + **round badge** at its inline-end bottom (`5/12`, only when `match.roundCap` or `state.daily.turnCap`; unlimited shows none and keeps "תור N"/"התור שלכם" text), name + turn line, toolbar at inline-end: legend "?" (moved from the plaza; keep `data-action=legend`, aria "מקרא המשבצות"), statement, menu.
- Row B (40): coin + "מזומן" + cash 32/900 (hero); flow chip (Family: still the `data-action=flow` button/popover; Full: static) with arrow + signed `money(...,{sign:true})` + "נשאר בחודש". At <=340: hide coin and chevron, cash 28.
- Row C: 8px meter + one line `כסף שעובד ₪0 מתוך הוצאות ₪7,310 (0%)` from `statement()` (`passiveIncome`, `totalExpenses`); Full uses `game.passive` wording. First-game only: the existing `goalLine` sentence as one 12px caption below; `freeLine` ("עוד ₪X ... ועוד קצת") is dropped from the HUD (its figure duplicates row C) unless owner objects. Remove `goalCap`, `meter-labels`, separate `plaza-top` row.
- Percent must be truthful: today `Math.round(passive/expenses*100)` (play.js l.644) can show 100% before the win (win needs passive strictly greater). Use `won ? 100 : min(99, floor(pct))`; on the line (`onTheLine`) keep the existing "ממש על הקו" wording.
- Hot-seat: name never truncated (wrap to 2 lines, `overflow-wrap:anywhere`), avatar ring uses player colour, HUD repaints only after handover guard (existing `paintPlayer`).
- Long values: keep `fitText` on cash as last resort; negative cash shows true minus (`MINUS`) and danger color + word via aria.
Touch: `play.js` (HUD markup, `refreshHud`, remove `plazaTop`), `hud-family.js` (chip markup, popover anchor stays under the HUD), `board.css` (replace the `.hud*` override stack: `[data-hud=compact]`, `.board-full .hud*`), `widgets.js` meter. Test hooks to preserve: `.hud`, `.hud-cash`, `.cash-wrap`, `.cash-col`, `.cash-num`, `.hud-sub`, `.hud-turn`, `.hud-coin`, `.flow-chip`/`data-action=flow`, `.flow-popover`, `[data-goal]`, `[data-meter-pct]`, `.meter-track`; `.goal-cap`, `.meter-labels`, `[data-free]` need test updates if removed.
Acceptance: Playwright HUD height <=140 steady / <=160 first-game at 390x844; round badge present only in short/daily; unlimited has no "/"; roll never covered; no overflow at 320.

### 5.3 Board treatment
- **Asset family**: keep the one baked raster (one material, camera, light, soft PCF shadows, already a family). Do not mix DOM sprites.
- **15% smaller pieces**: single source of truth is `PIECE_SCALE = 0.56` in `scripts/design/board-scene.html` -> **0.476**; regenerate (`docs/premium/integration.md`: `npm i --no-save --package-lock=false three@0.186.1`, `node scripts/design/render-board.mjs`). I verified the generator reproduces the shipped webp pixel-identically and rendered the candidate (`concept-assets/board-pieces-85pct-candidate.webp`, comparison `board-pieces-compare.png`): tiles, cell centres and order unchanged, pieces no longer touch neighbours. **Avoid the double percentage**: do not also CSS-scale anchors or pawn; **crop with the same bbox as the old image** (`(216,275,1149,1155)` of the 1400px render) or `finish-board.py` will change `aspect` and every anchor (the shorter pieces shrink the auto-bbox 880 -> 866px high). Verify `BOARD_GEO` is byte-identical afterwards.
- Pawn: keep 26px (visibility beats the 15% rule), 36-40px grounding ellipse shadow, crowd discs unchanged (`CROWD_FROM=3`, `pawnOffsets`).
- Current tile ring unchanged (one gold ring). Cell hit anchors stay at `g.w*112% x g.h*130%`.
- Landscape/desktop: board height-bound; see risks for a desktop two-column composition.

### 5.4 Center and dice
- Idle die `--die-idle` 38px (54 -30%); the roll animation scales the wrapper up to ~1.5x via `transform` at the apex (no layout change) and settles at 38; the result number overlay (existing `die-result-num`) keeps reading the engine value. Animate only `lastRoll.dice` (existing `setValues`/roll promise); no random face.
- Center content: die, "אתם על: <tile>" line (existing `here-line`), hot-seat current-player name if multi, charity chip. No metrics.
- Roll button: 56, gold, die **outline glyph** (monochrome, static, never shows a result) + label; supersedes the 2026-10-26 "no die icon" rule only because the center die is now small; the glyph never animates faces. Disabled on `busy`/non-roll phase/game end, driven by state not timers.
Touch: `die.js` (scale keyframes), `board.css` `--die` rules (l.380, 474, 644...), `play.js` `rollBtn`. Acceptance: die 38px idle at 390; result readable; one die in DOM; double-tap during roll ignored (existing `busy`).

### 5.5 Fox tip
Same fox guide (60px at >=700 tall, 52 compact) at inline-end, bubble beside it with tail toward the fox, existing text, close X 48px. Tap fox = `notes.reopen()` (existing); add a small dot on the fox only when `reopen()` would show something (needs a `canReopen` getter in `learn-flow.js`/`notes.js`). No new tips, no per-turn repetition; strip never overlaps board or roll (`reactionStripClear` smoke). Touch: `fox-guide.js`, `board.css` `.fox-strip`.

### 5.6 Profession pick
- **Back moves to the upper right** (first in DOM, inline-start) with `>` (back chevron); same for `players.js`. Hit 48. Action unchanged (`onBack`).
- Card: art well, name, two labeled lines `שכר ₪8,800` and `הוצאות ₪7,310` each its own block (label inline-start, `money()` bdi at inline-end, remove `.prof-sep` bullet at `pick.js` l.140), then a **summary line** "נשאר בכיס +₪1,490" as a flat rounded-8 tinted strip (not pill 999, no border, no shadow) inside the card button.
- Selected: reality, there is no committed selection; tapping opens the preview sheet and "יוצאים לדרך" commits. So: card of the open preview gets gold border + check + `aria-pressed="true"` only while its sheet is open and is labelled as preview, never "chosen". Existing `pick.selected` ("נבחר") is unused; do not use it for preview.
Touch: `pick.js`, `screens.css` (`.prof-card`, `.prof-rows`, `.prof-pocket`, `.pick-top`). Acceptance: all 8 professions, large amounts at 320, signed flow keeps `+₪` glued.

### 5.7 Annual summary modal (`summary-card.js`)
Reality: it already has a stacked equation, an LTR grid with `×` and `=` pushed to the far-left edge (confirmed in `baseline/summary-390x844.png`), and a before/after caption `₪9,000 <- ₪26,880` with a CSS-mirrored arrow that is directionally right but unlabeled.
- Replace the `.eq` stack with one centered line inside a highlighted pill: `₪1,490 × 12 חודשים = +₪17,880` built as an RTL flex row of isolates: each amount `<bdi dir=ltr class=money>`, `12 חודשים` `<bdi dir=rtl>`, `×` and `=` `aria-hidden` spans between operands; group `= result` as one `nowrap` unit. Existing `eq-*` classes/`data-row` hooks stay on the pieces. Reading order right to left: monthly, months, result. <=340px: wraps to two lines (operands line, then `= +result`), type stays >=18px, no overflow.
- Balance: two labeled boxes "לפני" (₪9,000) and "אחרי" (₪26,880) using existing `payday.c.before/after`, joined by a left-pointing arrow (previous at the right, new at the left); values never swapped.
- Surface `--paper #EFE6D5` (ink 14.4:1, muted `#3F4B73` 6.9:1) inside an 8-10px dark frame `--paper-frame`; app stays dark. Negative variant keeps `--paper-negative`.
Touch: `summary-card.js`, `tutorial.css` l.65-125, `components.css` l.441, `--card-bg` for this card only. Acceptance: real pixels at 320/390, `summarySpoken` unchanged, tests for summary text pass.

### 5.8 Number-run isolation
Keep `format.js` as is: `money()` already isolates sign+symbol+digits in `<bdi dir=ltr>`, `moneyIsolated()` LRI/PDI for strings. Rule: Hebrew labels live outside the `bdi`; operators and `%` get their own isolates (`<bdi dir=ltr>16%</bdi>`); never post-process formatted strings. Add a `percent()` helper only if needed. The concepts use exactly this and render `+₪1,490`, `₪7,310`, `0%` correctly.

## 6. Other screens
Players, win, game over, decision/loan, statement, handover adopt the tokens only; no layout redesign this round. Back placement rule applies to every Back (players, career, timeline, story, dictionary).

## 7. Brief vs reality
1. Player count is on the setup screen, not home (kept; brief itself says so).
2. No game-history screen exists; only a counter. The "games count/history" control can offer count + the two existing destinations, no history.
3. Home chip: games chip is replaced by the career chip when a profile exists.
4. The in-game "?" is the board legend, not help; How-to is in settings.
5. Wordmark and fox are one raster (lettering baked in): modernized wordmark needs a fox-only emblem (derived crop, owner approval) plus live text.
6. Board pieces are baked into `board-premium.webp`, not DOM, so "15% smaller" = regenerate via the three.js script, not CSS.
7. Profession cards have no committed selected state (preview sheet then CTA).
8. Annual summary already is cream (#FFF6E3) with stacked equation and arrow; the brief's "previous/new" exists but is unlabeled.
9. The progress label already exists in 3 places (goal caption, meter labels, free line); percent rounding can show 100% before a win (pre-existing, display only).
10. Forward arrows are wrong today (all `arrow` icons mirrored); Back glyph right, placement left.
11. Heebo not bundled; Rubik only.
12. Desktop: phone column 464px; landscape board 201px.
13. Mission/daily "reward" or "progress" indicators: only truthful data is missions practiced count and existing streak.

## 8. Assets and provenance
Only existing project assets or derivatives: fox emblem `concept-assets/maxifox-emblem-2x.webp` = top 416px of `src/assets/brand/maxifox-logo-alpha-2x.webp` with a bottom fade (needs owner approval as a crop of the approved logo); board candidate from the repo's own three.js generator (three is MIT, build-time only, not shipped, not saved to package.json); pawn, die, coin, fox, teacher head from `src/assets`. Icons are inline SVG paths copied from `icons.js` or drawn here (family, chart, more grid, die glyph). No remote assets, no new fonts.

## 9. Do NOT design in (gated decisions or rules)
Rounds-over XP, home career entry changes, daily XP, rank titles/salaries, Families review, index fund, any new reward/streak/currency, tip engine, changes to short-game end (12 rounds, no 13th roll), loan rounding, win condition. Nothing above alters them; the percent fix is display-only.

## 10. Regression contract for the developer
Board geometry and cell order (`BOARD_GEO` byte-identical, `ringPos`), movement mapping, 12-round end with no 13th roll, unlimited unchanged, hot-seat end-of-match guard, rounds-over message never claims a win, solo short share uses singular "שיחקתי", loan hint exact shortfall vs 1,000-rounded loan used in the debt projection, storage keys `passivo.*`, `prefers-reduced-motion`, `data-action` hooks listed above. Run `npm test` (976) and the smokes after each phase.
