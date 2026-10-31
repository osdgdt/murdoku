// Clue types about rooms: which room, who shares it, who is alone in it.
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { isAdjacent } from "../../util/geometry.js";
import { posOfCharacter, resolveTargetPositions, zoneAt, zonesAreAdjacent, isRoomCorner, victimId, characterHasProperty } from "./helpers.js";

export const builders = {
  inRoom: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        return zoneAt(puzzle, a) === params.zoneId;
      };
  },

  notInRoom: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        return zoneAt(puzzle, a) !== params.zoneId;
      };
  },

  sameRoomAs: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        const b = posOfCharacter(pm, params.targetId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za !== null && za === zoneAt(puzzle, b);
      };
  },

  notSameRoomAs: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        const b = posOfCharacter(pm, params.targetId);
        if (!a || !b) return undefined;
        const za = zoneAt(puzzle, a);
        return za === null || za !== zoneAt(puzzle, b);
      };
  },

  onlyPersonNear: ({ clue, puzzle, ownerId, params }) => {
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
  },

  aloneWithVictim: ({ clue, puzzle, ownerId, params }) => {
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
  },

  zoneAdjacentTo: ({ clue, puzzle, ownerId, params }) => {
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
  },

  aloneWithPersonProperty: ({ clue, puzzle, ownerId, params }) => {
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
  },

  aloneInRoom: ({ clue, puzzle, ownerId, params }) => {
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
  },

  aloneWithPerson: ({ clue, puzzle, ownerId, params }) => {
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
  },

  onlyPersonInRoom: ({ clue, puzzle, ownerId, params }) => {
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
  },

  inRoomCorner: ({ clue, puzzle, ownerId, params }) => {
      return (pm) => {
        const a = posOfCharacter(pm, ownerId);
        if (!a) return undefined;
        const z = zoneAt(puzzle, a);
        if (z === null) return false; // not in any room at all
        return isRoomCorner(puzzle.grid, a, z);
      };
  },

  someoneInRoomWithProperty: ({ clue, puzzle, ownerId, params }) => {
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
  },
};
