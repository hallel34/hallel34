// Schema validation for professions and cards. Fails loudly.
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
    if (!Array.isArray(c.modes) || !c.modes.length || c.modes.some((m) => !MODES.includes(m))) {
      errors.push(`${w}: modes`);
    }
    if (c.deck === 'opportunity') {
      if (!TYPES.includes(c.type)) errors.push(`${w}: type`);
      else if (c.type === 'stock') {
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
      } else errors.push(`${w}: unknown effect`);
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
