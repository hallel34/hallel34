// v4 board stage (docs/v4/design/board-spec.md + the owner override 2026-10-24): pure rules behind the new board UI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TILE_META, FAMILIES, tile3dName } from '../src/ui/tiles.js';
import { legendGroups } from '../src/ui/legend.js';
import { bubbleMs, BUBBLE_DEFAULTS, BUBBLE_FAMILY } from '../src/ui/notes.js';
import { dealBadgeModel, TIER_LETTER } from '../src/ui/deal-badge.js';
import { dieTimeline } from '../src/ui/die.js';
import { guidePose } from '../src/ui/fox-guide.js';
import { BOARD } from '../src/engine/index.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const get = (key) => key.split('.').reduce((o, k) => o?.[k], he);
const words = (n) => Array.from({ length: n }, () => 'מילה').join(' ');

describe('tile families (spec 1.1)', () => {
  it('every BOARD type has a row; colour family is gain / loss / info', () => {
    for (const sq of new Set(BOARD)) expect(TILE_META[sq], sq).toBeTruthy();
    expect(Object.fromEntries(Object.entries(TILE_META).map(([k, m]) => [k, m.family]))).toEqual({
      payday: 'gain', opportunity: 'gain', expense: 'loss', market: 'info', baby: 'info', charity: 'info', taxAudit: 'info',
    });
    expect(FAMILIES.map((f) => f.id)).toEqual(['gain', 'loss', 'info']);
  });
  it('every label and legend line exists in he.json; tax-audit is registered but not on the board yet', () => {
    for (const m of Object.values(TILE_META)) { expect(get(m.label), m.label).toBeTruthy(); expect(get(m.legend), m.legend).toBeTruthy(); }
    expect(he.square.taxAudit).toBe('ביקורת רשות המסים');
    expect(TILE_META.taxAudit.onBoard).toBe(false);
    expect(BOARD).not.toContain('taxAudit');
    expect(BOARD).not.toContain('tax-audit');
  });
  it('the legend lists the six board types in three named groups', () => {
    const g = legendGroups();
    expect(g.map((x) => x.id)).toEqual(['gain', 'loss', 'info']);
    expect(g.flatMap((x) => x.types)).toEqual(['payday', 'opportunity', 'expense', 'market', 'baby', 'charity']);
    expect(legendGroups({ all: true }).flatMap((x) => x.types)).toContain('taxAudit');
  });
  it('family mode never shows red: the expense tile art is the amber "expense-family" there', () => {
    expect(tile3dName('expense', 'family')).toBe('expense-family');
    expect(tile3dName('expense', 'full')).toBe('expense');
    expect(tile3dName('taxAudit', 'full')).toBe('tax-audit');
    expect(tokens).toMatch(/:root\[data-learn="family"\] \{\s*--tile-loss-bg: #331C0B;\s*--tile-loss-edge: #D97F1F;/);
  });
});

describe('fox bubble auto-close (spec 7.3)', () => {
  it('full: clamp(6000, 2500 + 300 x words, 15000)', () => {
    expect(bubbleMs(words(8), BUBBLE_DEFAULTS)).toBe(6000);
    expect(bubbleMs(words(15), BUBBLE_DEFAULTS)).toBe(7000);
    expect(bubbleMs(words(25), BUBBLE_DEFAULTS)).toBe(10000);
    expect(bubbleMs(words(60), BUBBLE_DEFAULTS)).toBe(15000);
  });
  it('family: clamp(8000, 2500 + 400 x words, 15000)', () => {
    expect(bubbleMs(words(8), BUBBLE_FAMILY)).toBe(8000);
    expect(bubbleMs(words(15), BUBBLE_FAMILY)).toBe(8500);
    expect(bubbleMs(words(25), BUBBLE_FAMILY)).toBe(12500);
  });
  it('the tokens carry the same numbers', () => {
    expect(tokens).toMatch(/--bubble-base-ms: 2500;\s*--bubble-per-word-ms: 300;\s*--bubble-min-ms: 6000;\s*--bubble-max-ms: 15000;/);
    expect(tokens).toMatch(/--bubble-min-ms: 8000;\s*--bubble-per-word-ms: 400;/);
  });
  it('the guide shows one of the four crops (cutout poses map to think)', () => {
    expect(guidePose('celebrate')).toBe('celebrate');
    expect(guidePose('tip')).toBe('think');
    expect(guidePose(undefined)).toBe('think');
  });
});

describe('deal badge A / B / C (spec 8.3): one source, paybackTier', () => {
  const deal = (downPayment, monthlyCashFlow) => ({ type: 'apartment', downPayment, monthlyCashFlow });
  it('A <= 8 years, B <= 14, C above or with no cash flow; 0 down = A', () => {
    expect(dealBadgeModel(deal(48000, 500)).letter).toBe('A'); // 8.0 years
    expect(dealBadgeModel(deal(48000, 499)).letter).toBe('B');
    expect(dealBadgeModel(deal(84000, 500)).letter).toBe('B'); // 14.0 years
    expect(dealBadgeModel(deal(84000, 499)).letter).toBe('C');
    expect(dealBadgeModel(deal(10000, 0)).letter).toBe('C');
    expect(dealBadgeModel(deal(10000, -200)).letter).toBe('C');
    expect(dealBadgeModel(deal(0, 100)).letter).toBe('A');
    expect(TIER_LETTER).toEqual({ ok: 'A', slow: 'B', bad: 'C' });
  });
  it('stocks: dividend yield on the price; no dividend = "ספקולטיבי", never a letter', () => {
    expect(dealBadgeModel({ type: 'stock', price: 100, dividend: 0 }).kind).toBe('speculative');
    expect(dealBadgeModel({ type: 'stock', price: 100, dividend: 1 })).toMatchObject({ kind: 'tier', letter: 'B', yieldPct: 12 }); // 12% = 8.3 years
    expect(dealBadgeModel({ type: 'stock', price: 100, dividend: 1.25 }).letter).toBe('A');
    expect(he.deal.speculative).toBe('ספקולטיבי');
  });
  it('labels: family C is "איטית"', () => {
    expect(he.deal.badge).toEqual({ a: 'חזקה', b: 'סבירה', c: 'חלשה', cFamily: 'איטית' });
  });
});

describe('die timeline (spec 6.1)', () => {
  it('wind-up 80 + tumble 780 + settle 240 = 1100 (= --dur-die); the pawn starts 200ms after the land', () => {
    const tl = dieTimeline();
    expect(tl.total).toBe(1100);
    expect(tl.apex).toBe(430);
    expect(tl.tumbleEnd).toBe(860);
    expect(tl.pawnAfter).toBe(1300);
    expect(tokens).toMatch(/--dur-die-windup: 80ms;/);
    expect(tokens).toMatch(/--dur-die-tumble: 780ms;/);
    expect(tokens).toMatch(/--dur-die-settle: 240ms;/);
  });
});

describe('strings of spec section 12', () => {
  it('are all in he.json', () => {
    for (const k of ['board.youAreHere', 'board.landed', 'hud.goal', 'hud.goalFirst', 'hud.goalShort', 'deal.speculative', 'fox.lastMessage', 'legend.title', 'legend.open']) expect(get(k), k).toBeTruthy();
    expect(he.board.youAreHere).toBe('אתם על: {label}');
    expect(he.board.landed).toBe('נחתתם על: {label}');
    expect(he.hud.goal).toBe('המטרה: חופש כלכלי');
    expect(he.fox.lastMessage).toBe('מקסי: הודעה אחרונה');
  });
});
