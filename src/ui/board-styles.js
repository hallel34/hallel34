// Board styles load before premium overrides in main.js. No late stylesheet race on first play.
export const loadBoardStyles = () => Promise.resolve();
