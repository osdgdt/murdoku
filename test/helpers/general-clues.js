// Random cases whose clues are mostly about people in general («somebody on a pallet», «exactly 2 people next to a table»), for
// the tests of the reasonings that read them.
import { randomPuzzle, randomClueSpec, contextOf, rng } from "./random-puzzle.js";
import { buildPredicate } from "../../src/solver/predicates/index.js";
import { solvePuzzle } from "../../src/solver/solver.js";
import { placementsOf, sortedSolutions } from "./unique-case.js";
import { addClue } from "../../src/model/puzzle.js";

export const GENERAL = [
  "noOneInRoom",
  "noOneInRowOrCol",
  "noOneNear",
  "noOneWithProperty",
  "exactlyOneInRoom",
  "exactlyOneNear",
  "peopleNear",
];

export function caseWithGeneralClues(seed) {
  return randomPuzzle(seed, {
    maxClues: 2,
    extraClue: (puzzle, random, ctx) => {
      const n = 1 + Math.floor(random() * 3);
      for (let i = 0; i < n; i++) {
        const type = GENERAL[Math.floor(random() * GENERAL.length)];
        const spec = randomClueSpec(random, ctx, type);
        const clue = addClue(puzzle, spec.owner, spec.type, spec.params);
        if (spec.type.startsWith("noOne") ? random() < 0.6 : random() < 0.15) clue.negate = true;
      }
    },
  });
}

// A case with exactly one solution whose clues are mostly about people in general, every one true of the chosen solution.
export function uniqueWithGeneralClues(seed, types = GENERAL) {
  const puzzle = randomPuzzle(seed, { maxClues: 0 });
  const options = sortedSolutions(puzzle);
  if (options.length === 0) return null;
  const random = rng(seed * 7919 + 13);
  const chosen = placementsOf(options[Math.floor(random() * options.length)]);
  puzzle.solution.placements = [...chosen].map(([characterId, cell]) => ({ characterId, ...cell }));
  const ctx = contextOf(puzzle);
  for (let tries = 0; tries < 120; tries++) {
    if (solvePuzzle(puzzle, { maxSolutions: 2 }).length === 1) return puzzle;
    const type = random() < 0.7 ? types[Math.floor(random() * types.length)] : undefined;
    const spec = randomClueSpec(random, ctx, type);
    const clue = addClue(puzzle, spec.owner, spec.type, spec.params);
    if (spec.negate) clue.negate = true;
    if (buildPredicate(clue, puzzle)(chosen, true) !== true) puzzle.clues.pop();
  }
  return solvePuzzle(puzzle, { maxSolutions: 2 }).length === 1 ? puzzle : null;
}
