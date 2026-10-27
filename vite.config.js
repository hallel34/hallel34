import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { pruneLearn } from './scripts/prune-learn.js';

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
        // LCP image: the start screen shows the MaxiFox logo (alpha WebP, @1x/@2x) on every launch, so one static preload
        // with an imagesrcset replaces the old tired/wave pick (the first-launch greeting moved to the board guide).
        const prefix = base.endsWith('/') ? base : `${base}/`;
        const files = Object.keys(ctx.bundle || {});
        const find = (d) => files.find((f) => new RegExp(`(^|/)maxifox-logo-alpha-${d}-[\\w-]+\\.webp$`).test(f));
        const [logo1, logo2] = [find('1x'), find('2x')];
        const lcp = logo1 && logo2
          ? `<link rel="preload" as="image" href="${prefix}${logo1}" imagesrcset="${prefix}${logo1} 1x, ${prefix}${logo2} 2x">`
          : '';
        return html.replace('</head>', `  ${tags}\n  ${lcp}\n</head>`);
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

/** Production only: learning content ships without notes, sources, review text or unpublished real-world figures. */
function pruneLearnPlugin() {
  return {
    name: 'passivo-prune-learn',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const m = id.split('?')[0].replace(/\\/g, '/').match(/\/src\/data\/learn\/([a-z-]+)\.[a-z]+\.json$/);
      if (!m) return null;
      return { code: JSON.stringify(pruneLearn(m[1], JSON.parse(code))), map: null };
    },
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [pruneLearnPlugin(), pwaPlugin()],
  // the 3D board tiles stay real files (cacheable, preloadable, srcset), never base64 inside the JS bundle
  build: { rollupOptions: { input: { game: 'index.html', businessDemo: 'business-demo.html' } }, target: 'es2020', assetsInlineLimit: (file) => (/[\\/]tile3d[\\/]/.test(file) ? false : undefined) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
