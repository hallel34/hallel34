// Pure layout helpers (no DOM) so they can be unit tested.

/** Ring position [col,row] (1-based) for square i on the 7x7 grid: top row, down the far side, bottom row, back up. */
export function ringPos(i) {
  if (i <= 6) return [i + 1, 1];
  if (i <= 12) return [7, i - 5];
  if (i <= 18) return [6 - (i - 13), 7];
  return [1, 7 - (i - 18)];
}

/** Profession avatar chip: always the fox orange (the initial tells professions apart; orange carries no money meaning). */
export const avatarColor = () => 'var(--fox)';

/**
 * Pixel offsets [{x, y}] for `count` pawns that share one tile (index = order on the tile), so every pawn stays visible.
 * 1 pawn is centred; 2 sit side by side; 3 form a triangle; 4 a 2x2 block. Symmetric, so it needs no RTL mirroring.
 */
export function pawnOffsets(count) {
  const spread = {
    1: [[0, 0]],
    2: [[-13, 2], [13, 2]],
    3: [[-13, 6], [13, 6], [0, -9]],
    4: [[-13, 7], [13, 7], [-13, -8], [13, -8]],
  };
  return (spread[Math.min(4, Math.max(1, count))]).map(([x, y]) => ({ x, y }));
}

/** Compact player progress (0-1, capped) used by the others strip. */
export const progressPct = (passive, expenses) => (expenses > 0 ? Math.max(0, Math.min(1, passive / expenses)) : 0);
