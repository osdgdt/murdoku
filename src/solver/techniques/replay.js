// The board of a HUMAN who solves a case the way the human solver does (engine.js), after each of its steps: the pencil
// notes (every character is a note on every cell, and each deduction takes some away), the X's (a cell where nobody can be
// any more, and the automatic X on the row and column of somebody placed) and the placements. Pure: no DOM.
// The editor shows it under «Come si risolve» (src/editor/replayView.js).
//
// The steps come in a compact form, small enough to travel from the worker (analysis.js):
//   { t: technique id, c: character id, p?: [row, col] (placed there), e?: [[row, col], …] (ruled out for c), k?: [clue ids], b?: [other character ids] }
// The state has the shape of the player's board (src/player/board.js createBoardState): placements, xMarks, candidates.
import { createBoardState, autoMarkRowCol, key } from "../../player/board.js";
import { isOccupiable } from "../../model/grid.js";

export const compactSteps = (steps) =>
  steps.map((step) => {
    const out = { t: step.technique, c: step.characterId };
    if (step.placed) out.p = [step.placed.row, step.placed.col];
    if (step.eliminated?.length) out.e = step.eliminated.map((cell) => [cell.row, cell.col]);
    if (step.clueIds?.length) out.k = step.clueIds;
    if (step.byCharacterIds?.length) out.b = step.byCharacterIds;
    return out;
  });

// The steps a person walks through: «row and column taken» is not one of them, because the automatic X that comes with a
// placement is exactly that. Each keeps `index` (its place among ALL the steps, from 1), so the list of reasonings, which counts
// every step, can point at it.
export function navigationSteps(compact) {
  const out = [];
  compact.forEach((step, i) => {
    if (step.t !== "rowColTaken") out.push({ ...step, index: i + 1 });
  });
  return out;
}

// the first navigation step (1-based position, 0 if none) at or after the step numbered `index` among all of them
export function navigationPositionOf(nav, index) {
  const at = nav.findIndex((step) => step.index >= index);
  return at < 0 ? 0 : at + 1;
}

function initialState(puzzle) {
  const state = createBoardState();
  const everybody = puzzle.characters.map((c) => c.id);
  for (let r = 0; r < puzzle.grid.size.rows; r++) {
    for (let c = 0; c < puzzle.grid.size.cols; c++) {
      if (isOccupiable(puzzle.grid, r, c)) state.candidates.set(key(r, c), new Set(everybody));
    }
  }
  return state;
}

function cloneState(state) {
  const copy = createBoardState();
  for (const [id, cell] of state.placements) copy.placements.set(id, { ...cell });
  for (const k of state.xMarks) copy.xMarks.add(k);
  for (const [k, set] of state.candidates) copy.candidates.set(k, new Set(set));
  return copy;
}

const cellOfKey = (k) => {
  const [row, col] = k.split(",").map(Number);
  return { row, col };
};

// Makes the cell an X when no note is left in it (and nobody stands there).
function crossIfEmpty(state, k, changed) {
  if (state.placements.size > 0) for (const cell of state.placements.values()) if (key(cell.row, cell.col) === k) return;
  if (state.xMarks.has(k)) return;
  const notes = state.candidates.get(k);
  if (notes && notes.size === 0) {
    state.xMarks.add(k);
    changed.push(cellOfKey(k));
  }
}

// Applies one step to `state`; returns the cells it touches (what a reader would see change).
function applyStep(state, grid, step) {
  const changed = [];
  const id = step.c;
  if (step.p) {
    const [row, col] = step.p;
    const here = key(row, col);
    state.placements.set(id, { row, col });
    state.candidates.delete(here);
    state.xMarks.delete(here);
    changed.push({ row, col });
    // the character is no longer a note anywhere (as when a player places somebody)
    for (const [k, set] of state.candidates) {
      if (set.delete(id)) crossIfEmpty(state, k, changed);
    }
    // the automatic X's on the row and the column
    for (const cell of autoMarkRowCol(state, grid, row, col)) changed.push(cell);
    return changed;
  }
  for (const [row, col] of step.e ?? []) {
    const k = key(row, col);
    const notes = state.candidates.get(k);
    if (notes?.delete(id)) {
      changed.push({ row, col });
      crossIfEmpty(state, k, changed);
    }
  }
  return changed;
}

// A replayer over the navigation steps `nav`: goTo(0) is the board before any step, goTo(n) the board after step n (1-based).
// Going back and forth is cheap: a copy of the board is kept every CHECKPOINT steps.
const CHECKPOINT = 25;
export function createReplayer(puzzle, nav) {
  const grid = puzzle.grid;
  const checkpoints = new Map([[0, initialState(puzzle)]]);
  let state = cloneState(checkpoints.get(0));
  let position = 0;
  let lastChanged = [];

  function goTo(target) {
    const k = Math.max(0, Math.min(nav.length, target));
    if (k === position && position > 0) return result();
    if (k < position || k === 0) {
      // restart from the last copy BEFORE step k, so that the last step is always applied here (and its cells are known)
      const base = Math.max(0, k - 1);
      let from = base - (base % CHECKPOINT);
      while (!checkpoints.has(from)) from -= CHECKPOINT;
      state = cloneState(checkpoints.get(from));
      position = from;
      lastChanged = [];
    }
    while (position < k) {
      lastChanged = applyStep(state, grid, nav[position]);
      position++;
      if (position % CHECKPOINT === 0 && !checkpoints.has(position)) checkpoints.set(position, cloneState(state));
    }
    return result();
  }
  const result = () => ({ state, changed: lastChanged, step: position > 0 ? nav[position - 1] : null, position });
  return { count: nav.length, goTo };
}
