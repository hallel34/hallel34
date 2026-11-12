import type { RoomId } from '../types';

/**
 * The shared map of the v5 house: rooms and their interactable objects
 * (hotspots). Used by the Creator (dropdowns), the 3D house (anchors),
 * and the 2D fallback (room list) — hotspot ids MUST stay stable.
 */

export interface HotspotDef { id: string; label: string; emoji: string }
export interface RoomDef { id: RoomId; label: string; emoji: string; hotspots: HotspotDef[] }

export const ROOMS: RoomDef[] = [
  {
    id: 'entrance', label: 'מבואת הכניסה', emoji: '🚪',
    hotspots: [
      { id: 'front-door', label: 'דלת הכניסה', emoji: '🚪' },
      { id: 'key-bowl', label: 'קערת המפתחות', emoji: '🥣' },
      { id: 'coat-rack', label: 'מתלה המעילים', emoji: '🧥' },
      { id: 'shoe-cabinet', label: 'ארון הנעליים', emoji: '👟' },
    ],
  },
  {
    id: 'living', label: 'הסלון', emoji: '🛋️',
    hotspots: [
      { id: 'bookshelf', label: 'הספרייה הגדולה', emoji: '📚' },
      { id: 'sofa', label: 'הספה', emoji: '🛋️' },
      { id: 'tv', label: 'הטלוויזיה', emoji: '📺' },
      { id: 'coffee-table', label: 'שולחן הקפה', emoji: '☕' },
      { id: 'armchair', label: 'הכורסה', emoji: '🪑' },
      { id: 'plant', label: 'העציץ הגדול', emoji: '🪴' },
      { id: 'window', label: 'החלון', emoji: '🪟' },
    ],
  },
  {
    id: 'kitchen', label: 'המטבח ופינת האוכל', emoji: '🍳',
    hotspots: [
      { id: 'fridge', label: 'המקרר', emoji: '🧲' },
      { id: 'pantry', label: 'המזווה', emoji: '🥫' },
      { id: 'oven', label: 'התנור', emoji: '🔥' },
      { id: 'counter', label: 'משטח העבודה', emoji: '🔪' },
      { id: 'kitchen-cabinet', label: 'ארון המטבח', emoji: '🗄️' },
      { id: 'dining-table', label: 'שולחן האוכל', emoji: '🍽️' },
    ],
  },
  {
    id: 'hallway', label: 'המסדרון', emoji: '🖼️',
    hotspots: [
      { id: 'picture', label: 'תמונת המשפחה', emoji: '🖼️' },
      { id: 'mirror', label: 'מראת המסדרון', emoji: '🪞' },
      { id: 'hall-closet', label: 'ארון המסדרון', emoji: '🚪' },
      { id: 'hall-lamp', label: 'מנורת הקיר', emoji: '💡' },
    ],
  },
  {
    id: 'bedroom1', label: 'חדר הילדים', emoji: '🧸',
    hotspots: [
      { id: 'bed', label: 'המיטה', emoji: '🛏️' },
      { id: 'desk', label: 'שולחן הכתיבה', emoji: '✏️' },
      { id: 'wardrobe', label: 'ארון הבגדים', emoji: '👗' },
      { id: 'piano', label: 'הפסנתר', emoji: '🎹' },
      { id: 'toy-shelf', label: 'מדף הצעצועים', emoji: '🧸' },
    ],
  },
  {
    id: 'bedroom2', label: 'חדר ההורים', emoji: '🛌',
    hotspots: [
      { id: 'bed-double', label: 'המיטה הזוגית', emoji: '🛌' },
      { id: 'safe', label: 'הכספת', emoji: '🔐' },
      { id: 'dresser', label: 'שידת המגירות', emoji: '🗄️' },
      { id: 'nightstand', label: 'שידת הלילה', emoji: '🕯️' },
      { id: 'wardrobe-big', label: 'ארון הקיר', emoji: '👔' },
    ],
  },
  {
    id: 'bathroom', label: 'חדר האמבטיה', emoji: '🛁',
    hotspots: [
      { id: 'mirror-cabinet', label: 'ארון המראה', emoji: '🪞' },
      { id: 'tub', label: 'האמבטיה', emoji: '🛁' },
      { id: 'sink', label: 'הכיור', emoji: '🚰' },
      { id: 'washing-machine', label: 'מכונת הכביסה', emoji: '🧺' },
    ],
  },
];

export const ROOM_MAP: Record<RoomId, RoomDef> = Object.fromEntries(
  ROOMS.map((r) => [r.id, r]),
) as Record<RoomId, RoomDef>;

export function hotspotDef(room: RoomId, hotspot: string): HotspotDef {
  const defs = ROOM_MAP[room]?.hotspots ?? [];
  return defs.find((h) => h.id === hotspot) ?? defs[0] ?? { id: hotspot, label: hotspot, emoji: '✨' };
}

export function roomLabel(room: RoomId): string {
  return ROOM_MAP[room]?.label ?? room;
}

/** Items the במאי can hand out from stages / hide as pickups. */
export const PRESET_ITEMS: Record<string, { label: string; emoji: string }> = {
  'brass-key': { label: 'מפתח זהב', emoji: '🗝️' },
  'silver-key': { label: 'מפתח כסף', emoji: '🔑' },
  'code-note': { label: 'פתק עם קוד', emoji: '📝' },
  'old-photo': { label: 'תמונה ישנה', emoji: '📷' },
  'battery': { label: 'סוללה', emoji: '🔋' },
  'magnet-letter': { label: 'אות מגנט', emoji: '🧲' },
  'ribbon': { label: 'סרט אדום', emoji: '🎀' },
  'music-note': { label: 'דף תווים', emoji: '🎼' },
};
