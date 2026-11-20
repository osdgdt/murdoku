// A guard against the solver getting slower on big grids, without depending on the machine: a few of the
// fixed benchmark cases (test/bench/lib.mjs, the same ones `npm run bench` measures) must still be settled
// — two solutions found, so the search ends by itself — within a WORK budget set from the baseline
// (test/bench/baseline.json). Work is clue evaluations plus a charge per node: it does not depend on the machine
// and, unlike the node count, stays comparable when the search strategy changes. So this can fail only if a
// change makes the SEARCH worse (a weaker pruning, a lost optimisation); time is left to `npm run bench`.
import { benchCase, measure } from "./bench/lib.mjs";
import { SETTLE_MIN_REMAINING } from "../src/solver/limits.js";
import { humanSolve } from "../src/solver/techniques/engine.js";
import { readRepoFile } from "./helpers/read-file.js";
import { assert, assertEqual } from "./assert.js";

// [size, seed]: small cases, settled in well under a second
const CASES = [
  [10, 1],
  [10, 3],
  [10, 5],
  [12, 3],
  [12, 4],
];
const FACTOR = 3;

const searchTests = CASES.map(([n, seed]) => ({
  name: `benchmark ${n}x${n} (caso ${seed}): il solutore chiude la ricerca entro ${FACTOR} volte il lavoro della baseline`,
  fn: async () => {
    const baseline = JSON.parse(await readRepoFile("test/bench/baseline.json"));
    const before = baseline.cases.find((c) => c.n === n && c.seed === seed);
    assert(before && !before.capped, "il caso deve essere chiuso nella baseline");
    const puzzle = benchCase(n, seed);
    assert(puzzle, "il caso deve esistere");
    const result = measure(puzzle, { maxNodes: Infinity, maxWork: 50_000_000, forwardCheckMinRemaining: SETTLE_MIN_REMAINING });
    assertEqual(result.capped, false, "il caso deve chiudersi");
    assertEqual(result.solutions, 2);
    const budget = Math.max(50000, before.work * FACTOR);
    assert(result.work <= budget, `lavoro ${result.work} oltre ${budget} (baseline ${before.work}): la ricerca è peggiorata`);
  },
}));

// The human solver (src/solver/techniques): the fixture cases keep the level, the hardest reasoning and (within a factor) the
// work of the baseline; `npm run bench` also measures the heavy editor case.
export const humanTests = ["faro.en", "monastero.en", "tutorial.en", "tutorial.it"].map((name) => ({
  name: `benchmark del solver umano (${name}): stesso livello, stesso ragionamento più difficile, lavoro entro ${FACTOR} volte la baseline`,
  fn: async () => {
    const baseline = JSON.parse(await readRepoFile("test/bench/baseline.json"));
    const before = baseline.humanCases.find((c) => c.file === `${name}.murdoku.json`);
    assert(before, "il caso deve essere nella baseline");
    const result = humanSolve(JSON.parse(await readRepoFile(`test/fixtures/${name}.murdoku.json`)));
    assertEqual(result.status, before.status);
    assertEqual(result.level, before.level, "il livello è cambiato: se è voluto, aggiorna la baseline (npm run bench -- --update)");
    assertEqual(result.hardest, before.hardest);
    assert(result.work <= Math.max(2000, before.work * FACTOR), `lavoro ${result.work} oltre la baseline ${before.work}`);
  },
}));

export const tests = [...searchTests, ...humanTests];
