// Puzzle-wide scene facts not owned by any character (clue.characterId === null).
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { isObjectTypeTarget, objectTypeIdsOf, isEdgeObjectType } from "../../model/icons.js";
import { localRow } from "../../model/sectors.js";
import {
  isNextTo,
  objectPositions,
  posOfCharacter,
  resolveTargetPositions,
  zoneAt,
  zoneCellCount,
  characterHasProperty,
  personHasProperty,
} from "./helpers.js";

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
        if (params.axis === "row" ? localRow(puzzle.grid, pos.row) === idx : pos.col === idx) return false;
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

  peopleNear: ({ clue, puzzle, ownerId, params }) => {
    const wanted = params.count;
    const same = params.together === "same" && wanted > 1;
    // with "the same one": the cells of each object of the type are a target of their own (otherwise all of them make one)
    const groupsOf = (pm) => {
      if (isObjectTypeTarget(params.targetId)) {
        const typeIds = objectTypeIdsOf(params.targetId);
        return puzzle.grid.objects.filter((o) => typeIds.includes(o.typeId)).map((o) => objectPositions(puzzle, o));
      }
      const positions = resolveTargetPositions(pm, puzzle, params.targetId);
      return positions === null ? null : [positions];
    };
    return (pm, isComplete) => {
      if (!same) {
        const targets = resolveTargetPositions(pm, puzzle, params.targetId);
        if (targets === null) return undefined;
        if (targets.length === 0) return false; // existential, like exactlyOneNear
        let count = 0;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && targets.some((t) => isNextTo(puzzle, pos, t))) count++;
        }
        if (count > wanted) return false;
        return isComplete ? count === wanted : undefined;
      }
      const groups = groupsOf(pm);
      if (groups === null) return undefined;
      if (groups.length === 0) return false;
      // people around each target: one of them must end up with exactly `wanted`
      let allOver = true;
      let someExact = false;
      for (const group of groups) {
        let count = 0;
        for (const c of puzzle.characters) {
          const pos = posOfCharacter(pm, c.id);
          if (pos && group.some((t) => isNextTo(puzzle, pos, t))) count++;
        }
        if (count <= wanted) allOver = false; // the counts only grow while people are placed
        if (count === wanted) someExact = true;
      }
      if (allOver) return false;
      return isComplete ? someExact : undefined;
    };
  },

  everyObjectTypeNear: ({ clue, puzzle, ownerId, params }) => {
    // doors/windows are wall pieces, not things to stand next to: only furniture, props and animals count
    const typeIds = [...new Set(puzzle.grid.objects.filter((o) => !isEdgeObjectType(o.typeId)).map((o) => o.typeId))];
    return (pm, isComplete) => {
      if (!isComplete) return undefined; // people only add "next to"s, so nothing can be ruled out early
      if (typeIds.length === 0) return false;
      const positions = puzzle.characters.map((c) => posOfCharacter(pm, c.id)).filter(Boolean);
      return typeIds.every((typeId) =>
        puzzle.grid.objects
          .filter((o) => o.typeId === typeId)
          .some((o) => objectPositions(puzzle, o).some((target) => positions.some((pos) => isNextTo(puzzle, pos, target))))
      );
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
    const { rows, cols } = puzzle.grid.size;
    // computed once, not on every call: this predicate runs hundreds of thousands of times in a hard search
    const sizes = zones.map((z) => zoneCellCount(puzzle.grid, z.id));
    const distinctSizes = [...new Set(sizes)];
    const sizeIndex = sizes.map((size) => distinctSizes.indexOf(size));
    const cellZone = new Int16Array(rows * cols).fill(-1); // cell -> index in `zones`, -1 outside any room
    zones.forEach((z, i) => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (puzzle.grid.cells[r][c].zoneId === z.id) cellZone[r * cols + c] = i;
    });
    const occupied = new Uint8Array(zones.length); // scratch space, reset on every call
    const freeBySize = new Int32Array(distinctSizes.length);
    const total = puzzle.characters.length;
    return (pm, isComplete) => {
      occupied.fill(0);
      let occupiedCount = 0;
      let placed = 0;
      for (const c of puzzle.characters) {
        const pos = posOfCharacter(pm, c.id);
        if (!pos) continue;
        placed++;
        if (pos.row < 0 || pos.row >= rows || pos.col < 0 || pos.col >= cols) continue;
        const z = cellZone[pos.row * cols + pos.col];
        if (z >= 0 && !occupied[z]) {
          occupied[z] = 1;
          occupiedCount++;
        }
      }
      // Same early-prune shape as roomsWithStateCount: confirmed-occupied
      // zones only ever grow, so a bound that's already too tight to reach
      // `count` empty zones stays too tight regardless of what follows.
      const guaranteedEmpty = zones.length - occupiedCount;
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
            if (!occupied[i] && ++freeBySize[sizeIndex[i]] >= params.count) enough = true;
          }
          if (!enough) return false;
        }
        return undefined;
      }
      let emptyCount = 0;
      let firstSize = -1;
      for (let i = 0; i < zones.length; i++) {
        if (occupied[i]) continue;
        emptyCount++;
        if (firstSize === -1) firstSize = sizeIndex[i];
        else if (sizeIndex[i] !== firstSize) return false; // the empty rooms differ in size
      }
      return emptyCount === params.count;
    };
  },

  sameRoomSizeAs: ({ clue, puzzle, ownerId, params }) => {
    const sizeOf = new Map(puzzle.grid.zones.map((z) => [z.id, zoneCellCount(puzzle.grid, z.id)])); // once, not per call
    return (pm) => {
      const a = posOfCharacter(pm, params.targetAId);
      const b = posOfCharacter(pm, params.targetBId);
      if (!a || !b) return undefined;
      const za = zoneAt(puzzle, a);
      const zb = zoneAt(puzzle, b);
      if (za === null || zb === null) return false;
      return sizeOf.get(za) === sizeOf.get(zb);
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

  // «Esattamente N persone hanno questa proprietà» (sedute su una sedia, uomini, accanto a una finestra…), in tutta la mappa.
  exactlyNWithProperty: ({ clue, puzzle, ownerId, params }) => {
    const wanted = Number.isFinite(params.count) ? params.count : 1;
    return (pm, isComplete) => {
      let yes = 0;
      let undetermined = 0;
      for (const c of puzzle.characters) {
        const has = personHasProperty(puzzle, pm, c, params, isComplete);
        if (has === true) yes++;
        else if (has === undefined) undetermined++;
      }
      if (yes > wanted || yes + undetermined < wanted) return false; // too many already, or not enough left to reach N
      return undetermined === 0 ? yes === wanted : undefined;
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
