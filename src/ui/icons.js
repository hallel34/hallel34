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
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5M9 8h6M9 12h4"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  // 0.5.1 challenge icons (src/assets/challenge/*.svg, drawn at stroke 2: pass { width: 2 })
  challenge: '<circle cx="7" cy="7.5" r="2.5"/><path d="M3.5 18.5l1.6-6.2h3.8l1.6 6.2"/><circle cx="17" cy="7.5" r="2.5"/><path d="M13.5 18.5l1.6-6.2h3.8l1.6 6.2"/><path d="M2.5 21h19"/><path d="M12 3v3M10.5 4.5h3"/>',
  verified: '<path d="M12.00 3.70Q15.28 1.92 16.88 5.29Q20.58 5.77 19.89 9.44Q22.60 12.00 19.89 14.56Q20.58 18.2 16.88 18.71Q15.28 22.08 12.00 20.30Q8.72 22.08 7.12 18.71Q3.42 18.2 4.11 14.56Q1.40 12.00 4.11 9.44Q3.42 5.77 7.12 5.29Q8.72 1.92 12.00 3.70z"/><path d="M8.3 12.2l2.5 2.5 4.9-5"/>',
  unverified: '<path d="M12.00 3.70Q15.28 1.92 16.88 5.29Q20.58 5.77 19.89 9.44Q22.60 12.00 19.89 14.56Q20.58 18.2 16.88 18.71Q15.28 22.08 12.00 20.30Q8.72 22.08 7.12 18.71Q3.42 18.2 4.11 14.56Q1.40 12.00 4.11 9.44Q3.42 5.77 7.12 5.29Q8.72 1.92 12.00 3.70z" stroke-dasharray="2.2 2.2"/><path d="M9 12h6"/>',
  familyBoard: '<path d="M3 20.5V15h6v5.5M9 20.5V11h6v9.5M15 20.5V13.5h6v7M2 20.5h20"/><path d="M12 3.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.2 3.8v3.4h3.4"/><path d="M10.5 9.2v5.6l4.4-2.8z"/>',
  split: '<path d="M12 21v-7"/><path d="M12 14L6.4 6.4M12 14l5.6-7.6"/><path d="M6 10.5V6h4.5M18 10.5V6h-4.5"/>',
  // 0.5.0 career icons (src/assets/career/*.svg, stroke 2: pass { width: 2 })
  rank0: '<circle cx="12" cy="12" r="3.5"/>',
  rank1: '<path d="M6 14.5l6-5 6 5"/>',
  rank2: '<path d="M6 11.7l6-5 6 5"/><path d="M6 17.3l6-5 6 5"/>',
  rank3: '<path d="M6 9l6-5 6 5"/><path d="M6 14.5l6-5 6 5"/><path d="M6 20l6-5 6 5"/>',
  seniority: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8.7 15.2l2.3 2.3 4.4-4.6"/>',
  seniorityDue: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 12.8v2.9l2 1.3"/>',
  seniorityWait: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M10.2 13.3v4M13.8 13.3v4"/>',
  promoWeek: '<path d="M12 20.5V9"/><path d="M7 13.5l5-5 5 5"/><path d="M5 3.5v3M3.5 5h3"/><path d="M19 3.5v3M17.5 5h3"/>',
  achievementEarned: '<circle cx="12" cy="9.5" r="6"/><path d="M8.6 14.6L7 21l5-2.6 5 2.6-1.6-6.4"/><path d="M9.5 9.6l1.8 1.8 3.2-3.5"/>',
  achievementLocked: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>',
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
