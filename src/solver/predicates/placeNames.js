import { posOfCharacter } from "./helpers.js";
import { zoneObjectAt } from "../../model/terrain.js";
import { placeNameOf } from "../../model/placeNames.js";

// «È nel luogo chiamato X»: the name of a room is not part of a position, it travels in `puzzle.nameOf` (a runtime-only
// Map<zoneId, name>, see model/placeNames.js and solver/names.js). The search keeps placing {row, col} as always. While
// the name of the room the owner stands in is not known (the board of a player, the human solver) the answer is
// `undefined`: never a guess. A cell outside every room is not in any place.
export const builders = {
  inPlaceNamed: ({ puzzle, ownerId, params }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      const zone = zoneObjectAt(puzzle, a);
      if (!zone) return false;
      const name = placeNameOf(puzzle, zone);
      return name === undefined ? undefined : name === params.placeName;
    };
  },
};
