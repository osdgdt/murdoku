export function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function isAdjacent(a, b) {
  return manhattan(a, b) === 1;
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
    case "north": return target.row - pos.row === distance;
    case "south": return pos.row - target.row === distance;
    case "east": return pos.col - target.col === distance;
    case "west": return target.col - pos.col === distance;
    default: throw new Error(`Unknown direction: ${direction}`);
  }
}

export const DIRECTIONS = ["north", "south", "east", "west"];
export const DIRECTION_LABELS = {
  north: "a nord di",
  south: "a sud di",
  east: "a est di",
  west: "a ovest di",
};
