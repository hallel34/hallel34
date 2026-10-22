// 'המשחק הראשון עם פסיבו': the pure rules (summary figures vs the engine, first-time triggers, hint scheduling, goal line,
// vocabulary layer, quiz) and the hot-seat one-tap hand-over contract.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createEngine, newMatch, canEndTurn, endTurn, currentState, setCurrentState, isMultiplayer, lastPlayerStanding, PAYDAY_MONTHS, BOARD,
} from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';
import { t, tRaw, setStringOverrides } from '../src/i18n/index.js';
import { learnContent, familyOverrideMap, termName, hasKidName, kidOf, conceptList } from '../src/learn/content.js';
import { setLearnMode } from '../src/learn/context.js';
import { validateLearn } from '../src/learn/validate.js';
import { pruneLearn } from '../scripts/prune-learn.js';
import {
  summaryFigures, goalLineVisible, hintsActive, tipReplaced, explainerAllowed, freedomView, leftToFreedom, createHintScheduler,
  summaryHintId, assetKindOf, createQuiz, shuffled, STORY_COVERED, GOAL_LINE_GAMES,
} from '../src/learn/tutorial.js';
import { summaryOneLine } from '../src/ui/summary-card.js';

const data = loadData('he');
const engine = createEngine(data);
const content = () => learnContent().tutorial;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('itemised summary: the card equals what the engine really did', () => {
  it('A + B - C = D, D x 24 = E and E is exactly the cash delta of the payday', () => {
    let checked = 0;
    for (const p of data.professions) {
      for (let seed = 1; seed <= 12; seed++) {
        let s = engine.newGame({ mode: 'family', professionId: p.id, seed });
        for (let turn = 0; turn < 30 && s.status === 'playing'; turn++) {
          const before = s;
          const next = engine.roll(s);
          const paydays = next.events.filter((e) => e.type === 'payday');
          let cash = before.cash;
          for (const pd of paydays) {
            const f = summaryFigures(before, pd, cash);
            expect(f.salary + f.passive - f.expenses, p.id).toBe(f.monthly);
            expect(f.monthly * PAYDAY_MONTHS).toBe(f.amount);
            expect(f.check).toBe(true);
            expect(f.cashAfter - f.cashBefore).toBe(f.amount);
            cash += pd.amount;
            checked += 1;
          }
          if (paydays.length) expect(cash - before.cash).toBe(paydays.reduce((a, x) => a + x.amount, 0));
          s = next;
          if (s.pending) {
            try {
              s = s.pending.kind === 'opportunity' ? engine.buy(s, 1) : s.pending.kind === 'expense' ? engine.takeLoan(s, 1000 * Math.ceil((s.pending.amount - s.cash) / 1000)) : s;
            } catch { s = s.pending.kind === 'opportunity' ? engine.pass(s) : s; }
          }
          if (s.pending || s.status !== 'playing') break;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('positive and negative one-liners (cash before / after in the card)', () => {
    setLearnMode('family');
    const teacher = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    const pos = summaryFigures(teacher, { monthly: 1490, amount: 35760, months: 24 }, 9000);
    expect(summaryOneLine(pos)).toBe('המשכורת שלכם ₪8,800, כסף שעובד ₪0, הוצאות ₪7,310 → נשארו ₪1,490 בחודש × 24 = ₪35,760');
    expect(pos.cashAfter).toBe(44760);
    const broke = { ...teacher, kids: 3 };
    const f = summaryFigures(broke, undefined, 100);
    expect(f.negative).toBe(f.monthly < 0);
    if (f.negative) expect(summaryOneLine(f)).toMatch(/מינוס/);
  });

  it('summary card and log use <bdi> amounts, aria description and a tap-to-dismiss button', () => {
    const src = read('src/ui/summary-card.js');
    expect(src).toContain("'bdi'");
    expect(src).toContain('aria-describedby');
    expect(src).toContain('summary-ok');
    expect(src).not.toMatch(/\bred\b|#f00/i);
  });
});

describe('first-time hints', () => {
  const items = () => content().hints.items;
  const sched = (over = {}) => {
    const marks = [];
    const s = createHintScheduler({ seen: {}, active: () => true, mark: (id, turn) => marks.push([id, turn]), priorityOf: (id) => items().find((i) => i.id === id).priority, ...over });
    return { s, marks };
  };

  it('there are eleven hints and every hint shows once', () => {
    expect(items()).toHaveLength(11);
    const { s, marks } = sched();
    expect(s.claim('h-card', 2)).toBe(true);
    expect(s.claim('h-card', 5)).toBe(false);
    expect(marks).toEqual([['h-card', 2]]);
  });

  it('at most one floating hint per turn, lowest priority number first; the rest wait', () => {
    const { s } = sched();
    s.offer('h-meter', 3); s.offer('h-expense-paid', 3); s.offer('h-roll', 3);
    const first = s.takeFloating(3);
    expect(first.id).toBe('h-expense-paid');
    expect(s.takeFloating(3)).toBeNull();
    s.newTurn();
    expect(s.takeFloating(4).id).toBe('h-meter');
    s.newTurn();
    expect(s.takeFloating(5).id).toBe('h-roll');
    s.newTurn();
    expect(s.takeFloating(6)).toBeNull();
  });

  it('a hint whose moment has not come simply waits (a loan on turn 9)', () => {
    const { s } = sched();
    for (let turn = 1; turn <= 8; turn++) { s.newTurn(); expect(s.takeFloating(turn)).toBeNull(); }
    expect(s.claim('h-loan', 9)).toBe(true);
  });

  it('the two expense hints and the two summary hints are one lesson each', () => {
    const { s } = sched();
    expect(s.claim('h-expense-paid', 1)).toBe(true);
    expect(s.claim('h-expense-loan', 2)).toBe(false);
    const b = sched().s;
    expect(b.claim('h-summary-income', 4)).toBe(true);
    expect(b.isSeen('h-summary')).toBe(true);
  });

  it('inactive hints (not the first game, switch off, daily, full mode) never fire', () => {
    const { s } = sched({ active: () => false });
    expect(s.claim('h-roll', 0)).toBe(false);
    s.offer('h-meter', 1);
    expect(s.takeFloating(1)).toBeNull();
    expect(hintsActive({ mode: 'family', gamesFinished: 0 })).toBe(true);
    expect(hintsActive({ mode: 'family', gamesFinished: 1 })).toBe(false);
    expect(hintsActive({ mode: 'full', gamesFinished: 0 })).toBe(false);
    expect(hintsActive({ mode: 'family', gamesFinished: 0, daily: true })).toBe(false);
    expect(hintsActive({ mode: 'family', gamesFinished: 0, helpOn: false })).toBe(false);
  });

  it('summary: h-summary before any asset, h-summary-income at the first summary with an asset (and it retires h-summary)', () => {
    const { s } = sched();
    const none = { hasPassive: false, negative: false };
    const asset = { hasPassive: true, negative: false };
    expect(summaryHintId(none, s)).toEqual({ id: 'h-summary', variant: 'positive' });
    expect(summaryHintId({ ...none, negative: true }, s).variant).toBe('negative');
    s.claim('h-summary', 1);
    expect(summaryHintId(none, s)).toBeNull();
    expect(summaryHintId(asset, s)).toEqual({ id: 'h-summary-income', variant: 'income' });
    const fresh = sched().s;
    expect(summaryHintId(asset, fresh).id).toBe('h-summary-income'); // an asset at the very first summary skips the plain one
  });

  it('a hint that never reached the screen is given back', () => {
    const marks = []; const unmarks = [];
    const s = createHintScheduler({ mark: (i) => marks.push(i), unmark: (i) => unmarks.push(i) });
    s.offer('h-meter', 2);
    const got = s.takeFloating(2);
    s.release(got.id);
    expect(unmarks).toEqual(['h-meter']);
    s.newTurn(); s.offer('h-meter', 3);
    expect(s.takeFloating(3).id).toBe('h-meter');
  });

  it('turns 1-3 tips give way to hints in the first game; explainers wait until turn 7', () => {
    expect(tipReplaced({ active: true, turn: 1 })).toBe(true);
    expect(tipReplaced({ active: true, turn: 3 })).toBe(true);
    expect(tipReplaced({ active: true, turn: 8 })).toBe(false);
    expect(tipReplaced({ active: false, turn: 1 })).toBe(false);
    expect(explainerAllowed({ active: true, turn: 6 })).toBe(false);
    expect(explainerAllowed({ active: true, turn: 7 })).toBe(true);
    expect(explainerAllowed({ active: false, turn: 1 })).toBe(true);
    expect(STORY_COVERED).toEqual(['cashflow', 'passive_income', 'down_payment', 'interest', 'cushion']);
  });

  it('asset kind of the first-income wording: one asset names its kind, several are "many"', () => {
    expect(assetKindOf({ assets: [] })).toBe('apartment');
    expect(assetKindOf({ assets: [{ type: 'apartment', monthlyCashFlow: 5 }, { type: 'business', monthlyCashFlow: 5 }] })).toBe('many');
  });
});

describe('goal line and "how far"', () => {
  it('shows for family mode until 3 finished games, and only while the help switch is on', () => {
    expect(GOAL_LINE_GAMES).toBe(3);
    for (const g of [0, 1, 2]) expect(goalLineVisible({ mode: 'family', helpOn: true, gamesFinished: g })).toBe(true);
    expect(goalLineVisible({ mode: 'family', helpOn: true, gamesFinished: 3 })).toBe(false);
    expect(goalLineVisible({ mode: 'family', helpOn: false, gamesFinished: 0 })).toBe(false);
    expect(goalLineVisible({ mode: 'full', helpOn: true, gamesFinished: 0 })).toBe(false);
  });
  it('left = max(0, expenses - passive); onTheLine at equality; almost from 75%', () => {
    const teacher = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    expect(leftToFreedom(teacher)).toBe(7310);
    const cart = data.cards.find((c) => c.id === 'opp-biz-006');
    const withCart = { ...teacher, assets: [{ ...cart, type: 'business' }] };
    expect(leftToFreedom(withCart)).toBe(6410);
    expect(freedomView(withCart).kind).toBe('left');
    const near = { ...teacher, assets: [{ monthlyCashFlow: 5700, type: 'apartment' }] };
    expect(freedomView(near).kind).toBe('almost');
    const equal = { ...teacher, assets: [{ monthlyCashFlow: 7310, type: 'apartment' }] };
    expect(freedomView(equal)).toMatchObject({ kind: 'onTheLine', left: 0 });
    const won = { ...teacher, assets: [{ monthlyCashFlow: 7311, type: 'apartment' }] };
    expect(freedomView(won).kind).toBe('won');
  });
  it('the HUD popover figures: in = salary + passive, out = expenses, left = in - out', () => {
    const teacher = engine.newGame({ mode: 'family', professionId: 'teacher', seed: 1 });
    const s = { ...teacher, assets: [{ monthlyCashFlow: 2600, type: 'apartment' }] };
    const f = summaryFigures(s);
    expect(f.salary + f.passive).toBe(11400);
    expect(f.expenses).toBe(7310);
    expect(f.monthly).toBe(4090);
  });
});

describe('family vocabulary layer', () => {
  beforeEach(() => { learnContent(); });
  it('the override strings (22 + the round-11 additions) switch in family mode only; full mode keeps the original wording', () => {
    const map = familyOverrideMap(content());
    expect(Object.keys(map)).toHaveLength([...content().familyStrings.overrides, ...content().familyStrings.overridesRound11].filter((o) => !o.key.includes(':')).length);
    setLearnMode('full');
    expect(t('game.passive')).toBe('הכנסה פסיבית');
    expect(t('card.downPayment')).toBe('מקדמה');
    setLearnMode('family');
    expect(t('game.passive')).toBe('כסף שעובד');
    expect(t('card.downPayment')).toBe('התשלום הראשון');
    expect(t('statement.monthlyCashFlow')).toBe('נשאר בחודש');
    for (const [key, text] of Object.entries(map)) expect(tRaw(key), key).toBe(text);
    setLearnMode('full');
    for (const key of Object.keys(map)) expect(tRaw(key), key).not.toBe(map[key]);
  });
  it('the untouched strings stay (game.expenses, square.*, loan.totalDue)', () => {
    setLearnMode('family');
    expect(t('game.expenses')).toBe('הוצאות');
    expect(Object.keys(familyOverrideMap(content())).some((k) => /^square\./.test(k) || k === 'game.expenses' || k === 'loan.totalDue')).toBe(false);
  });
  it('kid names in family, real term underneath in the dictionary; [[term:id]] shows the kid name', () => {
    setLearnMode('family');
    expect(termName('passive_income')).toBe('כסף שעובד בשבילכם');
    expect(hasKidName('passive_income')).toBe(true);
    expect(kidOf('passive_income').term).toBe('הכנסה פסיבית');
    expect(t('pick.goal')).toContain('כסף שעובד בשבילכם');
    setLearnMode('full');
    expect(termName('passive_income')).toBe('הכנסה פסיבית');
    expect(hasKidName('passive_income')).toBe(false);
    setLearnMode('family');
  });
  it('every glossary concept has a kid name and the glossary file itself is untouched', () => {
    for (const c of conceptList()) expect(kidOf(c.id), c.id).toBeTruthy();
    const pro = (c) => c.term;
    expect(conceptList().map(pro)).toContain('הכנסה פסיבית');
  });
  it('setStringOverrides(null) clears the layer', () => {
    setStringOverrides({ 'game.passive': 'x' });
    expect(tRaw('game.passive')).toBe('x');
    setStringOverrides(null);
    expect(tRaw('game.passive')).toBe('הכנסה פסיבית');
    setLearnMode('family'); learnContent(); setLearnMode('family');
  });
});

describe('story, check, parent card, how-to content', () => {
  it('story: 5 screens, <= 45 words each, reading time 60-90 s, poses tip/tired/hammock/tip/roll', () => {
    const s = content().story.screens;
    expect(s).toHaveLength(5);
    expect(s.map((x) => x.pose)).toEqual(['tip', 'tired', 'hammock', 'tip', 'roll']);
    for (const x of s) expect(x.lines.join(' ').split(/\s+/).length).toBeLessThanOrEqual(45);
    const secs = s.reduce((a, x) => a + x.readSec, 0);
    expect(secs).toBeGreaterThanOrEqual(60); expect(secs).toBeLessThanOrEqual(90);
  });
  it('quiz: guess first, one retry, "show me", no shame; options shuffle without losing any', () => {
    const q = createQuiz(content().check.questions);
    const wrong = q.question.options.find((o) => !o.correct);
    let r = q.answer(wrong.id);
    expect(r).toMatchObject({ correct: false, retry: true, done: false });
    r = q.answer(q.question.options.find((o) => o.correct).id);
    expect(r).toMatchObject({ correct: true, done: true });
    q.next();
    q.showMe();
    expect(q.results[1]).toMatchObject({ correct: false, shown: true });
    q.next();
    const w2 = q.question.options.filter((o) => !o.correct);
    q.answer(w2[0].id); r = q.answer(w2[1].id);
    expect(r).toMatchObject({ correct: false, done: true });
    expect(q.score).toBe(1);
    expect(q.firstMissed().id).toBe(content().check.questions[1].id);
    const rnd = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
    expect(shuffled([1, 2, 3, 4], rnd).sort()).toEqual([1, 2, 3, 4]);
  });
  it('parent card: 3 sentences, 3 questions with answers; kid how-to: at least 4 short lines', () => {
    expect(content().parentCard.howToExplain).toHaveLength(3);
    expect(content().parentCard.questions).toHaveLength(3);
    expect(content().howtoKid.steps.length).toBeGreaterThanOrEqual(4);
    for (const s of content().howtoKid.steps) expect(s.split(/\s+/).length).toBeLessThanOrEqual(28);
  });
  it('forbidden words never appear in the tutorial content', () => {
    const txt = read('src/data/learn/tutorial.he.json');
    for (const bad of ['מרוץ העכברים', 'יוצאים מהמרוץ', 'rat race', 'Fast Track', 'יום משכורת']) expect(txt).not.toContain(bad);
    expect(txt).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('validator rejects a broken tutorial file loudly', () => {
    const learn = { ...learnContent(), tutorial: { ...content(), hints: { ...content().hints, items: content().hints.items.slice(1) } } };
    expect(validateLearn(learn, { cards: data.cards }).join()).toMatch(/missing hint h-roll/);
  });
  it('prune: the production file drops authoring text but keeps what the UI renders', () => {
    const raw = JSON.parse(read('src/data/learn/tutorial.he.json'));
    const out = pruneLearn('tutorial', raw);
    const json = JSON.stringify(out);
    for (const gone of ['needs_review', 'sampleText', 'ownerWording', '"computed"', '"was"']) expect(json).not.toContain(gone);
    expect(out.story.screens[0].title).toBe(raw.story.screens[0].title);
    expect(out.hints.items.find((i) => i.id === 'h-card').steps).toHaveLength(4);
    expect(out.familyStrings.overrides).toHaveLength(22);
    expect(out.familyStrings.overridesRound11.length).toBeGreaterThan(0);
    expect(validateLearn({ ...learnContent(), tutorial: out }, { cards: data.cards })).toEqual([]);
  });
});

describe('one-tap hand-over (hot-seat)', () => {
  it('a resolved turn in hot-seat needs exactly one action to roll the next player; single player needs none', () => {
    const mk = (n) => newMatch(engine, { mode: 'family', seed: 3, players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, professionId: data.professions[i].id })) });
    // 2 players: the turn is over -> endTurn gives the other player, who rolls with the single sheet tap
    let m = mk(2);
    let s = engine.roll(currentState(m));
    while (s.pending) s = s.pending.kind === 'opportunity' ? engine.pass(s) : s.pending.kind === 'charity' ? engine.declineCharity(s) : engine.pay ? engine.pay(s) : s;
    m = setCurrentState(m, s);
    expect(isMultiplayer(m) && !lastPlayerStanding(m)).toBe(true);
    expect(canEndTurn(m)).toBe(true);
    m = endTurn(m);
    expect(m.currentIndex).toBe(1);
    expect(currentState(m).phase).toBe('roll');
    // single player: the turn closes silently (no hand-over, no sheet)
    let one = mk(1);
    let s1 = engine.roll(currentState(one));
    while (s1.pending) s1 = s1.pending.kind === 'opportunity' ? engine.pass(s1) : s1.pending.kind === 'charity' ? engine.declineCharity(s1) : s1;
    one = setCurrentState(one, s1);
    expect(isMultiplayer(one)).toBe(false);
    expect(endTurn(one).currentIndex).toBe(0);
  });
  it('play.js: no continue mode, the sheet opens straight from settleButton and its button rolls', () => {
    const play = read('src/ui/play.js');
    expect(play).toContain('handOver()');
    expect(play).toContain('async function handoverAndRoll');
    expect(play).toMatch(/turn\(\); \/\/ not awaited/);
    expect(play).not.toContain("paintButton('continue')");
    const modals = read('src/ui/modals.js');
    expect(modals).toContain("'data-action': 'roll-next'");
    expect(modals).toContain('if (tapped || !armed) return;'); // double taps, and taps while the sheet is still arming
    expect(modals).not.toContain('players.ready');
    const he = JSON.parse(read('src/i18n/he.json'));
    expect(he.players.rollFor).toBe('זרקו קובייה, {name}');
  });
  it('the board still has 24 squares (the hand-over changes no rule)', () => { expect(BOARD).toHaveLength(24); });
});
