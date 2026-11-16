import { createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { resizeGrid } from "../src/model/grid.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { limitsFor, sizeFactor } from "../src/solver/limits.js";
import { createBudget } from "../src/solver/hintBudget.js";
import { findRedundantClues } from "../src/solver/redundancy.js";
import { checkUniquenessAsync, SolverCancelled } from "../src/solver/solverClient.js";
import { assert, assertEqual } from "./assert.js";

// n x n, `people` characters, no clues and no victim: a very large number of solutions (a search
// that never ends on its own within a small budget).
function open(n, people) {
  const puzzle = createPuzzle(`open ${n}`);
  puzzle.grid = resizeGrid(puzzle.grid, n, n);
  for (let i = 0; i < people; i++) addCharacter(puzzle, `P${i}`);
  return puzzle;
}

export const tests = [
  {
    name: "solver: una scadenza già passata ferma la ricerca e lo dice (timedOut), senza prendersela per un tetto di nodi",
    fn: () => {
      const stats = {};
      solvePuzzle(open(6, 5), { maxSolutions: 1_000_000, deadline: -1, stats });
      assertEqual(stats.timedOut, true);
      assertEqual(stats.nodeCapHit, false);
      assert(stats.nodesVisited < 1000, `si doveva fermare subito, non dopo ${stats.nodesVisited} nodi`);
    },
  },
  {
    name: "solver: shouldStop() ferma la ricerca (annullamento cooperativo)",
    fn: () => {
      const stats = {};
      solvePuzzle(open(6, 5), { maxSolutions: 1_000_000, shouldStop: () => true, stats });
      assertEqual(stats.timedOut, true);
    },
  },
  {
    name: "solver: senza limiti la ricerca finisce da sola e non segnala né tetto né scadenza",
    fn: () => {
      const stats = {};
      const solutions = solvePuzzle(open(3, 2), { maxSolutions: 1000, stats });
      assertEqual(solutions.length, 36, "3x3, due personaggi, righe e colonne distinte: 9 x 4 = 36");
      assertEqual(stats.timedOut, false);
      assertEqual(stats.nodeCapHit, false);
    },
  },
  {
    name: "checkUniqueness: un limite di tempo dà exhausted=false e stoppedBy='time': «nessuna soluzione» non è un verdetto",
    fn: () => {
      const report = checkUniqueness(open(6, 5), { maxSolutions: 1_000_000, timeMs: 0 });
      assertEqual(report.exhausted, false);
      assertEqual(report.stoppedBy, "time");
      assertEqual(report.truncated, true);
      assertEqual(report.unique, false, "mai «unica» se la ricerca è stata fermata da un limite");
    },
  },
  {
    name: "checkUniqueness: un tetto di nodi dà stoppedBy='nodes'; una ricerca completa dà exhausted=true",
    fn: () => {
      const capped = checkUniqueness(open(6, 5), { maxSolutions: 1_000_000, maxNodes: 50 });
      assertEqual(capped.exhausted, false);
      assertEqual(capped.stoppedBy, "nodes");
      const whole = checkUniqueness(open(3, 2), { maxSolutions: 1000 });
      assertEqual(whole.exhausted, true);
      assertEqual(whole.stoppedBy, null);
      assertEqual(whole.solutionCount, 36);
    },
  },
  {
    name: "limiti: uguali fino a 9x9, crescono con la griglia (16x16 ~ 3,2 volte)",
    fn: () => {
      assertEqual(sizeFactor(open(3, 2)), 1);
      assertEqual(sizeFactor(open(9, 2)), 1);
      const nine = limitsFor(open(9, 2));
      assertEqual(nine.uniqueness.maxNodes, 600_000);
      assertEqual(nine.uniqueness.timeMs, 30_000);
      assertEqual(nine.redundancy.maxNodes, 200_000, "gli altri numeri restano quelli di sempre");
      const big = limitsFor(open(16, 2));
      assert(Math.abs(sizeFactor(open(16, 2)) - (16 / 9) ** 2) < 1e-9);
      for (const key of Object.keys(nine)) {
        assert(big[key].maxNodes > nine[key].maxNodes && big[key].timeMs > nine[key].timeMs, `${key}: 16x16 deve avere più margine`);
      }
    },
  },
  {
    name: "suggerimenti: il budget di tempo cresce con la griglia e fissa la scadenza della ricerca",
    fn: () => {
      const small = createBudget(open(9, 2));
      const big = createBudget(open(16, 2));
      assert(big.deadline - small.deadline > 5000, "16x16 ha più tempo di 9x9");
      assert(Number.isFinite(small.deadline));
      assertEqual(createBudget().waveNodesRemaining, 2_000_000, "senza puzzle, i numeri di sempre");
    },
  },
  {
    name: "indizi superflui: se il controllo di base si ferma per un limite, il motivo è «limit», non «non unico»",
    fn: async () => {
      const puzzle = open(4, 2);
      puzzle.clues = [];
      const gaveUp = await findRedundantClues(puzzle, async () => ({ solutionCount: 0, truncated: true, exhausted: false }));
      assertEqual(gaveUp.ok, false);
      assertEqual(gaveUp.reason, "limit");
      const unsolvable = await findRedundantClues(puzzle, async () => ({ solutionCount: 0, truncated: false, exhausted: true }));
      assertEqual(unsolvable.reason, "unsolvable");
    },
  },
  {
    name: "indizi superflui: i controlli fermati da un limite sono contati a parte e non spacciati per «necessari»",
    fn: async () => {
      const puzzle = open(4, 2);
      puzzle.clues = [{ id: "a" }, { id: "b" }];
      let call = 0;
      const result = await findRedundantClues(puzzle, async () => {
        call++;
        if (call === 1) return { solutionCount: 1, truncated: false, exhausted: true }; // baseline
        if (call === 2) return { solutionCount: 1, truncated: false, exhausted: true }; // senza «a»: superfluo
        return { solutionCount: 0, truncated: true, exhausted: false }; // senza «b»: limite
      });
      assertEqual(result.ok, true);
      assertEqual(result.redundant.join(","), "a");
      assertEqual(result.unchecked, 1);
    },
  },
  {
    name: "solverClient: un segnale già annullato rifiuta subito con AbortError",
    fn: async () => {
      const controller = new AbortController();
      controller.abort();
      let error = null;
      try {
        await checkUniquenessAsync(open(3, 2), {}, { signal: controller.signal });
      } catch (err) {
        error = err;
      }
      assert(error instanceof SolverCancelled && error.name === "AbortError", "doveva rifiutare con SolverCancelled");
    },
  },
  {
    name: "solverClient: annullare una chiamata in corso la rifiuta con AbortError, e la chiamata dopo funziona",
    fn: async () => {
      const controller = new AbortController();
      const pending = checkUniquenessAsync(open(3, 2), { maxSolutions: 1000 }, { signal: controller.signal });
      controller.abort();
      let error = null;
      try {
        await pending;
      } catch (err) {
        error = err;
      }
      assert(error && error.name === "AbortError", "la chiamata annullata doveva rifiutare con AbortError");
      const next = await checkUniquenessAsync(open(3, 2), { maxSolutions: 1000 });
      assertEqual(next.solutionCount, 36, "dopo un annullamento si riparte con un worker nuovo");
    },
  },
];
