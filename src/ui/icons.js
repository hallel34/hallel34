// Inline SVG icons (24x24, stroke = currentColor). Decorative: always aria-hidden.
import { html } from './dom.js';

const PATHS = {
  payday: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  opportunity: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  expense: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  market: '<path d="M4 20h16M7 16v-4M12 16V8M17 16V5"/>',
  baby: '<circle cx="12" cy="13" r="8"/><path d="M9 12.5v.1M15 12.5v.1M9.5 16.5q2.5 2 5 0M12 5q2-2 3 0"/>',
  charity: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  statement: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  arrow: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.1"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
};

export function icon(name, { size = 24, width = 2.4, cls = '' } = {}) {
  const el = html(
    `<svg aria-hidden="true" focusable="false" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`,
  );
  const classes = `icon${cls ? ` ${cls}` : ''}${name === 'arrow' ? ' icon-dir' : ''}`;
  el.setAttribute('class', classes);
  return el;
}

/** Large illustrations for the card header (64x64, ink outlines, flat fills). */
const ART = {
  apartment: '<path d="M6 30L32 8l26 22v26H6z" fill="#FFF8EC"/><path d="M6 30L32 8l26 22" fill="#FF5A4E"/><rect x="26" y="38" width="12" height="18" rx="2" fill="#6BE3A8"/><rect x="11" y="34" width="10" height="10" rx="2" fill="#9BD3FF"/><rect x="43" y="34" width="10" height="10" rx="2" fill="#9BD3FF"/>',
  business: '<path d="M8 26h48v30H8z" fill="#FFF8EC"/><path d="M6 26l4-14h44l4 14z" fill="#FF5A4E"/><path d="M14 26v4a4 4 0 0 0 8 0v-4M22 26v4a4 4 0 0 0 8 0v-4M30 26v4a4 4 0 0 0 8 0v-4M38 26v4a4 4 0 0 0 8 0v-4M46 26v4a4 4 0 0 0 4 4" fill="#FFC83D"/><rect x="24" y="38" width="16" height="18" rx="2" fill="#6BE3A8"/>',
  stock: '<rect x="8" y="8" width="48" height="48" rx="8" fill="#FFF8EC"/><path d="M14 44l12-12 8 8 16-20" fill="none" stroke="#3DDC97" stroke-width="5"/><path d="M42 20h8v8" fill="none" stroke="#3DDC97" stroke-width="5"/>',
  expense: '<path d="M36 4L12 36h16l-4 24 28-34H34z" fill="#FFC83D"/>',
  market: '<rect x="8" y="40" width="10" height="16" rx="2" fill="#FFF8EC"/><rect x="27" y="26" width="10" height="30" rx="2" fill="#FFF8EC"/><rect x="46" y="10" width="10" height="46" rx="2" fill="#6BF0B8"/>',
  charity: '<path d="M32 56S6 40 6 22a13 13 0 0 1 26-5 13 13 0 0 1 26 5c0 18-26 34-26 34z" fill="#FF8FC4"/>',
  baby: '<circle cx="32" cy="34" r="22" fill="#FFF8EC"/><circle cx="24" cy="32" r="3" fill="#2B1B4D"/><circle cx="40" cy="32" r="3" fill="#2B1B4D"/><path d="M25 42q7 6 14 0" fill="none"/><path d="M30 12q4-8 10-2" fill="none"/><circle cx="19" cy="40" r="3" fill="#FF8FC4" stroke="none"/><circle cx="45" cy="40" r="3" fill="#FF8FC4" stroke="none"/>',
};
export function cardArt(kind, size = 132) {
  const el = html(
    `<svg aria-hidden="true" focusable="false" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="#2B1B4D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ART[kind] || ART.apartment}</svg>`,
  );
  el.setAttribute('class', 'card-art');
  return el;
}
