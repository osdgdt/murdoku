// Which reasoning explains a hint. The hints (hints.js) are found by propagation and search and explained by the clues
// involved; this names, for each one, the reasoning of the catalogue (catalog.js) that gets there, by following the human
// solver from the player's board and finding the step that establishes the same fact.
import { humanSolve } from "./engine.js";

// Work the human solver may spend on this (a hint must stay quick; past it the hint simply carries no reasoning name).
export const HINT_TECHNIQUE_WORK = 2_000_000;

const cellKey = (characterId, row, col) => `${characterId}:${row},${col}`;

// Sets `step.technique` (a catalogue id) on the forcedPlacement / eliminatedCell steps it can explain. Never throws, never
// changes anything else: a hint without a reasoning name is still a good hint.
export function attachTechniques(puzzle, steps, placements, { maxWork = HINT_TECHNIQUE_WORK } = {}) {
  if (!steps.some((s) => s.type === "forcedPlacement" || s.type === "eliminatedCell")) return;
  let solved;
  try {
    solved = humanSolve(puzzle, { placements, maxWork });
  } catch {
    return;
  }
  if (solved.status !== "solved") return;
  const eliminatedBy = new Map(); // "character:row,col" -> the first reasoning that ruled the cell out
  const closedBy = new Map(); // character -> the last reasoning that took a cell away from them before they were placed
  const placedBy = new Map(); // "character:row,col" -> the reasoning that placed them there
  for (const step of solved.steps) {
    for (const { row, col } of step.eliminated ?? []) {
      const key = cellKey(step.characterId, row, col);
      if (!eliminatedBy.has(key)) eliminatedBy.set(key, step.technique);
    }
    if (step.eliminated?.length) closedBy.set(step.characterId, step.technique);
    if (step.placed) placedBy.set(cellKey(step.characterId, step.placed.row, step.placed.col), step.technique);
  }
  for (const step of steps) {
    if (step.type === "eliminatedCell") {
      const id = eliminatedBy.get(cellKey(step.characterId, step.row, step.col));
      if (id) step.technique = id;
    } else if (step.type === "forcedPlacement") {
      // what finally left the character a single cell, else the placement itself
      const id = closedBy.get(step.characterId) ?? placedBy.get(cellKey(step.characterId, step.row, step.col));
      if (id) step.technique = id;
    }
  }
}
