import { buildPredicates } from "./predicates/index.js";
import { dependenciesOf } from "./predicates/dependencies.js";
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
// (onlyPersonNear, aloneWithPerson) don't prune until the board is complete,
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
//
// Search strategy (this is where the 16x16 grids are won or lost):
//  1. Unary domains: before searching, every character's cells are filtered by the clues that
//     can be judged with that character alone on the board (a clue like "is in the Kitchen" or
//     "is in a corner" removes cells at no search cost). Skipped when the caller supplies its
//     own `domains` (propagate()'s fixed point already contains this and more).
//  2. Dynamic most-constrained-variable ordering: at every node the character with the fewest
//     cells still free (rows/columns already used are not free) is placed next, and a character
//     left with none ends the branch at once (domain wipe-out).
// Both are pure pruning: the SET of solutions found never changes (test-solver-differential.js
// checks it against a plain reference search); only how fast, and in what order, they come.
//
// Incremental checking (`incremental`, default true): after a placement, only the clues whose
// verdict can depend on THAT character (predicates/dependencies.js) are re-evaluated, plus the
// ones that watch everybody; with `incremental: false` every clue is checked every time (the
// differential test runs both and compares).
//
// `deadline` (a performance.now() time in ms) and `shouldStop()` are wall-clock/cooperative
// limits, polled every few hundred nodes: when either fires the search stops like a node cap
// and `stats.timedOut` says so. Without them a pathological case can run for minutes.
export function solvePuzzle(
  puzzle,
  {
    maxSolutions = 2,
    fixedPlacements = null,
    maxNodes = Infinity,
    stats = null,
    forwardCheck = false,
    domains = null,
    deadline = null,
    shouldStop = null,
    incremental = true,
  } = {}
) {
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
  // tends to prune "aloneWithPerson"-style clues earlier.
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
  // The work done, in clue evaluations (every predicate call, the search's own and the forward checks'): unlike the
  // node count it stays comparable when the search strategy changes (a node can cost 2 µs or 30 µs), and unlike
  // the time it does not depend on the machine. Reported in `stats.evaluations`.
  let evaluations = 0;
  let nodeCapHit = false;
  let timedOut = false;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const stopped = () => nodeCapHit || timedOut;
  // Polled every 256 nodes (a node is cheap, a clock read is not free).
  function timeIsUp() {
    if ((nodesVisited & 255) !== 0) return false;
    if ((deadline != null && now() >= deadline) || (shouldStop && shouldStop())) timedOut = true;
    return timedOut;
  }

  // Each character's candidate cells: the caller's `domains`, else the unary domains (see the
  // header), else every occupiable cell. Cells that cannot hold anyone are dropped once, here.
  const allCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isOccupiable(puzzle.grid, r, c)) allCells.push({ row: r, col: c });
  const unaryWork = { n: 0 };
  const given = domains ?? unaryDomains(puzzle, characters, predicates, allCells, unaryWork);
  evaluations += unaryWork.n;
  const candidates = new Map();
  for (const character of characters) {
    const fixed = fixedPlacements && fixedPlacements.get(character.id);
    const list = fixed ? [fixed] : (given.get(character.id) ?? allCells);
    candidates.set(
      character.id,
      list.filter(({ row, col }) => isOccupiable(puzzle.grid, row, col))
    );
  }

  const isFree = ({ row, col }) => !usedRows.has(row) && !usedCols.has(col);

  // How many cells `character` still has (stops counting at `limit`).
  function countFree(character, limit) {
    let n = 0;
    for (const cell of candidates.get(character.id)) {
      if (isFree(cell) && ++n >= limit) return n;
    }
    return n;
  }

  function violatesAny() {
    const complete = placementMap.size === order.length;
    for (const { predicate } of predicates) {
      evaluations++;
      const result = predicate(placementMap, complete);
      if (result === false) return true;
    }
    return false;
  }

  // Which clues to re-check after placing a given character: those that depend on it and those
  // that watch everybody. (A clue with a fixed set of dependencies cannot change otherwise: its
  // verdict was already not "violated" when the branch got here.)
  const alwaysChecked = [];
  const checkedAfter = new Map(); // characterId -> predicates
  const entryDependencies = predicates.map((entry) => dependenciesOf(entry.clue, puzzle));
  for (const [index, entry] of predicates.entries()) {
    const deps = entryDependencies[index];
    if (deps.all) {
      alwaysChecked.push(entry.predicate);
      continue;
    }
    for (const id of deps.ids) {
      if (!checkedAfter.has(id)) checkedAfter.set(id, []);
      checkedAfter.get(id).push(entry.predicate);
    }
  }
  function violatesAfterPlacing(characterId) {
    const complete = placementMap.size === order.length;
    for (const predicate of alwaysChecked) {
      evaluations++;
      if (predicate(placementMap, complete) === false) return true;
    }
    const own = checkedAfter.get(characterId);
    if (own) {
      for (const predicate of own) {
        evaluations++;
        if (predicate(placementMap, complete) === false) return true;
      }
    }
    return false;
  }

  function tryPlace(character, r, c) {
    placementMap.set(character.id, { row: r, col: c });
    usedRows.add(r);
    usedCols.add(c);
    if (!(incremental ? violatesAfterPlacing(character.id) : violatesAny())) {
      // Forward-check: does everyone still unplaced after this placement
      // still have at least one viable candidate cell? A CAPPED propagate()
      // result is treated exactly like "found nothing" — it must never be
      // read as a green light to prune, only a definite `contradiction` may
      // prune, so an inconclusive check degrades gracefully to plain
      // backtracking for that one node instead of risking unsoundness.
      let stillPromising = true;
      if (forwardCheck && placementMap.size < order.length) {
        const checked = propagate(puzzle, placementMap, {
          predicates,
          dependencies: incremental ? entryDependencies : null,
          incremental,
          maxRounds: FORWARD_CHECK_MAX_ROUNDS,
          maxEvaluations: FORWARD_CHECK_MAX_EVALUATIONS,
          maxSubsetOps: FORWARD_CHECK_MAX_SUBSET_OPS,
          contradictionOnly: true,
          startDomains: candidates,
        });
        evaluations += checked.evaluationsUsed ?? 0;
        stillPromising = !checked.contradiction;
      }
      if (stillPromising) backtrack();
    }
    usedRows.delete(r);
    usedCols.delete(c);
    placementMap.delete(character.id);
  }

  function backtrack() {
    if (solutions.length >= maxSolutions || stopped()) return;
    if (placementMap.size === order.length) {
      if (!violatesAny()) solutions.push(new Map(placementMap));
      return;
    }
    // The most constrained character goes next; one with no free cell left ends the branch.
    // Ties keep the static `order` (victim first), so the choice is deterministic.
    let next = null;
    let fewest = Infinity;
    for (const character of order) {
      if (placementMap.has(character.id)) continue;
      const free = countFree(character, fewest);
      if (free === 0) return;
      if (free < fewest) {
        fewest = free;
        next = character;
      }
    }
    for (const cell of candidates.get(next.id)) {
      if (!isFree(cell)) continue;
      nodesVisited++;
      if (nodesVisited >= maxNodes) {
        nodeCapHit = true;
        return;
      }
      if (timeIsUp()) return;
      tryPlace(next, cell.row, cell.col);
      if (solutions.length >= maxSolutions || stopped()) return;
    }
  }

  if (order.length > 0 && order.length <= rows && order.length <= cols) {
    backtrack();
  }

  if (stats) {
    stats.nodesVisited = nodesVisited;
    stats.evaluations = evaluations;
    stats.nodeCapHit = nodeCapHit;
    stats.timedOut = timedOut;
  }

  return solutions.map((sol) => order.map((c) => ({ characterId: c.id, row: sol.get(c.id).row, col: sol.get(c.id).col })));
}

// The cells each character can take judged ALONE: a cell goes if some clue is already false
// with just that character placed there. Sound by the predicates' own contract (a predicate
// never rejects a partial placement that can still be completed), so no solution is lost.
export function unaryDomains(puzzle, characters, predicates, cells, work = null) {
  const domains = new Map();
  const alone = characters.length === 1;
  for (const character of characters) {
    const list = [];
    for (const cell of cells) {
      const map = new Map([[character.id, cell]]);
      let ok = true;
      for (const { predicate } of predicates) {
        if (work) work.n++;
        if (predicate(map, alone) === false) {
          ok = false;
          break;
        }
      }
      if (ok) list.push(cell);
    }
    domains.set(character.id, list);
  }
  return domains;
}
