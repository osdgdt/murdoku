import { solvePuzzle } from "./solver.js";
import { isOccupiable } from "../model/grid.js";
import { buildPredicates } from "./predicates/index.js";
import { propagate } from "./propagation.js";
import {
  buildDirectViolationMessage,
  buildCulpritMessage,
  CLUES_CONTRADICTORY_MSG,
  INCONCLUSIVE_MSG,
  MULTI_CULPRIT_MSG,
  TOO_COMPLEX_MSG,
  ALREADY_COMPLETE_MSG,
  NO_DEDUCTION_MSG,
  NO_FURTHER_DEDUCTION_MSG,
} from "./hintMessages.js";

import {
  HINT_MAX_SOLUTIONS,
  HINT_MAX_NODES,
  CULPRIT_MAX_NODES,
  HINT_MAX_ELIMINATIONS_PER_WAVE,
  HINT_CHAIN_MAX_STEPS,
  createBudget,
} from "./hintBudget.js";
import { attachInvolvedClues } from "./hintExplain.js";

function buildOccupancyIndex(solutions) {
  const index = new Map();
  for (const sol of solutions) {
    for (const p of sol) {
      let set = index.get(p.characterId);
      if (!set) {
        set = new Set();
        index.set(p.characterId, set);
      }
      set.add(`${p.row},${p.col}`);
    }
  }
  return index;
}

// Cheap, exact check: does any clue's predicate already evaluate to a
// definite `false` on the CURRENT (possibly partial) placements? Any hit is a
// certain violation — no search needed to know it, unlike isolating which
// *placement* is to blame (see diagnoseContradiction).
function checkDirectClueViolation(puzzle, placements) {
  const isComplete = placements.size === puzzle.characters.length;
  const violated = [];
  for (const { clue, predicate } of buildPredicates(puzzle)) {
    if (predicate(placements, isComplete) === false) violated.push(clue);
  }
  return violated.length > 0 ? violated : null;
}

function diagnoseContradiction(puzzle, currentPlacements, budget) {
  const direct = checkDirectClueViolation(puzzle, currentPlacements);

  if (currentPlacements.size === 0) {
    return direct
      ? {
          type: "contradiction",
          variant: "error",
          cause: "clue",
          clueIds: direct.map((c) => c.id),
          culprits: [],
          message: buildDirectViolationMessage(puzzle, direct),
        }
      : { type: "contradiction", variant: "error", cause: "clues", culprits: [], message: CLUES_CONTRADICTORY_MSG };
  }

  const baselineStats = {};
  const baselineMaxNodes = Math.max(0, Math.min(HINT_MAX_NODES, budget.waveNodesRemaining));
  const baseline = solvePuzzle(puzzle, { maxSolutions: 1, maxNodes: baselineMaxNodes, stats: baselineStats, forwardCheck: true });
  budget.spendWaveNodes(baselineStats.nodesVisited);
  if (baseline.length === 0) {
    return baselineStats.nodeCapHit
      ? { type: "contradiction", variant: "error", cause: "unknown", culprits: [], message: INCONCLUSIVE_MSG }
      : { type: "contradiction", variant: "error", cause: "clues", culprits: [], message: CLUES_CONTRADICTORY_MSG };
  }

  const culprits = [];
  for (const characterId of currentPlacements.keys()) {
    // Out of shared budget for this whole hint click — report whatever's
    // been isolated so far instead of spending an unbounded amount more;
    // MULTI_CULPRIT_MSG below is already the honest "can't isolate it"
    // message for the case nothing was found yet.
    if (budget.expired()) break;
    const reduced = new Map(currentPlacements);
    reduced.delete(characterId);
    const stats = {};
    const maxNodes = Math.max(0, Math.min(CULPRIT_MAX_NODES, budget.waveNodesRemaining));
    const withoutThis = solvePuzzle(puzzle, { maxSolutions: 1, fixedPlacements: reduced, maxNodes, stats });
    budget.spendWaveNodes(stats.nodesVisited);
    if (withoutThis.length >= 1) culprits.push(characterId);
  }

  if (direct) {
    return {
      type: "contradiction",
      variant: "error",
      cause: "clue",
      clueIds: direct.map((c) => c.id),
      culprits,
      message: buildDirectViolationMessage(puzzle, direct),
    };
  }

  return culprits.length > 0
    ? { type: "contradiction", variant: "error", cause: "placements", culprits, message: buildCulpritMessage(puzzle, culprits) }
    : { type: "contradiction", variant: "error", cause: "placements", culprits: [], message: MULTI_CULPRIT_MSG };
}

function toForcedPlacementStep(fact) {
  return {
    type: "forcedPlacement",
    variant: "success",
    characterId: fact.characterId,
    row: fact.row,
    col: fact.col,
    source: fact.source,
    _witnessClueIds: fact.witnessClueIds || null,
    _witnessNakedSubsets: fact.nakedSubsets || null,
  };
}

function toEliminatedCellStep(fact) {
  return {
    type: "eliminatedCell",
    variant: "info",
    characterId: fact.characterId,
    row: fact.row,
    col: fact.col,
    source: fact.source,
    _witnessClueIds: fact.witnessClueIds || null,
    // A single eliminated-cell fact carries at most one nakedSubset (see
    // propagation.js) — wrapped in an array for shape uniformity with the
    // forced-fact case (which can cite several distinct subsets at once).
    _witnessNakedSubsets: fact.nakedSubset ? [fact.nakedSubset] : null,
  };
}

// One "wave": a propagation pass (cheap, always run first, both as a genuine
// fallback for when the exhaustive solve is infeasible AND as a pre-narrowing
// step that makes that solve itself cheaper), then — unless propagation
// already found a contradiction — an exhaustive solve fixed to whatever
// propagation confirmed. Returns every forced placement/elimination found by
// EITHER technique this wave, merged and deduplicated.
function computeWave(puzzle, confirmed, budget, candidates) {
  // Contradiction checks run BEFORE the budget check, on purpose: they're
  // already cheap/self-bounded (checkDirectClueViolation is a direct
  // predicate evaluation, propagate() has its own internal caps), and doing
  // so makes "no contradiction reported => confirmed is clue-consistent" —
  // the soundness property extendChainWithOracleStep (gameScreen.js) relies
  // on — true by construction instead of true only because the very first
  // wave's budget happens to always be fresh (synchronous, no `await`
  // between creating it and this first call). Costs nothing either way.
  if (checkDirectClueViolation(puzzle, confirmed)) {
    return {
      steps: [],
      confirmedAfter: confirmed,
      contradiction: diagnoseContradiction(puzzle, confirmed, budget),
      exhaustiveUsable: false,
      tooComplexReason: null,
    };
  }

  const prop = propagate(puzzle, confirmed);
  if (prop.contradiction) {
    return {
      steps: [],
      confirmedAfter: confirmed,
      contradiction: diagnoseContradiction(puzzle, confirmed, budget),
      exhaustiveUsable: false,
      tooComplexReason: null,
    };
  }

  if (budget.expired()) {
    return { steps: [], confirmedAfter: confirmed, contradiction: null, exhaustiveUsable: false, tooComplexReason: "budgetExhausted" };
  }

  const stats = {};
  const solveNodes = Math.max(0, Math.min(HINT_MAX_NODES, budget.waveNodesRemaining));
  const solutions = solvePuzzle(puzzle, {
    maxSolutions: HINT_MAX_SOLUTIONS,
    fixedPlacements: prop.confirmed,
    domains: prop.domains,
    maxNodes: solveNodes,
    stats,
    forwardCheck: true,
  });
  budget.spendWaveNodes(stats.nodesVisited);

  // A capped search only explored an arbitrary, biased slice of the true
  // solution space — it must NEVER be used to derive forced/eliminated facts.
  // Only propagation's facts (sound regardless of the exhaustive solve's
  // completeness) survive from a capped wave.
  const exhaustiveUsable = !stats.nodeCapHit && solutions.length < HINT_MAX_SOLUTIONS;

  if (exhaustiveUsable && solutions.length === 0) {
    return {
      steps: [],
      confirmedAfter: confirmed,
      contradiction: diagnoseContradiction(puzzle, confirmed, budget),
      exhaustiveUsable: false,
      tooComplexReason: null,
    };
  }

  const { rows, cols } = puzzle.grid.size;
  let exhaustiveForced = [];
  let exhaustiveEliminated = [];
  if (exhaustiveUsable && solutions.length > 0) {
    const index = buildOccupancyIndex(solutions);
    const stillUnplaced = puzzle.characters.filter((c) => !prop.confirmed.has(c.id));
    const forcedIds = new Set();
    for (const character of stillUnplaced) {
      const set = index.get(character.id);
      if (set && set.size === 1) {
        const [row, col] = [...set][0].split(",").map(Number);
        exhaustiveForced.push({ characterId: character.id, row, col });
        forcedIds.add(character.id);
      }
    }
    const usedRows = new Set([...prop.confirmed.values()].map((p) => p.row));
    const usedCols = new Set([...prop.confirmed.values()].map((p) => p.col));
    for (const character of stillUnplaced) {
      if (forcedIds.has(character.id)) continue;
      const set = index.get(character.id) || new Set();
      for (let r = 0; r < rows; r++) {
        if (usedRows.has(r)) continue;
        for (let c = 0; c < cols; c++) {
          if (usedCols.has(c)) continue;
          if (!isOccupiable(puzzle.grid, r, c)) continue;
          if (!set.has(`${r},${c}`)) exhaustiveEliminated.push({ characterId: character.id, row: r, col: c });
        }
      }
    }
  }

  // Merge propagation + exhaustive: propagation wins ties on forced
  // placements (cheaper, and identical in outcome by construction — both are
  // sound, so if both found the same character forced, they agree on where).
  const forcedByChar = new Map();
  for (const f of prop.forced) forcedByChar.set(f.characterId, { ...f, source: "propagation" });
  for (const f of exhaustiveForced) if (!forcedByChar.has(f.characterId)) forcedByChar.set(f.characterId, { ...f, source: "exhaustive" });
  const forcedCharacters = puzzle.characters.filter((c) => forcedByChar.has(c.id));
  // When several characters are forced together in the same wave, reveal the
  // victim last if she's among them — narratively she's "whoever's left"
  // once every suspect has a room, not a deduction in her own right. Pure
  // display ordering: never changes which facts are found, so it can't
  // affect soundness.
  const orderedForcedCharacters = [...forcedCharacters.filter((c) => !c.isVictim), ...forcedCharacters.filter((c) => c.isVictim)];
  const allForced = orderedForcedCharacters.map((c) => forcedByChar.get(c.id));
  const resolvedIds = new Set(allForced.map((f) => f.characterId));

  const elimKey = (e) => `${e.characterId},${e.row},${e.col}`;
  const elimMap = new Map();
  for (const e of prop.eliminated) {
    if (resolvedIds.has(e.characterId)) continue;
    elimMap.set(elimKey(e), { ...e, source: "propagation" });
  }
  for (const e of exhaustiveEliminated) {
    if (resolvedIds.has(e.characterId)) continue;
    const k = elimKey(e);
    if (!elimMap.has(k)) elimMap.set(k, { ...e, source: "exhaustive" });
  }
  const allEliminated = [...elimMap.values()]
    // Only worth telling the player about a cell they've actually marked as
    // a candidate for that character — "X can't be here" is only actionable
    // ("go erase that note") when they suspected X there in the first place;
    // otherwise it's a true but irrelevant fact about a cell they never
    // considered, which reads as noise rather than a suggestion.
    .filter((e) => candidates.get(`${e.row},${e.col}`)?.has(e.characterId))
    .sort((a, b) => {
      const orderA = puzzle.characters.findIndex((c) => c.id === a.characterId);
      const orderB = puzzle.characters.findIndex((c) => c.id === b.characterId);
      if (orderA !== orderB) return orderA - orderB;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    })
    .slice(0, HINT_MAX_ELIMINATIONS_PER_WAVE);

  const confirmedAfter = new Map(prop.confirmed);
  for (const f of allForced) confirmedAfter.set(f.characterId, { row: f.row, col: f.col });

  const steps = [...allForced.map(toForcedPlacementStep), ...allEliminated.map(toEliminatedCellStep)];

  return {
    steps,
    confirmedAfter,
    contradiction: null,
    exhaustiveUsable,
    tooComplexReason: exhaustiveUsable ? null : budget.expired() ? "budgetExhausted" : stats.nodeCapHit ? "nodeCap" : "solutionCap",
  };
}

// Walks forward through as many consecutive "waves" of certain deductions as
// it can find — each wave may surface several simultaneous forced placements
// and/or eliminated cells, not just one — stopping at a contradiction, a
// genuine "too complex to fully verify" wall (after having tried
// propagation's lighter techniques regardless), or once nothing further is
// derivable.
export function computeHintChain(puzzle, currentPlacements, candidates = new Map()) {
  if (currentPlacements.size === puzzle.characters.length) {
    return [{ type: "noHint", variant: "info", reason: "complete", message: ALREADY_COMPLETE_MSG }];
  }

  const budget = createBudget();
  const steps = [];
  let confirmed = new Map(currentPlacements);

  while (true) {
    const wave = computeWave(puzzle, confirmed, budget, candidates);

    if (wave.contradiction) {
      steps.push(wave.contradiction);
      break;
    }

    steps.push(...wave.steps);
    if (steps.length >= HINT_CHAIN_MAX_STEPS) {
      steps.length = HINT_CHAIN_MAX_STEPS;
      break;
    }

    // Only a forced placement actually advances `confirmed` — an
    // eliminatedCell step changes nothing the next wave could build on, so
    // re-running would just rediscover the identical facts over and over
    // (up to HINT_CHAIN_MAX_STEPS) instead of genuinely progressing. Stop as
    // soon as a wave adds no NEW placements, whether or not it reported
    // eliminations.
    const madeProgress = wave.confirmedAfter.size > confirmed.size;
    confirmed = wave.confirmedAfter;
    if (confirmed.size === puzzle.characters.length) break;

    if (!madeProgress) {
      if (!wave.exhaustiveUsable) {
        steps.push({ type: "tooComplex", variant: "warning", reason: wave.tooComplexReason, message: TOO_COMPLEX_MSG });
      } else if (wave.steps.length === 0) {
        // The exhaustive search WAS usable this wave (proven, not capped)
        // and still found nothing — unlike tooComplex above, this isn't
        // "couldn't tell," it's proof that multiple distinct valid
        // completions exist from here on (if exactly one remained, every
        // still-unplaced character would have been forced, making
        // wave.steps non-empty). Scoped to wave.steps.length === 0 on
        // purpose: a wave that DID surface real eliminatedCell facts already
        // has something to show, so no redundant message is needed there.
        steps.push({ type: "noFurtherDeduction", variant: "warning", message: NO_FURTHER_DEDUCTION_MSG });
      }
      break;
    }

    if (budget.expired()) {
      steps.push({ type: "tooComplex", variant: "warning", reason: "budgetExhausted", message: TOO_COMPLEX_MSG });
      break;
    }
  }

  if (steps.length === 0) {
    steps.push({ type: "noHint", variant: "info", reason: "noDeduction", message: NO_DEDUCTION_MSG });
  }

  attachInvolvedClues(puzzle, steps, currentPlacements, budget);
  return steps;
}

export function computeHint(puzzle, currentPlacements, candidates = new Map()) {
  return computeHintChain(puzzle, currentPlacements, candidates)[0];
}
