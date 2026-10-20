// Settings + how-to dialogs.
import { h } from './dom.js';
import { t, availableLocales, getLocale, localeName } from '../i18n/index.js';
import { openLayer, closeButton } from './modal.js';
import { getPrefs, setPref } from './prefs.js';
import { button } from './widgets.js';
import { haptic, sound } from './fx.js';
import { PAYDAY_MONTHS } from '../engine/index.js';

function toggleRow(label, key) {
  const input = h('input', { type: 'checkbox', role: 'switch', class: 'switch-input', id: `pref-${key}` });
  input.checked = !!getPrefs()[key];
  input.addEventListener('change', () => {
    setPref(key, input.checked);
    if (key === 'haptics' && input.checked) haptic('land');
    if (key === 'sound' && input.checked) sound('coin');
  });
  return h('label', { class: 'setting-row', for: `pref-${key}` },
    h('span', null, label), input, h('span', { class: 'switch', 'aria-hidden': 'true' }, h('i', null)));
}

export function openSettings({ onQuit, version = '' } = {}) {
  let layer;
  const themeBtns = ['dark', 'light', 'auto'].map((k) => {
    const label = { dark: t('settings.themeDark'), light: t('settings.themeLight'), auto: t('settings.themeAuto') }[k];
    return h('button', {
      type: 'button', class: 'seg-btn', 'data-theme-opt': k, 'aria-pressed': String(getPrefs().theme === k),
      onClick: (e) => {
        setPref('theme', k);
        e.currentTarget.parentElement.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    }, label);
  });
  const content = h('div', { class: 'dialog' },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, t('settings.title')), closeButton(() => layer.close())),
    toggleRow(t('settings.sound'), 'sound'),
    toggleRow(t('settings.haptics'), 'haptics'),
    toggleRow(t('settings.reducedMotion'), 'reduceMotion'),
    h('div', { class: 'setting-block' }, h('span', null, t('settings.theme')), h('div', { class: 'seg', role: 'group' }, themeBtns)),
    availableLocales().length > 1 ? h('div', { class: 'setting-block' }, h('span', null, t('settings.language')),
      h('div', { class: 'seg', role: 'group' }, availableLocales().map((l) => h('button', {
        type: 'button', class: 'seg-btn', 'data-locale': l, 'aria-pressed': String(getLocale() === l),
        onClick: () => { setPref('locale', l); location.reload(); },
      }, localeName(l))))) : null,
    onQuit ? h('div', { class: 'dialog-actions col' },
      h('p', { class: 'dialog-text' }, t('settings.quitConfirm')),
      button(t('settings.quit'), { variant: 'secondary', 'data-action': 'quit', onClick: () => { layer.close(); onQuit(); } })) : null,
    version ? h('p', { class: 'muted small' }, t('settings.version', { version })) : null);
  layer = openLayer(content, { kind: 'modal', label: t('settings.title'), cls: 'layer-dialog' });
  return layer.closed;
}

export function openHowTo() {
  let layer;
  const content = h('div', { class: 'dialog' },
    h('div', { class: 'dialog-head' }, h('h2', { class: 'dialog-title' }, t('howto.title')), closeButton(() => layer.close())),
    h('ol', { class: 'howto' }, [1, 2, 3, 4].map((n) => h('li', null, t(`howto.step${n}`, { months: PAYDAY_MONTHS })))),
    h('div', { class: 'dialog-actions' }, button(t('card.ok'), { variant: 'primary', 'data-autofocus': '', onClick: () => layer.close() })));
  layer = openLayer(content, { kind: 'modal', label: t('howto.title'), cls: 'layer-dialog' });
  return layer.closed;
}
