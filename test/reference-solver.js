// The plainest possible search, kept as the yardstick for the real solver (solver.js): every
// character in a fixed order (victim first), every free cell, every clue checked at each step. No
// domains, no ordering tricks, no propagation, no limits. It is slow on purpose and must stay
// simple: test-solver-differential.js checks that the optimised solver finds exactly the same
// solutions.
import { buildPredicates } from "../src/solver/predicates/index.js";
import { isOccupiable } from "../src/model/grid.js";

export function referenceSolutions(puzzle, { maxSolutions = Infinity } = {}) {
  const { rows, cols } = puzzle.grid.size;
  const characters = [...puzzle.characters].sort((a, b) => (b.isVictim ? 1 : 0) - (a.isVictim ? 1 : 0));
  if (characters.length === 0 || characters.length > rows || characters.length > cols) return [];
  const predicates = buildPredicates(puzzle);
  const placed = new Map();
  const usedRows = new Set();
  const usedCols = new Set();
  const found = [];

  const violates = () => {
    const complete = placed.size === characters.length;
    return predicates.some(({ predicate }) => predicate(placed, complete) === false);
  };

  function go(index) {
    if (found.length >= maxSolutions) return;
    if (index === characters.length) {
      if (!violates()) found.push(new Map(placed));
      return;
    }
    const character = characters[index];
    for (let r = 0; r < rows; r++) {
      if (usedRows.has(r)) continue;
      for (let c = 0; c < cols; c++) {
        if (usedCols.has(c) || !isOccupiable(puzzle.grid, r, c)) continue;
        placed.set(character.id, { row: r, col: c });
        usedRows.add(r);
        usedCols.add(c);
        if (!violates()) go(index + 1);
        usedRows.delete(r);
        usedCols.delete(c);
        placed.delete(character.id);
        if (found.length >= maxSolutions) return;
      }
    }
  }
  go(0);
  return found.map((m) =>
    characters
      .map((ch) => `${ch.id}:${m.get(ch.id).row},${m.get(ch.id).col}`)
      .sort()
      .join("|")
  );
}
