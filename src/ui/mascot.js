// The mascot (a mouse leaving the race) built from the brand SVG, with three moods.
import { html } from './dom.js';

const INK = '#2B1B4D';
const FACE = {
  normal: `<circle cx="24" cy="30" r="3.4" fill="${INK}"/><circle cx="40" cy="30" r="3.4" fill="${INK}"/><circle cx="25" cy="29" r="1.1" fill="#fff"/><circle cx="41" cy="29" r="1.1" fill="#fff"/><ellipse cx="32" cy="36" rx="3.2" ry="2.4" fill="#FF7AB6" stroke="${INK}" stroke-width="1.5"/><path d="M27 40 Q32 44.5 37 40" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  happy: `<path d="M19 30q5-5 10 0M35 30q5-5 10 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="36" rx="3.2" ry="2.4" fill="#FF7AB6" stroke="${INK}" stroke-width="1.5"/><path d="M25 39q7 8 14 0z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  sad: `<circle cx="24" cy="31" r="3.2" fill="${INK}"/><circle cx="40" cy="31" r="3.2" fill="${INK}"/><circle cx="25" cy="30" r="1" fill="#fff"/><circle cx="41" cy="30" r="1" fill="#fff"/><path d="M19 24q4-3 8-1M45 24q-4-3-8-1" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="32" cy="36" rx="3.2" ry="2.4" fill="#FF7AB6" stroke="${INK}" stroke-width="1.5"/><path d="M27 43 Q32 38.5 37 43" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
};

export function mascot({ mood = 'normal', width = 132, cls = '' } = {}) {
  const el = html(`<svg aria-hidden="true" focusable="false" width="${width}" height="${Math.round(width * 1.125)}" viewBox="0 0 64 72"><ellipse cx="22" cy="65" rx="7" ry="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/><ellipse cx="42" cy="65" rx="7" ry="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="16" y="40" width="32" height="24" rx="12" fill="#FF5A4E" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="53" r="5.5" fill="#FFB300" stroke="${INK}" stroke-width="2"/><circle cx="14" cy="16" r="10" fill="#CDBDFF" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="16" r="10" fill="#CDBDFF" stroke="${INK}" stroke-width="3"/><circle cx="14" cy="16" r="5" fill="#FF7AB6"/><circle cx="50" cy="16" r="5" fill="#FF7AB6"/><ellipse cx="32" cy="30" rx="20" ry="18" fill="#E4DAFF" stroke="${INK}" stroke-width="3"/><path d="M13 23 Q32 11 51 23" fill="none" stroke="#FFB300" stroke-width="5" stroke-linecap="round"/>${FACE[mood]}</svg>`);
  el.setAttribute('class', `mascot${cls ? ` ${cls}` : ''}`);
  return el;
}
