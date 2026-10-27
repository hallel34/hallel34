import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ringPos } from '../src/ui/layout.js';
import { moneyText } from '../src/ui/format.js';
import { t, availableLocales } from '../src/i18n/index.js';
import { stripMarkup } from '../src/i18n/markup.js';
import { createEngine, BOARD } from '../src/engine/index.js';
import { loadData } from '../src/data/index.js';

const root = new URL('../src/', import.meta.url).pathname;
const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const jsFiles = walk(root).filter((f) => f.endsWith('.js'));
const lookup = (key) => key.split('.').reduce((o, k) => o?.[k], he);

describe('board layout', () => {
  it('places 24 unique squares on the perimeter of a 6x8 ring (board-spec 14.1)', () => {
    const cells = BOARD.map((_, i) => ringPos(i));
    expect(new Set(cells.map((c) => c.join(','))).size).toBe(24);
    for (const [c, r] of cells) {
      expect(c >= 1 && c <= 6 && r >= 1 && r <= 8).toBe(true);
      expect(c === 1 || c === 6 || r === 1 || r === 8).toBe(true);
    }
    // the corners are squares 0, 5, 12 and 17; square 0 (payday) is the top inline-start corner
    expect([0, 5, 12, 17].map((i) => ringPos(i))).toEqual([[1, 1], [6, 1], [6, 8], [1, 8]]);
  });
  it('consecutive squares are adjacent (the pawn can hop one tile at a time), including the wrap', () => {
    for (let i = 0; i < 24; i++) {
      const [a, b] = [ringPos(i), ringPos((i + 1) % 24)];
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
    }
  });
});

describe('formatting', () => {
  it('formats shekels with Intl, symbol first, explicit signs', () => {
    expect(moneyText(14250)).toBe('₪14,250');
    expect(moneyText(-800)).toBe('-₪800');
    expect(moneyText(900, { sign: true })).toBe('+₪900');
    expect(moneyText(0, { sign: true })).toBe('₪0');
    expect(moneyText(1234.6)).toBe('₪1,235');
  });
});

describe('i18n', () => {
  it('interpolates params', () => {
    expect(t('game.turn', { turn: 7 })).toContain('7');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
  it('every literal t()/tn() key used in the source exists in he.json', () => {
    const missing = [];
    for (const f of jsFiles) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt[n]?\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (typeof lookup(m[1]) !== 'string') missing.push(`${f.replace(root, '')}: ${m[1]}`);
      }
      // template keys like t(`type.${x}`) are checked by prefix
      for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) {
        if (typeof lookup(m[1]) !== 'object') missing.push(`${f.replace(root, '')}: ${m[1]}.*`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('has no hard-coded Hebrew strings in UI code', () => {
    const offenders = [];
    for (const f of jsFiles.filter((x) => /\/(ui|services)\/|main\.js$/.test(x))) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
      if (/[֐-׿]/.test(code)) offenders.push(f.replace(root, ''));
    }
    expect(offenders).toEqual([]);
  });
  it('locale meta is complete', () => {
    expect(availableLocales()).toContain('he');
    expect(he.meta).toMatchObject({ dir: 'rtl', lang: 'he' });
  });
});

describe('data registry', () => {
  it('loads and validates the Hebrew content', () => {
    const data = loadData('he');
    expect(data.cards.length).toBeGreaterThan(30);
    expect(() => createEngine(data)).not.toThrow();
  });
  it('falls back to Hebrew content for locales without a content file', () => {
    expect(loadData('xx').cards.length).toBe(loadData('he').cards.length);
  });
});

describe('engine events used by the UI', () => {
  const data = loadData('he');
  const e = createEngine(data);
  it('expensePaid carries the card so the UI can show what was paid', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      let s = e.newGame({ mode: 'family', professionId: 'engineer', seed });
      for (let i = 0; i < 40 && s.status === 'playing' && !found; i++) {
        if (s.phase === 'roll') s = e.roll(s);
        else if (s.pending?.kind === 'opportunity') s = e.pass(s);
        else if (s.pending?.kind === 'charity') s = e.declineCharity(s);
        else break;
        const ev = s.events.find((x) => x.type === 'expensePaid');
        if (ev) { found = true; expect(ev.card.deck).toBe('expense'); expect(ev.amount).toBe(ev.card.amount); }
      }
    }
    expect(found).toBe(true);
  });
});

describe('accessibility wiring', () => {
  it('every progressbar has an accessible name and value text from i18n', () => {
    const src = readFileSync(new URL('../src/ui/widgets.js', import.meta.url), 'utf8');
    expect(src).toMatch(/role: 'progressbar', 'aria-label': t\('a11y\.passiveMeter'\)/);
    expect(src).toContain("t('a11y.passiveMeterValue'");
    expect(lookup('a11y.passiveMeter')).toMatch(/[֐-׿]/);
    expect(lookup('a11y.passiveMeterValue')).toContain('{pct}');
    const others = jsFiles.filter((f) => !f.endsWith('widgets.js') && /role: 'progressbar'/.test(readFileSync(f, 'utf8')));
    expect(others).toEqual([]);
  });
  it('debug helpers are gated behind ?debug=1', async () => {
    const { debugEnabled } = await import('../src/ui/debug.js');
    globalThis.location = { search: '' };
    expect(debugEnabled()).toBe(false);
    globalThis.location = { search: '?debug=1' };
    expect(debugEnabled()).toBe(true);
    globalThis.location = { search: '?debug=0' };
    expect(debugEnabled()).toBe(false);
    delete globalThis.location;
  });
});

describe('v2 phase A: amounts, payday copy, no typed numbers', () => {
  const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  it('one formatter for +/- amounts: the sign is glued to the symbol and digits (nothing to detach)', () => {
    for (const n of [55200, -7200, 2300, 0, 1234567, -1]) {
      const s = moneyText(n, { sign: true });
      expect(s, String(n)).toMatch(/^[+-]?₪\d{1,3}(,\d{3})*$/);
    }
    expect(moneyText(55200, { sign: true })).toBe('+₪55,200');
    expect(moneyText(-7200, { sign: true })).toBe('-₪7,200');
    expect(moneyText(0, { sign: true })).toBe('₪0');
  });
  it('payday amounts stay isolated in log and statement; board status is a short label', () => {
    const play = src('ui/play.js');
    const fx = play.slice(play.indexOf('async function paydayFx'), play.indexOf('// ---------- turn ----------'));
    expect(fx).toContain("tn('game.logPayday'");
    expect(fx).toContain("setStatus(t('game.paydayFloatLabel'))");
    expect(fx).not.toContain("tn('game.statusPayday'");
    expect(fx).not.toMatch(/moneyText\(/);
    const fmt = src('ui/format.js');
    expect(fmt).toContain("h('bdi', { class: `money");
    expect(fmt).toContain("dir: 'ltr'");
    // owner 2026-10-25: the statement hero shows the stacked equation (its spoken name is still the one-line paydayCalc)
    expect(src('ui/statement.js')).toContain('stackedEquation({ monthly: st.monthlyCashFlow, months: PAYDAY_MONTHS');
    expect(src('ui/statement.js')).toContain("paydayCalc(st.monthlyCashFlow, PAYDAY_MONTHS");
    // the log/status containers accept nodes
    expect(play).toContain('chip.replaceChildren(text)');
    expect(play).toContain('status.replaceChildren(text)');
  });
  it('B2: payday does not layer a duplicate money float over dice; generic float containment remains', () => {
    const play = src('ui/play.js');
    const payday = play.slice(play.indexOf('async function paydayFx'), play.indexOf('// ---------- turn ----------'));
    expect(payday).not.toContain('floatText(');
    expect(payday).toContain('cash.to(cash.value + f.amount');
    const fx = src('ui/fx.js');
    expect(fx).toContain('within.getBoundingClientRect()');
  });
  it('N3: the payday event is called "סיכום שנתי" everywhere, with the maths from the config', () => {
    expect(lookup('square.payday')).toBe('סיכום שנתי');
    for (const key of ['game.payday', 'game.paydayFloatLabel', 'game.statusPayday', 'game.logPayday', 'statement.paydayLine', 'loan.paydayNext', 'howto.step1']) {
      expect(lookup(key), key).toContain('שנתי');
    }
    expect(lookup('game.paydayCalc')).toBe('{monthly} × {months} חודשים = {amount}');
    expect(JSON.stringify(he)).not.toMatch(/יום משכורת|ימי משכורת/);
  });
  it('the loan, card and statement copy contains no typed numbers (rates and amounts come from the config)', () => {
    for (const key of ['loan.textVoluntary', 'loan.rateLine', 'loan.interestUntil', 'loan.totalDue', 'loan.paydayNext', 'card.rentLine', 'card.profitLine',
      'card.breakdownTitle', 'statement.interestOnly', 'statement.balanceNote', 'howto.note', 'howto.step1']) {
      expect(lookup(key), key).not.toMatch(/\d/);
    }
    expect(lookup('howto.note')).toContain('המספרים מפושטים כדי שהמשחק יזרום');
  });
  it('N4: buy-card breakdown and statement panel strings exist and use the proposed wording', () => {
    // glossary markup ([[term:id|display]]) is stripped to its display text: the visible wording is unchanged
    expect(stripMarkup(lookup('card.rentLine'))).toBe('שכירות {gross} − משכנתא {payment} = תזרים {flow}');
    expect(lookup('statement.bizLoanLabel')).toBe('הלוואת עסק – {asset}');
    for (const key of ['statement.netWorthTitle', 'statement.balanceAssets', 'statement.balanceLiabilities', 'statement.balanceNet']) expect(lookup(key), key).toBeTruthy();
  });
});
