import { buildPredicates } from "./predicates/index.js";
import { describeClue } from "../model/clueTypes.js";
import { solvePuzzle } from "./solver.js";
import { t } from "../i18n/i18n.js";

function placementsToMap(placements) {
  const map = new Map();
  for (const p of placements) map.set(p.characterId, { row: p.row, col: p.col });
  return map;
}

function hasRowColConflict(placements) {
  const rows = new Set();
  const cols = new Set();
  for (const p of placements) {
    if (rows.has(p.row) || cols.has(p.col)) return true;
    rows.add(p.row);
    cols.add(p.col);
  }
  return false;
}

// Checks the author's declared solution against row/col-distinctness and every clue.
export function validateSolution(puzzle) {
  const placements = puzzle.solution.placements;
  const violations = [];

  if (placements.length !== puzzle.characters.length) {
    violations.push({ clueId: null, characterId: null, message: t("Non tutti i personaggi hanno una posizione nella soluzione.") });
  }

  if (hasRowColConflict(placements)) {
    violations.push({ clueId: null, characterId: null, message: t("Due o più personaggi condividono riga o colonna.") });
  }

  const pm = placementsToMap(placements);
  const predicates = buildPredicates(puzzle);
  for (const { clue, predicate } of predicates) {
    const result = predicate(pm, true);
    if (result === false) {
      const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
      violations.push({
        clueId: clue.id,
        characterId: clue.characterId,
        message: t("{owner}: {clue}", { owner: owner ? owner.name : t("Indizio generale"), clue: describeClue(clue, puzzle) }),
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

// Runs the solver from scratch (ignoring the declared solution) to report uniqueness.
// `maxSolutions`/`maxNodes` are pass-throughs to solvePuzzle: the default cap of 2
// is the cheapest way to answer "is it unique?", but a caller that wants to show
// the actual alternative solutions (not just detect that some exist) can pass a
// higher `maxSolutions`. `truncated` tells them honestly whether `solutions`
// is the complete set or just however many were found before hitting a cap —
// never claim "these are all of them" when a cap, not exhaustion, ended the search.
// `forwardCheck` is an opt-in pass-through too (default false, matching
// solvePuzzle's own default) — existing callers (editorApp.js's "Verifica
// unicità"/"Stima difficoltà" buttons, and every existing test) don't pass it
// and see byte-identical behavior; src/solver/deriveSolution.js is the first
// caller to opt in, since forward-checking is exactly the "smart" pruning
// that makes a one-time full-puzzle brute force fast.
// `fixedPlacements`/`domains` are further opt-in pass-throughs (both default
// null, matching solvePuzzle's own defaults) added for deriveSolution.js's
// upfront-propagate seeding — every other existing caller/test omits both
// and sees byte-identical behavior.
//
// `timeMs` is a wall-clock limit (the search stops when it runs out, like a node cap); `shouldStop`
// is a cooperative stop callback; `onProgress(fraction)` hears of the estimated progress (see solver.js).
//
// What the report means (read `exhausted`, not just the count):
//   exhausted: true  the search ran to its natural end under the limits, so `solutionCount` is the
//                    whole truth (0 = no solution exists, 1 = unique), unless it stopped early
//                    because it found `maxSolutions` (then there are AT LEAST that many)
//   exhausted: false a limit (nodes, work or time, see `stoppedBy`) ended it: with `solutionCount` 0
//                    that is "gave up", NOT "no solution"; with 1 it is "found one, could not
//                    rule out others" and NOT "unique"
// `truncated` (older name) is true when the list may be incomplete for either reason.
export function checkUniqueness(
  puzzle,
  {
    maxSolutions = 2,
    maxNodes = Infinity,
    maxWork = Infinity,
    forwardCheck = false,
    forwardCheckMinRemaining = 0,
    slice = null,
    fixedPlacements = null,
    domains = null,
    timeMs = null,
    shouldStop = null,
    onProgress = null,
    progressIntervalMs,
  } = {}
) {
  const stats = {};
  const deadline = timeMs == null ? null : (typeof performance !== "undefined" ? performance.now() : Date.now()) + timeMs;
  const solutions = solvePuzzle(puzzle, {
    maxSolutions,
    maxNodes,
    maxWork,
    stats,
    forwardCheck,
    forwardCheckMinRemaining,
    slice,
    fixedPlacements,
    domains,
    deadline,
    shouldStop,
    onProgress,
    progressIntervalMs,
  });
  const stoppedBy = stats.timedOut ? "time" : stats.workCapHit ? "work" : stats.nodeCapHit ? "nodes" : null;
  return {
    solutionCount: solutions.length,
    unique: solutions.length === 1 && !stoppedBy,
    solutions,
    truncated: solutions.length >= maxSolutions || !!stoppedBy,
    exhausted: !stoppedBy,
    stoppedBy,
    nodesVisited: stats.nodesVisited,
    evaluations: stats.evaluations,
  };
}
