// `npm run icons` — rebuilds the MaxiFox brand files (app icons in public/icons, the alpha logo, the contact sheet) from the
// approved logo source design/brand/maxifox-logo-source.jpg, with the designer's pipeline in design/brand/scripts/
// (alpha.py -> build.py -> sheet.py), then copies the in-app logo into src/assets/brand/.
// The old pipeline (scripts/make-icons.py, built from the orange hero art) is retired: it overwrote the MaxiFox icons.
// Requires: python3 + `pip install pillow numpy`. Run from anywhere; it works from the repo root.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const py = process.env.PYTHON || 'python3';
const tmp = mkdtempSync(join(tmpdir(), 'maxifox-brand-'));
const run = (script, args = []) => {
  const r = spawnSync(py, [join(root, 'design/brand/scripts', script), ...args], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) { console.error(`${script} failed (is Pillow installed? pip install pillow numpy)`); process.exit(r.status ?? 1); }
};
try {
  run('alpha.py', [tmp]);
  run('build.py', [tmp]);
  run('sheet.py');
  for (const d of ['1x', '2x']) copyFileSync(join(root, `design/brand/maxifox-logo-alpha-${d}.webp`), join(root, `src/assets/brand/maxifox-logo-alpha-${d}.webp`));
} finally { rmSync(tmp, { recursive: true, force: true }); }
