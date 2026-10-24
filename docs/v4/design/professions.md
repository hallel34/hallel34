# Profession foxes: select screen and HUD avatar (owner override 2026-10-24b)
Source: `design/character/professions-ref/owner-professions-ref.jpg` (owner reference, 720x1560). It shows 8 waving foxes, one per profession, in a 2-column grid.

These foxes replace the monoline glyphs (`src/assets/profession/*.svg`) on the profession-select cards and in the HUD avatar. **The glyphs stay as the fallback** while a WebP is missing or failing (same pattern as `boardTile` for tile3d).

## 1. Assets (`src/assets/profession-fox/`, made by `docs/v4/design/extract-profession-fox.py`, deterministic)
| id (`professions.he.json`) | Label in the ref | Outfit |
|---|---|---|
| `teacher` | מורה | brown cardigan, book |
| `engineer` | מהנדס/ת | white hard hat, hi-vis vest |
| `driver` | נהג/ת מונית | navy driver cap, gingham shirt |
| `nurse` | אח/ות | teal scrubs, stethoscope |
| `programmer` | מפתח/ת תוכנה | black hoodie, headphones |
| `police` | שוטר/ת | navy uniform, cap with badge |
| `cook` | טבח/ית | chef's hat, red scarf |
| `lawyer` | עורך/ת דין | black suit, red tie |

| File | Pixels | Use | 8 files total |
|---|---|---|---|
| `<id>.webp` | 104 × 120 | card art @1x, CSS 104 × 120 | 36,140 B |
| `<id>@2x.webp` | 159 × 184 | card art, **source resolution** (1.53x; never upscaled) | 53,062 B |
| `<id>-head.webp` | 44 × 44 | HUD avatar @1x | 10,356 B |
| `<id>-head@2x.webp` | 88 × 88 | HUD avatar @2x | 23,506 B |

- **Total:** 32 files, **123,064 B (120.2 KB)**. A device fetches one density: a 2x phone loads about 52 KB on the select screen plus 2.9 KB for the HUD.
- **Markup:**
  - Card: `<img src="teacher.webp" srcset="teacher.webp 104w, teacher@2x.webp 159w" sizes="104px" width="104" height="120" alt="" decoding="async">`. Use `w` descriptors, because the @2x is 1.53x, not 2x. On DPR 2–3 phones the browser upscales the 159px file slightly; this is the best the reference allows.
  - HUD: `srcset="x-head.webp 1x, x-head@2x.webp 2x"`, 44 × 44.
  - The images are decorative (`alt=""`); the profession name is the text.
- **Matting:**
  - The navy card / box background is flood-filled from the box's top, left and right edges. The cartoon outline is the barrier.
  - Navy pockets enclosed between the arm, the head and the tail are removed.
  - The navy cloth (police uniform) is protected by a blue-excess test and a 6px leak cut. The driver's cap crown matches the card exactly, so it is a hand-traced protect polygon.
  - The edge band is un-mixed from the local navy, and specks and spurs are removed.
  - All 8 are checked on `#0F172A`, `#FBF3E1` and `#F1E5C8`: `docs/v4/design/profession-fox-contact-sheet.png`.
  - The police and lawyer edges are slightly rougher on cream at 2x zoom; at 1:1 they read clean.
- **The fox is cut flat at the bottom** in the source, at mid-torso. The card art is therefore bottom-anchored on a hairline, so the cut reads as the card's "floor" (as in the reference). Never float these foxes free on a background.
- **Why a bust for the HUD, not the head:** 4 of the 8 heads are identical without the outfit (teacher, nurse, programmer and lawyer have no hat). The bust crop shows the collar, which tells them apart at 44px: stethoscope, headphones, tie, cardigan, scarf.
  - The crop is `(cx 100, cy 74, 128px)` in box pixels: from the ear tips to the chest.

## 2. Profession-select layout (360 × 800; mock in the contact sheet)
- **Header:** "בחרו מקצוע" 28/900, gold (`#8A5A00` on light). Below it, "השועל שלכם מתלבש בהתאם" 14/500 muted. This is a new subtitle, a proposed key `pick.subtitleFox`; the current `pick.subtitle` can stay if the CEO prefers.
- **Grid:** 2 columns, `gap 10`, 12px side padding, so cards are 163 wide at 360 and 143 at 320. The order is the JSON order, RTL row by row (teacher on the right of row 1), as in the reference.
- **Card:** a button, radius 18, `--surface`, 1px `--border`, `0 6px 16px rgb(0 0 0 / .18)`, height about 236 (content-driven). Top to bottom:
  1. **Art well**, 122px tall, the full card width. A soft fox-orange radial glow (`--fox` at 22%, 70% × 80% at 55% 70%) sits behind the fox. The fox image is 104 × 120 CSS, bottom-centred on a 1px `--border` floor line.
  2. **Name** 17/800 `--text`, 6px below the floor (`p.title`, e.g. "מפתח/ת תוכנה", one line at 143px).
  3. **Two lines**, 12/500 muted, with the money at 13/900 `--text` and tabular nums: "משכורת ₪8,800" / "הוצאות ₪7,310". They are stacked, not joined with "·", because at 163px the single line of the reference wraps unevenly.
  4. **"נשאר בכיס ₪1,490" pill:** 26px, 12.5/700, `--income` on income at 14% with a 45% hairline (`--income-ink` text on light). The proposed key is `pick.cardLeftPocket`: "נשאר בכיס {amount}". The amount is `monthlyCashFlow` from the same `statement()` the grid uses, so the card equals the preview sheet.
     - Note: the live data differs from the reference image (for example engineer expenses 10,450, not 10,200). **Always render the data**, never the reference numbers.
- **States:**
  - Pressed: scale .97, 120ms.
  - Selected / focus-visible: a 2px `--ring-current` inset ring plus a 3px 30% halo.
  - Tap opens the existing preview sheet, with the same fox (@2x, 120px) beside the title.
  - Entry: the cards stagger in at 40ms, rising 8px and fading; under reduced motion they only fade.
- **Height:** 4 rows of about 236 plus the header is about 1,050px, so the screen **scrolls vertically** at 360 × 800, with a one-row peek. There is no horizontal scroll. Fitting all 8 in 800px would shrink the fox under 80px, which defeats the owner's request.
- **Fallback:** if the WebP fails (`onerror`), the well shows the current 56px monoline glyph avatar, centred.

## 3. HUD avatar
- **Size:** a 44 × 44 circle in the slim HUD (board-spec 14.3), `border-radius: 50%; overflow: hidden`.
- **Fill:** background `--surface-2`. The image is transparent, so the CSS fill shows around the bust.
- **Ring:** 2px `--fox` (orange carries no money meaning).
- **Image:** `<id>-head.webp` / `@2x` at `object-fit: cover`.
- **Kids badge:** stays on the avatar (bottom inline-end), as now.
- **Hot-seat:** the player-colour ring (`data-pc`) replaces the fox ring; the bust identifies the profession, so the profession text in the sub-line can truncate first.
- **Fallback:** the monoline glyph on `--fox`, as today.
