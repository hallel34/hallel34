// Phase C: when does a screen use the two-column (landscape / desktop) composition, and how wide are its parts. Pure functions (unit-tested).
// The app column itself is lifted by CSS (hud-b.css / wide.css) under the same query; keep the two in step: MIN_W 720 and the 23/20 ratio.
export const WIDE_MIN_W = 720;
export const WIDE_RATIO = 23 / 20;
/** The app is never wider than this on a desktop (the board is height-bound well before). */
export const WIDE_MAX_APP = 1180;

export const isWideLayout = (w, h) => w >= WIDE_MIN_W && h > 0 && w / h >= WIDE_RATIO;
/** The side panel (HUD + dock): 36% of the app width, between 340 and 420px. */
export const wideScenePanel = (w) => Math.round(Math.max(340, Math.min(420, Math.min(w, WIDE_MAX_APP) * 0.36)));
/** The width left for the board beside the panel (app padding 8+8 and a 16px gap). */
export const wideSceneRoom = (w, panel) => Math.min(w, WIDE_MAX_APP) - panel - 32;
