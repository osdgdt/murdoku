// Clue types about WHERE a character stands relative to cells, objects, rows/columns and other characters.
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { sealOf } from "../../model/grid.js";
import { sameFloor, floorBox, localRow } from "../../model/sectors.js";
import { isDiagonal, isDirection, isDirectionDistance, isSameRowOrCol, manhattan } from "../../util/geometry.js";
import {
  isNextTo,
  posOfCharacter,
  resolveTargetPositions,
  zoneAt,
  isStrictlyBetween,
  characterHasProperty,
  isMoreExtreme,
  objectPositions,
} from "./helpers.js";

export const builders = {
  adjacent: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some((t) => isNextTo(puzzle, a, t));
    };
  },

  diagonal: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some((t) => sameFloor(puzzle.grid, a, t) && isDiagonal(a, t));
    };
  },

  onObjectType: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => characterHasProperty(puzzle, pm, ownerId, { property: "sittingOn", objectTypeId: params.objectTypeId });
  },

  inFrontOfWindow: ({ clue, puzzle, ownerId, params }) => {
    // In one of the two cells a window lies between, or in its only cell when
    // the window is on the border of the map (see objectPositions).
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      return puzzle.grid.objects.some(
        (o) => o.typeId === "window" && objectPositions(puzzle, o).some((p) => p.row === a.row && p.col === a.col)
      );
    };
  },

  seated: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => characterHasProperty(puzzle, pm, ownerId, { property: "seated" });
  },

  between: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const owner = posOfCharacter(pm, ownerId);
      if (!owner) return undefined;
      const targetsA = resolveTargetPositions(pm, puzzle, params.targetAId);
      const targetsB = resolveTargetPositions(pm, puzzle, params.targetBId);
      if (targetsA === null || targetsB === null) return undefined;
      if (targetsA.length === 0 || targetsB.length === 0) return false;
      // A ROOM as a target is crossed, not entered: standing inside it never
      // counts as "between" it and something else.
      const ownerZone = zoneAt(puzzle, owner);
      const inside = (target) => target.room === true && ownerZone === target.zoneId;
      for (const a of targetsA) {
        if (inside(a)) continue;
        for (const b of targetsB) {
          if (inside(b)) continue;
          if (sameFloor(puzzle.grid, owner, a) && sameFloor(puzzle.grid, owner, b) && isStrictlyBetween(owner, a, b)) return true;
        }
      }
      return false;
    };
  },

  rowOrColWith: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some((t) => {
        if (params.axis === "row") return a.row === t.row;
        if (params.axis === "col") return a.col === t.col && sameFloor(puzzle.grid, a, t);
        return isSameRowOrCol(a, t) && sameFloor(puzzle.grid, a, t);
      });
    };
  },

  rowOrColAdjacentTo: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some(
        (t) => sameFloor(puzzle.grid, a, t) && (params.axis === "row" ? Math.abs(a.row - t.row) === 1 : Math.abs(a.col - t.col) === 1)
      );
    };
  },

  inRowOrColWithAny: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const ids = params.targetIds || [];
      if (ids.length === 0) return false;
      let anyUndetermined = false;
      for (const id of ids) {
        const targets = resolveTargetPositions(pm, puzzle, id);
        if (targets === null) {
          anyUndetermined = true;
          continue;
        }
        const matches = targets.some((t) => (params.axis === "row" ? a.row === t.row : a.col === t.col && sameFloor(puzzle.grid, a, t)));
        if (matches) return true;
      }
      return anyUndetermined ? undefined : false;
    };
  },

  inCorner: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const { top, bottom, right } = floorBox(puzzle.grid, a.row); // the corner of its own floor in a skyscraper
      return (a.row === top || a.row === bottom) && (a.col === 0 || a.col === right);
    };
  },

  onSeal: ({ puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const seal = sealOf(puzzle.grid, a.row, a.col);
      if (!seal) return false;
      return !params.sealKind || params.sealKind === "any" || params.sealKind === seal;
    };
  },

  facing: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      return targets.some((t) => isSameRowOrCol(a, t) && sameFloor(puzzle.grid, a, t));
    };
  },

  directionDistance: ({ clue, puzzle, ownerId, params }) => {
    // No distance set means "any positive distance" instead of requiring an
    // exact one.
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targets = resolveTargetPositions(pm, puzzle, params.targetId);
      if (targets === null) return undefined;
      if (targets.length === 0) return false;
      if (!params.distance) return targets.some((t) => sameFloor(puzzle.grid, a, t) && isDirection(params.direction, a, t));
      return targets.some((t) => sameFloor(puzzle.grid, a, t) && isDirectionDistance(params.direction, params.distance, a, t));
    };
  },

  someoneAtDirectionDistance: ({ clue, puzzle, ownerId, params }) => {
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
        if (!pos) {
          anyUndetermined = true;
          continue;
        }
        if (!sameFloor(puzzle.grid, a, pos)) continue; // north/south/east/west only count inside one floor
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
  },

  closerTo: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const targetsA = resolveTargetPositions(pm, puzzle, params.targetAId);
      const targetsB = resolveTargetPositions(pm, puzzle, params.targetBId);
      if (targetsA === null || targetsB === null) return undefined;
      if (targetsA.length === 0 || targetsB.length === 0) return false;
      let distA = Infinity;
      for (const t of targetsA) if (sameFloor(puzzle.grid, a, t)) distA = Math.min(distA, manhattan(a, t));
      let distB = Infinity;
      for (const t of targetsB) if (sameFloor(puzzle.grid, a, t)) distB = Math.min(distB, manhattan(a, t));
      return distA < distB;
    };
  },

  inRowOrCol: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const idx = params.index - 1;
      // the rows count from the top of each floor, as the columns do from the left
      return params.axis === "row" ? localRow(puzzle.grid, a.row) === idx : a.col === idx;
    };
  },

  rowOrColParity: ({ clue, puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      // 1-indexed, matching the R1/C1... labels shown on the board.
      const value = (params.axis === "row" ? localRow(puzzle.grid, a.row) : a.col) + 1;
      const isOdd = value % 2 === 1;
      return params.parity === "odd" ? isOdd : !isOdd;
    };
  },

  extremeInDirection: ({ clue, puzzle, ownerId, params }) => {
    return (pm, isComplete) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const ownProperty = characterHasProperty(puzzle, pm, ownerId, params, isComplete);
      if (ownProperty === undefined) return undefined;
      if (ownProperty === false) return false;
      const za = params.scope === "room" ? zoneAt(puzzle, a) : null;
      if (params.scope === "room" && za === null) return false;
      // on a skyscraper everybody is compared by the row of their own floor and the column: «of all» takes in every floor,
      // «of their floor» only the one they stand on
      const mine = { row: localRow(puzzle.grid, a.row), col: a.col };

      let anyUndetermined = false;
      for (const c of puzzle.characters) {
        if (c.id === ownerId) continue;
        const pos = posOfCharacter(pm, c.id);
        if (!pos) {
          anyUndetermined = true;
          continue;
        }
        if (params.scope === "room" && zoneAt(puzzle, pos) !== za) continue;
        if (params.scope === "floor" && !sameFloor(puzzle.grid, a, pos)) continue;
        const theirProperty = characterHasProperty(puzzle, pm, c.id, params, isComplete);
        if (theirProperty === undefined) {
          anyUndetermined = true;
          continue;
        }
        if (!theirProperty) continue;
        if (!isMoreExtreme(params.direction, mine, { row: localRow(puzzle.grid, pos.row), col: pos.col })) return false; // someone qualifying ties or beats the owner
      }
      if (anyUndetermined) return undefined;
      return isComplete ? true : undefined;
    };

    // --- Generic clues: no owner, quantify over every character instead ---
  },
};
