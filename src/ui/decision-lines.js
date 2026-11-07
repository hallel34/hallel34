// The decision-card fox line of this device (QA L3): one rotation for every seat and every board, and never the line that
// was shown last, even after the board is re-created (resume, home and back, a reload). Presentation only.
import { readRaw, writeRaw } from '../services/storage.js';

const KEY = 'decisionLine'; // the last decision line shown on this device (filled text)
const rotation = new Map(); // variants key -> next start index (this page session)

/**
 * Picks the line to show from `variants` (templates) given `fill(template) -> text`. Rotates through the variants and skips
 * any whose text equals the last line shown on the device. Returns { line, text }, or null when every variant would repeat it
 * (the note is then not shown). Records the shown text.
 */
export function nextDecisionLine(variants, fill) {
  if (!variants?.length) return null;
  const last = readRaw(KEY);
  const key = variants.join('\u0001');
  const start = rotation.get(key) ?? 0;
  for (let k = 0; k < variants.length; k++) {
    const i = (start + k) % variants.length;
    const text = fill(variants[i]);
    if (text && text !== last) {
      rotation.set(key, i + 1);
      writeRaw(KEY, text);
      return { line: variants[i], text };
    }
  }
  return null;
}
