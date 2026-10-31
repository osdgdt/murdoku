import { isAdjacent } from "../../util/geometry.js";
import { cellAt } from "../../model/grid.js";
import { isObjectTypeTarget, parseObjectTypeTarget, isObjectTypeOccupiable } from "../../model/icons.js";
import { buildPredicate } from "./index.js";

// A predicate is (placementMap, puzzle) -> true | false | undefined.
// undefined means "not enough information yet to decide" (used by the solver
// for partial-assignment pruning); solver treats undefined as "not violated yet".

export function posOfCharacter(placementMap, characterId) {
  return placementMap.get(characterId) || null;
}

export function posOfObject(puzzle, objectId) {
  const obj = puzzle.grid.objects.find((o) => o.id === objectId);
  return obj ? { row: obj.row, col: obj.col } : null;
}

export function resolveTargetPos(placementMap, puzzle, targetId) {
  const charPos = posOfCharacter(placementMap, targetId);
  if (charPos) return charPos;
  return posOfObject(puzzle, targetId);
}

export function positionsInZone(puzzle, zoneId) {
  const positions = [];
  for (let r = 0; r < puzzle.grid.size.rows; r++) {
    for (let c = 0; c < puzzle.grid.size.cols; c++) {
      const cell = puzzle.grid.cells[r][c];
      if (!cell.blocked && cell.zoneId === zoneId) positions.push({ row: r, col: c });
    }
  }
  return positions;
}

// Resolves a target-id param to a list of candidate positions, so clue types
// can treat "a specific character/object", "any object of a given type"
// (e.g. "a door"), and "a whole room" (every one of its cells) uniformly via
// an existential check over the list — this is also how "adjacent to a room"
// (and everything else built on this: facing, directionDistance, closerTo,
// rowOrColWith...) works without any extra code: true as soon as any one of
// the room's cells satisfies the geometric check.
// Returns null when the target is a character not yet placed (undetermined,
// distinct from a determined-but-empty list, which is a hard "no such object").
export function resolveTargetPositions(placementMap, puzzle, targetId) {
  if (isObjectTypeTarget(targetId)) {
    const typeId = parseObjectTypeTarget(targetId);
    return puzzle.grid.objects.filter((o) => o.typeId === typeId).map((o) => ({ row: o.row, col: o.col }));
  }
  if (puzzle.grid.zones.some((z) => z.id === targetId)) {
    return positionsInZone(puzzle, targetId);
  }
  const pos = resolveTargetPos(placementMap, puzzle, targetId);
  return pos ? [pos] : null;
}

export function zoneAt(puzzle, pos) {
  if (!pos) return null;
  const cell = cellAt(puzzle.grid, pos.row, pos.col);
  return cell ? cell.zoneId : null;
}

export function zoneCellCount(grid, zoneId) {
  let count = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (!cell.blocked && cell.zoneId === zoneId) count++;
    }
  }
  return count;
}

// Two zones are "adjacent" if some cell of one sits right next to some cell
// of the other (shares an edge) — the same relationship boardRender.js draws
// a wall for. A fresh grid scan each call is cheap at this app's grid sizes
// (≤9×9), so no need to cache it.
export function zonesAreAdjacent(grid, zoneIdA, zoneIdB) {
  if (!zoneIdA || !zoneIdB || zoneIdA === zoneIdB) return false;
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      const cell = grid.cells[r][c];
      if (cell.blocked || cell.zoneId !== zoneIdA) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= grid.size.rows || nc < 0 || nc >= grid.size.cols) continue;
        const neighbor = grid.cells[nr][nc];
        if (!neighbor.blocked && neighbor.zoneId === zoneIdB) return true;
      }
    }
  }
  return false;
}

// A cell is a "corner" of its room if the room's boundary turns a right
// angle there — i.e. for at least one of the 4 orthogonal-pair orientations
// (north+west, north+east, south+west, south+east), NEITHER of those two
// neighbors belongs to the same zone. This generalizes past simple
// rectangles to any room shape (irregular, via blocked cells) without
// flagging plain edge/wall cells: a rectangular room's 4 true corners each
// satisfy exactly one orientation, while edge-middle and interior cells
// satisfy none (both neighbors on every orientation stay inside the room).
export function isRoomCorner(grid, pos, zoneId) {
  const inZone = (r, c) => {
    if (r < 0 || r >= grid.size.rows || c < 0 || c >= grid.size.cols) return false;
    const cell = grid.cells[r][c];
    return !cell.blocked && cell.zoneId === zoneId;
  };
  const north = inZone(pos.row - 1, pos.col);
  const south = inZone(pos.row + 1, pos.col);
  const west = inZone(pos.row, pos.col - 1);
  const east = inZone(pos.row, pos.col + 1);
  return (!north && !west) || (!north && !east) || (!south && !west) || (!south && !east);
}

// Strict betweenness: owner shares owner's row with both a and b and its
// column lies strictly inside [min(a.col,b.col), max(a.col,b.col)], or the
// same on the column axis. Used only by the "between" clue type.
export function isStrictlyBetween(owner, a, b) {
  if (a.row === b.row && owner.row === a.row) {
    const lo = Math.min(a.col, b.col), hi = Math.max(a.col, b.col);
    return owner.col > lo && owner.col < hi;
  }
  if (a.col === b.col && owner.col === a.col) {
    const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row);
    return owner.row > lo && owner.row < hi;
  }
  return false;
}

export function victimId(puzzle) {
  return puzzle.characters.find((c) => c.isVictim)?.id || null;
}

// Checks one of the shared PERSON_PROPERTIES (clueTypes.js) for a single
// character — reused by "someone in the room was...", "the northernmost
// person who was...", "someone N rows north of them who was...", etc.,
// instead of duplicating the adjacency/gender/posture logic in each. Takes
// the whole params bag (property/targetId/objectTypeId/customClue) rather
// than separate arguments so a caller can just forward its own clue.params.
// `custom` nests an arbitrary other clue, built and evaluated against
// `characterId` via buildPredicate() — the same "any clue can be a
// sub-condition" trick orClue uses, applied here to filter WHO counts
// instead of combining two facts about the same person. Returns undefined
// only when the character itself isn't placed yet, or the nested/adjacentTo
// condition can't be resolved yet either.
export function characterHasProperty(puzzle, pm, characterId, params, isComplete) {
  const pos = posOfCharacter(pm, characterId);
  if (!pos) return undefined;
  switch (params.property) {
    case "male":
    case "female":
      return puzzle.characters.find((c) => c.id === characterId)?.gender === params.property;
    case "sittingOn": {
      const cell = cellAt(puzzle.grid, pos.row, pos.col);
      const obj = cell?.objectId ? puzzle.grid.objects.find((o) => o.id === cell.objectId) : null;
      return !!obj && obj.typeId === params.objectTypeId;
    }
    case "seated": {
      // Any occupiable object type (chair, stool, a rug...), not just one
      // specific type — see isObjectTypeOccupiable in icons.js, the same
      // flag that already governs which furniture a character can stand on.
      const cell = cellAt(puzzle.grid, pos.row, pos.col);
      const obj = cell?.objectId ? puzzle.grid.objects.find((o) => o.id === cell.objectId) : null;
      return !!obj && isObjectTypeOccupiable(obj.typeId);
    }
    case "adjacentTo": {
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some((t) => isAdjacent(pos, t));
    }
    case "custom": {
      if (!params.customClue?.type) return true; // no condition configured yet
      const sub = {
        characterId,
        type: params.customClue.type,
        params: params.customClue.params || {},
        negate: params.customClue.negate,
      };
      return buildPredicate(sub, puzzle)(pm, isComplete);
    }
    default:
      return true; // no property filter ("chiunque")
  }
}

// True if `a` is strictly more extreme than `b` in the given compass direction.
export function isMoreExtreme(direction, a, b) {
  switch (direction) {
    case "north": return a.row < b.row;
    case "south": return a.row > b.row;
    case "east": return a.col > b.col;
    case "west": return a.col < b.col;
    default: return false;
  }
}
