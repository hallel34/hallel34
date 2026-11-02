// The mission screens' stylesheet is not needed on the home screen (only its entry button is, in mission-home.css), so it is a
// lazy chunk outside the render-blocking CSS: the chooser and the mission screens await it (app.js). The service worker precaches it.
let pending = null;
export const loadMissionStyles = () => (pending ??= import('../styles/mission.css').catch((err) => { pending = null; throw err; }));
