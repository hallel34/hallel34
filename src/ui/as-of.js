// The "נכון ל-2026" tag + source link of a real-world figure (tax audit, dictionary, statement popover). Its own module so the
// dictionary and statement don't pull the tax-audit card (and with it the card modals) onto the home screen (QA round 19 perf).
import { h } from './dom.js';
import { t } from '../i18n/index.js';

const fill = (s, slots) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in slots ? String(slots[k]) : m));

/** The "as of" tag and the source link line. */
export function asOfLine(ui, { asOf, ref }) {
  return h('p', { class: 'audit-meta' },
    h('span', { class: 'asof-tag' }, fill(ui.asOfLabel, { asOf })),
    ref?.url ? h('a', { class: 'src-link', href: ref.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('taxAudit.linkA11y', { name: `${ui.sourceLabel}: ${ref.name}` }) }, `${ui.sourceLabel}: ${ref.name}`) : null);
}
