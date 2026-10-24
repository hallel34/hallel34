import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/fox.css';
import './styles/learn.css';
import './styles/tutorial.css';
import { setLocale, t } from './i18n/index.js';
import { applyPrefs, getPrefs, setPref } from './ui/prefs.js';
import { createApp } from './ui/app.js';
import { registerServiceWorker } from './services/pwa.js';
import { preloadTiles } from './ui/tiles.js';
import { loadBoardStyles } from './ui/board-styles.js';

// ?theme=light|dark|auto switches (and remembers) the theme: handy for QA and screenshots.
const themeParam = new URLSearchParams(location.search).get('theme');
if (['light', 'dark', 'auto'].includes(themeParam)) setPref('theme', themeParam);
setLocale(getPrefs().locale);
applyPrefs();
document.title = t('app.title');

const host = document.getElementById('app');
try {
  createApp(host).start();
} catch (err) {
  console.error(err);
  host.textContent = `${t('app.loadError')} (${err.message})`;
}
registerServiceWorker();
// the board is the main screen: its 3D tile art is preloaded at idle time after the first paint (never ahead of the home screen's LCP)
preloadTiles();
// the board stylesheet is a separate chunk (not render-blocking on the home screen): fetched at idle time, awaited by the board
(globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 1200)))(() => loadBoardStyles().catch(() => {}), { timeout: 2500 });
