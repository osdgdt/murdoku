import { createPuzzle, addCharacter } from "../src/model/puzzle.js";
import { resizeGrid } from "../src/model/grid.js";
import { solvePuzzle } from "../src/solver/solver.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { limitsFor, sizeFactor, searchBudget, SETTLE_MIN_REMAINING } from "../src/solver/limits.js";
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
    name: "checkUniqueness: un tetto sul lavoro dà stoppedBy='work', è deterministico e non dipende dai nodi",
    fn: () => {
      const run = () => checkUniqueness(open(6, 5), { maxSolutions: 1_000_000, maxWork: 20_000, forwardCheck: true });
      const a = run();
      assertEqual(a.exhausted, false);
      assertEqual(a.stoppedBy, "work");
      assertEqual(a.unique, false, "mai «unica» se la ricerca è stata fermata da un limite");
      assert(
        a.evaluations + 3 * a.nodesVisited >= 20_000 && a.evaluations + 3 * a.nodesVisited < 20_000 + 20_000,
        "si ferma poco oltre il tetto"
      );
      const b = run();
      assertEqual(b.nodesVisited, a.nodesVisited, "stessi nodi a ogni esecuzione");
      assertEqual(b.evaluations, a.evaluations, "stesso lavoro a ogni esecuzione");
      const free = checkUniqueness(open(4, 3), { maxSolutions: 1000, maxWork: 1e12 });
      assertEqual(free.exhausted, true, "un tetto ampio non ferma nulla");
    },
  },
  {
    name: "searchBudget: passa al solutore tetti, tempo e strategia; la verifica di unicità può dividersi tra worker, i tanti controlli degli indizi superflui no",
    fn: () => {
      const budget = searchBudget(limitsFor(open(9, 2)).uniqueness);
      assertEqual(Object.keys(budget).sort().join(), "forwardCheckMinRemaining,maxNodes,maxWork,parallel,timeMs");
      assertEqual(budget.parallel, true, "la verifica di unicità può dividersi tra più worker");
      assertEqual(
        searchBudget(limitsFor(open(9, 2)).redundancy).parallel,
        undefined,
        "i tanti piccoli controlli degli indizi superflui no: lì il parallelismo è tra un indizio e l'altro"
      );
    },
  },
  {
    name: "limiti: le azioni con barra e Annulla non hanno nessun tetto, a qualunque dimensione; la strategia di chiusura resta",
    fn: () => {
      for (const n of [3, 9, 12, 16]) {
        const limits = limitsFor(open(n, 2));
        for (const key of ["uniqueness", "redundancy", "confirm", "derive"]) {
          const budget = searchBudget(limits[key]);
          assertEqual(budget.maxWork, Infinity, `${n}x${n} ${key}: nessun tetto di lavoro`);
          assertEqual(budget.maxNodes, Infinity, `${n}x${n} ${key}: nessun tetto di nodi`);
          assertEqual(budget.timeMs, null, `${n}x${n} ${key}: nessun tempo massimo`);
          assertEqual(budget.forwardCheckMinRemaining, SETTLE_MIN_REMAINING, `${n}x${n} ${key}: strategia di chiusura`);
        }
      }
      // and it really never stops by itself: a search that a tiny limit would cut runs to its end
      const puzzle = open(5, 3);
      const free = checkUniqueness(puzzle, { ...searchBudget(limitsFor(puzzle).uniqueness), maxSolutions: 1_000_000 });
      assertEqual(free.exhausted, true);
      assertEqual(free.stoppedBy, null);
      assertEqual(free.solutionCount, 25 * 16 * 9, "tutte le soluzioni, nessuna fermata");
    },
  },
  {
    name: "limiti: il lavoro che parte da solo, senza nessuno che prema Annulla (anteprima dal vivo, editor campagne, suggerimenti di default), resta limitato e cresce con la griglia",
    fn: () => {
      const nine = limitsFor(open(9, 2));
      const big = limitsFor(open(16, 2));
      assertEqual(sizeFactor(open(3, 2)), 1);
      assertEqual(sizeFactor(open(9, 2)), 1);
      assert(Math.abs(sizeFactor(open(16, 2)) - (16 / 9) ** 2) < 1e-9);
      assertEqual(nine.preview.maxWork, 60_000_000);
      assertEqual(nine.preview.timeMs, 4_000);
      assertEqual(nine.campaign.maxWork, 1_000_000_000);
      assertEqual(nine.campaign.timeMs, 60_000);
      assertEqual(nine.hints.maxNodes, 2_000_000, "i suggerimenti di default restano a nodi");
      assertEqual(nine.hints.timeMs, 8_000);
      assert(nine.hints.maxWork === undefined && nine.hints.forwardCheckMinRemaining === undefined, "e con la loro strategia di sempre");
      for (const [key, field] of [
        ["preview", "maxWork"],
        ["campaign", "maxWork"],
        ["campaign", "timeMs"],
        ["hints", "maxNodes"],
        ["hints", "timeMs"],
      ])
        assert(Number.isFinite(big[key][field]) && big[key][field] > nine[key][field], `${key}.${field}: 16x16 deve avere più margine`);
      for (const key of ["preview", "campaign"])
        assert(Number.isFinite(nine[key].maxWork) && Number.isFinite(nine[key].timeMs), `${key} limitato`);
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
