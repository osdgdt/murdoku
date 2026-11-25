// Deterministic cases for measuring the solver on big grids (12x12 - 16x16): a random map of rooms and
// furniture, a random valid solution, and about four TRUE clues per suspect drawn at random (never a clue
// about the victim). Same (size, seed) always gives the same case, whatever the machine.
import { createPuzzle, addCharacter, setSolutionPlacement } from "../../src/model/puzzle.js";
import { resizeGrid, addZone, paintCellZone, placeObject } from "../../src/model/grid.js";
import { validateSolution } from "../../src/solver/validator.js";
import { suggestClues } from "../../src/solver/suggestions.js";
import { solvePuzzle, WORK_NODE_WEIGHT } from "../../src/solver/solver.js";
import { rng, isNewerClue } from "../helpers/random-puzzle.js";

const OBJECT_TYPES = ["chair", "plant", "table", "lamp", "rug", "shelf"];

function randomMap(n, random) {
  const puzzle = createPuzzle(`bench ${n}`);
  puzzle.grid = resizeGrid(puzzle.grid, n, n);
  const zoneCount = Math.max(3, Math.round(n / 2));
  const zones = [];
  for (let i = 0; i < zoneCount; i++) zones.push(addZone(puzzle.grid, `Z${i}`, "#cccccc", "wood").id);
  // rooms grown from random seeds, one cell at a time, until the grid is covered
  const owner = Array.from({ length: n }, () => Array(n).fill(-1));
  const frontier = [];
  zones.forEach((_, i) => {
    const r = Math.floor(random() * n);
    const c = Math.floor(random() * n);
    if (owner[r][c] === -1) {
      owner[r][c] = i;
      frontier.push([r, c]);
    }
  });
  while (frontier.length) {
    const k = Math.floor(random() * frontier.length);
    const [r, c] = frontier[k];
    const free = [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && owner[a][b] === -1);
    if (!free.length) {
      frontier.splice(k, 1);
      continue;
    }
    const [a, b] = free[Math.floor(random() * free.length)];
    owner[a][b] = owner[r][c];
    frontier.push([a, b]);
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (owner[r][c] >= 0) paintCellZone(puzzle.grid, r, c, zones[owner[r][c]]);
  for (let i = 0; i < 2 * n; i++)
    placeObject(puzzle.grid, OBJECT_TYPES[i % OBJECT_TYPES.length], Math.floor(random() * n), Math.floor(random() * n));
  return puzzle;
}

// An n x n case with n characters (the last is the victim) and `perSuspect` true clues each; null if no
// valid solution was found for that seed (cannot happen for the seeds listed in baseline.json).
export function benchCase(n, seed, { perSuspect = 4 } = {}) {
  const random = rng(seed * 1009 + n);
  const puzzle = randomMap(n, random);
  for (let i = 0; i < n; i++) {
    const character = addCharacter(puzzle, `P${i}`, undefined, i === n - 1);
    character.gender = i % 2 ? "male" : "female";
  }
  let placed = null;
  for (let attempt = 0; attempt < 5000 && !placed; attempt++) {
    const perm = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    puzzle.characters.forEach((c, i) => setSolutionPlacement(puzzle, c.id, i, perm[i]));
    if (validateSolution(puzzle).valid) placed = true;
  }
  if (!placed) return null;
  const solution = new Map(puzzle.solution.placements.map((p) => [p.characterId, { row: p.row, col: p.col }]));
  const clues = [];
  for (const suspect of puzzle.characters.filter((c) => !c.isVictim)) {
    const { clues: own } = suggestClues(puzzle, solution, { ownerId: suspect.id, limit: 20000, maxEvaluations: 400000 });
    const mine = own.filter((c) => c.characterId === suspect.id && !isNewerClue(c)); // see NEWER_TYPE_IDS
    for (let k = 0; k < perSuspect && mine.length; k++) clues.push(mine[Math.floor(random() * mine.length)]);
  }
  puzzle.clues = clues.map((c, i) => ({ id: `c${i}`, ...c }));
  return puzzle;
}

// The cost of a search, machine-independent: clue evaluations plus a charge per node. Measured on a hard 9x9 case with
// and without forward checking, time came out as ~0.33 µs per evaluation + ~1 µs per node, so a node weighs 3 evaluations.
// Unlike the node count, `work` stays comparable when the search strategy changes (a node with forward checking costs
// ~30 µs, one without ~2 µs).
export const NODE_WEIGHT = WORK_NODE_WEIGHT;
export const workOf = ({ nodes, evaluations }) => evaluations + NODE_WEIGHT * nodes;

// What a check of uniqueness costs on `puzzle`, under a node budget: how the search ended and how much work it took.
export function measure(
  puzzle,
  { maxNodes = 20000, maxWork = Infinity, incremental = true, forwardCheck = true, forwardCheckMinRemaining = 0 } = {}
) {
  const stats = {};
  const started = performance.now();
  const solutions = solvePuzzle(puzzle, { maxSolutions: 2, maxNodes, maxWork, stats, forwardCheck, forwardCheckMinRemaining, incremental });
  const result = {
    solutions: solutions.length,
    capped: !!(stats.nodeCapHit || stats.workCapHit),
    nodes: stats.nodesVisited,
    evaluations: stats.evaluations,
    ms: Math.round(performance.now() - started),
  };
  return { ...result, work: workOf(result) };
}
