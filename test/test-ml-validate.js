// The judge of the machine-learning pipeline (tools/lib/ml-validate.mjs): valid / ambiguous / broken cases, the printed solution,
// the culprit. Node only (it imports from tools/).
import { validateForMl } from "../tools/lib/ml-validate.mjs";
import { uniqueCase } from "./helpers/unique-case.js";
import { assert, assertEqual } from "./assert.js";

function oneUniqueCase() {
  for (let seed = 1; seed < 200; seed++) {
    const puzzle = uniqueCase(seed);
    if (puzzle && puzzle.characters.length >= 4) return puzzle;
  }
  throw new Error("nessun caso unico trovato");
}
const printedOf = (puzzle) => ({
  placements: puzzle.solution.placements.map((p) => ({
    name: puzzle.characters.find((c) => c.id === p.characterId).name,
    row: p.row,
    col: p.col,
  })),
});

export const tests = [
  {
    name: "ml-validate: un caso con una sola soluzione è valido, dice colpevole, livello e passi",
    fn: () => {
      const puzzle = oneUniqueCase();
      const report = validateForMl({ puzzle });
      assertEqual(report.stage, "done");
      assert(report.unique && report.ok, JSON.stringify(report.problems));
      assertEqual(report.solution.length, puzzle.characters.length);
      assert(report.culprit, "il colpevole è chi sta con la vittima");
      assert(report.human && report.human.level, "il solver umano dà un livello");
      assertEqual(report.matchesPrinted, null, "senza soluzione stampata non c'è confronto");
    },
  },
  {
    name: "ml-validate: la soluzione stampata coincide o no, e dice chi è fuori posto",
    fn: () => {
      const puzzle = oneUniqueCase();
      const printed = printedOf(puzzle);
      const same = validateForMl({ puzzle, printed });
      assertEqual(same.matchesPrinted, true);
      assert(same.ok);
      const wrong = JSON.parse(JSON.stringify(printed));
      [wrong.placements[0].row, wrong.placements[1].row] = [wrong.placements[1].row, wrong.placements[0].row];
      const report = validateForMl({ puzzle, printed: wrong });
      assertEqual(report.matchesPrinted, false);
      assert(!report.ok && report.mismatches.length >= 1, "una soluzione diversa non è ok");
    },
  },
  {
    name: "ml-validate: senza indizi sufficienti non è unica; un file rotto è «shape»",
    fn: () => {
      const puzzle = oneUniqueCase();
      puzzle.clues = [];
      const empty = validateForMl({ puzzle });
      assertEqual(empty.ok, false);
      assert(empty.problems.length > 0);
      const broken = validateForMl({ puzzle: { grid: null } });
      assertEqual(broken.stage, "shape");
      assertEqual(broken.ok, false);
      assert(broken.problems.length > 0);
    },
  },
  {
    name: "ml-validate: con più soluzioni le elenca, ognuna con le posizioni e il colpevole",
    fn: () => {
      const puzzle = oneUniqueCase();
      // togliendo indizi si arriva a un caso con più soluzioni
      let report = validateForMl({ puzzle });
      while (report.unique && puzzle.clues.length > 1) {
        puzzle.clues.pop();
        report = validateForMl({ puzzle });
      }
      assertEqual(report.unique, false);
      assert(report.solutionCount >= 2, "più di una soluzione");
      assert(report.solutions.length >= 2, "le soluzioni sono elencate");
      for (const solution of report.solutions) assertEqual(solution.placements.length, puzzle.characters.length);
      const keys = new Set(report.solutions.map((s) => s.placements.map((p) => `${p.name}${p.row},${p.col}`).join("|")));
      assertEqual(keys.size, report.solutions.length, "sono tutte diverse");
    },
  },
];
