# Passivo v3.1 — Design spec ("Navy & Gold, quiet edition")
Phase 1 (design only). The developer implements in Phase 2 from this file + `src/styles/tokens.css` + the SVGs. Reference screen size **390x844**; each screen also lists **360x800** and **320x568** behaviour. RTL first (logical properties only). Fox art, wordmark, tile colours, tile icons and the app icon are unchanged.

Companion files: `docs/v3/design/category-map.md` (category registry + card mapping), `docs/v3/design/checklist.md` (screenshot self-review), `docs/v3/design/contrast-v3.py` (AA audit of every new pair, 113 pairs, all pass), `docs/v3/design/icons-contact-sheet.png` (all new icons rendered in Chromium).

## 0. The ten rules (everything below follows from these)
1. **One accent per screen.** Gold `#F2B53A` is reserved for the single primary action. Nothing else on that screen is a filled gold surface (no gold daily card next to a gold CTA, no gold glow on selected cards, no gold cash number).
2. **Ladder:** primary = solid gold; secondary = hairline-outline ghost; tertiary = text button. A screen never has two primaries. Choices that are not "the next step" (the guess buttons) are two equal ghosts.
3. **Flat.** No gradient on any button or card (tokens redefined as solids). Background gets at most a 4-8% tonal shift (`--grad-night`).
4. **Opaque.** Every modal surface (card, dialog, sheet) is a fully opaque colour; the scrim behind it is 88%.
5. **Verdict = ribbon, not background.** 3px top-edge ribbon + a text pill with icon.
6. **Two numbers per deal card** (down payment, monthly cash flow) are large and central; everything else is quiet.
7. **Money is typeset by one component** (tabular, separators, isolated, negatives muted red, family = amber).
8. **Category** = icon + colour from one registry; never on board tiles.
9. **Fox where it teaches or celebrates** (home, guide, feedback/tips, win, game over), not as decoration on modals.
10. **AA everywhere**, visible focus rings, `prefers-reduced-motion`, targets >= 48px.

## 1. Hierarchy ladder, by screen (the one primary)
| Screen / state | The ONE primary (gold) | Secondary (ghost) | Tertiary (text) |
|---|---|---|---|
| Home | התחילו משחק | daily challenge card (ghost row), mode cards (selection state, white ring) | settings/help/learn icons |
| Mode + profession pick | none on the grid (cards are choices); sheet: **יוצאים לדרך** | — | הצגת הפירוט toggle |
| Board, idle | **הטילו קובייה** | — | menu icons |
| Board, rolling/resolving | the roll button is truly `disabled` (50%) | — | — |
| Deal card, guess prompt | **none**: two equal ghosts "עסקה טובה" / "לא כדאי" | — | הראו לי את המספרים |
| Deal card, revealed / no-guess | **קנו** | דלגו | the term links |
| Deal card, needs a loan | **קנו** (opens the loan dialog) | דלגו | — |
| Deal card, cannot afford even with loan | **קנו** `disabled` 50% (+ the banner says why) | **דלגו** (it is now the only live action; stays ghost) | — |
| Expense / baby / charity / market | the "do it" action (שלמו / המשיכו / תרמו / מכרו) | the alternative (בפעם אחרת / לא תודה) | — |
| Loan dialog | **קחו הלוואה** (or קחו בכל זאת, still gold) | ביטול | פרטים נוספים |
| Income statement sheet | none (read-only); close is an icon button | — | — |
| Payday summary / hand-over | **המשיכו** (arms 700ms) | — | חזרה לתפריט (text, arms too) |
| Win | **שחקו שוב** | מה למדתי, שנו מצב או מקצוע | שתפו את התוצאה |
| Game over | **ננסה שוב** | מה למדתי | חזרה לתפריט |

## 2. Tokens (values live in `src/styles/tokens.css`; token NAMES kept)
### 2.1 Old → new
| Token | Old (v3.0) | New (v3.1) | Why |
|---|---|---|---|
| `--c-navy-900` / `--bg` | `#0F1E46` | `#0F172A` | quiet deep navy (owner) |
| `--c-navy-950` / `--surface-sunken` / `--skyline` | `#091330` / `#0A1533` | `#0A1020` | same family |
| `--c-navy-800` / `--surface` | `#16295E` | `#182238` | surfaces desaturated |
| `--c-navy-700` / `--surface-2` | `#1D3573` | `#212D48` | idem |
| `--c-navy-500` | `#4A5C94` | `#4A5878` | idem |
| `--c-navy-300` / `--border-strong` | `#8696C8` | `#8A97B8` | 6.1:1 on bg |
| `--c-ice-100` / `--text-muted` | `#C4D0F0` | `#A9B5D0` | quieter, still 6.7:1 on surface-2 |
| `--text` | `#FFFFFF` | `#F5F7FC` | less glare |
| `--border` | `rgb(255 255 255 / .22)` | `/ .14` | hairlines |
| `--glass-bg` / `-border` / `-chip` | `.10` / `.20` / `.12` | `.05` / `.12` / `.07` | quiet panels |
| `--glass-bg-strong` | `rgb(8 16 40 / .55)` | `rgb(8 14 30 / .72)` | |
| `--scrim` | `rgb(5 10 28 / .74)` | `rgb(4 8 20 / .88)` | board no longer reads through |
| `--outline` | `#060E24` | `#050A16` | |
| `--grad-night/-sky/-sunburst` | 3-4 stop blue/orange gradients (sunburst ended in `#E8702A`) | subtle navy shifts (<= 8% L change) | win screen is no longer orange |
| `--grad-card-modal`, `--grad-felt` | gradients | solid, written `linear-gradient(X, X)` | keep `background-image` users working |
| `--glow-fox` | gold `.30` | gold `.16` | quieter halo |
| `--title-grad` / `--title-shadow` | gold 3-stop + hard drop | gold 2-stop `#FFD479 > #F2B53A` + 2px navy drop | only the home wordmark / story title use it |
| `--cash-color` | `#F6C453` (gold) | `var(--text)` | gold = accent only |
| `--meter-track` | `rgb(0 0 0 / .38)` | `rgb(255 255 255 / .10)` | |
| `--expense` (= negative, dark) | `#FF9C8C` | `#E57373` | muted red (owner). 6.0:1 bg, 5.3 surface, 4.6 surface-2. **Never on cream** |
| `--expense-ink` (on cream/white) | `#B3261E` | `#B42318` | 6.1:1 on cream |
| `--passive-fill` | teal > gold gradient | solid teal `#35D6B0` (light `#087F66`) | gold stays the accent |
| `--btn-primary-bg` | 3-stop gold gradient | `#F2B53A` | flat |
| `--btn-primary-edge`, `--btn-buy-edge`, `--btn-danger-edge`, `--edge-depth` | gold-700 / green / red edges, 6px | `transparent`, `0px` | flat |
| `--btn-buy-bg` / `-text` | mint gradient / `#032A1A` | `#F2B53A` / `#2A1700` | Buy IS the primary action |
| `--btn-secondary-bg` / `-border` | glass / `rgb(255 255 255 / .4)` | `transparent` / `#7C89AB` | ghost, 5.1:1 on bg |
| `--btn-danger-bg` / `-text` | coral gradient / `#2E0502` | `#E57373` / `#2E0502` (light: `#B42318` / `#FFF`) | rare, destructive confirm only |
| `--btn-disabled-*` | `#2A3A6B` / `#B4C0E4` | `#263250` / `#8E9AB8` + `--btn-disabled-opacity: .5` | |
| `--shadow-1/-2` | hard `0 4px 0` edge + blur | soft two-layer blur, no hard edge | |
| `--shadow-3` | `0 0 0 4px gold ring + glow` | `0 0 0 1px --card-ring, 0 24px 56px` | cards/dialogs get a hairline, not a gold ring |
| `--shadow-glow-gold` | gold ring + 28px glow | `0 0 0 2px gold` (no glow) | active-turn ring only |
| `--card-ring` | `#F2B53A` | `rgb(255 255 255 / .18)` (light: navy `.16`) | |
| `--sq-icon-dark`, `--pl-ink` | `#0F1E46` | `#0F172A` | contrast on tiles rose (5.1 to 9.7:1) |
| Light theme gradients, `--title-grad`, `--cash-color`, `--text` (`#0F172A`), `--scrim`, shadows | gold/amber gradients | flat paper `#FBF3E1`, navy ink | light is secondary: same structure, flat |
Unchanged: `--c-gold-*`, `--c-fox-*`, tile colours `--sq-*`, `--income` `#5FE0AE`, `--passive` `#35D6B0`, `--liability`, `--card-bg` `#FFF6E3`, `--card-text`, `--card-muted` `#46527E`, type scale, spacing, radii, motion tokens.

### 2.2 New tokens
`--accent`, `--accent-pressed` (#E3A020), `--btn-text-color`, `--btn-disabled-opacity`, `--btn-arming-bar`, `--sel-ring` (selected = white ring, light theme navy), `--card-highlight`, `--card-shadow`, `--card-btn-border`, `--card-warn-bg/-border/-text`, `--warn-bg/-border` (warning banner on dark surfaces), `--focus-ring-card`, `--verdict-{green,yellow,red,neutral}` + `-ink` + `-tint`, `--cat-<id>` + `--cat-<id>-ink` (x9), `--prof-icon`, `--prof-chip-bg`, `--negative` + `--negative-ink` (aliases of `--expense` / `--expense-ink`; family overrides both to amber).
Family mode (`[data-learn="family"]`): `--expense/--negative` `#FFD27A` (light `#6E4200`), `--verdict-red` becomes the deep amber `#D98A1C` with ink `#6E4200` on tint `#FFEBC2`, warning banners become amber. **No red anywhere in family mode**, including the ribbon, pills, banners and the loan warning.

### 2.3 Usage rules
- `--accent` may only fill: the primary button, the active-turn ring on the board, and the tiny coin glyph next to cash. It may be used as text colour for nothing except `--asset` labels (income statement section title "נכסים" keeps `--asset`).
- Selected state (mode card, profession card pressed, chips) = 2px `--sel-ring` (white) + `--surface-2` fill + check icon. Never gold.
- Hairline = `1px solid var(--border)`; component outline = `1.5px` of `--btn-secondary-border` (inset box-shadow, so layout does not shift).
- Radii: buttons pill; cards 24px (`--r-lg` 22 acceptable); dialogs/sheets 28px (`--r-xl`); chips 14px; avatar circles 50%.
- Cream is for the card only. The dark theme keeps cream cards (flat `#FFF6E3`, ink `#0F172A`) because cream-on-navy gives the strongest reading surface for the two key numbers; the light theme keeps the same cream card with a 1px navy hairline so it separates from the paper.
- Focus: `:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px }` everywhere; **inside `.card`** use `--focus-ring-card` (navy), because gold-300 on cream is 1.5:1.

## 3. Components
### 3.1 Button (`.btn`)
| Variant | Fill | Text | Border | Sizes |
|---|---|---|---|---|
| primary | `--btn-primary-bg` flat | `--btn-primary-text` 800 | none | lg 64 (full width in the thumb zone), md 56 (cards/dialogs), sm 48 |
| secondary (ghost) | transparent | `--btn-secondary-text` 700 | inset 1.5px `--btn-secondary-border` (on cream: `--card-btn-border`, text `--card-text`) | md 56, sm 48 |
| text (tertiary) | transparent | `--btn-text-color` 700 16px | none | min-height 48, padding-inline 16, never full width |
| danger | `--btn-danger-bg` flat | `--btn-danger-text` | none | rare (reset progress). Never next to a gold primary: the destructive confirm dialog has danger + ghost cancel and NO gold |
Common: `border-radius: var(--r-pill)`; no `box-shadow` except the secondary outline; **no** drop shadow, inset highlight or `margin-block-end: var(--edge-depth)` (it is 0 now, remove the rule). Pressed: primary fills `--accent-pressed` + `transform: scale(.98)` (120ms ease-out); secondary fills `rgb(255 255 255 / .08)` (light theme `rgb(15 23 42 / .06)`); text button `rgb(255 255 255 / .06)`. Label 1-2 words, `white-space: nowrap`. Min width 48, `touch-action: manipulation`.

States (all variants):
| State | Look | DOM |
|---|---|---|
| default | as above | — |
| hover (mouse only, `@media (hover:hover)`) | primary `#F6BE52`; ghost bg `.05` | — |
| pressed | see above | — |
| focus-visible | 3px ring, offset 2px | — |
| **disabled** (truly) | same variant look at `opacity: var(--btn-disabled-opacity)` (.5), `cursor: not-allowed`, no press, no hover, no shadow | real `disabled` attribute, **no** `aria-disabled`, no `tabindex`; not focusable, not announced as an action. The reason is visible text next to it (banner / caption), linked by position, not by focus |
| **arming** (hand-over, payday summary, first 700ms) | NOT dimmed: full-opacity ghost-of-the-primary: transparent fill, 1.5px `--accent` outline, label `--c-gold-300`, a 4px bar at the bottom edge filling from inline-start to inline-end over `--arm-ms` in `--btn-arming-bar` | real `disabled` attribute + `aria-busy="true"` + `data-arming`; JS removes both at the end and the button snaps to the solid primary look (no animation, 1 frame). Tertiary text buttons arm with the same bar under the text (no outline) |
| armed / ready | solid primary | — |
| loading (rolling) | like disabled, label "הקובייה מתגלגלת…" | `disabled` + `aria-busy` |
Distinctness test: a screenshot at t=200ms of an arming primary must read as "outlined gold with a moving bar", a disabled one as "pale gold, no bar". Reduced motion: the bar is static at 50% for the arming window (existing behaviour), nothing else changes.
Because `disabled` removes focus, the **developer must move focus** deliberately: after arming ends, re-focus the button (`data-autofocus`) so keyboard/screen-reader users land on it. The old `is-blocked` (aria-disabled, focusable, dashed border) is retired (see section 9 conflicts).

### 3.2 Deal card (`.card`, "bank card"), anatomy at 390x844
Modal width 358px (16px layer padding), `max-block-size: calc(100dvh - 40px)` (= 804), radius 24px, `background: var(--card-bg)` opaque, `border: 1px solid var(--card-border)`, `box-shadow: inset 0 1px 0 var(--card-highlight), var(--card-shadow)` (the 1px top highlight). `overflow: hidden`. No banner art, no gradient, no fox.
```
 ┌──────────────────────────────┐  top edge: 3px RIBBON (full width, clipped by the radius)
 │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  neutral before the reveal, verdict colour after
 │ (●) קפה · הזדמנות            │  header row 40px: category chip + label + "הזדמנות" muted
 │ עגלת קפה ברכבת               │  title 24/800, max 2 lines
 │ נוסעים עם עיניים חצי פקוחות… │  text 15/400 --card-muted, max 3 lines then scroll
 │ ┌───────────┬──────────────┐ │  KEY NUMBERS (white tile, 1px --card-border, radius 16, padding 16)
 │ │ מקדמה     │ תזרים חודשי   │ │  labels 13/500 muted
 │ │ ₪200,000  │ +₪3,400      │ │  values 32/800 tabular; hairline divider between
 │ │           │ בחודש        │ │  caption 12 muted
 │ └───────────┴──────────────┘ │
 │ [✓ החזר מהיר] ירוק! הנכס…    │  verdict pill + one sentence (15/500)        (after reveal)
 │ תשואה 27%   החזר 3.7 שנים    │  quiet metrics: label 12 muted / value 20/700, no boxes
 │ מה הצבע אומר: …  (12 muted)  │  legend, real-world note, investor-eye chip: all quiet
 │ ▾  (fade + chevron hint)     │  only while more content below
 ├──────────────────────────────┤  footer (outside the scroller, always visible)
 │ ⚠ banner (max 2 lines, 52px) │  only when needed
 │ [   קנו (gold, 56)   ][דלגו] │  actions
 └──────────────────────────────┘
```
- **Ribbon**: `::before { position:absolute; inset: 0 0 auto 0; block-size: 3px; background: var(--ribbon, var(--verdict-neutral)) }`. Colours: green `--verdict-green`, yellow `--verdict-yellow`, red `--verdict-red`, before reveal / no guess flow `--verdict-neutral`. Other card types use their tile colour as ribbon: expense `--sq-expense` (family: `--verdict-red` amber), market `--sq-market`, baby `--sq-baby`, charity `--sq-charity`, payday `--sq-payday`. Change of ribbon colour on reveal: `transition: background-color 150ms` only (none under reduced motion). The ribbon never carries meaning alone: the pill below does.
- **Verdict pill** (`.verdict`): `display:inline-flex; gap:8px; padding:6px 12px; border-radius:14px; font:700 15px`; bg `--verdict-X-tint`, text `--verdict-X-ink`, 20px icon: green `check`, yellow `minus`, red `close` (full mode) / `src/assets/verdict/hourglass.svg` (family, label "החזר איטי או אין החזר"). Replaces the old traffic-light lamps + tinted tiles (the three lamps are removed: they were a second verdict display).
- **Key numbers**: always the pair (down payment `downPayment`, monthly cash flow `monthlyCashFlow`). Stocks: (price per share x qty is chosen in the stepper, so key numbers = "עלות" total and "דיבידנד חודשי"). Values are `money()` components, size XL (32px; fit-text down to 24px at 320). Cash flow colour: positive `--income-ink`, negative `--negative-ink`. Both labels are term buttons only in the quiet area; in the key tiles they are plain text (a dashed underline on the key label was visual noise).
- **Quiet info**: 12-15px, `--card-muted`; yields/payback are 2 inline metrics, not two boxed tiles (the green tinted `stat-income` boxes are removed). The traffic-light "מה הצבע אומר" legend stays but at 12px.
- **Guess prompt (before reveal)**: replaces the quiet block: title "עסקה טובה?" 20/800, one-line subtitle, then (in the footer) two **equal ghost** buttons side by side, each 56px with a neutral icon (check / close, `--card-text`), plus the tertiary text button "הראו לי את המספרים" above them. No red/green, no gold. The key numbers are NOT shown until the player answers or taps show (existing behaviour).
- **Entrance**: `opacity 0 → 1` + `translateY(12px → 0)`, **180ms** `--ease-out`, on the card only. The 3D flip (400ms+) and the fox corner pop (+150ms) are removed. Exit: opacity 120ms. Reduced motion: opacity 120ms, no translate.
- **Long card scroll affordance** (fixes 06b/06c): the scroller is `.card-body`. While `scrollTop + clientHeight < scrollHeight - 4` set `data-more="true"` on `.card` (scroll + ResizeObserver, passive listener). Then: (a) `mask-image: linear-gradient(to bottom, #000 calc(100% - 36px), transparent)` on `.card-body` (a functional mask, not a painted gradient); (b) a 28x28 chevron-down (`--card-muted`, 2px stroke, in a 48x48 non-interactive `pointer-events:none` hit area) centred at `inset-block-end: 8px` of the scroller, static (no bounce). At the end of the scroll, `data-more` is removed: mask and chevron fade out in 150ms. Tapping the chevron is not required (it is a hint; `aria-hidden`). Do not rely on the old `background-attachment: local` gradients (delete them: they are painted gradients and were invisible in practice).
- **Footer budget**: banner + actions <= 148px at 844 tall (banner 52 + gap 8 + actions 56 + padding 16 + safe-area), so the scroller always keeps >= 220px at 640 tall.
- **Opacity audit**: `.card`, `.card-body`, `.card-foot`, `.card-actions` all use `background-color: var(--card-bg)` (alpha 1); no `rgb(... / a)` backgrounds, no `backdrop-filter`, no `opacity < 1` on the card during rest. QA check: `getComputedStyle(card).backgroundColor` has no alpha. Charity card first (owner report): its text and numbers were readable through the card region in the Phase 0 screenshot because the scrim was 74% and `.layer-summary .scrim` is 30%: the **summary sheet** keeps its light scrim on purpose (the board and the payday float stay visible), every **card/dialog** layer uses the 88% scrim.

Card types with the same shell: expense (ribbon `--sq-expense`, header chip = expense tile icon 24px in ink, key numbers = amount + cash left), market (sky), baby (pink), charity (violet), loan-needed variants. Same footer rules; one gold primary.

States of the deal card (each must be screenshotted, see checklist): green / yellow / red reveal (full), green / yellow / slow (family: amber ribbon, hourglass pill), guess prompt, no-guess (tutorial/first game with hint), needs-loan (banner + primary opens the dialog), blocked (banner + primary disabled), stock card (no verdict: neutral ribbon, stock note), long text scrolled top/bottom.

### 3.3 Category chip and profession avatar
- Category chip: see `category-map.md` (40px on cards, 32px in lists, glyph 24 / 20, icon `stroke-width` stays 2 at any size).
- **Profession avatar** (one treatment for all eight): circle `--prof-chip-bg` (`--surface-2`), `1px solid var(--border)`, glyph `src/assets/profession/<id>.svg` in `--prof-icon` (`--text`), glyph = 50% of the circle (56px circle / 28px glyph in the grid; 64px / 32px in the preview sheet; 40px / 20px in the HUD). No letters, no per-profession hue (the orange letter discs are removed). Active state (preview sheet open on this profession): ring 2px `--sel-ring`. Mapping: teacher=teacher, engineer=engineer, driver (נהג/ת מונית)=driver, nurse=nurse, programmer=programmer, police=police, cook=cook, lawyer=lawyer (ids as in `professions.he.json`).

### 3.4 Money component (the one shared formatter) — see section 6.

### 3.5 Banner (warning/info in dialogs and sheets)
Dark surfaces: `background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--text)`, icon 20px `--negative` (family: amber via the same token), radius 14, padding 10/12, text 14/500. On cream cards: `--card-warn-bg/-border/-text`. Info banners (the "המטרה" star strip): no fill, 1px hairline, star glyph `--text-muted` (no navy block, no gold star).

### 3.6 Meter (passive income bar)
Track `--meter-track`, fill solid `--passive-fill` (teal), 12px high, ticks at 25/50/75% `rgb(255 255 255 / .35)`; the star end-cap becomes a 16px `--text-muted` outline star (no gold). Fills from inline-start (RTL: right). Milestone pulse unchanged (opacity pulse, not a gold glow).

## 4. Screens (390x844 reference)
Common: page padding 16px (20px at >= 412), safe-area insets respected, thumb zone = bottom 240px holds the primary. All screens set `lang="he" dir="rtl"`.

### 4.1 Start (home)
- Order top to bottom: 3 icon buttons (48px circles, ghost: hairline, `--text-muted` glyph) at inline-start; wordmark (gold, unchanged art) + PASSIVO + tagline `--text-muted`; fox `tired` (296px) with the cream joke bubble at inline-end/top 300 (as in `fox-usage.md`); **mode selector**; **daily-challenge row**; **primary CTA**.
- Mode selector: two cards (171x72), ghost: `--surface` fill, 1px `--border`; selected = `--surface-2` fill + 2px `--sel-ring` + 24px white check disc (navy tick); no gold border, no glow, no scale(1.02). Title 17/800, description 13 `--text-muted`.
- **Daily row (fix competing gold)**: ghost row 64px, `--surface` fill, 1px `--border`, no gold border; leading 40px chip `--surface-2` with a `--text` star outline (done state: `--income` check); title 15/700 "אתגר יומי" + date as a quiet `--text-muted` 13px line; trailing chevron (mirrored). It is a secondary action.
- CTA: gold primary 64px full width, bottom 28px / safe-area. This is the only gold fill on the screen besides the wordmark (brand art, not an action).
- 360x800: fox 260px, joke bubble 104px wide. 320x568: fox 168px, tagline hidden, mode cards 56px high, daily row 52px (as today), CTA 56px. Entrance: as `fox-usage.md` (400ms rise); nothing new.
- Copy tone: warm, one line each. Bubble jokes unchanged.

### 4.2 Mode pick + profession pick
- Header: back icon button (ghost 48px), title "בחרו מקצוע" 26/800, subtitle 14 muted (<= 2 lines).
- Grid 2 columns, gap 12, card 171px wide. **Card content (new, top to bottom)**, `--surface` fill, 1px `--border`, radius 20, padding 12, align centre, min-height 164:
  1. avatar 56px (section 3.3)
  2. name 16/700
  3. salary row: label "שכר" 12 muted + `money` 18/700 `--text`
  4. 1px hairline
  5. row "הוצאות" 12 muted + `money` 14/500 `--text-muted`
  6. row "נשאר" 12 muted + `money` 14/700 with sign, `--income` if >= 0 else `--negative` (family: `--expense` amber, per token)
  Values come from `statement(engine.newGame({mode, professionId, seed:1}))` (`totalExpenses` and `monthlyCashFlow`, i.e. the same numbers as the preview sheet, loans included). Compute once per profession at screen creation. Example teacher: 8,800 / 7,310 / +1,490.
- Grid height at 390x844: header 100 + 4 x 164 + 3 x 12 = 792 → fits; at 360x800 and below the screen scrolls (header stays; grid scrolls; the last row never sits under the system bar: `padding-block-end: max(16px, safe-area)`). 320: cards 144px wide, name may wrap to 2 lines (min-height 164 holds), money values fit-text.
- Tap: card fills `--surface-2` 120ms, the preview sheet opens (existing). No pop-in delay animation per card (`animation-delay: i*40ms` stays but is 4px rise, 180ms; reduced motion none).
- **Preview sheet** (bottom sheet, opaque `--surface`, 28px top radius): handle, avatar 64px + name 24/800 + "₪X לחודש" muted, income section, expenses (toggle "הצגת הפירוט" is a tertiary text row, not a filled bar), debts, starting cash flow row (total style), goal strip (info banner, quiet), pinned primary **יוצאים לדרך** 64px. **No fox crop** on the sheet (the `ponder`/`think` pop is removed).
- Starting-cash-flow row uses `money` with sign; positive `--income`.

### 4.3 Board
- HUD (top, 156px): row 1: three 48px ghost icon buttons (inline-start), player name + turn (inline-end) with the 40px profession avatar; row 2: **cash** `money` XL 36/800 in `--text` (not gold) with a 24px coin glyph; the monthly-flow chip becomes a ghost chip (`--surface-2`, 1px `--border`, text 14/700, amount `--income`/`--negative`); row 3: passive vs expenses labels + meter (3.6). No gold fill in the HUD.
- Board: unchanged geometry (24 tiles, plaza). Tiles keep the six colours and navy ink glyphs; **the OPPORTUNITY tile keeps the neutral house glyph** (no category on tiles). The active tile ring is the one allowed gold ring (`--shadow-glow-gold`, 2px). Skyline darkens to `--skyline`.
- Plaza: die (unchanged), status line 16/700 `--text`.
- Roll zone: fox `roll` pose (unchanged slot) + status chip (ghost) + **primary "הטילו קובייה" 64px gold full width**. While rolling/resolving the button is `disabled` (50%).
- Fox reaction circles on the board strip are retired as separate pops: their information lives in the fox feedback note (which already replaces them). The note's circle stays (52px, `--prof`-neutral gold-300 ring is dropped: use a 2px `--border` ring). This keeps "fox = feedback/tips".
- 360x800: board 336px, fox roll 128px. 320x568: board 264px, HUD row 3 collapses into row 2 (meter only), roll 56px.

### 4.4 Card modals
See 3.2. Header art removed: `card-head`, `card-banner`, `card-chip` (navy "הזדמנות · עסק" pill on gold) and `cornerPop(CARD_REACTION…)` are deleted from `cardShell`; the chip row replaces them. Opportunity deals show the category chip; other card types show a 40px chip with the tile glyph (`square-*` icons through `icons.js`) in `--sq-*`-ink on a 12% tint.
Copy tone: short, friendly, plural-neutral imperative; titles are the card titles. Buttons: קנו / דלגו / שלמו / תרמו / בפעם אחרת / המשיכו.
Haptics: tap = 10ms on any button; buy = [15,40,15]; error/blocked-tap n/a now (disabled cannot be tapped); guess result: correct 20ms, wrong 40ms. Toggleable (existing).
360x800: same, card 328px wide, key numbers 28px. 320x568: title 20px, key numbers 24px, text clamp 2 lines, footer <= 132px, the scroll hint is essential here.

### 4.5 Loan dialog (Phase 2 spec; replaces the dense list)
Dialog (opaque `--surface`, radius 28, padding 20, 358px wide), **no fox crop**, close = 48px ghost icon button.
```
 צריך הלוואה?                                  [X]
 חסרים לכם ₪63,000.          (14/400 muted, 1-2 lines, amount = money node)
 ───────────────────────────────────────────
  (−)         ₪63,000          (+)           stepper: 56px ghost circles, amount 40/800 --text
              בכפולות של ₪1,000              13 muted
 ┌──────────────┬──────────────┬─────────────┐   THREE NUMBERS, equal columns, 1px dividers, no boxes
 │ תשלום חודשי  │ ריבית שנתית  │ עלות ב-12 חודשים │  labels 12/500 muted (<= 2 lines)
 │ ₪630         │ 12%          │ ₪7,560       │  values 20/800 (the cost: `--negative`)
 └──────────────┴──────────────┴─────────────┘
 אחרי ההלוואה: תזרים חודשי  +₪2,260           2 rows 15/500 (label muted, value --text/--income/--negative)
 בסיכום הבא                +₪54,240
 [⚠ banner if risky: amber in family, muted red in full]
 ⌄ פרטים נוספים                                tertiary text toggle (aria-expanded) → limit bar, cap note, real-world, term links
 [ ביטול (ghost, 104) ][   קחו הלוואה (gold, flex)   ]
```
Rules: the three numbers are the only 20px items; everything else <= 15px. "Cost over 12 months" = monthly payment x 12 (interest only; principal still owed): the developer asks the engine for it (`loanTerms(amount).perYear` or monthly x 12; the old screen showed 24 months) and the label says that the principal remains. The risky state keeps the gold primary and changes the label to "קחו בכל זאת" (the red `btn-danger` toggle is removed). The limit bar's gradient (yellow > red) becomes a solid `--text-muted` fill that turns `--negative` at >= 90% used. Height budget: 360x800 ≈ 470px; 320x568 ≈ 500px with "פרטים נוספים" closed (dialog scrolls inside if taller). Stepper `±` also respond to long-press repeat (existing).
Haptic: stepper tick 8ms; take loan [20,30,20].

### 4.6 Income statement (bottom sheet, 90dvh)
Sheet opaque `--surface`; handle (48px target), title "דוח חודשי" 22/800 + close ghost icon.
Order: (1) hero: monthly cash flow XL (`--income` / `--negative`) + cash + meter + 2-year equation stacked per 4.9 (no one-liner); (2) **net-worth panel (new, Phase 2)**; (3) income rows; (4) expense rows; (5) assets (category chips); (6) liabilities; (7) balance-sheet detail (the long "שווי נקי" list moves here; kept as is, flat).
**Net-worth panel**: `--surface-2` fill, 1px `--border`, radius 16, padding 16.
```
 שווי נקי  ⓘ                            +₪12,400 מאז הסיכום הקודם   (chip 12/700, --income / --negative; hidden at turn 1)
 ₪218,200                               money XXL 32/800 --text
 [████████████░░░░░░░]                  8px bar: assets segment `--income-fill`, liabilities `--liability-fill`, proportional; radius 4; fills from inline-start
 נכסים ₪1,541,200   ·   התחייבויות ₪1,323,000     two 13px columns, values 15/700 (assets --income, liabilities --liability)
```
Net worth = `balanceSheet().netWorth` (already computed for the sheet). Family mode: hide the liabilities column? No: keep, with the word "חובות", no red. The panel is tappable? No (the detail is below; label links to the glossary term only).
Rows: 48px min height, label 15 `--text`, value `money` 16/700 right-aligned (inline-end), hairline dividers. Asset rows: 32px category chip + title + `money` cash flow; subline (mortgage) is a quiet 12px `--text-muted` line built with `money()` nodes (see 6.3).
Section titles: 13/700 in `--text-muted` (headings are never coloured: the negative colour is for amounts only); the small 8px dot before the heading carries the semantic colour (income mint, expense muted red, asset gold outline, liability lavender). Family mode: expense dot amber.
360x800 / 320x568: rows stay 48px; hero equation hides the middle line at <= 640 tall (4.9).

### 4.7 Win
Quiet navy (`--grad-sunburst`, the rays/orange are removed), gold halo `--glow-fox` behind the `hammock` fox (unchanged art, positions as in `fox-usage.md`), confetti stays (6 colours, 2800ms; none under reduced motion). Title "חופש כלכלי!" in `--title-grad` (the single gold-text moment; it is the celebration). Stats card: opaque `--surface`, 1px `--border`, radius 22; passive income XL `--income`; expenses `--text-muted`; mini meter full; three stat tiles (turns, assets, kids) as plain figures with hairline separators (no boxed glass tiles). Actions: **שחקו שוב** (gold 64), two ghost buttons side by side (מה למדתי / שנו מצב או מקצוע), tertiary text "שתפו את התוצאה". Haptic: success pattern [20,40,20,40,60] once.
320x568: fox 180px, stat tiles 2 columns hidden except turns.

### 4.8 Game over
Muted version of the same layout: `--grad-night`, `tired` fox (height 200, slow sway), title "הפעם לא יצא" 32/800 `--text` (not gold), supportive line ("גם לשועלים יש ימים כאלה. ננסה שוב?"), stats card as in Win but passive/expenses in `--text`. Primary **ננסה שוב**; ghost **מה למדתי**; text **חזרה לתפריט**. No `celebrate`, no confetti, no red anywhere (the negative flow shows `--negative` only on the amount; family amber).

### 4.9 Payday: summary sheet, chip, float (Phase 2)
**Summary sheet** (cream card style bottom sheet, existing structure): rows salary / passive / expenses (`money`, expenses with sign `−`), divider, result "נשארו בחודש +₪4,540" (stacked, no wrap issues), the stacked equation, the new cash line. Primary **המשיכו** with the arming state (3.1). The sheet keeps its 30% scrim so the board stays visible.
**Stacked equation (replaces the one-liner "נשארו ₪4,540 בחודש × 24 = +₪108,960")**, used in the summary, the family chip popover, the status line and the statement hero. Max width 220px, centred or start-aligned depending on host.
```
  נשארו בחודש                (12/500 muted, plain Hebrew, NO amount inside)
  ₪4,540                      (24/800, --income)      ┐  the three lines are one
  × 24 חודשים                 (14/500 muted)          │  `<div dir="ltr" class="eq">` grid
  ────────────                (1px --border)          │  columns: operator 20px | value right-aligned
  = +₪108,960                 (28/900, --income)      ┘
```
Each amount is its own `money()` isolate; "× 24" and "=" live in the operator column / their own `<bdi>`; nothing wraps because lines are blocks (`white-space: nowrap`). At <= 640px tall the middle line is hidden (label + result remain). At 320 wide the result drops to 24px.
**Payday chip** (after the sheet; sits in the roll-zone note slot, replaces the 3-line wrapped bubble): ghost chip, max-width 240, height auto; content = label (12 muted) + amount (22/800 `--income`/`--negative`/family amber) in a 2-line stack; tap expands the stacked equation as a popover (existing family-popover pattern). Never more than 2 lines in the chip.
**Float** ("+₪4,540" on landing/passing): a single pill, 22/800 text, `--surface` opaque fill + 1px `--border`, padding 6/14, `pointer-events: none`. **Travel area = the board plaza only**: starts at plaza top + 12px (the strip directly under the top tile row), drifts up at most 16px, never above the plaza's top edge, max-width = plaza width − 24px, so it can never cover the top tile row, the HUD or the pawn. Duration 1200ms (`--ease-out`), fade out last 300ms. Two lines max (amount + 12px caption). QA assertion: `floatRect` fully inside `plazaRect`. Reduced motion: fade in place, no drift.
**Payday copy variants (structure for the educator; designer specs layout only)**. The layout supports three interchangeable patterns, picked by `turn % 3` (same data, different phrasing), each with a kicker (<= 24 characters, no amounts), up to two amount slots as `{amount}` nodes, and an optional caption (<= 2 lines of <= 30 characters at 14px in a 220px column, no amounts):
- **A. Equation** (the stacked equation above): kicker + monthly + months + total.
- **B. Headline number**: kicker (12 muted) / one XL amount (28/900) / caption (14 muted).
- **C. Before → after**: two stacked rows "לפני ₪X" (muted) / "אחרי ₪Y" (text) with a single 20px mirrored arrow icon (`icon-dir`) between, caption optional.
Copy rules for the educator: plural-neutral address, family mode never uses "הפסד/חוב" for the money line, amounts only as slots, each variant has a family and a full text. 3+ variants are required so the toast is not a repeated sentence.

## 5. Mascot usage (rules; sizes/poses stay in `design/fox-usage.md`)
Allowed: **home** (wave/tired), **guide** (tutorial/first-game tour, 'פסיבו מסביר'), **feedback / tips** (fox notes, family tips), **win** (hammock), **game over** (tired), splash. Removed as decoration: the corner crop on every card, the loan dialog `worried` crop, the profession-sheet `ponder`/`think` pop, standalone reaction pops on the board (merged into the feedback note). One fox per screen at a time; a note's 52px crop uses a 2px `--border` ring (the gold ring is retired: gold = action).

## 6. Financial typography
### 6.1 The one component
`money(n, { sign, size, tone, cur })` in `src/ui/format.js` (it exists; extend it, do not fork). Output:
```html
<bdi class="money [money--xl|lg|md|sm] [is-neg|is-pos|is-zero]" dir="ltr"><span class="cur">₪</span><span class="num">1,234</span></bdi>
```
Rules:
1. **Tabular lining figures**: `.money { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1, "lnum" 1; font-family: var(--font-display); }`.
2. **Thousands separators** via `Intl.NumberFormat(numberLocale)` (already); no abbreviations (no "K"/"M") in v3.
3. **Sign**: negatives always show the sign `−` (U+2212, same width as `+`) before the symbol, inside the isolate: `−₪800`. Positives show `+` only when `sign: true`. Colour is never the only carrier of negativity. (The plain-text `moneyText()` keeps the ASCII hyphen for aria/log/share strings; see conflicts.)
4. **Colour**: negative = `--negative` on dark / `--negative-ink` on cream and white; positive-with-meaning = `--income` / `--income-ink`; neutral = inherit. Family mode: `--negative` is amber by token, nothing in the component changes. Never colour with `--expense-fill`.
5. **Symbol**: `.cur { font-size: .72em; font-weight: 500; margin-inline-end: .1em; opacity: .9 }` for sizes >= lg; at sm/md the symbol is full size (legibility).
6. **Isolation**: always `<bdi dir="ltr">` (or `unicode-bidi: isolate` + `direction: ltr`), including when the amount sits inside a Hebrew sentence. Equations and ranges put each amount in its own isolate and the operator outside or in its own `<bdi>`.
7. **Sizes** (px): xs 12, sm 14, md 16, lg 20, xl 28-32, xxl 36-40. Weight 700; hero amounts 800-900. `white-space: nowrap`; fit-text shrinks long values (existing `fitText`) down to 70% before ellipsis (never wrap an amount).
8. **Live counters** (count-up, loan stepper) write into the existing `<bdi class="money">` via `textContent`; they keep the `.cur/.num` split with a small helper `setMoney(el, n, opts)` so symbol styling survives updates.
9. **Plain strings**: where a string is unavoidable (aria-label, `document.title`, share text, toast announced to a live region) use `moneyIsolated(n)` = `⁦` + moneyText + `⁩` (LRI/PDI), never a bare "₪1,234". Share text especially (it leaves the app and the receiving app has no `bdi`).
10. A template with an `{amount}` slot is **always filled with a node** (`tn()` / `fillNodes()`), never with `moneyText()` into a string.

### 6.2 Places that currently render amounts as plain text (developer converts each)
| Where | File:line (Phase 0 build) | Convert to |
|---|---|---|
| Statement asset subline "· משכנתא ₪X" (`.st-sub`) | `src/ui/statement.js:66` (`statement.assetMortgage`) | `tn()` with `money()` node |
| Statement liability subline balance + interest-rate line (`.st-sub`) | `statement.js:79-80` (`statement.balance`, `statement.interestOnly`; the % uses `numberText`: wrap in `<bdi dir="ltr">`) | `tn()` nodes |
| "חסרים לכם ₪X" banners (needs loan / expense due / shortfall / not enough) | `src/ui/modals.js:265` (`card.needLoan`), `:352` (`card.expenseDue`), `:368` (`card.shortfallText`), `:385` (`card.notEnough`), `:607` (repay) | `tn()` nodes |
| Blocked banner cap text | `modals.js:263` (`loan.capBlocked` with `numberText`) and `:470` (`loan.capNote`: salaries + amount) | `tn()` nodes |
| Charity text "תרמו ₪890 (10%…)" | `modals.js:389` (`charity.text`) | `tn()` node |
| Market stock price banner, baby text | `modals.js:424` (`market.stockPrice`), `:444` (`baby.text`) | `tn()` nodes |
| Loan dialog: intro text, limit label "₪X מתוך ₪Y", risky warning, repay text | `modals.js:565` (`loan.text` / `loan.textVoluntary`), `:536` (`usedLabel` via `textContent`), `:528` (`warnText`), `:616` (`loan.repayText`) | `tn()` nodes; for live labels use two `money()` nodes updated by `setMoney` |
| Stock note dividend line | `modals.js:144` (`stockNoteModel` with `moneyText`) | node slots |
| Family chip + popover foot | `src/ui/hud-family.js:24` (`flowChipText` string), `:57` (`${moneyText} × ${numberText}` in one bdi: split into the stacked equation) | component |
| Payday summary slots | `src/ui/summary-card.js:28-30` (all slots are `moneyText` strings fed to `fillSlots`) | `fillNodes` with `money()` |
| Fox feedback notes | `src/learn/feedback.js:74-128` (every `moneyText(...)` slot: cf, amount, cashLeft, saved, loss, offerPrice) | node slots (`fillNodes`) |
| Fox report lines + worst-deal/interest lines | `src/learn/report.js:49,60,91-92` | node slots / `money()` |
| Loan/term slots shared by the guess + dictionary | `src/learn/slots.js:32,33,43` | node slots |
| Others strip / standings aria | `play.js:445`, `standings.js:30`, `widgets.js:85` | keep strings but through `moneyIsolated` (aria) |
| Share text | `src/ui/screens/end.js:45` | `moneyIsolated` |
Already correct (keep): HUD cash/flow, statement rows (`money()`), summary big numbers (`bdi.money`), story numbers.

## 7. Accessibility
- **Contrast**: 113 pairs audited in `docs/v3/design/contrast-v3.py` (all pass). Key numbers: text/bg 16.6:1, muted/surface-2 6.7:1, negative `#E57373` on bg/surface/surface-2 6.0/5.3/4.6, income on surface-2 8.3, gold primary text 9.4, ghost border on bg/surface-2 5.1/3.9, card ghost border on cream 4.2, key-number ink on cream: income-ink 6.1, negative-ink 6.1; category inks on cream 5.2-6.6; verdict pills 5.9-7.0; ribbons vs the navy around them 4.3-8.2 (the ribbon is redundant with the pill text, so it is exempt from 1.4.11 as a sole carrier; it is also on a 3px edge next to the scrim). **`scripts/contrast-check.py` update**: copy the `dark_v31` / `light_v31` rows from `docs/v3/design/contrast-v3.py` (same row format) in place of the rows naming `#0F1E46 #16295E #1D3573 #0A1533 #C4D0F0 #FF9C8C` and the old gradient button stops; add the fox-note and chip rows when they ship.
- **Focus**: 3px ring, offset 2px, `--focus-ring` (gold-300 on dark, navy on light), `--focus-ring-card` inside cards. Never `outline: none` without a replacement. Dialogs trap focus (existing `openLayer`).
- **Targets**: all interactive >= 48x48 and 8px apart (primary 64, md 56, stepper 56, handle 48 hit area, chevron hint non-interactive). Profession cards 171x164.
- **Reduced motion** (`prefers-reduced-motion` and `data-motion="reduced"`): card entrance = opacity 120ms; ribbon colour change instant; scroll chevron/mask fade instant; arming bar static at 50%; float fades in place; fox bob/sway/rise off; die 120ms; confetti off; count-up instant. All through the existing duration tokens.
- **Not colour only**: verdict (pill text + icon), negative (sign), category (icon + label), family slow tier (hourglass + label), selected state (check icon + ring).
- Screen readers: the ribbon, chevron, category chip glyphs, avatar glyphs are `aria-hidden`; the card region keeps `aria-label=title`; `disabled` primary has the reason in the banner (`role="status"`, readable in browse mode); arming button has `aria-busy` and a polite live-region message is NOT needed.

## 8. Layout behaviour summary
| Element | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Deal card | 358 wide; key numbers 32px; footer <= 148 | 328 wide; 28px | 288 wide; 24px; text 2 lines; footer <= 132; scroll hint essential |
| Profession grid | 2 x 171, card 164 high, fits | scrolls ~4px | 2 x 144, scrolls, header pinned |
| Loan dialog | ~470 | ~470 | ~500 with details closed, scrolls inside |
| HUD | 156 | 150 | 112 (rows merged) |
| Roll button | 64 | 64 | 56 |
| Statement hero | equation 3 lines | 3 lines | 2 lines |
No horizontal scroll at any width (each amount is `nowrap` inside a `min-inline-size: 0` flex/grid cell; fit-text handles overflow).

## 9. Conflicts with the existing code (the developer must resolve; all intended)
1. **`is-blocked` / `aria-disabled` Buy** (`modals.js` cardShell `blocked`, `.btn[aria-disabled]` dashed style, tests asserting `aria-disabled="true"` e.g. `07b-deal-card-BLOCKED-buy-aria-disabled`): replaced by real `disabled`. QA/e2e selectors must change to `[disabled]`; the blocked-tap `shake()`/error haptic path disappears.
2. **Arming** (`.is-arming` + `aria-disabled` on handoff/summary buttons, `summary-card.js:88`, `modals.js:690`): now real `disabled` + `aria-busy` and new visual (3.1). Existing e2e code that clicks during arming expects a no-op: a click on a `disabled` button is a no-op by itself (OK), but Playwright `click()` will **wait for enabled** and may time out: tests must use `force`/wait for `[data-arming]` to clear.
3. **Card flip + fox corner pop** (`cardShell({ flip })`, `layer cardFlip`, `delay: (flip ? 400 : 0) + 150`): removed; entrance is 180ms fade/rise. Any test waiting for the flip animation end must wait for opacity 1 instead.
4. **Banner art**: `card-*.svg` gradient banners and `.card-head`, `.card-banner`, `.card-chip` deleted (the `BANNERS` glob in `modals.js` goes away). Square tiles (`square-*.svg`) and `card-*.svg` assets stay in the repo for other uses until Phase 2 deletes unused ones.
5. **`btn-buy` / `btn-danger` classes** still exist: `btn-buy` is now identical to primary; `modals.js:531` toggles `btn-danger` on risky loans: remove (risky keeps primary + "קחו בכל זאת").
6. **Hard-coded colours in CSS** that bypass tokens and must be replaced with tokens in Phase 2: `components.css` `.btn` shadows (`0 14px 24px`, `inset 0 2px 0 rgb(255 255 255 / .7)`, `:active` shadows), `.btn-secondary { backdrop-filter }`, `.card-head` gradient, `.card-body` 4 painted scroll gradients, `.banner-warn` (#FFE9E5/#7A1810/#FFB3A7), `.banner` navy, `.step-btn` navy + `0 3px 0` shadow, `.limit-fill` (#FFC83D > #FF5A4E), `.dialog` `0 0 0 3px var(--card-ring)` (now hairline: fine), `.sheet` shadow; `screens.css` `--board-bg` (#0A1533 > #12275A, use `var(--surface-sunken)` > `#131C33`), `.mode-card[aria-pressed]` gold glow/`scale(1.02)`, `.daily-card` gold, `.prof-card` `0 4px 0` shadow, 12 literal `#0F1E46`, 4 `#0A1533`, 3 `#091330`, `#16295E` x2, `#1D3573` x2, `#1B3068`, `#12275A`, `#060E24` x2 (replace with `--bg`, `--surface-sunken`, `--surface`, `--surface-2`, `--outline`); `tutorial.css:69` card border `3px solid var(--card-ring)` (now translucent white: change to 1px) and `:279-287` arming rules (replace).
7. **`--expense` is no longer used for cream surfaces**: any `.card .stat-expense .stat-value { color: var(--expense-ink) }` stays; but `.kv.is-negative .money { color: var(--expense) }` on a **card** (cream) would now be 2.8:1: use `--negative-ink` inside `.card`.
8. **Gold usage that must go** (rule 1): story title (`tutorial.css:175`) use `--text`; HUD cash gold (token now white); mode card selected gold; `daily-card` gold fill/border; end-screen orange rays; passive meter gold end; `.banner b/.money` gold-300 inside navy banners (use `--text`); `.big-amount` cash colour (now white).
9. **Tests with literal colours or copy**: any unit/e2e asserting `#0F1E46`, `rgb(15, 30, 70)` or the mint buy button must follow the new tokens. `-₪` vs `−₪`: if the Money component switches to U+2212, tests matching `-₪800` in DOM text need `[-−]`. (Safe path: change only the component's visual text; keep `moneyText()` ASCII.)
10. **Engine slot for the loan dialog**: "cost over 12 months" is not what `loanTerms` returns today (`perPayday`/`totalAtPayday` use `PAYDAY_MONTHS`). Add `perYear` (= monthly x 12) rather than reusing the 24-month figure; texts must say interest-only.
11. **Learn content (educator-owned JSON)**: labels for the three loan numbers, `category.*`, the verdict pill labels, payday variants A/B/C need strings; layout assumes <= 14 characters for the three loan labels and <= 12 for category labels.
12. **Light theme**: cream card + flat paper is unchanged in structure; screenshots of the light theme are a P2 verification, not a Phase 1 deliverable.
13. **Navy literals outside the stylesheet**: `index.html` (`theme-color`, `html, body` background, `#app:empty` gradient `#091330 > #0F1E46 > #1D3573`), `public/manifest.webmanifest` (`background_color`, `theme_color`) and `src/ui/prefs.js:34` (`theme-color` meta) still say `#0F1E46`. Change them to `#0F172A` (and the splash placeholder to the flat `#0F172A`). The app icon background (`app-icon-background.png`, `scripts/make-icons.py` `NAVY`) stays `#0F1E46` on purpose: it matches the baked-in navy of the approved hero art.
