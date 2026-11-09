// 0.5.1 "שלחו אתגר" sheet (spec §1.2): optional display name (never for a junior viewer), a preview of the exact text, one gold
// "שלחו קישור" that goes through shareText() with the end.js fallback (a readonly textarea to copy by hand).
import '../../styles/challenge.css';
import { h } from '../dom.js';
import { openLayer, closeButton } from '../modal.js';
import { button } from '../widgets.js';
import { icon } from '../icons.js';
import { haptic, toast } from '../fx.js';
import { shareText } from '../screens/daily.js';
import { ct, isJuniorView } from './copy.js';
import { readRaw, writeRaw } from '../../services/storage.js';
import { NAME_KEY } from '../../services/challenge-store.js';
import { sanitizeDisplayName, NAME_MAX_CHARS } from '../../engine/index.js';

/**
 * @param build (name) => { text, link }   the message and the link text for a (sanitized) name
 * @param fresh   the creator's game cannot be compared: show create.freshNote
 * @param onSend  (name, built) => void    called once per tap on "שלחו קישור", before sharing (stores the challenge)
 * @returns the layer's closed promise
 */
export function openShareSheet({ build, fresh = false, onSend, title = ct('create.sendTitle') }) {
  const junior = isJuniorView();
  let layer;
  const input = junior ? null : h('input', {
    type: 'text', class: 'ch-name-input', id: 'ch-name', maxlength: String(NAME_MAX_CHARS * 2), autocomplete: 'nickname', enterkeyhint: 'done',
    placeholder: ct('create.namePlaceholder'), 'data-ch-name': '', 'aria-describedby': 'ch-name-hint',
  });
  if (input) input.value = sanitizeDisplayName(readRaw(NAME_KEY) ?? '');
  const counter = input ? h('span', { class: 'ch-name-count', 'aria-hidden': 'true' }) : null;
  const preview = h('p', { class: 'ch-preview', 'data-ch-preview': '' });
  const status = h('p', { class: 'ch-status', role: 'status', hidden: true });
  const box = h('textarea', { class: 'daily-sharebox ch-sharebox', readonly: '', hidden: true, rows: 3, 'aria-label': ct('create.textBox'), 'data-sharebox': '' });
  const name = () => (input ? sanitizeDisplayName(input.value) : '');
  const refresh = () => {
    const built = build(name());
    preview.textContent = built.text;
    if (counter) counter.textContent = `${Array.from(name()).length}/${NAME_MAX_CHARS}`;
    return built;
  };
  input?.addEventListener('input', () => {
    // keep at most 16 characters as typed (code points), the same cut the link makes
    const cut = Array.from(input.value).slice(0, NAME_MAX_CHARS).join('');
    if (cut !== input.value) input.value = cut;
    refresh();
  });
  const send = button([icon('share', { size: 22, width: 2.4 }), ct('create.send')], { variant: 'primary', size: 'lg', cls: 'ch-send', 'data-action': 'ch-send', onClick: () => go() });
  const done = button(ct('create.close'), { variant: 'secondary', cls: 'ch-done', 'data-action': 'ch-close', hidden: true, onClick: () => layer.close(true) });
  async function go() {
    haptic('tap');
    const n = name();
    if (input) writeRaw(NAME_KEY, n);
    const built = refresh();
    onSend?.(n, built);
    const r = await shareText(built.text, { title });
    if (r === 'shared') { layer.close(true); toast(ct('create.sent')); return; }
    if (r === 'cancelled') return;
    send.hidden = true; done.hidden = false; // after the job is done the sheet has no gold
    status.hidden = false;
    if (r === 'copied') { status.textContent = ct('create.copied'); return; }
    status.textContent = ct('create.failedManual');
    box.value = built.text.replace(/[⁦-⁩]/g, '');
    box.hidden = false; box.focus({ preventScroll: true }); box.select();
  }
  const content = h('div', { class: 'sheet ch-sheet', 'data-ch-sheet': '' },
    h('div', { class: 'sheet-head' }, h('h2', { class: 'dialog-title' }, title), closeButton(() => layer.close(false))),
    h('div', { class: 'ch-sheet-body' },
      h('p', { class: 'ch-lead' }, ct('create.lead')),
      fresh ? h('p', { class: 'banner banner-info ch-fresh-note', 'data-ch-fresh': '' }, icon('help', { size: 20 }), h('span', null, ct('create.freshNote'))) : null,
      input ? h('div', { class: 'ch-field' },
        h('label', { class: 'ch-name-label', for: 'ch-name' }, ct('create.nameLabel')),
        h('div', { class: 'ch-name-wrap' }, input, counter),
        h('p', { class: 'ch-hint', id: 'ch-name-hint' }, ct('create.nameHint'))) : null,
      preview, status, box),
    h('div', { class: 'sheet-cta' }, send, done));
  refresh();
  layer = openLayer(content, { kind: 'sheet', label: title, cls: 'layer-ch-sheet' });
  return layer.closed;
}
