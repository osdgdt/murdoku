import { el, clear } from "./dom.js";
import { objectIcon } from "../model/icons.js";

const CELL_SIZE = 56;
const LABEL_SIZE = 24;

// Shared "is the mouse button currently held while over the board" flag, so a
// press-and-drag across cells can paint each one it enters (candidates, X
// marks…) instead of requiring a separate click per cell. Module-level and
// reset on any mouseup, since only one board is ever interactive at a time.
let dragActive = false;
// The cell that received the mousedown starting this stroke. onCellDown's
// callback typically re-renders the whole board synchronously (to show the
// change it just made) — that replaces the cell element sitting under the
// still-stationary cursor with a brand new one, and the browser reacts by
// firing a genuine mouseenter on it, even though the pointer never actually
// moved. Left unguarded, that phantom enter immediately re-triggers
// onCellEnter on the very cell onCellDown just handled — e.g. re-adding a
// candidate mark that onCellDown had just toggled off, so the toggle
// silently appears to do nothing. Suppressing onCellEnter for this one cell
// closes that gap; it's already been handled via onCellDown regardless.
let dragDownCell = null;
if (typeof document !== "undefined") {
  const stopDrag = () => { dragActive = false; dragDownCell = null; };
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("dragend", stopDrag);
}

// Shared board rendering: draws the grid with zone background colors/textures,
// bold "wall" borders at zone boundaries, one overlaid room-name label per
// zone, and object icons; wires per-cell click/right-click callbacks. Callers
// layer their own overlays (character tokens, X marks, solution markers) via
// `decorateCell(cellNode, row, col)`. Row/column labels (R1.., C1..) are
// included by default — pass `showLabels: false` to omit them.
//
// Two interaction models are supported: `onCellClick` (click-based, used by
// the editor boards) or `onCellDown`/`onCellEnter` (mousedown-based, used by
// the player board so a press-and-drag can paint several cells in one
// stroke — `onCellDown` fires once on press, `onCellEnter` fires again for
// every new cell the pointer enters while still held).
export function renderBoard(container, grid, { onCellClick, onCellRightClick, onCellDown, onCellEnter, decorateCell, showLabels = true } = {}) {
  clear(container);
  container.classList.add("board-grid");
  const gutter = showLabels ? `${LABEL_SIZE}px ` : "";
  container.style.gridTemplateColumns = `${gutter}repeat(${grid.size.cols}, ${CELL_SIZE}px)`;
  container.style.gridTemplateRows = `${gutter}repeat(${grid.size.rows}, ${CELL_SIZE}px)`;

  const zoneById = new Map(grid.zones.map((z) => [z.id, z]));

  // A cell only "belongs" to a zone for wall/texture purposes when usable and
  // painted — blocked cells always act as a boundary (solid rock), while two
  // zone-less usable cells count as the same open area (no wall between them).
  const zoneKeyAt = (r, c) => {
    const cell = grid.cells[r][c];
    return !cell.blocked && cell.zoneId ? cell.zoneId : null;
  };
  // Grid edges are already framed by .board-grid's own border, so a boundary
  // only becomes a rendered "wall" when the neighbor is in-bounds and differs.
  const wallBetween = (r1, c1, r2, c2) => {
    if (r2 < 0 || r2 >= grid.size.rows || c2 < 0 || c2 >= grid.size.cols) return false;
    const a = zoneKeyAt(r1, c1);
    const b = zoneKeyAt(r2, c2);
    if (a === null && b === null) return false;
    return a !== b;
  };

  // One room-name label per zone, anchored at its first cell in reading
  // order, instead of repeating the name on every cell of the zone.
  const zoneAnchor = new Map();
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      const key = zoneKeyAt(r, c);
      if (key && !zoneAnchor.has(key)) zoneAnchor.set(key, `${r},${c}`);
    }
  }

  if (showLabels) {
    container.appendChild(el("div", { class: "board-label board-label-corner" }));
    for (let c = 0; c < grid.size.cols; c++) {
      container.appendChild(el("div", { class: "board-label board-label-col" }, `C${c + 1}`));
    }
  }

  for (let r = 0; r < grid.size.rows; r++) {
    let rowLabelNode = null;
    if (showLabels) {
      rowLabelNode = el("div", { class: "board-label board-label-row" }, `R${r + 1}`);
      container.appendChild(rowLabelNode);
    }
    for (let c = 0; c < grid.size.cols; c++) {
      const cellData = grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? zoneById.get(cellData.zoneId) : null;

      let classes = "board-cell";
      if (cellData.blocked) classes += " blocked";
      if (zone) classes += " zoned";
      if (wallBetween(r, c, r - 1, c)) classes += " wall-t";
      if (wallBetween(r, c, r, c + 1)) classes += " wall-r";
      if (wallBetween(r, c, r + 1, c)) classes += " wall-b";
      if (wallBetween(r, c, r, c - 1)) classes += " wall-l";

      const cellNode = el("div", {
        class: classes,
        dataset: { row: String(r), col: String(c) },
        // Explicitly disabled: without this, a real browser can turn a
        // press-and-drag starting on (or crossing) a cell's inline SVG icon
        // into a native image-drag gesture, which swallows mousemove and
        // stops mouseenter from firing on the cells underneath — breaking
        // the paint-by-dragging feature outside of synthetic/automated
        // clicks (where no native drag ever kicks in to begin with).
        draggable: "false",
        style: zone ? `background-color:${zone.color}` : "",
        onClick: () => onCellClick && onCellClick(r, c),
        onContextmenu: (e) => {
          if (onCellRightClick) {
            e.preventDefault();
            onCellRightClick(r, c);
          }
        },
        onMousedown: (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          dragActive = true;
          dragDownCell = { row: r, col: c };
          if (onCellDown) onCellDown(r, c);
        },
        onMouseenter: () => {
          if (!dragActive || !onCellEnter) return;
          if (dragDownCell && dragDownCell.row === r && dragDownCell.col === c) return;
          onCellEnter(r, c);
        },
      });

      if (cellData.blocked) {
        container.appendChild(cellNode);
        continue;
      }

      // Room names live in the row-label gutter (outside every playable
      // cell), not inside the room's own cells — so they never sit where a
      // candidate/token/X could be marked, however that cell fills up. A
      // small swatch of the zone's own color rides along, so the tag still
      // reads as "this color = this room" even off the map itself.
      //
      // Two zones can anchor to the very same row (e.g. both start at
      // column 0 of different rows... or, when several rooms all begin in
      // row 0, at the same row) — their labels go into a shared vertical
      // stack instead of both centering on the row and overlapping.
      if (zone && zoneAnchor.get(zone.id) === `${r},${c}` && rowLabelNode) {
        let stack = rowLabelNode.querySelector(".room-label-stack");
        if (!stack) {
          stack = el("div", { class: "room-label-stack" });
          rowLabelNode.appendChild(stack);
        }
        stack.appendChild(
          el("span", { class: "room-label" }, [
            el("span", { class: "room-label-swatch", style: `background:${zone.color}` }),
            el("span", { class: "room-label-text" }, zone.name),
          ])
        );
      }

      if (cellData.objectId) {
        const obj = grid.objects.find((o) => o.id === cellData.objectId);
        const def = obj && objectIcon(obj.typeId);
        if (def) {
          const iconWrap = el("span", { class: "obj-icon" });
          iconWrap.innerHTML = def.icon;
          cellNode.appendChild(iconWrap);
        }
      }

      if (decorateCell) decorateCell(cellNode, r, c);

      container.appendChild(cellNode);
    }
  }
}
