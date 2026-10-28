// Cosmetic learning history, device-local; never used by money rules.
import { readJSON, writeJSON } from './storage.js';
import { SHORT_MISSIONS } from '../engine/short-missions.js';

const KEY = 'learn.missions';
export function completedShortMissions() {
  const value = readJSON(KEY, []);
  return Array.isArray(value) ? value.filter((id) => SHORT_MISSIONS.includes(id)) : [];
}
export function recordShortMission(id) {
  if (!SHORT_MISSIONS.includes(id)) return false;
  return writeJSON(KEY, [...new Set([...completedShortMissions(), id])]);
}
