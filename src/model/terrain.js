import { t } from "../i18n/i18n.js";
import { isNobleZone } from "./roles.js";
import { zoneDisplayName } from "./placeNames.js";

// Sea and land (Pirates). The rule of the book: every ship is an area of its own; "at sea" is a ship OR the Water;
// "on land" is any other place. The Water is always ONE area, even when ships cut it in pieces. So a room only needs to
// say what it is: `zone.terrain` is "water" (the Water), "ship" (a ship), or absent (land, the default). Both
// «in mare» and «a terra» are the same clue, one the opposite of the other.
export const TERRAINS = ["water", "ship"];
export const TERRAIN_LABELS = { land: t("Terra"), water: t("Acqua (mare)"), ship: t("Nave (mare)") };

export const isWaterZone = (zone) => zone?.terrain === "water";
export const isShipZone = (zone) => zone?.terrain === "ship";
export const isSeaZone = (zone) => isWaterZone(zone) || isShipZone(zone);

export function terrainOf(zone) {
  return TERRAINS.includes(zone?.terrain) ? zone.terrain : "land";
}

// "land" (or nothing) takes the field away, so that a case without ships and water stays exactly as it was.
export function setZoneTerrain(grid, zoneId, terrain) {
  const zone = grid.zones.find((z) => z.id === zoneId);
  if (!zone) return false;
  if (TERRAINS.includes(terrain)) zone.terrain = terrain;
  else delete zone.terrain;
  return true;
}

export const hasTerrain = (grid) => grid.zones.some((z) => TERRAINS.includes(z.terrain));

// The zone a position is in (or null), read from the fixed map.
export function zoneObjectAt(puzzle, pos) {
  if (!pos) return null;
  const zoneId = puzzle.grid.cells[pos.row]?.[pos.col]?.zoneId;
  return zoneId ? (puzzle.grid.zones.find((z) => z.id === zoneId) ?? null) : null;
}

// The marks written before a room's name on the board: ♛ a noble area, ≈ the Water, ⚓ a ship.
export function zoneTitle(zone) {
  const marks = `${isNobleZone(zone) ? "♛ " : ""}${isWaterZone(zone) ? "≈ " : ""}${isShipZone(zone) ? "⚓ " : ""}`;
  return `${marks}${zoneDisplayName(zone)}`;
}

export function terrainProblems(puzzle) {
  const errors = [];
  const zones = puzzle.grid?.zones || [];
  for (const zone of zones)
    if (zone.terrain !== undefined && !TERRAINS.includes(zone.terrain)) errors.push(t("Il terreno di una stanza non è valido."));
  if (zones.filter(isWaterZone).length > 1)
    errors.push(t("L'acqua è un'area unica: può esserci una sola stanza «Acqua», anche se le navi la interrompono."));
  return errors;
}
