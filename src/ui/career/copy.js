// 0.5.0 career copy: full mode = the base key; family = the override layer (t() applies it); a protected / junior viewer = the
// `<key>Junior` sibling when there is one, else the family string (the same pattern as the challenge strings).
import { t, tp, rawString } from '../../i18n/index.js';

let junior = false;
/** The career screens speak kid words for a protected profile (age up to 10): set once per screen from the profile. */
export const setCareerJunior = (on) => { junior = !!on; };
export const careerJunior = () => junior;

/** t() for a key of the career groups (career / profile / achievement / promotion), with the Junior sibling. */
export function ck(key, params) {
  return t(junior && rawString(`${key}Junior`, 'he') !== undefined ? `${key}Junior` : key, params);
}
export { t, tp };
