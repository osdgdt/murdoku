// Author aid: which clues are individually redundant — i.e. the case stays
// uniquely solvable even without them. Removing ONE of these is always safe;
// removing several at once is not (two clues can each be redundant only
// because the other is there), so the editor re-checks after every removal.
//
// `checkUnique(puzzle)` is injected (sync checkUniqueness in tests, the
// Worker-backed async one in the editor) and must resolve to the usual
// { solutionCount, truncated } report.
import { clonePuzzle } from "../model/puzzle.js";
import { monotonic } from "./progress.js";

// Among clues found redundant (`redundantIds`), the ones the SUSPECTS still need:
// in a case built the usual way (no clue about the victim, suspects solved on
// their own, she takes the last cell) a clue can look superfluous only because
// the base rule "the victim shares a room with exactly one person" helps.
// Returns [] when the case is not built that way (a clue concerns the victim, or
// the suspects alone are not uniquely determined) — then there is nothing to say.
// `onProgress(fraction)` (optional): the suspects-only check first, then one per clue; each is handed `onProgress` too.
export async function findCluesNeededWithoutVictim(puzzle, redundantIds, checkUnique, { onProgress } = {}) {
  const victim = puzzle.characters.find((c) => c.isVictim);
  if (!victim || redundantIds.length === 0) return [];
  if (puzzle.clues.some((c) => c.characterId === victim.id || JSON.stringify(c.params ?? {}).includes(victim.id))) return [];
  const suspectsOnly = clonePuzzle(puzzle);
  suspectsOnly.characters = suspectsOnly.characters.filter((c) => !c.isVictim);
  const steps = redundantIds.length + 1;
  const bar = monotonic(onProgress);
  // the way into step `index` (0-based) plus how far that step's own search has got
  const within = (index) => (bar ? { onProgress: (fraction) => bar((index + fraction) / steps) } : undefined);
  const alone = await checkUnique(suspectsOnly, within(0));
  bar?.(1 / steps);
  if (alone.solutionCount !== 1 || alone.truncated) return [];
  const needed = [];
  for (const [index, id] of redundantIds.entries()) {
    const without = clonePuzzle(suspectsOnly);
    without.clues = suspectsOnly.clues.filter((c) => c.id !== id);
    const report = await checkUnique(without, within(index + 1));
    bar?.((index + 2) / steps);
    if (report.solutionCount !== 1 || report.truncated) needed.push(id);
  }
  return needed;
}

// The check without each clue is a search of its own, and the ones that matter most (a clue that IS redundant leaves
// the case unique, so the search has to run to its end) are the slow ones. They do not depend on each other, so with
// `concurrency` > 1 that many run at once, each in its own "lane" (`checkUnique(candidate, { lane })`: the caller maps a
// lane to a worker). The result does not depend on the order they finish in. If one check fails (a Cancel, a crashed
// worker) no further one is started and the failure is passed on.
//
// `onProgress(done, total, fraction)`: `done` of the `total` clue checks are over; `fraction` (0..1, never going back) also
// counts the check of the whole case that comes first and how far each check in progress has got, so the bar moves
// while one long check runs. `checkUnique` is then given `onProgress(fraction)` in its second argument, for its own search.
export async function findRedundantClues(puzzle, checkUnique, { onProgress, concurrency = 1 } = {}) {
  const total = puzzle.clues.length;
  const laneFractions = new Map(); // lane -> how far its check has got
  let baselineShare = 0;
  let finished = 0;
  const bar = onProgress ? monotonic((fraction) => onProgress(finished, total, fraction)) : null;
  const report = () => {
    let running = 0;
    for (const fraction of laneFractions.values()) running += fraction;
    bar?.((baselineShare + finished + running) / (total + 1));
  };
  report();
  const baseline = await checkUnique(
    puzzle,
    bar
      ? {
          onProgress: (fraction) => {
            baselineShare = fraction;
            report();
          },
        }
      : undefined
  );
  baselineShare = 1;
  report();
  if (baseline.solutionCount !== 1 || baseline.truncated) {
    // a limit (not the search's own end) means "could not tell", never "no solution"/"not unique"
    if (baseline.exhausted === false && baseline.solutionCount < 2) return { ok: false, reason: "limit", redundant: [] };
    return { ok: false, reason: baseline.solutionCount === 0 ? "unsolvable" : "not-unique", redundant: [] };
  }
  const reports = new Array(total);
  let next = 0;
  let failed = false;
  const runLane = async (lane) => {
    while (!failed && next < total) {
      const i = next++;
      const without = clonePuzzle(puzzle);
      without.clues = puzzle.clues.filter((_, index) => index !== i);
      laneFractions.set(lane, 0);
      try {
        reports[i] = await checkUnique(without, {
          lane,
          onProgress: bar
            ? (fraction) => {
                laneFractions.set(lane, fraction);
                report();
              }
            : undefined,
        });
      } catch (error) {
        failed = true;
        throw error;
      }
      laneFractions.delete(lane);
      finished++;
      report();
    }
  };
  const lanes = Math.max(1, Math.min(Math.floor(concurrency) || 1, total));
  await Promise.all(Array.from({ length: lanes }, (_, lane) => runLane(lane)));
  const redundant = [];
  let unchecked = 0; // clues whose check hit a limit: kept (not reported redundant), but not proven needed
  reports.forEach((result, i) => {
    if (result.solutionCount === 1 && !result.truncated) redundant.push(puzzle.clues[i].id);
    else if (result.exhausted === false && result.solutionCount < 2) unchecked++;
  });
  bar?.(1);
  return { ok: true, redundant, unchecked };
}
