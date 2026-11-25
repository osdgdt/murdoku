// Clue types about the floors of a skyscraper (model/clues/floors.js). Floor 0 is the highest.
import { floorOf } from "../../model/sectors.js";
import { posOfCharacter } from "./helpers.js";

export const builders = {
  sameFloor: ({ puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      const b = posOfCharacter(pm, params.targetId);
      if (!a || !b) return undefined;
      const floor = floorOf(puzzle.grid, a.row);
      return floor >= 0 && floor === floorOf(puzzle.grid, b.row);
    };
  },

  floorOrder: ({ puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      const b = posOfCharacter(pm, params.targetId);
      if (!a || !b) return undefined;
      const mine = floorOf(puzzle.grid, a.row);
      const theirs = floorOf(puzzle.grid, b.row);
      if (mine < 0 || theirs < 0) return false;
      switch (params.relation) {
        case "higher":
          return mine < theirs;
        case "lower":
          return mine > theirs;
        case "justAbove":
          return mine === theirs - 1;
        case "justBelow":
          return mine === theirs + 1;
        default:
          return false;
      }
    };
  },

  onFloor: ({ puzzle, ownerId, params }) => {
    const index = puzzle.grid.sectors ? puzzle.grid.sectors.findIndex((s) => s.id === params.floorId) : -1;
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      return index >= 0 && floorOf(puzzle.grid, a.row) === index;
    };
  },
};
