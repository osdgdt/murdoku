import { isAdjacent, isDiagonal, isDirection, isDirectionDistance, isSameRowOrCol, manhattan } from "../util/geometry.js";
import { cellAt } from "../model/grid.js";
import { isObjectTypeTarget, parseObjectTypeTarget, isObjectTypeOccupiable } from "../model/icons.js";

// A predicate is (placementMap, puzzle) -> true | false | undefined.
// undefined means "not enough information yet to decide" (used by the solver
// for partial-assignment pruning); solver treats undefined as "not violated yet".

function posOfCharacter(placementMap, characterId) {
  return placementMap.get(characterId) || null;
}

function posOfObject(puzzle, objectId) {
  const obj = puzzle.grid.objects.find((o) => o.id === objectId);
  return obj ? { row: obj.row, col: obj.col } : null;
}

function resolveTargetPos(placementMap, puzzle, targetId) {
  const charPos = posOfCharacter(placementMap, targetId);
  if (charPos) return charPos;
  return posOfObject(puzzle, targetId);
}

function positionsInZone(puzzle, zoneId) {
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

function zoneAt(puzzle, pos) {
  if (!pos) return null;
  const cell = cellAt(puzzle.grid, pos.row, pos.col);
  return cell ? cell.zoneId : null;
}

function zoneCellCount(grid, zoneId) {
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
function zonesAreAdjacent(grid, zoneIdA, zoneIdB) {
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
function isRoomCorner(grid, pos, zoneId) {
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
function isStrictlyBetween(owner, a, b) {
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
function characterHasProperty(puzzle, pm, characterId, params, isComplete) {
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
function isMoreExtreme(direction, a, b) {
  switch (direction) {
    case "north": return a.row < b.row;
    case "south": return a.row > b.row;
    case "east": return a.col > b.col;
    case "west": return a.col < b.col;
    default: return false;
  }
}

function buildPositivePredicate(clue, puzzle) {
  const ownerId = clue.characterId;
  const params = clue.params || {};

  switch (clue.type) {
    case "adjacent":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isAdjacent(a, t));
      };

    case "notAdjacent":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return true; // vacuous truth: nothing to be adjacent to
        return targets.every((t) => !isAdjacent(a, t));
      };

    case "diagonal":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isDiagonal(a, t));
      };

    case "eitherAdjacent":
      // Sound three-way OR: if either side is already known-true, the clue is
      // satisfied regardless of the other (possibly still-undetermined) side.
      // Only report a definite violation once BOTH sides are resolved (each
      // either a real target list or a determined-empty/vacuous one) and
      // neither holds.
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targetsA = resolveTargetPositions(pm, puzzle, params.targetAId);
        const targetsB = resolveTargetPositions(pm, puzzle, params.targetBId);
        const nearA = targetsA !== null && targetsA.some((t) => isAdjacent(a, t));
        const nearB = targetsB !== null && targetsB.some((t) => isAdjacent(a, t));
        if (nearA || nearB) return true;
        if (targetsA === null || targetsB === null) return undefined;
        return false;
      };

    case "onObjectType":
      return (pm) => characterHasProperty(puzzle, pm, ownerId, { property: "sittingOn", objectTypeId: params.objectTypeId });

    case "seated":
      return (pm) => characterHasProperty(puzzle, pm, ownerId, { property: "seated" });

    case "orClue":
      // Sound three-way OR over two whole sub-clues (see clueTypes.js): true
      // as soon as either side is already known-true, undefined only while
      // BOTH sides are still undecided, false only once both are settled and
      // neither holds. Reuses buildPredicate() (not just the positive half)
      // so a sub-clause can itself be negated.
      return (pm, isComplete) => {
        const subA = { characterId: ownerId, type: params.a?.type, params: params.a?.params || {}, negate: params.a?.negate };
        const subB = { characterId: ownerId, type: params.b?.type, params: params.b?.params || {}, negate: params.b?.negate };
        const resA = buildPredicate(subA, puzzle)(pm, isComplete);
        const resB = buildPredicate(subB, puzzle)(pm, isComplete);
        if (resA === true || resB === true) return true;
        if (resA === undefined || resB === undefined) return undefined;
        return false;
      };

    case "between":
      return (pm) => {
        const owner = posOfCharacter(pm, ownerId);
        if (!owner) return undefined;
        const targetsA = resolveTargetPositions(pm, puzzle, params.targetAId);
        const targetsB = resolveTargetPositions(pm, puzzle, params.targetBId);
        if (targetsA === null || targetsB === null) return undefined;
        if (targetsA.length === 0 || targetsB.length === 0) return false;
        for (const a of targetsA) {
          for (const b of targetsB) {
            if (isStrictlyBetween(owner, a, b)) return true;
          }
        }
        return false;
      };

    case "direction":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isDirection(params.direction, a, t));
      };

    case "inRoom":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        return zoneAt(puzzle, a) === params.zoneId;
      };

    case "notInRoom":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        return zoneAt(puzzle, a) !== params.zoneId;
      };

    case "sameRoomAs":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        const b = posOfCharacter(pm, params.targetId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za !== null && za === zoneAt(puzzle, b);
      };

    case "notSameRoomAs":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        const b = posOfCharacter(pm, params.targetId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za === null || za !== zoneAt(puzzle, b);
      };

    case "onlyPersonNear":
      // Needs every character placed to be certain "no one else" holds.
      // With a generic type target (e.g. "a door"), it's enough for the owner
      // to be alone next to at least one instance of that type.
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        const nearTargets = targets.filter((t) => isAdjacent(a, t));
        if (nearTargets.length === 0) return false;
        if (!isComplete) return undefined;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && nearTargets.some((t) => isAdjacent(pos, t))) return false;
        }
        return true;
      };

    case "aloneWithVictim":
      return (pm, isComplete) => {
        const vId = victimId(puzzle);
        if (!vId || vId === ownerId) return undefined;
        const a = posOfCharacter(pm, ownerId);
        const v = posOfCharacter(pm, vId);
        if (!a || !v) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null || za !== zoneAt(puzzle, v)) return false;
        if (!isComplete) return undefined;
        for (const c of puzzle.characters) {
          if (c.id === ownerId || c.id === vId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === za) return false;
        }
        return true;
      };

    case "rowOrColWith":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => {
          if (params.axis === "row") return a.row === t.row;
          if (params.axis === "col") return a.col === t.col;
          return isSameRowOrCol(a, t);
        });
      };

    case "zoneAdjacentTo":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null) return false;
        // resolveTargetPositions already resolves a zone id to every cell in
        // that zone, so a direct room target falls out of the same generic
        // path as a character/object target resolved to its own room.
        const targets = resolveTargetPositions(pm, puzzle, params.zoneId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => zonesAreAdjacent(puzzle.grid, za, zoneAt(puzzle, t)));
      };

    case "rowOrColAdjacentTo":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) =>
          params.axis === "row" ? Math.abs(a.row - t.row) === 1 : Math.abs(a.col - t.col) === 1
        );
      };

    case "inRowOrColWithAny":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const ids = params.targetIds || [];
        if (ids.length === 0) return false;
        let anyUndetermined = false;
        for (const id of ids) {
          const targets = resolveTargetPositions(pm, puzzle, id);
          if (targets === null) { anyUndetermined = true; continue; }
          const matches = targets.some((t) => (params.axis === "row" ? a.row === t.row : a.col === t.col));
          if (matches) return true;
        }
        return anyUndetermined ? undefined : false;
      };

    case "aloneWithPersonProperty":
      // Same shape as aloneWithPerson, but instead of checking the lone
      // companion's identity against one chosen character, checks their
      // PERSON_PROPERTY (gender, posture...) once they're known.
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null) return false;
        const others = [];
        let anyUndetermined = false;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (!pos) { anyUndetermined = true; continue; }
          if (zoneAt(puzzle, pos) === za) others.push(c.id);
        }
        if (others.length > 1) return false; // already at least two others there
        if (!isComplete || anyUndetermined) return undefined;
        if (others.length !== 1) return false; // no one else there at all
        return characterHasProperty(puzzle, pm, others[0], params, isComplete) === true;
      };

    case "aloneInRoom":
      // With no zoneId, "alone" means in whatever room the owner turns out to
      // be in; with one set, it also requires that specific room (subsuming
      // the legacy, room-specific onlyPersonInRoom).
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null) return false; // not in any room at all
        if (params.zoneId && za !== params.zoneId) return false;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === za) return false;
        }
        return isComplete ? true : undefined;
      };

    case "aloneWithPerson":
      return (pm, isComplete) => {
        if (params.targetId === ownerId) return undefined;
        const a = posOfCharacter(pm, ownerId);
        const t = posOfCharacter(pm, params.targetId);
        if (!a || !t) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null || za !== zoneAt(puzzle, t)) return false;
        if (!isComplete) return undefined;
        for (const c of puzzle.characters) {
          if (c.id === ownerId || c.id === params.targetId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === za) return false;
        }
        return true;
      };

    case "onlyPersonInRoom":
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        if (zoneAt(puzzle, a) !== params.zoneId) return false;
        if (!isComplete) return undefined;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === params.zoneId) return false;
        }
        return true;
      };

    case "inCorner":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const { rows, cols } = puzzle.grid.size;
        return (a.row === 0 || a.row === rows - 1) && (a.col === 0 || a.col === cols - 1);
      };

    case "inRoomCorner":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const z = zoneAt(puzzle, a);
        if (z === null) return false; // not in any room at all
        return isRoomCorner(puzzle.grid, a, z);
      };

    case "facing":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isSameRowOrCol(a, t));
      };

    case "directionDistance":
      // No distance set means "any positive distance" — the legacy `direction`
      // check — instead of requiring an exact one.
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        if (!params.distance) return targets.some((t) => isDirection(params.direction, a, t));
        return targets.some((t) => isDirectionDistance(params.direction, params.distance, a, t));
      };

    case "someoneAtDirectionDistance":
      // Existential counterpart of directionDistance: instead of the owner
      // being at that direction/distance from a chosen target, some
      // unspecified other character — optionally filtered by the shared
      // PERSON_PROPERTY system, e.g. "...who was in a room adjacent to the
      // bathroom" — is [direction] of the owner. The owner plays the
      // "target" role and the candidate the "pos" role in isDirection's
      // "pos is <direction> of target" convention (the reverse of how
      // directionDistance itself calls it).
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        let anyUndetermined = false;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (!pos) { anyUndetermined = true; continue; }
          const positionMatches = params.distance
            ? isDirectionDistance(params.direction, params.distance, pos, a)
            : isDirection(params.direction, pos, a);
          if (!positionMatches) continue;
          if (!params.property) return true; // position alone is enough
          const has = characterHasProperty(puzzle, pm, c.id, params, isComplete);
          if (has === true) return true;
          if (has === undefined) anyUndetermined = true;
          // has === false: this candidate is in position but fails the
          // property filter — it doesn't count, but someone else still might.
        }
        if (anyUndetermined) return undefined;
        return isComplete ? false : undefined;
      };

    case "closerTo":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targetsA = resolveTargetPositions(pm, puzzle, params.targetAId);
        const targetsB = resolveTargetPositions(pm, puzzle, params.targetBId);
        if (targetsA === null || targetsB === null) return undefined;
        if (targetsA.length === 0 || targetsB.length === 0) return false;
        const distA = Math.min(...targetsA.map((t) => manhattan(a, t)));
        const distB = Math.min(...targetsB.map((t) => manhattan(a, t)));
        return distA < distB;
      };

    case "inRowOrCol":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const idx = params.index - 1;
        return params.axis === "row" ? a.row === idx : a.col === idx;
      };

    case "rowOrColParity":
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        // 1-indexed, matching the R1/C1... labels shown on the board.
        const value = (params.axis === "row" ? a.row : a.col) + 1;
        const isOdd = value % 2 === 1;
        return params.parity === "odd" ? isOdd : !isOdd;
      };

    case "someoneInRoomWithProperty":
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const za = zoneAt(puzzle, a);
        if (za === null) return false;
        let anyUndetermined = false;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (!pos) { anyUndetermined = true; continue; } // could still join this room
          if (zoneAt(puzzle, pos) !== za) continue;
          const has = characterHasProperty(puzzle, pm, c.id, params, isComplete);
          if (has === true) return true;
          if (has === undefined) anyUndetermined = true;
        }
        if (anyUndetermined) return undefined;
        return isComplete ? false : undefined;
      };

    case "extremeInDirection":
      return (pm, isComplete) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const ownProperty = characterHasProperty(puzzle, pm, ownerId, params, isComplete);
        if (ownProperty === undefined) return undefined;
        if (ownProperty === false) return false;
        const za = params.scope === "room" ? zoneAt(puzzle, a) : null;
        if (params.scope === "room" && za === null) return false;

        let anyUndetermined = false;
        for (const c of puzzle.characters) {
          if (c.id === ownerId) continue;
          const pos = posOfCharacter(pm, c.id);
          if (!pos) { anyUndetermined = true; continue; }
          if (params.scope === "room" && zoneAt(puzzle, pos) !== za) continue;
          const theirProperty = characterHasProperty(puzzle, pm, c.id, params, isComplete);
          if (theirProperty === undefined) { anyUndetermined = true; continue; }
          if (!theirProperty) continue;
          if (!isMoreExtreme(params.direction, a, pos)) return false; // someone qualifying ties or beats the owner
        }
        if (anyUndetermined) return undefined;
        return isComplete ? true : undefined;
      };

    // --- Generic clues: no owner, quantify over every character instead ---

    case "noOneInRoom":
      return (pm, isComplete) => {
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === params.zoneId) return false;
        }
        return isComplete ? true : undefined;
      };

    case "noOneInRowOrCol":
      return (pm, isComplete) => {
        const idx = params.index - 1;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (!pos) continue;
          if (params.axis === "row" ? pos.row === idx : pos.col === idx) return false;
        }
        return isComplete ? true : undefined;
      };

    case "exactlyOneInRoom":
      return (pm, isComplete) => {
        let count = 0;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === params.zoneId) count++;
        }
        if (count > 1) return false;
        return isComplete ? count === 1 : undefined;
      };

    case "noOneNear":
      return (pm, isComplete) => {
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return true; // vacuous truth: nothing to be near
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && targets.some((t) => isAdjacent(pos, t))) return false;
        }
        return isComplete ? true : undefined;
      };

    case "exactlyOneNear":
      return (pm, isComplete) => {
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false; // existential, not universal: "exactly one near nothing" can never hold
        let count = 0;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && targets.some((t) => isAdjacent(pos, t))) count++;
        }
        if (count > 1) return false;
        return isComplete ? count === 1 : undefined;
      };

    case "emptyRoomsCount":
      return (pm, isComplete) => {
        const totalZones = puzzle.grid.zones.length;
        const occupiedZones = new Set();
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (!pos) continue;
          const z = zoneAt(puzzle, pos);
          if (z !== null) occupiedZones.add(z);
        }
        // Zones already confirmed occupied only ever grow as more characters
        // are placed, so this bound can only tighten — a definite "false" here
        // stays false regardless of how the rest of the search plays out.
        const guaranteedEmpty = totalZones - occupiedZones.size;
        if (guaranteedEmpty < params.count) return false;
        return isComplete ? guaranteedEmpty === params.count : undefined;
      };

    case "roomsWithStateCount":
      return (pm, isComplete) => {
        const totalZones = puzzle.grid.zones.length;
        const occupiedZones = new Set();
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (!pos) continue;
          const z = zoneAt(puzzle, pos);
          if (z !== null) occupiedZones.add(z);
        }
        if (params.state === "empty") {
          const guaranteedEmpty = totalZones - occupiedZones.size;
          if (guaranteedEmpty < params.count) return false;
          return isComplete ? guaranteedEmpty === params.count : undefined;
        }
        // "occupied": occupiedZones.size only ever grows, so overshooting the
        // target now is definite — it can't come back down.
        if (occupiedZones.size > params.count) return false;
        return isComplete ? occupiedZones.size === params.count : undefined;
      };

    case "emptyRoomsSameSize":
      return (pm, isComplete) => {
        const zones = puzzle.grid.zones;
        const occupiedZones = new Set();
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (!pos) continue;
          const z = zoneAt(puzzle, pos);
          if (z !== null) occupiedZones.add(z);
        }
        // Same early-prune shape as roomsWithStateCount: confirmed-occupied
        // zones only ever grow, so a bound that's already too tight to reach
        // `count` empty zones stays too tight regardless of what follows.
        const guaranteedEmpty = zones.length - occupiedZones.size;
        if (guaranteedEmpty < params.count) return false;
        if (!isComplete) return undefined;
        const emptyZones = zones.filter((z) => !occupiedZones.has(z.id));
        if (emptyZones.length !== params.count) return false;
        const sizes = new Set(emptyZones.map((z) => zoneCellCount(puzzle.grid, z.id)));
        return sizes.size <= 1;
      };

    case "sameRoomSizeAs":
      return (pm) => {
        const a = posOfCharacter(pm, params.targetAId);
        const b = posOfCharacter(pm, params.targetBId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        const zb = zoneAt(puzzle, b);
        if (za === null || zb === null) return false;
        return zoneCellCount(puzzle.grid, za) === zoneCellCount(puzzle.grid, zb);
      };

    case "noOneWithProperty":
      return (pm, isComplete) => {
        let anyUndetermined = false;
        for (const c of puzzle.characters) {
          // Gender is fixed on the character record itself, known from the
          // start regardless of placement — filtering on it first (before
          // touching position) means an excluded character never marks the
          // result "undetermined" just for being unplaced.
          if (params.onlyGender && c.gender !== params.onlyGender) continue;
          const pos = posOfCharacter(pm, c.id);
          if (!pos) { anyUndetermined = true; continue; }
          if (params.zoneId && zoneAt(puzzle, pos) !== params.zoneId) continue;
          const has = characterHasProperty(puzzle, pm, c.id, params, isComplete);
          if (has === true) return false;
          if (has === undefined) anyUndetermined = true;
        }
        if (anyUndetermined) return undefined;
        return isComplete ? true : undefined;
      };

    case "sameRoomTogether":
      return (pm) => {
        const a = posOfCharacter(pm, params.targetAId);
        const b = posOfCharacter(pm, params.targetBId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za !== null && za === zoneAt(puzzle, b);
      };

    default:
      return () => undefined;
  }
}

// Wraps any clue type's predicate with its negation when clue.negate is set,
// instead of every "not X" needing its own registered type — sound because
// `undefined` (not yet decidable) stays `undefined` either way; only an
// already-settled true/false gets flipped.
export function buildPredicate(clue, puzzle) {
  const positive = buildPositivePredicate(clue, puzzle);
  if (!clue.negate) return positive;
  return (pm, isComplete) => {
    const result = positive(pm, isComplete);
    return result === undefined ? undefined : !result;
  };
}

// Base rule of Murdoku, always on — not a user-addable/removable clue (see
// CLUE_TYPES.victimRoomRule in clueTypes.js, kept `internal: true` purely so
// this has a describe() for validateSolution's violation messages): the
// victim must end up in a room together with EXACTLY one other character —
// that person is the murderer. Companions can only accumulate as more
// characters get placed, never un-accumulate, so ">1 already" is a sound
// prune at any point; "==1" only becomes final once nobody is left unplaced.
function victimRoomRulePredicate(puzzle) {
  return (pm, isComplete) => {
    const vId = victimId(puzzle);
    if (!vId) return undefined;
    const v = posOfCharacter(pm, vId);
    if (!v) return undefined;
    const zv = zoneAt(puzzle, v);
    if (zv === null) return false; // the victim must be inside an actual room
    let companions = 0;
    for (const c of puzzle.characters) {
      if (c.id === vId) continue;
      const pos = posOfCharacter(pm, c.id);
      if (pos && zoneAt(puzzle, pos) === zv) companions++;
    }
    if (companions > 1) return false;
    if (!isComplete) return undefined;
    return companions === 1;
  };
}

export function buildPredicates(puzzle) {
  const clueChecks = puzzle.clues.map((clue) => ({ clue, predicate: buildPredicate(clue, puzzle) }));
  const baseRuleClue = { id: null, type: "victimRoomRule", characterId: null, params: {}, negate: false };
  return [...clueChecks, { clue: baseRuleClue, predicate: victimRoomRulePredicate(puzzle) }];
}
