// The reasonings on clues about people in general («somebody on a pallet», «exactly 2 people next to a table»): they must never
// rule out a cell of the solution, and the human solver must conclude like the exact search, on many random cases.
import { humanSolve } from "../src/solver/techniques/engine.js";
import { caseWithGeneralClues, uniqueWithGeneralClues } from "./helpers/general-clues.js";
import { referenceSolutions } from "./reference-solver.js";
import { placementsOf } from "./helpers/unique-case.js";
import { assert, assertEqual } from "./assert.js";

const NEW = new Set(["regionCount", "witness", "occupiedCell"]);

export const tests = [
  {
    name: "ragionamenti sugli indizi generali: mai scartano una cella della soluzione e concludono come la ricerca esatta (casi casuali)",
    fn: () => {
      let solved = 0;
      let usedNew = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const puzzle = seed % 2 === 0 ? uniqueWithGeneralClues(seed) : caseWithGeneralClues(seed);
        if (!puzzle) continue;
        const expected = referenceSolutions(puzzle);
        const result = humanSolve(puzzle, { maxWork: 3e6 });
        if (result.status === "limit") continue;
        if (expected.length === 0) assertEqual(result.status, "contradiction", `caso ${seed}: senza soluzioni`);
        else if (expected.length >= 2) assertEqual(result.status, "ambiguous", `caso ${seed}: ambiguo`);
        else {
          assertEqual(result.status, "solved", `caso ${seed}: una soluzione`);
          const want = placementsOf(expected[0]);
          for (const [id, cell] of want) {
            assertEqual(result.placements.get(id)?.row, cell.row, `caso ${seed}: riga di ${id}`);
            assertEqual(result.placements.get(id)?.col, cell.col, `caso ${seed}: colonna di ${id}`);
          }
          for (const step of result.steps) {
            const cell = want.get(step.characterId);
            for (const gone of step.eliminated ?? [])
              assert(!(gone.row === cell.row && gone.col === cell.col), `caso ${seed}: ${step.technique} scarta la cella giusta`);
          }
          solved++;
          if (result.steps.some((s) => NEW.has(s.technique))) usedNew++;
        }
      }
      assert(solved >= 40, `servono abbastanza casi risolvibili (${solved})`);
      assert(usedNew >= 10, `i nuovi ragionamenti devono entrare in gioco in molti casi (${usedNew})`);
    },
  },
  {
    name: "ragionamenti sugli indizi generali: anche con un tetto di livello nessuna deduzione sbagliata",
    fn: () => {
      for (let seed = 1000; seed <= 1200; seed++) {
        const puzzle = seed % 2 === 0 ? uniqueWithGeneralClues(seed) : caseWithGeneralClues(seed);
        if (!puzzle) continue;
        const expected = referenceSolutions(puzzle);
        for (const level of ["medium", "hard"]) {
          const capped = humanSolve(puzzle, { maxLevel: level, maxWork: 3e6 });
          if (capped.status === "limit") continue;
          if (capped.status === "solved")
            assertEqual(expected.length, 1, `caso ${seed}: risolto con tetto ${level} ma non ha una sola soluzione`);
          else if (capped.status === "contradiction")
            assertEqual(expected.length, 0, `caso ${seed}: contraddizione sbagliata con tetto ${level}`);
        }
      }
    },
  },
  {
    name: "regionCount: con soli indizi che contano le persone (una stanza, accanto a un oggetto) è usato, non sbaglia e concorda con la ricerca esatta",
    fn: () => {
      let used = 0;
      for (let seed = 2000; seed < 2500; seed++) {
        const puzzle = uniqueWithGeneralClues(seed, ["exactlyOneInRoom", "exactlyOneNear", "peopleNear"]);
        if (!puzzle) continue;
        const expected = referenceSolutions(puzzle);
        const result = humanSolve(puzzle, { maxWork: 3e6 });
        if (result.status === "limit") continue;
        assertEqual(result.status, "solved", `caso ${seed}`);
        const want = placementsOf(expected[0]);
        for (const [id, cell] of want) {
          assertEqual(result.placements.get(id)?.row, cell.row, `caso ${seed}: riga di ${id}`);
          assertEqual(result.placements.get(id)?.col, cell.col, `caso ${seed}: colonna di ${id}`);
        }
        for (const step of result.steps) {
          const cell = want.get(step.characterId);
          for (const gone of step.eliminated ?? [])
            assert(!(gone.row === cell.row && gone.col === cell.col), `caso ${seed}: ${step.technique} scarta la cella giusta`);
        }
        if (result.steps.some((s) => s.technique === "regionCount")) used++;
      }
      assert(used >= 2, `regionCount deve servire almeno in qualche caso (${used})`);
    },
  },
];
