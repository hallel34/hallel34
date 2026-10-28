// Slot-explicit persistence of a match. A daily challenge and a normal game live in separate slots and the
// slot is ALWAYS derived from the match passed in: save(match) / clear(match) throw when the match is missing,
// so a call that forgets its argument can never fall back to the normal slot.
import { isShortMission, practiceSlot } from '../engine/short-missions.js';
export const SLOT_NORMAL = 'save';
export const SLOT_DAILY = 'dailySave';
export const SLOT_MISSION = 'missionSave';

export const slotOf = (match) => {
  if (!match || typeof match !== 'object') throw new Error('match-store: a match is required to pick the save slot');
  if (match.daily) return SLOT_DAILY;
  if (isShortMission(match.mission?.id)) return practiceSlot(match.mission.id);
  return match.mission ? SLOT_MISSION : SLOT_NORMAL;
};

/** @param io { write(key, text), remove(key) }  @param serialize match -> string */
export function createMatchStore({ write, remove, serialize }) {
  return {
    save: (match) => write(slotOf(match), serialize(match)),
    clear: (match) => remove(slotOf(match)),
  };
}
