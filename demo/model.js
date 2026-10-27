// Independent concept prototype. No engine imports, money or game-save access.
export const UPGRADES = [
  { cost: 12, title: 'בית קפה', detail: 'קירות, מכונת קפה ודלת פתוחה ללקוחות' },
  { cost: 24, title: 'הפינה שלך', detail: 'בוחרים איך העסק ייראה: מרפסת או טייק אוויי' },
  { cost: 36, title: 'קפה מקסי', detail: 'קומה חדשה, גינת גג ושלט מואר' },
];
export const TILES = ['coffee', 'coffee', 'rush', 'supply', 'coffee', 'spark', 'coffee', 'supply', 'rush', 'coffee', 'spark', 'coffee'];
export const EVENTS = {
  coffee: { points: 4, title: 'עוד קפה, עוד לקוח', line: 'הבוקר מתחיל. עוד צעד לעסק שלך.', icon: '☕' },
  rush: { points: 6, title: 'השולחנות מתמלאים', line: 'לקוחות חדשים גילו את הפינה שלך.', icon: '♥' },
  supply: { points: 5, title: 'המשלוח הגיע', line: 'פולים טריים בדרך למכונה.', icon: '▣' },
  spark: { points: 8, title: 'כולם מדברים עליך', line: 'המלצה טובה הביאה גל של לקוחות.', icon: '★' },
};
export function initialState() { return { position: 0, points: 4, level: 0, rolls: 0, style: null, last: null, die: 1 }; }
export function roll(state, die) {
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('Invalid die');
  if (state.level === 3) return state;
  const position = (state.position + die) % TILES.length;
  const event = EVENTS[TILES[position]];
  return { ...state, position, points: state.points + event.points, rolls: state.rolls + 1, die, last: event };
}
export function upgrade(state, style = state.style) {
  const next = UPGRADES[state.level];
  if (!next || state.points < next.cost) return state;
  if (state.level === 1 && !['terrace', 'takeaway'].includes(style)) return state;
  return { ...state, points: state.points - next.cost, level: state.level + 1, style, last: null };
}
export function remaining(state) { return Math.max(0, (UPGRADES[state.level]?.cost || 0) - state.points); }
