import { buildPredicates } from "./predicates.js";
import { isOccupiable } from "../model/grid.js";

// Lightweight, non-exhaustive deduction engine — a fallback for when a full
// backtracking search (solvePuzzle) is too expensive to run to completion,
// and also a cheap pre-pass that narrows the search space before that search
// even starts. Unlike solvePuzzle, this never explores full assignments: for
// each unplaced character and each still-available cell, it evaluates every
// predicate against a TENTATIVE placement (everyone else still unknown).
// Predicates are written to return a settled `false` as soon as a partial
// assignment can never be completed validly (the same property solvePuzzle's
// own pruning already relies on) — so a `false` here is a sound exclusion,
// found in O(characters x cells x clues) instead of full backtracking.
//
// Deliberately NOT implemented: Sudoku-style "hidden single" propagation
// ("this cell is the only remaining candidate for exactly one character, so
// someone must go there"). That would be UNSOUND here — unlike Sudoku, empty
// rows/columns are explicitly legal in Murdoku (see README), so a cell being
// nobody-else's-candidate never forces anybody into it. Only per-character
// domain narrowing (plus the row/col AllDifferent rule already baked into
// which cells count as "available") is sound, and that's all this does —
// everything that needs genuine cross-character reasoning beyond that is
// left to the exhaustive solver.
export const PROPAGATION_MAX_ROUNDS = 60;
export const PROPAGATION_MAX_EVALUATIONS = 200000;
// Budget for the naked-subset scan (technique A, below) — a SEPARATE counter
// from `maxEvaluations`, since subset work never calls a clue `predicate()`
// (it only reads already-computed per-character domains), so it wouldn't
// naturally advance that counter and needs its own cap.
export const PROPAGATION_MAX_SUBSET_OPS = 2000000;
// Tighter caps for propagate() calls made FROM solvePuzzle's forward-checking
// (see solver.js's `forwardCheck` option) — those can fire at many search
// nodes per click, not once per click, so each individual call must stay
// cheap. A capped forward-check call is always safe (see solver.js) — it
// only trades away some pruning depth at that one node, never correctness.
export const FORWARD_CHECK_MAX_ROUNDS = 10;
export const FORWARD_CHECK_MAX_EVALUATIONS = 20000;

function key(characterId, row, col) {
  return `${characterId},${row},${col}`;
}

// Are these cells pairwise on different rows AND different columns? A
// necessary condition for a set of characters to simultaneously occupy all
// of them (see applyNakedSubsets).
function pairwiseRowColDistinct(cells) {
  const rows = new Set();
  const cols = new Set();
  for (const { row, col } of cells) {
    if (rows.has(row) || cols.has(col)) return false;
    rows.add(row);
    cols.add(col);
  }
  return true;
}

// Kuhn's augmenting-path algorithm: does a perfect matching exist between
// `subsetChars` and `unionCells` (same length), using only "cell is in that
// character's domain" edges? O(K^3) worst case — trivial at K<=9. Not simple
// permutation enumeration (which would be O(K!)).
function hasPerfectMatching(subsetChars, unionCells, domains) {
  const m = unionCells.length;
  const matchOfCell = new Array(m).fill(-1);
  const domainHas = (character, cell) =>
    domains.get(character.id).some((d) => d.row === cell.row && d.col === cell.col);

  function tryAugment(ci, visited) {
    for (let j = 0; j < m; j++) {
      if (visited[j] || !domainHas(subsetChars[ci], unionCells[j])) continue;
      visited[j] = true;
      if (matchOfCell[j] === -1 || tryAugment(matchOfCell[j], visited)) {
        matchOfCell[j] = ci;
        return true;
      }
    }
    return false;
  }

  for (let ci = 0; ci < subsetChars.length; ci++) {
    if (!tryAugment(ci, new Array(m).fill(false))) return false;
  }
  return true;
}

// Generalized naked-subset elimination (the shared principle behind Sudoku's
// naked/hidden pairs/triples/quads, pointing pairs, and box-line reduction,
// adapted to Murdoku's actual constraint — one person per row AND per
// column, no "box"): if some subset S of K still-unplaced characters has a
// COMBINED candidate-cell domain of exactly K cells, every valid completion
// must place S entirely within those K cells (pigeonhole) — so any OTHER
// character can have those K cells removed from its own domain, since if an
// outsider took one, only K-1 cells would remain for S's K characters.
//
// Soundness pitfall (verified with a worked counter-example before shipping
// this): `|union| === K` alone is NOT sufficient. If two of the K cells share
// a row or column, S's characters could never simultaneously occupy all K of
// them at all (two people can never share a row/col) — that's not a "no
// elimination to draw" case, it's an outright CONTRADICTION for the whole
// puzzle branch, and must be reported as such, not silently treated as a
// valid (but vacuous) naked subset. The correct, necessary-and-sufficient
// conditions are: |union| === K, the K cells are pairwise row/col distinct,
// AND a perfect matching exists between S and the union (Hall's theorem: if
// no matching exists, some sub-subset of S is already overcommitted, which
// is again a contradiction for the whole branch, not merely "no info").
//
// Runs to its OWN internal fixed point within one call (an elimination from
// one subset can shrink another character's domain enough to newly qualify
// a different subset, all within the same propagate() round) — bounded by
// `opsBudget`, which is shared across the whole call and checked before each
// subset's cost is spent; hitting the cap is always safe (whatever was found
// already stands, nothing more is claimed).
function applyNakedSubsets(unplaced, domains, witnessOf, opsBudget) {
  const n = unplaced.length;
  if (n < 2) return { contradiction: null };

  const masksBySize = new Map(); // size -> [bitmask, ...], computed once per call
  for (let mask = 1; mask < 1 << n; mask++) {
    const size = popcount(mask);
    if (size < 2) continue;
    let list = masksBySize.get(size);
    if (!list) { list = []; masksBySize.set(size, list); }
    list.push(mask);
  }

  for (let pass = 0; pass < n * 2; pass++) {
    let progressed = false;

    for (let size = 2; size <= n; size++) {
      for (const mask of masksBySize.get(size) || []) {
        const subsetChars = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) subsetChars.push(unplaced[i]);

        const unionMap = new Map(); // "row,col" -> {row,col}
        for (const character of subsetChars) {
          for (const cell of domains.get(character.id)) unionMap.set(`${cell.row},${cell.col}`, cell);
        }
        const unionCells = [...unionMap.values()];

        if (opsBudget.spend(unionCells.length + size) > opsBudget.max) {
          return { contradiction: null, capped: true };
        }

        if (unionCells.length < size) {
          return { contradiction: { characterId: null, characterIds: subsetChars.map((c) => c.id) } };
        }
        if (unionCells.length !== size) continue; // not tight — no information yet

        if (!pairwiseRowColDistinct(unionCells) || !hasPerfectMatching(subsetChars, unionCells, domains)) {
          return { contradiction: { characterId: null, characterIds: subsetChars.map((c) => c.id) } };
        }

        // Valid naked subset: prune unionCells from every OTHER character.
        for (const other of unplaced) {
          if (subsetChars.includes(other)) continue;
          const before = domains.get(other.id);
          const toRemove = unionCells.filter((cell) => before.some((d) => d.row === cell.row && d.col === cell.col));
          if (toRemove.length === 0) continue;
          domains.set(other.id, before.filter((d) => !toRemove.some((t) => t.row === d.row && t.col === d.col)));
          for (const cell of toRemove) {
            const k = key(other.id, cell.row, cell.col);
            // First-wins attribution: once a cell is gone from a domain, a
            // later subset that would ALSO have removed it just finds
            // nothing left to do. Always a sound reason, not necessarily the
            // only possible one — the same accepted-imprecision philosophy
            // already used for hints.js's leave-one-out "involved clues".
            if (!witnessOf.has(k)) {
              witnessOf.set(k, {
                characterId: other.id, row: cell.row, col: cell.col,
                witnessClueIds: [],
                nakedSubset: { characterIds: subsetChars.map((c) => c.id), cells: unionCells },
              });
            }
          }
          progressed = true;
        }
      }
    }

    if (!progressed) break;
  }

  for (const character of unplaced) {
    if (domains.get(character.id).length === 0) {
      return { contradiction: { characterId: character.id } };
    }
  }
  return { contradiction: null };
}

function popcount(x) {
  let c = 0;
  while (x) { c += x & 1; x >>= 1; }
  return c;
}

function createOpsBudget(max) {
  let spent = 0;
  return { max, spend(n) { spent += n; return spent; } };
}

// propagate(puzzle, currentPlacements) ->
// {
//   confirmed: Map<characterId,{row,col}>,   // currentPlacements plus every propagation-forced placement
//   forced: [{characterId,row,col,witnessClueIds}],
//   eliminated: [{characterId,row,col,witnessClueIds}],
//   contradiction: {characterId} | null,      // set iff some unplaced character's domain went empty
//   evaluationsUsed: number,
// }
// witnessClueIds entries are clue ids (the synthetic base-rule entry from
// buildPredicates has id `null`) — exactly which predicates returned `false`
// for that cell, recorded as they're found so callers never need to re-derive
// "why" for a propagation-sourced fact.
export function propagate(puzzle, currentPlacements, {
  maxEvaluations = PROPAGATION_MAX_EVALUATIONS,
  maxRounds = PROPAGATION_MAX_ROUNDS,
  maxSubsetOps = PROPAGATION_MAX_SUBSET_OPS,
  // Lets a hot caller (solvePuzzle's forward-checking) build the predicate
  // list once and reuse it across many propagate() calls instead of paying
  // buildPredicates(puzzle) again at every search node. Every other caller
  // (including every existing standalone use of propagate()) leaves this
  // unset and gets the exact same behavior as before.
  predicates: predicatesOverride = null,
} = {}) {
  const { rows, cols } = puzzle.grid.size;
  const predicates = predicatesOverride || buildPredicates(puzzle);
  const opsBudget = createOpsBudget(maxSubsetOps);
  const confirmed = new Map(currentPlacements);
  const forced = [];
  let evaluations = 0;
  let capped = false;

  // Snapshot of the most recent COMPLETE round's per-cell exclusion reasons
  // and which characters were still unplaced at that point — only ever
  // turned into `eliminated` entries once the round loop below finishes
  // (fixed point or cap), and only for characters that are STILL unplaced
  // then. A character forced in a LATER round than the one that excluded some
  // of its cells never has those earlier exclusions surfaced separately —
  // they're exactly what proves the forced fact, and are folded into that
  // fact's own `witnessClueIds` instead (see the loop below).
  let lastWitnessOf = new Map();
  let lastUnplacedIds = new Set();

  for (let round = 0; round < maxRounds; round++) {
    const unplaced = puzzle.characters.filter((c) => !confirmed.has(c.id));
    if (unplaced.length === 0) break;

    const usedRows = new Set([...confirmed.values()].map((p) => p.row));
    const usedCols = new Set([...confirmed.values()].map((p) => p.col));
    // Placing THIS character would complete the board exactly when they're
    // the only one left — constant for the whole round, and the only way to
    // honestly know `isComplete` for a single-tentative-placement map without
    // actually knowing everyone else's position.
    const isCompleteIfPlaced = unplaced.length === 1;

    const domains = new Map(); // characterId -> [{row,col}] survivors
    const witnessOf = new Map(); // "characterId,row,col" -> witnessClueIds[] (excluded cells only)

    outer: for (const character of unplaced) {
      const survivors = [];
      for (let r = 0; r < rows; r++) {
        if (usedRows.has(r)) continue;
        for (let c = 0; c < cols; c++) {
          if (usedCols.has(c)) continue;
          if (!isOccupiable(puzzle.grid, r, c)) continue;
          const tentative = new Map(confirmed);
          tentative.set(character.id, { row: r, col: c });
          const witnesses = [];
          for (const { clue, predicate } of predicates) {
            evaluations++;
            if (evaluations > maxEvaluations) {
              capped = true;
              break outer;
            }
            if (predicate(tentative, isCompleteIfPlaced) === false) witnesses.push(clue.id);
          }
          if (witnesses.length > 0) witnessOf.set(key(character.id, r, c), { characterId: character.id, row: r, col: c, witnessClueIds: witnesses });
          else survivors.push({ row: r, col: c });
        }
      }
      domains.set(character.id, survivors);
    }

    // A capped round is incomplete/partial — never trust its domains or
    // witnesses; keep whatever the previous complete round established.
    if (capped) break;

    lastWitnessOf = witnessOf;
    lastUnplacedIds = new Set(unplaced.map((c) => c.id));

    for (const character of unplaced) {
      if (domains.get(character.id).length === 0) {
        return { confirmed, forced, eliminated: [], contradiction: { characterId: character.id }, evaluationsUsed: evaluations };
      }
    }

    // Technique A: naked/hidden-subset elimination (see applyNakedSubsets).
    // Runs on the SAME `domains`/`witnessOf` maps this round already built,
    // mutating them further — so any domain it shrinks to size 1 is picked
    // up by the unchanged `newlyForced` line right below, and any cell it
    // excludes is picked up by the unchanged `eliminated` construction at
    // the end of this function (lastWitnessOf is a reference to this exact
    // `witnessOf` map, captured above).
    const subset = applyNakedSubsets(unplaced, domains, witnessOf, opsBudget);
    if (subset.contradiction) {
      return { confirmed, forced, eliminated: [], contradiction: subset.contradiction, evaluationsUsed: evaluations };
    }
    // subset.capped: no special handling needed — domains/witnessOf simply
    // reflect whatever partial progress the subset scan made before running
    // out of budget; safe to proceed exactly as if it had found nothing more.

    const newlyForced = unplaced.filter((c) => domains.get(c.id).length === 1);
    if (newlyForced.length === 0) break; // fixed point reached

    for (const character of newlyForced) {
      const cell = domains.get(character.id)[0];
      // Witnesses for the forced fact = union of witnesses for every OTHER
      // candidate this character had this round — that's what actually
      // proves "only this cell is left." A candidate excluded by technique A
      // carries a `nakedSubset` instead of (or alongside) `witnessClueIds`;
      // collect both kinds, deduping subsets by their character-id set.
      const allWitnesses = new Set();
      const nakedSubsetsByKey = new Map();
      for (let r = 0; r < rows; r++) {
        if (usedRows.has(r)) continue;
        for (let c = 0; c < cols; c++) {
          if (usedCols.has(c)) continue;
          if (r === cell.row && c === cell.col) continue;
          if (!isOccupiable(puzzle.grid, r, c)) continue;
          const entry = witnessOf.get(key(character.id, r, c));
          if (!entry) continue;
          for (const id of entry.witnessClueIds) allWitnesses.add(id);
          if (entry.nakedSubset) {
            const k = [...entry.nakedSubset.characterIds].sort().join(",");
            if (!nakedSubsetsByKey.has(k)) nakedSubsetsByKey.set(k, entry.nakedSubset);
          }
        }
      }
      forced.push({
        characterId: character.id, row: cell.row, col: cell.col,
        witnessClueIds: [...allWitnesses],
        nakedSubsets: [...nakedSubsetsByKey.values()],
      });
      confirmed.set(character.id, cell);
      // No longer "still unplaced" — excluded from the final eliminated list
      // finalized below, even though this round's snapshot still mentions it.
      lastUnplacedIds.delete(character.id);
    }
  }

  const eliminated = [];
  for (const entry of lastWitnessOf.values()) {
    if (!lastUnplacedIds.has(entry.characterId)) continue;
    eliminated.push(entry);
  }

  return { confirmed, forced, eliminated, contradiction: null, evaluationsUsed: evaluations };
}
