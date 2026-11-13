import { t } from "../i18n/i18n.js";
export function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// Orthogonal neighbours. A position flagged `edge: true` (a door/window, which
// sits on a side of its cell instead of filling it — see predicates.js'
// object positions) also counts as adjacent to someone standing IN that very
// cell: if you're on the door's cell you're next to the door.
export function isAdjacent(a, b) {
  const d = manhattan(a, b);
  return d === 1 || (d === 0 && (a.edge === true || b.edge === true));
}

export function isDiagonal(a, b) {
  return Math.abs(a.row - b.row) === 1 && Math.abs(a.col - b.col) === 1;
}

export function isSameRowOrCol(a, b) {
  return a.row === b.row || a.col === b.col;
}

// "direction" reads as: pos is <direction> of target.
// south/down = greater row, north/up = smaller row, east/right = greater col, west/left = smaller col.
export function isDirection(direction, pos, target) {
  switch (direction) {
    case "north":
      return pos.row < target.row;
    case "south":
      return pos.row > target.row;
    case "east":
      return pos.col > target.col;
    case "west":
      return pos.col < target.col;
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
}

// Like isDirection, but requires an exact distance along that axis (rows for
// north/south, columns for east/west) instead of just "some" distance.
export function isDirectionDistance(direction, distance, pos, target) {
  switch (direction) {
    case "north":
      return target.row - pos.row === distance;
    case "south":
      return pos.row - target.row === distance;
    case "east":
      return pos.col - target.col === distance;
    case "west":
      return target.col - pos.col === distance;
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
}

export const DIRECTIONS = ["north", "south", "east", "west"];
export const DIRECTION_LABELS = {
  north: t("a nord di"),
  south: t("a sud di"),
  east: t("a est di"),
  west: t("a ovest di"),
};
