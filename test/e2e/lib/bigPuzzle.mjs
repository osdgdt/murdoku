// A 16×16 case with 16 characters (the largest the app takes), for the browser tests of big boards.
import { createPuzzle, addCharacter, setSolutionPlacement } from "../../../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone } from "../../../src/model/grid.js";

// The case: 16×16, six rooms, 16 characters on a permutation (no clues are needed to draw it).
export function buildBigPuzzle() {
  const puzzle = createPuzzle("Big 16");
  puzzle.grid = resizeGrid(puzzle.grid, 16, 16);
  const colors = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2"];
  const zones = ["Hall", "Library", "Kitchen", "Study", "Cellar", "Chapel"].map((name, i) =>
    addZone(puzzle.grid, name, colors[i], "hatch")
  );
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) paintCellZone(puzzle.grid, r, c, zones[Math.min(2, Math.floor(r / 5.4)) * 2 + (c < 8 ? 0 : 1)].id);
  }
  const names = ["Ada", "Bea", "Cleo", "Dora", "Eva", "Fay", "Gia", "Hana", "Ida", "Jo", "Kai", "Lea", "Mia", "Nia", "Ola", "Pia"];
  names.forEach((name, i) => addCharacter(puzzle, name, "person1", i === 0));
  puzzle.characters.forEach((c, i) => setSolutionPlacement(puzzle, c.id, i, (i * 5) % 16));
  return puzzle;
}
