import { makeId } from "../util/id.js";
import { isObjectTypeOccupiable, isEdgeObjectType } from "./icons.js";

export function createGrid(rows = 6, cols = 6) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ zoneId: null, objectId: null, blocked: false });
    }
    cells.push(row);
  }
  return { size: { rows, cols }, cells, zones: [], objects: [] };
}

export function resizeGrid(grid, rows, cols) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const existing = grid.cells[r] && grid.cells[r][c];
      row.push(existing ? { ...existing } : { zoneId: null, objectId: null, blocked: false });
    }
    cells.push(row);
  }
  const objects = grid.objects.filter((o) => o.row < rows && o.col < cols);
  // drop object refs on cells that fell out of range
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const objId = cells[r][c].objectId;
      if (objId && !objects.find((o) => o.id === objId)) cells[r][c].objectId = null;
    }
  }
  return { size: { rows, cols }, cells, zones: grid.zones, objects };
}

export function inBounds(grid, row, col) {
  return row >= 0 && row < grid.size.rows && col >= 0 && col < grid.size.cols;
}

export function cellAt(grid, row, col) {
  if (!inBounds(grid, row, col)) return null;
  return grid.cells[row][col];
}

// A cell is usable (can hold a zone/object/person) only if it's in bounds and not blocked.
export function isUsable(grid, row, col) {
  const cell = cellAt(grid, row, col);
  return !!cell && !cell.blocked;
}

// A cell can hold a *person* (character or X mark) only if it's usable and
// either empty or holds furniture low/flat enough to stand on (a rug, a
// chair — see OBJECT_TYPES' `occupiable` flag); you still can't stand on top
// of a shelf or a table. Distinct from isUsable, which zone-painting and
// object-placement still key off of (placing an object on a cell doesn't
// require the cell to already be empty of objects, since placeObject()
// itself handles replacing whatever was there).
export function isOccupiable(grid, row, col) {
  const cell = cellAt(grid, row, col);
  if (!cell || !isUsable(grid, row, col)) return false;
  if (!cell.objectId) return true;
  const obj = grid.objects.find((o) => o.id === cell.objectId);
  return !!obj && isObjectTypeOccupiable(obj.typeId);
}

export function setBlocked(grid, row, col, blocked) {
  const cell = cellAt(grid, row, col);
  if (!cell) return;
  cell.blocked = blocked;
  if (blocked) {
    if (cell.objectId) removeObject(grid, cell.objectId);
    cell.zoneId = null;
    // A door/window between this cell and a usable one stays (it is now on the
    // outer wall of that room); one left with no usable cell at all goes.
    for (const edge of edgeObjectsAt(grid, row, col)) {
      if (!edgeCells(grid, edge).some((c) => isUsable(grid, c.row, c.col))) removeObject(grid, edge.id);
    }
  }
}

export function addZone(grid, name, color, textureId = "hatch") {
  const zone = { id: makeId("zone"), name, color, textureId };
  grid.zones.push(zone);
  return zone;
}

// Longest room name the editor accepts (the name is shown on the board, in the legend and in clues).
export const MAX_ZONE_NAME = 40;

// Gives a room a new name. Only the name changes: the id (which clues, cells and
// saved cases refer to), the colour, the floor and the painted cells stay as they
// are. Returns false (and changes nothing) for an unknown room or a blank name.
export function renameZone(grid, zoneId, name) {
  const zone = grid.zones.find((z) => z.id === zoneId);
  const clean = String(name ?? "")
    .trim()
    .slice(0, MAX_ZONE_NAME)
    .trim();
  if (!zone || !clean) return false;
  zone.name = clean;
  return true;
}

// Gives a room a new colour (a "#rrggbb" hex, which is all the editor's pickers
// produce and the paper skin knows how to turn into a sheet of paper). Only the
// colour changes. Returns false (and changes nothing) for an unknown room or an
// invalid colour. The legend and every other place that shows the room read the
// colour from the room, so they follow on the next draw.
export function setZoneColor(grid, zoneId, color) {
  const zone = grid.zones.find((z) => z.id === zoneId);
  const clean = String(color ?? "")
    .trim()
    .toLowerCase();
  if (!zone || !/^#[0-9a-f]{6}$/.test(clean)) return false;
  zone.color = clean;
  return true;
}

export function removeZone(grid, zoneId) {
  grid.zones = grid.zones.filter((z) => z.id !== zoneId);
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.zoneId === zoneId) cell.zoneId = null;
    }
  }
}

export function paintCellZone(grid, row, col, zoneId) {
  if (!isUsable(grid, row, col)) return;
  const cell = cellAt(grid, row, col);
  cell.zoneId = zoneId;
}

// ---------------------------------------------------------------- walls and edge pieces
// Doors, windows and the other edge types (OBJECT_TYPES' `edge` flag) are not
// furniture: each is ONE piece of a WALL, shared by the two cells it lies
// between, drawn across the line that separates them. It is stored as
// { row, col, side }: the side of that cell the piece sits on. The S side of a
// cell and the N side of the cell below are the same segment, so every reader
// goes through the helpers below (edgeCells, edgeKey, ...) and never looks at
// `side` alone; documents written before pieces were shared (always from one
// cell's point of view) therefore keep working unchanged.
const SIDE_STEP = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };

// Where `side` of (row, col) leads: the other cell of that segment (it may be
// outside the grid, when the segment is on the border of the map).
export function edgeNeighbor(row, col, side = "N") {
  const [dr, dc] = SIDE_STEP[side] || SIDE_STEP.N;
  return { row: row + dr, col: col + dc };
}

// One way to write each segment: E and S, except on the first row/column where
// N/W have no cell beyond (a piece on the border of the map).
export function normalizeEdge(row, col, side = "N") {
  if (!SIDE_STEP[side]) side = "N";
  if (side === "N" && row > 0) return { row: row - 1, col, side: "S" };
  if (side === "W" && col > 0) return { row, col: col - 1, side: "E" };
  return { row, col, side };
}

export function edgeKey(obj) {
  const n = normalizeEdge(obj.row, obj.col, obj.side || "N");
  return `${n.row},${n.col},${n.side}`;
}

// The cells (inside the grid) a piece lies between: two, or one when it is on
// the border of the map. Not filtered by blocked/usable.
export function edgeCells(grid, obj) {
  const cells = [{ row: obj.row, col: obj.col }];
  const other = edgeNeighbor(obj.row, obj.col, obj.side || "N");
  if (inBounds(grid, other.row, other.col)) cells.push(other);
  return cells;
}

const zoneKeyAt = (grid, r, c) => {
  const cell = grid.cells[r][c];
  return !cell.blocked && cell.zoneId ? cell.zoneId : null;
};

// Whether a wall is drawn between two neighbouring cells: a different room, or a
// room against the outside / a blocked cell. Two cells outside any room are the
// same open area (no wall). The border of the map has its own frame, so it is
// not counted here (see isWallEdge for the pieces that sit on it).
export function wallBetween(grid, r1, c1, r2, c2) {
  if (!inBounds(grid, r2, c2)) return false;
  const a = zoneKeyAt(grid, r1, c1);
  const b = zoneKeyAt(grid, r2, c2);
  if (a === null && b === null) return false;
  return a !== b;
}

// Whether the segment on `side` of (row, col) is a wall: between two rooms, a
// room and the outside, or on the border of the map. Doors and windows only go
// on walls.
export function isWallEdge(grid, row, col, side = "N") {
  if (!inBounds(grid, row, col)) return false;
  const other = edgeNeighbor(row, col, side);
  if (!inBounds(grid, other.row, other.col)) return true;
  return wallBetween(grid, row, col, other.row, other.col);
}

// Whole-cell furniture: one per cell, placing over an existing one replaces it.
// Edge types (see above): only on a WALL — between two rooms, a room and the
// outside, or on the border of the map — and only one per segment (placing on a
// used segment replaces what is there). They never touch cell.objectId, so the
// cells stay free for people. Returns null when nothing was placed.
export function placeObject(grid, typeId, row, col, side = "N") {
  if (isEdgeObjectType(typeId)) {
    const edge = normalizeEdge(row, col, side);
    if (!inBounds(grid, edge.row, edge.col)) return null;
    if (!edgeCells(grid, edge).some((c) => isUsable(grid, c.row, c.col))) return null;
    if (!isWallEdge(grid, edge.row, edge.col, edge.side)) return null;
    const key = edgeKey(edge);
    for (const old of grid.objects.filter((o) => isEdgeObjectType(o.typeId) && edgeKey(o) === key)) removeObject(grid, old.id);
    const piece = { id: makeId("obj"), typeId, ...edge };
    grid.objects.push(piece);
    return piece;
  }
  if (!isUsable(grid, row, col)) return null;
  const existingId = grid.cells[row][col].objectId;
  if (existingId) removeObject(grid, existingId);
  const obj = { id: makeId("obj"), typeId, row, col };
  grid.objects.push(obj);
  grid.cells[row][col].objectId = obj.id;
  return obj;
}

// Doors/windows lying on any side of this cell (each also lies on a neighbour).
export function edgeObjectsAt(grid, row, col) {
  return grid.objects.filter((o) => isEdgeObjectType(o.typeId) && edgeCells(grid, o).some((c) => c.row === row && c.col === col));
}

// The piece on one side of a cell, if any (whichever cell it is stored under).
export function edgeObjectOnSide(grid, row, col, side = "N") {
  const key = edgeKey({ row, col, side });
  return grid.objects.find((o) => isEdgeObjectType(o.typeId) && edgeKey(o) === key) || null;
}

// Pieces that are not on a wall any more (the rooms were repainted around them),
// or that have no usable cell: the editor warns about them.
export function misplacedEdgeObjects(grid) {
  return grid.objects.filter(
    (o) =>
      isEdgeObjectType(o.typeId) &&
      (!isWallEdge(grid, o.row, o.col, o.side || "N") || !edgeCells(grid, o).some((c) => isUsable(grid, c.row, c.col)))
  );
}

export function removeObject(grid, objectId) {
  const obj = grid.objects.find((o) => o.id === objectId);
  if (!obj) return;
  grid.objects = grid.objects.filter((o) => o.id !== objectId);
  const cell = cellAt(grid, obj.row, obj.col);
  if (cell && cell.objectId === objectId) cell.objectId = null;
}

export function zoneOfCell(grid, row, col) {
  const cell = cellAt(grid, row, col);
  return cell ? cell.zoneId : null;
}
