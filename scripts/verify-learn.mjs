// Run: node /tmp/claude-0/-home-user-hallel34/797437b1-0eab-5655-9747-70eabea0ace1/scratchpad/verify-learn.mjs
// Reads the game data and the learn JSON, recomputes every figure the learning texts quote, and fails loudly on a mismatch.
import fs from 'fs';
const D = '/home/user/hallel34/src/data/';
const J = (p) => JSON.parse(fs.readFileSync(D + p, 'utf8'));
const cards = J('cards.he.json');
const pros = J('professions.he.json');
const gl = J('learn/glossary.he.json');
const fb = J('learn/feedback.he.json');
const rep = J('learn/report.he.json');
const gs = J('learn/guess.he.json');
const rw = J('learn/real-world.he.json');
const card = (id) => cards.find((c) => c.id === id);
const pro = (id) => pros.find((p) => p.id === id);
const r1 = (x) => Math.round(x * 10) / 10;
let bad = 0;
const eq = (what, got, want) => { if (got !== want) { bad++; console.log('MISMATCH', what, 'got', got, 'want', want); } };

// config mirrors (src/engine/config.js)
const LOAN_RATE = 0.01, MONTHS = 24, MORT = 0.0055, BIZ = 0.0175;
const term = (a) => { const m = Math.round(a * LOAN_RATE * 100) / 100; return { monthly: m, perYear: m * 12, interest: m * MONTHS, total: a + m * MONTHS }; };

// cards: cash flow = rent|profit - loanPayment
for (const c of cards) if (c.loanPayment != null) eq(c.id + ' flow', (c.rent ?? c.profit) - c.loanPayment, c.monthlyCashFlow);

// teacher
const t = pro('teacher');
const exp = t.expenses.reduce((a, e) => a + e.amount, 0);
const pay = t.liabilities.reduce((a, l) => a + l.monthlyPayment, 0);
const debt = t.liabilities.reduce((a, l) => a + l.principal, 0);
const cf = t.salary - exp - pay;
const g = (id) => gl.concepts.find((c) => c.id === id).example.computed;
eq('teacher expenses', exp, g('cashflow').expenses);
eq('teacher debt payments', pay, g('cashflow').debtPayments);
eq('teacher cashflow', cf, g('cashflow').cashFlow);
eq('teacher per summary', cf * MONTHS, g('cashflow').perSummary);
eq('teacher total debt', debt, g('liability').totalDebt);
eq('teacher total payment', pay, g('liability').totalPayment);
eq('teacher net worth', t.savings - debt, g('net_worth').netWorth);
eq('teacher savings', t.savings, g('cushion').teacherSavings);
eq('cook short', card('exp-002').amount - pro('cook').savings, g('cushion').cookShort);
eq('teacher left', t.savings - card('exp-002').amount, g('cushion').teacherLeft);

// payback / yield
const yrs = (c) => r1(c.downPayment / (c.monthlyCashFlow * 12));
const a1 = card('opp-apt-001');
eq('apt001 yield', r1(a1.monthlyCashFlow * 12 / a1.downPayment * 100), g('yield').yieldOnDownPaymentPct);
eq('apt001 gross', r1(a1.rent * 12 / a1.price * 100), g('yield').grossRentYieldOnPricePct);
eq('apt001 mortgage payment', Math.round(a1.mortgage * MORT / 100) * 100, a1.loanPayment);
eq('biz006 payback', yrs(card('opp-biz-006')), g('payback').biz006.paybackYears);
eq('apt008 payback', yrs(card('opp-apt-008')), g('payback').apt008.paybackYears);
eq('apt003 dp share', Math.round(card('opp-apt-003').downPayment / card('opp-apt-003').price * 100), g('down_payment').downPaymentSharePct);
eq('biz007 flow', card('opp-biz-007').monthlyCashFlow, g('passive_income').cashFlow);
eq('apt004 flow', card('opp-apt-004').monthlyCashFlow, g('asset').cashFlow);

// interest example
const lt = term(g('interest').amount);
eq('loan monthly', lt.monthly, g('interest').monthlyPayment);
eq('loan interest', lt.interest, g('interest').interest);
eq('loan total', lt.total, g('interest').total);
eq('loan per 1000', term(1000).interest, g('interest').perThousand.perSummary);

// stocks
for (const s of ['stk-001', 'stk-002', 'stk-003']) {
  const c = card('opp-' + s);
  const w = rw.facts.find((f) => f.id === 'rw-stock-dividend').computed[c.symbol];
  eq(c.symbol + ' price', c.price, w.price);
  eq(c.symbol + ' div', c.dividend, w.dividend);
  eq(c.symbol + ' %', r1(c.dividend * 12 / c.price * 100), w.dividendPctOfPrice);
}

// real-world coverage: every realWorld card is in exactly one fact
const flagged = cards.filter((c) => c.realWorld).map((c) => c.id);
const covered = rw.facts.flatMap((f) => f.cardIds);
for (const id of flagged) if (!covered.includes(id)) { bad++; console.log('UNCOVERED realWorld card', id); }
for (const id of covered) if (!flagged.includes(id)) { bad++; console.log('fact points at unflagged card', id); }

// text hygiene
const all = [gl, fb, rep, gs, rw].map((x) => JSON.stringify(x)).join('\n');
if (all.includes('יום משכורת')) { bad++; console.log('found old name יום משכורת'); }
if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(all)) { bad++; console.log('emoji found'); }
for (const f of rw.facts) if (f.numbers && f.numbers.publish !== false) { bad++; console.log('numbers published before verification', f.id); }

// slots in feedback must be declared
const declared = new Set(Object.keys(fb.notes.slots));
for (const [grp, v] of Object.entries(fb.lines)) for (const arr of Object.values(v)) for (const s of arr) for (const m of s.matchAll(/\{(\w+)\}/g)) if (!declared.has(m[1])) { bad++; console.log('undeclared slot', m[1], 'in', grp); }
for (const grp of ['loan.sensible', 'loan.costly']) for (const s of fb.lines[grp].family) if (s.includes('{rate}')) { bad++; console.log('family line uses {rate}', grp); }
console.log(bad ? `FAILED: ${bad} problem(s)` : 'OK: all learn figures match the game data');
process.exit(bad ? 1 : 0);
