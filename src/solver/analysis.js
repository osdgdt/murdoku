// A quick look at a case as it stands, for the editor's live difficulty preview: how many solutions the clues
// leave, how much the solver had to search to settle it, and how much plain deduction already pins down.
// With node, work or time limits (the page gives none: it shows a bar and Cancel instead): when a limit ends it the
// status is "limit", never a guess about the number of solutions.
import { propagate } from "./propagation.js";
import { checkUniqueness } from "./validator.js";
import { humanSolve } from "./techniques/engine.js";
import { monotonic } from "./progress.js";

// status: "contradiction" (the clues cannot all hold: propagation alone shows it), "none" (searched to the end, no
// solution), "unique", "ambiguous" (two or more found), "limit" (stopped by a limit before the answer was known).
// `onProgress(fraction)`: how far the search has got (solver.js), for the bar of a long analysis.
export function analyzePuzzle(
  puzzle,
  {
    maxNodes = Infinity,
    maxWork = Infinity,
    timeMs = null,
    forwardCheckMinRemaining = 0,
    onProgress = null,
    progressIntervalMs,
    // the work given to the human solver, which says which reasonings a unique case needs (only run for a unique case)
    humanMaxWork = HUMAN_MAX_WORK,
  } = {}
) {
  const total = puzzle.characters.length;
  const propagation = propagate(puzzle, new Map());
  const forced = propagation.forced.length;
  if (propagation.contradiction) return { status: "contradiction", solutionCount: 0, nodes: 0, forced, total, stoppedBy: null };
  // the bar: the search for solutions is the first 60 %, the human solver the rest
  const heard = monotonic(onProgress);
  const report = checkUniqueness(puzzle, {
    maxSolutions: 2,
    maxNodes,
    maxWork,
    timeMs,
    forwardCheck: true,
    forwardCheckMinRemaining,
    onProgress: heard ? (fraction) => heard(0.6 * fraction) : null,
    progressIntervalMs,
  });
  let status = "none";
  if (report.solutionCount >= 2) status = "ambiguous";
  else if (!report.exhausted) status = "limit";
  else if (report.solutionCount === 1) status = "unique";
  const result = { status, solutionCount: report.solutionCount, nodes: report.nodesVisited, forced, total, stoppedBy: report.stoppedBy };
  if (status === "unique") {
    const human = humanSolve(puzzle, { maxWork: humanMaxWork, onProgress: heard ? (fraction) => heard(0.6 + 0.4 * fraction) : null });
    result.human = summarizeHuman(human);
  }
  return result;
}

// Work the human solver may spend on the live preview (it ends sooner for nearly every case; a rare, very hard one gives up
// and the line falls back on the rough estimate).
export const HUMAN_MAX_WORK = 30_000_000;

// What the page needs of the human solver's answer: the level, the hardest reasoning, how many steps used each reasoning
// and at which step each was first used (small, so it travels from the worker cheaply).
function summarizeHuman(human) {
  const firstStep = {};
  human.steps.forEach((step, i) => {
    if (!(step.technique in firstStep)) firstStep[step.technique] = i + 1;
  });
  return { status: human.status, level: human.level, hardest: human.hardest, counts: human.counts, firstStep, steps: human.steps.length };
}
