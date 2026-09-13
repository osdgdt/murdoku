import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { resolveCharacterHoverDomain } from "../src/solver/hoverTargets.js";
import { assert, assertEqual } from "./assert.js";

function basePuzzle(rows = 4, cols = 4) {
  const puzzle = createPuzzle("Test hover domain");
  puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
  return puzzle;
}

function mapOf(entries) {
  return new Map(entries);
}

function cellSet(cells) {
  return new Set(cells.map((c) => `${c.row},${c.col}`));
}

export const tests = [
  {
    name: "resolveCharacterHoverDomain: interseca due indizi propri (inRoom + rowOrColParity), non li unisce",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      paintCellZone(puzzle.grid, 1, 0, zone.id); // stanza di 3 celle: (0,0) (0,1) (1,0)
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });
      addClue(puzzle, a.id, "rowOrColParity", { axis: "row", parity: "even" }); // riga pari (R2, R4) -> 0-based 1,3
      const cells = resolveCharacterHoverDomain(puzzle, a.id, mapOf([]));
      assertEqual(cellSet(cells).size, 1, "solo (1,0) soddisfa entrambi gli indizi propri contemporaneamente");
      assert(cellSet(cells).has("1,0"));
    },
  },
  {
    name: "resolveCharacterHoverDomain: esclude le celle già usate dalla riga/colonna di un altro personaggio",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const b = addCharacter(puzzle, "B", "person2");
      const cells = resolveCharacterHoverDomain(puzzle, a.id, mapOf([[b.id, { row: 1, col: 2 }]]));
      assert(!cellSet(cells).has("1,0"), "riga di B esclusa");
      assert(!cellSet(cells).has("0,2"), "colonna di B esclusa");
      assert(cellSet(cells).has("0,0"), "il resto della griglia resta disponibile");
    },
  },
  {
    name: "resolveCharacterHoverDomain: un indizio GENERICO che escluderebbe una cella non influenza il dominio proprio del personaggio",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 0, 0, zone.id);
      paintCellZone(puzzle.grid, 0, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id }); // indizio proprio: consente (0,0) e (0,1)
      addClue(puzzle, null, "noOneInRowOrCol", { axis: "row", index: 1 }); // generico: esclude la riga 0 per chiunque
      const cells = resolveCharacterHoverDomain(puzzle, a.id, mapOf([]));
      assertEqual(cellSet(cells).size, 2, "l'indizio generico non deve restringere il dominio proprio del personaggio");
      assert(cellSet(cells).has("0,0") && cellSet(cells).has("0,1"));
    },
  },
  {
    name: "resolveCharacterHoverDomain: hoverare un personaggio già piazzato include la sua stessa cella attuale",
    fn: () => {
      const puzzle = basePuzzle();
      const a = addCharacter(puzzle, "A", "person1");
      const cells = resolveCharacterHoverDomain(puzzle, a.id, mapOf([[a.id, { row: 0, col: 0 }]]));
      assert(cellSet(cells).has("0,0"), "la propria cella attuale deve restare tra le candidate, non auto-esclusa");
    },
  },
  {
    name: "resolveCharacterHoverDomain: un personaggio senza indizi propri restituisce ogni cella ancora disponibile e occupabile",
    fn: () => {
      const puzzle = basePuzzle(2, 2);
      const a = addCharacter(puzzle, "A", "person1");
      const cells = resolveCharacterHoverDomain(puzzle, a.id, mapOf([]));
      assertEqual(cellSet(cells).size, 4);
    },
  },
];
