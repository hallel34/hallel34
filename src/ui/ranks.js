// 0.5.0: the career ranks of the professions load on demand in a production build (vite.config.js lazyRanksPlugin cuts `ranks` out of the main
// bundle). Anything that starts a ranked game, verifies a ranked link or names a rank awaits this first. Dev and tests have them already.
let loading = null;

/** Attaches `ranks` to engine.data.professions when they are not there yet. Resolves at once when they are. */
export function ensureRanks(engine) {
  const list = engine.data.professions;
  if (!list.some((p) => p.ranks === undefined)) return Promise.resolve();
  return (loading ??= import('virtual:ranks').then(({ default: ranks }) => {
    for (const p of list) if (ranks[p.id] && p.ranks === undefined) p.ranks = ranks[p.id];
  }).catch((err) => { loading = null; throw err; }));
}
