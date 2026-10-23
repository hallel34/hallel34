// Schema validation for professions and cards. Fails loudly.
import { BASE_DEBT_RATES, TIMED_EFFECT_KINDS, TIMED_EFFECT_MAX_TURNS, TIMED_EFFECT_MAX_PCT, LOAN_PAYMENT_RATE } from './config.js';
import { CATEGORY_IDS, CATEGORY_TYPES } from '../data/categories.js';
const MODES = ['family', 'full'];
const DECKS = ['opportunity', 'expense', 'market'];
const TYPES = ['apartment', 'business', 'stock'];

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
    if (!DECKS.includes(c.deck)) errors.push(`${w}: deck`);
    if (!isStr(c.title) || !isStr(c.text)) errors.push(`${w}: title/text`);
    for (const k of ['titleFamily', 'textFamily']) if (c[k] != null && !isStr(c[k])) errors.push(`${w}: ${k}`); // optional family-mode wording (display only)
    if (!Array.isArray(c.modes) || !c.modes.length || c.modes.some((m) => !MODES.includes(m))) {
      errors.push(`${w}: modes`);
    }
    if (c.realWorld !== undefined && typeof c.realWorld !== 'boolean') errors.push(`${w}: realWorld must be true/false`);
    if (c.deck === 'opportunity') {
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
