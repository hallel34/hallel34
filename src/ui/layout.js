// Pure layout helpers (no DOM) so they can be unit tested.

/**
 * Ring position [col,row] (1-based) for square i on the 6x8 ring (board-spec 14.1, owner override 2026-10-24b): the top row
 * from the inline-start corner, down the far column, back along the bottom row, up the near column. Corners: 0, 5, 12, 17.
 * col 1 = inline-start, so RTL / LTR mirror through the grid itself.
 */
export const RING_COLS = 6;
export const RING_ROWS = 8;
export function ringPos(i) {
  if (i <= 5) return [i + 1, 1];      // 0..5   top row
  if (i <= 12) return [6, i - 4];     // 6..12  far column (rows 2..8)
  if (i <= 17) return [18 - i, 8];    // 13..17 bottom row (cols 5..1)
  return [1, 25 - i];                 // 18..23 near column (rows 7..2)
}

/** Profession avatar chip: always the fox orange (the initial tells professions apart; orange carries no money meaning). */
export const avatarColor = () => 'var(--fox)';

/** From this many pawns on one tile the pawns shrink to numbered colour discs (a pawn figure is unreadable at that size). */
export const CROWD_FROM = 3;

/**
 * Pixel offsets [{x, y}] for `count` pawns that share one tile (index = order on the tile), so every pawn stays visible.
 * 1 pawn is centred; 2 sit side by side; 3 and 4 become small numbered discs, positioned from the tile centre
 * (3: triangle, 4: a 2x2 grid that fits inside the tile). Symmetric, so it needs no RTL mirroring.
 */
export function pawnOffsets(count) {
  const spread = {
    1: [[0, 0]],
    2: [[-13, 2], [13, 2]],
    3: [[-8, 7], [8, 7], [0, -8]],
    4: [[-8, -8], [8, -8], [-8, 8], [8, 8]],
  };
  return (spread[Math.min(4, Math.max(1, count))]).map(([x, y]) => ({ x, y }));
}

/** Compact player progress (0-1, capped) used by the others strip. */
export const progressPct = (passive, expenses) => (expenses > 0 ? Math.max(0, Math.min(1, passive / expenses)) : 0);
