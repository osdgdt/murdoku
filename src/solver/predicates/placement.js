// Clue types about WHERE a character stands relative to cells, objects, rows/columns and other characters.
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { isAdjacent, isDiagonal, isDirection, isDirectionDistance, isSameRowOrCol, manhattan } from "../../util/geometry.js";
import { posOfCharacter, resolveTargetPositions, zoneAt, isStrictlyBetween, characterHasProperty, isMoreExtreme } from "./helpers.js";

export const builders = {
  adjacent: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isAdjacent(a, t));
      };
  },

  notAdjacent: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return true; // vacuous truth: nothing to be adjacent to
        return targets.every((t) => !isAdjacent(a, t));
      };
  },

  diagonal: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isDiagonal(a, t));
      };
  },

  eitherAdjacent: ({ clue, puzzle, ownerId, params }) => {
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
  },

  onObjectType: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => characterHasProperty(puzzle, pm, ownerId, { property: "sittingOn", objectTypeId: params.objectTypeId });
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
        for (const a of targetsA) {
          for (const b of targetsB) {
            if (isStrictlyBetween(owner, a, b)) return true;
          }
        }
        return false;
      };
  },

  direction: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isDirection(params.direction, a, t));
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
          if (params.axis === "col") return a.col === t.col;
          return isSameRowOrCol(a, t);
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
        return targets.some((t) =>
          params.axis === "row" ? Math.abs(a.row - t.row) === 1 : Math.abs(a.col - t.col) === 1
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
          if (targets === null) { anyUndetermined = true; continue; }
          const matches = targets.some((t) => (params.axis === "row" ? a.row === t.row : a.col === t.col));
          if (matches) return true;
        }
        return anyUndetermined ? undefined : false;
      };
  },

  inCorner: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const { rows, cols } = puzzle.grid.size;
        return (a.row === 0 || a.row === rows - 1) && (a.col === 0 || a.col === cols - 1);
      };
  },

  facing: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false;
        return targets.some((t) => isSameRowOrCol(a, t));
      };
  },

  directionDistance: ({ clue, puzzle, ownerId, params }) => {
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
  },

  closerTo: ({ clue, puzzle, ownerId, params }) => {
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
  },

  inRowOrCol: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const idx = params.index - 1;
        return params.axis === "row" ? a.row === idx : a.col === idx;
      };
  },

  rowOrColParity: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        // 1-indexed, matching the R1/C1... labels shown on the board.
        const value = (params.axis === "row" ? a.row : a.col) + 1;
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
  },
};
