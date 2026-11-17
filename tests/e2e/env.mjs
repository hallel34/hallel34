// Shared environment helpers for the smokes that did not have their own (mission, missions, business demo).
// The pre-installed Chromium lives in different folders per host; `channel: 'chromium'` needs a Playwright-managed download, which a worktree
// or a sandbox may not have. Order: CHROMIUM_PATH, then the known pre-installed paths, else Playwright's default.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

export const chromiumExe = () => process.env.CHROMIUM_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);

/** Playwright launch options: the executable when one is found, else the managed Chromium channel. */
export const launchOptions = (extra = {}) => ({ headless: true, ...extra, ...(chromiumExe() ? { executablePath: chromiumExe() } : { channel: 'chromium' }) });

/** `vite preview` on `port` (strict) unless `url` is given; resolves { url, stop() }. Use a dedicated SMOKE_PORT: shared default ports collide between agents. */
export async function previewServer({ url = '', port = Number(process.env.SMOKE_PORT || 4190) } = {}) {
  if (url) return { url, stop() {} };
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const base = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* wait */ } await new Promise((r) => { setTimeout(r, 250); }); }
  return { url: base, stop() { server.kill('SIGTERM'); } };
}
