import { solvePuzzle } from "./solver.js";
import { describeClue } from "../model/clueTypes.js";
import { INVOLVED_CLUE_TEST_MAX_NODES, INVOLVED_CLUE_TEST_MAX_SOLUTIONS } from "./hintBudget.js";
import { buildForcedMessage, buildEliminatedMessage } from "./hintMessages.js";

// Explains a hint step: which clues (or groups of characters) make the
// deduction certain. Explanation quality only, never fact soundness.

export function resolveWitnessClues(puzzle, ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (id === null) {
      const baseRuleClue = { id: null, type: "victimRoomRule", characterId: null, params: {}, negate: false };
      out.push({ id: null, description: describeClue(baseRuleClue, puzzle), isBaseRule: true, ownerName: null });
      continue;
    }
    const clue = puzzle.clues.find((c) => c.id === id);
    if (!clue) continue;
    const owner = clue.characterId ? puzzle.characters.find((c) => c.id === clue.characterId) : null;
    out.push({ id, description: describeClue(clue, puzzle), isBaseRule: false, ownerName: owner ? owner.name : null });
  }
  return out;
}

// Turns propagation's structural naked-subset findings (§ propagation.js's
// applyNakedSubsets) into player-facing text — this kind of elimination
// isn't caused by any single clue's predicate being false, it's caused by
// several characters' clue-narrowed domains jointly leaving no room for
// anyone else in a shared set of cells, so it needs its own explanation
// shape (character names + cell labels) rather than a clue-id list.
export function resolveWitnessGroups(puzzle, groups) {
  return (groups || []).map((g) => ({
    characterNames: g.characterIds.map((id) => puzzle.characters.find((c) => c.id === id)?.name || "?"),
    // Matches the R${r+1}/C${c+1} labeling convention already used elsewhere
    // (boardRender.js's row/col header labels, clueBuilder.js's object
    // instance labels) — the board itself always shows these headers.
    cellLabels: g.cells.map(({ row, col }) => `R${row + 1}/C${col + 1}`),
  }));
}

export function factStillHolds(solutions, step) {
  if (step.type === "forcedPlacement") {
    return solutions.every((sol) => sol.some((p) => p.characterId === step.characterId && p.row === step.row && p.col === step.col));
  }
  return solutions.every((sol) => !sol.some((p) => p.characterId === step.characterId && p.row === step.row && p.col === step.col));
}

// Necessity test for a fact only propagation couldn't directly witness (it
// took full multi-character enumeration to establish): for each clue, re-solve
// with that one clue removed (same fixedPlacements, same solution cap as the
// fact's own derivation — see the constant's comment above for why the cap
// must match) and check whether the fact still holds. A clue whose removal
// breaks the fact — or whose re-check is itself inconclusive, treated
// conservatively as "involved" rather than silently dropped — is reported.
// Known limitation, accepted: a single-removal test can miss a pair of
// clues that are only *jointly* necessary; full pairwise testing isn't
// justified by the 1-2s budget. When no single clue (nor the base rule
// alone) accounts for the fact, it's marked `jointlyDetermined` instead of
// asserting something unproven.
export function involvedCluesViaLeaveOneOut(puzzle, confirmedAtStep, step, budget) {
  const fixedPlacements = new Map(confirmedAtStep);
  fixedPlacements.delete(step.characterId);
  const involved = [];

  for (const clue of puzzle.clues) {
    if (budget.expired() || budget.involvedClueNodesRemaining <= 0) {
      involved.push(clue);
      continue;
    }
    const reducedPuzzle = { ...puzzle, clues: puzzle.clues.filter((c) => c.id !== clue.id) };
    const stats = {};
    const maxNodes = Math.max(0, Math.min(INVOLVED_CLUE_TEST_MAX_NODES, budget.involvedClueNodesRemaining));
    const solutions = solvePuzzle(reducedPuzzle, { maxSolutions: INVOLVED_CLUE_TEST_MAX_SOLUTIONS, fixedPlacements, maxNodes, stats });
    budget.spendInvolvedClueNodes(stats.nodesVisited);
    const inconclusive = stats.nodeCapHit || solutions.length >= INVOLVED_CLUE_TEST_MAX_SOLUTIONS;
    if (inconclusive || !factStillHolds(solutions, step)) involved.push(clue);
  }

  if (involved.length > 0) {
    return {
      involvedClues: resolveWitnessClues(
        puzzle,
        involved.map((c) => c.id)
      ),
      jointlyDetermined: false,
    };
  }

  // No single user clue is individually necessary — check whether the
  // always-on base rule alone already accounts for the fact before
  // conceding it's a joint effect of multiple clues together.
  if (!budget.expired() && budget.involvedClueNodesRemaining > 0) {
    const bareStats = {};
    const maxNodes = Math.max(0, Math.min(INVOLVED_CLUE_TEST_MAX_NODES, budget.involvedClueNodesRemaining));
    const bareSolutions = solvePuzzle(
      { ...puzzle, clues: [] },
      { maxSolutions: INVOLVED_CLUE_TEST_MAX_SOLUTIONS, fixedPlacements, maxNodes, stats: bareStats }
    );
    budget.spendInvolvedClueNodes(bareStats.nodesVisited);
    const bareInconclusive = bareStats.nodeCapHit || bareSolutions.length >= INVOLVED_CLUE_TEST_MAX_SOLUTIONS;
    if (!bareInconclusive && factStillHolds(bareSolutions, step)) {
      return { involvedClues: resolveWitnessClues(puzzle, [null]), jointlyDetermined: false };
    }
  }

  return { involvedClues: [], jointlyDetermined: true };
}

export function attachInvolvedClues(puzzle, steps, currentPlacements, budget) {
  let confirmed = new Map(currentPlacements);
  for (const step of steps) {
    if (step.type === "forcedPlacement" || step.type === "eliminatedCell") {
      if (step.source === "propagation") {
        step.involvedClues = resolveWitnessClues(puzzle, step._witnessClueIds);
        step.involvedGroups = resolveWitnessGroups(puzzle, step._witnessNakedSubsets);
        step.jointlyDetermined = step.involvedClues.length === 0 && step.involvedGroups.length === 0;
      } else {
        const result = involvedCluesViaLeaveOneOut(puzzle, confirmed, step, budget);
        step.involvedClues = result.involvedClues;
        step.involvedGroups = [];
        step.jointlyDetermined = result.jointlyDetermined;
      }
      delete step._witnessClueIds;
      delete step._witnessNakedSubsets;
      delete step.source;
      step.message =
        step.type === "forcedPlacement"
          ? buildForcedMessage(
              puzzle,
              puzzle.characters.find((c) => c.id === step.characterId),
              step.row,
              step.col
            )
          : buildEliminatedMessage(puzzle.characters.find((c) => c.id === step.characterId));
    }
    if (step.type === "forcedPlacement") confirmed.set(step.characterId, { row: step.row, col: step.col });
  }
}

// Computes a sound logical hint chain from the puzzle's clues (never from the
// author's stored solution.placements) given what the player has already
// confirmed on the board. `currentPlacements` is a Map<characterId,{row,col}>
// (board.js's state.placements is already in this shape). `candidates` is
// board.js's state.candidates (Map<"row,col", Set<characterId>>, optional) —
// used only to decide which sound eliminatedCell facts are worth SHOWING:
// "X can't be here" is only actionable when the player has actually marked X
// as a candidate there (something to go erase); without a matching note it's
// a true but irrelevant fact about a cell they never suspected, so it's
// filtered out rather than surfaced as noise. Forced placements are always
// shown regardless — they're useful whether or not a note was ever marked.
