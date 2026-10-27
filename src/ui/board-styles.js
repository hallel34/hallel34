// The board stylesheet (v4 stage: tiles, skyline, fox strip, die result, legend, deal badge) is not needed on the home screen, so it
// is split out of the render-blocking CSS: it loads at idle time after the first paint, and the board / cards wait for it.
let pending = null;
export const loadBoardStyles = () => (pending ??= import('../styles/board.css').catch((err) => { pending = null; throw err; }));
