import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BANNED = [/rat\s*race/i, /מרוץ העכברים/, /יוצאים מהמרוץ/, /יצאתם מהמרוץ/, /fast\s*track/i, /exit the race/i];
const TEXT_EXT = /\.(js|mjs|json|html|css|md|webmanifest|svg|txt)$/;

function walk(p) {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((f) => walk(join(p, f)));
}

describe('brand naming rules', () => {
  const files = ['src', 'public', 'index.html', 'README.md']
    .flatMap((f) => walk(join(ROOT, f)))
    .filter((f) => TEXT_EXT.test(f));

  it('scans files', () => expect(files.length).toBeGreaterThan(10));

  it('contains no banned phrases', () => {
    const hits = [];
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const re of BANNED) if (re.test(s)) hits.push(`${f}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});

describe('character: the fox replaced the mouse mascot', () => {
  const srcFiles = walk(join(ROOT, 'src'));
  const MOUSE = /mouse|עכבר/i;

  it('has no mouse asset or mascot module in src (file names)', () => {
    expect(srcFiles.filter((f) => MOUSE.test(f.slice(ROOT.length)) || /\/mascot\.js$/.test(f))).toEqual([]);
  });

  it('has no "mouse"/"עכבר" reference in any src text file', () => {
    const hits = srcFiles.filter((f) => TEXT_EXT.test(f)).filter((f) => MOUSE.test(readFileSync(f, 'utf8'))).map((f) => f.slice(ROOT.length));
    expect(hits).toEqual([]);
  });

  it('ships the fox poses the UI relies on', () => {
    const names = srcFiles.map((f) => f.slice(ROOT.length));
    for (const pose of ['tired', 'wave', 'roll', 'hammock', 'tip']) {
      expect(names).toContain(`src/assets/fox/${pose}.webp`);
      expect(names).toContain(`src/assets/fox/${pose}@2x.webp`);
    }
    for (const crop of ['think', 'celebrate', 'worried', 'ponder']) expect(names).toContain(`src/assets/fox/${crop}.webp`);
    expect(names).toContain('src/assets/wordmark.svg');
  });
});
