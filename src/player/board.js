import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { isOccupiable } from "../model/grid.js";
import { characterColor } from "../model/puzzle.js";

export function createBoardState() {
  return {
    placements: new Map(), // characterId -> {row,col}
    xMarks: new Set(), // "row,col"
    candidates: new Map(), // "row,col" -> Set<characterId>
    autoXByCharacter: new Map(), // characterId -> [{row,col}...] X's auto-marked alongside that placement
    notesMode: false,
    undoStack: [],
    selectedTool: null, // {kind:'character', id} | {kind:'x'} | {kind:'erase'}
  };
}

function key(row, col) {
  return `${row},${col}`;
}

// Plain-JSON snapshot of the parts of board state worth resurrecting after
// leaving and reopening a puzzle (Maps/Sets aren't JSON-safe on their own).
// The undo stack and the currently-selected tool are deliberately left out —
// they're session-local scratch, not meaningful once you've come back later.
export function serializeBoardState(state) {
  return {
    placements: [...state.placements.entries()],
    xMarks: [...state.xMarks],
    candidates: [...state.candidates.entries()].map(([k, set]) => [k, [...set]]),
    autoXByCharacter: [...state.autoXByCharacter.entries()],
    notesMode: state.notesMode,
  };
}

// Inverse of serializeBoardState — tolerant of a missing/malformed snapshot
// (new puzzle never played before, or a corrupted localStorage entry), in
// which case it just returns a fresh, empty board state.
export function deserializeBoardState(saved) {
  const state = createBoardState();
  if (!saved || typeof saved !== "object") return state;
  try {
    state.placements = new Map(saved.placements || []);
    state.xMarks = new Set(saved.xMarks || []);
    state.candidates = new Map((saved.candidates || []).map(([k, arr]) => [k, new Set(arr)]));
    state.autoXByCharacter = new Map(saved.autoXByCharacter || []);
    state.notesMode = !!saved.notesMode;
  } catch {
    return createBoardState();
  }
  return state;
}

function occupiedBy(state, row, col) {
  for (const [charId, pos] of state.placements) {
    if (pos.row === row && pos.col === col) return charId;
  }
  return null;
}

function rowColUsed(state, row, col, excludeCharId) {
  for (const [charId, pos] of state.placements) {
    if (charId === excludeCharId) continue;
    if (pos.row === row || pos.col === col) return true;
  }
  return false;
}

function toggleCandidate(state, characterId, row, col) {
  const k = key(row, col);
  let set = state.candidates.get(k);
  const had = set ? set.has(characterId) : false;
  if (had) {
    set.delete(characterId);
    if (set.size === 0) state.candidates.delete(k);
  } else {
    if (!set) {
      set = new Set();
      state.candidates.set(k, set);
    }
    set.add(characterId);
  }
  state.undoStack.push({ type: "candidate", row, col, characterId, added: !had });
}

// After confirming a character, auto-mark X on the rest of that row/column
// (Sudoku-style "one per row/col" already rules those cells out for everyone
// else) — skips cells that aren't occupiable, are already occupied, or are
// already X-marked. Returns the list of cells it actually marked, so the
// caller can undo — or later retract — them together with the placement.
function autoMarkRowCol(state, grid, row, col) {
  const marked = [];
  const tryMark = (r, c) => {
    const k = key(r, c);
    if (!isOccupiable(grid, r, c) || occupiedBy(state, r, c) || state.xMarks.has(k)) return;
    state.xMarks.add(k);
    marked.push({ row: r, col: c });
  };
  for (let r = 0; r < grid.size.rows; r++) {
    if (r !== row) tryMark(r, col);
  }
  for (let c = 0; c < grid.size.cols; c++) {
    if (c !== col) tryMark(row, c);
  }
  return marked;
}

// Retracts (and returns) the X's currently attributed to a character's
// placement — used both when the character is moved (its old cell's auto-X's
// are no longer certain) and when its placement is removed entirely.
function takeAutoX(state, characterId) {
  const marks = state.autoXByCharacter.get(characterId) || [];
  for (const { row, col } of marks) state.xMarks.delete(key(row, col));
  state.autoXByCharacter.delete(characterId);
  return marks;
}

// Removes a character's placement — clicking their own cell again, or the
// eraser — and retracts whatever X's were auto-marked alongside it, since
// those cells are no longer necessarily ruled out once that character isn't
// there. Returns false if the character wasn't placed to begin with.
function removePlacement(state, characterId) {
  const before = state.placements.get(characterId);
  if (!before) return false;
  state.placements.delete(characterId);
  const removedAutoX = takeAutoX(state, characterId);
  state.undoStack.push({ type: "remove", characterId, before, removedAutoX });
  return true;
}

export function handleCellClick(state, grid, row, col) {
  const tool = state.selectedTool;
  if (!tool) return { ok: false };
  if (!isOccupiable(grid, row, col)) return { ok: false, reason: "blocked" };

  if (tool.kind === "character") {
    if (state.notesMode) {
      if (occupiedBy(state, row, col)) return { ok: false, reason: "cell-occupied" };
      toggleCandidate(state, tool.id, row, col);
      return { ok: true };
    }
    const occupant = occupiedBy(state, row, col);
    if (occupant === tool.id) {
      // Clicking the cell they're already confirmed in removes them.
      removePlacement(state, tool.id);
      return { ok: true };
    }
    if (occupant) return { ok: false, reason: "cell-occupied" };
    if (rowColUsed(state, row, col, tool.id)) {
      return { ok: false, reason: "row-col-conflict" };
    }
    const before = state.placements.get(tool.id) || null;
    const removedAutoX = takeAutoX(state, tool.id); // stale X's from their old cell, if moving
    state.placements.set(tool.id, { row, col });
    state.xMarks.delete(key(row, col));
    state.candidates.delete(key(row, col));
    const autoXMarks = autoMarkRowCol(state, grid, row, col);
    state.autoXByCharacter.set(tool.id, autoXMarks);
    state.undoStack.push({ type: "place", characterId: tool.id, before, removedAutoX, autoXMarks });
    return { ok: true };
  }

  if (tool.kind === "x") {
    if (occupiedBy(state, row, col)) return { ok: false, reason: "cell-occupied" };
    const k = key(row, col);
    if (state.xMarks.has(k)) {
      state.xMarks.delete(k);
      state.undoStack.push({ type: "unmark", row, col });
    } else {
      state.xMarks.add(k);
      state.undoStack.push({ type: "mark", row, col });
    }
    return { ok: true };
  }

  if (tool.kind === "erase") {
    const occupant = occupiedBy(state, row, col);
    if (occupant) {
      removePlacement(state, occupant);
      return { ok: true };
    }
    const k = key(row, col);
    if (state.xMarks.has(k)) {
      state.xMarks.delete(k);
      state.undoStack.push({ type: "unmark", row, col });
      return { ok: true };
    }
    if (state.candidates.has(k)) {
      const before = new Set(state.candidates.get(k));
      state.candidates.delete(k);
      state.undoStack.push({ type: "candidates-clear", row, col, before });
      return { ok: true };
    }
    return { ok: false };
  }

  return { ok: false };
}

// Continuation of a mouse drag started with handleCellClick: paints (forces
// on) instead of toggling, so dragging back over an already-marked cell
// doesn't flip it off again. Placement itself never drags — only the first
// cell of a stroke can confirm a character; a stroke past it only marks
// candidates (notes mode), X's, or erases.
export function handleCellDrag(state, grid, row, col) {
  const tool = state.selectedTool;
  if (!tool) return { ok: false };
  if (!isOccupiable(grid, row, col)) return { ok: false, reason: "blocked" };

  if (tool.kind === "character") {
    if (!state.notesMode || occupiedBy(state, row, col)) return { ok: false };
    const k = key(row, col);
    let set = state.candidates.get(k);
    if (set && set.has(tool.id)) return { ok: true };
    if (!set) {
      set = new Set();
      state.candidates.set(k, set);
    }
    set.add(tool.id);
    state.undoStack.push({ type: "candidate", row, col, characterId: tool.id, added: true });
    return { ok: true };
  }

  if (tool.kind === "x") {
    if (occupiedBy(state, row, col)) return { ok: false, reason: "cell-occupied" };
    const k = key(row, col);
    if (!state.xMarks.has(k)) {
      state.xMarks.add(k);
      state.undoStack.push({ type: "mark", row, col });
    }
    return { ok: true };
  }

  if (tool.kind === "erase") {
    // Erasing is already a one-way removal (no toggle), so it's inherently
    // safe to repeat per dragged-over cell — just reuse the click handler.
    return handleCellClick(state, grid, row, col);
  }

  return { ok: false };
}

export function undo(state) {
  const action = state.undoStack.pop();
  if (!action) return;
  if (action.type === "place") {
    if (action.before) state.placements.set(action.characterId, action.before);
    else state.placements.delete(action.characterId);
    // Undo this placement/move: retract the X's it added...
    for (const { row, col } of action.autoXMarks || []) state.xMarks.delete(key(row, col));
    // ...and restore whatever X's it had retracted from the character's
    // previous cell, if this was a move rather than a fresh placement.
    for (const { row, col } of action.removedAutoX || []) state.xMarks.add(key(row, col));
    if (action.before) state.autoXByCharacter.set(action.characterId, action.removedAutoX || []);
    else state.autoXByCharacter.delete(action.characterId);
  } else if (action.type === "remove") {
    state.placements.set(action.characterId, action.before);
    for (const { row, col } of action.removedAutoX || []) state.xMarks.add(key(row, col));
    state.autoXByCharacter.set(action.characterId, action.removedAutoX || []);
  } else if (action.type === "mark") {
    state.xMarks.delete(key(action.row, action.col));
  } else if (action.type === "unmark") {
    state.xMarks.add(key(action.row, action.col));
  } else if (action.type === "candidate") {
    const k = key(action.row, action.col);
    let set = state.candidates.get(k);
    if (action.added) {
      if (set) {
        set.delete(action.characterId);
        if (set.size === 0) state.candidates.delete(k);
      }
    } else {
      if (!set) {
        set = new Set();
        state.candidates.set(k, set);
      }
      set.add(action.characterId);
    }
  } else if (action.type === "candidates-clear") {
    state.candidates.set(key(action.row, action.col), new Set(action.before));
  }
}

export function clearAll(state) {
  state.placements.clear();
  state.xMarks.clear();
  state.candidates.clear();
  state.autoXByCharacter.clear();
  state.undoStack = [];
}

// Fixed "box cell" position (like Sudoku pencil marks): each character keeps
// the same slot (0-8, laid out 3x3) in every cell's candidate grid, based on
// its order in the roster. Grids have at most 9 characters, so it always fits.
// `highlightId`, when set, marks that character's own notes across the whole
// board — e.g. while their toolbar chip is selected — so you can spot every
// cell you've already suspected them in at a glance.
function renderCandidateGrid(cellNode, puzzle, candidateSet, highlightId) {
  const slots = new Array(9).fill(null);
  puzzle.characters.forEach((character, index) => {
    if (index < 9) slots[index] = character;
  });

  const grid = document.createElement("div");
  grid.className = "candidate-grid";
  for (const character of slots) {
    const slot = document.createElement("div");
    slot.className = "candidate-slot";
    if (character && candidateSet.has(character.id)) {
      const mark = document.createElement("span");
      mark.className = "candidate-mark" + (character.id === highlightId ? " highlighted" : "");
      const markColor = character.isVictim ? "var(--danger)" : characterColor(character);
      mark.style.color = markColor;
      // Kept as its own custom property (not just currentColor) so the
      // highlighted badge can recolor its background to this while the text
      // itself switches to a fixed light color, independently.
      mark.style.setProperty("--mark-color", markColor);
      mark.title = character.name;
      mark.textContent = character.name.charAt(0).toUpperCase();
      slot.appendChild(mark);
    }
    grid.appendChild(slot);
  }
  cellNode.appendChild(grid);
}

// `onCellDown` fires once when a cell is pressed (identical to the old
// click-based behavior); `onCellEnter` fires again for each further cell the
// pointer enters while still held, letting a single drag stroke mark
// candidates/X's across several cells instead of one click each.
export function renderPlayerBoard(container, puzzle, state, onCellDown, onCellEnter) {
  renderBoard(container, puzzle.grid, {
    onCellDown,
    onCellEnter,
    decorateCell: (cellNode, row, col) => {
      const occupant = occupiedBy(state, row, col);
      if (occupant) {
        const character = puzzle.characters.find((c) => c.id === occupant);
        if (character) {
          const token = document.createElement("div");
          token.className = "char-token";
          token.style.background = character.isVictim ? "var(--danger)" : characterColor(character);
          token.title = character.name;
          token.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
          cellNode.appendChild(token);
        }
        return;
      }
      if (state.xMarks.has(key(row, col))) {
        cellNode.classList.add("x-mark");
        return;
      }
      const candidateSet = state.candidates.get(key(row, col));
      if (candidateSet && candidateSet.size > 0) {
        const highlightId = state.selectedTool?.kind === "character" ? state.selectedTool.id : null;
        renderCandidateGrid(cellNode, puzzle, candidateSet, highlightId);
      }
    },
  });
}
