// A guard against the solver getting slower on big grids, without depending on the machine: a few of the
// fixed benchmark cases (test/bench/lib.mjs, the same ones `npm run bench` measures) must still be settled
// — two solutions found, so the search ends by itself — within a node budget set from the measured baseline
// (test/bench/baseline.json). Node counts do not depend on the machine, so this can fail only if a change
// makes the SEARCH worse (a weaker pruning, a lost optimisation); time is left to `npm run bench`.
import { benchCase, measure } from "./bench/lib.mjs";
import { assert, assertEqual } from "./assert.js";

// [size, seed, nodes in the baseline]
const CASES = [
  [10, 1, 13],
  [10, 3, 190],
  [10, 5, 508],
  [12, 3, 58],
  [12, 4, 24],
];

export const tests = CASES.map(([n, seed, baselineNodes]) => ({
  name: `benchmark ${n}x${n} (caso ${seed}): il solutore chiude la ricerca entro ${Math.max(100, baselineNodes * 3)} nodi (baseline ${baselineNodes})`,
  fn: () => {
    const puzzle = benchCase(n, seed);
    assert(puzzle, "il caso deve esistere");
    const budget = Math.max(100, baselineNodes * 3);
    const result = measure(puzzle, { maxNodes: budget });
    assertEqual(result.capped, false, `limite di ${budget} nodi raggiunto: la ricerca è peggiorata (baseline ${baselineNodes} nodi)`);
    assertEqual(result.solutions, 2);
  },
}));
