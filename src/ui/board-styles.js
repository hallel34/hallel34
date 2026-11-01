// The board stylesheets (board.css, then premium.css, which overrides it) are not needed on the home screen, so they are one
// chunk outside the render-blocking CSS: it loads at idle time after the first paint, and the board / cards wait for it.
// One chunk keeps their order (a993eba: premium must never load before board), and it lands after every eager sheet.
let pending = null;
export const loadBoardStyles = () => (pending ??= import('../styles/board-bundle.css').catch((err) => { pending = null; throw err; }));
