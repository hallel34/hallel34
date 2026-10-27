// The growing-cafe scene from the business demo, reused inside the game for the coffee renovation
// (owner idea 2026-10-27: the demo's growing business belongs in the game itself).
// The owned, unrenovated coffee business shows as the demo's level 0 (the cart); each renovation level grows it.
import { html } from './dom.js';
import { scene } from '../../demo/scene.js';

/** The demo scene element for a renovation level (0-3) and level-2 style ('terrace' | 'takeaway' | null). */
export function cafeScene(level, style = null, cls = '') {
  const el = html(scene(level, style));
  if (cls) el.classList.add(cls);
  return el;
}
