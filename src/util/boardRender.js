import { el, clear } from "./dom.js";
import { objectIcon, isEdgeObjectType, sideLabel } from "../model/icons.js";
import { floorStyle } from "../model/textures.js";
import { roomColor } from "../skin/paper/rooms.js";
import { t } from "../i18n/i18n.js";
import { setGestureCallbacks, isPressActive, startPress, enterCell, beginTouchPress } from "./boardGestures.js";

const CELL_SIZE = 56;

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
export function renderBoard(
  container,
  grid,
  {
    onCellClick,
    onCellRightClick,
    onCellTap,
    onCellHold,
    onCellEnter,
    onPressStart,
    decorateCell,
    decorateLabel,
    onLabelTap,
    showLabels = true,
  } = {}
) {
  clear(container);
  container.classList.add("board-grid");
  container.setAttribute("role", "grid");
  setGestureCallbacks({ onCellEnter, onCellTap });
  const pressHooks = { onPressStart, onCellHold };

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

  // The label gutters size themselves ("auto"): a row/column label can grow
  // to hold the notes drawn on it (see decorateLabel).
  const gutter = showLabels ? "max-content " : "";
  // Cell size lives in a CSS variable (default CELL_SIZE) so the stylesheet can
  // shrink the whole board to fit a phone viewport (see `.board-grid` in editor.css).
  container.style.setProperty("--cols", String(grid.size.cols));
  container.style.setProperty("--rows", String(grid.size.rows));
  container.style.gridTemplateColumns = `${gutter}repeat(${grid.size.cols}, var(--cell-size, ${CELL_SIZE}px))`;
  container.style.gridTemplateRows = `${gutter}repeat(${grid.size.rows}, var(--cell-size, ${CELL_SIZE}px))`;

  const zoneById = new Map(grid.zones.map((z) => [z.id, z]));
  // Doors/windows sit on a side of a cell (object.side), not inside it: group
  // them per cell so each cell can draw its own thin edge pieces.
  const edgesByCell = new Map();
  for (const o of grid.objects) {
    if (!isEdgeObjectType(o.typeId)) continue;
    const k = `${o.row},${o.col}`;
    if (!edgesByCell.has(k)) edgesByCell.set(k, []);
    edgesByCell.get(k).push(o);
  }
  // Every cell of a room shares one floor style: build it once per zone.
  const floorCache = new Map();
  const floorOf = (zone) => {
    if (!floorCache.has(zone.id)) {
      const { image, size, own } = floorStyle(zone.textureId, roomColor(zone.color));
      floorCache.set(zone.id, { own, style: `--room:${roomColor(zone.color)};--zone-texture:${image};--zone-texture-size:${size}` });
    }
    return floorCache.get(zone.id);
  };

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

  // The room's name is written ON the room: a small tab in the top-left of its
  // first cell, spanning along that row while the cells to the right are free
  // of objects. The cells under the tab are flagged so notes keep clear of it.
  // (Anchor: first cell in reading order with no object and no door/window on
  // its north side, so the tab never covers a drawing.)
  const roomName = new Map(); // "r,c" -> { zone, span }
  const roomNameCells = new Set();
  const freeForName = (r, c) => {
    const cd = grid.cells[r][c];
    if (cd.blocked || cd.objectId) return false;
    return !(edgesByCell.get(`${r},${c}`) || []).some((o) => (o.side || "N") === "N");
  };
  for (const zone of grid.zones) {
    let anchor = null;
    for (let r = 0; r < grid.size.rows && !anchor; r++) {
      for (let c = 0; c < grid.size.cols; c++) {
        if (grid.cells[r][c].zoneId === zone.id && !grid.cells[r][c].blocked && freeForName(r, c)) {
          anchor = [r, c];
          break;
        }
      }
    }
    if (!anchor) continue;
    const [ar, ac] = anchor;
    let span = 1;
    while (ac + span < grid.size.cols && grid.cells[ar][ac + span].zoneId === zone.id && freeForName(ar, ac + span)) span++;
    roomName.set(`${ar},${ac}`, { zone, span });
    for (let i = 0; i < span; i++) roomNameCells.add(`${ar},${ac + i}`);
  }

  // role="grid" requires row -> cell ownership. The rows are `display: contents`
  // wrappers, so they exist only for assistive technology: the visual CSS
  // grid layout still sees the cells as direct grid items.
  const makeRow = () => el("div", { role: "row", style: "display:contents" });

  // A row/column label: its text, plus whatever decorateLabel adds (notes). When
  // onLabelTap is given the label is a button — tap it to note a whole line.
  function makeLabel(kind, index, text) {
    const node = el("div", { class: `board-label board-label-${kind}`, role: kind === "col" ? "columnheader" : "rowheader" }, [
      el("span", { class: "label-text" }, text),
    ]);
    if (onLabelTap) {
      node.classList.add("board-label-tappable");
      node.tabIndex = 0;
      node.setAttribute(
        "aria-label",
        kind === "col" ? t("Note sulla colonna {n}", { n: index + 1 }) : t("Note sulla riga {n}", { n: index + 1 })
      );
      node.addEventListener("click", () => onLabelTap(kind, index));
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLabelTap(kind, index);
        }
      });
    }
    if (decorateLabel) decorateLabel(node, kind, index);
    return node;
  }

  if (showLabels) {
    const headerRow = makeRow();
    headerRow.appendChild(el("div", { class: "board-label board-label-corner", "aria-hidden": "true" }));
    for (let c = 0; c < grid.size.cols; c++) {
      headerRow.appendChild(makeLabel("col", c, `C${c + 1}`));
    }
    container.appendChild(headerRow);
  }

  for (let r = 0; r < grid.size.rows; r++) {
    const rowNode = makeRow();
    container.appendChild(rowNode);
    let rowLabelNode = null;
    if (showLabels) {
      rowLabelNode = makeLabel("row", r, `R${r + 1}`);
      rowNode.appendChild(rowLabelNode);
    }
    for (let c = 0; c < grid.size.cols; c++) {
      const cellData = grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? zoneById.get(cellData.zoneId) : null;

      let classes = "board-cell";
      if (cellData.blocked) classes += " blocked";
      if (zone) classes += floorOf(zone).own ? " zoned floored" : " zoned";
      if (roomNameCells.has(`${r},${c}`)) classes += " has-room-name";
      for (const edge of edgesByCell.get(`${r},${c}`) || []) classes += ` has-edge-${edge.side || "N"}`;
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
      let cellLabel = t("Riga {v}, colonna {v2}", { v: r + 1, v2: c + 1 });
      if (cellData.blocked) cellLabel += t(", bloccata");
      else if (zone) cellLabel += t(", stanza {name}", { name: zone.name });

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
        style: zone ? floorOf(zone).style : "",
        role: "gridcell",
        "aria-label": cellLabel,
        // Blocked cells still get onClick/onMousedown wired below (callers
        // like handleCellTap/handleCellHold already reject them via isOccupiable), but
        // are deliberately left out of the tab order — a "wall" cell has
        // nothing useful to land keyboard focus on, and skipping it here is
        // simpler than adding tab-order logic that jumps over it.
        tabindex: cellData.blocked ? undefined : "0",
        onClick: (e) => onCellClick && onCellClick(r, c, e),
        onContextmenu: (e) => {
          if (onCellRightClick) {
            e.preventDefault();
            onCellRightClick(r, c, e);
          }
        },
        onMousedown: (e) => {
          if (e.button !== 0 || isPressActive()) return;
          e.preventDefault();
          startPress(r, c, cellNode, pressHooks);
        },
        onKeydown: cellData.blocked
          ? undefined
          : (e) => {
              switch (e.key) {
                case "ArrowUp":
                  e.preventDefault();
                  focusCell(r - 1, c);
                  break;
                case "ArrowDown":
                  e.preventDefault();
                  focusCell(r + 1, c);
                  break;
                case "ArrowLeft":
                  e.preventDefault();
                  focusCell(r, c - 1);
                  break;
                case "ArrowRight":
                  e.preventDefault();
                  focusCell(r, c + 1);
                  break;
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
        onMouseenter: () => enterCell(r, c),
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
        cellNode.addEventListener("touchstart", (e) => beginTouchPress(e, r, c, cellNode, pressHooks), { passive: false });
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
            el("span", { class: "room-label-swatch", style: `background:${roomColor(zone.color)}` }),
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

      const nameTag = roomName.get(`${r},${c}`);
      if (nameTag) {
        cellNode.appendChild(
          el(
            "span",
            { class: "room-name", style: `--span:${nameTag.span}`, title: nameTag.zone.name, "aria-hidden": "true" },
            nameTag.zone.name
          )
        );
      }

      for (const edge of edgesByCell.get(`${r},${c}`) || []) {
        const def = objectIcon(edge.typeId);
        if (!def || !def.edgeIcon) continue;
        const piece = el("span", {
          class: `edge-obj edge-${edge.side || "N"}`,
          title: t("{label} (lato {side})", { label: def.label, side: sideLabel(edge.side || "N") }),
          "aria-hidden": "true",
        });
        piece.innerHTML = def.edgeIcon;
        cellNode.appendChild(piece);
      }

      if (decorateCell) decorateCell(cellNode, r, c);

      rowNode.appendChild(cellNode);
    }
  }

  // On narrow screens the room names that hang off the left of the board no
  // longer fit, so the same information is repeated as a compact legend
  // under the board (hidden on wide screens by CSS; purely visual — each
  // cell's aria-label already names its room).
  const usedZoneIds = new Set(
    grid.cells
      .flat()
      .map((cell) => cell.zoneId)
      .filter(Boolean)
  );
  const legendZones = grid.zones.filter((z) => usedZoneIds.has(z.id));
  if (showLabels && legendZones.length > 0) {
    container.appendChild(
      el(
        "div",
        { class: "room-legend", "aria-hidden": "true" },
        legendZones.map((zone) =>
          el("span", { class: "room-legend-item" }, [
            el("span", { class: "room-label-swatch", style: `background:${roomColor(zone.color)}` }),
            el("span", {}, zone.name),
          ])
        )
      )
    );
  }
}
