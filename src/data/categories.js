// Deal-category registry (v3.1, docs/v3/design/category-map.md). PURE DATA: ids only, no DOM, safe for the engine's validator.
// Presentation (label, icon, colour tokens) lives in src/ui/categories.js. `category` never affects the rules: `type` stays the logic field.
// Adding a category = one id here + src/assets/category/<id>.svg + --cat-<id>/--cat-<id>-ink tokens + category.<id> in the locale file.
export const CATEGORY_IDS = ['apartment', 'coffee', 'food-stand', 'snack-cart', 'retail', 'franchise', 'service', 'leisure', 'stock'];

/** Which card types may use a category (a stock card is always 'stock'; apartments and businesses never are). */
export const CATEGORY_TYPES = {
  apartment: ['apartment'],
  stock: ['stock'],
};
