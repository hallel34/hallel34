// The running app's engine, for the pieces that open from anywhere (settings, help) and need the game data (the story's numbers).
let session = { engine: null };
export const setSession = (next) => { session = { ...session, ...next }; };
export const getEngine = () => session.engine;
