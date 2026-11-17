// A quick look at a case as it stands, for the editor's live difficulty preview: how many solutions the clues
// leave, how much the solver had to search to settle it, and how much plain deduction already pins down.
// Bounded by node and time limits like every solver call: when a limit ends it the status is "limit", never a
// guess about the number of solutions.
import { propagate } from "./propagation.js";
import { checkUniqueness } from "./validator.js";

// status: "contradiction" (the clues cannot all hold: propagation alone shows it), "none" (searched to the end, no
// solution), "unique", "ambiguous" (two or more found), "limit" (stopped by a limit before the answer was known).
export function analyzePuzzle(puzzle, { maxNodes = Infinity, maxWork = Infinity, timeMs = null, forwardCheckMinRemaining = 0 } = {}) {
  const total = puzzle.characters.length;
  const propagation = propagate(puzzle, new Map());
  const forced = propagation.forced.length;
  if (propagation.contradiction) return { status: "contradiction", solutionCount: 0, nodes: 0, forced, total, stoppedBy: null };
  const report = checkUniqueness(puzzle, { maxSolutions: 2, maxNodes, maxWork, timeMs, forwardCheck: true, forwardCheckMinRemaining });
  let status = "none";
  if (report.solutionCount >= 2) status = "ambiguous";
  else if (!report.exhausted) status = "limit";
  else if (report.solutionCount === 1) status = "unique";
  return { status, solutionCount: report.solutionCount, nodes: report.nodesVisited, forced, total, stoppedBy: report.stoppedBy };
}
