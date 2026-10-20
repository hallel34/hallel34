// Rasterizes src/assets/app-icon-*.svg into the PWA PNG icons in public/icons.
// Uses Playwright's chromium (set CHROMIUM_PATH or rely on the default location).
// Usage: node scripts/make-icons.mjs
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const exe = process.env.CHROMIUM_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const read = (f) => readFileSync(new URL(`../src/assets/${f}`, import.meta.url), 'utf8');
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const jobs = [
  { file: 'icon-512.png', size: 512, html: (s) => `<img src="${dataUri(read('app-icon-512.svg'))}" width="${s}" height="${s}">` },
  { file: 'icon-192.png', size: 192, html: (s) => `<img src="${dataUri(read('app-icon-512.svg'))}" width="${s}" height="${s}">` },
  { file: 'apple-touch-icon.png', size: 180, html: (s) => `<img src="${dataUri(read('app-icon-512.svg'))}" width="${s}" height="${s}">` },
  {
    file: 'icon-maskable-512.png', size: 512,
    html: (s) => `<div style="position:relative;width:${s}px;height:${s}px"><img src="${dataUri(read('app-icon-background.svg'))}" width="${s}" height="${s}" style="position:absolute;inset:0"><img src="${dataUri(read('app-icon-foreground.svg'))}" width="${s}" height="${s}" style="position:absolute;inset:0"></div>`,
  },
];

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  await page.setContent(`<body style="margin:0">${job.html(job.size)}</body>`);
  await page.waitForTimeout(150);
  writeFileSync(new URL(job.file, out), await page.screenshot({ type: 'png', omitBackground: false }));
  await page.close();
}
await browser.close();
console.log('icons written to public/icons');
