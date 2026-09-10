import { makeId } from "../util/id.js";
import { isObjectTypeOccupiable } from "./icons.js";

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
  }
}

export function addZone(grid, name, color) {
  const zone = { id: makeId("zone"), name, color };
  grid.zones.push(zone);
  return zone;
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

export function placeObject(grid, typeId, row, col) {
  if (!isUsable(grid, row, col)) return null;
  const existingId = grid.cells[row][col].objectId;
  if (existingId) removeObject(grid, existingId);
  const obj = { id: makeId("obj"), typeId, row, col };
  grid.objects.push(obj);
  grid.cells[row][col].objectId = obj.id;
  return obj;
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
