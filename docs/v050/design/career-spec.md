# MaxiFox 0.5.0: career, seniority, promotions and profiles, design spec
Design only. The developer builds this from this file, `src/styles/tokens.css`, `docs/v3/design/spec.md` (v3.1 "Navy & Gold, quiet edition"), `docs/v4/design/board-spec.md`, `docs/v4/design/professions.md` and the 0.5.1 spec (`docs/v051/design/challenges-spec.md`), whose structure this file follows. Scope: `CLAUDE.md`, the 2026-11-10 career row in `docs/decisions.md`, and `docs/MaxiFox_v0.5_Plan.md` section 5.

Sizes: every surface is given at **360x800** and **320x568**, in dark and light, RTL Hebrew first, logical properties only. Where 390x844 differs it says so.

Companion files:
- `docs/v050/design/career-contact-sheet.png`: 27 mocks (A to Z, plus L2) at CSS 1:1, rendered in Chromium with the real Rubik, the real tokens, the profession foxes, Maxi's poses, the logo and the new icons. Regenerate with `node docs/v050/design/render-mocks.mjs` from the repo root.
  - A to D: profession screen and sheet (section 1)
  - E to H: home chip (section 2)
  - I to L2: end-of-game block and rank-up (section 3)
  - M to P: return after absence (section 4)
  - Q to S: promotion card (section 5)
  - T to Z: profiles (section 6)
- `docs/v050/design/contrast-v050.py`: audits every new colour pair (62 pairs, all pass AA). Section 11.
- New icons: `src/assets/career/` (10 SVGs, section 9).
- No new raster art. Every Maxi pose used already exists (`wave`, `celebrate`, `hammock`, `tired`, `think`).

> **All Hebrew in the mocks and in this file is placeholder** (section 10 lists every string). Rank titles come from the educator; the mocks use invented ones only to test widths. The longest title in the mocks is 14 characters ("מנהל/ת פרויקטים", "שותף/ה מנהל/ת"). The layouts ellipsize, they never wrap, so a longer title degrades gracefully, but the educator should aim for 16 characters or fewer.

---

## 0. Rules for 0.5.0 (what follows from the design system and the owner's brief)
1. **One gold primary per screen.** Gold fills only that button. The career marks (rank glyphs, XP bar, "+XP", the x2 marker) are never gold.
2. **Career has its own colour: the fox orange family.** New tokens `--career` (text, glyphs), `--career-fill` (the bar) and `--career-tint` (a fill). Why orange:
   - it is Maxi's colour, and the career is Maxi's ladder;
   - teal `--passive` stays reserved for the freedom meter, so on the win screen the two bars are told apart by colour **and** by label (freedom % vs "ניסיון");
   - gold stays the one action colour; mint is income; red and amber mean problems.
3. **Loss is stated plainly and never dramatised.**
   - The words: what happened, what was kept, what keeps it next time. No "אבל!", no "נכשלתם", no "הפסדתם", no countdown clock, no red, no shake, no pulse, no sound.
   - The warning colour is amber (`--amber-ink`), the same calm caution colour the app already uses for negative results.
   - Warnings are shown on screens the player opens anyway. **No push, no badge on the app icon, no modal that interrupts a game.**
4. **Junior (up to 10) never sees a loss surface.** The seniority chip, the warning, the reset and the drop screens all have a junior variant that says "waiting", with a different icon (`seniority-wait`, two pause bars). Junior sees no day counts at all.
5. **Maxi is a warm friend.** On the return screen he waves (`wave`). He is never the tired pose there, never worried, never pointing at the loss. In the rank-up he celebrates (`celebrate`). One fox per screen (spec 0.5.1 rule 3).
6. **Not colour only.** Rank is a glyph plus the title. A locked rank/achievement is a dashed outline plus a lock glyph plus the word. The promo week is an icon plus "x2" plus the sentence. The warning is a number plus the word "ימים". The "spend" part of a promotion is a hatched bar plus a legend word.
7. **Targets are at least 48px and 8px apart.** There is no horizontal scroll at any size. Every number is in `<bdi dir="ltr">` or a `.money`. Every bar is a `role="progressbar"` with `aria-valuetext` in words.
8. **No new Maxi art.** Section 12 lists the one place where a new pose would help (it is optional).

---

## 1. Profession screen: rank, XP bar, promo week, start rank
Existing screen: `src/ui/screens/pick.js` (2-column grid, card tap opens the preview sheet with a pinned gold CTA).

### 1.1 The card (mocks A, B)
Each card gets **one new row and one thin bar** between the name and the salary row, and the profession's existing art well is unchanged. Added height: **34px** (20 row + 3 + 4 bar + 5 + 2 slack). The grid already scrolls (it is 1046px tall at 360), so nothing moves except what is below.
```
 ┌──────────────────────────┐
 │ [x2 ⇪]  (top corner)     │   promo-week marker, only on the promo profession (1.2)
 │      [profession fox]    │   existing 125px well, hairline floor
 │         מורה             │   existing name 20/900
 │   ⌃  מחנך/ת כיתה         │   NEW: rank row, 20px: glyph 14 --career + title 12/700 --text, 1 line, ellipsis
 │   ▬▬▬▬▬▬▬▬░░░░░░         │   NEW: XP bar 4px, 86% of the card, fills from inline-start
 │   • ₪11,400  שכר         │   existing (shows the salary of the player's CURRENT rank)
 │      ₪9,300  הוצאות      │
 │   [ נשאר בכיס ₪2,100 ]   │   existing pill
 └──────────────────────────┘
```
- **Rank row:** `rank-N` icon (14px, `--career`) + title. N is 0 to 3. The title is the educator's. Rank 0 uses a plain dot, so every profession shows a glyph and there is no "unranked" look.
- **XP bar:** 4px, radius 2, track `--meter-track`, fill `--career-fill`. It shows progress to the **next** rank.
  - At rank 3 (the top) the bar is full, and the sheet says "הדרגה הגבוהה ביותר".
  - After a **reset** (section 4) the bar is empty (0%).
  - A profession never played shows rank 0, an empty bar.
- **The numbers on the card** (salary, expenses, "נשאר בכיס") are those of the rank the player would start at by default: the current rank. The sheet changes them live when another start rank is chosen (1.3).
- **Accessibility:** the whole card stays one `<button>`; its accessible name is extended: "{profession}. {rankTitle}, {pct} אחוז לדרגה הבאה. שכר ... ". The bar is `aria-hidden` (the same words are in the name), so a screen reader never meets a stray progressbar inside a button.
- **At 320** the card is 138px wide: the title ellipsizes at about 11 characters at 12px. The marker never competes with it because it lives on the art well (below).

### 1.2 The "שבוע קידום" marker
Every week one profession has double XP. It is shown in three places, quietly:
| Where | What |
|---|---|
| **Pick screen strip** (under the subtitle, one line, 13/500 `--text-muted`) | `promo-week` icon 16 (`--career`) + "שבוע קידום: **מורה** · ניסיון כפול". The profession name is 700 `--text`. Height 20. It is always there in a promo week. |
| **The card** of that profession | a 1px `--career` outline (inset .5px so the layout doesn't shift) and a pill **"x2"** with the `promo-week` icon (12px), 22px tall, on the art well's top inline-end corner, `--surface` fill with a 1px `--career` ring. It sits on the art well, not in the rank row, so the title keeps the full width. |
| **The sheet** of that profession | a banner (existing `banner` pattern, `--career-tint` fill, `--text`): icon 20 + "**שבוע קידום למורה.** השבוע כל משחק במקצוע הזה נותן ניסיון כפול." Between the rank picker and the statement. |
- The end-of-game block (section 3) repeats the x2 pill where it applied.
- **When the week ends** the marker disappears; there is no "last chance" copy. A promo week lasts Sunday to Saturday, the same week as seniority.
- **Seniority warning on this screen** (state from Thursday, section 2): one more line under the promo line, **only in the warning state**: `seniority-due` icon 16 + "נשארו 3 ימים לשמור על הוותק", 13/700 `--amber-ink`. It is the same sentence as on home, so a player who goes home to pick still sees it. It is information, not a button.

### 1.3 Choosing the start rank (mocks C, D)
Tap a card, and the existing preview sheet opens. A new block **"דרגת פתיחה"** sits between the head (fox + title + salary per month) and the promo banner / statement.
```
 ┌ דרגת פתיחה                        הדרגה שלכם ┐   block: --surface-2, 1px --border, radius 16, padding 12
 │ [⌃⌃⌃ 4 🔒] [⌃⌃ 3] [⌃ 2] [• 1]                │   4 radio chips, 56px high (52 at 320), radius 14, gap 8
 │ עוד 115 ניסיון למחנך/ת כיתה                   │   13/500 muted
 │ ▬▬▬▬▬▬▬▬▬░░░░░                                │   XP bar 8px (the same value as the card)
 │ דרגה גבוהה היא התחלה קשה יותר: משכורת ...     │   13/400 muted, 2 lines max
 └──────────────────────────────────────────────┘
```
- **Chips:** a native radio group (keyboard, screen readers). Each is a 4-column grid cell: glyph 20 + label "דרגה N" 12/700. Order follows the reading direction: rank 1 at the inline-start (right in RTL).
  - **Selected:** `--surface` fill + 2px `--sel-ring`. It is never gold.
  - **Locked** (above the player's current rank): `disabled`, a **dashed** `--border-strong` outline, a lock glyph (`achievement-locked`, 18px) instead of the rank glyph, `--text-muted`. It is announced "דרגה 4, נעולה".
  - **Default:** the current rank, preselected. A player can pick any rank **at or below** it.
  - A drop (section 4) lowers the current rank, so the chips above it are locked again until it is re-earned. Titles held in the past stay visible in the profile (6.4), not here.
- **The top-right label** says "הדרגה שלכם" when the current rank is selected, and "שיחקתם כבר בדרגה גבוהה יותר" when a lower one is.
- **Changing the chip** updates the head (title, salary), the statement rows, the "תזרים התחלתי" and the target text, with a 120ms cross-fade of the numbers (no count-up here: the player is comparing). The CTA text is unchanged: "יוצאים לדרך".
- **Honesty line** (`career.pick.harder`): higher rank is a harder start, not an easier one. This is the educator's wording; the sheet must always show it, because the whole feature rests on that sentence.
- **Preview sheet at 320x568:** the sheet scrolls under the pinned CTA (existing pattern); the head fox is 64px; the chips are 52px.
- **A junior game** (young band): the numbers are in coins (the existing `pick.js` junior path). The career block is shown with kid words ("דרגה" stays, the explanation is short).

### 1.4 Motion and haptics (pick)
- The bars fill from empty to their value when the screen enters: **--dur-countup (700ms), --ease-out, with a 40ms stagger per card in the visible grid** (max 6 cards animate; the rest are set at their value). Reduced motion: set at once, no animation.
- Chip selection: the ring and the numbers cross-fade, **120ms** (`--dur-press`). Haptic: `tap` (10ms).
- Locked chip tap: nothing animates; the hint line under the group is the explanation (`career.pick.lockedHint`, read by `aria-describedby`). Haptic `error` is **not** used (a locked chip is not an error).

---

## 2. Home: the seniority chip (mocks E, F, G, H)
### 2.1 Where it sits, exactly
The home screen (`start.js`) has a top bar of **48px** at `y=16`, in the 16px gutters: today the first child is the games chip ("12 משחקים", 112x44) and the second child is the 4 icon buttons (216px). In RTL the games chip is at the right and the icons at the left.

**The chip takes the games chip's slot** (the first child, the inline-start side, the right in RTL). Nothing else on the screen moves:
- the icon buttons keep their size, order and place (dictionary, help, family board, settings);
- the logo, the tagline, the mode cards, the daily row, the missions row and the "התחילו משחק" button keep their sizes and y positions. (I measured the live layout at 360x800: bottom block 504..772, the CTA at 724, 48px; at 320x568: bottom block 322..554, CTA 506.)
- the games count moves into the profile (6.3), where it already fits ("12 משחקים" chip).

Why replace and not add: at 360 the row is already full. 4x48 + 3x8 = 216, plus the 8px gap and the chip = 328 = exactly the 328px of usable width. There is no room for both, and the career surface is the more valuable one.

| Width | Chip |
|---|---|
| **>= 360** | an **avatar + label** pill: 48px tall, **max 104px wide** (120 at >= 390), radius 24, `--glass-bg` fill, 1px `--border`. Avatar: the profile's favourite fox head, 36px (the existing `profession-fox/*-head@2x.webp`, `loading="eager" decoding="async"`, `width/height` set). |
| **< 360** (320 and 340) | **compact: the avatar only**, 48x48, no outline, with a 20px **status badge** at its inline-end corner (below). This also fixes an existing overflow: at 320 the live top bar starts at x = -5 (the icon row plus the games chip are 24px too wide). The compact chip is 48px, so 216 + 8 + 48 = 272 fits in 288. |
- The whole pill is **one 48px button** (the target is the pill itself). It opens the profile sheet (section 6).
- **Without a profile** (a first launch): there is no chip, and the games chip stays exactly as today. The profile is created later (6.1).

### 2.2 States
| State | Pill at >= 360 | Compact (< 360) |
|---|---|---|
| **Normal** (a game was finished this week, or the new week has just started with no loss pending) | avatar + `seniority` icon (18, `--text`) + "ותק" (12/700) + a small check mark badge on the avatar | avatar + a 20px round badge with a check (`--surface` fill, 1px `--bstrong`) |
| **Kept this week, in the first days** (Sunday to Wednesday, nothing played yet) | avatar + the icon and "ותק" in `--text-muted` (nothing to say yet) | avatar only, no badge |
| **Warning** (Thursday, Friday or Saturday, no game finished this week) | avatar + an **amber capsule** "3 ימים" (28px tall, `--amber-fill`, `--amber-ink` text 12/700; the `seniority-due` icon (14) joins only at >= 390) | avatar + a 20px amber badge with the **number** (3, 2, 1) |
| **Junior** | avatar + the **name only** (13/700, ellipsis). No "ותק", no days, no amber. | avatar only, no badge |

- **Warning timing.** The warning starts on **Thursday 00:00** local time, when no game has been finished since Sunday 00:00. The count is the number of days left in the week **including today**: Thursday 3, Friday 2, Saturday 1. A finished game ends the warning at once, and the chip returns to the normal state.
- **The sentence** "נשארו X ימים לשמור על הוותק" (Hebrew plural forms from `tp`: one, two, other, section 10) appears:
  - on the **chip's `aria-label`** at every size: "הפרופיל של נועה. נשארו 3 ימים לשמור על הוותק";
  - as **one line above the mode cards** (`seniority-due` icon 16 + the sentence, 13/700 `--amber-ink`, centred, 20px high) at heights **>= 700px**. It sits in the hero's flex slack: the logo/tagline block is vertically centred in the space above the bottom block, and at 800px tall there are about 100px free (measured: tagline ends at 436, the bottom block starts at 504). So the line costs the layout nothing;
  - **below 700px tall it is not shown on home** (320x568 has no slack). The compact chip carries the number and the aria-label carries the words. The sentence is shown again on the pick screen (1.2) and the profile (6.3), the two screens a player reaches next.
  - If the title of the phone is tall because the user zoomed the text: the line is allowed to wrap to 2 lines and is then dropped when it would push the CTA under the fold (`ResizeObserver` is not needed: use the existing `innerHeight < 700` check from the missions row).
- **Not colour only:** the pill has the number and the word "ימים"; the compact badge has the number.
- **Honest wording:** the line says what is left, not what will be lost. The loss rule is in the profile (6.3), in plain words, one tap away.

### 2.3 Performance (home must stay as light as today)
- **No new request on the critical path.** The avatar is the favourite fox's `-head@2x.webp` (88px, about 3 KB), which the pick screen already ships; the icons are inline SVG (add the 10 paths to `icons.js`, about 1.5 KB raw, no files requested); the career store module is read **synchronously from localStorage once** (the profile, the week id of the last finished game) and the chip state is computed by one pure function (`seniorityState(now, lastFinishedWeek, ageBand)`, about 20 lines). No timer, no animation, no `backdrop-filter`.
- **Home's LCP stays the logo.** The avatar has `fetchpriority="low"`.
- **No re-render loop.** The chip is refreshed when the screen is shown, on `visibilitychange`, and when `dayKey()` changes (the existing 30-second daily tick already detects that and calls `onRefresh`).
- The screens in sections 3 to 6 are **lazy chunks** (`import()` on tap / at game end). The main bundle gets the chip and the pure state function only. Budget for the main-bundle growth: 2 KB gzip.

### 2.4 Light theme, motion, accessibility
- Light: the pill is `--glass-bg` (white at 72%) with `--border`; the amber capsule uses `--amber-fill` (rgb 242 181 58 / .30) with `--amber-ink` #6E4200 (7.2:1).
- **Entrance:** none (the chip appears with the top bar). **State change** (a game finished and the player returns home): the check badge scales .6 to 1 over `--dur-fast` (180ms, `--ease-bounce`). Reduced motion: appears at once.
- **Focus** is a 3px `--focus-ring` with a 2px offset, as for the icon buttons.
- **Touch:** 48px tall; at 360 the pill is 104px wide, so it is well above 48 in both axes. It is 8px from the nearest icon button.

---

## 3. End-of-game career block and the rank-up moment (mocks I, J, K, L, L2)
Existing screens: `end.js` (`createWin`, `createOver`). Single-player games with a profile only. The block is **not** shown in hot-seat matches (profiles are not seats), and its challenge-game behaviour is an open question (section 13, Q4).

### 3.1 The block (mocks I, J, L)
It is the **last section of the existing `end-card`** (below the stats grid, after a hairline). It is **not** a new card, so the screen keeps its structure and the button ladder (spec.md section 4.7, 1.1 of 0.5.1) does not change.
```
 ────────────────────────────────────────
 (avatar+rank badge)  מחנך/ת כיתה        +240 ניסיון     avatar 44 with a 20px rank glyph ring; title 16/800; gain 15/800 --career
                      ▬▬▬▬▬▬▬▬▬▬░░░░░░░░                  XP bar 8px; hatched = progress BEFORE this game, solid = after
                      סיום משחק 100 · הישג 20   [x2]      breakdown 12/400 muted + the x2 pill on a promo week
 ✓ הוותק נשמר לשבוע הזה                                    13/500: only on the first finished game of the week
```
- **Height:** 44 (avatar row) + 8 + 8 + 5 + 16 (breakdown) = about 92px, plus 10 above, plus the "kept" line (16 + 8) when present: **about 100 to 126px**.
- **Win at 360x800** (mock I): the hammock fox is 176px (was 250 at the max; the existing layout shrinks it by the fox height already). The end-card grows by about 110px. The v3.1 ladder below it is unchanged (gold 64, ghost row 56, text 48). Measured in the mock: it fits with about 40px of slack, so **the hammock height must follow `clamp()` on the remaining space** (the existing behaviour in `end.js`/CSS: the fox is the elastic element).
- **Game over** (mock J): the block is identical (finishing a game always gives XP). No gold-text title, no confetti.
- **At 320x568** (mock L): the hammock is 92px, the title 26, the tagline 13; the block shrinks to **the avatar row + bar only** (the breakdown line and the "kept" line are dropped, the gain stays), about 70px. The text button "שנו מצב או מקצוע" is already hidden at 320 in the 0.5.1 ladder; the mock hides it to make room, as in the v3.1 spec. **Open: the text button is dropped at 320 (section 13, Q7)**; the alternative is to scroll the card.
- **Junior:** the same block, kid words ("ניסיון" stays), no "ותק" line (nothing can be lost).
- **A new achievement** (learning achievements unlocked in this game): up to 2 rows **under the breakdown line**, each 40px, `achievement-earned` 20 in a 28px ring + the achievement title 13/700 + "+N", tappable (opens the profile on that achievement, 6.5). More than 2 collapse to "ועוד N הישגים". At 320 they fold into the breakdown line ("הישג 20"). *This row is not in the contact sheet; it uses the achievements grid cell's earned style (6.5).*
- **Accessibility:** the block is a `role="group"` named "ההתקדמות שלכם". The bar is a `progressbar` with `aria-valuetext` "92 אחוז לדרגה הבאה, 240 ניסיון נוספו". The result is announced once (`aria-live="polite"`) when the bar has settled, not during the animation.

### 3.2 Motion (the bar filling)
Start of the screen (the existing win: confetti + haptic win + the hammock drop-in, 500ms). The career block animates **after** that, so nothing competes:
1. **+700ms** (after the hammock lands): the block fades in with a 12px rise (`--dur-base`, `--ease-out`).
2. **+900ms:** "+240 ניסיון" counts up from 0 over `--dur-countup` (700ms, `--ease-out`, `tabular-nums`) while the **solid bar grows from its hatched start to its new value** at the same duration and easing. It fills from the inline-start (right in RTL).
3. If the bar reaches 100%: it holds 120ms, **resets to 0 and fills to the overflow** (a 2-stage fill, 250ms + 350ms), then the rank-up dialog opens at **+1700ms**.
4. Tapping anywhere during steps 2 to 3 **skips to the end state** (the number, the bar, the dialog).
- **Reduced motion:** no rise, no count-up, no fill: the end state appears with a 120ms fade; the dialog opens with a 120ms fade after a 300ms pause.
- **Haptics:** none for the fill (the win haptic already played). A rank-up gives **one** `win`-style pattern `[20,40,20,40,60]` only on a **win** screen; on a game-over screen the rank-up gives a single `tap` (a rank earned after a loss is good news, but the screen is not a party).

### 3.3 The rank-up dialog (mocks K, L2)
A **level-1 modal dialog** over the end screen (existing modal pattern: `--scrim` .88, opaque `--surface`, radius 28). Maxi celebrates, reusing the existing art.
```
        [ fox/celebrate.webp 168px, glow halo ]         the existing 512px art, shown at 168 (112 at 320). Never re-drawn, never cropped.
              עליתם דרגה                                15/700 --career
              רכז/ת שכבה                                the NEW title, 30/900 --text (24 at 320), 1 line, ellipsis
        ( ⌃⌃⌃ ) — ( ⌃⌃ ) — ( ⌃ ) — ( • )                the ladder: 4 36px rings; done = --career ring, now = tint + 2px ring, next = dashed
   מהמשחק הבא אפשר להתחיל כאן: משכורת גבוהה יותר,
   וגם הוצאות ויעד גבוהים יותר. אתגר חדש, לא משחק קל יותר.     15/400 muted. THE HONEST LINE: always present
        [        מעולה        ]                          gold primary, 64 (56 at 320): the only gold
```
- **The ladder** is in logical order: rank 1 at the inline-start. It does not point anywhere, so it is not mirrored beyond the order.
- **No confetti** in the dialog on a win (the win screen already played it, and two bursts in 2 seconds read as noise); on a game over there is none either. The only extra effect is a **gold glint** passing over the fox's glasses (the existing `.glint`) and the halo (`--glow-fox`) at .16 opacity (the dark theme) or .38 (light), as on the win screen.
- **Entrance:** the dialog uses the standard sheet entrance (`--dur-base`, `--ease-out`); the fox scales .92 to 1 with `--ease-bounce` over `--dur-slow` (400ms); the title fades in 80ms later; the current ring on the ladder pops (scale .8 to 1, `--ease-bounce`, 320ms). Reduced motion: 120ms fades.
- **Several ranks at once** (rare: a big achievement bonus): one dialog, the ladder shows the new rank; the text says "דרגה N", never a list.
- **Junior wording** (L2): short, no "אתגר חדש" implication of loss; the educator's key `career.rankUp.textJunior`.
- **Focus:** lands on the primary. `Esc` / the scrim do not dismiss it (a rank-up is a moment, not noise); the primary closes it.
- **After the dialog:** the career block stays on the screen with the new title and a fresh bar.

---

## 4. Return after absence (mocks M, N, O, P)
A **full screen** shown once when the app opens and the engine finds that a seniority loss or a junior wait has been applied since the last visit. It replaces home for that launch, the same way the 0.5.1 challenge intro does. It is shown **once per event**: the player closes it and it is marked as seen.

### 4.1 Anatomy at 360x800 (mocks M, N)
```
 (X)                                                       top bar 58: close = ghost 48 -> home
              [ fox/wave@2x.webp 132px ]                    Maxi waves: warm, never tired. One fox on the screen.
                   טוב שחזרתם                                title 26/800 --text, centred. (junior: הקריירה חיכתה לכם)
   עבר שבוע שלם בלי משחק שהסתיים, ולכן ההתקדמות ...        16/400 --text, plain: what happened. 3 lines max
 ┌────────────────────────────────────────────┐             list card --surface, 1px --border, radius 22, rows >= 64
 │ (head) מורה     ⌃⌃ רכז/ת שכבה                │             a row per profession that CHANGED (max 3 rows shown)
 │               ▬▬▬▬▬ (hatched = before)       │               reset: the bar at 0 with the old value hatched, + "ההתקדמות התאפסה"
 │ (head) מהנדס/ת  ...                          │               drop: struck-through old rank  ->  new rank
 └────────────────────────────────────────────┘
        ועוד 2 מקצועות                                       13/400 muted: only when more than 3 changed
   ✓ הדרגות עצמן נשארו כמו שהיו.                              14/700, check in --income: what was KEPT (reset) / the titles kept (drop)
 ───────── pinned footer ─────────
   (seniority) משחק אחד בשבוע שומר על הוותק.                  13/500 muted: the rule, forward-looking, never "you should have"
 [          שחקו עכשיו  (gold 64)          ]                  the ONE button. Starts the profession pick in the last used mode
```
- **Tone, stated once:** facts in the order *what happened, what you still have, what keeps it*. No apology, no blame, no exclamation marks, no emoji. The sentences are the educator's; the structure is fixed.
- **Which variant:**
  | Variant | When | Content |
  |---|---|---|
  | **Reset** (mock M) | one full week with no finished game | "the progress bar to the next rank was reset in every profession". Rows show the professions that had progress to lose (hatched old value, empty new bar). Professions with no progress are not listed. |
  | **Drop** (mocks N, O) | two weeks in a row | "every profession dropped one rank, and the progress bar was reset". Rows: struck-through old rank, then the new one (a chevron `icon-dir`, mirrored). Rank 0 professions don't appear (nothing to drop). Below the list: "titles you reached stay in your profile" with a check. |
  | **Junior** (mock P) | a junior profile after any absence | **"הקריירה חיכתה לכם"**: "you did not play for a while, and everything stayed exactly as you left it." The list shows up to 2 of the professions in progress with their normal (non-hatched) bars. There is **no** loss row, no struck-through title, no rule line, no icon with a calendar. |
- **A longer absence** (3 or more weeks) uses the Drop variant; if the engine applies more than one drop per profession, the row shows `old -> new` with the final rank, and the sentence says "כל מקצוע ירד כמה דרגות" (the educator decides, Q2).
- **The button "שחקו עכשיו"** starts the profession pick (the family or full mode as last used), so it is one tap from the screen to a game. The X goes to home. Both mark the event as seen. There is **no** secondary button, no "learn more", no streak sell. (The rule line above the button is the explanation; the profile has the full rule.)
- **320x568** (mocks O, P): the fox is 72px, the title 22, the body 14; the list **scrolls inside** the content region and the footer is pinned (56px primary); the rule line drops under 600px. At 320 a list of 3 rows (56px each) plus the heading is about 250px, so the list scrolls only with 3 or more rows.
- **Light theme** (mocks N, P): the surface is white, the struck-through old rank is `--text-muted` with `line-through` (the strike is not the only cue: the arrow and the new rank follow it).
- **Motion:** the fox rises 24px over `--dur-slow`; the list fades in 80ms after the title. The bars in the reset variant do **not** animate: the reset has already happened, and a bar that visibly drains is exactly the guilt effect this spec avoids, so they appear in their final state. Reduced motion: 120ms fades.
- **Haptics:** none. **Sound:** none.
- **Focus:** on the `h1` (`tabindex="-1"`). The live region reads the title and the first sentence.
- **RTL:** the list rows put the avatar at the inline-start; the arrow between old and new rank is a mirrored chevron (`icon-dir`), so it points from the old (right) to the new (left); numbers are isolated.

---

## 5. In-game promotion card (mocks Q, R, S)
A **decision card** (existing pattern: `src/ui/decision.js` + `cardShell`): the same cream paper, the same chip row, the same stacked option buttons. It opens **once per game, on a payday**, after the payday summary closes and before the next roll. It is a level-1 modal; there is no second level.

### 5.1 Anatomy at 360x800 (mock Q)
```
 ┌─ (3px --asset edge on top, like the other cards) ───────┐
 │ [ ⛁ משכורת ]   קידום בעבודה                              │   tile chip (the payday tile, gain family) + kicker 13/500 --card-muted
 │ קיבלתם קידום                                             │   title 26/900 (22 at 320). Junior: "קיבלתם קידום!"
 │ המשכורת עולה ב-₪1,650 בחודש. מה עושים עם התוספת?          │   16/400 --card-muted, 3 lines max
 │ מה בוחרים?                                               │   existing "מה בוחרים?" 14/700 muted
 │ ┌ ממשיכים לחיות כמו קודם ───────────────────────────┐   │   option row, white tile, 1px --card-border, radius 16
 │ │ מזומן  בלי שינוי          בחודש  +₪1,650            │   │   the existing dec-nums pattern: cash, monthly
 │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (all green)        │   │   NEW raise bar: 10px, one segment
 │ │ ■ כל התוספת נשארת לכם                               │   │   legend 12/500
 │ └─────────────────────────────────────────────────────┘   │
 │ ┌ משדרגים את רמת החיים ──────────────────────────────┐   │
 │ │ מזומן  +₪3,500        בחודש  +₪350                  │   │
 │ │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨ ▬▬▬▬▬ (hatched | green)       │   │   hatched = new monthly expense (79%), green = what stays (21%)
 │ │ ■ נשאר לכם ₪350      ▨ הוצאה חדשה ₪1,300             │   │   legend names both
 │ └─────────────────────────────────────────────────────┘   │
 │ מה זה מלמד: כשההכנסה עולה, קל להעלות גם את ההוצאות ...     │   existing "teaches" banner
 ├───────────── pinned actions ───────────────────────────────┤
 │ [   ממשיכים לחיות כמו קודם   ]  56                          │   two stacked ghost buttons, EQUAL weight
 │ [   משדרגים את רמת החיים    ]  56                          │
 └────────────────────────────────────────────────────────────┘
```
- **Same pattern as `decision.js`:** the tile chip, "מה בוחרים?", rows with the cash / monthly numbers, the "מה זה מלמד" banner, stacked secondary buttons, all numbers from an engine dry run (`optionDelta`). New: the **raise bar** inside each row.
- **Two equal options, no gold primary.** A decision card never has a primary: the player is choosing, and neither option may be nudged. Both buttons are ghost 56px (48 at 320). Order: **keep first** (the same as the engine's free option), upgrade second.
- **The raise bar** is one 10px bar per option, radius 5, that shows **where the raise goes**:
  - **Keep:** one solid segment (`#0B6B43` on the cream card, the card's income ink), 100%, legend "כל התוספת נשארת לכם".
  - **Upgrade:** two segments side by side with a 2px gap: the **new expense** is **hatched** (45-degree stripes, 3px) with an edge of 1.5px in `--negative-ink` (full mode, #B42318) or amber-ink #6E4200 (family and junior); the **remainder** is solid green. The legend names both with their `money()` amounts and a swatch that repeats the pattern. The hatching and the words carry the meaning, so colour is not the only cue (it passes 3:1 on white in both themes, section 11).
  - Widths are proportional to the amounts (79% / 21% in the example). The bar fills from the inline-start, so the first segment is the right side in RTL.
- **Numbers:**
  - **Full:** the raise, the expense it brings, the one-time cash perk. The engine decides the amounts (the mock uses 1,650 / 1,300 / 3,500; "most of the raise becomes a new monthly expense", as the owner decided).
  - **Family:** rounder amounts (1,500 / 1,200 / 3,000) and the amber hatch (`--expense` in family mode is amber: no red anywhere).
  - **Junior (mock S):** coins (`coinScale()`), the numbers are under 100 coins (15 / 12 / 30), the labels are the kid wording ("חיים כמו קודם", "קונים דברים חדשים"), and "קיבלתם קידום!" has the exclamation mark.
- **After the choice** (the toast/fox line): the fox gives **one neutral line for either choice** (the educator's keys `career.promo.fox.keep` / `.upgrade`), e.g. a fact about what each did, never praise and never a warning. The statement shows the new salary row with a count-up of the changed numbers (`--dur-countup`).
- **Motion:** the same card flip-in as the other decision cards (existing); the two bars **grow from the inline-start over `--dur-slow` (400ms, `--ease-out`), 80ms apart**, once, when the card has opened. No coin burst on either choice (a burst on the upgrade would be a reward for the choice the lesson is questioning; the cash perk simply counts up). Reduced motion: bars set at once.
- **Haptics:** `tap` (10ms) for both choices. Neither gets the purchase pattern.
- **Buttons at 320x568** (mock R): the card is 20px from the screen top and 10px from the sides; the content scrolls over the pinned buttons (48px each, the same gradient fade at the top of the footer); the "מה זה מלמד" banner is the part that scrolls out of view first, so it is last in the DOM order of the scroll area, and a chevron hint (the existing one in the screenshots) shows it is cut.
- **Light theme:** the card is cream in both themes (existing `--card-*` tokens), so nothing changes.
- **Accessibility:** each option is a `<li>` with a button below; the raise bar is `aria-hidden` and the legend text is read; `aria-describedby` links the button to its row. Focus starts on the first option's button (not the "keep" as a default: there is no default; the card has no `data-autofocus` so a screen reader starts at the title).

---

## 6. Profiles
Up to **4 profiles** on a device. A profile has: a name (the existing `NAME_MAX`), an age band (up to 10, 11 to 13, 14+), and a favourite fox (one of the eight existing profession heads). It holds the career (ranks, XP, seniority week, achievements). It is **not** a seat in hot-seat and carries no competition between profiles.

### 6.1 When profiles appear
- **First launch:** no profile, no chip, no picker. Play is unchanged; the first finished game offers "שמרו את ההתקדמות" (the career block with a quiet text button "יצירת פרופיל", 48px). **No profile, no career loss:** a device without a profile has no age band, so the safe reading is junior: nothing is lost, the career only waits (Q1).
- **One profile:** no picker, home shows its chip.
- **Two or more profiles:** a **picker** opens on launch (the "who plays?" screen, 6.2); the chosen profile stays until another is chosen from the profile sheet ("החלפת פרופיל").

### 6.2 The picker (mocks T, U)
Full screen, 2-column grid of **tiles** (72px head, name 18/800, a meta line with the age band and the rank glyph of the highest-ranked profession), 160px high (136 at 320); the last tile is "פרופיל חדש" (a dashed outline, a 72px plus circle, "עד 4 במכשיר"), hidden at 4 profiles.
- **Selected tile:** 2px `--sel-ring` and a 24px check disc at the inline-end top (not colour only).
- **Tap** selects and goes home (one tap, no confirm). **Top bar:** the title "מי משחק?", the close X (48px).
- **"פרופיל חדש"** opens the edit sheet (6.4) in create mode. A **fine line** under the grid: "הפרופילים נשמרים רק במכשיר הזה."
- **At 320:** tiles 136 high, heads 56; 2 rows fit without scrolling (4 tiles).
- **Motion:** tiles rise 12px and fade in, 40ms stagger (`--dur-base`); selection pops the check (scale .6 to 1, `--ease-bounce`, 180ms). Reduced motion: fades. Haptic `tap`.

### 6.3 The profile screen (mocks V, W, Z)
A full screen opened from the home chip (back arrow in the top bar is a mirrored `arrow`; the title "הפרופיל"; a text button "עריכה" (48px) at the inline-end).
Order of sections: **header, seniority card, ranks, achievements.**
1. **Header:** the 64px head, the name 24/800, two chips (age band; the games count with the coin: "12 משחקים", which moved off home).
2. **Seniority card** (the full rule, in plain words, with a week strip):
   - Top row: `seniority` icon 20 + "ותק" 17/800, and a status chip: "נשמר השבוע" with a check (normal), or the amber "נשארו 3 ימים לשמור על הוותק" (warning, mock W).
   - **Week strip:** 7 cells, "א ב ג ד ה ו ש" (Sunday first, at the inline-start, so the right in RTL), 32px tall, radius 10. Past days are `--surface-2`; **today** has a 2px `--sel-ring`; the day a game was finished has a check, a `--career-tint` fill and a `--career` border (mock V shows Tuesday). In the warning state none has a check.
   - **The rule**, 13/400 muted, 3 to 4 lines: one finished game a week keeps everything; a week without one resets the progress bar to the next rank; two weeks in a row, every profession drops one rank; titles reached stay here. The educator's exact words.
   - **Junior (mock Z):** the card says "ותק" with the `seniority-wait` icon and one sentence, "אצלכם שום דבר לא הולך לאיבוד. הקריירה תמיד מחכה לכם." No strip, no rule, no chips.
3. **Ranks:** a list card with a row per profession (the head 40, the name, **four pips** (the rank glyphs 22px in rings; **reached = `--career` ring, titles once reached but now lost to a drop = a dashed `--border-strong` ring and the line "הגעתם בעבר: {title}"**, not reached = a faint dashed ring), the current title with its glyph, the XP bar 4px). 64px rows. At 360 four rows are visible, the rest scroll with the page; a profession never played is the last, with empty pips and no bar.
   - **History is permanent:** a lost rank stays visible as a dashed pip with the title it was. It is information, not shame, so it is `--text-muted` and it does not have an icon of its own.
4. **Achievements** (6.5).
- **The bottom** has a text button "החלפת פרופיל" (48px) when there are two or more profiles.
- **Scroll:** the screen is a scrolling page (one column, 16px gutters). The seniority card is first because it is the live state; the achievements grid is last because it is the longest.
- **Motion:** XP bars fill on entry (`--dur-countup`, 40ms stagger, first 4 only); the check in the week strip pops (180ms). Reduced motion: none.

### 6.4 The edit sheet (mock X)
A level-1 bottom sheet (existing sheet pattern, 28px top radius, handle, a 48px close), up to 94% high; the form scrolls under a pinned footer.
```
 עריכת פרופיל                                       [X]
 שם          ┌ נועה                        4/12 ┐        input 56px (52 at 320), 1.5px --btn-secondary-border, radius 14, 17/500, counter 12 muted
             השם נשמר רק במכשיר הזה                      hint 12 muted
 גיל         [14+] [11–13] [עד 10]                      3 radio chips, 52px (48 at 320), same pattern as the age chips in players.js
 השועל שלי   ▢▢▢▢                                       4x2 grid of the 8 profession heads, 60px cells (54 at 320), radio group,
             ▢▢▢▢                                       selected = 2px --sel-ring + an 18px check disc
 [         שמירה (gold 64)         ]                    pinned
        מחיקת הפרופיל  (text 48)                        opens a confirm dialog (level 2): danger variant, says progress will be erased
```
- **Age chips:** the order follows `AGE_BANDS` (the same as the players screen: "עד 10", "11–13", "14+", in the reading direction). Choosing a band under 14 suggests family mode, as today (existing behaviour in `players.js`).
- **The fox grid is a radio group** of images with `aria-label` = the profession name. The "favourite fox" is an avatar only; it does not affect the game.
- **Create mode:** the title is "פרופיל חדש"; the primary is "שמירה"; there is no delete button.
- **Delete** is the only level-2 dialog here: "למחוק את הפרופיל של נועה? הדרגות וההישגים יימחקו." with a danger button (existing `--btn-danger-*`) and a ghost "ביטול". It is never the default focus.
- **Age edits and a junior profile:** see Q6.

### 6.5 Achievements grid and detail (mocks V, W, Y)
- **Grid:** 3 columns, 8px gap, each cell a `<button>` at least 104px tall: a **48px round medal** + the title 12/500, up to 2 lines.
  - **Earned:** `achievement-earned` (a medal with a check) in `--career`, a `--career-tint` disc with a 1px `--career` ring, the title in `--text`.
  - **Locked:** `achievement-locked` (a padlock) in `--text-muted`, a **dashed** `--border-strong` ring, a transparent cell, the title in `--text-muted`. It is announced "{title}, עוד לא הושג".
  - The section header shows "5 מתוך 12" (tabular). Earned ones sort first (a stable order inside each group).
- **Tap** opens the **detail sheet** (mock Y, level 1): a 72px medal, the title 22/800, a 2-line explanation of what the achievement teaches and how to earn it (the educator), two chips ("עוד לא הושג" or "הושג ב-12.10", and "+40 ניסיון"), and a ghost "סגירה". Locked achievements are **never secret**: the how is always shown. No gold, no fox (the sheet is read-only).
- **Earning in a game:** shown in the end block (3.1) and, **during** the game, as the existing fox reaction toast, never as a modal. A new achievement never interrupts a roll.
- **Motion:** a new medal in the grid, when the profile is opened right after earning it, pops once (scale .8 to 1, `--ease-bounce`, 320ms) with a glint. Reduced motion: none.

---

## 7. Junior (up to 10): the whole feature in one table
| Surface | Junior treatment |
|---|---|
| Pick (1) | Same card, rank row and XP bar. Amounts in coins. No seniority warning line. The promo-week strip stays (it is a bonus, not a threat). |
| Home chip (2) | avatar + the name; **never** "ותק", days or amber. Compact: the avatar with no badge. |
| End block (3) | The same, **no** "הוותק נשמר" line. Rank-up wording is the junior key. |
| Return (4) | "הקריירה חיכתה לכם": nothing was lost, the bars are normal, no rule line, no calendar icon. |
| Promotion (5) | Coins, round numbers under 100, kid wording, "קיבלתם קידום!". Amber, never red. |
| Profile (6.3) | The seniority card is the `seniority-wait` card with one sentence. |
| Numbers | Every amount through `money()` / `coinScale()`. The career surfaces show no number over 999 (XP counts are 3 digits at most; rank, days and percentages are 2 digits). |
| Honesty | The junior wording never says "you can't lose" as a promise that might change; it says "אצלכם הקריירה מחכה" (it waits). |

---

## 8. Layout summary
| Element | 360x800 | 320x568 |
|---|---|---|
| Pick card | +34px (rank row + bar) | same; card 138px wide, title ellipsis |
| Pick sheet | rank block ~190px; CTA pinned | scrolls; chips 52, fox 64 |
| Home chip | pill 104x48 (avatar + label or amber capsule) | avatar 48x48 + 20px badge |
| Home warning sentence | 20px, in the hero slack | not shown (< 700px tall) |
| End block | ~100 to 126px inside the end-card; ladder unchanged | ~70px (avatar row + bar); breakdown dropped |
| Rank-up dialog | fox 168, title 30, primary 64 | fox 112, title 24, primary 56 |
| Return screen | fox 132, list ~3 rows, primary 64 | fox 72, list scrolls, primary 56 |
| Promotion card | fits, buttons 56 | the card scrolls over pinned 48px buttons |
| Picker | 2x2 tiles of 160 | 2x2 tiles of 136 |
| Profile | scrolling page | same; 1 column |
No horizontal scroll anywhere: every grid cell has `min-inline-size: 0`, titles ellipsize, amounts are `white-space: nowrap`. The mock renderer fails its run if any frame has horizontal overflow (it reports "none").

---

## 9. Tokens and icons
### 9.1 New tokens (paste into `src/styles/tokens.css`; the developer owns that file, I did not edit it)
```css
/* 0.5.0 career (docs/v050/design/career-spec.md section 9; contrast: docs/v050/design/contrast-v050.py, 62 pairs pass) */
:root {
  --career: #F59A5B;                         /* rank glyphs, "+XP" text, x2 marker, kicker: 8.2 bg, 7.3 surface, 6.3 surface-2 */
  --career-fill: #E8702A;                    /* the XP bar fill (non-text): 3.8 on its track on surface */
  --career-tint: rgb(245 154 91 / .14);      /* x2 pill, promo banner, played day, earned medal (text on it: --career 5.7, --text 11.5) */
}
:root[data-theme="light"] {
  --career: #A84E0B;                         /* 5.1 bg, 5.6 surface (the existing --cat-leisure-ink) */
  --career-fill: #C2571A;                    /* 3.4 on its track on white */
  --career-tint: rgb(168 78 11 / .10);       /* --career on it 4.8 */
}
/* family / junior: no override (orange is not red). Reduced motion: the existing duration tokens cover everything. */
```
- **Reused, not new:** `--amber-ink` and `--amber-fill` (the warning), `--meter-track` (the bar track), `--sel-ring`, `--border-strong`, `--btn-secondary-border`, `--text-muted`, the `--card-*` tokens (the promotion card), `--dur-countup`, `--dur-slow`, `--dur-base`, `--ease-out`, `--ease-bounce`.
- **No new duration tokens.** Mapping: bar fill and count-up `--dur-countup` (700ms); entrances `--dur-base` (250ms); the fox pop `--dur-slow`; press `--dur-press`. Reduced motion collapses them to 1ms or 120ms, as in `tokens.css`.
- **Hatch** (`xp.before`, the spend segment): `repeating-linear-gradient(135deg, <color> 0 2px, transparent 2px 5px)`; it is a background, not an image.

### 9.2 Icons (`src/assets/career/`, 24x24, `stroke="currentColor"`, width 2, round caps and joins, the same family as `src/assets/tile/` and `challenge/`)
| File | Meaning | Mirror in RTL? |
|---|---|---|
| `rank-0.svg` | rank 1: a ring (a dot) | no |
| `rank-1.svg` | rank 2: one chevron up | no (it points up) |
| `rank-2.svg` | rank 3: two chevrons | no |
| `rank-3.svg` | rank 4: three chevrons | no |
| `seniority.svg` | a calendar with a check: this week is kept | no |
| `seniority-due.svg` | a calendar with a clock hand: time left this week (the warning) | no |
| `seniority-wait.svg` | a calendar with two pause bars: junior, the career waits | no |
| `promo-week.svg` | an arrow up with two sparkles: double XP week | no |
| `achievement-earned.svg` | a medal on a ribbon with a check | no |
| `achievement-locked.svg` | a padlock | no |
- **Add them to the `PATHS` map in `src/ui/icons.js`** (inline, no requests), names `rank0`..`rank3`, `seniority`, `seniorityDue`, `seniorityWait`, `promoWeek`, `achievementEarned`, `achievementLocked`. The mock renderer reads the files directly.
- All are `aria-hidden` and decorative; a visible label or an `aria-label` always goes with them.
- **Rank chevrons point up**, not toward the reading direction, so there is no mirroring. The ladder order (rank 1 first) follows the reading direction through normal flex flow.

### 9.3 Components
- **XP bar `.xp`:** 4px (8px `lg`), radius 2 / 4, track `--meter-track`, fill `--career-fill`, fills from the inline-start. `.xp u` is the hatched "before" layer under the fill. `role="progressbar"`, `aria-valuemin=0 aria-valuemax=100 aria-valuenow`, `aria-valuetext` in words.
- **Rank label `.rk`:** inline-flex, a 14px glyph in `--career`, the title 12/700 `--text`, ellipsis.
- **x2 pill `.x2`:** 18px tall (22 on the card), radius 9, `--career-tint` fill (or `--surface` with a `--career` ring on the art well), the 12px `promo-week` icon + "x2" in `<bdi dir="ltr">`, 11/700 `--career`.
- **Seniority pill `.cchip`:** 48px, radius 24, `--glass-bg`, 1px `--border`; the compact variant is 48x48 with a 20px badge.
- **Raise bar `.rbar`:** 10px, radius 5, two segments with a 2px gap; the hatched segment has an inset 1.5px edge.

---

## 10. Copy: every string in one table (placeholder; the educator replaces the words)
Keys go under `career.*` and `profile.*` in `src/i18n/he.json` (the educator may move them into a lazy file like the 0.5.1 `challenge.*` strings; four keys must stay eager because home uses them: `career.chip.aria`, `career.chip.warnDays` (the 3 plural forms), `career.chip.label`, `career.chip.junior`). Plural forms use the existing `tp()` with one / two / other. Family and junior overrides use the existing `Family` / `Junior` suffix rule.

| Key | Placeholder (Hebrew) | Where |
|---|---|---|
| `career.rank.word` | דרגה {n} | rank chips (pick sheet) |
| `career.rank.<prof>.0` to `.3` | the 32 titles. Mocks use: מורה / מחנך/ת כיתה / רכז/ת שכבה / מנהל/ת בית ספר, and the same pattern for the other seven | **the educator**; at most 16 characters each, no niqqud |
| `career.rank.highest` | הדרגה הגבוהה ביותר | pick sheet, profile |
| `career.xp.label` | ניסיון | everywhere "+N ניסיון" |
| `career.xp.toNext` | עוד {n} ניסיון ל{title} | pick sheet |
| `career.xp.aria` | {pct} אחוז לדרגה הבאה | progressbar valuetext |
| `career.promoWeek.strip` | שבוע קידום: {profession} · ניסיון כפול | pick strip |
| `career.promoWeek.banner` | שבוע קידום ל{profession}. השבוע כל משחק במקצוע הזה נותן ניסיון כפול. | pick sheet |
| `career.promoWeek.x2` | x2 | the pill (aria: "ניסיון כפול") |
| `career.pick.startRank` | דרגת פתיחה | pick sheet |
| `career.pick.yours` | הדרגה שלכם | pick sheet, current rank |
| `career.pick.lower` | שיחקתם כבר בדרגה גבוהה יותר | pick sheet, a lower one chosen |
| `career.pick.harder` | דרגה גבוהה היא התחלה קשה יותר: משכורת גבוהה יותר, וגם הוצאות ויעד גבוהים יותר. | pick sheet, always |
| `career.pick.lockedHint` | דרגות גבוהות יותר נפתחות בהתקדמות. | pick sheet |
| `career.pick.locked` | נעולה | chip aria |
| `career.chip.label` | ותק | home pill |
| `career.chip.warnDays` | one: נשאר יום אחד לשמור על הוותק / two: נשארו יומיים לשמור על הוותק / other: נשארו {n} ימים לשמור על הוותק | home line, aria, pick, profile |
| `career.chip.warnShort` | one: יום / two: יומיים / other: {n} ימים | the amber capsule ("3 ימים") |
| `career.chip.aria` | הפרופיל של {name} | chip aria-label (plus the warning sentence) |
| `career.chip.junior` | {name} | junior pill |
| `career.end.group` | ההתקדמות שלכם | end block aria |
| `career.end.gain` | +{n} ניסיון | end block |
| `career.end.parts` | סיום משחק {a} · הישג {b} | breakdown |
| `career.end.kept` | הוותק נשמר לשבוע הזה | first finished game of the week |
| `career.end.moreAch` | ועוד {n} הישגים | end block |
| `career.end.createProfile` | יצירת פרופיל | no profile yet |
| `career.rankUp.kicker` | עליתם דרגה | rank-up dialog |
| `career.rankUp.text` | מהמשחק הבא אפשר להתחיל כאן: משכורת גבוהה יותר, וגם הוצאות ויעד גבוהים יותר. אתגר חדש, לא משחק קל יותר. | rank-up |
| `career.rankUp.textJunior` | בדרגה החדשה מתחילים עם משכורת גדולה יותר, וגם עם יותר הוצאות. אתגר חדש! | rank-up, junior |
| `career.rankUp.ok` | מעולה | rank-up button |
| `career.back.title` | טוב שחזרתם | return, reset and drop |
| `career.back.titleJunior` | הקריירה חיכתה לכם | return, junior |
| `career.back.reset` | עבר שבוע שלם בלי משחק שהסתיים, ולכן ההתקדמות לדרגה הבאה התאפסה בכל המקצועות. | return, reset |
| `career.back.resetKept` | הדרגות עצמן נשארו כמו שהיו. | return, reset |
| `career.back.drop` | עברו שבועיים בלי משחק שהסתיים, ולכן כל מקצוע ירד דרגה אחת, וההתקדמות התאפסה. | return, drop |
| `career.back.dropKept` | התארים שהשגתם נשארים בפרופיל שלכם. | return, drop |
| `career.back.junior` | לא שיחקתם כמה זמן, והכול נשאר בדיוק כמו שהשארתם. | return, junior |
| `career.back.progressReset` | ההתקדמות התאפסה | reset row |
| `career.back.more` | ועוד {n} מקצועות | list overflow |
| `career.back.rule` | משחק אחד בשבוע שומר על הוותק. | footer |
| `career.back.play` | שחקו עכשיו | button |
| `career.back.playJunior` | בואו נשחק | button, junior |
| `career.promo.kicker` | קידום בעבודה | promotion card |
| `career.promo.title` | קיבלתם קידום | promotion card (junior: with "!") |
| `career.promo.text` | המשכורת עולה ב-{raise} בחודש. מה עושים עם התוספת? | promotion card |
| `career.promo.keep` | ממשיכים לחיות כמו קודם | option (junior: חיים כמו קודם) |
| `career.promo.upgrade` | משדרגים את רמת החיים | option (junior: קונים דברים חדשים) |
| `career.promo.legendKeep` | כל התוספת נשארת לכם | raise bar legend |
| `career.promo.legendStays` | נשאר לכם {amount} | raise bar legend |
| `career.promo.legendNew` | הוצאה חדשה {amount} | raise bar legend |
| `career.promo.teaches` | כשההכנסה עולה, קל להעלות גם את ההוצאות. מה שנשאר בכיס בכל חודש הוא מה שקונה נכסים. | "מה זה מלמד" |
| `career.promo.fox.keep` / `.upgrade` | two neutral one-line facts (educator) | fox line after the choice |
| `profile.picker.title` | מי משחק? | picker |
| `profile.picker.add` | פרופיל חדש | picker tile |
| `profile.picker.max` | עד 4 במכשיר | picker tile |
| `profile.picker.privacy` | הפרופילים נשמרים רק במכשיר הזה. | picker |
| `profile.title` | הפרופיל | profile screen |
| `profile.edit` | עריכה | profile top bar |
| `profile.switch` | החלפת פרופיל | profile bottom |
| `profile.games` | {n} משחקים | profile chip (existing plural keys) |
| `profile.sen.title` | ותק | seniority card |
| `profile.sen.kept` | נשמר השבוע | status chip |
| `profile.sen.rule` | משחק אחד שמסתיים בכל שבוע (ראשון עד שבת) שומר על הכול. שבוע בלי משחק: ההתקדמות לדרגה הבאה מתאפסת. שבועיים ברצף: כל מקצוע יורד דרגה אחת. מה שהשגתם נשאר בפרופיל. | seniority card |
| `profile.sen.junior` | אצלכם שום דבר לא הולך לאיבוד. הקריירה תמיד מחכה לכם. | junior card |
| `profile.week.days` | א ב ג ד ה ו ש | week strip (aria: the day names) |
| `profile.ranks.title` / `.count` | דרגות / {n} מקצועות | ranks section |
| `profile.ranks.past` | הגעתם בעבר: {title} | a lost rank (history) |
| `profile.ach.title` / `.count` | הישגים / {a} מתוך {b} | achievements |
| `profile.ach.locked` | עוד לא הושג | locked chip / aria |
| `profile.ach.earnedOn` | הושג ב-{date} | detail chip |
| `profile.ach.xp` | +{n} ניסיון | detail chip |
| `profile.ach.<id>.title` / `.how` | the achievement titles (nine shown in the mock: עסקה ראשונה, ניצחון בלי הלוואה, 5 עסקאות פח זוהו, 25% חופש לפני תור 10, חוב יקר הוחזר קודם, החזר בפחות מ-8 שנים, תרומה ראשונה, 3 מקצועות שונים, קידום בלי שדרוג) and the two-line how | **the educator** |
| `profile.edit.title` / `.create` | עריכת פרופיל / פרופיל חדש | edit sheet |
| `profile.edit.name` | שם | field |
| `profile.edit.nameHint` | השם נשמר רק במכשיר הזה | hint |
| `profile.edit.age` | גיל | field (uses the existing `players.age*` keys for the chips) |
| `profile.edit.fox` | השועל שלי | field |
| `profile.edit.save` | שמירה | primary |
| `profile.edit.delete` | מחיקת הפרופיל | text button |
| `profile.delete.title` | למחוק את הפרופיל של {name}? | confirm dialog |
| `profile.delete.text` | הדרגות וההישגים יימחקו. | confirm dialog |
| `profile.delete.confirm` / `.cancel` | מחיקה / ביטול | confirm dialog buttons |

**Rule for every sentence about loss** (educator): say it in the past tense as a fact ("התאפסה", "ירד"), name what remains, finish with what keeps it. No second person blame ("לא שיחקתם"), no urgency words ("עכשיו!", "מהר", "אחרון"), no exclamation marks on loss screens.

---

## 11. Contrast (generated by `python3 docs/v050/design/contrast-v050.py --md`; 62 pairs, all pass)
| Pair | Dark | Light | Need |
|---|---|---|---|
| `--career` text/glyph on bg · surface · surface-2 | 8.2 · 7.3 · 6.3 | 5.1 · 5.6 · 5.3 | 4.5 |
| `--career` on `--career-tint` (x2 pill, played day) | 5.7 | 4.8 | 4.5 |
| `--text` / `--text-muted` on `--career-tint` (promo banner) | 11.5 / 6.0 | 15.5 / 7.2 | 4.5 |
| XP bar fill `--career-fill` on its track (non-text) | 3.8 | 3.4 | 3 |
| XP bar fill on surface / surface-2 (non-text) | 5.1 / 4.4 | 4.5 / 4.3 | 3 |
| Hatched "before" layer `--border-strong` on the track (non-text) | 4.0 | 3.3 | 3 |
| `--career` ring and promo outline on surface (non-text) | 7.3 | 5.6 | 3 |
| Dashed ring of locked / past items `--border-strong` on surface (non-text) | 5.4 | 4.4 | 3 |
| `--text-muted` on surface (locked medal) · on bg (locked label) | 7.7 · 8.7 | 8.3 · 7.6 | 4.5 |
| Warning: `--amber-ink` on `--amber-fill` (capsule) · on bg (sentence) | 7.7 · 12.5 | 7.2 · 7.8 | 4.5 |
| `--sel-ring` on surface (today, selected chip) (non-text) | 14.8 | 17.9 | 3 |
| Rank chip border `--btn-secondary-border` on surface-2 (non-text) | 3.9 | 4.2 | 3 |
| Promotion card (cream, both themes): ink / muted on cream | 16.6 / 7.1 | same | 4.5 |
| Promotion bars on white (non-text): keep `#0B6B43` · spend full `#B42318` · spend family `#6E4200` | 6.6 · 6.6 · 8.6 | same | 3 |
| Gold primary label | 9.4 | 9.4 | 4.5 |
(Values are copied from the script's output; run `python3 docs/v050/design/contrast-v050.py` for the full 62 pairs.) Add these rows to `scripts/contrast-check.py` when the screens ship.

---

## 12. Art and assets
- **No new raster art.** The mocks use: `profession-fox/*-head@2x.webp` (avatars), `profession-fox/*@2x.webp` (the pick cards, the sheet), `fox/wave@2x.webp` (return), `fox/celebrate.webp` (rank-up), `fox/hammock@2x.webp` and `fox/tired@2x.webp` (end screens, unchanged), `brand/maxifox-logo-alpha-2x.webp` (home).
- **Optional new pose** (for the user to generate if the CEO wants it; I did not write `needed.md` because nothing blocks the build): a **"promotion" pose**, Maxi tipping the jacket collar with a small gold star badge on the lapel, same proportions, glasses, jacket, line weight and lighting as the reference. It would replace `celebrate` in the rank-up dialog and give the promotion card a face. The spec works without it; `celebrate` is the fallback.
- **Favourite fox** uses the eight existing heads. A ninth, non-profession avatar (Maxi in his own navy jacket) would help a profile that does not want a profession fox; it is optional.

---

## 13. Decisions, conflicts and open questions for the CEO
1. **Q1, the age guard needs an age.** Loss mechanics must only run for a profile whose band is 11 to 13 or 14+. A device **without a profile**, or a profile with no band, must behave as junior (nothing lost). I recommend that the band is required when creating a profile. Without this, a young child who skipped the age question could lose a rank, which is exactly the case the CEO guard exists to prevent.
2. **Q2, long absences.** The owner's rule says "two weeks in a row: every profession drops one rank". What does week 4 do: a second drop, or nothing more? I designed the return screen to show the final rank, so either answer fits. I recommend a **floor of one drop per return** (never more than one rank lost per absence, however long), which is easier to explain and safer for the Families review.
3. **Q3, what counts as a "finished game".** I assumed a win **or** a game over counts (both show the career block, and a loss still teaches). A game quit from the menu should not count. Confirm.
4. **Q4, challenge games.** Does a 0.5.1 challenge game give XP and keep seniority? Recommend yes, with one toast on the compare screen ("+60 ניסיון · הוותק נשמר"), no career block (compare has no room). I did not mock it.
5. **Q5, Shabbat.** The week is Sunday to Saturday, and the warning counts Saturday as a day. A family that does not play on Shabbat effectively has until **Friday**, so "3 ימים" on Thursday is really 2 for them. Options: count only Sunday to Friday (a week ends Friday 23:59), or keep Saturday and accept it. This is a real fairness and reputation risk in the Israeli market, and it is the owner's call. I recommend ending the week on **Friday night for the warning count**, and leaving the reset at Saturday 23:59.
6. **Q6, age edits.** A player could set the age to "up to 10" to avoid a loss. The cost is low (it only keeps a career the player could otherwise lose), so I recommend allowing age edits freely. If a parent should lock it, that needs a PIN, which is out of 0.5.0.
7. **Q7, the 320x568 end screen.** The text button "שנו מצב או מקצוע" has to go (as in the mock), or the card has to scroll. I chose to hide it at 320 and keep one more tap through the menu. Reversible.
8. **Q8, XP when starting below your rank.** Recommend a smaller gain (half), so a player cannot farm easy games for XP. The pick sheet needs one more line then (`career.pick.lowerXp`, not in the table).
9. **Q9, the games chip moves off home** (2.1). The count is not lost (it moves to the profile), but it is a visible change to a screen the owner knows. Reversible: show both at >= 390 wide only.
10. **Q10, profile creation moment.** I recommend after the first finished game (the block has a quiet "יצירת פרופיל" button), not before it, so the first launch has no form. The first-launch flow is the developer's, so this needs the CEO's nod.

### What will not fit the Design Bar (honest list)
1. **The strong loss mechanic itself is the weakest point.** A top-chart casual game uses a gentle streak. A reset after a missed week, and a rank drop after two, is the loss-aversion mechanic that Google Play's Families policy and store reviewers look at closely, and it must never reach junior (it does not, here). It is also the hardest thing to make look friendly: the best I can do is calm words, no animation, no red, and a Maxi who waves. I recommend the CEO asks for a Families policy check before the store submission (this is a product risk, not a layout one).
2. **The end screen at 320x568 is full.** With the hammock fox, the stats, the career block and the button ladder, 320x568 has almost no slack. The mock fits by shrinking the fox to 92px and hiding the text button. A pose-free layout (no fox at 320 on the end screens) would be better, but it contradicts the v3.1 rule that the fox is on win and game over.
3. **The promotion card's raise bar is new and dense.** It is the one place where I add a chart inside the decision-card pattern. It fits at 360, but at 320 the card scrolls and the "מה זה מלמד" banner is below the fold. A shorter lesson text (educator) would help.
4. **The home chip trades a count for a profile.** At 360 there is no room for both; the compact avatar at 320 is a 48px photo-like circle with a 20px badge, which is small but readable. If the CEO wants the games count to stay on home, the only layout that fits is dropping the label, leaving a bare avatar.
5. **Achievements and rank titles are text-heavy by nature.** The grid is icon-led and the titles are 12px; with 12 or more achievements it is a long scroll. It is the right place for it (a profile), but it will not look like a store screenshot.
6. **No new Maxi pose for the promotion.** `celebrate` is a good fallback, but it is the same image the player sees on the win screen, so the rank-up is less special than it could be (Section 12).
