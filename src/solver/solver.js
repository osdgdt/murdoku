import { buildPredicates } from "./predicates.js";
import { isOccupiable } from "../model/grid.js";
import { propagate, FORWARD_CHECK_MAX_ROUNDS, FORWARD_CHECK_MAX_EVALUATIONS, FORWARD_CHECK_MAX_SUBSET_OPS } from "./propagation.js";

// Backtracking search over row/column-distinct placements of every character
// on the grid, pruned by clue predicates. Stops once `maxSolutions` solutions
// are found (default 2, enough to answer "is it unique?").
//
// `fixedPlacements` (Map<characterId,{row,col}>) pins some characters to a
// known cell instead of searching their row/col from scratch — used by the
// hint system to search only the space consistent with what the player has
// already confirmed. `solvePuzzle` only reads from it, never mutates it.
//
// `maxNodes` is a work budget independent of `maxSolutions`: some predicates
// (onlyPersonNear, aloneWithVictim) don't prune until the board is complete,
// so a lightly-clued puzzle could otherwise force near-exhaustive traversal
// before the solver even determines "few or no solutions." When the optional
// `stats` out-param is passed, it's filled with `{ nodesVisited, nodeCapHit }`
// so callers can tell whether the returned solutions are the complete set.
//
// `forwardCheck` (opt-in, default false — every existing caller/test is
// completely unaffected unless it explicitly asks for this) makes the search
// propagation-aware: after a tentative placement passes its own
// `violatesAny()` check, also run propagate() on everyone still unplaced. A
// DEFINITE contradiction from propagate() (never a merely-capped/inconclusive
// result — see tryPlace below) means this whole branch can never lead to a
// valid solution, so it's pruned immediately instead of being explored
// node-by-node down to wherever `violatesAny()` would eventually catch it (or
// exhausting the node budget without ever catching it at all). This is the
// standard CSP "forward checking" technique — it can only ever prune
// branches that were already dead, so it changes how FAST a search finds its
// answer, never WHICH solutions it finds.
//
// `domains` (opt-in, Map<characterId, Array<{row,col}>>, default null —
// every existing caller/test is unaffected unless it explicitly passes
// this) restricts a character's cell enumeration to a precomputed candidate
// list instead of scanning the whole grid, and drives a static
// most-constrained-variable ordering (see `order` below) — typically seeded
// from propagate()'s own domain-narrowing fixed point (deriveSolution.js,
// hints.js's computeWave). A character with no entry in `domains` still
// gets the full scan (safe fallback). This can only prune cells already
// proven impossible by the same predicate contract forwardCheck relies on
// — same "changes speed, never the answer" guarantee.
export function solvePuzzle(puzzle, { maxSolutions = 2, fixedPlacements = null, maxNodes = Infinity, stats = null, forwardCheck = false, domains = null } = {}) {
  const characters = puzzle.characters;
  const { rows, cols } = puzzle.grid.size;
  const predicates = buildPredicates(puzzle);
  const solutions = [];

  // MRV (most-constrained-variable), static ordering, opt-in via `domains`
  // (typically seeded from propagate()'s own fixed point — see
  // deriveSolution.js/hints.js). A character absent from `domains` sorts
  // LAST, tied with every other absent character — "unknown size" must
  // never be treated as "small," or a possibly-huge search gets
  // front-loaded. Ties (including the all-absent case, i.e. `domains`
  // omitted) fall through to the ORIGINAL rule: placing the victim first
  // tends to prune "aloneWithVictim"-style clues earlier.
  //
  // `sizeA - sizeB` is NOT used directly when both are Infinity (Infinity -
  // Infinity === NaN, and a comparator that can return NaN has unreliable
  // sort behavior) — the equality check below sidesteps that, and also
  // means: when `domains` is omitted, every pair compares Infinity===Infinity,
  // this branch is never taken, and `order` is byte-identical to before this
  // option existed for every existing caller.
  //
  // Static only (computed once, not re-ranked at each recursion depth): a
  // full dynamic MRV would need backtrack/tryPlace to re-rank the remaining
  // characters after every placement, a materially bigger restructure. This
  // static pass already captures most of the value here, since `domains` is
  // normally seeded from propagate()'s own fixed point — all the free
  // cross-character narrowing propagation could find is already baked into
  // the sizes being sorted on; only search-time row/col consumption is left
  // dynamic, and that's already handled per-node by forwardCheck.
  const domainSize = (character) => domains?.get(character.id)?.length ?? Infinity;
  const order = [...characters].sort((a, b) => {
    const sizeA = domainSize(a);
    const sizeB = domainSize(b);
    if (sizeA !== sizeB) return sizeA - sizeB;
    return (b.isVictim ? 1 : 0) - (a.isVictim ? 1 : 0);
  });

  const usedRows = new Set();
  const usedCols = new Set();
  const placementMap = new Map();
  let nodesVisited = 0;
  let nodeCapHit = false;

  function isComplete() {
    return placementMap.size === order.length;
  }

  function violatesAny() {
    const complete = isComplete();
    for (const { predicate } of predicates) {
      const result = predicate(placementMap, complete);
      if (result === false) return true;
    }
    return false;
  }

  function tryPlace(character, r, c, index) {
    placementMap.set(character.id, { row: r, col: c });
    usedRows.add(r);
    usedCols.add(c);
    if (!violatesAny()) {
      // Forward-check: does everyone still unplaced after this placement
      // still have at least one viable candidate cell? A CAPPED propagate()
      // result is treated exactly like "found nothing" — it must never be
      // read as a green light to prune, only a definite `contradiction` may
      // prune, so an inconclusive check degrades gracefully to plain
      // backtracking for that one node instead of risking unsoundness.
      const stillPromising = !forwardCheck || index + 1 >= order.length || !propagate(puzzle, placementMap, {
        predicates,
        maxRounds: FORWARD_CHECK_MAX_ROUNDS,
        maxEvaluations: FORWARD_CHECK_MAX_EVALUATIONS,
        maxSubsetOps: FORWARD_CHECK_MAX_SUBSET_OPS,
      }).contradiction;
      if (stillPromising) backtrack(index + 1);
    }
    usedRows.delete(r);
    usedCols.delete(c);
    placementMap.delete(character.id);
  }

  function backtrack(index) {
    if (solutions.length >= maxSolutions || nodeCapHit) return;
    if (index === order.length) {
      if (!violatesAny()) {
        solutions.push(new Map(placementMap));
      }
      return;
    }
    const character = order[index];
    const fixed = fixedPlacements && fixedPlacements.get(character.id);

    if (fixed) {
      if (usedRows.has(fixed.row) || usedCols.has(fixed.col) || !isOccupiable(puzzle.grid, fixed.row, fixed.col)) {
        return; // the fixed placement is inconsistent -> this branch is a dead end
      }
      nodesVisited++;
      if (nodesVisited >= maxNodes) {
        nodeCapHit = true;
        return;
      }
      tryPlace(character, fixed.row, fixed.col, index);
      return;
    }

    const characterDomain = domains && domains.get(character.id);
    if (characterDomain) {
      // Re-check usedRows/usedCols/isOccupiable live, exactly like the full
      // scan below does — `characterDomain` may have been computed against a
      // different confirmed-set snapshot than this search's current state,
      // and a listed cell's row/col could have been consumed since (by
      // another character placed earlier in `order` during this very
      // search). An empty `characterDomain` (propagate() proved zero
      // candidates) correctly falls straight through to `return` with
      // nothing tried — a sound dead-end, not a bug.
      for (const { row: r, col: c } of characterDomain) {
        if (usedRows.has(r) || usedCols.has(c)) continue;
        if (!isOccupiable(puzzle.grid, r, c)) continue;
        nodesVisited++;
        if (nodesVisited >= maxNodes) {
          nodeCapHit = true;
          return;
        }
        tryPlace(character, r, c, index);
        if (solutions.length >= maxSolutions || nodeCapHit) return;
      }
      return;
    }

    for (let r = 0; r < rows; r++) {
      if (usedRows.has(r)) continue;
      for (let c = 0; c < cols; c++) {
        if (usedCols.has(c)) continue;
        if (!isOccupiable(puzzle.grid, r, c)) continue;
        nodesVisited++;
        if (nodesVisited >= maxNodes) {
          nodeCapHit = true;
          return;
        }
        tryPlace(character, r, c, index);
        if (solutions.length >= maxSolutions || nodeCapHit) return;
      }
    }
  }

  if (order.length > 0 && order.length <= rows && order.length <= cols) {
    backtrack(0);
  }

  if (stats) {
    stats.nodesVisited = nodesVisited;
    stats.nodeCapHit = nodeCapHit;
  }

  return solutions.map((sol) =>
    order.map((c) => ({ characterId: c.id, row: sol.get(c.id).row, col: sol.get(c.id).col }))
  );
}
