// `npm run icons` — regenerates every app icon from design/character/passivo-fox-hero.jpg.
// The work is done by scripts/make-icons.py (Pillow). Requires: python3 + `pip install pillow numpy`.
import { spawnSync } from 'node:child_process';
const py = process.env.PYTHON || 'python3';
const r = spawnSync(py, [new URL('./make-icons.py', import.meta.url).pathname], { stdio: 'inherit' });
if (r.status !== 0) { console.error('make-icons failed (is Pillow installed? pip install pillow numpy)'); process.exit(r.status ?? 1); }
