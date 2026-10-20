---
name: hebrew-rtl-mobile
description: Rules for Hebrew RTL, i18n-ready, mobile-first web UI that works in Android Chrome at 360x800 and can switch to English LTR later. Use when designing, building or testing any UI.
---
# Hebrew RTL + mobile

## Document
- `<html lang="he" dir="rtl">`, set from the active locale (he → rtl,
  en → ltr). Never hardcode direction in CSS.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- `html, body { overflow-x: hidden; }` is a last resort, not a fix —
  find the overflowing element instead.

## CSS logical properties only
- `margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
  `text-align: start`. Never `left/right` for layout.
- Flex/grid follow `dir` automatically; don't reverse manually.
- Mirror directional icons (arrows, progress) with
  `[dir="rtl"] .icon-dir { transform: scaleX(-1); }`. Don't mirror
  logos, dice, coins or numbers.
- Progress bars fill from the inline-start side.

## Numbers and money
- `new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })`.
- Wrap numbers in `<bdi>` or `unicode-bidi: isolate` so "+₪1,200" and
  negative values don't flip inside Hebrew text.
- Tabular numerals for money columns.

## i18n
- All strings in `/src/i18n/<locale>.json`, keys like
  `card.buy`, `statement.passiveIncome`. Interpolation `{amount}`.
- Card data per locale: `cards.he.json`, `cards.en.json` (same ids).
- Hebrew text is ~20–30% shorter than English: leave room for EN.

## Mobile
- Touch targets ≥48x48px, 8px apart. Primary actions in bottom third.
- `env(safe-area-inset-*)` padding. Use `dvh`, not `vh`, for full height.
- Fonts: preload, `font-display: swap`, subset to Hebrew + Latin.
- No hover-only interactions. `touch-action: manipulation` on buttons.
- Test widths: 360, 390, 412; heights: 640, 800.

## Hebrew copy
- Gender-neutral or plural address where possible ("בחרו", "לחצו"),
  or a consistent choice logged in decisions.
- Short labels on buttons (1–2 words). Check spelling with niqqud-free
  standard spelling (כתיב מלא).
