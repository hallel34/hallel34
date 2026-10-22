// L4: the 'מה למדתי' report as a view model (texts already filled). The counting is engine/learn.js buildReport.
import { buildReport, conversationOrder } from '../engine/learn.js';
import { tp } from '../i18n/index.js';
import { passiveIncome, totalExpenses } from '../engine/selectors.js';
import { learnContent, conceptsForMode } from './content.js';
import { moneyText, numberText } from '../ui/format.js';
import { yearsPhrase, pctText, fillSlots } from './slots.js';
import { renderFeedback, feedbackForEnd, feedbackForWinExtra } from './feedback.js';

/** A text that is either one string or per-mode ({ family, full, all }). */
const byMode = (v, mode) => (v && typeof v === 'object' ? v[mode] ?? v.all ?? v.family ?? '' : v ?? '');
/** A {one, two, other} family of texts (Intl plural categories) picked by `n`. */
const pluralOf = (forms, n) => (n === 1 ? forms.one : n === 2 ? forms.two ?? forms.other : forms.other);

/** The 'החלטות ירוקות' line of a { green, total, kind } count (also the headline of the daily result). */
export function greenText(g) {
  const G = learnContent().report.sections.greenDecisions;
  const forms = G.templatePlural ? pluralOf(G.templatePlural, g.green) : G.template;
  return { all: G.allGreen, none: G.noneGreen, noData: G.noData }[g.kind] ?? fillSlots(forms, { green: numberText(g.green), total: numberText(g.total) });
}

/**
 * @param state    one player's final engine state
 * @param opts     { seed, theme: index into the conversation order }. The concept count is THIS player's in THIS game
 *                 (state.learn.concepts), never the device-wide set: a hot-seat opponent's or an earlier game's concepts are not theirs.
 */
export function reportView(state, { seed = 0, theme = 0 } = {}) {
  const { report, guess } = learnContent();
  const data = buildReport(state);
  const mode = state.mode;
  const S = report.sections;
  const sections = [];

  // best / worst deal. Truthful about what was bought: a deal, deals that never pay, only stocks, or nothing.
  const B = S.bestDeal;
  if (data.bestKind === 'deal') {
    const d = data.bestDeal;
    sections.push({
      id: 'bestDeal', title: data.dealCount === 1 && B.titleOnly ? B.titleOnly : B.title,
      text: fillSlots(B.template, { title: d.title, years: yearsPhrase(d.years), yield: pctText(d.yieldPct) }),
    });
  } else {
    const text = { negativeOnly: B.negativeOnly, stocksOnly: B.stocksOnly }[data.bestKind] ?? B.empty;
    sections.push({ id: 'bestDeal', title: B.title, text, empty: true, kind: data.bestKind });
  }
  if (data.worstDeal) {
    const d = data.worstDeal;
    const text = data.worstKind === 'negative'
      ? fillSlots(S.worstDeal.templateNegative, { title: d.title, loss: moneyText(Math.abs(d.cf)) })
      : fillSlots(S.worstDeal.templateSlow, { title: d.title, years: yearsPhrase(d.years) });
    sections.push({ id: 'worstDeal', title: S.worstDeal.title, text, tier: d.tier });
  } else if (data.worstEmpty) {
    sections.push({ id: 'worstDeal', title: S.worstDeal.title, text: S.worstDeal.empty, empty: true });
  }

  // interest
  if (data.interest.available) {
    sections.push({
      id: 'interest', title: S.interest.title,
      text: data.interest.none ? S.interest.zero : fillSlots(S.interest.template, { amount: moneyText(data.interest.amount) }),
    });
  }

  // green decisions
  sections.push({ id: 'greenDecisions', title: S.greenDecisions.title, text: greenText(data.green) });

  // guesses ('עין של משקיע')
  const guessLine = data.guesses.of > 0 ? fillSlots(guess.investorEye.endOfGame, { right: numberText(data.guesses.right), of: numberText(data.guesses.of) }) : null;

  // concepts
  const available = conceptsForMode(mode);
  const have = new Set(data.concepts);
  const unlocked = available.filter((c) => have.has(c.id));
  const C = S.concepts;
  sections.push({
    id: 'concepts', title: C.title, dictionary: C.openDictionary,
    text: unlocked.length
      ? fillSlots(C.template, {
        // {count}: "מושג אחד" / "שני מושגים" / "5 מושגים" (never "1 מושגים"); older content keeps {n}
        count: C.count ? fillSlots(pluralOf(C.count, unlocked.length), { n: numberText(unlocked.length) }) : tp('plural.concepts', unlocked.length),
        n: numberText(unlocked.length), all: numberText(available.length), list: unlocked.map((c) => (mode === 'family' && C.names?.[c.id]) || c.term).join(', '), // family: the children's names (round 12)
      })
      : C.none,
    unlocked: unlocked.map((c) => c.id),
  });

  // numbers
  const st = state.stats ?? {};
  const stats = [
    { id: 'turns', label: S.stats.turns, value: numberText(state.turn) },
    { id: 'passive', label: S.stats.passive, value: moneyText(passiveIncome(state)) },
    { id: 'expenses', label: S.stats.expenses, value: moneyText(totalExpenses(state)) },
    { id: 'assets', label: S.stats.assets, value: numberText(state.assets.length) },
    { id: 'loansTaken', label: S.stats.loansTaken, value: numberText(st.loansTaken ?? 0) },
  ];

  // tip + conversation
  const tip = { id: data.tip, title: report.nextStep.title, text: byMode(report.nextStep.tips[data.tip], mode) };
  const themes = report.conversation[mode] ?? report.conversation.family;
  const order = conversationOrder(mode, data.tip, Object.keys(themes), seed);
  const themeKey = order[((theme % order.length) + order.length) % order.length];
  const conversation = {
    title: report.conversation.title, intro: report.conversation.intro, theme: themeKey, themeTitle: themes[themeKey].title,
    questions: themes[themeKey].questions.slice(0, 3), count: order.length,
  };

  // the end-of-game fox line (win / lose group of feedback.json), rotated by the seed
  const endReq = feedbackForEnd(state);
  const fox = renderFeedback(learnContent().feedback, endReq, { mode, seed, counter: 0 });
  const extraReq = feedbackForWinExtra(state);
  const extra = extraReq ? renderFeedback(learnContent().feedback, extraReq, { mode, seed, counter: 0 }) : null;

  return {
    title: report.title, won: state.status === 'won', end: endReq.group,
    subtitle: state.status === 'won' ? report.subtitle.win : state.status === 'lost' ? report.subtitle.lose : (report.subtitle.neutral ?? report.subtitle.lose),
    fox: fox ? { text: fox.text, pose: fox.pose } : null, foxExtra: extra ? extra.text : null,
    sections, stats, statsTitle: S.stats.title, guessLine, tip, conversation, tipId: data.tip, data,
  };
}
