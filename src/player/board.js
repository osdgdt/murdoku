import { isOccupiable } from "../model/grid.js";

export function createBoardState() {
  return {
    placements: new Map(), // characterId -> {row,col}
    xMarks: new Set(), // "row,col"
    candidates: new Map(), // "row,col" -> Set<characterId>
    lineNotes: new Map(), // "row:N" / "col:N" -> Set<characterId> — notes on a whole row/column, drawn on the board's outer edge
    autoXByCharacter: new Map(), // characterId -> [{row,col}...] X's auto-marked alongside that placement
    undoStack: [],
    selectedTool: null, // {kind:'character', id} | {kind:'x'} | {kind:'erase'}
    // Count of hint-button clicks that disclosed real information during
    // this solve (see gameScreen.js's onHint). Unlike undoStack/selectedTool,
    // this DOES need to survive serialize/deserialize + reload: the "solved
    // without hints" achievement must stay honest even if the player
    // reloads mid-solve after already using a hint.
    hintsUsed: 0,
  };
}

export function key(row, col) {
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
    lineNotes: [...state.lineNotes.entries()].map(([k, set]) => [k, [...set]]),
    autoXByCharacter: [...state.autoXByCharacter.entries()],
    hintsUsed: state.hintsUsed,
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
    // Saved before row/column notes existed: none.
    state.lineNotes = new Map((saved.lineNotes || []).map(([k, arr]) => [k, new Set(arr)]));
    // Progress saved before this feature existed lacks `hintsUsed` — fall
    // back to 0 (assume hint-free) instead of leaving it undefined.
    state.hintsUsed = Number.isFinite(saved.hintsUsed) && saved.hintsUsed >= 0 ? saved.hintsUsed : 0;
  } catch {
    return createBoardState();
  }
  return state;
}

export function occupiedBy(state, row, col) {
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

function lineKey(kind, index) {
  return `${kind}:${index}`;
}

// A tap on a row/column label (the board's outer edge): the same note toggle a
// cell tap does, but for "this character is somewhere in this whole row/column".
// The eraser clears every note on that line; the X tool has no meaning there.
export function handleLineTap(state, kind, index, tool = state.selectedTool) {
  if (!tool) return { ok: false };
  const k = lineKey(kind, index);
  if (tool.kind === "character") {
    let set = state.lineNotes.get(k);
    const had = !!set && set.has(tool.id);
    if (had) {
      set.delete(tool.id);
      if (set.size === 0) state.lineNotes.delete(k);
    } else {
      if (!set) {
        set = new Set();
        state.lineNotes.set(k, set);
      }
      set.add(tool.id);
    }
    state.undoStack.push({ type: "lineNote", key: k, characterId: tool.id, added: !had });
    return { ok: true };
  }
  if (tool.kind === "erase") {
    const set = state.lineNotes.get(k);
    if (!set || set.size === 0) return { ok: false };
    state.undoStack.push({ type: "lineNotes-clear", key: k, before: new Set(set) });
    state.lineNotes.delete(k);
    return { ok: true };
  }
  return { ok: false };
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

// Removes characterId from every cell that has a candidate note for them,
// anywhere on the board (not just the destination cell) — placing a
// character resolves the question their notes were tracking, so old
// suspicions elsewhere on the board no longer mean anything. Returns the
// touched cell keys, so undo() can restore exactly those and only those.
function clearLineNotesForCharacter(state, characterId) {
  const cleared = [];
  for (const [k, set] of state.lineNotes) {
    if (set.has(characterId)) {
      set.delete(characterId);
      cleared.push(k);
      if (set.size === 0) state.lineNotes.delete(k);
    }
  }
  return cleared;
}

function clearCandidatesForCharacter(state, characterId) {
  const cleared = [];
  for (const [k, set] of state.candidates) {
    if (set.has(characterId)) {
      set.delete(characterId);
      cleared.push(k);
      if (set.size === 0) state.candidates.delete(k);
    }
  }
  return cleared;
}

// A single tap (press-and-release without leaving the pressed cell, or a
// keyboard Enter/Space — see boardRender.js): segna/toglie una nota for the
// selected character, or behaves as before for X/eraser (unaffected by the
// tap-vs-hold gesture split — they never depended on a mode flag). `tool`
// defaults to the live `state.selectedTool`, but a caller can pass an
// explicit one instead — see handleCellHold's own `tool` param for why.
export function handleCellTap(state, grid, row, col, tool = state.selectedTool) {
  if (!tool) return { ok: false };
  if (!isOccupiable(grid, row, col)) return { ok: false, reason: "blocked" };

  if (tool.kind === "character") {
    if (occupiedBy(state, row, col)) return { ok: false, reason: "cell-occupied" };
    toggleCandidate(state, tool.id, row, col);
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

// A press held still on one cell past the hold threshold (see
// boardRender.js's HOLD_THRESHOLD_MS), or Shift+Enter from the keyboard:
// confirms the selected character there, wiping every candidate note they
// had anywhere else on the board. For X/eraser this has no meaning distinct
// from a tap — delegates straight to handleCellTap so an unusually slow
// press on those tools doesn't just do nothing.
//
// `tool` defaults to the live `state.selectedTool`, but gameScreen.js passes
// an explicit one pinned at the moment the press STARTED (via renderBoard's
// onPressStart) — the hold timer can take up to HOLD_THRESHOLD_MS to fire,
// and during that wait something else could reassign state.selectedTool
// (e.g. a hint step auto-selecting a character, triggered by a second,
// unrelated touch elsewhere on the page while this hold is still pending) —
// without pinning, the hold would confirm whatever tool ended up selected by
// the time the timer fires, not the one the player was actually pressing for.
export function handleCellHold(state, grid, row, col, tool = state.selectedTool) {
  if (!tool) return { ok: false };
  if (!isOccupiable(grid, row, col)) return { ok: false, reason: "blocked" };
  if (tool.kind !== "character") return handleCellTap(state, grid, row, col, tool);

  const occupant = occupiedBy(state, row, col);
  if (occupant === tool.id) {
    // Holding the cell they're already confirmed in removes them.
    removePlacement(state, tool.id);
    return { ok: true };
  }
  if (occupant) return { ok: false, reason: "cell-occupied" };
  if (rowColUsed(state, row, col, tool.id)) {
    return { ok: false, reason: "row-col-conflict" };
  }
  const before = state.placements.get(tool.id) || null;
  const removedAutoX = takeAutoX(state, tool.id); // stale X's from their old cell, if moving
  const clearedCandidates = clearCandidatesForCharacter(state, tool.id);
  const clearedLineNotes = clearLineNotesForCharacter(state, tool.id);
  state.placements.set(tool.id, { row, col });
  state.xMarks.delete(key(row, col));
  state.candidates.delete(key(row, col));
  const autoXMarks = autoMarkRowCol(state, grid, row, col);
  state.autoXByCharacter.set(tool.id, autoXMarks);
  state.undoStack.push({ type: "place", characterId: tool.id, before, removedAutoX, autoXMarks, clearedCandidates, clearedLineNotes });
  return { ok: true };
}

// Continuation of a drag started by a hold-timer conversion (see
// boardRender.js's convertToDrag): paints (forces on) instead of toggling, so
// dragging back over an already-marked cell doesn't flip it off again.
// Placement never drags — only handleCellHold confirms a character; a
// dragged stroke always means "note" (or X/erase, unchanged from before).
export function handleCellDrag(state, grid, row, col) {
  const tool = state.selectedTool;
  if (!tool) return { ok: false };
  if (!isOccupiable(grid, row, col)) return { ok: false, reason: "blocked" };

  if (tool.kind === "character") {
    if (occupiedBy(state, row, col)) return { ok: false };
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
    // safe to repeat per dragged-over cell — just reuse the tap handler.
    return handleCellTap(state, grid, row, col);
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
    // Restore this character's notes that were wiped when this placement was
    // made (see clearCandidatesForCharacter in handleCellHold) — precise,
    // cell-by-cell restoration, mirroring the autoX undo above.
    for (const k of action.clearedCandidates || []) {
      let set = state.candidates.get(k);
      if (!set) {
        set = new Set();
        state.candidates.set(k, set);
      }
      set.add(action.characterId);
    }
    for (const k of action.clearedLineNotes || []) {
      let set = state.lineNotes.get(k);
      if (!set) {
        set = new Set();
        state.lineNotes.set(k, set);
      }
      set.add(action.characterId);
    }
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
  } else if (action.type === "lineNote") {
    let set = state.lineNotes.get(action.key);
    if (action.added) {
      if (set) {
        set.delete(action.characterId);
        if (set.size === 0) state.lineNotes.delete(action.key);
      }
    } else {
      if (!set) {
        set = new Set();
        state.lineNotes.set(action.key, set);
      }
      set.add(action.characterId);
    }
  } else if (action.type === "lineNotes-clear") {
    state.lineNotes.set(action.key, new Set(action.before));
  }
}

export function clearAll(state) {
  state.placements.clear();
  state.xMarks.clear();
  state.candidates.clear();
  state.lineNotes.clear();
  state.autoXByCharacter.clear();
  state.undoStack = [];
  // hintsUsed is deliberately NOT reset here: "pulisci tutto" wipes the
  // board, not the player's memory of what a hint already revealed —
  // resetting it would let someone hint once, clear everything, then refill
  // from memory and still qualify for "solved senza indizi".
}
