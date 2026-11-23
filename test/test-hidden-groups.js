// «Hidden groups»: K cells where somebody certainly stands (a «somebody is there» fact) that only K characters can reach are theirs.
// (For rows and columns the same idea is lineGroups, seen from the other characters.)
// Like every reasoning it must never rule out a cell of the solution, and the human solver must conclude like the exact search.
import { humanSolve } from "../src/solver/techniques/engine.js";
import { caseWithGeneralClues, uniqueWithGeneralClues } from "./helpers/general-clues.js";
import { uniqueCase, placementsOf } from "./helpers/unique-case.js";
import { referenceSolutions } from "./reference-solver.js";
import { assert, assertEqual } from "./assert.js";

// the human solver on `puzzle`: every step true of the (unique) solution, the same solution as the exact search
function checkAgainstReference(puzzle, label) {
  const expected = referenceSolutions(puzzle);
  const result = humanSolve(puzzle, { maxWork: 3e6 });
  if (result.status === "limit") return null;
  if (expected.length === 0) assertEqual(result.status, "contradiction", `${label}: senza soluzioni`);
  else if (expected.length >= 2) assertEqual(result.status, "ambiguous", `${label}: ambiguo`);
  else {
    assertEqual(result.status, "solved", `${label}: una soluzione`);
    const want = placementsOf(expected[0]);
    for (const [id, cell] of want) {
      assertEqual(result.placements.get(id)?.row, cell.row, `${label}: riga di ${id}`);
      assertEqual(result.placements.get(id)?.col, cell.col, `${label}: colonna di ${id}`);
    }
    for (const step of result.steps) {
      const cell = want.get(step.characterId);
      if (step.placed) assert(step.placed.row === cell.row && step.placed.col === cell.col, `${label}: ${step.technique} piazza male`);
      for (const gone of step.eliminated ?? [])
        assert(!(gone.row === cell.row && gone.col === cell.col), `${label}: ${step.technique} scarta la cella giusta`);
    }
  }
  return result;
}

export const tests = [
  {
    name: "gruppi nascosti: su casi casuali non scartano mai una cella della soluzione, e i casi senza indizi generali non cambiano",
    fn: () => {
      for (let seed = 1; seed <= 600; seed++) {
        const puzzle = uniqueCase(seed, { sizeBias: seed % 3 });
        if (!puzzle) continue;
        const result = checkAgainstReference(puzzle, `caso ${seed}`);
        // senza indizi sulle persone in generale non ci sono caselle «certamente occupate»: il ragionamento non può scattare
        assert(!result?.steps.some((s) => s.technique === "hiddenGroups"), `caso ${seed}: hiddenGroups senza indizi generali`);
      }
    },
  },
  {
    name: "gruppi nascosti: con indizi generali («qualcuno è qui») anche le caselle riservate sono sicure e usate",
    fn: () => {
      let cellSteps = 0;
      // 6871: caso (sempre lo stesso, i casi casuali non dipendono dagli id) in cui K caselle certamente occupate sono raggiungibili solo da K personaggi
      for (const seed of [6871]) {
        const puzzle = seed % 2 ? uniqueWithGeneralClues(seed) : caseWithGeneralClues(seed);
        assert(puzzle, `caso ${seed}: costruibile`);
        const result = checkAgainstReference(puzzle, `caso ${seed}`);
        assert(result, `caso ${seed}: dentro il limite di lavoro`);
        cellSteps += result.steps.filter((s) => s.technique === "hiddenGroups" && s.cells).length;
      }
      assert(cellSteps >= 1, `serve almeno un passo sulle caselle (${cellSteps})`);
      for (let seed = 1; seed <= 150; seed++) {
        const puzzle = seed % 2 ? uniqueWithGeneralClues(seed) : caseWithGeneralClues(seed);
        if (puzzle) checkAgainstReference(puzzle, `generale ${seed}`);
      }
    },
  },
];
