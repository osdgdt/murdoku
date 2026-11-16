// Puzzle-wide scene facts not owned by any character (clue.characterId === null).
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { isNextTo, posOfCharacter, resolveTargetPositions, zoneAt, zoneCellCount, characterHasProperty } from "./helpers.js";

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
        if (pos && targets.some((t) => isNextTo(puzzle, pos, t))) return false;
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
        if (pos && targets.some((t) => isNextTo(puzzle, pos, t))) count++;
      }
      if (count > 1) return false;
      return isComplete ? count === 1 : undefined;
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
    const zones = puzzle.grid.zones;
    // computed once, not on every call: this predicate runs thousands of times per search node
    const sizes = zones.map((z) => zoneCellCount(puzzle.grid, z.id));
    const distinctSizes = [...new Set(sizes)];
    const sizeIndex = sizes.map((size) => distinctSizes.indexOf(size));
    const freeBySize = new Int32Array(distinctSizes.length); // scratch space, reset on every call
    const total = puzzle.characters.length;
    return (pm, isComplete) => {
      const occupiedZones = new Set();
      let placed = 0;
      for (const c of puzzle.characters) {
        const pos = posOfCharacter(pm, c.id);
        if (!pos) continue;
        placed++;
        const z = zoneAt(puzzle, pos);
        if (z !== null) occupiedZones.add(z);
      }
      // Same early-prune shape as roomsWithStateCount: confirmed-occupied
      // zones only ever grow, so a bound that's already too tight to reach
      // `count` empty zones stays too tight regardless of what follows.
      const guaranteedEmpty = zones.length - occupiedZones.size;
      if (guaranteedEmpty < params.count) return false;
      // The clue says EXACTLY `count` rooms stay empty, so exactly `zones.length - count` rooms must end up occupied.
      // Every character still to place fills at most one more room: if the rooms still to fill outnumber them, no
      // completion can work. (Before this the check only fired once the placement was complete, so a case whose other
      // clues leave many solutions made the search visit hundreds of thousands of nodes.)
      if (guaranteedEmpty - params.count > total - placed) return false;
      if (!isComplete) {
        // The rooms that end up empty are among the ones still unoccupied and must all have the same size: some size
        // has to be shared by at least `count` of them (this is the check that prunes most).
        if (params.count > 1) {
          freeBySize.fill(0);
          let enough = false;
          for (let i = 0; i < zones.length && !enough; i++) {
            if (!occupiedZones.has(zones[i].id) && ++freeBySize[sizeIndex[i]] >= params.count) enough = true;
          }
          if (!enough) return false;
        }
        return undefined;
      }
      const emptyZones = zones.filter((z) => !occupiedZones.has(z.id));
      if (emptyZones.length !== params.count) return false;
      const emptySizes = new Set(emptyZones.map((z) => zoneCellCount(puzzle.grid, z.id)));
      return emptySizes.size <= 1;
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
        if (!pos) {
          anyUndetermined = true;
          continue;
        }
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
