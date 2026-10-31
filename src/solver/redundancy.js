// Author aid: which clues are individually redundant — i.e. the case stays
// uniquely solvable even without them. Removing ONE of these is always safe;
// removing several at once is not (two clues can each be redundant only
// because the other is there), so the editor re-checks after every removal.
//
// `checkUnique(puzzle)` is injected (sync checkUniqueness in tests, the
// Worker-backed async one in the editor) and must resolve to the usual
// { solutionCount, truncated } report.
import { clonePuzzle } from "../model/puzzle.js";

export async function findRedundantClues(puzzle, checkUnique, { onProgress } = {}) {
  const baseline = await checkUnique(puzzle);
  if (baseline.solutionCount !== 1 || baseline.truncated) {
    return { ok: false, reason: baseline.solutionCount === 0 ? "unsolvable" : "not-unique", redundant: [] };
  }
  const redundant = [];
  for (let i = 0; i < puzzle.clues.length; i++) {
    onProgress?.(i, puzzle.clues.length);
    const without = clonePuzzle(puzzle);
    without.clues = puzzle.clues.filter((_, index) => index !== i);
    const report = await checkUnique(without);
    if (report.solutionCount === 1 && !report.truncated) redundant.push(puzzle.clues[i].id);
  }
  onProgress?.(puzzle.clues.length, puzzle.clues.length);
  return { ok: true, redundant };
}
