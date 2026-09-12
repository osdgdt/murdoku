import { checkUniqueness } from "./validator.js";
import { propagate } from "./propagation.js";

// One-time budget (per puzzle load, not per hint click — see gameScreen.js's
// memoized getEffectiveSolution()). Larger than hints.js's HINT_MAX_NODES
// (2,000,000, shared across every wave of a single interactive hint click)
// since this only ever runs once per puzzle, but still bounded. This now
// runs in a Web Worker (src/solver/solverClient.js), so a slow search no
// longer freezes the page — but that's not a reason to raise this further:
// the worker is a single serialized queue (one Worker per page, not a
// pool), so a very long derive still blocks every OTHER solver-backed
// button on the same page behind it, and there's no cancellation path if an
// author just wants to give up and add more clues instead. A puzzle that
// needs more than 10M nodes to resolve is already deep into
// under-constrained territory, where more search time mostly just delays
// reaching the same "inconclusive" verdict.
export const DERIVE_SOLUTION_MAX_NODES = 10_000_000;

// Exhaustive, forward-checked search over the puzzle's CLUES ALONE — never
// reads puzzle.solution.placements, so a missing or wrong author-declared
// solution can never influence the result (same invariant already proven for
// computeHintChain/propagate; see the dedicated regression test in
// test-derive-solution.js).
//
// Runs one upfront propagate() pass first, using propagate()'s own generous
// default budgets (PROPAGATION_MAX_ROUNDS/EVALUATIONS/SUBSET_OPS — NOT the
// tighter FORWARD_CHECK_* ones used by per-search-node forward-checking,
// since this call happens once per puzzle load, off the main thread, not
// once per search node). Whatever it proves is seeded into the search below
// as `fixedPlacements`/`domains` instead of being rediscovered node by node,
// and a puzzle propagate() alone already proves contradictory is rejected
// immediately, at zero search-node cost. This can only make the search
// faster or shrink its residual — it can never change the OUTCOME:
// propagate()'s `contradiction` is only ever set once some character's
// candidate-cell domain has been proven empty by predicates that are
// contractually never allowed to reject a still-completable partial
// assignment, checked only against a COMPLETE, non-capped round — never
// because analysis merely ran out of budget (see propagation.js's
// `if (capped) break;`, which discards a capped round's own domains before
// that check ever runs). So an upfront contradiction here is exactly as
// trustworthy as one the backtracking search would eventually have found on
// its own, just found without paying for the search.
//
// Returns exactly one of:
//   "unique"        exactly one solution, proved exhaustively
//                     -> { status: "unique", placements: [{characterId,row,col}, ...] }
//   "unsatisfiable" zero solutions, proved exhaustively — whether by the
//                     upfront propagate() pass alone or by the exhaustive
//                     search that follows it
//                     -> { status: "unsatisfiable", placements: null }
//   "ambiguous"     2+ solutions actually found — on its own a complete
//                     proof of non-uniqueness, whether or not the search was
//                     then capped before looking for still more of them
//                     -> { status: "ambiguous", placements: null }
//   "inconclusive"  the node budget ran out before proving EITHER "zero" or
//                     "exactly one" — genuinely unknown; must never be
//                     treated as solved or as unsolvable
//                     -> { status: "inconclusive", placements: null }
export function deriveSolution(puzzle, { maxNodes = DERIVE_SOLUTION_MAX_NODES } = {}) {
  const prop = propagate(puzzle, new Map());
  if (prop.contradiction) {
    return { status: "unsatisfiable", placements: null };
  }

  const report = checkUniqueness(puzzle, {
    maxSolutions: 2,
    maxNodes,
    forwardCheck: true,
    fixedPlacements: prop.confirmed,
    domains: prop.domains,
  });
  if (report.solutionCount >= 2) {
    return { status: "ambiguous", placements: null };
  }
  if (report.solutionCount === 1) {
    return report.truncated
      ? { status: "inconclusive", placements: null }
      : { status: "unique", placements: report.solutions[0] };
  }
  return report.truncated
    ? { status: "inconclusive", placements: null }
    : { status: "unsatisfiable", placements: null };
}
