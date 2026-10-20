import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Relative base works for GitHub Pages root, project pages and PR previews.
// CI overrides with BASE_PATH (e.g. /<repo>/pr-preview/pr-7/).
const base = process.env.BASE_PATH || './';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Injects font preloads into index.html and the precache list into dist/sw.js. */
function pwaPlugin() {
  let outDir = 'dist';
  return {
    name: 'passivo-pwa',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const fonts = Object.keys(ctx.bundle || {}).filter((f) => /rubik-(hebrew|latin)-(700|900)-normal.*\.woff2$/.test(f));
        const tags = fonts.map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${base.endsWith('/') ? base : `${base}/`}${f}">`).join('\n  ');
        return html.replace('</head>', `  ${tags}\n</head>`);
      },
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const list = ['./', ...files.map((f) => `./${f}`)];
      const src = readFileSync(swPath, 'utf8')
        .replace('/*__PRECACHE__*/[]', JSON.stringify(list))
        .replace('__BUILD_ID__', Date.now().toString(36));
      writeFileSync(swPath, src);
    },
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [pwaPlugin()],
  build: { target: 'es2020', assetsInlineLimit: 4096 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
