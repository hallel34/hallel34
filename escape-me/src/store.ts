import type { GameConfig, InRoomPuzzle, RoomId, StagePlacement, StageType, WorldConfig, WorldPickup } from './types';
import { STAGE_ORDER_ALL } from './types';
import { DEMO_CONFIG } from './demo';
import { PRESET_ITEMS, ROOM_MAP } from './world/catalog';

const ROOM_IDS = Object.keys(ROOM_MAP) as RoomId[];

/** Sensible default placements so any pre-v5 game still plays in the house. */
const DEFAULT_SPOTS: { room: RoomId; hotspot: string }[] = [
  { room: 'living', hotspot: 'tv' },
  { room: 'bedroom1', hotspot: 'desk' },
  { room: 'living', hotspot: 'bookshelf' },
  { room: 'kitchen', hotspot: 'fridge' },
  { room: 'hallway', hotspot: 'picture' },
];

export function defaultWorld(celebrantName: string, stageOrder: StageType[]): WorldConfig {
  const placements: WorldConfig['placements'] = {};
  stageOrder.forEach((t, i) => {
    const spot = DEFAULT_SPOTS[i % DEFAULT_SPOTS.length];
    placements[t] = { room: spot.room, hotspot: spot.hotspot, mode: 'overlay' };
  });
  return {
    goal: `המתנה של ${celebrantName} נעולה ומחכה איפשהו בבית! פתרו את כל החידות, אספו את הפריטים בדרך — ופתחו את היעד הסופי.`,
    placements,
    pickups: [],
    items: { ...PRESET_ITEMS },
    finalTarget: { room: 'bedroom2', hotspot: 'safe', label: 'הכספת עם המתנה', requiresAllStages: true },
  };
}

function sanitizeInRoom(raw: unknown): InRoomPuzzle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = r.kind === 'code' || r.kind === 'search' ? r.kind : 'riddle';
  const options = Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === 'string').slice(0, 4) : [];
  while (options.length < 4) options.push('');
  return {
    kind,
    prompt: typeof r.prompt === 'string' && r.prompt ? r.prompt : 'יש כאן חידה…',
    code: typeof r.code === 'string' ? r.code.replace(/\D/g, '').slice(0, 5) || '123' : '123',
    options,
    correctIndex: typeof r.correctIndex === 'number' ? Math.min(3, Math.max(0, Math.floor(r.correctIndex))) : 0,
    successText: typeof r.successText === 'string' && r.successText ? r.successText : 'כל הכבוד! פתרתם את החידה.',
  };
}

function sanitizePlacement(raw: unknown, fallback: StagePlacement): StagePlacement {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const room = typeof r.room === 'string' && ROOM_IDS.includes(r.room as RoomId) ? (r.room as RoomId) : fallback.room;
  const validHotspots = ROOM_MAP[room].hotspots.map((h) => h.id);
  const hotspot = typeof r.hotspot === 'string' && validHotspots.includes(r.hotspot) ? r.hotspot : validHotspots[0];
  const mode = r.mode === 'inroom' ? 'inroom' : 'overlay';
  return {
    room,
    hotspot,
    mode,
    inRoom: mode === 'inroom' ? sanitizeInRoom(r.inRoom) : undefined,
    givesItem: typeof r.givesItem === 'string' && r.givesItem ? r.givesItem : undefined,
  };
}

export function sanitizeWorld(raw: unknown, celebrantName: string, stageOrder: StageType[]): WorldConfig {
  const base = defaultWorld(celebrantName, stageOrder);
  if (!raw || typeof raw !== 'object') return base;
  const w = raw as Record<string, unknown>;
  const placements: WorldConfig['placements'] = {};
  const rawPlacements = (w.placements && typeof w.placements === 'object' ? w.placements : {}) as Record<string, unknown>;
  for (const t of stageOrder) {
    placements[t] = sanitizePlacement(rawPlacements[t], base.placements[t] ?? { room: 'living', hotspot: 'sofa', mode: 'overlay' });
  }
  const items: WorldConfig['items'] = { ...PRESET_ITEMS };
  if (w.items && typeof w.items === 'object') {
    for (const [k, v] of Object.entries(w.items as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const iv = v as Record<string, unknown>;
        if (typeof iv.label === 'string' && typeof iv.emoji === 'string') items[k] = { label: iv.label, emoji: iv.emoji };
      }
    }
  }
  const pickups: WorldPickup[] = [];
  if (Array.isArray(w.pickups)) {
    w.pickups.slice(0, 6).forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      const pr = p as Record<string, unknown>;
      const room = typeof pr.room === 'string' && ROOM_IDS.includes(pr.room as RoomId) ? (pr.room as RoomId) : 'kitchen';
      const validHotspots = ROOM_MAP[room].hotspots.map((h) => h.id);
      const hotspot = typeof pr.hotspot === 'string' && validHotspots.includes(pr.hotspot) ? pr.hotspot : validHotspots[0];
      pickups.push({
        id: typeof pr.id === 'string' && pr.id ? pr.id : `pickup-${i}`,
        room,
        hotspot,
        itemId: typeof pr.itemId === 'string' && pr.itemId ? pr.itemId : 'code-note',
        foundText: typeof pr.foundText === 'string' ? pr.foundText : 'מצאתם משהו!',
      });
    });
  }
  const ft = (w.finalTarget && typeof w.finalTarget === 'object' ? w.finalTarget : {}) as Record<string, unknown>;
  const ftRoom = typeof ft.room === 'string' && ROOM_IDS.includes(ft.room as RoomId) ? (ft.room as RoomId) : base.finalTarget.room;
  const ftHotspots = ROOM_MAP[ftRoom].hotspots.map((h) => h.id);
  return {
    goal: typeof w.goal === 'string' && w.goal ? w.goal : base.goal,
    placements,
    pickups,
    items,
    finalTarget: {
      room: ftRoom,
      hotspot: typeof ft.hotspot === 'string' && ftHotspots.includes(ft.hotspot) ? ft.hotspot : base.finalTarget.hotspot,
      label: typeof ft.label === 'string' && ft.label ? ft.label : base.finalTarget.label,
      requiresItem: typeof ft.requiresItem === 'string' && ft.requiresItem ? ft.requiresItem : undefined,
      requiresAllStages: typeof ft.requiresAllStages === 'boolean' ? ft.requiresAllStages : true,
    },
  };
}

export const STORAGE_KEY = 'escapeme.config.v1';

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function encodeConfig(c: GameConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConfig(s: string): GameConfig | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return validate(JSON.parse(text));
  } catch { return null; }
}

function validate(raw: unknown): GameConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.celebrantName !== 'string' || !r.celebrantName) return null;
  if (!Array.isArray(r.stageOrder) || r.stageOrder.length !== 5) return null;
  const known = new Set<string>(STAGE_ORDER_ALL);
  if (!r.stageOrder.every((t) => typeof t === 'string' && known.has(t))) return null;
  if (!r.contents || typeof r.contents !== 'object') return null;
  const incoming = r.contents as Record<string, unknown>;
  const merged = clone(DEMO_CONFIG.contents) as unknown as Record<string, unknown>;
  for (const t of STAGE_ORDER_ALL) {
    if (incoming[t] && typeof incoming[t] === 'object') merged[t] = incoming[t];
  }
  const stageOrder = r.stageOrder as StageType[];
  return {
    celebrantName: r.celebrantName,
    showAnswers: typeof r.showAnswers === 'boolean' ? r.showAnswers : true,
    stageOrder,
    contents: merged as unknown as GameConfig['contents'],
    world: sanitizeWorld(r.world, r.celebrantName, stageOrder),
  };
}

export function loadConfig(): { config: GameConfig; source: 'hash' | 'local' | 'demo' } {
  try {
    const hash = window.location.hash;
    const m = hash.match(/#g=([A-Za-z0-9\-_]+)/);
    if (m) { const c = decodeConfig(m[1]); if (c) return { config: c, source: 'hash' }; }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const c = validate(JSON.parse(raw)); if (c) return { config: c, source: 'local' }; }
  } catch { /* ignore */ }
  return { config: clone(DEMO_CONFIG), source: 'demo' };
}

export function saveConfig(c: GameConfig): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** Deep clone with heavy fields removed (recorded audio) — use before building share links so URLs stay small. localStorage keeps the full config incl. audio. A missing audioDataUrl is always valid: validate() merges from DEMO_CONFIG and the field is optional. */
export function stripHeavy(c: GameConfig): GameConfig {
  const copy = clone(c);
  const insp = copy.contents['inspiration-message'] as { audioDataUrl?: string };
  delete insp.audioDataUrl;
  return copy;
}

export function exportJSON(c: GameConfig): string { return JSON.stringify(c, null, 2); }

export function parseImported(text: string): GameConfig | null {
  try { return validate(JSON.parse(text)); } catch { return null; }
}
