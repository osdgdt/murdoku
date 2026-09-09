import { solvePuzzle } from "./solver.js";
import { isOccupiable, zoneOfCell } from "../model/grid.js";
import { buildPredicates } from "./predicates.js";
import { describeClue } from "../model/clueTypes.js";
import { propagate } from "./propagation.js";

// Generous but bounded budgets: at this app's scale (grids capped at 9x9,
// characters capped at 9 by the editor) a well-clued puzzle exhausts its true
// solution count almost immediately; these caps only matter for lightly-clued
// puzzles, where hitting one means "don't know" rather than a guess. Raised
// substantially from the previous round's ~1.5s-per-click target — the user
// explicitly asked for deeper deduction over raw speed ("vari passi avanti,
// non ho vincoli di tempo") — while HINT_TOTAL_TIME_BUDGET_MS still keeps the
// tab from ever looking hung (browsers start showing "page unresponsive"
// somewhere around 5-10s of continuously-blocked main thread; this stays
// under that with margin). True "no limit" would need moving the computation
// off the main thread (a Web Worker — straightforward with this app's native
// ES modules) or chunking it between waves; that's a threading/UX change,
// out of scope here, and left as a follow-up rather than silently assumed.
export const HINT_MAX_SOLUTIONS = 2000;
// Shared across every wave of ONE computeHintChain() call (not re-granted
// per wave) — a richer, multi-wave chain could otherwise cost several times
// this in the worst case.
export const HINT_MAX_NODES = 2000000;
// More modest than the primary pool on purpose: called in an up-to-9x loop
// (once per currently-placed character), so 9 x this stays comfortably
// inside HINT_MAX_NODES even in the worst case.
const CULPRIT_MAX_NODES = 150000;
// Budget for the "which clues are involved" leave-one-out re-solves (§ attachInvolvedClues),
// also shared across the whole chain — this is explanation quality, not fact
// soundness, so it's fine for it to run out and fall back conservatively.
// Kept modest (not scaled with HINT_MAX_NODES) since it's also loop-called,
// once per clue — potentially dozens of times per chain.
const INVOLVED_CLUE_TEST_MAX_NODES = 150000;
// Must match HINT_MAX_SOLUTIONS exactly: comparing a leave-one-out re-solve
// against a SMALLER solution cap than the fact was originally derived under
// risks a silent false negative (the reduced search simply not having reached
// a branch that would disprove the fact) with no nodeCapHit/solutionCap
// signal to catch it, since solvePuzzle's search order is deterministic.
const INVOLVED_CLUE_TEST_MAX_SOLUTIONS = HINT_MAX_SOLUTIONS;
// Primary backstop for the whole computeHintChain() call: propagation's cost
// isn't measured in "solver nodes" at all, so a wall-clock deadline is the
// only thing that uniformly bounds propagation + exhaustive solves +
// explanation re-solves together. See the comment above HINT_MAX_SOLUTIONS
// for why this specific value.
const HINT_TOTAL_TIME_BUDGET_MS = 8000;
// UX cap, not a soundness one: a character that stays genuinely ambiguous
// could have dozens of remaining candidate cells — no point listing them all.
const HINT_MAX_ELIMINATIONS_PER_WAVE = 8;
// Deeper deduction (naked-subset cascades, forward-checked exhaustive solves)
// can plausibly produce more distinct one-placement-per-wave advances before
// a chain naturally terminates.
const HINT_CHAIN_MAX_STEPS = 120;

const CLUES_CONTRADICTORY_MSG =
  "Gli indizi di questo caso non ammettono nessuna soluzione: controlla il puzzle nell'editor.";
const INCONCLUSIVE_MSG = "Non riesco a determinare un suggerimento affidabile in questo momento.";
const MULTI_CULPRIT_MSG = "Uno dei piazzamenti attuali è in conflitto con gli indizi, ma non riesco a isolarlo con certezza.";
const TOO_COMPLEX_MSG = "Ci sono troppe possibilità da esaminare per dare un suggerimento sicuro: aggiungi qualche piazzamento o indizio in più.";
const ALREADY_COMPLETE_MSG = "Hai già piazzato tutti i personaggi compatibili con gli indizi attuali.";
const NO_DEDUCTION_MSG = "Con le informazioni attuali non c'è ancora nessuna deduzione certa: prova a piazzare qualcosa o rileggi gli indizi.";

function buildForcedMessage(puzzle, character, row, col) {
  const zoneId = zoneOfCell(puzzle.grid, row, col);
  const zone = zoneId && puzzle.grid.zones.find((z) => z.id === zoneId);
  const where = zone ? ` (nella zona "${zone.name}")` : "";
  // The victim rarely has clues of her own (she doesn't act) — by the time
  // her placement is forced, it's almost always because every other
  // row/column is already spoken for, not because of a specific clue about
  // her. Framed accordingly, distinct from the generic "compatible with the
  // clues" wording used for everyone else.
  if (character.isVictim) {
    return `${character.name} deve trovarsi nell'unica casella rimasta libera${where}.`;
  }
  return `${character.name} deve trovarsi nella cella evidenziata${where}: è l'unica posizione compatibile con gli indizi attuali.`;
}

function buildEliminatedMessage(character) {
  return `${character.name} non può trovarsi nella cella evidenziata, secondo gli indizi attuali.`;
}

function buildCulpritMessage(puzzle, culpritIds) {
  const names = culpritIds.map((id) => puzzle.characters.find((c) => c.id === id)?.name || "?");
  return names.length === 1
    ? `${names[0]} sembra nella posizione sbagliata: rimuovendo quel piazzamento, gli indizi tornano soddisfacibili.`
    : `Uno di questi piazzamenti sembra sbagliato: ${names.join(", ")}. Prova a rimuoverne uno e verifica di nuovo.`;
}

function clueOwnerLabel(puzzle, clue) {
  const owner = clue.characterId ? puzzle.characters.find((c) => c.id === clue.characterId) : null;
  return owner ? `${owner.name}: ${describeClue(clue, puzzle)}` : describeClue(clue, puzzle);
}

function buildDirectViolationMessage(puzzle, violatedClues) {
  const labels = violatedClues.map((clue) => clueOwnerLabel(puzzle, clue));
  return labels.length === 1
    ? `Un indizio è già violato dai piazzamenti attuali: ${labels[0]}`
    : `Alcuni indizi sono già violati dai piazzamenti attuali: ${labels.join(" — ")}`;
}

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

function createBudget() {
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const deadline = now() + HINT_TOTAL_TIME_BUDGET_MS;
  return {
    waveNodesRemaining: HINT_MAX_NODES,
    involvedClueNodesRemaining: INVOLVED_CLUE_TEST_MAX_NODES,
    expired() {
      return now() >= deadline;
    },
    spendWaveNodes(n) {
      this.waveNodesRemaining = Math.max(0, this.waveNodesRemaining - (n || 0));
    },
    spendInvolvedClueNodes(n) {
      this.involvedClueNodesRemaining = Math.max(0, this.involvedClueNodesRemaining - (n || 0));
    },
  };
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
      ? { type: "contradiction", variant: "error", cause: "clue", clueIds: direct.map((c) => c.id), culprits: [], message: buildDirectViolationMessage(puzzle, direct) }
      : { type: "contradiction", variant: "error", cause: "clues", culprits: [], message: CLUES_CONTRADICTORY_MSG };
  }

  const baselineStats = {};
  const baseline = solvePuzzle(puzzle, { maxSolutions: 1, maxNodes: HINT_MAX_NODES, stats: baselineStats, forwardCheck: true });
  budget.spendWaveNodes(baselineStats.nodesVisited);
  if (baseline.length === 0) {
    return baselineStats.nodeCapHit
      ? { type: "contradiction", variant: "error", cause: "unknown", culprits: [], message: INCONCLUSIVE_MSG }
      : { type: "contradiction", variant: "error", cause: "clues", culprits: [], message: CLUES_CONTRADICTORY_MSG };
  }

  const culprits = [];
  for (const characterId of currentPlacements.keys()) {
    const reduced = new Map(currentPlacements);
    reduced.delete(characterId);
    const stats = {};
    const withoutThis = solvePuzzle(puzzle, { maxSolutions: 1, fixedPlacements: reduced, maxNodes: CULPRIT_MAX_NODES, stats });
    budget.spendWaveNodes(stats.nodesVisited);
    if (withoutThis.length >= 1) culprits.push(characterId);
  }

  if (direct) {
    return { type: "contradiction", variant: "error", cause: "clue", clueIds: direct.map((c) => c.id), culprits, message: buildDirectViolationMessage(puzzle, direct) };
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
    return { steps: [], confirmedAfter: confirmed, contradiction: diagnoseContradiction(puzzle, confirmed, budget), exhaustiveUsable: false, tooComplexReason: null };
  }

  const prop = propagate(puzzle, confirmed);
  if (prop.contradiction) {
    return { steps: [], confirmedAfter: confirmed, contradiction: diagnoseContradiction(puzzle, confirmed, budget), exhaustiveUsable: false, tooComplexReason: null };
  }

  if (budget.expired()) {
    return { steps: [], confirmedAfter: confirmed, contradiction: null, exhaustiveUsable: false, tooComplexReason: "budgetExhausted" };
  }

  const stats = {};
  const solveNodes = Math.max(0, Math.min(HINT_MAX_NODES, budget.waveNodesRemaining));
  const solutions = solvePuzzle(puzzle, { maxSolutions: HINT_MAX_SOLUTIONS, fixedPlacements: prop.confirmed, maxNodes: solveNodes, stats, forwardCheck: true });
  budget.spendWaveNodes(stats.nodesVisited);

  // A capped search only explored an arbitrary, biased slice of the true
  // solution space — it must NEVER be used to derive forced/eliminated facts.
  // Only propagation's facts (sound regardless of the exhaustive solve's
  // completeness) survive from a capped wave.
  const exhaustiveUsable = !stats.nodeCapHit && solutions.length < HINT_MAX_SOLUTIONS;

  if (exhaustiveUsable && solutions.length === 0) {
    return { steps: [], confirmedAfter: confirmed, contradiction: diagnoseContradiction(puzzle, confirmed, budget), exhaustiveUsable: false, tooComplexReason: null };
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
    tooComplexReason: exhaustiveUsable ? null : (budget.expired() ? "budgetExhausted" : stats.nodeCapHit ? "nodeCap" : "solutionCap"),
  };
}

function resolveWitnessClues(puzzle, ids) {
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
function resolveWitnessGroups(puzzle, groups) {
  return (groups || []).map((g) => ({
    characterNames: g.characterIds.map((id) => puzzle.characters.find((c) => c.id === id)?.name || "?"),
    // Matches the R${r+1}/C${c+1} labeling convention already used elsewhere
    // (boardRender.js's row/col header labels, clueBuilder.js's object
    // instance labels) — the board itself always shows these headers.
    cellLabels: g.cells.map(({ row, col }) => `R${row + 1}/C${col + 1}`),
  }));
}

function factStillHolds(solutions, step) {
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
function involvedCluesViaLeaveOneOut(puzzle, confirmedAtStep, step, budget) {
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
    return { involvedClues: resolveWitnessClues(puzzle, involved.map((c) => c.id)), jointlyDetermined: false };
  }

  // No single user clue is individually necessary — check whether the
  // always-on base rule alone already accounts for the fact before
  // conceding it's a joint effect of multiple clues together.
  if (!budget.expired() && budget.involvedClueNodesRemaining > 0) {
    const bareStats = {};
    const maxNodes = Math.max(0, Math.min(INVOLVED_CLUE_TEST_MAX_NODES, budget.involvedClueNodesRemaining));
    const bareSolutions = solvePuzzle({ ...puzzle, clues: [] }, { maxSolutions: INVOLVED_CLUE_TEST_MAX_SOLUTIONS, fixedPlacements, maxNodes, stats: bareStats });
    budget.spendInvolvedClueNodes(bareStats.nodesVisited);
    const bareInconclusive = bareStats.nodeCapHit || bareSolutions.length >= INVOLVED_CLUE_TEST_MAX_SOLUTIONS;
    if (!bareInconclusive && factStillHolds(bareSolutions, step)) {
      return { involvedClues: resolveWitnessClues(puzzle, [null]), jointlyDetermined: false };
    }
  }

  return { involvedClues: [], jointlyDetermined: true };
}

function attachInvolvedClues(puzzle, steps, currentPlacements, budget) {
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
      step.message = step.type === "forcedPlacement"
        ? buildForcedMessage(puzzle, puzzle.characters.find((c) => c.id === step.characterId), step.row, step.col)
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
