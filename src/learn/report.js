// L4: the 'מה למדתי' report as a view model (texts already filled). The counting is engine/learn.js buildReport.
import { buildReport, conversationOrder } from '../engine/learn.js';
import { passiveIncome, totalExpenses } from '../engine/selectors.js';
import { learnContent, conceptsForMode } from './content.js';
import { moneyText, numberText } from '../ui/format.js';
import { yearsPhrase, pctText, fillSlots } from './slots.js';
import { renderFeedback, feedbackForEnd } from './feedback.js';

/**
 * @param state    one player's final engine state
 * @param opts     { seen: ids unlocked on this device, seed, theme: index into the conversation order }
 */
export function reportView(state, { seen = [], seed = 0, theme = 0 } = {}) {
  const { report, guess } = learnContent();
  const data = buildReport(state);
  const mode = state.mode;
  const S = report.sections;
  const sections = [];

  // best / worst deal
  if (data.bestDeal) {
    const d = data.bestDeal;
    sections.push({ id: 'bestDeal', title: S.bestDeal.title, text: fillSlots(S.bestDeal.template, { title: d.title, years: yearsPhrase(d.years), yield: pctText(d.yieldPct) }) });
  } else {
    sections.push({ id: 'bestDeal', title: S.bestDeal.title, text: S.bestDeal.empty, empty: true });
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
  const G = S.greenDecisions;
  const gt = { all: G.allGreen, none: G.noneGreen, noData: G.noData }[data.green.kind] ?? fillSlots(G.template, { green: numberText(data.green.green), total: numberText(data.green.total) });
  sections.push({ id: 'greenDecisions', title: G.title, text: gt });

  // guesses ('עין של משקיע')
  const guessLine = data.guesses.of > 0 ? fillSlots(guess.investorEye.endOfGame, { right: numberText(data.guesses.right), of: numberText(data.guesses.of) }) : null;

  // concepts
  const available = conceptsForMode(mode);
  const have = new Set([...data.concepts, ...seen]);
  const unlocked = available.filter((c) => have.has(c.id));
  const C = S.concepts;
  sections.push({
    id: 'concepts', title: C.title, dictionary: C.openDictionary,
    text: unlocked.length
      ? fillSlots(C.template, { n: numberText(unlocked.length), all: numberText(available.length), list: unlocked.map((c) => c.term).join(', ') })
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
  const tip = { id: data.tip, title: report.nextStep.title, text: report.nextStep.tips[data.tip] };
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

  return {
    title: report.title, subtitle: state.status === 'won' ? report.subtitle.win : report.subtitle.lose, won: state.status === 'won',
    fox: fox ? { text: fox.text, pose: fox.pose } : null,
    sections, stats, statsTitle: S.stats.title, guessLine, tip, conversation, tipId: data.tip, data,
  };
}
