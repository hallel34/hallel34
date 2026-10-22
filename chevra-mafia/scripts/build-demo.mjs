// Builds chevra-mafia/demo/index.html: a self-contained, solo-playable demo
// (in-memory Firestore shim + bots, no external network). Usage: node scripts/build-demo.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const shim = readFileSync(resolve(root, 'scripts/demo-shim.js'), 'utf8');
if (shim.includes('</script')) throw new Error('shim must not contain </script');

const tags = /<script src="https:\/\/www\.gstatic\.com\/[^"]*"><\/script>\s*/g;
if ((html.match(tags) || []).length !== 2) throw new Error('expected 2 gstatic script tags');
let first = true;
html = html.replace(tags, () => { if (first) { first = false; return `<script>\n${shim}</script>\n`; } return ''; });

const cfg = /apiKey: "PASTE_API_KEY",[\s\S]*?appId: "PASTE"/;
if (!cfg.test(html)) throw new Error('firebaseConfig block not found');
html = html.replace(cfg, 'apiKey: "demo-key", authDomain: "demo.local", projectId: "demo", storageBucket: "demo.local", messagingSenderId: "0", appId: "demo"');

if (/gstatic|PASTE_API_KEY/.test(html)) throw new Error('leftover external/PASTE reference');
const out = resolve(root, 'demo/index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes');
