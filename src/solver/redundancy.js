// Author aid: which clues are individually redundant — i.e. the case stays
// uniquely solvable even without them. Removing ONE of these is always safe;
// removing several at once is not (two clues can each be redundant only
// because the other is there), so the editor re-checks after every removal.
//
// `checkUnique(puzzle)` is injected (sync checkUniqueness in tests, the
// Worker-backed async one in the editor) and must resolve to the usual
// { solutionCount, truncated } report.
import { clonePuzzle } from "../model/puzzle.js";

// Among clues found redundant (`redundantIds`), the ones the SUSPECTS still need:
// in a case built the usual way (no clue about the victim, suspects solved on
// their own, she takes the last cell) a clue can look superfluous only because
// the base rule "the victim shares a room with exactly one person" helps.
// Returns [] when the case is not built that way (a clue concerns the victim, or
// the suspects alone are not uniquely determined) — then there is nothing to say.
export async function findCluesNeededWithoutVictim(puzzle, redundantIds, checkUnique) {
  const victim = puzzle.characters.find((c) => c.isVictim);
  if (!victim || redundantIds.length === 0) return [];
  if (puzzle.clues.some((c) => c.characterId === victim.id || JSON.stringify(c.params ?? {}).includes(victim.id))) return [];
  const suspectsOnly = clonePuzzle(puzzle);
  suspectsOnly.characters = suspectsOnly.characters.filter((c) => !c.isVictim);
  const alone = await checkUnique(suspectsOnly);
  if (alone.solutionCount !== 1 || alone.truncated) return [];
  const needed = [];
  for (const id of redundantIds) {
    const without = clonePuzzle(suspectsOnly);
    without.clues = suspectsOnly.clues.filter((c) => c.id !== id);
    const report = await checkUnique(without);
    if (report.solutionCount !== 1 || report.truncated) needed.push(id);
  }
  return needed;
}

export async function findRedundantClues(puzzle, checkUnique, { onProgress } = {}) {
  const baseline = await checkUnique(puzzle);
  if (baseline.solutionCount !== 1 || baseline.truncated) {
    // a limit (not the search's own end) means "could not tell", never "no solution"/"not unique"
    if (baseline.exhausted === false && baseline.solutionCount < 2) return { ok: false, reason: "limit", redundant: [] };
    return { ok: false, reason: baseline.solutionCount === 0 ? "unsolvable" : "not-unique", redundant: [] };
  }
  const redundant = [];
  let unchecked = 0; // clues whose check hit a limit: kept (not reported redundant), but not proven needed
  for (let i = 0; i < puzzle.clues.length; i++) {
    onProgress?.(i, puzzle.clues.length);
    const without = clonePuzzle(puzzle);
    without.clues = puzzle.clues.filter((_, index) => index !== i);
    const report = await checkUnique(without);
    if (report.solutionCount === 1 && !report.truncated) redundant.push(puzzle.clues[i].id);
    else if (report.exhausted === false && report.solutionCount < 2) unchecked++;
  }
  onProgress?.(puzzle.clues.length, puzzle.clues.length);
  return { ok: true, redundant, unchecked };
}
