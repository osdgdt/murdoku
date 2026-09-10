import { el, clear } from "./dom.js";
import { objectIcon } from "../model/icons.js";

const CELL_SIZE = 56;
const LABEL_SIZE = 24;

// Shared "is the mouse button currently held while over the board" flag, so a
// press-and-drag across cells can paint each one it enters (candidates, X
// marks…) instead of requiring a separate click per cell. Module-level and
// reset on release, since only one board is ever interactive at a time.
let dragActive = false;
// The cell that received the mousedown/touchstart starting this press.
let dragDownCell = null;
// The last cell a touch-drag reported via onCellEnter — touchmove, unlike
// mouseenter, isn't inherently a per-element event (it keeps firing on
// whatever element the touch *started* on, not whatever's currently
// underneath the finger), so this is what makes repeated touchmove events
// over the same still-under-the-finger cell a no-op instead of calling
// onCellEnter on every single event.
let lastTouchCell = null;
// The identifier of the touch that started the current press (null when the
// current press is mouse-driven, or when nothing is pressed). A touchend/
// touchcancel/touchmove event that doesn't carry THIS touch belongs to some
// OTHER, unrelated finger touching the page at the same time (e.g. a second
// finger tapping a toolbar button while the first is mid-hold on a board
// cell) — it must never complete, cancel, or redirect a gesture it didn't
// start.
let activeTouchId = null;
// Which render's onCellEnter/onCellTap a press should call — touchmove is
// handled by ONE document-level listener (registered once below, not
// per-cell like mouseenter can be, since it needs `elementFromPoint` to
// find the actual cell under the finger), so these need to be module-level
// pointers to know which board is currently interactive, refreshed on every
// renderBoard() call under the same "only one board interactive at a time"
// assumption `dragActive` itself already relies on.
let currentOnCellEnter = null;
let currentOnCellTap = null;

// Threshold for "hold" vs "tap": press-and-release before this elapses (and
// without leaving the pressed cell) is a tap; staying down past it, still on
// the same cell, is a hold. Kept in sync by hand with the `cell-hold-fill`
// CSS animation duration in styles/player.css (same manual-duplication
// tradeoff attachHoldToConfirm/700ms already accepts, src/util/dom.js).
const HOLD_THRESHOLD_MS = 400;
// Timer counting down a hold-in-progress; null whenever no press is pending a
// hold decision (nothing down, hold already fired, or already converted to a
// drag).
let holdTimer = null;
// True once onCellHold has actually fired for the current press — guards
// against also firing onCellTap on the eventual release, and against
// onCellEnter re-triggering drag-painting after a hold already confirmed a
// placement.
let holdFired = false;
// True once the current press has been reinterpreted as a drag (the pointer
// left dragDownCell before the hold timer elapsed) — guards against firing
// onCellTap on release once painting has already started.
let dragConverted = false;
// The DOM node currently wearing the "holding" class, so it can be cleared
// directly (no full re-render) when a hold is cancelled/converted/completed.
let holdingCellNode = null;

function clearHoldTimer() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
}
function clearHoldingVisual() {
  if (holdingCellNode) { holdingCellNode.classList.remove("holding"); holdingCellNode = null; }
}
// Reinterprets the current press as a drag: cancels the pending hold, and —
// since the down-cell itself never got a tap or a hold — feeds it through
// onCellEnter as the first cell of the paint stroke (drag semantics: force
// on, never toggle off — see handleCellDrag in board.js).
function convertToDrag() {
  if (dragConverted || holdFired || !dragDownCell) return;
  dragConverted = true;
  clearHoldTimer();
  clearHoldingVisual();
  if (currentOnCellEnter) currentOnCellEnter(dragDownCell.row, dragDownCell.col);
}

if (typeof document !== "undefined") {
  const resetPressState = () => {
    dragActive = false; dragDownCell = null; lastTouchCell = null; activeTouchId = null;
    clearHoldTimer(); holdFired = false; dragConverted = false; clearHoldingVisual();
  };
  // A genuine release (mouseup/touchend) that never moved off the down-cell
  // and never held long enough to trigger onCellHold is a completed tap.
  const releasePress = () => {
    if (dragActive && dragDownCell && !holdFired && !dragConverted && currentOnCellTap) {
      currentOnCellTap(dragDownCell.row, dragDownCell.col);
    }
    resetPressState();
  };
  // True if this touch event carries the finger that started the current
  // press (or if the press isn't touch-driven at all) — see activeTouchId.
  const isOwnTouch = (e) => activeTouchId === null || [...e.changedTouches].some((t) => t.identifier === activeTouchId);

  document.addEventListener("mouseup", releasePress);
  // draggable="false" is set on every cell, so this should never fire in
  // practice; if it ever does, treat it as an aborted gesture, not a
  // completed tap.
  document.addEventListener("dragend", resetPressState);
  document.addEventListener("touchend", (e) => { if (isOwnTouch(e)) releasePress(); });
  // System-aborted gesture (e.g. an incoming call) — never a completed tap.
  document.addEventListener("touchcancel", (e) => { if (isOwnTouch(e)) resetPressState(); });
  // A press abandoned by leaving the window/tab entirely (alt-tab, the mouse
  // moving off-screen, switching apps mid-touch) must be cancelled outright,
  // not left armed to fire onCellHold later out of context, once focus
  // returns, on whatever's still under the cursor — mirrors
  // attachHoldToConfirm's mouseleave cancellation (src/util/dom.js) for the
  // same reason. window "blur" fires for all of these; a plain document
  // mouseleave would not (the pointer usually leaves via the OS chrome, not
  // back into the document).
  window.addEventListener("blur", resetPressState);
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!dragActive || holdFired) return;
      // Only the tracked touch's own movement can drive the drag — a
      // different, unrelated finger moving elsewhere on the page must not.
      const touch = activeTouchId === null ? e.changedTouches[0] : [...e.changedTouches].find((t) => t.identifier === activeTouchId);
      if (!touch) return;
      e.preventDefault(); // a drag in progress must never also scroll the page, even briefly off-board
      const targetCell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".board-cell");
      if (!targetCell) return;
      const tRow = Number(targetCell.dataset.row);
      const tCol = Number(targetCell.dataset.col);
      if (lastTouchCell && lastTouchCell.row === tRow && lastTouchCell.col === tCol) return;
      lastTouchCell = { row: tRow, col: tCol };
      // Same phantom-re-entry guard as onMouseenter below: the down-cell is
      // fed through convertToDrag() instead, exactly once.
      if (dragDownCell && dragDownCell.row === tRow && dragDownCell.col === tCol) return;
      convertToDrag();
      if (currentOnCellEnter) currentOnCellEnter(tRow, tCol);
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
// the editor boards) or `onCellTap`/`onCellHold`/`onCellEnter` (used by the
// player board): `onCellTap` fires on a plain press-and-release, `onCellHold`
// fires when the press stays still on the same cell past HOLD_THRESHOLD_MS,
// and `onCellEnter` fires again for every new cell the pointer enters while
// dragging (a drag is what a press becomes the moment it leaves the pressed
// cell before the hold timer fires — see convertToDrag above).
export function renderBoard(container, grid, { onCellClick, onCellRightClick, onCellTap, onCellHold, onCellEnter, onPressStart, decorateCell, showLabels = true } = {}) {
  clear(container);
  container.classList.add("board-grid");
  container.setAttribute("role", "grid");
  currentOnCellEnter = onCellEnter || null; // see the module-level comment on this variable
  currentOnCellTap = onCellTap || null;

  // Starts a press on cell (r,c): if the caller wants hold-detection
  // (onCellHold provided — only the player board does), arms the hold timer
  // and shows the "holding" fill animation; otherwise just marks the press
  // as active (editor boards: onCellClick alone handles everything, this is
  // a harmless no-op setup shared with the player-board path). Shared by
  // onmousedown and touchstart below to avoid duplicating the hold-timer
  // logic per input type. Ignores a press while one is already active (e.g.
  // a second finger touching the board) — only the first press drives the
  // gesture; see activeTouchId for the touch-identity side of this.
  function startPress(r, c, node) {
    if (dragActive) return;
    dragActive = true; dragDownCell = { row: r, col: c }; holdFired = false; dragConverted = false;
    // Fires once, synchronously, right as the press begins — lets a caller
    // (gameScreen.js) snapshot anything that could otherwise change out from
    // under a pending hold before its timer fires (e.g. the selected tool,
    // if something else reassigns it mid-hold via a second, unrelated
    // touch — see handleCellHold's `tool` override in board.js).
    if (onPressStart) onPressStart(r, c);
    if (onCellHold) {
      node.classList.add("holding");
      holdingCellNode = node;
      holdTimer = setTimeout(() => {
        holdTimer = null; holdFired = true; clearHoldingVisual();
        onCellHold(r, c);
      }, HOLD_THRESHOLD_MS);
    }
  }

  // Enter/Space on a focused cell replicates a single click/tap: `onCellClick`
  // for the editor boards, or `onCellTap` for the player board. Shift+Enter
  // is the keyboard equivalent of a hold (confirm/place) — a distinct
  // combination since Enter/Space alone already means "tap" (note), and a
  // keyboard can't naturally express "held down for 400ms". Neither ever
  // touches `dragActive`/`dragDownCell` — those are only ever set by real
  // press events, so keyboard activation can't leave the board stuck mid-drag.
  function activateCell(r, c) {
    if (onCellClick) onCellClick(r, c);
    else if (onCellTap) onCellTap(r, c);
  }
  function activateCellHold(r, c) {
    if (onCellHold) onCellHold(r, c);
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
        // like handleCellTap/handleCellHold already reject them via isOccupiable), but
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
          if (e.button !== 0 || dragActive) return;
          e.preventDefault();
          startPress(r, c, cellNode);
        },
        onKeydown: cellData.blocked ? undefined : (e) => {
          switch (e.key) {
            case "ArrowUp": e.preventDefault(); focusCell(r - 1, c); break;
            case "ArrowDown": e.preventDefault(); focusCell(r + 1, c); break;
            case "ArrowLeft": e.preventDefault(); focusCell(r, c - 1); break;
            case "ArrowRight": e.preventDefault(); focusCell(r, c + 1); break;
            case "Enter":
              e.preventDefault();
              if (e.shiftKey) activateCellHold(r, c);
              else activateCell(r, c);
              break;
            case " ":
              e.preventDefault();
              activateCell(r, c);
              break;
          }
        },
        onMouseenter: () => {
          if (!dragActive || holdFired) return;
          if (dragDownCell && dragDownCell.row === r && dragDownCell.col === c) return;
          convertToDrag();
          if (currentOnCellEnter) currentOnCellEnter(r, c);
        },
      });

      // Touch equivalent of onMousedown above — only wired for boards that
      // actually use the tap/hold/drag gesture model (onCellHold or
      // onCellEnter present, i.e. the player board). Editor boards
      // (onCellClick-only) must NOT get this: intercepting touchstart here
      // would swallow the synthetic click a touch tap normally fires,
      // silently breaking touch taps on the map/solution editors.
      // Attached directly (not through el()'s props, which always adds
      // listeners as passive) so `{ passive: false }` can actually take
      // effect — needed so preventDefault() here can stop the touch from
      // also scrolling/selecting the page, matching attachHoldToConfirm's
      // existing pattern (src/util/dom.js) for the same reason. touchmove
      // itself is handled by the single document-level listener registered
      // above, not here.
      if (onCellHold || onCellEnter) {
        cellNode.addEventListener(
          "touchstart",
          (e) => {
            if (dragActive) return; // a second, unrelated finger — ignore
            e.preventDefault();
            activeTouchId = e.changedTouches[0]?.identifier ?? null;
            lastTouchCell = { row: r, col: c };
            startPress(r, c, cellNode);
          },
          { passive: false }
        );
      }

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
