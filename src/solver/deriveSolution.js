import { checkUniqueness } from "./validator.js";

// One-time budget (per puzzle load, not per hint click — see gameScreen.js's
// memoized getEffectiveSolution()). Larger than hints.js's HINT_MAX_NODES
// (2,000,000, shared across every wave of a single interactive hint click)
// since this only ever runs once per puzzle, but still bounded: if it ever
// proves insufficient in practice, moving this search to a Web Worker (as
// already flagged as a future option in hints.js) is the right next step,
// not raising this cap further.
export const DERIVE_SOLUTION_MAX_NODES = 10_000_000;

// Exhaustive, forward-checked search over the puzzle's CLUES ALONE — never
// reads puzzle.solution.placements, so a missing or wrong author-declared
// solution can never influence the result (same invariant already proven for
// computeHintChain/propagate; see the dedicated regression test in
// test-derive-solution.js). Returns exactly one of:
//   "unique"        exactly one solution, proved exhaustively
//                     -> { status: "unique", placements: [{characterId,row,col}, ...] }
//   "unsatisfiable" zero solutions, proved exhaustively
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
  const report = checkUniqueness(puzzle, { maxSolutions: 2, maxNodes, forwardCheck: true });
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
