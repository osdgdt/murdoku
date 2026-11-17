// The optimised solver (unary domains, dynamic most-constrained ordering, incremental clue checks,
// optional forward checking) must find EXACTLY the solutions of the plain reference search, on cases
// of every kind: no clue, a few, contradictory, with rooms, objects and a victim. Seeded, so reproducible.
import { solvePuzzle, unaryDomains } from "../src/solver/solver.js";
import { buildPredicates } from "../src/solver/predicates/index.js";
import { isOccupiable } from "../src/model/grid.js";
import { propagate } from "../src/solver/propagation.js";
import { referenceSolutions } from "./reference-solver.js";
import { randomPuzzle, rng } from "./helpers/random-puzzle.js";
import { assert, assertEqual } from "./assert.js";

const keyOf = (solution) =>
  solution
    .map((p) => `${p.characterId}:${p.row},${p.col}`)
    .sort()
    .join("|");

export const tests = [
  {
    name: "solver differenziale: stesso insieme di soluzioni della ricerca di riferimento (200 casi casuali, con e senza forward-check e controllo incrementale)",
    fn: () => {
      let withSolutions = 0;
      let withoutSolutions = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const puzzle = randomPuzzle(seed);
        const expected = referenceSolutions(puzzle).sort();
        for (const [forwardCheck, incremental] of [
          [false, true],
          [false, false],
          [true, true],
        ]) {
          const actual = solvePuzzle(puzzle, { maxSolutions: 100000, forwardCheck, incremental }).map(keyOf).sort();
          assertEqual(
            actual.length,
            expected.length,
            `caso ${seed} (forwardCheck=${forwardCheck}, incremental=${incremental}): numero di soluzioni`
          );
          for (let i = 0; i < expected.length; i++)
            assertEqual(actual[i], expected[i], `caso ${seed} (forwardCheck=${forwardCheck}, incremental=${incremental}): soluzione ${i}`);
        }
        if (expected.length > 0) withSolutions++;
        else withoutSolutions++;
      }
      assert(withSolutions >= 10 && withoutSolutions >= 10, `serve un mix di casi risolvibili e no (${withSolutions}/${withoutSolutions})`);
    },
  },
  {
    name: "solver: con le soluzioni limitate a 2 trova comunque soluzioni vere del caso di riferimento",
    fn: () => {
      for (let seed = 100; seed < 130; seed++) {
        const puzzle = randomPuzzle(seed);
        const all = new Set(referenceSolutions(puzzle));
        for (const sol of solvePuzzle(puzzle, { maxSolutions: 2 })) assert(all.has(keyOf(sol)), `caso ${seed}: soluzione non valida`);
      }
    },
  },
  {
    name: "propagate: il calcolo incrementale dà esattamente lo stesso risultato di quello completo (con meno valutazioni)",
    fn: () => {
      let contradictions = 0;
      let forced = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const puzzle = randomPuzzle(seed, { maxClues: 6 });
        const random = rng(seed * 31);
        const { rows, cols } = puzzle.grid.size;
        // a few characters already confirmed, at random cells (possibly inconsistent: both must agree anyway)
        const confirmed = new Map();
        for (const c of puzzle.characters)
          if (random() < 0.3) confirmed.set(c.id, { row: Math.floor(random() * rows), col: Math.floor(random() * cols) });
        const plain = (incremental) => {
          const r = propagate(puzzle, confirmed, { incremental, maxEvaluations: Infinity, maxRounds: 50 });
          return JSON.stringify({
            confirmed: [...r.confirmed],
            forced: r.forced,
            eliminated: r.eliminated,
            domains: [...r.domains],
            contradiction: r.contradiction,
          });
        };
        assert(
          propagate(puzzle, confirmed, { incremental: true, maxEvaluations: Infinity }).evaluationsUsed <=
            propagate(puzzle, confirmed, { incremental: false, maxEvaluations: Infinity }).evaluationsUsed + puzzle.clues.length * 20,
          `caso ${seed}: le valutazioni incrementali non possono superare quelle complete`
        );
        const full = plain(false);
        assertEqual(plain(true), full, `caso ${seed}: propagate incrementale diverso dal completo`);
        const parsed = JSON.parse(full);
        if (parsed.contradiction) contradictions++;
        if (parsed.forced.length) forced++;
      }
      assert(contradictions >= 5 && forced >= 5, `serve un mix di esiti (${contradictions} contraddizioni, ${forced} forzati)`);
    },
  },
  {
    name: "propagate in modalità solo-contraddizione (controllo in avanti): stessa contraddizione di quello normale, con meno valutazioni (300 casi casuali)",
    fn: () => {
      let contradictions = 0;
      let consistent = 0;
      let saved = 0;
      let total = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const puzzle = randomPuzzle(seed, { maxClues: 8 });
        const random = rng(seed * 17);
        const { rows, cols } = puzzle.grid.size;
        const confirmed = new Map();
        for (const c of puzzle.characters)
          if (random() < 0.3) confirmed.set(c.id, { row: Math.floor(random() * rows), col: Math.floor(random() * cols) });
        const big = { maxEvaluations: Infinity, maxRounds: 50, maxSubsetOps: Infinity };
        const normal = propagate(puzzle, confirmed, big);
        // what the solver hands over: the cells each character can take judged alone
        const cells = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isOccupiable(puzzle.grid, r, c)) cells.push({ row: r, col: c });
        const unary = unaryDomains(puzzle, puzzle.characters, buildPredicates(puzzle), cells);
        for (const startDomains of [null, unary]) {
          const fast = propagate(puzzle, confirmed, { ...big, contradictionOnly: true, startDomains });
          assertEqual(
            JSON.stringify(fast.contradiction),
            JSON.stringify(normal.contradiction),
            `caso ${seed}${startDomains ? " (con domini unari)" : ""}: la modalità solo-contraddizione dà un verdetto diverso`
          );
          assert(
            fast.evaluationsUsed <= normal.evaluationsUsed,
            `caso ${seed}: la modalità solo-contraddizione non può usare più valutazioni`
          );
          saved += normal.evaluationsUsed - fast.evaluationsUsed;
          total += normal.evaluationsUsed;
        }
        if (normal.contradiction) contradictions++;
        else consistent++;
      }
      assert(contradictions >= 20 && consistent >= 20, `serve un mix di esiti (${contradictions} contraddizioni, ${consistent} no)`);
      assert(saved > 0.15 * total, `deve risparmiare valutazioni (${saved} su ${total})`);
    },
  },
];
