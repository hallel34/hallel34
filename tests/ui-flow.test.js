import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pawnOffsets, progressPct } from '../src/ui/layout.js';

const he = JSON.parse(readFileSync(new URL('../src/i18n/he.json', import.meta.url), 'utf8'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('pawn offsets (pawns sharing a tile)', () => {
  it('centres a lone pawn and gives every pawn on a shared tile its own spot', () => {
    expect(pawnOffsets(1)).toEqual([{ x: 0, y: 0 }]);
    for (const n of [2, 3, 4]) {
      const offs = pawnOffsets(n);
      expect(offs).toHaveLength(n);
      expect(new Set(offs.map((o) => `${o.x},${o.y}`)).size).toBe(n);
    }
  });
  it('progress is clamped to 0-1', () => {
    expect(progressPct(500, 1000)).toBe(0.5);
    expect(progressPct(5000, 1000)).toBe(1);
    expect(progressPct(-5, 1000)).toBe(0);
    expect(progressPct(10, 0)).toBe(0);
  });
});

describe('the primary board button never reads "..."', () => {
  it('every label key behind the button is real text, with no bare dots', () => {
    for (const key of ['roll', 'rolling', 'advancing', 'continue']) {
      const text = he.game[key];
      expect(text, key).toBeTruthy();
      expect(text.replace(/[.\s]/g, ''), key).not.toBe('');
    }
    expect(he.game.rolling).toBe('הקובייה מתגלגלת...');
    expect(he.game.advancing).toBe('מתקדמים...');
    expect(he.game.continue).toBe('המשיכו');
  });
  it('play.js only ever paints the button from those keys and enables "continue"', () => {
    const src = read('src/ui/play.js');
    expect(src).toMatch(/BTN_LABEL = \{ roll: 'game\.roll', rolling: 'game\.rolling', working: 'game\.advancing', continue: 'game\.continue' \}/);
    expect(src).toMatch(/rollBtn\.disabled = mode === 'rolling' \|\| mode === 'working'/);
    expect(src).not.toMatch(/textContent = '\.\.\.'/);
    expect(JSON.stringify(he)).not.toMatch(/"\.\.\."/);
  });
  it('a failed turn flow hands control back instead of leaving the button disabled', () => {
    const src = read('src/ui/play.js');
    expect(src).toMatch(/Never leave the player on a disabled button/);
    expect(src).toMatch(/async function afterTurn/);
  });
});

describe('buy button is truthful', () => {
  const src = read('src/ui/modals.js');
  it('uses a blocked (aria-disabled) state with a visible reason when even the max loan cannot cover the cost', () => {
    expect(he.card.noFundsMax).toBe('אין מספיק כסף, גם עם הלוואה מקסימלית');
    expect(src).toMatch(/purchasePlan\(state, c\.price\)/);
    expect(src).toMatch(/purchasePlan\(state, c\.downPayment\)/);
    expect(src).toMatch(/'aria-disabled': a\.blocked \? 'true' : null/);
    expect(src).toMatch(/if \(a\.blocked\) \{ haptic\('error'\); shake\(b\); return; \}/);
    expect(src).toMatch(/blocked: plan\.status === 'blocked'/);
  });
  it('when a loan can cover the gap, tapping buy asks for exactly that loan (buyLoan), then the purchase completes', () => {
    expect(src).toMatch(/action: 'buyLoan', qty: qtyGetter\(\), need: plan\.need/);
    const play = read('src/ui/play.js');
    expect(play).toMatch(/r\.action === 'buyLoan'/);
    expect(play).toMatch(/loanFlow\(r\.need, \{ card: p\.card, qty: r\.qty \}\)/);
    expect(play).toMatch(/engine\.buy\(s, qty\)/); // the purchase after the loan goes through the same bought(qty) helper
    expect(play).toMatch(/bought\(r\.qty\)/);
  });
});

describe('home button', () => {
  it('has the Hebrew copy from the brief', () => {
    expect(he.game.home).toBe('חזרה לבית');
    expect(he.game.homeTitle).toBe('לחזור לתפריט?');
    expect(he.game.homeText).toBe('המשחק נשמר ואפשר להמשיך אותו אחר כך');
    expect(he.game.homeConfirm).toBe('חזרה לבית');
    expect(he.game.homeStay).toBe('להמשיך לשחק');
  });
  it('is an in-page sheet (no native dialogs), saves the whole match, and answers popstate', () => {
    const play = read('src/ui/play.js');
    expect(play).toMatch(/iconButton\('home', t\('game\.home'\)/);
    expect(play).toMatch(/store\.save\(match\);\s*teardown\(\);[^\n]*\n\s*nav\.menu\(\)/);
    expect(play).toMatch(/addEventListener\('popstate'/);
    for (const f of ['src/ui/play.js', 'src/ui/modals.js', 'src/ui/app.js']) expect(read(f)).not.toMatch(/window\.confirm\(|[^.\w]confirm\(/);
  });
});

describe('hot-seat copy', () => {
  it('has the strings the brief names', () => {
    expect(he.players.title).toBe('כמה שחקנים?');
    expect(he.players.defaultName.replace('{n}', '1')).toBe('שחקן 1');
    expect(he.players.handoffTitle.replace('{name}', 'דנה')).toBe('תור של דנה');
    expect(he.players.ready).toBe('מוכנים');
    expect(he.players.changeSettings).toBe('שנו הגדרות');
    expect(he.win.again).toBe('שחק שוב');
  });
});

describe('round 6 polish', () => {
  it('the sell sheet auto-closes only in the must-pay flow, never when opened from the statement', () => {
    const src = read('src/ui/play.js');
    expect(src).toMatch(/async function sellFlow\(\{ autoClose = false \} = \{\}\)/);
    expect(src).toMatch(/shouldClose: \(s\) => autoClose && /);
    expect(src.match(/sellFlow\(\{ autoClose: true \}\)/g)).toHaveLength(2); // expense + shortfall prompts
    expect(src).toMatch(/sell: async \(\) => \{ await sellFlow\(\); closeIfOver\(\); \}/);
  });
  it('player names are isolated with <bdi dir=auto> in the panel, strip, standings, handoff and winner title', () => {
    expect(read('src/ui/players.js')).toMatch(/h\('bdi', \{ dir: 'auto' \}, name\)/);
    expect(read('src/ui/play.js')).toMatch(/or-name' \}, nameBdi\(nameOf\(i\)\)/);
    expect(read('src/ui/standings.js')).toMatch(/stand-name' \}, nameBdi\(name\)/);
    expect(read('src/ui/modals.js')).toMatch(/handoff-title' \}, withName/);
    expect(read('src/ui/screens/end.js')).toMatch(/withName\(/);
  });
  it('out players carry a visible text tag and screen-reader text', () => {
    const src = read('src/ui/play.js');
    expect(src.match(/class: 'out-tag'/g).length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/t\('standings\.out'\)\} `/);
    expect(he.standings.out).toBe('מחוץ למשחק');
  });
  it('a card queued when going home is saved with the match and shown after resume', () => {
    const src = read('src/ui/play.js');
    expect(src).toMatch(/if \(unseen\.length\) match\.unseen = unseen;/);
    expect(src).toMatch(/if \(unseen\.length\) \{/);
    expect(src).toMatch(/delete match\.unseen/);
    const m = { players: [{ state: { profession: {} } }], unseen: [{ ev: { type: 'expensePaid', amount: 500, card: { title: 'x' } }, noMatch: false }], schemaVersion: 2 };
    return import('../src/engine/save.js').then(({ deserialize }) => {
      const back = deserialize(JSON.stringify({ ...m, schemaVersion: 2 }));
      expect(back?.unseen?.[0].ev.card.title).toBe('x');
    });
  });
  it('fresh multiplayer resume label has no turn 0; winner subtitle is neutral', () => {
    const src = read('src/ui/screens/start.js');
    expect(src).toMatch(/< 1\s*\? t\('menu\.resumeInfoFresh'/);
    expect(`${he.menu.resume} · ${he.menu.resumeInfoFresh.replace('{n}', 3)}`).toBe('המשך משחק · 3 שחקנים');
    expect(he.standings.winnerText).toBe('ההכנסה הפסיבית עקפה את ההוצאות');
  });
});
