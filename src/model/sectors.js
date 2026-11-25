import { t } from "../i18n/i18n.js";
import { makeId } from "../util/id.js";
import { cellAt, setBlocked } from "./grid.js";
import { pruneWays } from "./floors.js";

// Cases with several maps in one (Wild West: the train, one map per wagon side by side; the skyscraper: one map per floor,
// stacked). The whole thing is ONE grid cut into strips: `grid.sectors = [{ id, name, first, last, width? }]` in order and with no
// gap, along the axis `grid.sectorAxis`:
//   "col" (default, the train)       wagons side by side: columns are numbered across the wagons (C1…C15), the rows repeat in
//                                    each of them (R1…R4)
//   "row" (the skyscraper)           floors one above the other, the highest first: every floor has its own rows and columns
//                                    (R1…R4 and C1…C4 in each, the labels and the numbers of the clues count inside a floor);
//                                    the grid itself numbers its rows across the floors (R1…R15 is the row key)
// The rule of the book changes from «one person per row and per column» to: one per line of the shared numbering everywhere
// (a column of the train, a row of the skyscraper) and one per line of the repeated one INSIDE each strip. The skyscraper is a
// 3D cube (floor, row, column) and has a third direction: a PILLAR, the same row of its floor and the same column through all the
// floors, holds one person at most. Without sectors nothing changes: a row is its number and so is a column. The solver and the
// boards ask for the «row key», the «column key» and the «pillar key» of a cell: the line it belongs to, which is the plain number
// for a plain case and the pair (strip, number) for one that repeats.
// A floor may be narrower than the grid (`width`): the cells to its right are not there (blocked, see syncFloorPadding).
export const MAX_SECTORS = 6;

export const hasSectors = (grid) => Array.isArray(grid?.sectors) && grid.sectors.length > 0;
export const sectorAxis = (grid) => (grid?.sectorAxis === "row" ? "row" : "col");
// Floors one above the other: the skyscraper.
export const hasFloors = (grid) => hasSectors(grid) && sectorAxis(grid) === "row";

// How long the grid is along the axis the strips divide.
const lengthAlong = (grid) => (sectorAxis(grid) === "row" ? grid.size.rows : grid.size.cols);

// The index of the strip that holds a coordinate of the axis (-1 without sectors).
export function sectorIndexAlong(grid, index) {
  return hasSectors(grid) ? grid.sectors.findIndex((s) => index >= s.first && index <= s.last) : -1;
}
// ... and of the strip that holds a cell.
export const sectorIndexAt = (grid, row, col) => sectorIndexAlong(grid, sectorAxis(grid) === "row" ? row : col);
export const sectorAt = (grid, row, col) => grid.sectors?.[sectorIndexAt(grid, row, col)] ?? null;
export const sectorSize = (sector) => sector.last - sector.first + 1;

// Floors: the index of the floor of a row (0 = the highest), -1 when the case has none.
export const floorOf = (grid, row) => (hasFloors(grid) ? sectorIndexAlong(grid, row) : -1);
// Two cells can be compared (north of, next to, in the same row...) only inside one floor; without floors always.
export function sameFloor(grid, a, b) {
  if (!grid.sectors) return true; // the usual case, and this is called a lot
  return !hasFloors(grid) || floorOf(grid, a.row) === floorOf(grid, b.row);
}
// The row of a cell inside its floor (the plain row without floors).
export function localRow(grid, row) {
  if (!hasFloors(grid)) return row;
  const floor = grid.sectors[sectorIndexAlong(grid, row)];
  return floor ? row - floor.first : row;
}

// How many rows the tallest floor has (every floor numbers its rows from 1: «row 2» is the second of each floor).
export const longestFloor = (grid) => (hasFloors(grid) ? Math.max(...grid.sectors.map(sectorSize)) : grid.size.rows);

// The values of an enum parameter that the case can use: those a parameter lists in `floorValues` only exist with floors.
export const enumValuesFor = (param, grid) =>
  param.floorValues && !hasFloors(grid) ? param.values.filter((v) => !param.floorValues.includes(v)) : param.values;

// The box a cell lives in for corners and edges: its floor (top/bottom row, last column) in a skyscraper, the whole grid otherwise.
export function floorBox(grid, row) {
  if (!hasFloors(grid)) return { top: 0, bottom: grid.size.rows - 1, right: grid.size.cols - 1 };
  const floor = grid.sectors[sectorIndexAlong(grid, row)] ?? grid.sectors[0];
  return { top: floor.first, bottom: floor.last, right: sectorWidth(grid, floor) - 1 };
}

// The width of a floor: the narrow ones leave the cells on their right empty. Every other strip is as wide as the grid.
export function sectorWidth(grid, sector) {
  if (sectorAxis(grid) !== "row" || !Number.isInteger(sector?.width)) return grid.size.cols;
  return Math.min(Math.max(sector.width, 1), grid.size.cols);
}
// Is this cell one of the empty ones on the right of a narrow floor?
export function isFloorPadding(grid, row, col) {
  if (!hasFloors(grid)) return false;
  const floor = sectorAt(grid, row, col);
  return !!floor && col >= sectorWidth(grid, floor);
}

// (row, col) -> a number that is the same for the cells that share a "row" / a "column" / a "pillar" (64 > the 16 lines of a
// grid). `pillarKey` is null where there are no pillars (everything but the skyscraper).
export function lineKeyFns(grid) {
  if (!hasSectors(grid)) return { rowKey: (row) => row, colKey: (row, col) => col, pillarKey: null };
  const strip = [];
  for (let i = 0; i < lengthAlong(grid); i++) strip.push(Math.max(sectorIndexAlong(grid, i), 0));
  if (sectorAxis(grid) !== "row") {
    return { rowKey: (row, col) => strip[col] * 64 + row, colKey: (row, col) => col, pillarKey: null };
  }
  const local = strip.map((s, row) => row - grid.sectors[s].first);
  return { rowKey: (row) => row, colKey: (row, col) => strip[row] * 64 + col, pillarKey: (row, col) => local[row] * 64 + col };
}
// The lines already taken by some cells, to ask "can somebody else stand here?" (a row, a column and, in a skyscraper, a pillar).
export function lineTracker(grid, positions = []) {
  const tracker = makeLineTracker(lineKeyFns(grid));
  for (const p of positions) tracker.add(p.row, p.col);
  return tracker;
}
// The same from the keys themselves (the solvers keep them in their context and make trackers in hot loops).
export function makeLineTracker({ rowKey, colKey, pillarKey }) {
  const rows = new Set();
  const cols = new Set();
  const pillars = new Set();
  const tracker = {
    add(row, col) {
      rows.add(rowKey(row, col));
      cols.add(colKey(row, col));
      if (pillarKey) pillars.add(pillarKey(row, col));
    },
    delete(row, col) {
      rows.delete(rowKey(row, col));
      cols.delete(colKey(row, col));
      if (pillarKey) pillars.delete(pillarKey(row, col));
    },
    has: (row, col) => rows.has(rowKey(row, col)) || cols.has(colKey(row, col)) || (pillarKey !== null && pillars.has(pillarKey(row, col))),
  };
  return tracker;
}
export const rowKeyFn = (grid) => lineKeyFns(grid).rowKey;
export const colKeyFn = (grid) => lineKeyFns(grid).colKey;

// The whole-line reasonings (a row/column that must hold somebody) are only sound on the lines of the shared numbering.
export const sharedAxes = (grid) => (!hasSectors(grid) ? ["row", "col"] : sectorAxis(grid) === "row" ? ["row"] : ["col"]);

// The most people the grid can hold: a plain one min(rows, cols); with strips each holds at most min(its length, the other
// side) and the shared lines bound the total. A skyscraper is bounded by its floors and by its pillars too.
export function capacityOf(grid) {
  const { rows, cols } = grid.size;
  if (!hasSectors(grid)) return Math.min(rows, cols);
  if (sectorAxis(grid) !== "row") return grid.sectors.reduce((sum, s) => sum + Math.min(rows, sectorSize(s)), 0);
  const pillars = new Set();
  let byFloors = 0;
  for (const floor of grid.sectors) {
    const usedRows = new Set();
    const usedCols = new Set();
    for (let r = floor.first; r <= floor.last; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid.cells?.[r]?.[c]?.blocked) continue;
        usedRows.add(r);
        usedCols.add(c);
        pillars.add((r - floor.first) * 64 + c);
      }
    }
    byFloors += Math.min(usedRows.size, usedCols.size);
  }
  return Math.min(byFloors, pillars.size);
}

// The cells that are padding ("row,col" strings) with the strips as they are now.
function paddingKeys(grid) {
  const keys = new Set();
  if (!hasFloors(grid)) return keys;
  for (let r = 0; r < grid.size.rows; r++) for (let c = 0; c < grid.size.cols; c++) if (isFloorPadding(grid, r, c)) keys.add(`${r},${c}`);
  return keys;
}

// Make the empty cells of the narrow floors blocked, and give back the ones that were padding and are not any more. `before`:
// the padding as it was before the strips changed.
export function syncFloorPadding(grid, before = new Set()) {
  const now = paddingKeys(grid);
  for (const key of before) {
    if (now.has(key)) continue;
    const [r, c] = key.split(",").map(Number);
    if (cellAt(grid, r, c)?.blocked) setBlocked(grid, r, c, false);
  }
  for (const key of now) {
    const [r, c] = key.split(",").map(Number);
    if (!cellAt(grid, r, c)?.blocked) setBlocked(grid, r, c, true);
  }
}
// The padding the grid has right now, to hand to syncFloorPadding after a change.
export const floorPadding = paddingKeys;

// Cut the grid into strips of the given sizes along `axis` (`names` optional; `widths`, floors only: one per floor, no wider than
// the grid, the missing ones are as wide as the grid). `null`/[] or a single strip removes them.
export function setSectors(grid, sizes, names = [], axis = sectorAxis(grid), widths = []) {
  const before = paddingKeys(grid);
  if (!Array.isArray(sizes) || sizes.length < 2) {
    delete grid.sectors;
    delete grid.sectorAxis;
    syncFloorPadding(grid, before);
    pruneWays(grid);
    return true;
  }
  const total = axis === "row" ? grid.size.rows : grid.size.cols;
  if (sizes.length > MAX_SECTORS || sizes.some((w) => !Number.isInteger(w) || w < 1) || sizes.reduce((a, b) => a + b, 0) !== total)
    return false;
  if (axis === "row" && widths.some((w) => w !== undefined && w !== null && (!Number.isInteger(w) || w < 1 || w > grid.size.cols)))
    return false;
  let first = 0;
  const old = grid.sectors;
  grid.sectors = sizes.map((size, i) => {
    const sector = {
      id: old?.[i]?.id ?? makeId("sector"),
      name: (names[i] ?? old?.[i]?.name ?? "").trim() || `${i + 1}`,
      first,
      last: first + size - 1,
    };
    const width = axis === "row" ? widths[i] : undefined;
    if (Number.isInteger(width) && width < grid.size.cols) sector.width = width;
    first += size;
    return sector;
  });
  if (axis === "row") grid.sectorAxis = "row";
  else delete grid.sectorAxis;
  syncFloorPadding(grid, before);
  pruneWays(grid); // the stairs and the lift that no longer fit the floors go
  return true;
}

// After resizing the grid the strips are cut again over the new length: the last one takes the difference.
export function fitSectors(grid) {
  if (!hasSectors(grid)) return;
  const length = lengthAlong(grid);
  const kept = grid.sectors.filter((s) => s.first < length).map((s) => ({ ...s, last: Math.min(s.last, length - 1) }));
  if (kept.length < 2) {
    delete grid.sectors;
    delete grid.sectorAxis;
    return;
  }
  kept[kept.length - 1].last = length - 1;
  for (const s of kept) if (s.width !== undefined && !(sectorAxis(grid) === "row" && s.width < grid.size.cols)) delete s.width;
  grid.sectors = kept;
}

export function sectorProblems(grid) {
  if (grid?.sectors === undefined && grid?.sectorAxis === undefined) return [];
  if (grid.sectorAxis !== undefined && grid.sectorAxis !== "row") return [t("La disposizione delle mappe non è valida.")];
  const sectors = grid.sectors;
  if (!Array.isArray(sectors) || sectors.length < 2 || sectors.length > MAX_SECTORS) {
    return [t("Le mappe devono essere da 2 a {n}.", { n: MAX_SECTORS })];
  }
  let next = 0;
  for (const s of sectors) {
    if (!s || typeof s.id !== "string" || !Number.isInteger(s.first) || !Number.isInteger(s.last) || s.first !== next || s.last < s.first) {
      return [t("Le mappe devono coprire la griglia una dopo l'altra, senza buchi.")];
    }
    next = s.last + 1;
  }
  if (next !== lengthAlong(grid)) return [t("Le mappe devono coprire tutta la griglia.")];
  for (const s of sectors) {
    if (s.width === undefined) continue;
    if (sectorAxis(grid) !== "row" || !Number.isInteger(s.width) || s.width < 1 || s.width >= grid.size.cols) {
      return [t("La larghezza di un piano non è valida.")];
    }
  }
  for (const key of paddingKeys(grid)) {
    const [r, c] = key.split(",").map(Number);
    if (grid.cells?.[r]?.[c] && !grid.cells[r][c].blocked) return [t("Le caselle fuori dalla larghezza di un piano devono essere vuote.")];
  }
  return [];
}
