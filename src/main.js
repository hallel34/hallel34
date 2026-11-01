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
import { createApp, loadPlay } from './ui/app.js';
import { registerServiceWorker } from './services/pwa.js';
import { preloadTiles } from './ui/tiles.js';
import { loadBoardStyles } from './ui/board-styles.js';
import { prepareBoardImage } from './ui/board-ready.js';

// ?theme=light|dark|auto switches (and remembers) the theme: handy for QA and screenshots.
const themeParam = new URLSearchParams(location.search).get('theme');
if (['light', 'dark', 'auto'].includes(themeParam)) setPref('theme', themeParam);
setLocale(getPrefs().locale);
applyPrefs();
document.title = t('app.title');

const host = document.getElementById('app');
try {
  createApp(host).start();
  document.getElementById('splash')?.remove();
} catch (err) {
  document.getElementById('splash')?.remove();
  console.error(err);
  host.textContent = `${t('app.loadError')} (${err.message})`;
}
registerServiceWorker();
// the board is the main screen: its 3D tile art is preloaded at idle time after the first paint (never ahead of the home screen's LCP)
preloadTiles();
// the board stylesheets are one chunk (not render-blocking on the home screen), fetched at idle time; the board awaits them (app.js)
const idle = globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 1200));
idle(() => loadBoardStyles().catch(() => {}), { timeout: 2500 });
// the board's script chunk and its 90 KB image are warmed up well after the home screen's largest paint (they shared the bandwidth
// with the start screen's fonts and script before: QA round 19 perf); a fast tap on play just starts them in goPlay, which awaits both
const warmBoard = () => setTimeout(() => idle(() => {
  loadPlay().catch(() => {});
  prepareBoardImage().catch(() => {});
}, { timeout: 2000 }), 1500);
if (document.readyState === 'complete') warmBoard(); else addEventListener('load', warmBoard, { once: true });
