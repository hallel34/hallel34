// Schema validation for professions and cards. Fails loudly.
import { BASE_DEBT_RATES, TIMED_EFFECT_KINDS, TIMED_EFFECT_MAX_TURNS, TIMED_EFFECT_MAX_PCT, LOAN_PAYMENT_RATE, LOAN_STEP } from './config.js';
import { CATEGORY_IDS, CATEGORY_TYPES } from '../data/categories.js';
const MODES = ['family', 'full'];
const DECKS = ['opportunity', 'expense', 'market'];
// v4 stage 4: decision cards are their own deck, dealt on the square named by `square` (opportunity or expense)
const ALL_DECKS = [...DECKS, 'decision'];
const TYPES = ['apartment', 'business', 'stock'];
const EFFECT_KEYS = ['buy', 'loan', 'pay', 'sell', 'repay', 'stocks'];

/** One asset an option buys: the same checks as an opportunity card of its type (price = down + mortgage, gross - loan = cash flow). */
function assetErrors(a, w) {
  const e = [];
  if (!a || (a.type !== 'apartment' && a.type !== 'business')) return [`${w}: asset type must be apartment or business`];
  if (a.category !== undefined && !CATEGORY_IDS.includes(a.category)) e.push(`${w}: asset category`);
  for (const k of ['price', 'downPayment', 'mortgage', 'monthlyCashFlow']) if (!isNum(a[k])) e.push(`${w}: asset ${k}`);
  if (isNum(a.price) && a.price !== a.downPayment + a.mortgage) e.push(`${w}: asset price must equal downPayment + mortgage`);
  if (a.downPayment <= 0) e.push(`${w}: asset downPayment must be positive`);
  const gross = a.type === 'business' ? 'profit' : 'rent';
  if (!isNum(a[gross]) || !isNum(a.loanPayment) || a[gross] - a.loanPayment !== a.monthlyCashFlow) e.push(`${w}: asset ${gross} - loanPayment must equal monthlyCashFlow`);
  if (a.share !== undefined && !(isNum(a.share) && a.share > 0 && a.share <= 1)) e.push(`${w}: asset share must be in (0, 1]`);
  if (a.title !== undefined && !isStr(a.title)) e.push(`${w}: asset title`);
  return e;
}

/** A decision card (v4 stage 4): 2-3 options, each with its effects built from the engine's existing moves. */
function decisionErrors(c, w) {
  const e = [];
  if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 3) return [`${w}: a decision card needs 2-3 options`];
  const ids = new Set();
  for (const o of c.options) {
    const ow = `${w} option ${o?.id}`;
    if (!isStr(o.id) || o.id === 'pass') e.push(`${ow}: id`);
    if (ids.has(o.id)) e.push(`${ow}: duplicate id`);
    ids.add(o.id);
    if (!isStr(o.label)) e.push(`${ow}: label`);
    if (!isStr(o.fox)) e.push(`${ow}: fox line`);
    for (const k of ['labelFamily', 'foxFamily']) if (o[k] !== undefined && !isStr(o[k])) e.push(`${ow}: ${k}`);
    const fx = o.effects;
    if (!fx || typeof fx !== 'object') { e.push(`${ow}: effects`); continue; }
    for (const k of Object.keys(fx)) if (!EFFECT_KEYS.includes(k)) e.push(`${ow}: unknown effect ${k}`);
    if (fx.buy !== undefined) {
      if (!Array.isArray(fx.buy) || !fx.buy.length) e.push(`${ow}: buy must be a list of assets`);
      else fx.buy.forEach((a) => e.push(...assetErrors(a, ow)));
    }
    if (fx.loan !== undefined && fx.loan !== 'down' && !(Number.isInteger(fx.loan) && fx.loan > 0 && fx.loan % LOAN_STEP === 0)) e.push(`${ow}: loan must be a positive multiple of ${LOAN_STEP} or "down"`);
    if (fx.pay !== undefined && !(isNum(fx.pay) && fx.pay > 0)) e.push(`${ow}: pay`);
    if (fx.repay !== undefined && fx.repay !== 'all' && !(Number.isInteger(fx.repay) && fx.repay > 0 && fx.repay % LOAN_STEP === 0)) e.push(`${ow}: repay must be "all" or a multiple of ${LOAN_STEP}`);
    if (fx.sell !== undefined && (!TYPES.includes(fx.sell.targetType) || !isNum(fx.sell.offerPct) || fx.sell.offerPct <= 0)) e.push(`${ow}: sell needs targetType, offerPct`);
    if (fx.sell !== undefined && c.modes?.includes('family')) e.push(`${ow}: selling is full mode only`);
    if (fx.stocks !== undefined) {
      if (!Array.isArray(fx.stocks) || !fx.stocks.length) e.push(`${ow}: stocks must be a list`);
      else for (const x of fx.stocks) if (!isStr(x.symbol) || !Number.isInteger(x.qty) || x.qty < 1 || !isNum(x.price) || x.price <= 0 || !isNum(x.dividend)) e.push(`${ow}: stock needs symbol, qty, price, dividend`);
      if (c.modes?.includes('family')) e.push(`${ow}: stocks are full mode only`);
    }
  }
  if (c.square === 'expense') {
    if (!c.expenseLoan) e.push(`${w}: an expense decision card sets expenseLoan (its loans are exempt from the purchase cap)`);
    if (!c.options.every((o) => isNum(o.effects?.pay))) e.push(`${w}: every option of an expense decision card pays the expense`);
  }
  if (c.requires != null) {
    const r = c.requires;
    if (typeof r !== 'object' || (r.asset === undefined && r.bankLoan === undefined)) e.push(`${w}: requires`);
    if (r.asset !== undefined && !TYPES.includes(r.asset)) e.push(`${w}: requires.asset`);
    if (r.bankLoan !== undefined && !(isNum(r.bankLoan) && r.bankLoan > 0)) e.push(`${w}: requires.bankLoan`);
  }
  if (c.teaches !== undefined && !isStr(c.teaches)) e.push(`${w}: teaches`);
  return e;
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x) => typeof x === 'string' && x.length > 0;

export function validateProfessions(list) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(list)) return ['professions must be an array'];
  for (const p of list) {
    const w = `profession ${p?.id}`;
    if (!isStr(p.id)) errors.push('profession without id');
    if (ids.has(p.id)) errors.push(`${w}: duplicate id`);
    ids.add(p.id);
    if (!isStr(p.title)) errors.push(`${w}: title`);
    for (const k of ['salary', 'savings', 'perChild']) {
      if (!isNum(p[k]) || p[k] < 0) errors.push(`${w}: ${k}`);
    }
    if (!Array.isArray(p.expenses) || !p.expenses.length) errors.push(`${w}: expenses`);
    else p.expenses.forEach((e) => {
      if (!isStr(e.id) || !isStr(e.label) || !isNum(e.amount)) errors.push(`${w}: bad expense ${e?.id}`);
    });
    if (!Array.isArray(p.liabilities)) errors.push(`${w}: liabilities`);
    else p.liabilities.forEach((l) => {
      if (!isStr(l.id) || !isStr(l.label) || !isNum(l.principal) || !isNum(l.monthlyPayment)) {
        errors.push(`${w}: bad liability ${l?.id}`);
      } else if (l.debt !== undefined) {
        // One consistent model for starting debts: payment = principal x rate of its kind (rounded to 10).
        const rate = BASE_DEBT_RATES[l.debt];
        if (rate === undefined) errors.push(`${w}: liability ${l.id} has unknown debt kind ${l.debt}`);
        else if (l.monthlyPayment !== Math.round((l.principal * rate) / 10) * 10) {
          errors.push(`${w}: liability ${l.id} payment must be ${Math.round((l.principal * rate) / 10) * 10} (${l.debt} rate)`);
        }
      }
    });
  }
  return errors;
}

export function validateCards(list) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(list)) return ['cards must be an array'];
  for (const c of list) {
    const w = `card ${c?.id}`;
    if (!isStr(c.id)) { errors.push('card without id'); continue; }
    if (ids.has(c.id)) errors.push(`${w}: duplicate id`);
    ids.add(c.id);
    if (!ALL_DECKS.includes(c.deck)) errors.push(`${w}: deck`);
    if (!isStr(c.title) || !isStr(c.text)) errors.push(`${w}: title/text`);
    for (const k of ['titleFamily', 'textFamily']) if (c[k] != null && !isStr(c[k])) errors.push(`${w}: ${k}`); // optional family-mode wording (display only)
    if (!Array.isArray(c.modes) || !c.modes.length || c.modes.some((m) => !MODES.includes(m))) {
      errors.push(`${w}: modes`);
    }
    if (c.realWorld !== undefined && typeof c.realWorld !== 'boolean') errors.push(`${w}: realWorld must be true/false`);
    if (c.deck === 'decision') {
      if (c.type !== undefined) errors.push(`${w}: a decision card has no type (its options carry the assets)`);
      if (c.category !== undefined) errors.push(`${w}: a decision card has no category (its assets carry theirs)`);
      if (c.square !== 'opportunity' && c.square !== 'expense') errors.push(`${w}: square must be opportunity or expense`);
      errors.push(...decisionErrors(c, w));
    } else if (c.deck === 'opportunity') {
      if (!TYPES.includes(c.type)) errors.push(`${w}: type`);
      // presentation-only deal category (icon + colour): when present it must be a registry id that fits the type. Every shipped
      // card carries one (tests/categories.test.js); a card without it still loads and shows the neutral house icon.
      if (c.category === undefined) { /* optional */ } else if (!CATEGORY_IDS.includes(c.category)) errors.push(`${w}: category must be one of ${CATEGORY_IDS.join(', ')}`);
      else if (TYPES.includes(c.type)) {
        const only = CATEGORY_TYPES[c.category]; // 'apartment' / 'stock' belong to exactly one type
        if (only && !only.includes(c.type)) errors.push(`${w}: category ${c.category} does not fit type ${c.type}`);
        const owner = Object.keys(CATEGORY_TYPES).find((k) => CATEGORY_TYPES[k].includes(c.type));
        if (owner && c.category !== owner) errors.push(`${w}: a ${c.type} needs the ${owner} category`);
      }
      if (!TYPES.includes(c.type)) { /* type error reported above */ } else if (c.type === 'stock') {
        if (!isStr(c.symbol) || !isNum(c.price) || c.price <= 0 || !isNum(c.dividend)) {
          errors.push(`${w}: stock needs symbol, price, dividend`);
        }
      } else {
        for (const k of ['price', 'downPayment', 'mortgage', 'monthlyCashFlow']) {
          if (!isNum(c[k])) errors.push(`${w}: ${k}`);
        }
        if (isNum(c.price) && c.price !== c.downPayment + c.mortgage) {
          errors.push(`${w}: price must equal downPayment + mortgage`);
        }
        // Optional breakdown shown on the card: rent (apartment) or profit (business) minus the loan payment = monthlyCashFlow.
        const gross = c.type === 'business' ? 'profit' : 'rent';
        const other = c.type === 'business' ? 'rent' : 'profit';
        if (c[other] !== undefined) errors.push(`${w}: ${other} is not allowed on a ${c.type}`);
        if (c.loanPayment !== undefined || c[gross] !== undefined) {
          if (!isNum(c.loanPayment) || c.loanPayment < 0 || !isNum(c[gross])) errors.push(`${w}: ${gross} and loanPayment go together`);
          else if (isNum(c.monthlyCashFlow) && c[gross] - c.loanPayment !== c.monthlyCashFlow) {
            errors.push(`${w}: ${gross} - loanPayment must equal monthlyCashFlow`);
          }
        }
      }
    } else if (c.deck === 'expense') {
      if (!isNum(c.amount) || c.amount <= 0) errors.push(`${w}: amount`);
    } else if (c.deck === 'market') {
      if (c.effect === 'offer') {
        if (!TYPES.includes(c.targetType) || !isNum(c.offerPct) || c.offerPct <= 0) {
          errors.push(`${w}: offer needs targetType, offerPct`);
        }
      } else if (c.effect === 'stockPrice') {
        if (!isStr(c.symbol) || !isNum(c.newPrice) || c.newPrice <= 0) errors.push(`${w}: stockPrice`);
      } else if (c.effect === 'cash') {
        if (!isNum(c.amount)) errors.push(`${w}: cash amount`);
      } else if (TIMED_EFFECT_KINDS.includes(c.effect)) {
        // timed effect (family market deck): lasts `turns` turns and carries the one line it teaches
        if (!Number.isInteger(c.turns) || c.turns < 1 || c.turns > TIMED_EFFECT_MAX_TURNS) errors.push(`${w}: turns must be 1-${TIMED_EFFECT_MAX_TURNS}`);
        if (c.effect === 'cheapLoan') {
          if (!isNum(c.rate) || c.rate <= 0 || c.rate >= LOAN_PAYMENT_RATE) errors.push(`${w}: cheapLoan rate must be above 0 and below ${LOAN_PAYMENT_RATE}`);
        } else if (!isNum(c.pct) || c.pct === 0 || Math.abs(c.pct) > TIMED_EFFECT_MAX_PCT) errors.push(`${w}: pct must be non-zero, at most ${TIMED_EFFECT_MAX_PCT}`);
        if (!isStr(c.teaches)) errors.push(`${w}: a timed market card needs its teaches line`);
      } else errors.push(`${w}: unknown effect`);
      if (c.effect === 'offer' && c.modes?.includes('family')) errors.push(`${w}: offer cards are full mode only (a family game never sells)`);
      if (c.teaches !== undefined && !isStr(c.teaches)) errors.push(`${w}: teaches`);
    }
  }
  for (const mode of MODES) {
    for (const d of DECKS) {
      if (!list.some((c) => c.deck === d && c.modes?.includes(mode))) {
        errors.push(`no ${d} cards for mode ${mode}`);
      }
    }
  }
  return errors;
}

export function validateData({ professions, cards }) {
  const errors = [...validateProfessions(professions), ...validateCards(cards)];
  if (errors.length) throw new Error(`Invalid game data:\n- ${errors.join('\n- ')}`);
  return true;
}
