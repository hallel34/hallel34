// Family mode must never show the adult money words on its key screens (spec section 8): the override layer
// (tutorial.familyStrings.overrides: locale-file keys and 'file:path' keys of the learn files) covers every surface.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { learnContent, familyOverrideMap, contentOverrides, splitContentKey } from '../src/learn/content.js';
import { setLearnMode } from '../src/learn/context.js';
import { rawString, tRaw } from '../src/i18n/index.js';
import { stripMarkup } from '../src/i18n/markup.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));

/**
 * The adult words of spec section 8 + the educator's list (docs/v2/tutorial/spec.md, 'Changelog (round 11)'): a plain substring
 * search, so the usual Hebrew prefixes (ה/ב/ל/מ/ש/ו/כ) are caught too ('ההכנסה הפסיבית', 'המקדמה', 'לריבית').
 */
export const FORBIDDEN = [
  'ריבית', 'תזרים', 'כרית', 'תשואה', 'מקדמה', 'הכנסה פסיבית', 'הכנסות פסיביות', 'פסיבית', 'משכנתא', 'התחייבות', 'התחייבויות',
  'החזר השקעה', 'דיבידנד', 'שווי נקי', 'פיזור', 'מהי ',
];
const FORBIDDEN_RE = new RegExp(FORBIDDEN.join('|'), 'u');
/** The only places where the real term is shown on purpose (spec: 'חריגים מותרים'): the story's first screen names it once. */
const ALLOWED = /^tutorial\.story\.screens\.0\.lines/;
const NON_TEXT = new Set(['notes', 'computed', 'was', 'sampleText', 'sampleOneLine', 'sampleNoAsset', 'sample', 'ownerWording', 'trigger', 'note', 'howto', 'keepAsIs', 'showWhile', 'round11', 'round13', 'example', 'target', 'targetKey', 'textKey', 'a11y', 'reducedMotion', 'assumes', 'id', 'pose', 'term', 'level', 'kidName', 'kidShort', 'opening', 'tier', 'when', 'minNeeded', 'readSec']);

function* walk(v, path = []) {
  if (typeof v === 'string') yield [path.join('.'), v];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* walk(x, [...path, i]);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!NON_TEXT.has(k)) yield* walk(x, [...path, k]);
}

/** Locale-file groups shown in family mode (full-only, stock-only and daily-share strings are not family surfaces). */
const HE_GROUPS = ['game', 'card', 'loan', 'win', 'gameOver', 'fox', 'pick', 'stats', 'standings', 'a11y'];
const FULL_ONLY = /Stock|dividend|netWorth|repay|sell|Sell|share|daily/;

describe('family vocabulary: no adult money words on the key screens', () => {
  let leaks;
  beforeAll(() => {
    setLearnMode('family');
    const lc = learnContent();
    const map = familyOverrideMap(lc.tutorial);
    leaks = [];
    const check = (where, text) => { const plain = stripMarkup(text); if (!ALLOWED.test(where) && FORBIDDEN_RE.test(plain)) leaks.push(`${where}: ${plain}`); };
    // locale file with the family layer on top (what t() returns in family mode)
    for (const g of HE_GROUPS) for (const [p] of walk(he[g], [g])) { if (FULL_ONLY.test(p)) continue; check(`he.json ${p}`, tRaw(p)); }
    // learn files (family view): feedback (family + shared lines), guess, report, hints, summary card, HUD, goal line, how-to, story
    // feedback: the lines a family player really gets = the group's family list, else its shared (all) list (feedback.js resolve)
    const feedbackLines = {};
    const groups = (node, path = []) => {
      if (Array.isArray(node)) return;
      if (node && typeof node === 'object' && (node.family || node.all || node.full) && [node.family, node.all, node.full].some(Array.isArray)) { feedbackLines[path.join('.')] = node.family ?? node.all ?? []; return; }
      for (const [k, v] of Object.entries(node ?? {})) groups(v, [...path, k]);
    };
    groups(lc.feedback.lines);
    const surfaces = {
      feedback: feedbackLines, guess: lc.guess, report: lc.report,
      'tutorial.hints': lc.tutorial.hints.items, 'tutorial.summary': lc.tutorial.summaryBreakdown, 'tutorial.hud': lc.tutorial.hudFamily,
      'tutorial.goal': lc.tutorial.goalLine, 'tutorial.howto': lc.tutorial.howtoKid, 'tutorial.story': lc.tutorial.story,
    };
    for (const [name, node] of Object.entries(surfaces)) {
      for (const [p, text] of walk(node, [name])) {
        if (/\.full\.|\.full$|labelFull|templateFull|zeroTemplateFull|stock|Stock|dividend|investorEye|conversation\.full|\.family\.note/.test(p)) continue;
        check(p, text);
      }
    }
    void map;
  });
  it('lists no forbidden word in any family-mode string', () => {
    expect(leaks, `\n${leaks.join('\n')}`).toEqual([]);
  });
  it('the matcher itself catches the adult words (and with prefixes)', () => {
    for (const w of ['המקדמה חוזרת', 'תשואה של 5%', 'לכרית הביטחון', 'ריבית ששילמתם', 'התזרים עולה', 'הכנסה פסיבית', 'מהי הלוואה', 'ההכנסה הפסיבית']) expect(FORBIDDEN_RE.test(w), w).toBe(true);
    for (const w of ['כסף שעובד בשבילכם', 'התשלום הראשון', 'תוספת על ההלוואה', 'מה שנשאר בחודש']) expect(FORBIDDEN_RE.test(w), w).toBe(false);
  });
  it('every override entry points at a real string and uses only the slots of the original', () => {
    const lc = learnContent();
    const slots = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const full = (file, path) => path.split('.').reduce((o, k) => o?.[k], file);
    setLearnMode('full');
    const base = learnContent();
    for (const { key, family } of contentOverrides(lc.tutorial)) {
      const [file, path] = splitContentKey(key);
      const orig = full(base[file], path);
      expect(typeof orig, key).toBe('string');
      for (const sl of slots(family)) expect(slots(orig), `${key} {${sl}}`).toContain(sl);
    }
    for (const o of lc.tutorial.familyStrings.overrides.filter((x) => !x.key.includes(':'))) expect(rawString(o.key, 'he'), o.key).toBeTypeOf('string');
    setLearnMode('family');
  });
  it('full mode keeps the original wording on the same surfaces', () => {
    setLearnMode('full');
    expect(tRaw('game.passive')).toBe('הכנסה פסיבית');
    setLearnMode('family');
  });
});
