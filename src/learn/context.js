// The mode (family / full) the learning layer renders for. Set by the start screen and by the game screen;
// read by the glossary (which concepts exist), the markup renderer and the dictionary.
let mode = 'family';
export const getLearnMode = () => mode;
export const setLearnMode = (m) => { mode = m === 'full' ? 'full' : 'family'; };
