// How the player board looks: candidate notes, line notes, tokens and X marks
// drawn on top of the shared grid (util/boardRender.js). The state and rules
// are in board.js.
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { characterColor } from "../model/puzzle.js";
import { key, occupiedBy } from "./board.js";
import { cellAriaLabel } from "./announcements.js";
import { t } from "../i18n/i18n.js";

// One note badge: a paper-colored disc ringed in the character's own color with
// their initial on it, so it reads on ANY floor (the old bare colored letter
// vanished on floors of a similar color).
function makeMark(character, highlightId) {
  const mark = document.createElement("span");
  mark.className = "candidate-mark" + (character.id === highlightId ? " highlighted" : "");
  mark.style.setProperty("--mark-color", character.isVictim ? "var(--danger)" : characterColor(character));
  mark.title = character.name;
  mark.textContent = character.name.charAt(0).toUpperCase();
  return mark;
}

// Fixed "box cell" position (like Sudoku pencil marks): each character keeps
// the same slot in every cell's candidate grid, based on its order in the
// roster. Up to 9 characters the slots are a 3x3 box, from 10 to 16 a 4x4 box
// (a case has at most 16 characters, one per row and column), so it always fits.
// `highlightId`, when set, marks that character's own notes across the whole
// board — e.g. while their toolbar chip is selected — so you can spot every
// cell you've already suspected them in at a glance.
//
// A cell that holds an object (a rug, a chair, a stool) gets the COMPACT
// layout instead: the object is drawn smaller on top and the notes sit in a
// band below it, so a note never lands on the drawing.
// Columns of the note box: 3 for up to 9 characters, 4 for 10 to 16.
export const noteColumns = (characterCount) => (characterCount > 9 ? 4 : 3);

function renderCandidateGrid(cellNode, puzzle, candidateSet, highlightId, compact) {
  const grid = document.createElement("div");
  const cols = noteColumns(puzzle.characters.length);
  grid.className = "candidate-grid" + (compact ? " compact" : "") + (cols === 4 ? " notes-4" : "");
  if (compact) {
    puzzle.characters.forEach((character) => {
      if (candidateSet.has(character.id)) grid.appendChild(makeMark(character, highlightId));
    });
  } else {
    // Only the slots that hold a note exist (each at its fixed place in the box): an empty cell of the box costs nothing, and a
    // board full of notes used to be thousands of empty divs.
    grid.style.setProperty("--note-cols", String(cols));
    puzzle.characters.forEach((character, i) => {
      if (!candidateSet.has(character.id)) return;
      const slot = document.createElement("div");
      slot.className = "candidate-slot";
      slot.dataset.slot = String(i + 1);
      slot.style.gridRow = String(Math.floor(i / cols) + 1);
      slot.style.gridColumn = String((i % cols) + 1);
      slot.appendChild(makeMark(character, highlightId));
      grid.appendChild(slot);
    });
  }
  cellNode.appendChild(grid);
}

const markColor = (character) => (character.isVictim ? "var(--danger)" : characterColor(character));
const initialOf = (character) => character.name.charAt(0).toUpperCase();

// The sign of a row/column reserved for one character: a small badge in their colour, in the label on the board's edge.
function renderLineReserve(labelNode, puzzle, characterId) {
  const character = characterId && puzzle.characters.find((c) => c.id === characterId);
  if (!character) return;
  const badge = document.createElement("span");
  badge.className = "line-reserve";
  badge.style.setProperty("--mark-color", markColor(character));
  badge.title = t("Riservata a {name}", { name: character.name });
  badge.textContent = initialOf(character);
  labelNode.appendChild(badge);
}

// Notes on a whole row/column, drawn inside its label on the board's edge.
function renderLineNotes(labelNode, puzzle, set, highlightId) {
  if (!set || set.size === 0) return;
  const box = document.createElement("span");
  box.className = "line-notes" + (noteColumns(puzzle.characters.length) === 4 ? " notes-4" : "");
  puzzle.characters.forEach((character) => {
    if (set.has(character.id)) box.appendChild(makeMark(character, highlightId));
  });
  labelNode.appendChild(box);
}

// Everything the page adds to a cell after drawing it, so that a move touches only the cells it changes (the board used to be
// rebuilt from scratch at every tap, hold and drag step: on a phone that was most of the wait).
const TRANSIENT = ".hover-target,.hint-target,.hint-info,.hint-culprit,.clue-pin,.char-target";
const HINT_MARKS = ".hint-target,.hint-info,.hint-culprit";

// What is drawn in a cell, as a short string: when it is the same as last time, the cell is left alone.
function cellSignature(state, row, col, selectedId) {
  const k = key(row, col);
  const reserved = state.reservations.get(k);
  const tail = reserved ? `@${reserved}` : "";
  const occupant = occupiedBy(state, row, col);
  if (occupant) return `o:${occupant}${tail}`;
  if (state.xMarks.has(k)) return `x${tail}`;
  const notes = state.candidates.get(k);
  if (!notes || notes.size === 0) return `-${tail}`;
  return `n:${[...notes].sort().join(",")}|${selectedId && notes.has(selectedId) ? selectedId : ""}${tail}`;
}

const labelSignature = (set, selectedId, reservedBy) =>
  (set && set.size > 0 ? `${[...set].sort().join(",")}|${selectedId && set.has(selectedId) ? selectedId : ""}` : "") +
  (reservedBy ? `@${reservedBy}` : "");

// Token, X or notes of one cell (and its label for a screen reader).
function paintCell(cellNode, puzzle, state, row, col, selectedId, baseLabel) {
  cellNode.setAttribute("aria-label", cellAriaLabel(baseLabel, puzzle, state, row, col));
  paintReservation(cellNode, puzzle, state.reservations.get(key(row, col)));
  const occupant = occupiedBy(state, row, col);
  if (occupant) {
    const character = puzzle.characters.find((c) => c.id === occupant);
    if (character) {
      const token = document.createElement("div");
      token.className = "char-token";
      token.style.color = character.isVictim ? "var(--danger)" : characterColor(character);
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
    const compact = !!cellNode.querySelector(".obj-icon");
    if (compact) cellNode.classList.add("notes-compact");
    renderCandidateGrid(cellNode, puzzle, candidateSet, selectedId, compact);
  }
}

// A reserved cell: a border in the character's colour and their initial in a corner.
function paintReservation(cellNode, puzzle, characterId) {
  const character = characterId && puzzle.characters.find((c) => c.id === characterId);
  if (!character) return;
  cellNode.classList.add("reserved");
  cellNode.style.setProperty("--reserve-color", markColor(character));
  const tag = document.createElement("span");
  tag.className = "reserve-tag";
  tag.setAttribute("aria-hidden", "true");
  tag.textContent = initialOf(character);
  cellNode.appendChild(tag);
}

function clearCell(cellNode) {
  for (const child of [...cellNode.children])
    if (child.classList.contains("char-token") || child.classList.contains("candidate-grid") || child.classList.contains("reserve-tag"))
      child.remove();
  cellNode.classList.remove("x-mark", "notes-compact", "reserved");
  cellNode.style.removeProperty("--reserve-color");
}

// What a label shows besides its text: the reservation sign, then the notes.
function decorateLabelNode(labelNode, puzzle, state, kind, index, selectedId) {
  const id = `${kind}:${index}`;
  renderLineReserve(labelNode, puzzle, state.reservedLines.get(id));
  renderLineNotes(labelNode, puzzle, state.lineNotes.get(id), selectedId);
  labelNode.classList.toggle("reserved", state.reservedLines.has(id));
}

function paintLabel(labelNode, puzzle, state, kind, index, selectedId) {
  for (const old of labelNode.querySelectorAll(":scope > .line-notes, :scope > .line-reserve")) old.remove();
  decorateLabelNode(labelNode, puzzle, state, kind, index, selectedId);
  // right after the text, where a fresh draw puts them (the room names of a row label come after the notes)
  const added = [...labelNode.querySelectorAll(":scope > .line-reserve, :scope > .line-notes")];
  labelNode.querySelector(":scope > .label-text")?.after(...added);
}

// `onCellTap` fires on a plain tap (or Enter/Space from the keyboard);
// `onCellHold` fires when the press stays still on the same cell past the
// hold threshold (or Shift+Enter); `onCellEnter` fires again for each further
// cell the pointer enters while dragging, letting a single stroke mark
// candidates/X's across several cells instead of one tap each. `onPressStart`
// (optional) fires once, synchronously, the instant a press begins — before
// the hold timer starts counting down — so a caller can pin anything that
// could otherwise change out from under a pending hold (see board.js's
// handleCellHold `tool` param). See src/util/boardRender.js for the full
// gesture state machine.
//
// The first call (or a different map) builds the board; every later call for the same map only redraws the cells and labels whose
// content changed, and puts back the transient marks (hint, hover, pinned clue...) as a fresh draw would, because the page
// applies them again right after. The handlers of the LAST call are the ones used, whichever call built the board.
export function renderPlayerBoard(container, puzzle, state, onCellTap, onCellHold, onCellEnter, onPressStart, onLineTap, onLineHold) {
  const handlers = { onCellTap, onCellHold, onCellEnter, onPressStart, onLineTap, onLineHold };
  const selectedId = state.selectedTool?.kind === "character" ? state.selectedTool.id : null;
  const known = container.__playerBoard;
  if (known && known.grid === puzzle.grid && known.characterCount === puzzle.characters.length && container.isConnected) {
    known.handlers = handlers;
    updateBoard(container, known, puzzle, state, selectedId);
    return;
  }

  const board = {
    grid: puzzle.grid,
    characterCount: puzzle.characters.length,
    handlers,
    cells: new Map(),
    labels: new Map(),
    base: new Map(),
    signatures: new Map(),
    labelSignatures: new Map(),
  };
  container.__playerBoard = board;
  const call =
    (name) =>
    (...args) =>
      board.handlers[name]?.(...args);
  renderBoard(container, puzzle.grid, {
    onLabelTap: onLineTap ? call("onLineTap") : undefined,
    onLabelHold: onLineHold ? call("onLineHold") : undefined,
    decorateLabel: (node, kind, index) => decorateLabelNode(node, puzzle, state, kind, index, selectedId),
    onCellTap: onCellTap ? call("onCellTap") : undefined,
    onCellHold: onCellHold ? call("onCellHold") : undefined,
    onCellEnter: onCellEnter ? call("onCellEnter") : undefined,
    onPressStart: onPressStart ? call("onPressStart") : undefined,
    decorateCell: (cellNode, row, col) => {
      const k = key(row, col);
      board.base.set(k, cellNode.getAttribute("aria-label"));
      paintCell(cellNode, puzzle, state, row, col, selectedId, board.base.get(k));
      board.cells.set(k, cellNode);
      board.signatures.set(k, cellSignature(state, row, col, selectedId));
    },
  });
  for (const node of container.querySelectorAll(".board-label[data-nav-kind]")) {
    const id = `${node.dataset.navKind}:${node.dataset.navIndex}`;
    board.labels.set(id, node);
    board.labelSignatures.set(id, labelSignature(state.lineNotes.get(id), selectedId, state.reservedLines.get(id)));
  }
}

function updateBoard(container, board, puzzle, state, selectedId) {
  // marks the page added on top of the last draw: a fresh draw would not have them (the page applies them again after this)
  const dirty = new Set();
  for (const node of container.querySelectorAll(TRANSIENT)) {
    if (node.matches(HINT_MARKS)) dirty.add(key(Number(node.dataset.row), Number(node.dataset.col))); // its label said «suggerimento…»
    node.classList.remove("hover-target", "hint-target", "hint-info", "hint-culprit", "clue-pin", "char-target");
  }
  for (const [k, cellNode] of board.cells) {
    const [row, col] = k.split(",").map(Number);
    const signature = cellSignature(state, row, col, selectedId);
    if (signature === board.signatures.get(k) && !dirty.has(k)) continue;
    clearCell(cellNode);
    paintCell(cellNode, puzzle, state, row, col, selectedId, board.base.get(k));
    board.signatures.set(k, signature);
  }
  for (const [id, labelNode] of board.labels) {
    const [kind, index] = id.split(":");
    const signature = labelSignature(state.lineNotes.get(id), selectedId, state.reservedLines.get(id));
    if (signature === board.labelSignatures.get(id)) continue;
    paintLabel(labelNode, puzzle, state, kind, Number(index), selectedId);
    board.labelSignatures.set(id, signature);
  }
}
