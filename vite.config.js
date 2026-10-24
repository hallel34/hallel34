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
        // LCP image: the start screen shows `wave` on first launch (flag passivo.seenIntro unset), otherwise `tired`.
        // A tiny inline script preloads the right one (with @1x/@2x srcset) so the browser does not fetch both.
        const prefix = base.endsWith('/') ? base : `${base}/`;
        const files = Object.keys(ctx.bundle || {});
        const pick = (name) => ['', '@2x'].map((d) => files.find((f) => new RegExp(`(^|/)${name}${d}-[\\w-]+\\.webp$`).test(f))).map((f) => (f ? `${prefix}${f}` : null));
        const [wave1, wave2] = pick('wave');
        const [tired1, tired2] = pick('tired');
        const lcp = wave1 && tired1
          ? `<script>try{var w=!localStorage.getItem('passivo.seenIntro'),u=w?['${wave1}','${wave2}']:['${tired1}','${tired2}'],l=document.createElement('link');l.rel='preload';l.as='image';l.href=u[0];l.setAttribute('imagesrcset',u[0]+' 1x, '+u[1]+' 2x');l.setAttribute('fetchpriority','high');document.head.appendChild(l)}catch(e){}</script>`
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
  build: { target: 'es2020', assetsInlineLimit: (file) => (/[\\/]tile3d[\\/]/.test(file) ? false : undefined) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
