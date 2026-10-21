// Tiny i18n: every <locale>.json in this folder is a bundle. Add a language = add a file.
const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });
const bundles = {};
for (const [path, dict] of Object.entries(modules)) {
  bundles[path.match(/\.\/(.+)\.json$/)[1]] = dict;
}

export const FALLBACK = 'he';
let locale = FALLBACK;

export const availableLocales = () => Object.keys(bundles);
export const getLocale = () => locale;
export const getMeta = () => bundles[locale].meta;
export const localeName = (l) => bundles[l]?.meta?.name ?? l;

/** Sets the active locale and syncs <html lang/dir>. */
export function setLocale(next) {
  locale = bundles[next] ? next : FALLBACK;
  const { lang, dir } = bundles[locale].meta;
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  return locale;
}

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
}

/** t('card.buy') or t('game.turn', { turn: 3 }). Falls back to the default locale, then the key. */
export function t(key, params) {
  let s = lookup(bundles[locale], key);
  if (typeof s !== 'string') s = lookup(bundles[FALLBACK], key);
  if (typeof s !== 'string') {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

const rules = {};
/**
 * Plural-aware text: tp('plural.turns', 1) -> "תור אחד", tp('plural.turns', 3) -> "3 תורות".
 * The key holds { one, two?, other } (Intl.PluralRules categories of the locale); {n} is replaced by the count.
 */
export function tp(key, n, params = {}) {
  let forms = lookup(bundles[locale], key);
  if (!forms || typeof forms !== 'object') forms = lookup(bundles[FALLBACK], key);
  if (!forms || typeof forms !== 'object') return key;
  const lang = bundles[locale].meta?.lang || locale;
  const cat = (rules[lang] ||= new Intl.PluralRules(lang)).select(n);
  const s = forms[cat] ?? forms.other ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k === 'n' ? new Intl.NumberFormat(bundles[locale].meta?.numberLocale || lang).format(n) : (k in params ? String(params[k]) : m)));
}
