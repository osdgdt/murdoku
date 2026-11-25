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
  // With several maps in one (grid.sectors) the lines of one numbering repeat in each: wagons side by side (axis "col", the
  // default) have the same rows each, floors one above the other (axis "row") the same columns each. Two people clash when they
  // share a line of the shared numbering, or a repeated line INSIDE one map. The skyscraper is a 3D cube: a third kind of line is
  // the pillar, the same row of its floor and the same column through every floor.
  const strips = puzzle.grid.sectors || null;
  const floors = puzzle.grid.sectorAxis === "row";
  const stripOf = (index) => (strips ? strips.findIndex((s) => index >= s.first && index <= s.last) : 0);
  const rowLine = (r, c) => (strips && !floors ? `${stripOf(c)}:${r}` : `${r}`);
  const colLine = (r, c) => (strips && floors ? `${stripOf(r)}:${c}` : `${c}`);
  const pillarLine = (r, c) => (strips && floors ? `${r - strips[stripOf(r)].first}:${c}` : null);
  const across = floors ? cols : rows;
  const capacity = strips ? strips.reduce((sum, s) => sum + Math.min(across, s.last - s.first + 1), 0) : Math.min(rows, cols);
  if (characters.length === 0 || characters.length > capacity) return [];
  const predicates = buildPredicates(puzzle);
  const placed = new Map();
  const usedRows = new Set();
  const usedCols = new Set();
  const usedPillars = new Set();
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
      for (let c = 0; c < cols; c++) {
        const rowK = rowLine(r, c);
        const colK = colLine(r, c);
        const pillarK = pillarLine(r, c);
        if (usedRows.has(rowK) || usedCols.has(colK) || (pillarK !== null && usedPillars.has(pillarK)) || !isOccupiable(puzzle.grid, r, c))
          continue;
        placed.set(character.id, { row: r, col: c });
        usedRows.add(rowK);
        usedCols.add(colK);
        if (pillarK !== null) usedPillars.add(pillarK);
        if (!violates()) go(index + 1);
        usedRows.delete(rowK);
        usedCols.delete(colK);
        if (pillarK !== null) usedPillars.delete(pillarK);
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
