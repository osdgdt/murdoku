// Puzzle-wide scene facts not owned by any character (clue.characterId === null).
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { isAdjacent } from "../../util/geometry.js";
import { posOfCharacter, resolveTargetPositions, zoneAt, zoneCellCount, characterHasProperty } from "./helpers.js";

export const builders = {
  noOneInRoom: ({ clue, puzzle, ownerId, params }) => {
      return (pm, isComplete) => {
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === params.zoneId) return false;
        }
        return isComplete ? true : undefined;
      };
  },

  noOneInRowOrCol: ({ clue, puzzle, ownerId, params }) => {
      return (pm, isComplete) => {
        const idx = params.index - 1;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (!pos) continue;
          if (params.axis === "row" ? pos.row === idx : pos.col === idx) return false;
        }
        return isComplete ? true : undefined;
      };
  },

  exactlyOneInRoom: ({ clue, puzzle, ownerId, params }) => {
      return (pm, isComplete) => {
        let count = 0;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && zoneAt(puzzle, pos) === params.zoneId) count++;
        }
        if (count > 1) return false;
        return isComplete ? count === 1 : undefined;
      };
  },

  noOneNear: ({ clue, puzzle, ownerId, params }) => {
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
  },

  exactlyOneNear: ({ clue, puzzle, ownerId, params }) => {
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
  },

  emptyRoomsCount: ({ clue, puzzle, ownerId, params }) => {
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
  },

  roomsWithStateCount: ({ clue, puzzle, ownerId, params }) => {
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
  },

  emptyRoomsSameSize: ({ clue, puzzle, ownerId, params }) => {
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
  },

  sameRoomSizeAs: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, params.targetAId);
        const b = posOfCharacter(pm, params.targetBId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        const zb = zoneAt(puzzle, b);
        if (za === null || zb === null) return false;
        return zoneCellCount(puzzle.grid, za) === zoneCellCount(puzzle.grid, zb);
      };
  },

  noOneWithProperty: ({ clue, puzzle, ownerId, params }) => {
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
  },

  sameRoomTogether: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, params.targetAId);
        const b = posOfCharacter(pm, params.targetBId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za !== null && za === zoneAt(puzzle, b);
      };
  },
};
