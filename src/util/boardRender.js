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
// The last cell a touch-drag reported via onCellEnter — touchmove, unlike
// mouseenter, isn't inherently a per-element event (it keeps firing on
// whatever element the touch *started* on, not whatever's currently
// underneath the finger), so this is what makes repeated touchmove events
// over the same still-under-the-finger cell a no-op instead of calling
// onCellEnter on every single event.
let lastTouchCell = null;
// Which render's onCellEnter a touch-drag should call — touchmove is
// handled by ONE document-level listener (registered once below, not
// per-cell like mouseenter can be, since it needs `elementFromPoint` to
// find the actual cell under the finger), so it needs this module-level
// pointer to know which board is currently interactive, refreshed on every
// renderBoard() call under the same "only one board interactive at a time"
// assumption `dragActive` itself already relies on.
let currentOnCellEnter = null;
if (typeof document !== "undefined") {
  const stopDrag = () => { dragActive = false; dragDownCell = null; lastTouchCell = null; };
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("dragend", stopDrag);
  document.addEventListener("touchend", stopDrag);
  document.addEventListener("touchcancel", stopDrag);
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!dragActive || !currentOnCellEnter) return;
      const touch = e.touches[0];
      if (!touch) return;
      const targetCell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".board-cell");
      if (!targetCell) return;
      e.preventDefault(); // dragging across the board must never also scroll the page
      const tRow = Number(targetCell.dataset.row);
      const tCol = Number(targetCell.dataset.col);
      if (lastTouchCell && lastTouchCell.row === tRow && lastTouchCell.col === tCol) return;
      lastTouchCell = { row: tRow, col: tCol };
      // Same phantom-re-entry guard as onMouseenter above: the cell that
      // received the initial touchstart already got onCellDown.
      if (dragDownCell && dragDownCell.row === tRow && dragDownCell.col === tCol) return;
      currentOnCellEnter(tRow, tCol);
    },
    { passive: false }
  );
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
  container.setAttribute("role", "grid");
  currentOnCellEnter = onCellEnter || null; // see the module-level comment on this variable

  // Enter/Space on a focused cell replicates a single click: `onCellClick`
  // for the editor boards, or just `onCellDown` for the player board (its
  // own handler already performs the complete action — press-and-drag is a
  // mouse-only *extension* on top of that single action, not a prerequisite
  // for it, so a bare onCellDown call is a faithful keyboard equivalent).
  // Never touches `dragActive`/`dragDownCell` — those are only ever set by
  // real mouse events, so keyboard activation can't leave the board stuck
  // mid-drag.
  function activateCell(r, c) {
    if (onCellClick) onCellClick(r, c);
    else if (onCellDown) onCellDown(r, c);
  }

  // Arrow-key navigation between cells. Silently does nothing when the
  // target is out of bounds, blocked (not focusable, see below), or absent
  // for any other reason — a rough edge accepted for this first pass rather
  // than adding logic to skip over blocked cells to the next usable one.
  function focusCell(r, c) {
    if (r < 0 || r >= grid.size.rows || c < 0 || c >= grid.size.cols) return;
    const node = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (node && node.tabIndex >= 0) node.focus();
  }

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

      // Baseline, generic aria-label — every caller (editor map, editor
      // solution, player board) gets this for free with no changes on their
      // side. It doesn't know about occupants/candidates (that's `state`
      // the caller alone holds, added later via `decorateCell`) — a richer,
      // per-caller description is a natural follow-up, not required for
      // this first accessibility pass to be useful.
      let cellLabel = `Riga ${r + 1}, colonna ${c + 1}`;
      if (cellData.blocked) cellLabel += ", bloccata";
      else if (zone) cellLabel += `, stanza ${zone.name}`;

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
        role: "gridcell",
        "aria-label": cellLabel,
        // Blocked cells still get onClick/onMousedown wired below (callers
        // like handleCellClick already reject them via isOccupiable), but
        // are deliberately left out of the tab order — a "wall" cell has
        // nothing useful to land keyboard focus on, and skipping it here is
        // simpler than adding tab-order logic that jumps over it.
        tabindex: cellData.blocked ? undefined : "0",
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
        onKeydown: cellData.blocked ? undefined : (e) => {
          switch (e.key) {
            case "ArrowUp": e.preventDefault(); focusCell(r - 1, c); break;
            case "ArrowDown": e.preventDefault(); focusCell(r + 1, c); break;
            case "ArrowLeft": e.preventDefault(); focusCell(r, c - 1); break;
            case "ArrowRight": e.preventDefault(); focusCell(r, c + 1); break;
            case "Enter":
            case " ":
              e.preventDefault();
              activateCell(r, c);
              break;
          }
        },
        onMouseenter: () => {
          if (!dragActive || !onCellEnter) return;
          if (dragDownCell && dragDownCell.row === r && dragDownCell.col === c) return;
          onCellEnter(r, c);
        },
      });

      // Touch equivalent of onMousedown above. Attached directly (not
      // through el()'s props, which always adds listeners as passive) so
      // `{ passive: false }` can actually take effect — needed so
      // preventDefault() here can stop the touch from also scrolling/
      // selecting the page, matching attachHoldToConfirm's existing pattern
      // (src/util/dom.js) for the same reason. touchmove itself is handled
      // by the single document-level listener registered above, not here.
      cellNode.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          dragActive = true;
          dragDownCell = { row: r, col: c };
          lastTouchCell = { row: r, col: c };
          if (onCellDown) onCellDown(r, c);
        },
        { passive: false }
      );

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
