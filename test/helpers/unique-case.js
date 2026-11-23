// Random little cases with exactly one solution, for the tests of the human solver and of its replay.
import { randomPuzzle, rng } from "./random-puzzle.js";
import { suggestClues } from "../../src/solver/suggestions.js";
import { solvePuzzle } from "../../src/solver/solver.js";
import { referenceSolutions } from "../reference-solver.js";

// "id:row,col" for every character of a reference solution string, as a Map
export function placementsOf(solutionKey) {
  const map = new Map();
  for (const part of solutionKey.split("|")) {
    const [id, cell] = part.split(":");
    const [row, col] = cell.split(",").map(Number);
    map.set(id, { row, col });
  }
  return map;
}

// The reference solutions in an order that does not depend on the (time-based, so different every run) character ids: by where the
// characters stand, in the order of the characters. Tests that pick "the n-th solution" and count how often a reasoning is used
// would otherwise change from one run to the next.
export function sortedSolutions(puzzle) {
  const order = puzzle.characters.map((c) => c.id);
  const signature = (key) => {
    const where = placementsOf(key);
    return order.map((id) => `${where.get(id)?.row},${where.get(id)?.col}`).join(" ");
  };
  return referenceSolutions(puzzle).sort((a, b) => (signature(a) < signature(b) ? -1 : signature(a) > signature(b) ? 1 : 0));
}

// A random case with exactly one solution: a solution is picked among those of the bare case, then TRUE clues (drawn at
// random from every clue the solution satisfies) are added until nothing else is left. null when the bare case has no solution.
export function uniqueCase(seed, { sizeBias = 0 } = {}) {
  const puzzle = randomPuzzle(seed, { maxClues: 0 });
  const options = sortedSolutions(puzzle);
  if (options.length === 0) return null;
  const random = rng(seed * 7919 + sizeBias);
  const chosen = placementsOf(options[Math.floor(random() * options.length)]);
  puzzle.solution.placements = [...chosen].map(([characterId, cell]) => ({ characterId, ...cell }));
  const pool = suggestClues(puzzle, chosen, { limit: 400 }).clues;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  puzzle.clues = [];
  for (const entry of pool) {
    const clue = { ...entry };
    delete clue.generic;
    if (solvePuzzle(puzzle, { maxSolutions: 2 }).length === 1) break;
    puzzle.clues.push({ id: `h${puzzle.clues.length}`, ...clue });
  }
  return solvePuzzle(puzzle, { maxSolutions: 2 }).length === 1 ? puzzle : null;
}
