import { posOfCharacter } from "./helpers.js";
import { zoneObjectAt, isSeaZone, isShipZone } from "../../model/terrain.js";

// «In mare» (a ship or the Water) and «su una nave»: read from the room of the person on the fixed map, so they answer as
// soon as the owner is placed and never depend on anybody else. A cell outside every room is land.
export const builders = {
  inSea: ({ puzzle, ownerId }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      return isSeaZone(zoneObjectAt(puzzle, a));
    };
  },
  onShip: ({ puzzle, ownerId }) => {
    return (pm) => {
      const a = posOfCharacter(pm, ownerId);
      if (!a) return undefined;
      return isShipZone(zoneObjectAt(puzzle, a));
    };
  },
};
