// How the player board looks: candidate notes, line notes, tokens and X marks
// drawn on top of the shared grid (util/boardRender.js). The state and rules
// are in board.js.
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { characterColor } from "../model/puzzle.js";
import { key, occupiedBy } from "./board.js";

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
// the same slot (0-8, laid out 3x3) in every cell's candidate grid, based on
// its order in the roster. Grids have at most 9 characters, so it always fits.
// `highlightId`, when set, marks that character's own notes across the whole
// board — e.g. while their toolbar chip is selected — so you can spot every
// cell you've already suspected them in at a glance.
//
// A cell that holds an object (a rug, a chair, a stool) gets the COMPACT
// layout instead: the object is drawn smaller on top and the notes sit in a
// band below it, so a note never lands on the drawing.
function renderCandidateGrid(cellNode, puzzle, candidateSet, highlightId, compact) {
  const grid = document.createElement("div");
  grid.className = "candidate-grid" + (compact ? " compact" : "");
  if (compact) {
    puzzle.characters.slice(0, 9).forEach((character) => {
      if (candidateSet.has(character.id)) grid.appendChild(makeMark(character, highlightId));
    });
  } else {
    const slots = new Array(9).fill(null);
    puzzle.characters.forEach((character, index) => {
      if (index < 9) slots[index] = character;
    });
    for (const character of slots) {
      const slot = document.createElement("div");
      slot.className = "candidate-slot";
      if (character && candidateSet.has(character.id)) slot.appendChild(makeMark(character, highlightId));
      grid.appendChild(slot);
    }
  }
  cellNode.appendChild(grid);
}

// Notes on a whole row/column, drawn inside its label on the board's edge.
function renderLineNotes(labelNode, puzzle, set, highlightId) {
  if (!set || set.size === 0) return;
  const box = document.createElement("span");
  box.className = "line-notes";
  puzzle.characters.slice(0, 9).forEach((character) => {
    if (set.has(character.id)) box.appendChild(makeMark(character, highlightId));
  });
  labelNode.appendChild(box);
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
export function renderPlayerBoard(container, puzzle, state, onCellTap, onCellHold, onCellEnter, onPressStart, onLineTap) {
  const selectedId = () => (state.selectedTool?.kind === "character" ? state.selectedTool.id : null);
  renderBoard(container, puzzle.grid, {
    onLabelTap: onLineTap,
    decorateLabel: (node, kind, index) => renderLineNotes(node, puzzle, state.lineNotes.get(`${kind}:${index}`), selectedId()),
    onCellTap,
    onCellHold,
    onCellEnter,
    onPressStart,
    decorateCell: (cellNode, row, col) => {
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
        renderCandidateGrid(cellNode, puzzle, candidateSet, selectedId(), compact);
      }
    },
  });
}
