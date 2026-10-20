// Pure layout helpers (no DOM) so they can be unit tested.

/** Ring position [col,row] (1-based) for square i on the 7x7 grid: top row, down the far side, bottom row, back up. */
export function ringPos(i) {
  if (i <= 6) return [i + 1, 1];
  if (i <= 12) return [7, i - 5];
  if (i <= 18) return [6 - (i - 13), 7];
  return [1, 7 - (i - 18)];
}

const AVATAR_COLORS = ['#FF8A5C', '#6BE3A8', '#3D9BFF', '#FF8FC4', '#9B6BFF', '#FFC83D', '#FF5A4E', '#6BF0B8'];
export const avatarColor = (id, list = []) => AVATAR_COLORS[Math.max(0, list.indexOf(id)) % AVATAR_COLORS.length];
