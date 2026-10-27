# Category map (v3.1) — owner: designer assigns, developer applies

New presentation-only field `category` on every **opportunity** card in `src/data/cards.he.json` (and `cards.en.json` later, same ids). It never affects the engine: `type` (apartment / business / stock) stays the logic field. One registry, one icon + one colour per category, used identically everywhere a deal is shown.

## 1. Registry (the single source of truth: put it in `src/data/categories.js` or `src/ui/categories.js`)
| id | Hebrew label (`category.<id>` in he.json) | Icon file | Dark-surface colour token | Cream/white colour token | Notes |
|---|---|---|---|---|---|
| `apartment` | דירה | `src/assets/category/apartment.svg` | `--cat-apartment` `#A9B8DA` | `--cat-apartment-ink` `#4A5C94` | steel blue-grey: solid, property |
| `coffee` | קפה | `.../coffee.svg` | `--cat-coffee` `#C79A6B` | `--cat-coffee-ink` `#7A5230` | latte brown |
| `food-stand` | אוכל | `.../food-stand.svg` | `--cat-food-stand` `#B9D95C` | `--cat-food-stand-ink` `#55700F` | falafel-in-pita bowl; also the restaurant |
| `snack-cart` | חטיפים | `.../snack-cart.svg` | `--cat-snack-cart` `#FF8FB8` | `--cat-snack-cart-ink` `#B0265E` | popcorn bucket; also ice-cream truck |
| `retail` | חנות | `.../retail.svg` | `--cat-retail` `#4FD1D9` | `--cat-retail-ink` `#0B6B78` | storefront with awning |
| `franchise` | זכיינות | `.../franchise.svg` | `--cat-franchise` `#A78BFA` | `--cat-franchise-ink` `#5B3FC4` | storefront + sign board |
| `service` | שירותים | `.../service.svg` | `--cat-service` `#E879F9` | `--cat-service-ink` `#9A1FB0` | sparkle: cleaning, laundry, hair, app |
| `leisure` | פנאי וכושר | `.../leisure.svg` | `--cat-leisure` `#FFA45C` | `--cat-leisure-ink` `#A84E0B` | bowling pin: bowling, yoga, gym |
| `stock` | מניה | `.../stock.svg` | `--cat-stock` `#4DA3FF` | `--cat-stock-ink` `#1A62B3` | line chart (the board's MARKET tile keeps its bar-chart glyph) |

Icon rules: 24 grid, 2px stroke, round caps and joins, `stroke="currentColor"`, `fill="none"` (so one file serves every colour). Render either inline (`import svg from './x.svg?raw'` and inject, like `icons.js` does) or as a CSS mask: `.cat-icon { inline-size: var(--s); block-size: var(--s); background: currentColor; mask: var(--src) center / contain no-repeat; }`. Do NOT use `<img>` (it would render black).

Fallback: a card with a missing or unknown `category` renders the neutral `opportunity` house icon with `--text-muted` / `--card-muted` and the label of its `type` (`type.apartment`...).

## 2. Where the category appears (and where it must NOT)
| Place | Appears | Treatment |
|---|---|---|
| Revealed deal card header | yes | 40px round chip: `color-mix(in srgb, var(--cat-X-ink) 12%, var(--card-bg))`, 24px icon in `--cat-X-ink`, label (`category.<id>`) 13px/700 in `--cat-X-ink` |
| Assets list in the income statement | yes | 32px chip: `color-mix(in srgb, var(--cat-X) 16%, var(--surface))`, 20px icon in `--cat-X` (replaces the generic type line icon) |
| Monthly-report rows (income statement, payday summary rows for owned assets) | yes | same 20px glyph in `--cat-X`, no chip, 12px gap |
| Sell dialog / market offer rows | yes | 20px glyph |
| **Board tiles** | **NO** | tiles keep the neutral `opportunity` glyph (spec change: a tile must not hint the next card) |
| Deal card BEFORE it is dealt (the draw/"flip" moment) | no | the card is not visible yet |
| Dictionary / report | optional | not required in v3 |

Stored on the owned asset: copy `category` from the card into the asset record at purchase (save-game migration: assets bought before v3 have none, so derive it from the card id via this table, fallback = neutral).

## 3. Mapping of all 35 opportunity cards
Counts: apartment 16, service 4, leisure 3, stock 3, coffee 2, food-stand 2, snack-cart 2, retail 2, franchise 1.

| id | title | type | category | why |
|---|---|---|---|---|
| `opp-apt-001` | סטודיו בבאר שבע | apartment | `apartment` | all apartments |
| `opp-apt-002` | שלושה חדרים בפתח תקווה | apartment | `apartment` | all apartments |
| `opp-apt-003` | דירה ליד הטכניון | apartment | `apartment` | all apartments |
| `opp-apt-004` | דירה בקריית שמונה | apartment | `apartment` | all apartments |
| `opp-apt-005` | ארבעה חדרים בראשון לציון | apartment | `apartment` | all apartments |
| `opp-apt-006` | דירה עם מרפסת בנתניה | apartment | `apartment` | all apartments |
| `opp-apt-007` | דירת גג בתל אביב | apartment | `apartment` | all apartments |
| `opp-biz-001` | דוכן פלאפל בשוק | business | `food-stand` | falafel stall: the icon the owner named |
| `opp-biz-002` | עגלת קפה ברכבת | business | `coffee` | espresso cart |
| `opp-biz-003` | משאית גלידה | business | `snack-cart` | ice-cream truck = a sweet-snack cart, same family as popcorn |
| `opp-biz-004` | שירות ניקיון לבתים | business | `service` | cleaning: sparkle |
| `opp-biz-005` | סטודיו ליוגה | business | `leisure` | yoga: leisure (pin icon is the family glyph for leisure and fitness) |
| `opp-biz-006` | עגלת פופקורן ליד בית ספר | business | `snack-cart` | popcorn cart |
| `opp-biz-007` | מכבסה שכונתית | business | `service` | laundromat is a service |
| `opp-biz-008` | חנות ספרים ופינת קפה | business | `retail` | bookshop is a storefront; the cafe corner is secondary |
| `opp-apt-008` | דירה בקומה תשיעית בלי מעלית | apartment | `apartment` | all apartments |
| `opp-apt-009` | דירה עם "פוטנציאל" | apartment | `apartment` | all apartments |
| `opp-biz-009` | בית קפה במרכז מסחרי שומם | business | `coffee` | a cafe, even an empty one |
| `opp-biz-010` | קיוסק על כביש שנסגר | business | `retail` | a kiosk is a small shop, not a snack cart: retail |
| `opp-apt-010` | דירה מול המפעל | apartment | `apartment` | all apartments |
| `opp-biz-011` | מועדון בולינג לא פופולרי | business | `leisure` | bowling |
| `opp-apt-011` | דירה בבניין עם בריכה ושומר | apartment | `apartment` | all apartments |
| `opp-apt-012` | דירה עם משכנתא "נוחה" | apartment | `apartment` | all apartments |
| `opp-biz-012` | זכיינות של רשת מפורסמת | business | `franchise` | named franchise: storefront with a sign |
| `opp-apt-013` | דירה במחיר "הזדמנות אחרונה" | apartment | `apartment` | all apartments |
| `opp-apt-014` | שני חדרים באשדוד | apartment | `apartment` | all apartments |
| `opp-biz-014` | מספרה שכונתית | business | `service` | barbershop: personal service |
| `opp-biz-013` | אפליקציה של הבן של השכן | business | `service` | tech/app venture: no tech category in v3, so generic service sparkle |
| `opp-apt-015` | דירה ליד תחנת הרכבת בלוד | apartment | `apartment` | all apartments |
| `opp-biz-015` | מכון כושר שכונתי | business | `leisure` | gym: leisure and fitness |
| `opp-apt-016` | דירת שלוש וחצי ברמת גן | apartment | `apartment` | all apartments |
| `opp-biz-016` | מסעדת שף עם תפריט טעימות | business | `food-stand` | restaurant: food (pita-bowl glyph), distinct from coffee |
| `opp-stk-001` | מניית חם-קר מזגנים | stock | `stock` | stocks (full mode only) |
| `opp-stk-002` | מניית מי-אביב | stock | `stock` | stocks (full mode only) |
| `opp-stk-003` | מניית שמש-נגב אנרגיה | stock | `stock` | stocks (full mode only) |

## 4. Developer checklist
1. Add `"category": "<id>"` to each card above (JSON edit only); add a unit test: every `deck: "opportunity"` card has a `category` that exists in the registry.
2. Add `category.<id>` strings to `src/i18n/he.json` (labels above; keep them <= 12 characters for 360px).
3. Registry module exports `categoryOf(cardOrAsset)` returning `{ id, label, iconUrl, colorVar, inkVar }`.
4. Remove the large per-type banner art (`card-opportunity.svg` etc.) from the deal card header (see spec section 4.4); the category chip replaces it.
5. Never colour a category by hand: only through `--cat-*` tokens, so light theme (which remaps `--cat-*` to the ink values) works.
