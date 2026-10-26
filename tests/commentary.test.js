import { describe, it, expect } from 'vitest';
import { createCommentaryGate } from '../src/ui/commentary.js';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
describe('quiet presentation without losing game facts', () => {
  it('paces the same purchase lesson even when wording/tier changes', () => {
    const allow = createCommentaryGate();
    expect(allow({ group: 'buy.good' }, { player: 0, turn: 2 })).toBe(true);
    expect(allow({ group: 'buy.ok' }, { player: 0, turn: 3 })).toBe(false);
    expect(allow({ group: 'buy.stock' }, { player: 0, turn: 5 })).toBe(false);
    expect(allow({ group: 'buy.ok' }, { player: 0, turn: 6 })).toBe(true);
  });
  it('never carries cooldown between players or hides a different outcome', () => {
    const allow = createCommentaryGate();
    const rq = { group: 'expense.cushion' };
    expect(allow(rq, { player: 0, turn: 3 })).toBe(true);
    expect(allow(rq, { player: 1, turn: 3 })).toBe(true);
    expect(allow({ group: 'expense.loan' }, { player: 0, turn: 3 })).toBe(true);
    for (const turn of [3, 4, 5]) expect(allow({ group: 'buy.trap', tone: 'warn' }, { player: 0, turn })).toBe(true);
  });
  it('keeps full feedback for recap/report before gating just its automatic bubble', () => {
    const src = read('src/ui/learn-flow.js');
    expect(src.indexOf('turnFeedback.push')).toBeLessThan(src.indexOf('if (!allowComment'));
    expect(JSON.parse(read('src/i18n/he.json')).commentary['buy_good']).not.toContain('שנים');
    expect(read('src/ui/payday.js')).toContain("const v = 'b'");
    expect(read('src/ui/play.js')).toContain('chip.hidden = true');
    expect(read('src/ui/play.js')).toContain('document.createTextNode(String(n))');
  });
});
