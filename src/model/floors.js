import { t } from "../i18n/i18n.js";
import { makeId } from "../util/id.js";
import { cellAt, isUsable, removeObject } from "./grid.js";
import { hasFloors, floorOf, localRow, sectorWidth } from "./sectors.js";

// The ways between the floors of a skyscraper (see sectors.js). Every end is a real object on its own cell, so a person can stand
// on it and the cell keeps its room, but the ends of one way share an id:
//   the lift     (`elevator`)  ONE shaft: an object on every floor, at the same row of its floor and the same column, `shaftId`
//   the stairs   (`stairs`)    TWO ends, on two floors one above the other, in any cell of each: `linkId`
// Whoever stands on an end is «next to» whoever stands on another end of the same way (the lift reaches every floor, the stairs
// the floor they lead to). Nothing else is next to something on another floor.
export const WAY_TYPES = ["elevator", "stairs"];

export const wayIdOf = (obj) => obj?.shaftId ?? obj?.linkId ?? null;
export const isWayType = (typeId) => WAY_TYPES.includes(typeId);

// The number each way is shown with on the board (1, 2…, the same on every end of it), in the order of the objects.
export function wayNumbers(grid) {
  const numbers = new Map();
  for (const obj of grid.objects) {
    const id = isWayType(obj?.typeId) ? wayIdOf(obj) : null;
    if (id && !numbers.has(id)) numbers.set(id, numbers.size + 1);
  }
  return numbers;
}

// Every other end of the way that this object belongs to.
export function otherEnds(grid, obj) {
  const id = wayIdOf(obj);
  return id ? grid.objects.filter((o) => o.id !== obj.id && wayIdOf(o) === id) : [];
}

// Where one can get to from a cell by its way (the lift or the stairs): the cells of the other ends.
export function linkedPositions(grid, pos) {
  const objectId = grid.cells?.[pos.row]?.[pos.col]?.objectId;
  const obj = objectId ? grid.objects.find((o) => o.id === objectId) : null;
  return obj ? otherEnds(grid, obj).map((o) => ({ row: o.row, col: o.col })) : [];
}

// Are two cells on different floors joined by a way?
export function joinedByWay(grid, a, b) {
  return linkedPositions(grid, a).some((p) => p.row === b.row && p.col === b.col);
}

// Clear what stands on a cell (the whole way, if it is one) and put an end there.
function putEnd(grid, typeId, row, col, wayKey, wayId) {
  const cell = cellAt(grid, row, col);
  if (cell.objectId) removeObject(grid, cell.objectId);
  const obj = { id: makeId("obj"), typeId, row, col, [wayKey]: wayId };
  grid.objects.push(obj);
  cell.objectId = obj.id;
  return obj;
}

// The lift: a shaft through every floor at this row of its floor and this column. -> { ok: true, objects } | { ok: false, message }
export function placeElevator(grid, row, col) {
  if (!hasFloors(grid) || floorOf(grid, row) < 0) return { ok: false, message: t("L'ascensore serve ai casi con più piani.") };
  const local = localRow(grid, row);
  const cells = grid.sectors.map((floor) => ({ row: floor.first + local, col, floor }));
  if (cells.some((c) => c.row > c.floor.last || c.col >= sectorWidth(grid, c.floor) || !isUsable(grid, c.row, c.col))) {
    return { ok: false, message: t("L'ascensore ha bisogno di una casella libera, alla stessa riga e colonna, in tutti i piani.") };
  }
  const shaftId = makeId("shaft");
  return { ok: true, objects: cells.map((c) => putEnd(grid, "elevator", c.row, c.col, "shaftId", shaftId)) };
}

// Stairs between two cells on neighbouring floors. -> { ok: true, objects } | { ok: false, message }
export function placeStairs(grid, from, to) {
  const a = floorOf(grid, from.row);
  const b = floorOf(grid, to.row);
  if (!hasFloors(grid) || a < 0 || b < 0 || Math.abs(a - b) !== 1) {
    return { ok: false, message: t("Le scale collegano due piani vicini: scegli la seconda casella nel piano sopra o sotto.") };
  }
  if (!isUsable(grid, from.row, from.col) || !isUsable(grid, to.row, to.col)) {
    return { ok: false, message: t("Le scale vanno su caselle dove una persona può stare.") };
  }
  const linkId = makeId("stairs");
  return {
    ok: true,
    objects: [putEnd(grid, "stairs", from.row, from.col, "linkId", linkId), putEnd(grid, "stairs", to.row, to.col, "linkId", linkId)],
  };
}

// What is wrong with the ways of the map (none for a well-formed one).
export function wayProblems(grid) {
  const problems = [];
  const groups = new Map();
  for (const obj of grid.objects) {
    if (!obj || !isWayType(obj.typeId)) continue;
    const key = obj.typeId === "elevator" ? obj.shaftId : obj.linkId;
    if (typeof key !== "string" || (obj.typeId === "elevator" ? obj.linkId !== undefined : obj.shaftId !== undefined)) {
      problems.push(t("Una scala o un ascensore non è collegato correttamente."));
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obj);
  }
  if (groups.size > 0 && !hasFloors(grid)) problems.push(t("Le scale e gli ascensori servono ai casi con più piani."));
  else {
    for (const ends of groups.values()) {
      if (ends.length > 0 && !wayWellFormed(grid, ends)) problems.push(t("Una scala o un ascensore non è collegato correttamente."));
    }
  }
  return [...new Set(problems)];
}

function wayWellFormed(grid, ends) {
  const floors = ends.map((o) => floorOf(grid, o.row));
  if (floors.some((f) => f < 0) || new Set(floors).size !== floors.length) return false;
  if (ends[0].typeId === "stairs") return ends.length === 2 && Math.abs(floors[0] - floors[1]) === 1;
  return ends.length === grid.sectors.length && new Set(ends.map((o) => `${localRow(grid, o.row)},${o.col}`)).size === 1;
}

// Remove the ways that lost an end (a smaller map, other floors): whatever is left of them would lead nowhere.
export function pruneWays(grid) {
  const groups = new Map();
  for (const obj of [...grid.objects]) {
    if (!obj || !isWayType(obj.typeId)) continue;
    const key = wayIdOf(obj);
    if (!key) {
      removeObject(grid, obj.id); // an end of nothing
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obj);
  }
  for (const ends of groups.values()) {
    if (hasFloors(grid) && wayWellFormed(grid, ends)) continue;
    for (const obj of ends) removeObject(grid, obj.id);
  }
}
