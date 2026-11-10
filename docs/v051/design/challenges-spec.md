# MaxiFox 0.5.1: friend challenges, design spec
Design only. The developer builds this from this file, the existing `src/styles/tokens.css`, `docs/v3/design/spec.md` (v3.1, "Navy & Gold, quiet edition"), `docs/v4/design/board-spec.md` §14 (full-screen board, slim HUD) and `design/fox-usage.md`. Scope comes from `docs/MaxiFox_v0.5_Plan.md` §4 and the 0.5.1 plan.

Reference size is **390x844**. Every screen also gives **360x800** and **320x568**, in dark and light, RTL Hebrew first, using logical properties only.

Companion files:
- `docs/v051/design/challenges-contact-sheet.png` has 13 mocks at CSS 1:1, rendered in Chromium with the real Rubik, tokens, profession foxes and icons:
  - A–D: the intro;
  - E–H: compare;
  - I–J: the HUD chip;
  - K: replay;
  - L–M: the family board.
- `docs/v051/design/render-mocks.mjs` regenerates the sheet (`node docs/v051/design/render-mocks.mjs` from the repo root).
- `docs/v051/design/contrast-v051.py` audits every new colour pair (45 pairs, all pass).
- New icons are in `src/assets/challenge/`: `challenge`, `verified`, `unverified`, `family-board`, `replay` and `split` (section 8.2).

> **Strings:** the educator's `docs/v051/challenge.he.json` (with `docs/v051/challenges-copy.md`) is the source of truth for every word. This spec gives the layout and refers to copy keys. Where the brief's working names differ from the committed copy, the copy wins and the mocks use it:
> - "אתגרו חבר" becomes `create.button` "שלחו אתגר";
> - "יוצאים לאתגר" becomes `intro.cta` "שחקו את האתגר" (junior: "בואו נשחק");
> - "שלחו תשובה" becomes `compare.btnReply` "שלחו את התוצאה שלכם";
> - "הטלה חוזרת" becomes "גלגול שוב".
>
> The layouts fit both versions of each label (section 12, item 1).

> The current QA screenshots are stale. `qa/screens/over-full-dark-360x800.png` and `r7-*`/`r8-*` predate v3.1 and the rename: they show the old orange sunburst, "פסיבו", a mouse mascot and the banned phrase "המרוץ ממשיך". This spec follows the v3.1 layout of win and game over (spec.md §4.7–4.8), which `qa/screens/v4-after/13-win-*` and `v3-after/13c-game-over-*` show. I recommend deleting the pre-rename images (section 12, item 7).

---

## 0. Rules for 0.5.1 (what follows from the design system)
1. **One gold primary per screen.** Gold fills only that button. The verified badge, the split highlight and the HUD chip are never gold.
2. **Almost no money on the challenge surfaces.**
   - The intro, HUD chip and family board show only turns, freedom % and counts.
   - Compare adds one quiet amount: the loan total under the loan count (`compare.loansValue`, full and family only). The takeaway line may also carry slot amounts.
   - The replay turn sheet carries the detail amounts.
   - Every amount goes through `money()`, so a junior viewer sees coins. Junior gets the loan count without the amount (section 7).
3. **One fox per screen.**
   - The intro shows the creator's **profession fox** (the bust from `profession-fox/`).
   - Compare shows **Maxi's crop** next to the takeaway.
   - The 44px heads on compare and the board are identity avatars, the same treatment as the HUD (`professions.md`), not the character.
   - The board, the replay and the error states have no fox.
4. **Not colour only.**
   - Verified is an icon plus the word "אומת". Not verified is a dashed outline, a different icon and "לא אומת".
   - A split is a tint, a 3px bar, the `split` icon and a sentence.
   - The better result is shown by a check icon and the colour together.
5. **Never accusing.** "לא אומת" is neutral grey, never red or amber, and the copy explains the link was damaged; it never says "cheating".
6. **Gender-neutral.** The link doesn't carry the creator's gender. The educator solved this in the copy with impersonal and passive forms ("נקנתה אצל נועה", "המסלול אצל נועה"), so no gender field is needed.
7. Targets are at least 48px and 8px apart. There is no horizontal scroll at any size. Every number is in a `<bdi dir="ltr">` or uses `numberText`.

---

## 1. The challenge button (`create.button` "שלחו אתגר"; brief: "אתגרו חבר") on the win and game-over screens

### 1.1 Hierarchy decision
| Screen | Primary (gold, 64) | Ghost row (2 × 56) | Text (48) | Removed |
|---|---|---|---|---|
| **Win** (single player, challenge-capable) | **שלחו אתגר** (icon `challenge` 24) | שחקו שוב · מה למדתי | שנו מצב או מקצוע | **"שתפו את התוצאה"** is merged into the challenge |
| **Game over** (single player, challenge-capable) | **ננסה שוב** (unchanged) | שלחו אתגר · מה למדתי | חזרה לתפריט | — |
| Win/over where a challenge is not possible | unchanged (v3.1 §1) | unchanged | unchanged | — |

**Why the challenge button is the primary on the win screen:**
- **It is the next step.** The win is the moment the player most wants to show off and the result is worth beating. 0.5.1 exists to turn that moment into a second player.
- **It replaces the plain share, it doesn't add to it.** The challenge message already contains the result line plus a link that lets the friend play the same game. A text-only share next to it would be two "share" actions that differ in a way users can't see, which breaks "one clear primary".
- **"שחקו שוב" is still one tap away** as a 56px ghost in the thumb zone, so the replay loop is not hurt.
- **The screen keeps the same button count:** one primary, two ghosts and one text button. So the height budget of spec.md §4.7 (320x568 included) does not change.

**Why game over keeps "ננסה שוב":**
- After a loss the supportive next step is to try again (spec.md §4.8: never mocking).
- A 41% result is a weaker invitation, so the challenge is offered but not pushed.
- It takes the place of the full-width ghost "מה למדתי", which now shares a row with it. The height is unchanged.

**When the button is hidden** (the developer owns the predicate, e.g. `canChallenge(match)`):
- hot-seat or bot matches;
- the daily challenge (it already has its own share and the same seed for everyone);
- missions, short missions and the guided first game;
- resumed `rngVersion: 1` games;
- games that `verifyResult` would refuse, such as auctions (RNG.md F5);
- a game that was itself a challenge, which ends on the compare screen (section 4).

When the button is hidden, the screen is exactly today's v3.1 layout, including "שתפו את התוצאה".

### 1.2 The challenge sheet (level 1, bottom sheet)
This is an opaque `--surface` sheet with a 28px top radius, a handle, and a ghost close icon of 48px. It opens with the standard sheet entrance (`--dur-base`, `--ease-out`; a fade only under reduced motion).
```
 create.sendTitle                              [X]
 החבר יקבל את אותו משחק בדיוק:                 15/400 muted
 אותן קוביות ואותם קלפים.
 ┌ השם שיופיע לחבר (לא חובה) ─────────────────┐  label 13/500 muted, input 56px, 1.5px --btn-secondary-border,
 │ נועה                                    4/16 │  radius 14, 17/500, maxlength 16, counter 12 muted
 └─────────────────────────────────────────────┘
 עד 16 תווים. מי שיקבל את הקישור יראה אותו        create.nameHint 12 muted
 ┌ preview ────────────────────────────────────┐  quiet: --surface-2, radius 14, 13/400 muted, max 3 lines
 │ אתגר מ-נועה: הגעתי לחופש כלכלי ב-23 תורות   │  = challenge.invite.winNamed (the exact text that is sent)
 │ (משחק משפחתי)… רוצים לנסות? maxifox…/#c=…   │
 └─────────────────────────────────────────────┘
 [  ⇪ שלחו קישור  (gold 64)  ]                    label proposal: `challenge.create.send` (not in the copy yet)
```
- **Name:** prefilled from the last name used, stored on the device (proposed key `passivo.challengeName`).
  - It is trimmed and sanitised (the engine sanitises it too).
  - It is empty by default the first time. An empty name gives the unnamed copy.
  - It must never be required.
- **Primary "שלחו קישור"** calls `shareText(text)` (daily.js:17). Outcomes:
  - `shared`: the sheet closes, and the toast "הקישור נשלח" appears.
  - `copied`: the sheet stays, a `role=status` line "הקישור הועתק. הדביקו אותו בוואטסאפ" appears, and the primary becomes ghost "סגירה". After the job is done the sheet has no gold.
  - `failed`: the end.js:54 fallback. A readonly textarea (3 rows) appears inside the sheet, selected, with the line "לא הצלחנו להעתיק. סמנו והעתיקו ידנית".
  - `cancelled`: nothing happens.
- On create, the challenge is written to `passivo.challenges` as `{role:'sent', seed, config, log, …}`. A reply link for the same seed and config then opens compare directly (2.4f).
- Haptic: a tap of 10ms on the primary. There is no success pattern, because the system share sheet is the feedback.
- At 320x568 the sheet is at most `90dvh`, the preview is clamped to 2 lines, and the primary is 56.

---

## 2. Challenge intro (app opened with `#c=`)
This is a screen, not a modal. A link opens the app fresh, so the intro replaces home for that launch.

On open it runs `decode` and then `verifyResult` (cheap: one replay of 20–40 turns). The badge slot shows "בודקים…" (13/500 muted) for at most one frame and never shows a spinner. The hash is removed from the URL with `history.replaceState` after decoding, so a reload never re-opens the intro.

### 2.1 Anatomy at 390x844 (mock A)
```
 [⚔ אתגר מחבר]                           (X)    top bar 58: kicker 15/700 muted + challenge icon 20; close = ghost 48 → home
 ┌──────────────────────────────────────────┐   card: --surface, 1px --border, radius 24, padding 16/20/18, centred
 │            [profession fox bust]         │   the CREATOR's profession: 104×120 (@2x srcset, w descriptors), bottom-anchored
 │ ──────────────────────────────────────── │   on a 1px --border hairline (professions.md: never float the bust)
 │             אתגר מ-נועה                  │   26/800 --text: intro.titleNamed (unnamed: intro.title "קיבלתם אתגר")
 │        ( מורה )  ( משפחה )               │   2 info chips 32px, --surface-2, 1px --border, 14/500 (junior: + "(●) צעירים")
 │ ┌──────────────────────────────────────┐ │   result tile: --surface-2, 1px --border, radius 16, padding 12/16
 │ │ התוצאה של נועה             [✓ אומת] │ │   label 13/500 muted · badge (8.3)
 │ │        23  תורות עד חופש כלכלי       │ │   52/900 tabular + 16/700 (unfinished: "64%" + "מהדרך לחופש כלכלי" + 8px meter)
 │ └──────────────────────────────────────┘ │
 │ אותו משחק בדיוק: מורה, משחק משפחתי, …    │   intro.sameGame 15/400 muted (unnamed result label: "התוצאה בקישור")
 │ מה תעשו אתם?                              │   intro.curious 15/700 --text
 └──────────────────────────────────────────┘
 ┌ (i) באתגר יש שני כללים: תרומה לא נותנת   ┐   info banner (v3.1 §3.5): no fill, 1px hairline, 14/500 --text, icon muted;
 │     קובייה נוספת. אין גלגול שוב.          │   rules.title (700) + rules.charity + rules.reroll; rules.why as a 13 muted
 └───────────────────────────────────────────┘   line only at heights ≥ 800
                 ...flex space...
 [       שחקו את האתגר  (gold 64)         ]               intro.cta (junior "בואו נשחק"); pinned footer, --bg, padding 8/16/max(16,safe)
                לא עכשיו  (text 48)                       → home (the received challenge is kept; see 2.5)
```
- **The unfinished meter** is 8px, `--meter-track` with a `--passive-fill` fill, and fills from inline-start. It shows `min(freedomPct,100)`.
- **The mode chip** says "משפחה" or "מלא".
  - **Junior** adds a third chip, "צעירים", with the 18px coin.
  - If the link is full mode and the receiver's stored band is under 14, a quiet line goes under the chips: "המשחק הזה במצב מלא, מגיל 14". It is information only; the game config is the creator's.
- **Age:**
  - The receiver's own band decides how amounts display (coins or ₪). It comes from `lastAge`.
  - If `lastAge` is unset **and** the link is junior, insert the existing age radio row (three 56px chips: "עד 10", "11–13", "14+", with the legend "בני כמה אתם?") between the card and the banner. No answer means ₪.
  - Otherwise there is no age UI.
- **The primary (`intro.cta`)** goes straight to the board. The profession and mode are locked, so there is no pick screen. It runs the normal first-game guide if this device never played: a brand-new user arriving by link still gets the help. The wave greeting goes to the board's story layer as today (never next to the intro bust).

### 2.2 360x800 (mock B) and 320x568 (mock D)
| | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Bust | 104×120 | 104×120 | **72px high** (width auto) |
| Title | 26/800 | 26/800 | 22/800, 2 lines max |
| Result number | 52/900 | 52/900 | 40/900 |
| Banner | 1–2 lines | 2 lines | 2 lines; the card + banner scroll (`.scroll` region) under the pinned footer |
| Footer | 64 + 48 | 64 + 48 | **56** + 48 |
| Age row (when shown) | fits | fits | scrolls; the footer stays pinned |

### 2.3 Light theme
- The ground is paper `--bg #FBF3E1`, the card is white `--surface`, and the result tile is `--surface-2`.
- The bust keeps its drop shadow; `professions.md` checks it on paper.
- The verified badge uses the light `--verified` / `--verified-tint` tokens (section 8).

### 2.4 States
| State | What changes |
|---|---|
| a. **Verified, won** (A) | as 2.1 |
| b. **Verified, didn't reach freedom** (B) | the number is "64%" + "מהדרך לחופש כלכלי" + meter; the title is unchanged |
| c. **Invalid link** (C): `decode` throws on lengths, truncation or unknown type codes | Same top bar. Centred: an 80px `--surface-2` circle with the `unverified` icon at 40 muted; `error.invalidTitle` 26/800 (22 at 320); `error.invalidBody` 15 muted; a 12px muted line "קוד: {code}" (FORMAT / CRC / VERSION) for support. Primary **`error.toHome` "לדף הבית"**, text button `error.toPlay` "למשחק רגיל" (starts the normal flow). No fox, no red. `role="alert"` on the title. |
| c1. **Tampered** (CRC mismatch) | as c, with `error.tamperedTitle` / `error.tamperedBody` (never accusing) |
| c2. **Other version** (format 3+, or rngVersion 1) | as c, with `error.versionTitle` / `error.versionBody` |
| d. **Decodes, but the replay fails** (`verifyResult.ok === false`) | Playable: the seed and config are intact, so the game itself is fair. The badge is "לא אומת" (dashed). Under the result tile goes a 13px muted `compare.unverifiedText`. The claimed figures stay visible but in `--text-muted`. |
| e. **Another challenge is in progress** (`challengeSave` exists, a different seed) | A warn banner (v3.1 §3.5, `--warn-*`, family = amber) above the footer: "יש לכם אתגר פתוח מול {name}. אתגר חדש יחליף אותו." The primary stays `intro.cta`. The text button becomes "להמשיך את הקודם". |
| e2. **The same challenge is in progress** | The primary becomes **"המשיכו את האתגר"**, with no banner |
| f. **Already played** (a finished result for this seed and config in `passivo.challenges`) | The primary becomes **"לתוצאה"** (opens compare). The text button is "לשחק שוב" (asks once: "התוצאה הקודמת תוחלף"). |
| f2. **This is a reply to my own challenge** (seed and config match a `role:'sent'` entry) | No intro: open **compare** directly in the "reply received" variant (4.6) |
| g. **My own link** (I am the creator and there is no reply yet: the log equals my sent log) | No intro: home + toast "זה האתגר ששלחתם. מחכים לתשובה מהחבר" |

### 2.5 Motion, haptics, accessibility
- **Entrance:** the card fades in with a 12px rise over `--dur-base` with `--ease-out`. The bust rises 24px over `--dur-slow`, and the banner comes 60ms after the card. The badge swaps from "בודקים…" with a 160ms scale .9→1. Under reduced motion everything is 120ms fades.
- **Haptics:** none on open, because the user didn't act. Tapping the primary gives 10ms.
- **Focus:** focus lands on the `h1` (tabindex -1) so a screen reader reads who challenged. The `h1` accessible text includes the result: "נועה מאתגרת אתכם. התוצאה: 23 תורות, מאומתת".
- "לא עכשיו" stores the challenge as `{role:'received', state:'pending'}`. A later home visit doesn't nag. The family board shows the creator's verified result anyway (section 6).

---

## 3. During a challenge: the HUD chip (mocks I, J)
The only visible change on the board is a chip in HUD row 1 (board-spec §14.3), after "מורה · תור 7":
- **Look:** 24px tall, radius 12, transparent fill, a 1px `--border-strong` outline, the `challenge` icon at 16 in `--text`, and the label "אתגר" at 12/700 `--text`. Never gold, never pulsing.
- **Hit area:** 48px, through `::after { inset: -12px -6px }`. The row is 48px tall, and nothing interactive sits within 8px: the 44px avatar is not a button, and the icon buttons are at the far end.
- **Compact HUD (96) or a viewport under 360 wide:** icon only, with `aria-label="אתגר מול {name}"`.
- **Tap:** the existing HUD popover pattern (hud-family.js) anchored under the chip. It has a max width of 280 and an opaque `--surface`:
  - "⚔ משחק אתגר (מול נועה)" 14/700;
  - "תרומה בלי קובייה נוספת, ואין גלגול שוב" 13/400 muted. These are the two halves of `hud.ariaNamed`; junior uses `hud.ariaJunior`.
  - Optional third line, the target "היעד: 23 תורות". It needs a new key (`hud.target`); if it's left out, nothing else changes.
  - It closes on an outside tap or Esc and has no timer. `aria-expanded` is on the chip.
- **Hidden in a challenge** (developer):
  - the reroll token button;
  - every "2 קוביות" or "קובייה נוספת" copy line;
  - the charity card's bonus line. In its place the charity card shows one quiet 13px line, "באתגר אין קובייה נוספת על תרומה", so the player knows before paying.
  - Nothing else changes: no banner, no target overlay, no opponent ghost on the board.
- **Menu sheet:** "בית" saves to `challengeSave` as usual.
- **Home while a challenge save exists:** a 64px ghost row "המשיכו אתגר מול נועה", with the `challenge` icon in a 40px chip and a mirrored chevron.
  - At heights of 700px and above it is an extra row under the daily row.
  - Below 700px it **takes the missions row slot** until the challenge ends. Missions stay reachable from the menu. This is reversible (section 12, item 4).

---

## 4. Compare screen (end of a challenge; mocks E–H)
A challenge game that ends (win or game over) goes **straight to compare**. It replaces the win and game-over screens for that match, so there are never two end screens.
- Confetti and the win haptic play only if I won the challenge.
- The hammock pose is not used: the one fox here is Maxi's crop.

### 4.1 Who won (also used by the family board)
1. Reaching freedom beats not reaching it.
2. If both reached it, fewer turns wins.
3. If neither reached it, the higher freedom % wins.
4. Anything else is a tie.

If their result is not verified, **no winner is claimed** (state 4.5).

### 4.2 Anatomy at 390x844 (mock E)
```
 ההשוואה                                   (X)    top bar: compare.title 22/800; X = ghost 48 → home (compare.btnHome lives here)
     הפעם הגעתם לחופש מהר יותר                     headline 28/800 --text, at most 2 lines (never gold-gradient text)
  כל הכבוד. בצפייה החוזרת רואים מה היה שונה.       sub 14/500 muted, at most 2 lines
 ┌──────────────────────────────────────────┐     card --surface, 1px --border, radius 22, padding 6/12
 │   (head) אתם        מול      (head) נועה │     column heads: 44px avatar + 17/800 name (anon: compare.themAnon "מהקישור")
 │   [✓ אומת]                   [✓ אומת]    │     + badge; "מול" 12/700 muted; grid 1fr 44px 1fr; hairline under
 │ ──────────────────────────────────────── │
 │  ✓ 20     תורות עד חופש כלכלי      23    │     KEY ROW: values 30/800 tabular; the value that is ahead: --income + 16px check
 │ ──────────────────────────────────────── │     grid 1fr 96px 1fr, rows ≥56, label 13/500 muted centred
 │   100%        חופש כלכלי          100%   │     24/800 + a 6px meter (72% of the cell) under each
 │     6         עסקאות שנקנו          4    │     24/800 --text (neutral facts: no better/worse mark)
 │     1        הלוואות מהבנק          —    │     count 24/800 + amount 12/500 muted under it (loansValue);
 │  ₪50,000                     בלי הלוואות │     zero: "—" + loansNone. Junior: the count only
 └──────────────────────────────────────────┘
 (Maxi) ┌ בתור 6 קניתם את ״דירת 2 חדרים״: עוד ┐   52px crop (2px --border ring) + bubble --surface-2, radius 16,
        │ ₪1,200 בחודש לתזרים. בכל סיכום שנתי │   15/500. challenge.takeaway.* : 1 line, or 2 with firstAsset*
        └ זה כפול 12.                          ┘   (at most ~5 text lines; the content scrolls if needed)
                 ...flex space...
 [     שלחו את התוצאה שלכם  (gold 64)       ]      compare.btnReply; pinned footer
 [ ⟲ צפייה חוזרת (ghost 56) ][ ▥ לטבלת המשפחה ]    compare.btnReplay · compare.btnBoard
```
- **Columns in RTL:** "אתם" is inline-start (right) and "them" is inline-end. LTR mirrors this automatically through the grid.
- **Rows** (data from `verifyResult` for both logs; labels are `compare.*`):
  - **`turns`:** the turns, or `notReached` "עוד לא".
  - **`freedom`:** `min(round(passive/expenses × 100), 100)` + "%", with a meter. `freedomHelp` is the accessible description of the row label, and a tap on the label shows it as a popover.
  - **`deals`:** a count.
  - **`loans`:** a count, plus the total as a quiet amount (`loansValue`), or `loansNone`.
  - Loans and deals are facts, not scores. Marking "fewer loans" as better would teach the wrong thing, so only the decisive key row gets the check.
- **Maxi's takeaway** follows the educator's selection rule (`_meta.takeawaySelection`, copy §3.5):
  - an unverified result gives no takeaway, only `compare.simplification`;
  - no split gives `sameDecisions`;
  - otherwise the first buy/pass, loan or expense split (charity never counts), plus an optional `firstAsset*` line;
  - at most 2 lines.
  - **The crop is chosen by outcome:** `celebrate` when I'm ahead, `think` when they're ahead (constructive), and `ponder` for a tie or an unverified result.
  - The bubble is `role="status"`, and the crop is `aria-hidden`.
  - In a verified match, `compare.simplification` sits under the bubble as a 12px muted line (or it can be dropped at 320).
- **Primary (`btnReply`):** opens the share flow of 1.2 with my log and the `reply.*` text. A reply is itself a challenge link (section 2), so a third person who gets it simply sees the intro.
- **Ghosts:** `btnReplay` (`replay` icon 20) and `btnBoard` (`family-board` icon 20).
  - `btnReplay` is truly `disabled` (50%) when their result is not verified (4.5). The reason is the note in the card area, linked by position (v3.1 §3.1).
- **Headline and sub:** use the copy's rule and strings: `headlineYouAhead*`, `headlineThemAhead*`, `headlineTie` and `headlineUnverified`, each with its `sub*`. Both are at most 2 lines at every size, and the longest, "הפעם המסלול אצל נועה היה מהיר יותר", wraps to 2 lines at 360 (mock F).

### 4.3 360x800 (mock F) and 320x568 (mock G)
| | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Headline | 28/800 | 28/800 | 22/800 |
| Grid label column | 96 | 96 | 84 (labels wrap to 2 lines) |
| Values (key / other) | 30 / 24 | 30 / 24 | 24 / 20 |
| Footer | 64 + 8 + 56 (+ padding) | same | **56 + 8 + 48**; the content scrolls under it |
| Scroll | none (2-line takeaway: may scroll a few px) | the takeaway scrolls when there are 2 lines | yes. The headline, the column heads and the **key row** stay above the fold (58 + 80 + 88 + 52 = 278 < 432 visible) |
At no size is there a third footer button: home is the X.

### 4.4 Light theme (mock F)
The card is white, and the key-row winner is `--income` (light `#0B6B43`, 6.3:1 on `--surface-2`). The meters are `--passive-fill` light.

### 4.5 "לא אומת" state (mock G)
- **Their column:** the badge is dashed "לא אומת", and the values are in `--text-muted`. Values that can't be read are "?".
- **No winner:** no check and no confetti. The headline is `headlineUnverified`.
- **A note under the card** (13–14/500 muted, `unverified` icon 20): `compare.unverifiedText` + "היא לא תיכנס לטבלת המשפחה." (new key `compare.unverifiedBoard`).
- `btnReplay` is disabled. `btnReply` stays the primary: my verified result is still worth sending.
- **My own column is always verified,** because my log replays locally. If my own replay fails, that is a bug: log it and show the same neutral badge.

### 4.6 Variant: reply received (creator side, 2.4 f2)
- Same layout, with the creator's own result as "אתם".
- The primary becomes **`btnReplay`**, because the loop is closed and the natural next step is to see where the decisions split.
- The ghost row is `btnBoard` · `create.button` "שלחו אתגר". The latter starts a new normal game and is a ghost because it is not the next step here.

### 4.7 Motion, haptics
- **Entrance:** the headline fades in, then the card rises 12px (`--dur-base`). The key-row values count up from 0 over `--dur-countup` (instant under reduced motion). Then the takeaway bubble slides 8px inline (240ms).
- **I won:** confetti (`--dur-confetti`, off under reduced motion) and the win haptic `[20,40,20,40,60]` once. A loss or tie has no haptic, because losing a challenge is not an error.
- **Lighthouse:** compare is its own lazy chunk (`import('./screens/compare.js')`), loaded at game end.

---

## 5. Replay timeline "צפייה חוזרת" (mock K)
### 5.1 Why vertical
- A challenge is 15–40 turns. Horizontally, at 360px that is either 9px per turn (no 48px targets) or horizontal scroll, which the project forbids and which is fragile in RTL.
- A vertical list gives each turn a full-width 56px row with room for two decisions and a sentence, and it scrolls with the thumb.
- A small horizontal **overview strip** keeps the at-a-glance shape of the game. It is decorative (`aria-hidden`), and the counts are in text.

### 5.2 Anatomy at 360x800
```
 (>)  צפייה חוזרת                                 top bar: back (mirrored arrow, icon-dir) → compare; timeline.title 22/800
 רק לצפייה: כאן רואים איפה ההחלטות נפרדו · 4 מתוך 23 תורות      timeline.sub + count, 14/500 muted (2 lines at 360)
 ▁▁▁█▁█▁█▁▁█▁▁▁▁▁▁▁▁▁▁▁▁                           overview: one tick per turn (flex 1, gap 3), 6px --meter-track; split = 14px --split
 [ רק פיצולים ][ ✓ כל התורות ]                     radio chips 48px, radius 14; selected = --surface-2 + 2px --sel-ring + check
 (head) אתם           תור           (head) נועה    sticky lane header, 32px avatars, 15/700 (laneYou / name or laneThemAnon)
 ┌───────────────────────────────────────────────┐
 │   —                 3 [tile]             —    │  no-decision turn: "—" + the square/event as a 12 muted subline
 │▌ דילוג               4 [tile]          קנייה  │  SPLIT row: --split-tint fill, 3px --split bar at inline-start,
 │  עגלת קפה                           עגלת קפה  │  lanes 15/700 --text (act.*), radius 14
 │ ⑂ בתור 4 העסקה ״עגלת קפה״ נקנתה אצל נועה,    │  why-line 13/700 --split + split icon 16, centred,
 │   ואתם דילגתם                                 │  at most 2 lines (timeline.themBought / youBought / …Loan / …)
 │  ...                                          │
 │  קנייה              11 [tile]          קנייה  │  same turn, different card (tiers differ): NOT a split;
 │  מכונת שתייה                       חנות פרחים │  muted line "אותו תור, קלף אחר" (new key timeline.sameTurnOtherCard)
 │ ✓ בתור 20 הגעתם לחופש כלכלי                   │  end marker row (full width, verified icon, --income): freedomYou/Them, endYou/Them
 └───────────────────────────────────────────────┘
```
- **Rows:**
  - The grid is `1fr 64px 1fr`, with a minimum height of 56 and a 6px gap.
  - The spine shows the turn number (17/800 tabular) over the 18px monoline **tile icon** (`src/assets/tile/*.svg`, `--text-muted`).
  - Both players are always on the same square, because challenge rules remove the charity die and the reroll. So the spine is shared, and that is what makes the two lanes comparable.
- **Decision vocabulary:** the copy's `timeline.act.*`:
  - קנייה, דילוג, הלוואה, הוצאה מהמזומן, הוצאה בהלוואה, תרומה, החזר, חופש!, סוף המשחק;
  - combined as "הלוואה · קנייה" when both happen on one turn.
  - Each has a 12px subline: the card title, or "10% מההכנסה".
- **Split** means the two decision types differ on the same turn. A different card from tier differences is not a split.
- **Why-line:** the copy's impersonal sentences (`timeline.themBought`, `youBought`, `themLoan`, `youLoan`, `expenseLoan*`, `charity*`, `repay*`), so no gender is needed.
- **End rows:** after one player wins or goes bust, their lane shows a muted "—", and a full-width marker row is inserted (`freedomYou` / `freedomThem` / `endYou` / `endThem`).
- **Filter:**
  - It defaults to **"כל התורות"**: context matters, and splits stand out anyway.
  - "רק פיצולים" hides the non-split rows and keeps the end markers.
  - With 0 splits, the filter is hidden and `timeline.noSplit` shows.
  - The two filter labels need new keys: `timeline.filterSplits` / `filterAll`.
- **Data:** built from replaying both logs (read-only). There is no network and no storage beyond `passivo.challenges`.
- **Screen reader:** `srSummary` / `srSummaryNone` is the list's description.

### 5.3 Turn detail (tap a row; level-2 bottom sheet)
- Every row is a `<button>` (the whole row, at least 56px tall).
- **The sheet:** opaque `--surface`, radius 28, max `70dvh`, close icon 48. It contains:
  - **Title:** `timeline.turnLabel` + the square label, 20/800, and the card title 15 muted.
  - **Two columns** ("אתם" / name), each with the decision at 17/700 and up to three `money()` lines at 15: the down payment, the monthly cash flow, and the loan taken.
  - **"אחרי התור"** rows per column: cash `money()` and freedom % (13/500). This needs a new key, `timeline.after`.
  - On the takeaway turn, the takeaway line is repeated (13 muted).
- There is no gold, no primary and no fox; it is read-only.
- At 320 the columns stack: "אתם" first, then the other player, with a hairline between.

### 5.4 Takeaway turn (shared with compare 4.2)
The decisive split comes from the educator's rule (copy §3.5). Tapping the compare bubble opens the replay scrolled to that turn, with the row focused.

### 5.5 Motion, accessibility
- **Opening the replay** scrolls to the takeaway turn (`scrollIntoView({block:'center'})`, smooth; `auto` under reduced motion) and gives the row a 1.2s focus ring.
- **Row press** fills `--press` (spec.md §3.1). The overview strip is static. The sheet uses the standard entrance or a fade.
- **Lists:** an `<ol>` of buttons. Each button's accessible name is built from `timeline.srCell` for both lanes plus the why-line, e.g. "אתם, תור 4: דילוג. נועה, תור 4: קנייה. בתור 4 העסקה ״עגלת קפה״ נקנתה אצל נועה, ואתם דילגתם."
- **Colour is not the only cue:** the split icon, the tint and bar, and the sentence all carry it.
- The replay is a lazy chunk.

---

## 6. Weekly family board "טבלת המשפחה" (mocks L, M)
### 6.1 Entry (home) and Lighthouse
- **Entry:** a **4th 48px ghost icon button** in the home's top icon row (settings · help · learn · **board**), with the `family-board` glyph 24 and `aria-label="טבלת המשפחה"`. At 320 the four buttons take 4×48 + 3×8 = 216 of 288px. The logo's clear space (top 72) is not touched.
- **Why an icon, not a row:** home already stacks mode cards, the daily row, the missions row and the CTA, and at 320x568 there is no room for another row.
- **Second entries:** the compare ghost button and the empty-state link.
- **Lighthouse:**
  - The icon is inline SVG, so nothing new is requested on home.
  - Home does **not** read `passivo.challenges` (no badge count on the icon).
  - The screen module and its CSS load with `import()` on tap. Avatars are `loading="lazy" decoding="async"` (`-head@2x.webp`, 44/88).
  - Home LCP stays the logo (fox-usage.md). Budget: a chunk of at most 8 KB gzip.

### 6.2 Anatomy at 360x800 (mock L)
```
 טבלת המשפחה של השבוע                      (X)    board.title 22/800
 השבוע: 8.11–14.11                                  board.week 15/700; the range in <bdi dir="ltr"> (else "14.11–8.11" in RTL);
 ביום ראשון הטבלה מתחילה מחדש                       accessible name board.weekAria; board.reset 13 muted
 ┌──────────────────────────────────────────┐       list card --surface, 1px --border, radius 22
 │ ☆1  (head) נועה                    18    │       row ≥64: rank 18/800 tabular (1st place: 16px outline star, muted)
 │            מורה · משפחה           תורות  │       name 16/700 + "profession · mode" 13 muted; result 20/800 + unit 13 muted
 │  2  (head) אתם                     20    │       ME (board.you): --surface-2 fill + the word itself (not colour only)
 │  3  (head) יואב                    26    │       junior result: mode word "צעירים"
 │  5  (head) סבתא רותי              72%    │       unfinished: % + "עוד בדרך", ranked after all finishers;
 └──────────────────────────────────────────┘       the last row gets nothing of its own (copy §3.7)
 ✓ מתוצאות של אתגרים שקיבלתם השבוע. רק תוצאות שנבדקו, ורק במכשיר הזה.   board.how 12 muted + verified 16
   כל משחק הוא הזדמנות ללמוד. כל הכבוד לכל מי ששיחקו                    board.cheer 14 muted, centred
```
- **Week:** Sunday 00:00 to Saturday 23:59, local time.
- **Rank:**
  - Order follows 4.1 (`board.sort`): finishers by turns, ascending, then unfinished results by %, descending.
  - Equal results share a rank (`placeTie` "יחד במקום {n}" in the accessible name).
  - The row's accessible name is `board.rowAria` with `rowWin` / `rowProgress`.
  - Visually the result is split into a number and a unit. That needs two small new keys, `board.unitTurns` "תורות" and `board.unitProgress` "עוד בדרך".
- **One row per person:** each person's best verified result of the week. Identity is the typed name plus the profession. An unnamed result shows `board.anonName` "קישור בלי שם". "אתם" is this device's own results.
- **Mixed modes:** when the week has more than one mode, radio chips appear above the list ("משפחה" / "מלא", 48px). The default is the mode with the most entries. Family and full turns are not comparable, so they never rank together. Junior ranks inside "משפחה" and is labelled "צעירים".
- **Tap a row:** opens that challenge's compare (4.6 layout, read-only, with no reply button if a reply was already sent). If there is no pair, the row is not interactive and is a plain `<li>`.
- **No primary on a filled board:** it is read-only, and the X is home.
- Up to 20 rows show, then a text button "הצגת עוד {n}".

### 6.3 Empty state (mock M, 320x568)
- An 80px `--surface-2` circle with `family-board` 40 muted.
- `board.emptyTitle` 26/800 (22 at 320).
- `board.emptyBody` 15 muted.
- Primary **`board.emptyCta` "שלחו אתגר"**. A challenge needs a finished game, so the action is home's normal start. Section 12 asks whether the label should read "התחילו משחק".
- The week label stays visible.

### 6.4 Sizes and themes
| | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Visible rows | ~10 | ~9 | ~5, then the list scrolls; the header and week label are sticky |
| Result | 20/800 | 20/800 | 18/800; unit 12 |
| Name | 16/700, 1 line ellipsis | same | same; the subline drops the profession, mode only |
Light: a white list on paper with a `--surface-2` "me" row (mock L).

---

## 7. Junior (≤10)
Display follows the **viewer's** age band (`lastAge`, or the band chosen on the intro). Game rules follow the **link's** junior flag.

| Surface | Junior treatment |
|---|---|
| Create sheet | Same layout. `create.nameHint` has a junior variant ("אפשר לכתוב רק שם פרטי, או להשאיר ריק"); the preview is `invite.*Junior` ("שיחקנו ב-MaxiFox… והגענו לחופש ב-23 תורות!"). Whether junior shows the name field at all is open (copy needs_review 4). |
| Intro (D) | Kicker "אתגר"; title `intro.titleNamed` (same); the "צעירים" chip with a coin; result `intro.resultWinJunior` ("{name}: חופש ב-26 תורות", shown as number + "תורות עד החופש"); lede `intro.sameGameJunior`; rules `rules.*Junior` ("שני כללים באתגר: תרומה לא נותנת עוד קובייה. אי אפשר לזרוק שוב."); CTA "בואו נשחק" |
| HUD chip | unchanged ("אתגר" is a kid word) |
| Compare (H) | Labels `turnsJunior` "תורות עד החופש", `freedomJunior` "כמה קרוב לחופש", `dealsJunior` "נכסים שנקנו", `loansJunior` "הלוואות" (**count only, no amount**: junior loan totals can pass 999 coins); headline/sub `…Junior`; the takeaway `…Junior` with coins: "בתור 5 קניתם את ״דוכן פלאפל״: מאז נכנסים לכם עוד (●) 9 מטבעות בכל חודש." |
| Replay sheet | `money()` in coin scale; lines limited to down payment ("התשלום הראשון"), monthly coins and cash. No loan principal, no net worth |
| Family board | "תורות" and "% מהדרך" only; no amounts |

**The numbers rule:** the challenge surfaces show only turns (at most 99), percentages (capped at 100) and counts (at most 99). So **no number over 999 can appear** on the intro, HUD chip, compare or board, in any band. The only places with amounts are the replay sheet and the compare takeaway. Both use the existing junior allowance: up to 4 digits only for cash, the first payment ("התשלום הראשון") and "חסרים לכם". Every other amount stays at 3 digits or less. The educator must not put any other amount over 999 coins into a takeaway line. QA can reuse the existing junior smoke assertion on these screens.

---

## 8. Tokens and icons
### 8.1 New tokens (paste into `src/styles/tokens.css`; the developer owns that file)
```css
:root {                                   /* dark (default) */
  --split: #7CC4FF;                       /* decision-split marker/text: 9.5 bg, 8.5 surface, 7.3 surface-2 */
  --split-tint: rgb(124 196 255 / .14);   /* split row fill (text on it: --text 10.9, --text-muted 5.7, --split 6.2) */
  --verified: var(--income);              /* verified badge text + icon (7.0 on its tint) */
  --verified-tint: rgb(95 224 174 / .14);
  --unverified: var(--text-muted);        /* "לא אומת" text + icon (7.7 on surface) */
  --unverified-border: var(--border-strong); /* 1px dashed outline (5.4 on surface) */
}
:root[data-theme="light"] {
  --split: #1A62B3;                       /* 5.5 bg, 6.1 surface, 5.8 surface-2 (= --chip-info-edge) */
  --split-tint: rgb(26 98 179 / .10);     /* --text 15.4, --text-muted 7.2, --split 5.3 */
  --verified-tint: rgb(11 107 67 / .10);  /* --verified (#0B6B43) 5.7 */
}
/* family / junior: no override needed (nothing new is red). Reduced motion: existing duration tokens cover everything. */
```
Why sky for splits:
- it is the existing "info" family (`--chip-info-*`, board-spec §2), so it means "look here", not good or bad;
- gold is the action colour;
- mint means income;
- red and amber mean a problem.

### 8.2 Icons (`src/assets/challenge/`, 24×24, `stroke="currentColor"`, width 2, round caps; the same family as `src/assets/tile/`)
| File | Meaning | Mirror in RTL? |
|---|---|---|
| `challenge.svg` | two pawns on one shared baseline with a spark between them: "same game, two players". No swords (family-safe) | no (symmetric) |
| `verified.svg` | a scalloped seal with a check | no |
| `unverified.svg` | the same seal, dashed, with a level dash (not an X: neutral, not an error) | no |
| `family-board.svg` | a 3-step podium with a star over the top step | no |
| `replay.svg` | a circular arrow around a play triangle (a media symbol) | no |
| `split.svg` | a fork: one road splitting in two | no |
- Add them to the `PATHS` map in `src/ui/icons.js` (inline, so there are no requests), or import them `?raw`.
- They are decorative (`aria-hidden`); the text label always accompanies them, except the compact HUD chip, which has an `aria-label`.
- The coin uses the existing `coin-small.svg`.

### 8.3 Components
- **Badge `.ch-badge`:**
  - inline-flex, 26px tall (`sm`) or 30px, radius 12, padding-inline 10/8, 13/700, icon 16/18;
  - `ok`: `--verified-tint` fill and `--verified` ink;
  - `no`: transparent, a 1px dashed `--unverified-border`, `--unverified` ink.
- **Info chip** (profession, mode): 32px, `--surface-2`, 1px `--border`, radius 14, 14/500, non-interactive.
- **HUD chip `.ch-chip`:** see section 3.
- **Split row `.tl-row.is-split`:**
  - `background: var(--split-tint)`;
  - `box-shadow: inset calc(var(--dir) * -3px) 0 0 var(--split)`, or a `::before` with `inset-inline-start:0; inline-size:3px`. Prefer `::before` (logical).
- **Compare grid:** `grid-template-columns: 1fr 96px 1fr`, every cell `min-inline-size:0`, and values `white-space:nowrap` with `fitText` down to 70%.

---

## 9. Contrast (generated by `python3 docs/v051/design/contrast-v051.py --md`; 45 pairs, all pass)
| Pair | Dark | Light | Need |
|---|---|---|---|
| `--split` text / bg · surface · surface-2 | 9.5 · 8.5 · 7.3 | 5.5 · 6.1 · 5.8 | 4.5 |
| `--text` / `--muted` / `--split` on the split-row tint | 10.9 / 5.7 / 6.2 | 15.4 / 7.2 / 5.3 | 4.5 |
| `--verified` on `--verified-tint` · `--text` on the tint | 7.0 · 10.7 | 5.7 · 15.4 | 4.5 |
| "לא אומת" text · its dashed border (non-text) | 7.7 · 5.4 | 8.3 · 4.4 | 4.5 · 3 |
| HUD chip text · its border | 14.8 · 5.4 | 17.9 · 4.4 | 4.5 · 3 |
| Compare value · label · winner (`--income`) on surface-2 | 12.8 · 6.7 · 8.3 | 17.0 · 8.0 · 6.3 | 4.5 |
| Gold primary label | 9.4 | 9.4 | 4.5 |
| Ghost button border / bg · focus ring / bg | 5.1 · 12.7 | 3.9 · 16.2 | 3 |
| Family amber (if a family takeaway shows a negative) | 11.1 | 8.6 | 4.5 |
Add these rows to `scripts/contrast-check.py` when the screens ship.

---

## 10. Copy and i18n
- **Source of truth:** `docs/v051/challenge.he.json` (197 keys) and the family override layer, as merged per `docs/v051/challenges-copy.md` §1.
- **Labels the layouts must fit:** "שלחו אתגר", "שחקו את האתגר", "שלחו את התוצאה שלכם" (19 characters: fits the full-width primary at 320, 18/800), "צפייה חוזרת" and "לטבלת המשפחה". In the ghost row each button allows about 15 characters at 16px at 320; English needs `font-size: 15px` there, or a stacked row.
- **Keys this layout needs that are missing from the JSON** (for the educator):
  - `create.send` (the sheet primary);
  - `intro.checking`, `intro.fullModeNote`, `intro.pendingOther`, `intro.continueOther`, `intro.continue`, `intro.toResult`, `intro.playAgain`, `intro.ownLink`;
  - `hud.target` (optional);
  - `challenge.resume` (the home row; `hud.resume` may serve);
  - `compare.unverifiedBoard`;
  - `timeline.filterSplits`, `timeline.filterAll`, `timeline.sameTurnOtherCard`, `timeline.after`;
  - `board.unitTurns`, `board.unitProgress`, `board.more`.
- **Labels taken from the JSON:** the HUD popover is the two halves of `hud.ariaNamed`, and the charity card line is `rules.charityModal`.

## 11. Layout summary
| Element | 390x844 | 360x800 | 320x568 |
|---|---|---|---|
| Win actions | gold 64 + ghost row 56 + text 48 (same as today) | same | gold 56 + ghost row 48 + text 48 |
| Create sheet | ~470 | ~470 | ≤ 90dvh, preview 2 lines |
| Intro | fits, footer pinned | fits | scrolls under a pinned 56 + 48 footer |
| HUD chip | 24px "⚔ אתגר" | same | icon only (compact HUD) |
| Compare | fits | fits | scrolls; key row above the fold; footer 56 + 48 |
| Replay | list scrolls; header + filter sticky | same | same; the detail sheet stacks its columns |
| Family board | ~10 rows | ~9 | ~5, scrolls |
No horizontal scroll anywhere: every grid cell has `min-inline-size:0`, and no amount wraps.

## 12. Decisions and conflicts for the CEO / developer
1. **Win primary = the challenge button**, and the "שתפו את התוצאה" text button is dropped when a challenge is possible (1.1). This changes the v3.1 §1 ladder: update spec.md's table row when shipping. It is reversible.
   - The brief's labels ("אתגרו חבר", "יוצאים לאתגר", "שלחו תשובה") differ from the committed copy ("שלחו אתגר", "שחקו את האתגר", "שלחו את התוצאה שלכם").
   - The mocks and spec use the copy. It is CEO's pick: both fit.
2. **Gender:** resolved by the copy (impersonal forms). No format bits are needed.
3. **Ranking unfinished games:** the board ranks by freedom % after all finishers (4.1, the same as `board.sort` and the copy's headline rule). This answers the plan's owner question #2 with a reversible default.
4. **Home resume row:** at heights under 700, an open challenge takes the missions row slot (section 3). The alternative is a 4th row that pushes the CTA out of the 320x568 thumb zone. I recommend the slot swap.
5. **A challenge ends on compare, not win/over** (section 4). Tests that expect `data-screen="win"` after any single-player win must exclude challenge matches. Propose `data-screen="compare"`.
6. **Verify on open:** the intro runs `verifyResult` immediately, so the badge is on the intro too (the plan only had it on compare). The cost is one replay, a few ms. A log that decodes but fails the replay is still **playable** (2.4d), because the seed and config are intact. Only decode failures (invalid / tampered / version) block.
7. **Empty board CTA:** `board.emptyCta` "שלחו אתגר", but no challenge can be sent without a finished game, so the button starts a game. I recommend the label "התחילו משחק" for honesty (educator).
8. **Link eligibility** (copy needs_review 1): offer the challenge button only for logs with no charity bonus die and no reroll used. Otherwise the receiver's dice differ and `rules.why` is false. This belongs in `canChallenge` (1.1).
9. **Stale screenshots:**
   - `qa/screens/over-full-dark-360x800.png` (mouse mascot, "המרוץ ממשיך": banned phrase and mascot per CLAUDE.md);
   - `r3-*`, `r7-*`, `r8-*` (Passivo branding).
   - I recommend deleting or archiving them so nobody designs from them again. That is the CEO's call; I did not touch them.
10. **Copy that touches existing screens:** the charity card's challenge line (`rules.charityModal`), and hiding the reroll button (section 3).
