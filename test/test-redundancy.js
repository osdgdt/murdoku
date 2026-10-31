import { findRedundantClues } from "../src/solver/redundancy.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, resizeGrid } from "../src/model/grid.js";
import { assert, assertEqual } from "./assert.js";

// 3x3, victim A + B. Zone "Studio" is the single cell (0,0); zone "Sala" the
// whole rest. Victim must share a room with exactly one person.
function build() {
  const p = createPuzzle("Redundancy");
  p.grid = resizeGrid(p.grid, 3, 3);
  const a = addCharacter(p, "A", "person1", true);
  const b = addCharacter(p, "B", "person2");
  const sala = addZone(p.grid, "Sala", "#eee");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) paintCellZone(p.grid, r, c, sala.id);
  return { p, a, b };
}

export const tests = [
  {
    name: "findRedundantClues: segnala un indizio duplicato come superfluo e uno essenziale no",
    fn: async () => {
      const { p, a, b } = build();
      const c1 = addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 });
      const c2 = addClue(p, a.id, "inRowOrCol", { axis: "row", index: 1 }); // duplicate of c1
      const c3 = addClue(p, b.id, "inRowOrCol", { axis: "col", index: 3 });
      const c4 = addClue(p, a.id, "inRowOrCol", { axis: "col", index: 1 });
      const c5 = addClue(p, b.id, "inRowOrCol", { axis: "row", index: 2 });
      const unique = checkUniqueness(p, { maxSolutions: 3 });
      assertEqual(unique.solutionCount, 1, "premessa del test: il caso deve avere soluzione unica");
      const result = await findRedundantClues(p, async (puzzle) => checkUniqueness(puzzle, { maxSolutions: 3 }));
      assert(result.ok);
      // c1/c2 are mutually redundant (either one alone is enough); the others constrain the grid.
      assert(result.redundant.includes(c1.id) && result.redundant.includes(c2.id), "i due duplicati sono ciascuno superfluo");
      assert(!result.redundant.includes(c3.id), "c3 è essenziale");
      assert(!result.redundant.includes(c4.id), "c4 è essenziale");
      assert(!result.redundant.includes(c5.id), "c5 è essenziale");
    },
  },
  {
    name: "findRedundantClues: su un caso non univoco non analizza e spiega perché",
    fn: async () => {
      const { p } = build();
      const result = await findRedundantClues(p, async (puzzle) => checkUniqueness(puzzle, { maxSolutions: 3 }));
      assertEqual(result.ok, false);
      assertEqual(result.reason, "not-unique");
    },
  },
];
