import { buildPredicates } from "./predicates.js";
import { describeClue } from "../model/clueTypes.js";
import { solvePuzzle } from "./solver.js";

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
    violations.push({ clueId: null, characterId: null, message: "Non tutti i personaggi hanno una posizione nella soluzione." });
  }

  if (hasRowColConflict(placements)) {
    violations.push({ clueId: null, characterId: null, message: "Due o più personaggi condividono riga o colonna." });
  }

  const pm = placementsToMap(placements);
  const predicates = buildPredicates(puzzle);
  for (const { clue, predicate } of predicates) {
    const result = predicate(pm, true);
    if (result === false) {
      const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
      const ownerLabel = owner ? owner.name : "Indizio generale";
      violations.push({
        clueId: clue.id,
        characterId: clue.characterId,
        message: `${ownerLabel}: ${describeClue(clue, puzzle)}`,
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
export function checkUniqueness(puzzle, { maxSolutions = 2, maxNodes = Infinity } = {}) {
  const stats = {};
  const solutions = solvePuzzle(puzzle, { maxSolutions, maxNodes, stats });
  return {
    solutionCount: solutions.length,
    unique: solutions.length === 1,
    solutions,
    truncated: solutions.length >= maxSolutions || !!stats.nodeCapHit,
    nodesVisited: stats.nodesVisited,
  };
}
