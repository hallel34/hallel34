import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/fox.css';
import { setLocale, t } from './i18n/index.js';
import { applyPrefs, getPrefs, setPref } from './ui/prefs.js';
import { createApp } from './ui/app.js';
import { registerServiceWorker } from './services/pwa.js';

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
