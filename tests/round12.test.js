// Round 12 fix loop: the one truthful 'what is left' phrasing, the h-almost trigger, the board hint for the payday square, family wording
// for cards / concepts / real-world notes / the kid how-to sheet (scanned for the adult terms), spoken negative amounts, red-free family tokens.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEngine, BOARD, botStep, cardView, hasFamilyWording, passiveIncome, totalExpenses } from '../src/engine/index.js';
import {
  leftTemplate, freedomView, almostEligible, createHintScheduler, nextPaydayDistance, summarySquareDue, rollRange, SQUARE_HINT_MAX_TAKES,
} from '../src/learn/tutorial.js';
import { learnContent } from '../src/learn/content.js';
import { setLearnMode } from '../src/learn/context.js';
import { reportView } from '../src/learn/report.js';
import { moneySpoken } from '../src/ui/format.js';
import { stripMarkup } from '../src/i18n/markup.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const read = (p) => JSON.parse(src(`src/data/${p}`));
const cards = read('cards.he.json');
const engine = createEngine({ professions: read('professions.he.json'), cards });

/** The adult terms (docs/v2/tutorial/spec.md, Changelog rounds 11 and 12; 'תשואות' is caught by 'תשואה'? no: the plural has a different stem). */
export const FORBIDDEN = [
  'ריבית', 'תזרים', 'כרית', 'תשואה', 'תשואות', 'מקדמה', 'הכנסה פסיבית', 'הכנסות פסיביות', 'פסיבית', 'משכנתא', 'התחייבות', 'התחייבויות',
  'החזר השקעה', 'דיבידנד', 'שווי נקי', 'פיזור', 'מהי ',
];
const RE = new RegExp(FORBIDDEN.join('|'), 'u');
const leaks = (pairs) => pairs.filter(([, text]) => RE.test(stripMarkup(String(text)))).map(([where, text]) => `${where}: ${text}`);

const WORDS = { andABit: 'ועוד קצת', onTheLine: 'ממש על הקו! עוד קצת' };
const withState = (passive, expenses) => {
  const s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
  const gap = expenses - totalExpenses(s);
  s.expenseItems = [...(s.expenseItems ?? []), { label: 'x', amount: gap }];
  s.assets = [{ id: 'a1', cardId: 'x', type: 'apartment', title: 'x', monthlyCashFlow: passive, mortgage: 0 }];
  return s;
};

describe('item 8: one truthful phrasing of what is left to freedom', () => {
  it('left > 0 adds "ועוד קצת" after the amount (winning needs strictly more)', () => {
    expect(leftTemplate('עוד {left} בחודש לחופש', 410, WORDS)).toBe('עוד {left} ועוד קצת בחודש לחופש');
    expect(leftTemplate('כמעט חופשיים! עוד {left} בחודש', 1, WORDS)).toBe('כמעט חופשיים! עוד {left} ועוד קצת בחודש');
  });
  it('left = 0 (exactly on the line) is the on-the-line sentence, never "עוד ₪0"', () => {
    expect(leftTemplate('עוד {left} בחודש לחופש', 0, WORDS)).toBe(WORDS.onTheLine);
  });
  it('a template that already says it is left alone', () => {
    const t = 'עוד {left} בחודש ועוד קצת, והכסף שעובד יעקוף את ההוצאות.';
    expect(leftTemplate(t, 300, WORDS)).toBe(t);
  });
  it('freedomView agrees: left = expenses - passive, onTheLine when equal, won only when strictly above', () => {
    const e = totalExpenses(engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 }));
    expect(freedomView(withState(e - 410, e)).left).toBe(410);
    expect(freedomView(withState(e, e)).kind).toBe('onTheLine');
    expect(freedomView(withState(e + 1, e)).kind).toBe('won');
  });
  it('the HUD goal line, the h-meter and h-almost all go through the one helper', () => {
    for (const f of ['src/ui/hud-family.js', 'src/ui/play.js']) expect(src(f), f).toMatch(/leftWords|leftNodes/);
    expect(src('src/ui/hint-ui.js')).toContain('leftTemplate');
  });
});

describe('item 4: h-almost fires at 75%+ (also exactly on the line) and outranks the other floating hints', () => {
  const e = totalExpenses(engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 }));
  it('the trigger: below 75% no, 75%..99% yes, exactly on the line yes, won no', () => {
    expect(almostEligible(withState(Math.floor(e * 0.74), e))).toBe(false);
    expect(almostEligible(withState(Math.ceil(e * 0.75), e))).toBe(true);
    expect(almostEligible(withState(Math.floor(e * 0.94), e))).toBe(true);
    expect(almostEligible(withState(e, e))).toBe(true);
    expect(almostEligible(withState(e + 1, e))).toBe(false);
  });
  const prio = { 'h-meter': 5, 'h-almost': 5, 'h-expense-paid': 3, 'h-summary-square': 2, 'h-roll': 6 };
  const sched = () => createHintScheduler({ seen: {}, active: () => true, priorityOf: (id) => prio[id] ?? 9 });
  it('at 94% h-almost shows first, even behind a queue of busier hints, and h-meter retires', () => {
    const s = sched();
    s.offer('h-meter', 1); s.offer('h-expense-paid', 1); s.offer('h-summary-square', 1);
    s.offer('h-almost', 2);
    expect(s.takeFloating(2).id).toBe('h-almost');
    expect(s.pending).not.toContain('h-meter');
    s.newTurn(); s.offer('h-meter', 3);
    expect(s.pending).not.toContain('h-meter'); // never offered again once h-almost is waiting or seen
  });
  it('a released h-almost is put back (never lost) and still first', () => {
    const s = sched();
    s.offer('h-almost', 4); const got = s.takeFloating(4);
    s.release(got.id, 4); s.newTurn(); s.offer('h-expense-paid', 5);
    expect(s.takeFloating(5).id).toBe('h-almost');
  });
});

describe('item 7: the payday-square hint is reachable from turn 1', () => {
  it('distances on the real board (paydays at 0, 4, 7, 10, 17)', () => {
    expect(BOARD.map((s, i) => (s === 'payday' ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 7, 10, 17]);
    expect(nextPaydayDistance(BOARD, 0)).toBe(4);
    expect(nextPaydayDistance(BOARD, 4)).toBe(3);
    expect(nextPaydayDistance(BOARD, 17)).toBe(7);
    expect(rollRange({ charityTurns: 0 })).toBe(6);
    expect(rollRange({ charityTurns: 2 })).toBe(12);
  });
  it('due at turn 0 (before the first roll) from the start square: the next payday is within the roll range', () => {
    expect(summarySquareDue({ board: BOARD, position: 0, turn: 0 })).toBe(true);
  });
  it('due while a payday is within one roll; not when it is out of range, after the first summary, or after turn 3', () => {
    expect(summarySquareDue({ board: BOARD, position: 2, turn: 1 })).toBe(true);
    expect(summarySquareDue({ board: BOARD, position: 10, turn: 2 })).toBe(false); // next payday is 7 steps away
    expect(summarySquareDue({ board: BOARD, position: 10, turn: 2, charityTurns: 2 })).toBe(true); // two dice reach it
    expect(summarySquareDue({ board: BOARD, position: 2, turn: 1, summarySeen: true })).toBe(false);
    expect(summarySquareDue({ board: BOARD, position: 2, turn: 4 })).toBe(false);
  });
  it('taken before the first roll, skipped by that roll, it is re-offered (once: two takes at most)', () => {
    const s = createHintScheduler({ seen: {}, active: () => true, priorityOf: () => 2 });
    s.offer('h-summary-square', 0);
    const first = s.takeFloating(0);
    expect(first.id).toBe('h-summary-square');
    s.release(first.id, 0); // the player rolled before the fox spoke
    s.newTurn();
    expect(s.takeFloating(1).id).toBe('h-summary-square');
    expect(SQUARE_HINT_MAX_TAKES).toBe(2);
  });
  it('the board screen drops the hint after the cap and the roll hint after the first roll', () => {
    const play = src('src/ui/play.js');
    expect(play).toContain('SQUARE_HINT_MAX_TAKES');
    expect(play).toContain("hints.drop('h-roll')");
  });
});

describe('item 10: negative amounts read aloud as words, not a double hyphen', () => {
  it('moneySpoken', () => {
    expect(moneySpoken(-58240)).toBe('מינוס ₪58,240');
    expect(moneySpoken(1200)).toBe('₪1,200');
    expect(moneySpoken(-58240)).not.toContain('--');
  });
  it('the summary sentence for a screen reader uses it', () => {
    expect(src('src/ui/summary-card.js')).toContain('moneySpoken(f.cashAfter)');
  });
});

describe('item 9: family mode shows no red', () => {
  it('the family tokens turn the expense colours into amber, in both themes', () => {
    const css = src('src/styles/tokens.css');
    expect(css).toMatch(/:root\[data-learn="family"\]\s*\{[^}]*--expense:\s*#FFD27A[^}]*--expense-ink:\s*#6E4200/);
    expect(css).toMatch(/:root\[data-learn="family"\]\[data-theme="light"\]\s*\{[^}]*--expense:\s*#6E4200/);
  });
  it('the learn mode sets the root attribute the tokens key on', () => {
    expect(src('src/learn/context.js')).toContain('dataset.learn');
  });
});

describe('item 3: family wording for cards (textFamily / titleFamily) leaves no adult term', () => {
  const familyCards = cards.filter((c) => c.modes.includes('family'));
  it('the educator supplied family wording for the seven flagged cards and one title', () => {
    for (const id of ['opp-apt-003', 'opp-apt-004', 'opp-apt-008', 'opp-apt-012', 'opp-biz-005', 'opp-biz-007', 'opp-biz-013']) expect(cards.find((c) => c.id === id).textFamily, id).toBeTruthy();
    expect(cards.find((c) => c.id === 'opp-apt-012').titleFamily).toBeTruthy();
  });
  it('cardView: family uses the family wording, full never does, numbers are identical', () => {
    for (const c of cards.filter(hasFamilyWording)) {
      const f = cardView(c, 'family'); const full = cardView(c, 'full');
      expect(full.title).toBe(c.title); expect(full.text).toBe(c.text);
      expect(f.text).toBe(c.textFamily || c.text);
      for (const k of ['price', 'downPayment', 'mortgage', 'monthlyCashFlow', 'amount', 'dividend']) expect(f[k], `${c.id}.${k}`).toBe(c[k]);
    }
  });
  it('every card a family game can draw (title and text, as the family view) is free of the forbidden terms', () => {
    const pairs = familyCards.flatMap((c) => { const v = cardView(c, 'family'); return [[`${c.id}.title`, v.title], [`${c.id}.text`, v.text]]; });
    expect(leaks(pairs), `\n${leaks(pairs).join('\n')}`).toEqual([]);
  });
  it('a family game draws the card with the family wording (engine), a full game the plain one', () => {
    const seen = { family: new Set(), full: new Set() };
    for (const mode of ['family', 'full']) {
      for (let seed = 1; seed <= 40; seed++) {
        let s = engine.newGame({ mode, professionId: 'teacher', seed });
        for (let k = 0; k < 60 && s.status === 'playing'; k++) {
          s = botStep(engine, s, 'sensible');
          const c = s.pending?.card;
          if (c) seen[mode].add(`${c.id}|${c.title}|${c.text}`);
          if (!s.pending && s.phase !== 'roll') break;
        }
      }
    }
    expect(seen.family.size).toBeGreaterThan(20);
    const fam = [...seen.family].map((x) => x.split('|'));
    expect(leaks(fam.flatMap(([id, title, text]) => [[`${id}.title`, title], [`${id}.text`, text]]))).toEqual([]);
    for (const x of seen.full) { const [id, title, text] = x.split('|'); const c = cards.find((k) => k.id === id); expect(title).toBe(c.title); expect(text).toBe(c.text); }
  });
});

describe('item 3: concepts, real-world notes and the kid how-to in family mode', () => {
  beforeAll(() => setLearnMode('family'));
  it('the win report lists the children\'s names of the concepts, not the terms', () => {
    const lc = learnContent();
    const names = lc.report.sections.concepts.names;
    let s = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    s = { ...s, status: 'won', learn: { ...s.learn, concepts: lc.glossary.concepts.filter((c) => c.level === 'family').map((c) => c.id) } };
    const v = reportView(s, { seed: 1 });
    const sec = v.sections.find((x) => x.id === 'concepts');
    expect(leaks([['report.concepts', sec.text]])).toEqual([]);
    for (const id of s.learn.concepts) if (names[id]) expect(sec.text, id).toContain(names[id]);
    setLearnMode('full');
    const full = reportView({ ...s, mode: 'full' }, { seed: 1 }).sections.find((x) => x.id === 'concepts').text;
    expect(full).toContain('תזרים'); // full mode keeps the real terms
    setLearnMode('family');
  });
  it('real-world facts shown on family cards use gameFamily / realFamily and have no adult term', () => {
    const lc = learnContent();
    const famIds = new Set(cards.filter((c) => c.modes.includes('family')).map((c) => c.id));
    const pairs = lc.realWorld.facts.filter((f) => f.cardIds?.some((id) => famIds.has(id)) || f.appliesTo).flatMap((f) => [[`${f.id}.game`, f.game], [`${f.id}.real`, f.real]]);
    expect(leaks(pairs), `\n${leaks(pairs).join('\n')}`).toEqual([]);
  });
  it('family concepts: why / example / game simplification of the family view have no adult term', () => {
    const lc = learnContent();
    const pairs = lc.glossary.concepts.filter((c) => c.level === 'family' && c.family).flatMap((c) => [[`${c.id}.why`, c.why], [`${c.id}.example`, c.example?.text ?? ''], [`${c.id}.sim`, c.gameSimplification ?? '']]);
    // (the example of the 'interest' concept would carry slots; the scan reads the raw family text)
    expect(leaks(pairs), `\n${leaks(pairs).join('\n')}`).toEqual([]);
  });
  it('the kid how-to sheet has howtoKid.note and never the adult howto.note or howto.dailyNote', () => {
    const code = src('src/ui/settings.js');
    const kid = code.slice(code.indexOf('async function openHowToFamily'));
    expect(kid).toContain('howtoKid.note');
    expect(kid).not.toMatch(/howto\.note|howto\.dailyNote/);
    expect(learnContent().tutorial.howtoKid.note).toBeTruthy();
    expect(leaks([...learnContent().tutorial.howtoKid.steps.entries()].map(([i, s]) => [`step${i}`, s]).concat([['note', learnContent().tutorial.howtoKid.note]]))).toEqual([]);
  });
});

describe('items 12, 2, 16, 17: story part 5, the h-card source ring, the home link arming, the compact cash label', () => {
  it('the simplification box shows on part 4 only', () => {
    const s5 = learnContent().tutorial.story.screens.find((s) => s.id === 's5-turn');
    expect(s5.simplificationShowOnParts).toEqual(['p4-times']);
    expect(src('src/ui/tutorial/story.js')).toContain('simplificationShowOnParts');
  });
  it('the h-card source ring is only drawn on something the player can see', () => {
    expect(src('src/ui/modals.js')).toMatch(/elementFromPoint[\s\S]{0,200}target = null/);
  });
  it('the home link arms with the same sweep as the primary button', () => {
    expect(src('src/ui/modals.js')).toMatch(/btn-handoff-home is-arming/);
    expect(src('src/styles/tutorial.css')).toMatch(/\.btn-handoff-home\.is-arming::after/);
  });
  it('short screens show a compact cash word instead of hiding the caption', () => {
    expect(src('src/ui/play.js')).toContain('cap-short');
    expect(src('src/styles/tutorial.css')).toMatch(/max-height: 640px\) \{ \.cash-cap \.cap-long \{ display: none; \}/);
  });
  it('the toast steps out of the way of every control', () => {
    expect(src('src/ui/fx.js')).toContain('placeToast');
    expect(src('src/styles/base.css')).toContain('.toast.is-passive');
  });
});

describe('production pruning keeps what the screens render', () => {
  it('howtoKid.note survives the build-time prune of the tutorial file (it was stripped as an authoring note)', async () => {
    const { pruneLearn } = await import('../scripts/prune-learn.js');
    const pruned = pruneLearn('tutorial', read('learn/tutorial.he.json'));
    expect(pruned.howtoKid.note).toBe(read('learn/tutorial.he.json').howtoKid.note);
    expect(pruned.howtoKid.steps.length).toBe(5);
  });
});
