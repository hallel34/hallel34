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
 * QA 0.5.1 P2-3 (home perf): the strings of the challenge and career features load only when a screen of the feature needs them.
 * src/i18n/he.json stays the one source of truth. In a production build each lazy group is cut out of he.json (all but its eager
 * keys, which home and the end screens show) and its family overrides out of tutorial.he.json; both come back from the virtual module
 * `virtual:i18n-lazy/<group>` through ensureStrings('<group>') (src/i18n/index.js). Dev and vitest keep the whole bundle (nothing is
 * cut), so every string test still sees every string. An eager entry is a dotted path; it keeps its whole subtree.
 */
const LAZY_GROUPS = {
  challenge: ['create.button', 'board.title', 'resume', 'resumeInfo'],
  career: ['seniority', 'plural', 'weekday', 'chipWait', 'untilDay'],
  profile: ['current'],
  achievement: [],
  promotion: [],
};
const LAZY_PREFIX = 'virtual:i18n-lazy/';
function lazyStringsPlugin() {
  let build = false;
  const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  const isEager = (group, path) => LAZY_GROUPS[group].some((e) => path === e || path.startsWith(`${e}.`));
  const isLazyOverride = (o) => typeof o?.key === 'string' && Object.keys(LAZY_GROUPS).some((g) => o.key.startsWith(`${g}.`) && !isEager(g, o.key.slice(g.length + 1)));
  /** The part of a group that stays eager (the eager paths with their subtrees). */
  const eagerPart = (group, tree) => {
    const keep = {};
    for (const e of LAZY_GROUPS[group]) {
      const path = e.split('.');
      const v = path.reduce((o, x) => o?.[x], tree);
      if (v === undefined) throw new Error(`lazy strings: eager key ${group}.${e} is missing`);
      let o = keep;
      for (const x of path.slice(0, -1)) o = (o[x] ??= {});
      o[path.at(-1)] = v;
    }
    return keep;
  };
  return {
    name: 'passivo-lazy-strings',
    enforce: 'pre',
    configResolved(c) { build = c.command === 'build'; },
    resolveId(id) { return id.startsWith(LAZY_PREFIX) && LAZY_GROUPS[id.slice(LAZY_PREFIX.length)] ? `\0${id}` : null; },
    load(id) {
      if (!id.startsWith(`\0${LAZY_PREFIX}`)) return null;
      const group = id.slice(`\0${LAZY_PREFIX}`.length);
      const strings = read('./src/i18n/he.json')[group];
      const family = Object.fromEntries((read('./src/data/learn/tutorial.he.json').familyStrings.overridesRound11 ?? [])
        .filter((o) => o.key.startsWith(`${group}.`) && !isEager(group, o.key.slice(group.length + 1))).map((o) => [o.key, o.family]));
      return `export default ${JSON.stringify({ strings, family })};`;
    },
    transform(code, id) {
      if (!build) return null;
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (file.endsWith('/src/i18n/he.json')) {
        const json = JSON.parse(code);
        for (const group of Object.keys(LAZY_GROUPS)) json[group] = eagerPart(group, json[group]);
        json.__lazy = Object.keys(LAZY_GROUPS);
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
