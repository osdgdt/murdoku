import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { computeHintChain } from "../src/solver/hints.js";
import { computeHintChainAsync } from "../src/solver/solverClient.js";
import { assertEqual } from "./assert.js";

export const tests = [
  {
    name: "solverClient: computeHintChainAsync (Worker reale) produce lo stesso risultato di computeHintChain in-thread",
    fn: async () => {
      const puzzle = createPuzzle("Test solver worker");
      puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
      const a = addCharacter(puzzle, "A", "person1");
      addCharacter(puzzle, "B", "person2");
      const zone = addZone(puzzle.grid, "Studio", "#fff");
      paintCellZone(puzzle.grid, 1, 1, zone.id);
      addClue(puzzle, a.id, "inRoom", { zoneId: zone.id });

      const currentPlacements = new Map();
      const candidates = new Map();
      const expected = computeHintChain(puzzle, currentPlacements, candidates);
      const actual = await computeHintChainAsync(puzzle, currentPlacements, candidates);
      // JSON.stringify equality is exact and sufficient here: computeHintChain's
      // output is already proven plain-JSON-safe (no Maps/Sets/functions in any
      // step), and both results come from the literal same function called with
      // identical input, so a mismatch could only mean the postMessage/
      // structured-clone round trip (Maps in, plain objects out) altered the
      // data — exactly what this test exists to catch. Not re-testing the
      // solver's own logic, already covered by the other ~200 tests.
      assertEqual(
        JSON.stringify(actual),
        JSON.stringify(expected),
        "il risultato calcolato nel Worker deve corrispondere esattamente a quello calcolato in-thread per lo stesso input"
      );
    },
  },
];
