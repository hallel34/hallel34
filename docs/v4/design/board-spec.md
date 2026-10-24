# Passivo v4 — Board stage spec ("Premium Night-City Strategy")
Design only. The developer implements from this file, the SVGs in `src/assets/tile/` and the token snippet in section 2 (add it to `src/styles/tokens.css`; it was not applied in this stage). Reference size **390x844**, plus **360x800** and **320x568**. RTL first, logical properties only.

Companion files:
- `src/assets/tile/{payday,opportunity,expense,market,baby,charity,tax-audit}.svg`: monoline, 24 grid, 2px stroke, `currentColor`, round caps and joins (the same style as `src/assets/category/`).
- `docs/v4/design/tile-icons-contact-sheet.png`: every icon at 96px on the grid, plus 42px tiles with label chips in dark and light, full and family mode, with the current-tile ring and the deal badges. Rendered in Chromium with the real Rubik.
- `docs/v4/design/contrast-v4-board.py`: AA audit of every new pair. 44 pairs, all pass, exit 0. Section 9 is its `--md` output.

> **Owner override 2026-10-24 (section 13 wins on conflict).** The board tiles are now the owner's 3D raster tiles (`src/assets/tile3d/`) on a bigger board.
> - **Superseded:** 1.3 (tile anatomy), 1.4 (current-tile ring CSS), the 45/41/32 tile sizes and board widths in 11, and the skyline placement in 5.
> - **Re-scoped:** 1.1–1.2 and 4. The family colours and monoline icons now drive only the text chips (landing caption, "you are here", card header chip, legend). They no longer drive the tiles.
> - **Unchanged:** the skyline art and flicker rules, die, fox corner guide, A/B/C badge, legend, labels-without-colour and the 3-second HUD.

Supersedes for the board only: v3 spec 4.3 and the "Board, roll zone", "Board, reactions" and "Family-mode tips" rows of `design/fox-usage.md`. The `--sq-*` tokens and `square-*.svg` are deprecated. Keep them until nothing reads them.

---

## 0. Rules for this stage
1. **Colour means money direction, the icon means the tile type.** There are three colour families. Each of the seven types has its own glyph, and its full Hebrew label appears wherever the square is "shown": the landing caption, the "you are here" line, the card header chip and the legend. Colour is never the only cue.
2. **One gold ring on the board**, and it marks the current tile. The roll/buy button is still the only solid gold surface on the screen. Tiles are dark smoked tiles with a tinted fill, a 1px family edge and a coloured icon. They are never solid gold, red or blue slabs.
3. **Opportunity shows no category.** It uses one neutral sparkle glyph, and the category appears only inside the card after it opens.
4. **Family mode never shows red.** The expense family becomes **deep amber** (section 1.2). The deal badge C becomes amber with the word "איטית".
5. **Cheap depth.** Use CSS and inline SVG only, with no raster on the board. Animate only `transform` and `opacity`. No `backdrop-filter` on the board screen. Every loop stops under reduced motion and while a modal covers the board.

---

## 1. Tile families per mode

### 1.1 Mapping (one UI table, e.g. `src/ui/tiles.js` `TILE_META`; adding tax-audit = one row + one i18n key)
| Type (`BOARD` id) | Icon | Label (`square.*`) | Family, full mode | Family, family mode | Why this family |
|---|---|---|---|---|---|
| `payday` | `tile/payday.svg` (banknote) | סיכום שנתי (live key `square.payday`; it was "סיכום שנתיים" in v3) | **gain** (gold) | gain (gold) | money in |
| `opportunity` | `tile/opportunity.svg` (sparkle, neutral) | הזדמנות | **gain** (gold) | gain (gold) | a chance to earn; no category hint |
| `expense` | `tile/expense.svg` (receipt + !) | הוצאה לא צפויה | **loss** (deep red) | loss → **deep amber** | money out, unplanned |
| `market` | `tile/market.svg` (candlesticks) | אירוע שוק | **info** (sky) | info (sky) | can help or hurt |
| `baby` | `tile/baby.svg` (pram) | תינוק | **info** (sky) | info (sky) | a happy life event. Its cost is stated on the card, and the tile does not shame it |
| `charity` | `tile/charity.svg` (hand + heart) | צדקה | **info** (sky) | info (sky) | an optional choice with a benefit (2 dice) |
| `tax-audit` (later stage) | `tile/tax-audit.svg` (magnifier + ?) | ביקורת רשות המסים | **info** (sky) | info (sky) | a knowledge quiz whose outcome depends on the player. New key: `square.taxAudit` |

The current board (24 tiles) has 14 gain, 3 loss and 7 info tiles. Gold dominates the loop, which suits a money game. Because the fills are dark tints, the gold CTA still reads as the one solid accent.

### 1.2 Family-mode expense colour: **deep amber** (`#D97F1F` edge / `#331C0B` fill / `#FFB46A` ink, dark theme)
- It matches the existing family "money out" language: `--expense` `#FFD27A`, `--negative-ink` `#6E4200` and verdict-red-as-amber `#D98A1C` are already amber in `data-learn="family"`.
- It is warm and calm, and it is clearly separate from sky. Simulated ΔE against sky is about 119 for deutan and about 110 for protan.
- **Known limitation, accepted:** amber and gold are close for red-green colour-blind players (simulated ΔE 5 for deutan and protan). That is why rule 1 is mandatory. The receipt glyph and the label "הוצאה לא צפויה" carry the type, and the family colour is only a secondary grouping. I tested violet and pink as alternatives. Each one collides with sky instead (ΔE 4–24), so no third hue is CVD-safe against both gold and sky. Amber keeps the family palette consistent.

### 1.3 Tile anatomy (all families)
- Size `--tile` = board inner width minus 6 gaps, divided by 7: **45px at 390, 41px at 360, 32px at 320x568**. Radius = `calc(var(--tile) * .26)`, which is 12, 11 and 8px.
- Fill `--t-bg`, 1px border `--t-edge`, icon colour `--t-ink`. The icon is an inline `<svg><use href="#tile-<id>"/></svg>` from one `<symbol>` sprite injected once, so `currentColor` works and 24 tiles cost 7 paths. Icon size = 24px at tile 40 or larger, 20px at 32–39.
- Shadow `--tile-shadow` (static, never animated): a 1px top inner highlight, a 2px hard drop and a 6/10 soft drop. This is the tile's own depth layer above the skyline (section 6).
- `.tile[data-family="gain|loss|info"]` sets `--t-bg/--t-edge/--t-ink` from the family tokens, so a type never names a colour.

### 1.4 Current tile (only one; in hot-seat, the active player's tile)
- `::after` ring: `box-shadow: var(--ring-current-shadow)`. That is a 2px gap in the ground colour, then a 2px gold ring (`#F2B53A` dark, `#8A5A00` light), then a soft glow `0 0 14px 3px rgb(242 181 58 / .45)`. The ground gap keeps the ring readable on gold-family tiles (see the contact sheet).
- Lift `translateY(var(--tile-lift))` (-2px), set once on arrival and not looped.
- Glow breathing: opacity .65 to 1 on the `::after` over `--dur-ring-breathe` (2400ms, ease-in-out). It is paused under reduced motion (static at 1) and while a modal is open.
- Non-colour cues: the pawn stands on it, it is lifted, and the "you are here" line names it (section 3.2).
- Remove the per-tile `img` approach and `.tile.is-current::after` `tile-glow 1.6s` from v3.

---

## 2. Tokens to add (CSS snippet; paste into `src/styles/tokens.css` after the `--sq-*` block)
```css
:root {
  /* ---- v4 board: tile families (dark theme). gain = gold, loss = deep red, info = sky ---- */
  --tile-gain-bg: #2A2414;  --tile-gain-edge: #C9952F;  --tile-gain-ink: #FFD479;   /* ink/bg 11.0:1, edge/ground 7.1:1 */
  --tile-loss-bg: #36121A;  --tile-loss-edge: #D9463E;  --tile-loss-ink: #FF9E92;   /* 8.4:1, 4.4:1 */
  --tile-info-bg: #0E2742;  --tile-info-edge: #4DA3FF;  --tile-info-ink: #9CCBFF;   /* 8.9:1, 7.2:1 */
  /* on the cream card (both themes): the card header chip uses the light values */
  --chip-gain-bg: #FFF0C9;  --chip-gain-edge: #A8720C;  --chip-gain-ink: #6E4200;
  --chip-loss-bg: #FDE3DF;  --chip-loss-edge: #B3261E;  --chip-loss-ink: #8F1D16;
  --chip-info-bg: #E1EEFB;  --chip-info-edge: #1A62B3;  --chip-info-ink: #12477F;
  --tile-shadow: inset 0 1px 0 rgb(255 255 255 / .06), 0 2px 0 rgb(0 0 0 / .35), 0 6px 10px rgb(0 0 0 / .28);
  --tile-lift: -2px;
  --ring-current: #F2B53A;
  --ring-gap: #0A1020;
  --ring-current-shadow: 0 0 0 2px var(--ring-gap), 0 0 0 4px var(--ring-current), 0 0 14px 3px rgb(242 181 58 / .45);
  --dur-ring-breathe: 2400ms;

  /* ---- v4 board: stage + depth ---- */
  --board-ground: rgb(10 16 32 / .62);          /* translucent plate: the skyline reads through the plaza */
  --skyline-fill: var(--skyline);              /* #0A1020 */
  --skyline-opacity: .55;                       /* behind the board plate; home keeps its own .25 */
  --window-fill: var(--skyline-window);         /* #F2B53A */
  --window-on: .85;  --window-dim: .2;
  --dur-flicker-1: 7s; --dur-flicker-2: 9.5s; --dur-flicker-3: 12.5s;   /* 6 windows max, 2 per duration, staggered delays */
  --pawn-shadow: radial-gradient(closest-side, rgb(0 0 0 / .5), rgb(0 0 0 / 0));
  --pawn-shadow-apex-scale: .6;  --pawn-shadow-apex-opacity: .45;

  /* ---- v4 die (the phases sum to the existing --dur-die 1100ms) ---- */
  --dur-die-windup: 80ms;
  --dur-die-tumble: 780ms;
  --dur-die-settle: 240ms;
  --ease-die-tumble: cubic-bezier(.15, .85, .35, 1);   /* fast release, long friction tail */
  --ease-die-rise:   cubic-bezier(.33, 1, .68, 1);     /* toss up, decelerating */
  --ease-die-fall:   cubic-bezier(.32, 0, .67, 0);     /* gravity, accelerating */
  --ease-die-settle: cubic-bezier(.34, 1.56, .64, 1);  /* = --ease-bounce: 6% overshoot on land */
  --die-toss: 28px;  --die-tilt: 10deg;
  --dur-die-result: 700ms;                              /* big number: 200 pop + 380 hold + 120 fade */
  --fs-die-result: 4.5rem;                              /* 72px; 3.5rem (56) at <=360 wide or <=640 tall */

  /* ---- v4 fox guide ---- */
  --fox-guide: 72px;                                    /* 80 at >=390, 72 at 360, 64 at 320 */
  --bubble-bg: rgb(20 28 48 / .94);                     /* smoked glass WITHOUT backdrop-filter (perf); solid fallback #141C30 */
  --bubble-border: rgb(255 255 255 / .14);
  --bubble-highlight: inset 0 1px 0 rgb(255 255 255 / .08);
  --bubble-text: var(--text);
  --bubble-base-ms: 2500;  --bubble-per-word-ms: 300;  --bubble-min-ms: 6000;  --bubble-max-ms: 15000;   /* unitless: read in JS */

  /* ---- v4 typography roles ---- */
  --fw-money: 900;   --fw-label: 500;   --fw-explain: 400;
  --fs-money-hero: 2.25rem;     /* 36: HUD cash, deal-card monthly cash flow */
  --fs-money-key: 1.375rem;     /* 22: deal-card down payment, second-rank numbers */
  --fs-money-row: 1rem;         /* 16: rows, statement lines */

  /* ---- v4 deal-strength badge (A/B/C from paybackTier). On the cream card: ---- */
  --deal-a-bg: #0B6B43; --deal-a-ink: #FFFFFF;
  --deal-b-bg: #E8A317; --deal-b-ink: #2A1700; --deal-b-border: #6B4300;   /* fill alone is 2.0:1 on cream: border is mandatory */
  --deal-c-bg: #B42318; --deal-c-ink: #FFFFFF;
  /* on dark surfaces (statement asset list): */
  --deal-a-bg-dk: #7FE3B8; --deal-a-ink-dk: #0B3D27;
  --deal-b-bg-dk: #F5C55A; --deal-b-ink-dk: #3A2600;
  --deal-c-bg-dk: #A8322B; --deal-c-ink-dk: #FFFFFF; --deal-c-border-dk: #FF9E92;
}

:root[data-theme="light"] {
  --tile-gain-bg: #FFF0C9;  --tile-gain-edge: #A8720C;  --tile-gain-ink: #6E4200;
  --tile-loss-bg: #FDE3DF;  --tile-loss-edge: #B3261E;  --tile-loss-ink: #8F1D16;
  --tile-info-bg: #E1EEFB;  --tile-info-edge: #1A62B3;  --tile-info-ink: #12477F;
  --tile-shadow: inset 0 1px 0 rgb(255 255 255 / .7), 0 1px 0 rgb(15 23 42 / .18), 0 4px 8px rgb(15 23 42 / .12);
  --ring-current: #8A5A00;
  --ring-gap: #F1E5C8;
  --ring-current-shadow: 0 0 0 2px var(--ring-gap), 0 0 0 4px var(--ring-current), 0 0 12px 2px rgb(165 106 10 / .30);
  --board-ground: rgb(241 229 200 / .78);
  --skyline-fill: #E9B979;  --skyline-opacity: .4;    /* same as home light */
  --window-on: 0; --window-dim: 0;                     /* dusk paper: no lit windows, no flicker */
  --pawn-shadow: radial-gradient(closest-side, rgb(15 23 42 / .28), rgb(15 23 42 / 0));
  --bubble-bg: rgb(255 253 247 / .96);                 /* fallback #FFFDF7 */
  --bubble-border: rgb(15 23 42 / .16);
  --bubble-highlight: inset 0 1px 0 #FFFFFF;
}

/* Family mode: no red anywhere. Loss family = deep amber; badge C = amber "איטית" */
:root[data-learn="family"] {
  --tile-loss-bg: #331C0B;  --tile-loss-edge: #D97F1F;  --tile-loss-ink: #FFB46A;
  --chip-loss-bg: #FBE2C4;  --chip-loss-edge: #A3520A;  --chip-loss-ink: #6B3300;
  --deal-c-bg: #8A4B00;     --deal-c-ink: #FFFFFF;
  --deal-c-bg-dk: #E59A4C;  --deal-c-ink-dk: #3A1C00;  --deal-c-border-dk: #E59A4C;
  --bubble-min-ms: 8000;    --bubble-per-word-ms: 400;
}
:root[data-learn="family"][data-theme="light"] {
  --tile-loss-bg: #FBE2C4;  --tile-loss-edge: #A3520A;  --tile-loss-ink: #6B3300;
}

/* Reduced motion: no tumble, no flicker, no breathing. The die result number STAYS (it is information) but only fades */
@media (prefers-reduced-motion: reduce) {
  :root { --dur-die-windup: 1ms; --dur-die-tumble: 1ms; --dur-die-settle: 120ms; --die-toss: 0px; --die-tilt: 0deg;
          --dur-ring-breathe: 0s; --dur-flicker-1: 0s; --dur-flicker-2: 0s; --dur-flicker-3: 0s; }
}
:root[data-motion="reduced"] { --dur-die-windup: 1ms; --dur-die-tumble: 1ms; --dur-die-settle: 120ms; --die-toss: 0px; --die-tilt: 0deg;
  --dur-ring-breathe: 0s; --dur-flicker-1: 0s; --dur-flicker-2: 0s; --dur-flicker-3: 0s; }
```
Animations that read these must also be wrapped in `@media (prefers-reduced-motion: no-preference)` and `:root:not([data-motion="reduced"])`. A `0s` duration then acts as a second safety. Bubble timing is not a motion token, so it is unchanged under reduced motion.

---

## 3. Labels, legend and "full label wherever the square is shown"
Tiles are too small for text (32–45px; even "הזדמנות" would be 8px). The label therefore appears in four places, always as **icon + full label** in the family chip colours:

### 3.1 Landing caption (plaza), every landing
- When the pawn lands, a pill appears at the plaza centre, above the die: 32px icon plus the label at 20/700. It uses `--t-bg` fill, a 1px `--t-edge` border, `--t-ink` text, radius 14 and padding 8/16.
- Motion: scale .9 to 1 with opacity 0 to 1 over 200ms `--ease-out`, then a 450ms hold before the card opens. Under reduced motion it is a 120ms fade with the same hold.
- The status line (`aria-live`) reads "נחתתם על: הוצאה לא צפויה".

### 3.2 "You are here" line (plaza, idle)
- Under the status line: a 16px icon and "אתם על: הזדמנות" at 13/500 in `--text-muted`, with the icon in `--t-ink`.
- At 320x568 it merges into the status line as a prefix chip.

### 3.3 Card header chip (every card the tile opens)
- Opening the card from the tile shows a 40px chip with the 24px tile icon plus the full label at 15/700. It uses `--chip-<family>-*`, because the card is cream in both themes.
- The ribbon (3px top edge, from v3) = `--chip-<family>-edge`. Deal cards keep the badge colour as the ribbon after the reveal (section 8).
- Opportunity: the category chip (`category/*.svg`) appears **next to** the tile chip, inside the card only, never on the board.

### 3.4 Legend sheet ("מה יש על הלוח?")
- Entry: a 48x48 ghost icon button ("?", `aria-label="מקרא המשבצות"`) in the plaza's top inline-end corner. The plaza holds no tile, so it is always free. It is not hover-only.
- A bottom sheet (`--surface`, radius 22 top, max 70dvh, one level) has three groups, each with a group header (14/700) and a family dot plus a word, so the group is named in text:

| Group header | Row: tile (40px, real tile render) + label 16/500 + one line 14/400 |
|---|---|
| **כסף נכנס** (gain) | סיכום שנתי — "עוברים או נוחתים כאן: מקבלים את מה שנשאר מהמשכורת בשנה (התזרים החודשי כפול 12)." |
| | הזדמנות — "עסקה שאפשר לקנות או לוותר עליה. מה בפנים? מגלים רק כשנוחתים." |
| **כסף יוצא** (loss) | הוצאה לא צפויה — "תשלום שלא תכננתם. אם חסר מזומן, אפשר הלוואה." |
| **אירועים** (info) | אירוע שוק — "משהו קורה בשוק: הצעה לקנות מכם נכס, או שינוי לכולם." |
| | תינוק — "המשפחה גדלה: ההוצאות החודשיות עולות קצת." |
| | צדקה — "אפשר לתרום 10% מההכנסה ולקבל שתי קוביות לשלושה תורות." |
| | ביקורת רשות המסים — "שאלת ידע קצרה. תשובה נכונה חוסכת כסף." (row hidden until the type ships) |

- Close is a 48px icon button plus a scrim tap. On open, focus goes to the sheet title; on close, it returns to the "?" button.
- Copy keys go under `legend.*` in `he.json`. They are proposals; the CEO approves the copy.

---

## 4. Monoline icons (`src/assets/tile/`)
- 24x24 viewBox with `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, exactly like `category/*.svg`. Live area 2–22, optical centre at 12.
- **Silhouettes are distinct at 18px** (checked on the contact sheet):

| Icon | Shape |
|---|---|
| payday | wide rectangle |
| opportunity | four-point star with a "+" |
| expense | tall receipt with a zigzag base and "!" |
| market | three vertical candles |
| baby | pram: bowl, hood and two wheels |
| charity | open hand under a heart |
| tax-audit | circle and handle with "?" |

- The glyphs that hold an inner mark ("!", "?", circle) all have different outlines.
- None of them is directional, so **none is mirrored in RTL**.
- Opportunity carries no category: no house, cart or chart. Market candlesticks differ from `category/stock.svg` (axes plus a rising line), so a market tile never reads as "stock deal".

---

## 5. Board background and depth layers (cheap)
Back to front (z order inside `.screen-board`):
| Layer | What | How | Cost |
|---|---|---|---|
| 0 Background | `--grad-night` on `.screen-board` | as now | 0 |
| 1 Skyline | the **home** skyline (`SKY` in `src/ui/screens/start.js`: 10 buildings and 8 windows, no stars on the board) as one inline SVG | `position:absolute; inset-inline:0; inset-block-end:0; aspect-ratio:360/160; viewBox="0 640 360 160"` (meet, no slicing, so `%` maps exactly). Fill `--skyline-fill` at `--skyline-opacity`. It sits behind the board plate's lower half and the fox strip | 1 small layer, painted once (under 2 KB markup) |
| 1b Flicker windows | **6** windows (of the 8) as HTML `<i class="win">` 4x5px, absolutely placed in `%` of the skyline box, `will-change: opacity` | `animation: win-flicker var(--dur-flicker-N) steps(1, end) infinite` with 2 windows per duration and delays 0, -2.3s, -4.1s. Keyframes: on at 0%, dim at 62%, on at 66%, dim at 90%, on at 92% (a short, irregular flicker, never a pulse) | compositor-only opacity on 6 tiny layers, no repaint |
| 2 Board plate | `.board` with `--board-ground` (translucent) and a 1px `--glass-border`, radius 26 | the skyline shows through the plaza, and no blur is used | 0 |
| 3 Tiles | opaque families with `--tile-shadow` | static shadows, painted once | 24 small paints at first render |
| 4 Pawn | pawn plus its **own shadow**: a sibling ellipse 70% of pawn width x 8px, `background: var(--pawn-shadow)`, at the pawn's feet | on each hop the shadow goes to `scale(var(--pawn-shadow-apex-scale))` and `opacity(var(--pawn-shadow-apex-opacity))` at the apex and returns on land (same 180ms `--dur-fast`). Pawn squash on land: `scale(1.08, .92)` 80ms, then back. **No `filter: drop-shadow` on the moving pawn** | transform and opacity only |
| 5 Plaza content | die (with its own shadow), landing caption, status | section 6 | |
| HUD, strip, CTA | outside the board | | |

Perf guard rails (the Lighthouse margin is 0.91 against a 0.90 gate):
- No raster on the board.
- No `backdrop-filter` anywhere on the board screen. The v3 `.glass` HUD uses `--glass-bg` only; check that `backdrop-filter` is not set.
- No `filter` animation.
- Flicker and ring-breathe start only after the board is interactive. Add `.is-live` to `.screen-board` in a `requestIdleCallback`, or after 1500ms as a fallback. Before that, animations stay `paused`.
- Pause both loops while `document.hidden` or while any modal or sheet is open (`[data-modal-open] .win, [data-modal-open] .tile.is-current::after { animation-play-state: paused; }`). The board is behind an 88% scrim then, so nothing is lost.
- Reduced motion: no flicker (windows static at `--window-on`), no breathing, the pawn jumps, fades only.
- Budget: board screen DOM change ≤ +20 nodes and no new requests (the sprite is inline). QA reruns Lighthouse on home and on the board route.

---

## 6. Die (3D feel)
Existing structure kept: `.dice > .die > (.die-shadow, .die-tumble > .die-cube)`, with 72px cream faces (`die-N.svg`). The changes are below.

### 6.1 Timeline (one die; 1100ms total = `--dur-die`)
| Phase | Time | `.die-tumble` (WAAPI) | `.die-shadow` |
|---|---|---|---|
| Wind-up | 0–80ms | `scale(.94)`, ease-in | `scale(1.05)` |
| Toss up | 80–430ms | `translateY(calc(var(--die-toss) * -1))` with `--ease-die-rise` | to `scale(.6)`, opacity .18 |
| Fall | 430–860ms | back to 0 with `--ease-die-fall` | back to `scale(1)`, opacity .35 |
| Tumble (concurrent with toss and fall) | 80–860ms | the cube goes from a random start to the final `SHOW[n]` plus 2 full turns on X and 1 on Y, with `--ease-die-tumble`. **Tilt:** rotateZ keyframes `-var(--die-tilt)` at 15%, `+7deg` at 45%, `-3deg` at 75%, `0` at 100% | — |
| Settle | 860–1100ms | `scale(1.06)` to `.98` to `1`, `--ease-die-settle`; at the same time a haptic tick `navigator.vibrate(12)` (when enabled) | squash `scaleX(1.1)` to 1 |

- The two dice (charity) use the same timeline, with die 2 offset by +60ms and a mirrored tilt.
- **The shadow** is a pre-blurred `radial-gradient(closest-side, rgb(0 0 0/.45), transparent)` ellipse. Replace the current `filter: blur(5px)` on `.die-shadow`, because a blur repaints when it is scaled.

### 6.2 Result as a big number
- At 1100ms the number appears centred over the die: `--fs-die-result` (72px; 56 at 360 or narrower, or 640 or shorter), weight 900, tabular, `--text`, with `paint-order: stroke` and a 4px `--ring-gap` stroke so it reads over the skyline.
- Motion: scale .6 to 1 over 200ms `--ease-bounce`, hold 380ms, fade out 120ms. Total `--dur-die-result` 700ms.
- With two dice it shows the sum, with "4 + 5" under it at 14/500 muted.
- The pawn starts hopping at 1100 + 200ms, so the number is read before motion starts.
- Reduced motion: the face crossfades (120ms) and the number fades in for the same 700ms hold. It is information, so it is never removed.
- SR: the existing `aria-label` on `.dice` ("יצא 5").

---

## 7. Fox as a guide (board)
Big poses and the halo stay on **home, win and profession** screens; nothing changes there.

### 7.1 Placement
- On the board the fox is a **circle crop** (`think` / `celebrate` / `worried` / `ponder` WebP, 512 source), sized `--fox-guide`: **80px at 390, 72px at 360, 64px at 320**.
- It has a 2px `--border` ring, no gold, and the shadow `0 6px 12px rgb(0 0 0/.35)` (static).
- It sits in the **fox strip** (the space between the board plate and the CTA), at the inline-end corner (left in RTL), 12px from the edge and vertically centred in the strip.
- The roll pose (128px) and the `tip` full-body pose (150px) are retired from the board.
- Default: `think`. Purchase or payday or milestone: `celebrate`. Shortfall or loan: `worried`. Market: `ponder`. These are the same triggers as v3's fox-note mapping.

### 7.2 Bubble (smoked glass)
- Position: beside the fox toward the inline-start, with its tail pointing at the fox.
- Size: max width = strip width − fox − 36px (**258 at 390, 224 at 360, 208 at 320**). Padding 12/14, radius 18.
- Surface: `--bubble-bg`, 1px `--bubble-border` and `--bubble-highlight`. No backdrop-filter.
- Type: text 15/400 `--bubble-text`, at most 3 lines (14px at 320). An optional term in 15/500.
- A close "×" (20px glyph in a 48x48 hit area) sits at the bubble's inline-end top corner, and **tapping anywhere on the bubble closes it**.
- The fox becomes a real button (`aria-label="פסיבו: הודעה אחרונה"`, a 48px or larger hit area thanks to its size). Tapping it re-opens the last message. This replaces the v3 `pointer-events:none` rule for the board only.
- Enter: opacity plus a 8px inline slide over 240ms `--ease-out`. Exit: 160ms `--ease-in`. Reduced motion: fades.
- `role="status"` (polite). The text must also exist in the log or the status if it is essential (rule 7.4).

### 7.3 Auto-close formula
```
words = text.trim().split(/\s+/).length
ms    = clamp(--bubble-min-ms, --bubble-base-ms + words × --bubble-per-word-ms, --bubble-max-ms)
full mode:   clamp(6000, 2500 + 300·words, 15000)   → 8 words: 6.0 s · 15 words: 7.0 s · 25 words: 10.0 s
family mode: clamp(8000, 2500 + 400·words, 15000)   → 8 words: 8.0 s · 15 words: 8.5 s · 25 words: 12.5 s
```
- 300ms per word is about 200 words a minute, an adult's casual Hebrew reading pace. Family mode uses 400ms per word for young readers and a higher floor.
- The timer **pauses** while the bubble is pressed, hovered or focused, while `document.hidden`, and while any modal or sheet is open. It **restarts in full** after the pause, and a new message replaces the old one with a new timer.
- With a screen reader (focus inside) the bubble never auto-closes.
- Copy rule: bubble text is 25 words or fewer. Anything longer goes to the existing "פסיבו מסביר" explainer flow.

### 7.4 Never hide essential info
- The bubble and fox live **only** in the fox strip. They never overlap the HUD, tiles, plaza, die, CTA or any number.
- If the strip is shorter than `--fox-guide` + 16px (short landscape, split screen), the fox is hidden. The message goes to the plaza status line, and from there to a toast that also does not cover the CTA.
- The bubble is never the only place a game fact appears. Amounts and results are in the HUD or the card, and the bubble only comments on them.

---

## 8. Money typography and deal cards
### 8.1 Roles
| Role | Spec |
|---|---|
| Money (all) | Rubik **900**, `tabular-nums` and `--num-features`, `unicode-bidi: isolate`, ₪ at .6em in weight 500 (the existing `.money`, weight raised from 700 to `--fw-money`) |
| Labels (field names, chips, tile labels, buttons) | weight **500** (buttons stay 700) |
| Explanations (card body, legend lines, bubble) | weight **400** |

### 8.2 Deal card: the monthly cash flow is the largest number after the title
- In the v3 build the down payment and the cash flow are both 32px in a 2-up tile (see `qa/screens/v3-after/14a-FULL-deal-card-*`). The new order inside the key-numbers block:
  1. **Title** 24/700 (`--card-text`), up to 2 lines.
  2. **Monthly cash flow hero row**, full width: label "תזרים חודשי" 14/500 `--card-muted`, then the value at `--fs-money-hero` **36/900** (`--income-ink` when positive, `--negative-ink` when negative; family = amber ink), then "בחודש" 13/400. At the row's inline-end sits the **deal badge** (8.3). Fit-text has a minimum of 28px at 320, and the value is never smaller than 1.3x the down payment.
  3. **Second row, 2-up:** "מקדמה" `--fs-money-key` 22/900 `--card-text` | "החזר ההשקעה" 22/900 years (for example "4.9 שנים").
  4. Everything else is 16px or smaller (quiet info as in v3).
- Stocks: the hero is "דיבידנד חודשי" and the key is "עלות" (price x qty from the stepper).
- Non-deal cards (expense, market, baby, charity): the hero is the amount that changes this turn (to pay, offered, added to expenses, to donate) at 36/900. "מזומן אחרי" is the key at 22/900.

### 8.3 Deal-strength badge A/B/C
Derive from the existing tier, the **single source**: `paybackTier(paybackYears(downPayment, monthlyCashFlow))` in `src/engine/selectors.js`, with `PAYBACK_OK_YEARS = 8` and `PAYBACK_SLOW_YEARS = 14`. Yield = annual cash flow ÷ down payment = 1 / payback years.

| Badge | Tier | Payback | Yield (annual cash flow / down payment) | Label (full) | Label (family) | Colour (full / family) | Icon |
|---|---|---|---|---|---|---|---|
| **A** | `ok` | ≤ 8 years | ≥ 12.5% | עסקה חזקה | עסקה חזקה | `--deal-a-*` green / same | check |
| **B** | `slow` | > 8 and ≤ 14 | ≥ 7.14% and < 12.5% | עסקה סבירה | עסקה סבירה | `--deal-b-*` gold with a 1.5px border / same | minus |
| **C** | `bad` | > 14, or cash flow ≤ 0 | < 7.14% | עסקה חלשה | **החזר איטי** | `--deal-c-*` red / **deep amber `#8A4B00`**, never red | close / **hourglass** (`verdict/hourglass.svg`) |

- Anatomy: a 28x28 square (radius 8) with the letter at 16/900, followed by the label at 14/500 in `--card-text`. The badge is **letter + word + icon**, never colour alone. The aria-label is "דירוג עסקה A, עסקה חזקה, תשואה 24.5% בשנה".
- Thresholds use the unrounded value. A displayed "12.5%" therefore always means A.
- A down payment of 0 means 0 years, so A.
- Stocks: dividend yield = monthly dividend × 12 ÷ price. A stock with no dividend gets **no letter**. It shows a sky pill "ספקולטיבי" instead, because growth stocks are not "bad deals".
- **It merges with the v3 verdict pill.** It is the same tier, so there is one display, not two: the badge replaces the pill's leading icon. In the guess flow (`05a`) the badge stays hidden until the reveal, like the verdict.
- The ribbon after the reveal = the badge fill.
- The statement asset list can show the badge at 20px with the `-dk` tokens.

---

## 9. Contrast table (new pairs; generated by `docs/v4/design/contrast-v4-board.py --md`, all pass)
Board ground is measured at both ends of the plate: `#0A1020` (darkest band) and `#131C33` (lighter band). Light ground is `#F1E5C8`. Labels use the tile family fill in dark and the light fill on cream cards and light theme.

| Theme | Pair | FG | BG | Ratio | Need | Pass |
|---|---|---|---|---|---|---|
| DARK | label + icon ink / tile bg — gold (payday, opportunity) | `#FFD479` | `#2A2414` | 10.98:1 | 4.5 | yes |
| DARK | tile edge / board ground — gold (non-text) | `#C9952F` | `#0A1020` | 7.06:1 | 3 | yes |
| DARK | tile edge / board ground lighter band — gold (non-text) | `#C9952F` | `#131C33` | 6.30:1 | 3 | yes |
| LIGHT | label + icon ink / tile bg — gold | `#6E4200` | `#FFF0C9` | 7.60:1 | 4.5 | yes |
| LIGHT | tile edge / board ground — gold (non-text) | `#A8720C` | `#F1E5C8` | 3.31:1 | 3 | yes |
| DARK | label + icon ink / tile bg — red (expense), full mode | `#FF9E92` | `#36121A` | 8.39:1 | 4.5 | yes |
| DARK | tile edge / board ground — red (non-text) | `#D9463E` | `#0A1020` | 4.42:1 | 3 | yes |
| DARK | tile edge / board ground lighter band — red (non-text) | `#D9463E` | `#131C33` | 3.94:1 | 3 | yes |
| LIGHT | label + icon ink / tile bg — red, full mode | `#8F1D16` | `#FDE3DF` | 7.32:1 | 4.5 | yes |
| LIGHT | tile edge / board ground — red (non-text) | `#B3261E` | `#F1E5C8` | 5.22:1 | 3 | yes |
| DARK | label + icon ink / tile bg — sky (market, baby, charity, tax-audit) | `#9CCBFF` | `#0E2742` | 8.94:1 | 4.5 | yes |
| DARK | tile edge / board ground — sky (non-text) | `#4DA3FF` | `#0A1020` | 7.22:1 | 3 | yes |
| DARK | tile edge / board ground lighter band — sky (non-text) | `#4DA3FF` | `#131C33` | 6.44:1 | 3 | yes |
| LIGHT | label + icon ink / tile bg — sky | `#12477F` | `#E1EEFB` | 7.98:1 | 4.5 | yes |
| LIGHT | tile edge / board ground — sky (non-text) | `#1A62B3` | `#F1E5C8` | 4.88:1 | 3 | yes |
| DARK | label + icon ink / tile bg — deep amber (expense), family | `#FFB46A` | `#331C0B` | 9.14:1 | 4.5 | yes |
| DARK | tile edge / board ground — deep amber (non-text) | `#D97F1F` | `#0A1020` | 6.32:1 | 3 | yes |
| DARK | tile edge / board ground lighter band — deep amber (non-text) | `#D97F1F` | `#131C33` | 5.64:1 | 3 | yes |
| LIGHT | label + icon ink / tile bg — deep amber, family | `#6B3300` | `#FBE2C4` | 7.99:1 | 4.5 | yes |
| LIGHT | tile edge / board ground — deep amber (non-text) | `#A3520A` | `#F1E5C8` | 4.45:1 | 3 | yes |
| DARK | current ring gold-400 / board ground (non-text) | `#F2B53A` | `#0A1020` | 10.33:1 | 3 | yes |
| DARK | current ring gold-400 / lighter band (non-text) | `#F2B53A` | `#131C33` | 9.22:1 | 3 | yes |
| LIGHT | current ring `#8A5A00` / paper ground (non-text) | `#8A5A00` | `#F1E5C8` | 4.74:1 | 3 | yes |
| CARD | badge A ink / A fill | `#FFFFFF` | `#0B6B43` | 6.57:1 | 4.5 | yes |
| CARD | badge B ink / B fill | `#2A1700` | `#E8A317` | 7.93:1 | 4.5 | yes |
| CARD | badge C ink / C fill, full | `#FFFFFF` | `#B42318` | 6.57:1 | 4.5 | yes |
| CARD | badge C ink / C fill, family (amber) | `#FFFFFF` | `#8A4B00` | 6.80:1 | 4.5 | yes |
| CARD | badge A fill / cream (non-text) | `#0B6B43` | `#FFF6E3` | 6.11:1 | 3 | yes |
| CARD | badge B border / cream (non-text; the fill alone is 2.0:1) | `#6B4300` | `#FFF6E3` | 8.05:1 | 3 | yes |
| CARD | badge C fill full / cream (non-text) | `#B42318` | `#FFF6E3` | 6.12:1 | 3 | yes |
| CARD | badge C fill family / cream (non-text) | `#8A4B00` | `#FFF6E3` | 6.33:1 | 3 | yes |
| DARK | badge A ink / A fill (dark surface) | `#0B3D27` | `#7FE3B8` | 7.94:1 | 4.5 | yes |
| DARK | badge B ink / B fill (dark surface) | `#3A2600` | `#F5C55A` | 8.93:1 | 4.5 | yes |
| DARK | badge C ink / C fill full (dark surface) | `#FFFFFF` | `#A8322B` | 6.65:1 | 4.5 | yes |
| DARK | badge C ink / C fill family (dark surface) | `#3A1C00` | `#E59A4C` | 6.73:1 | 4.5 | yes |
| DARK | badge A fill / surface `#182238` (non-text) | `#7FE3B8` | `#182238` | 10.25:1 | 3 | yes |
| DARK | badge B fill / surface (non-text) | `#F5C55A` | `#182238` | 9.83:1 | 3 | yes |
| DARK | badge C full border / surface (non-text) | `#FF9E92` | `#182238` | 7.97:1 | 3 | yes |
| DARK | badge C family fill / surface (non-text) | `#E59A4C` | `#182238` | 6.84:1 | 3 | yes |
| DARK | fox bubble text / smoked glass (fallback `#141C30`) | `#F5F7FC` | `#141C30` | 15.82:1 | 4.5 | yes |
| DARK | fox bubble muted / smoked glass | `#A9B5D0` | `#141C30` | 8.24:1 | 4.5 | yes |
| LIGHT | fox bubble text / light glass (fallback `#FFFDF7`) | `#0F172A` | `#FFFDF7` | 17.55:1 | 4.5 | yes |
| DARK | die result number / plaza | `#F5F7FC` | `#0F172A` | 16.66:1 | 4.5 | yes |
| LIGHT | die result number / plaza | `#0F172A` | `#FBF3E1` | 16.16:1 | 4.5 | yes |

Colour-vision check (simulated ΔE, Viénot; 20 or more = clearly different):

| Pair | Deutan | Protan | Tritan |
|---|---|---|---|
| gold vs red | 19 | 40 | 48 |
| gold vs sky | 115 | 109 | 74 |
| red vs sky | 100 | 78 | 122 |
| gold vs family amber | **5** | **5** | 21 |

The weak gold vs red (19) and gold vs amber (5) pairs are covered by rule 1 (icon + label).

---

## 10. Board HUD hierarchy (the 3-second test)
**Acceptance:** a first-time user looks at the board on turn 1 for 3 seconds. They must then answer (1) "what am I trying to do?", (2) "how am I doing?" and (3) "what do I do now?". The HUD answers each with one zone, ranked by visual weight:

| Rank (visual weight) | Question | Element | Spec |
|---|---|---|---|
| **1a** | What now? | **CTA** "הטילו קובייה" | the only solid gold, 64px tall (56 at 320), full width, in the thumb zone. Its label always names the next action (הטילו קובייה / המשיכו / …) |
| **1b** | How am I doing? | **Cash** | `--fs-money-hero` 36/900 `--text` (28 at 320), 24px coin, word "מזומן" 12/500 muted above it (now in full mode too) |
| **2** | What is the goal? | **Goal meter** "המטרה: חופש כלכלי" | caption row 14/500 with a 16px flag glyph at the bar's inline-end. The bar is 12px (8 at 320), `--passive-fill` from the inline-start, with ticks at 25/50/75. Under it: start "הכנסה פסיבית **₪0**", end "הוצאות **₪10,200**" (13/500 labels, 15/900 money), and "**0%** מהדרך" next to the passive amount. Wording is the same in family mode ("כסף שעובד בשבילכם" replaces "הכנסה פסיבית"). Turns 1–3 only: the caption reads "המטרה: שהכנסה הפסיבית תעבור את ההוצאות" (one line, 14/500). After that it shortens to "המטרה: חופש כלכלי" |
| **3** | (context) | identity, turn, flow chip, icon buttons | profession 15/700, turn 13/500 muted, flow chip 14/700 ghost, three 48px icon buttons. None is gold or heavier than rank 2 |
| plaza | What now? (echo) | status line | 16/700 `--text`, a verb phrase: "התור שלכם: הטילו קובייה", then the "you are here" line (3.2) |

- Reading path (RTL, top-down): identity (light) → cash (heavy) → goal (medium, labelled with the word "המטרה") → board → CTA (heaviest colour).
- Gold appears only on the CTA and the current-tile ring. The pawn's tile and the CTA are the two warm focal points, and the meter is teal, so the three answers never compete.
- **QA protocol:** 5 people who have never played, shown the 390x844 screenshot of turn 1 for 3 s, then the three questions. Pass = at least 4 of 5 answer all three (goal ≈ "שהכנסה פסיבית תכסה את ההוצאות / חופש כלכלי"; state ≈ the cash amount or "אין לי עדיין הכנסה פסיבית"; next ≈ "להטיל קובייה").

---

## 11. Behaviour at 390 / 360 / 320
| Item | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| HUD height | 184 (3 rows + goal block) | 176 | 128: row 1 48 + cash row 40 (cash 28/900 with the flow chip inline) + goal: 8px bar and one 12/500 line "המטרה: ₪0 מתוך ₪10,200" |
| Board plate (outer) | 358 | 328 | 264 (height-bound; the developer re-derives `--board-w` from the new HUD heights) |
| Tile / icon | 45 / 24 | 41 / 24 | 32 / 20 |
| Current ring | 2+2px + 14px glow | same | 2+2px + 8px glow (the gap stays 2px) |
| Plaza | die 72, result 72px, landing caption 20/700, "?" legend 48 | die 72, result 56, caption 18/700 | die 52, result 56, caption 16/700 (icon 24), "you are here" merged into the status, "?" visual 40 in a 48 hit area |
| Fox strip | about 190 tall: fox 80, bubble max 258 | about 178: fox 72, bubble 224 | about 90: fox 64, bubble 208, 3 lines at 14px. Below 80px of strip the fox hides (7.4) |
| Skyline box | full width, `aspect-ratio 360/160` (173px tall), anchored to the screen bottom behind the strip and the plate's lower third | 160px | 142px; 4 flicker windows instead of 6 |
| CTA | 64 | 64 | 56 |
| Deal card hero cash flow | 36 | 36 | fit-text 36 down to 28; down payment 22 down to 18 (ratio ≥ 1.3) |
| Legend sheet | 7 rows, no scroll | 7 rows, no scroll | scrolls within 70dvh |

There is no horizontal scroll at any width. The landing caption never exceeds plaza width − 16px, and a long label ("ביקורת רשות המסים", 20/700 ≈ 170px) fits the 32px-tile plaza (176px) only at 16/700, hence the size step.

---

## 12. Conflicts and decisions for the CEO / developer
1. **Fox-usage changes on the board:** the 128px roll pose and the 150px family tip pose leave the board. The fox becomes a tappable 64–80px circle guide. `design/fox-usage.md` should be updated by the designer after approval (not edited here).
2. **v3 rule "category never on tiles"** holds. **v3 rule "one accent"** holds: tiles use tinted gold, and only the CTA is solid gold.
3. **The verdict pill merges into badge A/B/C.** Same tier, one display. The v3 "verdict-*" tokens stay for the ribbon.
4. `.money` weight goes from 700 to 900 everywhere. Recheck fit-text at 320 in the statement.
5. **New i18n keys** (proposals): `square.taxAudit` "ביקורת רשות המסים", `legend.*` (section 3.4), `board.youAreHere` "אתם על: {label}", `board.landed` "נחתתם על: {label}", `hud.goal` "המטרה: חופש כלכלי", `hud.goalFirst` "המטרה: שהכנסה הפסיבית תעבור את ההוצאות", `hud.goalShort` "המטרה: {passive} מתוך {expenses}", `deal.badge.a/b/c` (+ `c.family` "החזר איטי"), `deal.speculative` "ספקולטיבי", `fox.lastMessage` "פסיבו: הודעה אחרונה".
6. **Tax-audit:** the icon, label, family (info) and legend row are ready. The card UI (quiz) is for its own stage.


---

## 13. Owner override 2026-10-24: 3D raster tiles + bigger board
Source: `design/board-ref/owner-board-3d-tiles.jpg` (owner mockup, 1440x2912). The owner asked for two things: a **bigger board**, and **these squares**.

### 13.1 Assets (`src/assets/tile3d/`, extracted by `docs/v4/design/extract-tile3d.py`, deterministic)
| File (@1x 60x72 · @2x 120x144) | Type | From the mockup | Bytes @1x / @2x |
|---|---|---|---|
| `payday.webp` / `payday@2x.webp` | payday | yellow banknote tile (top row) | 1,876 / 3,822 |
| `opportunity.webp` / `@2x` | opportunity (**every** opportunity, whatever the card) | green house (top row) | 1,936 / 4,012 |
| `expense.webp` / `@2x` | unexpected expense, full mode | red lightning (top row) | 1,830 / 3,736 |
| `expense-family.webp` / `@2x` | unexpected expense, **family mode** (no red) | red lightning hue-shifted: body to deep amber (H 26°, V×0.93), bolt to cream so it stays readable on amber | 1,844 / 3,864 |
| `market.webp` / `@2x` | market | blue chart (top row) | 1,968 / 4,000 |
| `baby.webp` / `@2x` | baby | pink baby face (left column) | 1,816 / 3,926 |
| `charity.webp` / `@2x` | charity | purple heart (top row) | 1,424 / 3,018 |
| `tax-audit.webp` / `@2x` | tax audit (later stage) | the baby tile body with the medallion inpainted, pink hue-shifted to **teal** (H 176°), plus the `tile/tax-audit.svg` magnifier and "?" (exact path geometry) as a raised cream emboss: offset shadow, cream body, lower bevel and top highlight | 1,704 / 3,656 |

- **Budget:** all 16 files total **43.4 KB**. A device fetches one density, so a 2x phone fetches the 7 board tiles at about 27 KB and a 1x device about 13 KB. That is well under the 80 KB cap.
  - Use `<img src="x.webp" srcset="x.webp 1x, x@2x.webp 2x" width="60" height="72" decoding="async" alt="">` with **no `loading="lazy"`**, because the board is the main screen.
  - Preload only `opportunity@2x.webp` and `payday@2x.webp`, which make up 14 of the 24 tiles.
- **Sharpness:** the source tiles are about 150px wide, and the @2x footprint is 96px, so every asset is a **downscale** (Lanczos). Nothing is upscaled. On DPR 3 phones the browser upscales @2x by 1.5, which looks slightly soft but acceptable. A @3x set would add about 40 KB, so it is not recommended under this perf margin.
- **Matting:**
  - The board beige becomes alpha, using a per-pixel projection onto the board colour plus a beige-hue exclusion.
  - The contact shadow is kept as **black at the measured darkening**, lower half only (light comes from the top), so it reads on both the dark and the light board.
  - Neighbour tiles and their shadows are cut by component isolation.
  - Composite tests are in the contact sheet, on `#0F172A` and `#F1E5C8`.
- **Ignored, as decided:** the red house (ambiguous next to the green house, and unreadable without colour) and the coins tile.
- **Without colour:** the seven figures are distinct silhouettes (banknote, house, bolt, bars, face, heart, magnifier). The full text label still appears in the caption, "you are here" line, card chip and legend, using the monoline icons and family chips from sections 1–4.
- **Note for the CEO:** the green house is now the single opportunity glyph. It is neutral in that it is the same for every opportunity, but it leans "real estate" (section 0 rule 3). It is the owner's decision; if the owner wants it, a neutral fallback is the sparkle (`tile/opportunity.svg`).

### 13.2 Bigger board: exact sizes
The board fills the width with **8px side gutters**, as in the mockup. The HUD keeps its 12px gutters above it, and the fox strip and roll button sit below.

| | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Board slot (viewport − 2×8) | 374 | 344 | 304 |
| **Tile cell `--tile-c`** | **48px** | **44px** | **38px** |
| **Gap `--tile-gap`** | **4px** | **4px** | **4px** |
| Plate padding inline / bottom `--board-pad` | 6 | 6 | 6 |
| Plate padding top = pad + 0.375 × cell (room for roofs and bars) | 24 | 23 | 20 |
| Plate outer width = 7c + 6g + 2·pad | **372** | **344** | **302** |
| Plate outer height = 7c + 6g + top + bottom | **390** | **361** | **316** |
| Tile image box (`1.25c × 1.5c`) | 60x72 | 55x66 | 47.5x57 |
| Plaza (5c + 4g) | 256 | 236 | 206 |
| Die / result number | 72 / 72 | 64 / 56 | 52 / 56 |
| HUD (section 10) | 184 | 176 | 128 |
| Vertical stack: safe-top + HUD + 8 + plate + 8 + **strip** + CTA + 8 + safe-bottom | 10+184+8+390+8+**156**+64+8+16 = 844 | 10+176+8+361+8+**149**+64+8+16 = 800 | 6+128+6+316+6+**36**+56+6+8 = 568 |
| Fox guide (needs strip ≥ fox + 16) | 80, shown | 72, shown | **hidden** (strip 36). Bubble text goes to the status line |

- There is no scroll at 360x800. On 360x640 the strip is 45px, so the fox hides there too.
- Below a 304px slot (for example a 300px split screen) the cell is `floor((slot − 12 − 24) / 7)`, with a floor of 34px. Under 34 the plate scales down as a whole (`zoom` is not allowed; use a `transform: scale()` wrapper).
- Formula for the developer: `--tile-c: clamp(34px, calc((min(100vw, 430px) - 16px - 12px - 24px) / 7), 52px)`, rounded down in JS when it sets the variable. Then height-check `--board-w` against `100dvh` and fall back to the smaller cell, never to scrolling.

### 13.3 Tile CSS (replaces 1.3–1.4)
```css
.board { --tile-gap: 4px; --board-pad: 6px;
  display: grid; grid-template-columns: repeat(7, var(--tile-c)); grid-template-rows: repeat(7, var(--tile-c)); gap: var(--tile-gap);
  padding: calc(var(--board-pad) + var(--tile-c) * .375) var(--board-pad) var(--board-pad);
  inline-size: max-content; margin-inline: auto; border-radius: 22px; overflow: hidden; isolation: isolate;
  background: var(--plate-bg); box-shadow: var(--plate-shadow); }
.tile { position: relative; z-index: 1; }                     /* the cell = the tile footprint */
.tile > img { position: absolute; inline-size: 125%; block-size: 150%; max-inline-size: none;
  inset-inline-start: -12.5%; inset-block-end: -12.5%;          /* footprint = 80% of the image width, base 1/12 above its bottom */
  transition: transform var(--dur-fast) var(--ease-out); }
/* DOM order paints later rows over earlier ones: a roof overlapping the tile above is intended (as in the mockup) */
```
Tokens (add to section 2):
```css
:root {
  --plate-bg: #131C33;
  --plate-shadow: inset 0 0 0 1px rgb(255 255 255 / .10), 0 6px 0 #26325A, 0 16px 28px rgb(0 0 0 / .40);  /* 6px rim = the mockup's raised plate */
  --skyline-board: #1C2747;  --tile-lift-current: -4px;  --tile-scale-current: 1.04;
}
:root[data-theme="light"] {
  --plate-bg: #F1E5C8;
  --plate-shadow: inset 0 0 0 1px rgb(15 23 42 / .10), 0 6px 0 #A9AEDC, 0 16px 28px rgb(15 23 42 / .18);  /* lavender rim, as in the mockup */
  --skyline-board: #3A4A8C;
}
```

### 13.4 Current tile on raster tiles (CSS only)
```css
.tile.is-current { z-index: 3; }
.tile.is-current::before { content: ""; position: absolute; inset: -3px; z-index: -1; pointer-events: none;   /* a gold pad UNDER the tile */
  border-radius: calc(var(--tile-c) * .28);
  box-shadow: 0 0 0 2px var(--ring-gap), 0 0 0 4px var(--ring-current), 0 0 16px 4px rgb(242 181 58 / .5); }
:root[data-theme="light"] .tile.is-current::before { box-shadow: 0 0 0 2px var(--ring-gap), 0 0 0 4px var(--ring-current), 0 0 12px 3px rgb(165 106 10 / .35); }
.tile.is-current > img { transform: translateY(var(--tile-lift-current)) scale(var(--tile-scale-current));
  filter: drop-shadow(0 6px 4px rgb(0 0 0 / .35)); }          /* static: the filter is not animated; only transform transitions (180ms) */
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="reduced"]) .tile.is-current::before {
  animation: ring-breathe var(--dur-ring-breathe) ease-in-out infinite; } }
@keyframes ring-breathe { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }
```
- The ring sits **under** the tile as a glowing pad, so the 3D body is never framed or covered. The lift and the larger shadow make it "float".
- Ring tokens and contrast are unchanged from section 9 (gold `#F2B53A` on `#0A1020` is 10.3:1; light `#8A5A00` is 4.7:1).
- Reduced motion: the lift and scale stay (they are a state, not motion) but are applied instantly, and the ring does not breathe.
- The pawn sits above it at `--z-pawn`.

### 13.5 Skyline behind the bottom edge (replaces the placement in 5)
- As in the mockup, the home skyline (the same 10 buildings and 8 windows, `viewBox="0 640 360 160"`, `preserveAspectRatio="xMidYMax slice"`) sits **inside the plate**: `position:absolute; inset-inline:0; inset-block-end:0; block-size: calc(var(--tile-c) * 2.6 + var(--board-pad)); z-index:-1`. The plate's `overflow:hidden` and radius clip it.
- It rises behind the bottom row and about 1.6 cells into the plaza, so the plaza status text (rows 3–4) **never sits on a building**. That is a hard rule, because dark text on the light-theme navy buildings would fail AA.
- Fill `--skyline-board`; windows `--skyline-window` at `.85` in both themes (the light theme now has lit windows, as in the mockup).
- Flicker, perf and reduced-motion rules from section 5 apply unchanged (6 windows, or 4 at 320).

### 13.6 Contact sheet
`docs/v4/design/tile3d-contact-sheet.png` shows:
- all 8 tiles at @2x 1:1 on the dark and the light board;
- full mock boards with this section's CSS at 390 (full), 360 (family, amber expense) and 320 (with the tax-audit tile previewed), in dark and light;
- the current-tile pad on a gold-coloured tile and on the amber tile.

---

## 14. Owner override 2026-10-24b: full-screen board
The owner asked for a board that fills the screen. The loop is still 24 squares in the engine's order (`BOARD` in `src/engine/config.js` is unchanged). Only the layout changes: it is now a **6 × 8 ring**, with a perimeter of 2 × (6 + 8) − 4 = 24.

**What this section supersedes from 13:**
- the 7 × 7 grid, the 13.2 size table and its `--tile-c` formula;
- the fox strip between the plate and the CTA, and the CTA below the board (both move **into the plaza**);
- the HUD heights in 10 and 11 (now a slim bar);
- the tile asset sizes in 13.1 (re-exported larger, see 14.6).

The tile CSS and the current-tile pad (13.3 and 13.4) still apply, except where 14.5 changes them. The skyline rules (13.5) still apply with the new width.

Mocks: `docs/v4/design/board-fullscreen-contact-sheet.png` shows 390x844 dark/full, 390x844 light/full, 360x800 dark/full, 360x800 light/family, 360x640 dark and 320x568 light, at CSS 1:1.

### 14.1 Ring geometry and square order
The order is the same walk as `ringPos` today. It starts at the **top inline-start corner** and runs along the top row toward inline-end, down the far column, back along the bottom row, and up the near column. In RTL, inline-start is the right, so square 0 is at the top-right and the pawn moves leftward along the top. In LTR it mirrors by itself, because the grid columns follow `dir`. Never compute it with `left`/`right`.

```js
/** [col, row], 1-based, on the 6x8 ring (col 1 = inline-start). */
export function ringPos(i) {            // cols = 6, rows = 8
  if (i <= 5)  return [i + 1, 1];       // 0..5   top row       (6 squares)
  if (i <= 12) return [6, i - 4];       // 6..12  far column    (rows 2..8, 7 squares)
  if (i <= 17) return [18 - i, 8];      // 13..17 bottom row    (cols 5..1, 5 squares)
  return [1, 25 - i];                   // 18..23 near column   (rows 7..2, 6 squares)
}
```
- The corners are squares **0, 5, 12 and 17**. Under 7 × 7 they were 0, 6, 12 and 18. Square 0 (payday) stays the start corner.
- **Paint order:** set `z-index: <row>` on every tile, and add 10 for the current tile. DOM index order paints the near column bottom-up, so without this a roof would sit under the tile above it. The pawn keeps `--z-pawn`.
- The plaza is `grid-column: 2 / 6; grid-row: 2 / 8`, i.e. 4 × 6 cells.

### 14.2 Sizing algorithm (JS sets the variables, rounding down; no scroll at any size)
```
W = min(innerWidth, 430); H = visual viewport height (dvh)
safeT = max(env(safe-area-inset-top), 8–10), safeB = max(env(safe-area-inset-bottom), 8–16)
gutter 8 · plate pad 6 · column gap 4 · plate rim 6 (from --plate-shadow)
hud   = (H − safeT − safeB ≥ 700) ? 120 : 96                       // slim bar / compact bar (14.3)
c     = clamp(40, floor((W − 16 − 12 − 20) / 6), 60)                // width-bound tile cell
padTop = 6 + round(0.375 c)                                         // room for the roofs of row 1
avail = H − safeT − hud − 8 − safeB − 6
gv    = (avail − padTop − 6 − 8c) / 7                               // ROW gap only; the column gap stays 4
if gv < 4: c = floor((avail − padTop − 6 − 28) / 8), gv = 4          // height-bound (split screen, landscape)
gv    = min(floor(gv), round(0.5 c))                                 // any leftover goes between the HUD and the plate
plate = (6c + 32) × (padTop + 6 + 8c + 7gv)
```
Why the row gap stretches: a phone is about 0.46 wide-to-tall, and a 6 × 8 ring of square tiles is about 0.72. So the cells are width-bound and there are about 170px of spare height on tall phones. That height goes into the **vertical gaps of the side columns**. The 3D roofs rise 0.375c above each footprint, so a gap of up to 0.5c reads as a 2–6px seam between tiles, as in the mockup, not as a hole (see the 390 mock). The top and bottom rows keep the tight 4px gap.

| | 390x844 | 412x915 | 360x800 | 360x640 | 320x568 |
|---|---|---|---|---|---|
| safe top / bottom used | 10 / 16 | 10 / 16 | 10 / 16 | 8 / 8 | 6 / 8 |
| HUD | 120 | 120 | 120 | **96** compact | **96** compact |
| **Tile cell `--tile-c`** | **57** | **60** | **52** | **52** | **45** |
| Row gap `--tile-gap-v` (column gap 4) | 27 | 30 | 26 | 9 | 7 |
| Plate pad top / sides and bottom | 27 / 6 | 29 / 6 | 26 / 6 | 26 / 6 | 23 / 6 |
| **Plate outer** | **374 × 678** | 392 × 724 | **344 × 630** | 344 × 511 | **302 × 438** |
| Tile image box (1.25c × 1.5c) | 71 × 86 | 75 × 90 | 65 × 78 | 65 × 78 | 56 × 68 |
| **Plaza** (4c + 12) × (6c + 5gv) | **240 × 477** | 252 × 510 | **220 × 442** | 220 × 357 | **192 × 305** |
| Leftover (into the HUD–plate gap) | 6 | 31 | 10 | 3 | 6 |
| Die | 72 | 72 | 72 | 64 | 64 |
| Fox guide | 72 | 72 | 72 | 56 | 56 (shown, no longer hidden) |
| CTA (plaza width) | 240 × 60 | 252 × 60 | 220 × 60 | 220 × 60 | 192 × 56 |
| CTA centre, % of the viewport height | 86% | 86% | 86% | 87% | 83% |

There is no scroll at any of these sizes: in the mocks, `scrollWidth` equals the viewport width and the screen height equals the viewport height. Tiles are 19% (390) to 18% (320) larger than in section 13 (48, 44 and 38 then).

### 14.3 HUD: a slim top bar above the board
It is one smoked card, 8px gutters, radius 18, padding 8 / 10, `--surface` with a 1px `--border` hairline.

| Row | Slim (120) | Compact (96, when H − safe < 700) |
|---|---|---|
| 1 · 48px | Avatar 44 (the profession bust, `professions.md`) · column: "**מורה** · תור 3" 12/500 muted, then a 20px coin and the cash at 26/900 · two 48px icon buttons: statement, menu | the same, cash at 22/900 |
| 2 · goal | "המטרה: חופש כלכלי" 13/600 at the start, "0% מהדרך" 12/800 `--passive` at the end; a 10px bar with ticks at 25/50/75, filling from the inline-start; "הכנסה פסיבית ₪0" at the start and "הוצאות ₪7,310" at the end, 12/500 with the money at 13/900. In family mode "כסף שעובד בשבילכם" replaces "הכנסה פסיבית" | one line, "המטרה: ₪0 מתוך ₪7,310" (`hud.goalShort`) + "0%", and an 8px bar |

- **Moved out of the HUD:**
  - **Flow chip:** the plaza's top-start corner, "תזרים +₪1,490", a 32px ghost pill, 13/700 `--income`.
  - **Legend "?":** the plaza's top-end corner, drawn 40px inside a 48px hit area.
- **Home and settings merge into one menu button,** a sheet with "המשך / בית / הגדרות / צליל / רטט". Two buttons instead of three gives the cash about 60px more at 320. This is a CEO decision (14.7, item 3).
- The 3-second test (10) still holds. Reading order: avatar and cash (heavy) → goal (labelled "המטרה") → board → gold CTA. Gold appears only on the CTA and the current-tile pad.

### 14.4 Plaza (4 × 6 cells): what goes where, top to bottom
The plaza is a flex column, `align-items: center`. It extends into the row gaps above and below it (`margin-block: calc(-1 * var(--tile-gap-v))`), with padding 8 / 4 / `gv + 4`, and gap 6 (4 when compact).
1. **Top row, 48px:** the flow chip (start) and "?" (end).
2. *flex spacer*
3. **Die**, 72 (64 when compact or c < 52), and the result number in its place after a roll (6.2).
4. **Landing caption** pill "נחתתם על: הזדמנות": 36px, 17/700 (16 when c < 48), 22px monoline icon, max width = plaza − 16.
5. **Status** "התור שלכם: הטילו קובייה", 16/700 (15 compact), 2 lines reserved; then "אתם על: …" 13/500 muted (dropped when compact; merged into the status).
6. *flex spacer*. The two spacers keep the die cluster in the optical centre at every height.
7. **Fox corner guide:**
   - The fox sits at the inline-start (right in RTL), 72px (56 compact), feet on the CTA's top edge **without overlapping its hit area**.
   - The smoked-glass bubble fills the rest of the row toward inline-end: 13/500, 3 lines max (2 compact), with "עוד" opening the full note.
   - The 7.3 auto-close and 7.4 "never hide essential info" rules hold: the bubble never covers the status, the die or the CTA.
8. **CTA** "הטילו קובייה": the full plaza width, 60px (56 when c < 50), solid gold, die glyph 24. It sits 4px above the bottom row, inside the bottom 14–17% of the screen, so it is in the thumb zone at every size, and it does not move between turns.
- **Skyline:** the 13.5 rules apply, with `block-size: calc(var(--tile-c) * 2.6 + var(--board-pad))` and `--sky-w: calc(6 * var(--tile-c) + 5 * 4px + 2 * var(--board-pad))`. It rises behind the bottom row, the CTA and the lower part of the fox. The hard rule holds: **no unfilled text on a building**. Items 1–5 sit above it, the bubble and the CTA are filled surfaces, and the fox standing on the rooftops is intended.

### 14.5 CSS deltas (to 13.3)
```css
.screen-board { display: flex; flex-direction: column; gap: 8px; block-size: 100dvh; overflow: hidden;
  padding: max(10px, env(safe-area-inset-top)) 8px max(16px, env(safe-area-inset-bottom)); }
.screen-board .board {
  grid-template-columns: repeat(6, var(--tile-c)); grid-template-rows: repeat(8, var(--tile-c));
  column-gap: 4px; row-gap: var(--tile-gap-v);                     /* set by JS (14.2) */
  padding: calc(var(--board-pad) + round(down, var(--tile-c) * .375, 1px)) var(--board-pad) var(--board-pad);
  margin-block-start: auto;                                       /* the leftover goes above the plate; the CTA stays put */ }
.board-center { grid-column: 2 / 6; grid-row: 2 / 8; margin-block: calc(-1 * var(--tile-gap-v));
  padding: 8px 4px calc(var(--tile-gap-v) + 4px); }
.tile { z-index: var(--row); }  .tile.is-current { z-index: calc(var(--row) + 10); }
```
- `.fox-strip` and `.board-actions` below the plate go away. Their content moves into `.board-center` (14.4). Keep the `data-compact` logic, keyed to `hud === 96`.
- Tile `<img>` attributes become `width="75" height="90"` (the new @1x). The CSS still sizes the image from the cell.

### 14.6 Tile assets re-exported for the bigger cell
- `extract-tile3d.py` `SIZES` went from `{60, 120}` to **`{'': 75, '@2x': 150}`**: canvas 75 × 90 and 150 × 180. That serves cells up to 60px, so c is clamped at 60.
- The @2x footprint is 120px and the source footprints measure 155–166px, so it is **still a downscale**. Nothing is upscaled.
- The same 8 tiles and 16 files are in `src/assets/tile3d/`, with the same names. The set totals **55.7 KB** (was 43.4).
- A 2x phone fetches the 6 tile types of one mode at about 28 KB; a 1x device about 14 KB.
- Preload is unchanged (`opportunity@2x`, `payday@2x`).

### 14.7 For the CEO / developer
1. `ringPos` and its unit test change. Corner indices move from 0/6/12/18 to 0/5/12/17. Check any test that pins a corner or a `[col,row]`.
2. The 13.2 test of "fox hidden at 320 and 360x640" flips: the fox is now **shown** at 56px.
3. The menu button merges home and settings (14.3). If the CEO prefers three buttons, the cash at 320 drops to 20/900 and the turn label truncates first.
4. Pinch and zoom stay off the board. Landscape or split screen uses the height-bound branch; below c = 40 the plate scales with a `transform: scale()` wrapper (as in 13.2), never with scrolling.
