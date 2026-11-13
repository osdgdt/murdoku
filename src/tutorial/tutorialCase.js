// The worked example of the tutorial page (tutorial.html): a tiny original case,
// built with the game's own model. Pure (no DOM). The page narrates the
// deduction steps computed here by `deriveSteps`, which uses the same clue
// predicates as the solver — so the tutorial can't disagree with the game, and
// test/test-tutorial.js pins the story (who is forced first, who the killer is).
import { t } from "../i18n/i18n.js";
import { createGrid, addZone, paintCellZone, placeObject, isOccupiable } from "../model/grid.js";
import { createPuzzle, addCharacter, addClue, setSolutionPlacement } from "../model/puzzle.js";
import { objectTypeTargetId } from "../model/icons.js";
import { buildPredicate } from "../solver/predicates/index.js";

// Two rooms, 4x4:           C0 C1 C2 C3
//   Cucina       (R1-R2)    .  A  S  .      S shelf (0,2)    A  Anna
//                           B  .  .  .      B rug + Bruno (1,0)
//   Biblioteca   (R3-R4)    .  .  V  P      P plant (2,3)    V  the victim
//                           r  .  .  Cw     r rug (3,0)      C  Carla, window east
export const ROOMS = [
  { key: "kitchen", name: () => t("Cucina"), color: "#f4c2c2", rows: [0, 1] },
  { key: "library", name: () => t("Biblioteca"), color: "#c2e0f4", rows: [2, 3] },
];

export function buildTutorialCase() {
  const puzzle = createPuzzle(t("Tutorial"));
  puzzle.grid = createGrid(4, 4);
  const grid = puzzle.grid;
  const zones = {};
  for (const room of ROOMS) {
    zones[room.key] = addZone(grid, room.name(), room.color);
    for (const r of room.rows) for (let c = 0; c < 4; c++) paintCellZone(grid, r, c, zones[room.key].id);
  }
  placeObject(grid, "shelf", 0, 2);
  placeObject(grid, "carpet", 1, 0);
  placeObject(grid, "carpet", 3, 0);
  placeObject(grid, "plant", 2, 3);
  placeObject(grid, "window", 3, 3, "E");

  const anna = addCharacter(puzzle, "Anna", "detective");
  const bruno = addCharacter(puzzle, "Bruno", "butler");
  const carla = addCharacter(puzzle, "Carla", "chef");
  const victim = addCharacter(puzzle, "Valerio", "victim", true);

  addClue(puzzle, anna.id, "adjacent", { targetId: objectTypeTargetId("shelf") });
  addClue(puzzle, bruno.id, "onObjectType", { objectTypeId: "carpet" });
  addClue(puzzle, carla.id, "inFrontOfWindow", {});

  const solution = { [anna.id]: [0, 1], [bruno.id]: [1, 0], [carla.id]: [3, 3], [victim.id]: [2, 2] };
  for (const [id, [r, c]] of Object.entries(solution)) setSolutionPlacement(puzzle, id, r, c);
  return { puzzle, grid, zones, characters: { anna, bruno, carla, victim }, suspects: [anna, bruno, carla] };
}

// Where a suspect can stand according to their own clue alone (the cells that
// are occupiable and satisfy the clue), ignoring everybody else.
export function cluePossibleCells(built, character) {
  const { puzzle, grid } = built;
  const clue = puzzle.clues.find((c) => c.characterId === character.id);
  const predicate = buildPredicate(clue, puzzle);
  const cells = [];
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      if (!isOccupiable(grid, r, c)) continue;
      if (predicate(new Map([[character.id, { row: r, col: c }]]), true) === true) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

// The deduction, one step at a time, exactly as a player would do it:
//  1. every suspect's cells from their clue alone;
//  2. repeat: a suspect left with a single cell (once the rows and columns of
//     the people already placed are crossed out) stands there;
//  3. the victim takes the last free cell; 4. the killer is the one alone in a
//     room with the victim.
// Returns [{ kind, ... }] with the board state AFTER each step.
export function deriveSteps(built) {
  const { grid, characters, suspects } = built;
  const placed = new Map(); // character id -> { row, col }
  const domains = new Map(suspects.map((s) => [s.id, cluePossibleCells(built, s)]));
  const steps = [{ kind: "clues", domains: cloneDomains(domains), placed: new Map(placed) }];
  const crossed = () => {
    const rows = new Set([...placed.values()].map((p) => p.row));
    const cols = new Set([...placed.values()].map((p) => p.col));
    return { rows, cols };
  };
  while (placed.size < suspects.length) {
    const { rows, cols } = crossed();
    let forced = null;
    for (const s of suspects) {
      if (placed.has(s.id)) continue;
      const left = domains.get(s.id).filter((c) => !rows.has(c.row) && !cols.has(c.col));
      if (left.length === 1) {
        forced = { character: s, cell: left[0] };
        break;
      }
    }
    if (!forced) throw new Error("tutorial: nessun personaggio è obbligato — l'esempio non si risolve a passi");
    const before = crossed();
    placed.set(forced.character.id, forced.cell);
    const after = crossed();
    steps.push({
      kind: "place",
      character: forced.character,
      cell: forced.cell,
      domain: domains.get(forced.character.id),
      // what was still open for them before the others' rows/columns were crossed out
      options: domains.get(forced.character.id).filter((c) => !before.rows.has(c.row) && !before.cols.has(c.col)),
      crossedRows: [...after.rows],
      crossedCols: [...after.cols],
      placed: new Map(placed),
    });
  }
  const { rows, cols } = crossed();
  const free = [];
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      if (!rows.has(r) && !cols.has(c) && isOccupiable(grid, r, c)) free.push({ row: r, col: c });
    }
  }
  if (free.length !== 1) throw new Error("tutorial: la vittima non ha un'unica casella libera");
  placed.set(characters.victim.id, free[0]);
  steps.push({ kind: "victim", character: characters.victim, cell: free[0], placed: new Map(placed) });
  const zoneOf = (p) => grid.cells[p.row][p.col].zoneId;
  const roommates = suspects.filter((s) => zoneOf(placed.get(s.id)) === zoneOf(free[0]));
  if (roommates.length !== 1) throw new Error("tutorial: la vittima deve avere una sola persona nella stanza");
  steps.push({ kind: "killer", character: roommates[0], victim: characters.victim, zoneId: zoneOf(free[0]), placed: new Map(placed) });
  return steps;
}

function cloneDomains(domains) {
  return new Map([...domains].map(([id, cells]) => [id, cells.map((c) => ({ ...c }))]));
}
