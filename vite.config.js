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

/**
 * QA 0.5.1 P2-3 (home perf): the `challenge.*` strings load only when a challenge screen or the share button needs them.
 * src/i18n/he.json stays the one source of truth. In a production build the group is cut out of he.json (all but LAZY_EAGER,
 * which home and the end screens show) and the challenge family overrides out of tutorial.he.json; both come back from the
 * virtual module `virtual:i18n-lazy/challenge` through ensureStrings('challenge') (src/i18n/index.js). Dev and vitest keep the
 * whole bundle (nothing is cut), so every string test still sees every string.
 */
const LAZY_GROUP = 'challenge';
const LAZY_EAGER = ['create.button', 'board.title', 'resume', 'resumeInfo'];
const LAZY_ID = `virtual:i18n-lazy/${LAZY_GROUP}`;
function lazyStringsPlugin() {
  let build = false;
  const eagerKey = (k) => LAZY_EAGER.includes(k.slice(LAZY_GROUP.length + 1));
  const isLazyOverride = (o) => typeof o?.key === 'string' && o.key.startsWith(`${LAZY_GROUP}.`) && !eagerKey(o.key);
  const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  return {
    name: 'passivo-lazy-strings',
    enforce: 'pre',
    configResolved(c) { build = c.command === 'build'; },
    resolveId(id) { return id === LAZY_ID ? `\0${LAZY_ID}` : null; },
    load(id) {
      if (id !== `\0${LAZY_ID}`) return null;
      const strings = read('./src/i18n/he.json')[LAZY_GROUP];
      const family = Object.fromEntries((read('./src/data/learn/tutorial.he.json').familyStrings.overridesRound11 ?? []).filter(isLazyOverride).map((o) => [o.key, o.family]));
      return `export default ${JSON.stringify({ strings, family })};`;
    },
    transform(code, id) {
      if (!build) return null;
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (file.endsWith('/src/i18n/he.json')) {
        const json = JSON.parse(code);
        const keep = {};
        for (const k of LAZY_EAGER) {
          const v = k.split('.').reduce((o, x) => o?.[x], json[LAZY_GROUP]);
          if (v === undefined) throw new Error(`lazy strings: eager key ${LAZY_GROUP}.${k} is missing`);
          const path = k.split('.');
          let o = keep;
          for (const x of path.slice(0, -1)) o = (o[x] ??= {});
          o[path.at(-1)] = v;
        }
        json[LAZY_GROUP] = keep;
        json.__lazy = [LAZY_GROUP];
        return { code: JSON.stringify(json), map: null };
      }
      if (file.endsWith('/src/data/learn/tutorial.he.json')) {
        const json = JSON.parse(code);
        const fs = json.familyStrings;
        if (fs?.overridesRound11) fs.overridesRound11 = fs.overridesRound11.filter((o) => !isLazyOverride(o));
        return { code: JSON.stringify(json), map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [pruneLearnPlugin(), lazyStringsPlugin(), pwaPlugin()],
  // the 3D board tiles stay real files (cacheable, preloadable, srcset), never base64 inside the JS bundle
  // modulePreload polyfill off: it was the only module both entries shared, so it became a separate render-path script on the home
  // screen (QA round 19 perf); every browser the app targets supports <link rel=modulepreload> natively
  build: { modulePreload: { polyfill: false }, rollupOptions: {
    input: { game: 'index.html', businessDemo: 'business-demo.html' },
    // QA 0.5.1 P2-3: the action-log codec and the challenge verifier do no top-level work, so a bundle that never uses them (home)
    // drops them; rollup would otherwise keep them for `class ActionLogError extends Error`
    treeshake: { moduleSideEffects: (id) => !/[\\/]src[\\/]engine[\\/](actionlog|challenge)\.js$/.test(id) },
  }, target: 'es2020', assetsInlineLimit: (file) => (/[\\/]tile3d[\\/]/.test(file) ? false : undefined) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
