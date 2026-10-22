// The mode (family / full) the learning layer renders for. Set by the start screen and by the game screen;
// read by the glossary (which concepts exist), the markup renderer, the dictionary and the family vocabulary layer.
let mode = 'family';
const subscribers = new Set();
export const getLearnMode = () => mode;
export const setLearnMode = (m) => {
  const next = m === 'full' ? 'full' : 'family';
  mode = next;
  // the stylesheet needs it too: family mode never shows red (tokens.css)
  if (typeof document !== 'undefined') document.documentElement.dataset.learn = next;
  subscribers.forEach((fn) => fn(next));
};
/** Calls fn(mode) on every change; returns an unsubscribe function. */
export const onLearnMode = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };
