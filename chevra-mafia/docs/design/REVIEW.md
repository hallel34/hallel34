# חברה – Visual / UX Review and Upgrade Spec

Scope: `public/index.html` (625 lines) read in full, plus `docs/GAME_DESIGN.md`. Review is by code inspection at 360x800 (no device run). No game rules are changed; items touching rules are flagged "needs GAME_DESIGN first".
Goal: from "dark web form with emoji" to a party game that feels like Among Us / Werewolf-night: a noir, moody, tactile look, with the phone as a prop in a room full of friends.

## 0. Summary of the biggest problems

1. **Every Firestore snapshot rebuilds the DOM** (`app.innerHTML`) and replays the `.screen` fade-in. Each pick, join or ready tap makes the whole screen flicker and slide. The role-card flip never animates, because the card is re-created already in its `.on` state.
2. **Emoji are used as icons and as the whole art direction** (logo, roles, moon, skull). They render differently on every Android vendor, so the game has no identity.
3. **Touch targets below 48px**: stepper buttons 38px, toggle 30px high, segment buttons ~38px, peek pill ~30px, `btn.sm` ~38px, link buttons ~46px.
4. **Contrast**: white 17px bold text on the `#ff3b5c` primary gradient is about 3.6:1 (fails AA below 18.66px bold). The off-toggle knob `#666` on `#1f1f30` is under 3:1 (non-text AA).
5. **`maximum-scale=1`** disables pinch zoom (WCAG 1.4.4 failure). No `prefers-reduced-motion`. No `aria-live`.
6. **Night screens glare**: a bright, saturated screen in a dark room full of people breaks atmosphere and leaks info. Night needs a near-black, low-luminance mode.
7. **Native `confirm()` dialogs** (detective pick, leave, end vote) are ugly and break immersion.
8. **No payoff moments**: death reveal, vote result, win and role reveal are static cards. There is no confetti, no stagger, no "you won or lost".
9. **Primary actions scroll away** with 20 players (grid of up to ~10 rows). Nothing is pinned to the thumb zone.

## 1. Design tokens (drop-in replacement for `:root`)

Direction: "Noir Party". Ink-navy-violet base, hot-red accent kept for the brand, gold for town and day, per-role colors with an icon shape so color is never the only signal.

```css
:root{
  /* surfaces (dark is default; the game is played at night) */
  --bg-0:#07070d;          /* night OLED */
  --bg-1:#0e0e18;          /* base */
  --bg-2:#161624;          /* card */
  --bg-3:#202035;          /* raised / controls */
  --line:#34345a;          /* was #2a2a40: 1.5:1 -> border visible */
  --text:#f4f3fa;
  --text-2:#b4b2cc;        /* secondary text, 8.4:1 on --bg-2 (was --muted #8d8ba6) */
  --text-3:#8d8ba6;        /* decorative / disabled only */

  /* brand + roles (text-safe on --bg-2 >= 4.5:1) */
  --brand:#e5244d;         /* button fill; white text 4.6:1 */
  --brand-hi:#ff4d6d;      /* glow, text on dark 5.6:1 */
  --brand-lo:#9c0f33;
  --mafia:#ff4d6d;   --mafia-ink:#2a0a14;
  --doctor:#34d399;  --doctor-ink:#062a1d;
  --detective:#5eb0ff; --detective-ink:#08203a;
  --citizen:#f5c542; --citizen-ink:#2e2306;
  --night:#8b7cf6;   --day:#f5c542;

  /* type (Rubik 400/500/700/900 already loaded) */
  --fs-display:clamp(52px,16vw,72px);   /* wordmark, room code */
  --fs-h1:32px; --fs-h2:24px; --fs-body:17px; --fs-sm:14px; --fs-xs:12px;
  --lh-body:1.5; --lh-tight:1.15;

  /* space / radius / target */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px;
  --r-sm:12px; --r-md:16px; --r-lg:24px; --r-pill:999px;
  --tap:48px; --tap-lg:56px;
  --safe-b:env(safe-area-inset-bottom,0px);

  /* elevation */
  --e-1:0 2px 0 rgba(0,0,0,.35);
  --e-2:0 8px 24px rgba(0,0,0,.45);
  --glow-brand:0 0 0 1px rgba(255,77,109,.5),0 8px 32px rgba(229,36,77,.35);

  /* motion */
  --d-fast:120ms; --d-base:240ms; --d-slow:420ms; --d-reveal:900ms;
  --ease-out:cubic-bezier(.2,.8,.2,1);
  --ease-in:cubic-bezier(.4,0,1,1);
  --ease-spring:cubic-bezier(.34,1.56,.64,1);
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
```

Phase theming should crossfade instead of `transition: background` (gradients cannot be transitioned, and `background-attachment:fixed` janks on Android). Use one fixed `#sky` div behind `#app` with three stacked layers (`.sky-night`, `.sky-day`, `.sky-neutral`) and toggle `opacity` (`--d-slow`). Night layer: `radial-gradient(120% 60% at 50% -10%, #2a1f6b66, transparent 60%), var(--bg-0)` plus a few CSS-only stars (`radial-gradient` dots, 2 layers, slow twinkle).

## 2. Cross-cutting fixes

### P0
| # | Fix | Spec |
|---|---|---|
| 1 | Stop replay/flicker on snapshot | Run the `.screen` enter animation only when `status` changes (add class `enter` in the `s!==lastStatus` branch, remove on `animationend`). Chip and button `fade` animations only for new elements (keep a Set of seen player ids). Better: keyed update of the player list instead of `innerHTML`. |
| 2 | Role card flip must animate | Do not rebuild `.flip`. Toggle `.on` on the existing node and skip `render()` in `actions.flip`; add `transform-style:preserve-3d` on `.flip` inner wrapper, duration 600ms `--ease-out`. Add a 1-frame light sweep on reveal. |
| 3 | Touch targets | Stepper buttons 48x48 (`.stepper button{width:var(--tap);height:var(--tap)}`); toggle 56x32 with an invisible 48px-high hit area (`.tgl{min-height:48px;background-clip:content-box}` or a padded wrapper); `.seg button{min-height:48px}`; `.peek{min-height:48px;padding-inline:14px}`; `.btn.sm,.btn.link{min-height:48px}`; gap between targets >= 8px. |
| 4 | Contrast | Primary button fill `--brand #e5244d` (white 4.6:1). Replace `--muted` text uses with `--text-2`. Toggle off knob `#8d8ba6`, track border `1px solid var(--line)` lifted to 3:1. Selected states (`.pbtn.sel`) add a check glyph, not only color. |
| 5 | Pinch zoom | Remove `maximum-scale=1` from the viewport meta (inputs are already 18px so iOS will not auto-zoom). |
| 6 | Reduced motion | Add the media query in section 1. Replace the float/blink/typing loops with static states. |
| 7 | Screen reader live regions | `#toast` gets `role="status"`; `.status`, `#timer` wrapper (announce only at 60/30/10s, not each tick) and the mafia-agreement line get `aria-live="polite"`. Player buttons get `aria-pressed`. Emoji replacement icons are `aria-hidden` with text labels. |
| 8 | Sticky thumb-zone action bar | Wrap the primary action of each screen in `.dock{position:sticky;bottom:0;padding:12px 16px calc(12px + var(--safe-b));background:linear-gradient(to top,var(--bg-1) 70%,transparent)}`. `#app` bottom padding becomes `96px`. Buttons are `min-height:var(--tap-lg)`. |
| 9 | Replace `confirm()` | One shared bottom-sheet component: slides up 280ms `--ease-out`, dim backdrop, two 56px buttons (confirm in the role color, cancel ghost), focus trap, Esc/back closes. Copy in each screen section. |

### P1
- **Iconography**: replace all emoji with a custom inline SVG sprite (`<symbol>`), one consistent 2px-stroke rounded set, 24px grid, filled duotone for the large role versions (96px). Needed: knife/mask (mafia), syringe-cross (doctor), magnifier (detective), house/door (citizen), moon, sun, ballot, skull, crown, share, eye, gavel, shield, shrug. Each role also has a **distinct silhouette badge shape** (mafia = diamond, doctor = circle with cross, detective = hex, citizen = rounded square), so red vs green is never the only cue. Keep emoji only in toasts if at all.
- **Haptics**: today only one vibrate per phase. Add: tap-select 10ms; role reveal [30,40,30]; night start [80,60,80]; death announcement [200]; saved [40,40,40]; vote cast 15ms; win [60,40,60,40,200]. Add a mute toggle (localStorage `mafia_haptics`) and a sound toggle in the lobby footer.
- **Safe area for toast and dock**: `#toast{bottom:calc(24px + var(--safe-b));left:50%}` and `max-width:calc(100% - 32px)`; role="status".
- **Wordmark**: replace the 🎭 + gradient-clipped text with a custom SVG wordmark "חברה" (heavy Rubik 900, one letter with a slashed/shadowed detail, red neon underglow). Same for the app icon and PWA manifest (there is none yet: add a manifest and `theme-color` changing per phase via JS).
- **Long names**: `.pbtn span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`; `.pbtn small` (mafia vote list) clamp to 2 lines.
- **Names/avatars**: give every player a deterministic avatar chip (colored circle, first letter, one of 12 hues from a hash of the name). Used in lobby, vote grid, tally, roles list. This is the biggest "party" upgrade for the lobby and vote screens.
- **Card hierarchy**: `.card` uses `--bg-2`, 1px `--line` and an inner top highlight `box-shadow: inset 0 1px 0 rgba(255,255,255,.05), var(--e-2)`. Right now cards are flat rectangles on a flat background.

### P2
- `.row:last-of-type` never matches as intended (all rows are `div`s, followed by a div note), so the last row keeps its border. Use `.row:last-child` or move the note out.
- `.tgl` uses physical `right`; switch to `inset-inline-start/end` so a future LTR English build mirrors correctly. `.code-input` letter-spacing adds trailing space that makes the digits look off-center: add `padding-inline-start:10px` or use 4 separate cells.
- Use `100dvh` min-height on body; drop `background-attachment:fixed` (see tokens).
- `text-shadow`/`drop-shadow` glows on large emoji plus infinite animations are fine now but will cost on low-end Android when replaced by SVG: use `will-change:transform` only on the moon and `filter` on static layers.
- Optional ambient audio: 2 looped low-volume beds (night drone, day murmur) plus stingers for death/win. Off by default, toggle in lobby.

## 3. Screen-by-screen

Layout assumes 360x800: content width 328px (16px padding), safe areas respected.

### 3.1 Home
Problems: emoji logo, title gradient reads as a template, form is one generic card, primary vs join hierarchy unclear, error is a plain red box.
Spec:
- Hero zone (top 40%): SVG wordmark 72px with red underglow, below it a looping slow "spotlight sweep" (conic gradient rotating 20s). Tagline `משחק מאפיה לחבורה – כל אחד מהטלפון שלו` becomes two lines: **"מי מהחבורה משקר?"** (display 24px) and `כל אחד מהטלפון שלו` (text-2, 15px).
- Bottom half is a dock-style sheet (`--bg-2`, top radius `--r-lg`): name input (56px high), then **two** equal-weight entry points as a segmented switch "פתיחת חדר" / "הצטרפות" instead of a divider (less scrolling, one primary button visible at a time). Join mode shows the 4 code cells (64x72, mono-feel, autofocus, numeric keypad); auto-submit on the 4th digit.
- Primary CTA label `פתיחת חדר` (drop emoji), join `הצטרפות`. Disabled until name present (don't wait for a toast: inline hint under the input).
- Errors: inline under the relevant field, shake 300ms (translateX ±6px, 3 cycles), `role="alert"`.
- Pre-filled `?code=` deep link: open straight in join mode with the code filled and a headline "הוזמנתם לחדר 4821".
- Haptic: 10ms on key press, error [30,40,30].

### 3.2 Lobby
Problems: code box is nice but static; chips all re-animate on each join; host controls long list; start button far down.
Spec:
- Code block: tap to copy (toast "הקוד הועתק"), label above `קוד החדר`, digits in `--fs-display` with 0.25em spacing in a faint neon frame; share button is a 48px icon + text `הזמנת חברים`.
- Players: 2-col avatar tiles (avatar + name, crown on host). New joiner pops in (scale .8 to 1, `--ease-spring`, 300ms, only for the new id). Empty slots to 4 minimum shown as dashed ghost tiles with `חסר/ה שחקן` so progress toward "can start" is visible.
- Counter pill `5 / 4 מינימום` turns green when startable.
- Host settings collapsed in an accordion `הגדרות` (default open for host on first visit); role rows use the new role badges; stepper 48px; discussion seg 48px. Live line `מאפיה 2 · רופא · בלש · 4 אזרחים` under the section as a compact summary.
- Dock: `התחלת משחק` (56px). When disabled, show the reason as a one-line chip directly above it, not far above.
- Non-host waiting: "ממתינים למארח" with the three dots replaced by a slowly pulsing ring around the host's avatar.
- Copy: `יציאה מהחדר` stays a link but 48px high, left in a footer, with the new confirm sheet: "לצאת מהחדר? המשחק ימשיך בלעדיכם" / [יציאה] [להישאר].

### 3.3 Reveal (role card)
Problems: flip doesn't animate (rebuild), card back is only a hatch pattern, role description is long, `peek` modal leaks the role to onlookers.
Spec:
- Instruction `ודאו שאף אחד לא מציץ` becomes a visible chip with an eye-slash icon at the top; below it the card.
- Card 300x420 max, centered; back: dark card with embossed ornamental border, big "?" in brand red and the instruction `לחצו וחשפו`. Idle breathing: scale 1 to 1.02, 3s (reduced motion: none).
- Flip: 600ms `--ease-out` rotateY, mid-flip light sweep (a white 12% linear gradient moving across), haptic [30,40,30] at the midpoint. Front: role color radial glow, 96px role badge icon, name 40px/900, one-line description (<=60 chars; move the rest to a "?" help), mafia teammates as avatar row.
- Tap again to hide (already supported); auto-hide after 8s of idle so a phone left on a table does not expose the role.
- Ready button in the dock: `הבנתי, מוכנים` (plural, see copy rules) enabled after the first flip. After pressing: card flips back automatically and the screen shows the ready avatars (`3/5`) filling in as a ring.
- Peek modal (`התפקיד שלי`): **press-and-hold to view** (pointerdown shows, pointerup hides) with a blurred backdrop and a 3s auto-close; label `החזיקו כדי להציץ`. The button is 48px, moved to the top bar end as an icon + text.

### 3.4 Night (per role)
Global: body goes to `--bg-0`, brightness cap (no surface lighter than `#161624`, no fills above ~35% luminance), accent glows reduced to 40%. Moon SVG top, status title in role color. Everything auto-dims further after 20s idle (opacity .6 overlay) to avoid screen glare. All night grids use 56px-high tiles with avatars. Selected tile: 2px role-color border, check badge, `--d-fast` press scale .96.

Mafia: header `בחרו קורבן` (plural, single instruction), mate selections show tiny avatar dots on the tile (who voted for whom) instead of the text `🔪 שם, שם` that wraps. Agreement banner: red-glow pulse once when all agree (`✓ סגרתם על קורבן`). Disagreement: amber `אין הסכמה – התייעצו בשקט` (keep the whisper tone; no sound).
Doctor: green role theme; own tile labelled `אני` with a shield glyph; status line `מגנים על {name}` (changeable until night ends).
Detective: the pick uses the bottom-sheet confirm (`לבדוק את {name}? אי אפשר לבטל`). Result card: full-bleed, 600ms reveal: a magnifier scan sweep (1 pass, 500ms) then the verdict: red `מאפיונר/ית` with shake, or green `לא מאפיה` with a soft pulse. History list as a compact avatar timeline with night numbers.
Citizen / sleeper (see 3.5).
Dead player: `deadbox` becomes a ghost screen: desaturated, avatar with a cross-hatch, `אתם בחוץ. צפו בשקט`, plus a one-line "what's happening" ticker is NOT allowed (it would leak), so keep it static.

### 3.5 Sleep screen
Problems: bright 96px moon emoji floating on purple; identical for every non-acting role so it is fine for secrecy, but its brightness is the problem. Also citizens wait up to the whole night with nothing.
Spec:
- Background `--bg-0`, only a soft moon SVG (cool white `#cfd3ff` at 70% opacity, 6px blur halo) drifting 8px over 6s; 8–10 star dots twinkling with offset delays (opacity .2 to .6).
- Text `העיר ישנה` (24px, `--text-2`), sub `עיניים עצומות, מסך עמום.` with a fade-in after 2s.
- Remove "ZZZ" blink loop; replace with a slow "breathing" ring (opacity 0.15 to 0.35, 4s).
- Needs GAME_DESIGN first (P2): give citizens a decoy micro-task ("tap the moon three times to doze off") and show a fake pick grid for the dead only if the rules want it; today a glance at a neighbor's phone reveals who has an action. Minimum no-rule-change mitigation: every role's screen shares the same header and tile layout, differing only in accent color (kept dim at night).

### 3.6 Day (announcement + discussion)
Problems: the death is a flat card, the timer is only text, an alert with `blink` on low time is harsh, `toVote` host button sits last after a long player list.
Spec:
- Staged announcement (on entering day only): sun-up sweep (warm gradient wipe 700ms), then the card: `הלילה נרצח/ה` fades in (240ms), 400ms later the victim's avatar + name drops in with `--ease-spring`, skull badge, red vignette pulse, haptic [200]. Saved: green shield draws on, `הרופא הציל!`, haptic [40,40,40].
- Card collapses to a slim 64px banner after 4s so the discussion has room.
- Timer: circular SVG ring (stroke-dashoffset), 72px digits tabular, ring color gold, turning red at 15s with a gentle scale pulse (not opacity blink; static under reduced motion). `aria-live` announces at 60/30/10s.
- Players: avatar grid (alive full color, dead desaturated with a cross), `אתם` marker.
- Host dock: `מעבר להצבעה` (56px) with the confirm sheet only if > 30s remain. Non-host dock shows nothing.
- Copy: `דברו, האשימו, חקרו – מי מכם המאפיה?` fine; shorten to `מי כאן משקר/ת?`.

### 3.7 Vote
Problems: 2-col grid of 17px buttons where all look the same as the night grid; "skip" is a full-width button but visually identical to a player; vote count only as text; dead voter gets almost nothing.
Spec:
- Gold theme. Header `מי חשוד/ה?` with a progress ring `4/7 הצביעו`.
- Tiles: avatar, name, selected state with gold ring + check + `הקול שלך`. Skip tile is a distinct dashed-border full-width tile `לא מדיחים אף אחד` (not an emoji shrug).
- Voting is not hidden (changeable); to keep it fair, never show running tallies of others' choices (current code correctly shows only a count). Keep.
- Dock for host only: `סיום הצבעה` (ghost, confirm sheet `לסיים עכשיו? מי שלא הצביע/ה יחשב/ת כמי שדילג/ה`: check this against the engine, the engine currently ignores non-voters in tally, so copy must not claim "counts as skip").
- Haptic 15ms on select, [20,30,20] when the last vote lands.

### 3.8 Vote result
Problems: abrupt card, tally rows crowded and the role is hidden (by design).
Spec:
- Gavel drop animation (SVG, 300ms) then `הוחלט להדיח את` / name big. No role reveal (rule). Tie: two-hands/handshake glyph, `תיקו – אף אחד לא הודח`.
- Tally: horizontal bars, width proportional to votes, filled from inline-start (RTL: from the right), with voter avatars stacked. Highest bar gold, others `--bg-3`. Animated grow 400ms staggered 60ms.
- Host dock `יורד לילה` (moon icon), non-host: ring + `ממתינים למארח`. Consider auto-advance after 12s if the host is idle (needs GAME_DESIGN first).

### 3.9 Game over
Problems: no personal outcome, no celebration, 20-row roles list unstructured.
Spec:
- First line is personal: `ניצחתם!` or `הפסדתם הפעם` (compare `me().role==='mafia'` with `winner`), then team headline `העיר ניצחה / המאפיה ניצחה`. Town: gold radial + confetti (canvas or 40 CSS particles, 2.2s, gold/white). Mafia: red vignette + knife-slash line wipe, rain of dark particles. Haptic win [60,40,60,40,200] / loss [250].
- `lastEvent` stays as a subtitle.
- Roles list: staggered slide-in (50ms each), mafia first with role-colored left (inline-start) accent bar, dead players with a cross badge but readable (do not use strike-through at .5 opacity, which fails contrast; use `--text-2` + a skull glyph).
- Stats mini-card (cheap to compute from existing data): rounds survived, `נקטלו בלילה` / `הודחו`.
- Dock: `משחק נוסף` (host) / `ממתינים למארח`; link `יציאה`.

## 4. Copy and tone

CLAUDE.md asks for gender-neutral wording. Current UI mixes `בחר/י`, `את/ה`, `מוכן/ה`, `בחרו`. Decide once, log it in decisions:

- Default: **plural address** for instructions (`בחרו`, `לחצו`, `החזיקו`), noun phrases or neutral verbs for status.
- Replace slashed forms:
  - `הבנתי – אני מוכן/ה` -> `הבנתי, מוכנים`
  - `בחר/י את הקורבן של הלילה` -> `בחרו את הקורבן של הלילה`
  - `את/ה מחוץ למשחק` -> `אתם בחוץ` / `יצאתם מהמשחק`
  - `את/ה המאפיונר היחיד` -> `אתם המאפיה היחידה בחדר`
  - `הוא/היא מאפיונר!` -> `מאפיונר/ית!` (keep the slash only where a noun must agree)
  - `תגן/י על` -> `מגנים על`
  - `נרצח/ה`, `הודח/ה` stay as the approved neutral form.
- Tone: short, dry, a bit conspiratorial. Examples: lobby `מחכים לעוד כמה חשודים`, sleep `העיר ישנה. אתם?`, night mafia `הערב מזמינים אותו לשיחה` is too cute, keep `בחרו קורבן`. Day `מישהו פה משקר`. Win `השתיקה נשברה` for town, `החבורה חשבה שהיא חכמה` is too mean, keep neutral.
- Error copy: `קוד החדר הוא 4 ספרות` is good; `המשחק בחדר הזה כבר התחיל` add recovery `אפשר לבקש מהמארח משחק נוסף`.
- Native dialog replacement texts are in sections 2 and 3.

## 5. Prioritized implementation order

**P0 (before any public playtest)**
1. Snapshot-driven re-render: animate only on status change, fix flip animation.
2. Touch targets to 48px; sticky dock for primary actions.
3. Contrast tokens (primary fill, text-2, toggle knob, selected check marks).
4. Remove `maximum-scale=1`; add reduced-motion; add aria-live and `aria-pressed`.
5. Bottom-sheet confirm replacing `confirm()`.
6. Night mode dimming (near-black, capped brightness).

**P1 (next sprint, defines the look)**
7. SVG icon set + role badges + wordmark + avatars.
8. Staged reveals: death announcement, detective result, vote result bars, win confetti + personal outcome.
9. Timer ring, lobby tiles with ghost slots, home layout.
10. Haptic map and settings toggle; hold-to-peek and auto-hide of role.
11. Copy pass per section 4.

**P2 (polish / needs a rules decision)**
12. Ambient audio, star-field twinkle, phase sky crossfade layers.
13. Decoy citizen task (needs GAME_DESIGN), host-idle auto-advance (needs GAME_DESIGN).
14. Manifest, icons and PWA; English/LTR readiness (logical properties pass).
15. Stats card, `.row:last-of-type` fix, `dvh` unit.

## 6. QA checklist for the designer sign-off
- 360x800 and 360x640: no horizontal scroll, dock never covers the last tile (bottom padding 96px).
- 20 players: vote grid scrolls, dock stays visible, long names ellipsized.
- Every interactive element >= 48x48 with 8px gaps.
- Contrast: all text >= 4.5:1, large text and UI borders >= 3:1 (verify with the final tokens).
- Reduced motion: no flip, no parallax, no pulses; fades only.
- Night: no pixel brighter than ~35% luminance except the role result card.
- RTL: bars fill from the right, arrows mirrored, codes/timers/amounts isolated with `dir="ltr"` / `<bdi>`.
