import { el, clear } from "./dom.js";
import { objectIcon, isEdgeObjectType, sideLabel } from "../model/icons.js";
import { floorStyle } from "../model/textures.js";
import { wallBetween as modelWallBetween, edgeCells } from "../model/grid.js";
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
// How crowded a cell is, as an attribute of the board (`data-density`: "normal",
// "small" under 50px, "tiny" under 44px), so the stylesheet can drop what does not
// fit: with 10 to 16 characters the notes lose their letter and the room-name tab
// goes (the legend has the names). The cell size comes from CSS (it depends on the
// number of columns and the window), so it is measured, and re-measured whenever
// the board changes size.
let boardCounter = 0;
const densityObservers = new WeakMap();
function applyDensity(container) {
  const cell = container.querySelector(".board-cell");
  const px = cell ? cell.getBoundingClientRect().width : CELL_SIZE;
  container.dataset.density = px < 44 ? "tiny" : px < 50 ? "small" : "normal";
}
function trackDensity(container) {
  if (typeof ResizeObserver === "undefined") return;
  if (densityObservers.has(container)) return;
  const observer = new ResizeObserver(() => applyDensity(container));
  observer.observe(container);
  densityObservers.set(container, observer);
  applyDensity(container);
}

// Keyboard navigation (roving tabindex): the board is ONE tab stop, whatever its size. Tab lands on the
// cell that was last current, the arrow keys move between cells (skipping blocked ones, and going on up
// into the row/column labels when they can be tapped), Home/End jump along the row, PageUp/PageDown
// along the column, Ctrl+Home/End to the first/last cell. The board is rebuilt on every change, so the
// current position is remembered per container and focus is put back after a rebuild.
// How long a press on a row/column label must stay still to be a hold (as on the cells: boardGestures.js).
const LABEL_HOLD_MS = 500;
const navConfig = new WeakMap(); // container -> { grid, hasLabelNav, activateCell, activateCellHold, roving }

const cellNodeAt = (container, r, c) => container.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`);
const labelNodeAt = (container, kind, index) => container.querySelector(`.board-label-${kind}[data-nav-index="${index}"]`);

// The grid position of a focusable node: cells are (row, col), a column label (-1, col), a row label (row, -1).
function navPositionOf(node) {
  if (!node || !node.dataset) return null;
  if (node.dataset.row !== undefined) return { r: Number(node.dataset.row), c: Number(node.dataset.col) };
  if (node.dataset.navKind === "col") return { r: -1, c: Number(node.dataset.navIndex) };
  if (node.dataset.navKind === "row") return { r: Number(node.dataset.navIndex), c: -1 };
  return null;
}

function navNodeAt(container, r, c) {
  const cfg = navConfig.get(container);
  if (!cfg) return null;
  const { rows, cols } = cfg.grid.size;
  if (r >= 0 && c >= 0) {
    if (r >= rows || c >= cols) return null;
    const node = cellNodeAt(container, r, c);
    return node && !node.classList.contains("blocked") ? node : null;
  }
  if (!cfg.hasLabelNav) return null;
  if (r === -1 && c >= 0 && c < cols) return labelNodeAt(container, "col", c);
  if (c === -1 && r >= 0 && r < rows) return labelNodeAt(container, "row", r);
  return null;
}

function setRoving(container, node) {
  const cfg = navConfig.get(container);
  if (!cfg || !node) return;
  if (cfg.roving && cfg.roving !== node && cfg.roving.isConnected) cfg.roving.tabIndex = -1;
  node.tabIndex = 0;
  cfg.roving = node;
}

function focusNav(container, r, c) {
  const node = navNodeAt(container, r, c);
  if (!node) return false;
  setRoving(container, node);
  node.focus();
  return true;
}

// The next focusable position from (r, c) going in direction (dr, dc), or null.
function stepFrom(container, r, c, dr, dc) {
  const cfg = navConfig.get(container);
  const { rows, cols } = cfg.grid.size;
  const min = cfg.hasLabelNav ? -1 : 0;
  let nr = r + dr;
  let nc = c + dc;
  while (nr >= min && nc >= min && nr < rows && nc < cols) {
    if (navNodeAt(container, nr, nc)) return { r: nr, c: nc };
    nr += dr;
    nc += dc;
  }
  return null;
}

// First/last focusable cell of a line (not its label), from the start or the end.
function endOfLine(container, r, c, horizontal, last) {
  const { rows, cols } = navConfig.get(container).grid.size;
  const length = horizontal ? cols : rows;
  for (let i = 0; i < length; i++) {
    const k = last ? length - 1 - i : i;
    const pr = horizontal ? r : k;
    const pc = horizontal ? k : c;
    if (pr >= 0 && pc >= 0 && navNodeAt(container, pr, pc)) return { r: pr, c: pc };
  }
  return null;
}

function handleNavKey(container, e) {
  const cfg = navConfig.get(container);
  const here = navPositionOf(e.target);
  if (!cfg || !here) return;
  let next = null;
  switch (e.key) {
    case "ArrowUp":
      next = stepFrom(container, here.r, here.c, -1, 0);
      break;
    case "ArrowDown":
      next = stepFrom(container, here.r, here.c, 1, 0);
      break;
    case "ArrowLeft":
      next = stepFrom(container, here.r, here.c, 0, -1);
      break;
    case "ArrowRight":
      next = stepFrom(container, here.r, here.c, 0, 1);
      break;
    case "Home":
      if (e.ctrlKey || e.metaKey) {
        const { rows } = cfg.grid.size;
        for (let r = 0; r < rows && !next; r++) next = endOfLine(container, r, 0, true, false);
      } else next = endOfLine(container, Math.max(here.r, 0), here.c, true, false);
      break;
    case "End":
      if (e.ctrlKey || e.metaKey) {
        const { rows } = cfg.grid.size;
        for (let r = rows - 1; r >= 0 && !next; r--) next = endOfLine(container, r, 0, true, true);
      } else next = endOfLine(container, Math.max(here.r, 0), here.c, true, true);
      break;
    case "PageUp":
      next = endOfLine(container, 0, Math.max(here.c, 0), false, false);
      break;
    case "PageDown":
      next = endOfLine(container, 0, Math.max(here.c, 0), false, true);
      break;
    default:
      return;
  }
  e.preventDefault();
  if (next) focusNav(container, next.r, next.c);
}

function wireNavigation(container) {
  if (container.dataset.navWired) return;
  container.dataset.navWired = "1";
  container.addEventListener("keydown", (e) => {
    const cfg = navConfig.get(container);
    if (!cfg || e.altKey) return;
    if (e.target.classList?.contains("board-cell")) {
      const r = Number(e.target.dataset.row);
      const c = Number(e.target.dataset.col);
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) cfg.activateCellHold(r, c);
        else cfg.activateCell(r, c);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        cfg.activateCell(r, c);
        return;
      }
    }
    handleNavKey(container, e);
  });
  // A cell or label that gets focus any other way (a click, a screen reader's own cursor) becomes the current one.
  container.addEventListener("focusin", (e) => {
    if (navPositionOf(e.target)) setRoving(container, e.target);
  });
}

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
    onLabelHold,
    showLabels = true,
  } = {}
) {
  // The board is rebuilt from scratch on every change: remember where the keyboard focus (and the
  // current cell) was, to put it back afterwards.
  const previousNav = navConfig.get(container);
  const hadFocus = typeof document !== "undefined" && container.contains(document.activeElement);
  const focusedAt = hadFocus ? navPositionOf(document.activeElement) : null;
  const rememberedAt = previousNav?.roving?.isConnected ? navPositionOf(previousNav.roving) : null;
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
  navConfig.set(container, { grid, hasLabelNav: !!(showLabels && onLabelTap), activateCell, activateCellHold, roving: null });
  wireNavigation(container);

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
  // Doors/windows are pieces of a WALL, shared by the two cells they lie
  // between (see model/grid.js): each is drawn once, by the cell it is stored
  // under, centred on the line between the two cells. Both cells learn which of
  // their sides it is on (`edgeSidesByCell`), to keep notes and the room name
  // clear of it.
  const OPPOSITE_SIDE = { N: "S", S: "N", E: "W", W: "E" };
  const edgesByCell = new Map();
  const edgeSidesByCell = new Map();
  const addEdgeSide = (r, c, side) => {
    const k = `${r},${c}`;
    if (!edgeSidesByCell.has(k)) edgeSidesByCell.set(k, new Set());
    edgeSidesByCell.get(k).add(side);
  };
  const isBlocked = (cell) => !!cell && grid.cells[cell.row][cell.col].blocked;
  for (const o of grid.objects) {
    if (!isEdgeObjectType(o.typeId)) continue;
    const side = o.side || "N";
    const [own, other] = edgeCells(grid, o);
    addEdgeSide(own.row, own.col, side);
    if (other) addEdgeSide(other.row, other.col, OPPOSITE_SIDE[side]);
    // A blocked cell is not drawn, so a piece stored under it is drawn by the other
    // cell of its segment (from that cell's point of view: the opposite side).
    let anchor = { cell: own, side };
    if (isBlocked(own)) anchor = other && !isBlocked(other) ? { cell: other, side: OPPOSITE_SIDE[side] } : null;
    if (!anchor) continue;
    const k = `${anchor.cell.row},${anchor.cell.col}`;
    if (!edgesByCell.has(k)) edgesByCell.set(k, []);
    edgesByCell.get(k).push({ obj: o, side: anchor.side });
  }
  // Every cell of a room shares one floor: its style is written ONCE per room, as a
  // rule in a <style> element of the board (cells just carry the room's class), not
  // copied into every cell: a textured floor is several KB of CSS, and on a 16x16
  // board that was megabytes of inline style rebuilt on every render.
  // `data-bid` scopes the rules to this board (a page may hold many).
  container.dataset.bid = `b${++boardCounter}`;
  const floorRules = [];
  const floorCache = new Map();
  const floorOf = (zone) => {
    if (!floorCache.has(zone.id)) {
      const { image, size, pos, own } = floorStyle(zone.textureId, roomColor(zone.color));
      const cls = `zr${floorCache.size}`;
      floorRules.push(
        `[data-bid="${container.dataset.bid}"] .${cls}{--room:${roomColor(zone.color)};--zone-texture:${image};--zone-texture-size:${size};--zone-texture-pos:${pos}}`
      );
      floorCache.set(zone.id, { own, cls });
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
  const wallBetween = (r1, c1, r2, c2) => modelWallBetween(grid, r1, c1, r2, c2);

  // One room-name label per zone, anchored at its first cell in reading
  // order, instead of repeating the name on every cell of the zone.
  const zoneAnchor = new Map();
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      const key = zoneKeyAt(r, c);
      if (key && !zoneAnchor.has(key)) zoneAnchor.set(key, `${r},${c}`);
    }
  }

  // The room's name is written ON the room, once: a small tab in the top-left of
  // its first cell, as wide as the name (one cell at most). The cell under it is
  // flagged so notes keep clear of it. (Anchor: first cell in reading order with
  // no object and no door/window on its north side, so the tab never covers a
  // drawing.)
  const roomName = new Map(); // "r,c" -> zone
  const freeForName = (r, c) => {
    const cd = grid.cells[r][c];
    if (cd.blocked || cd.objectId) return false;
    return !edgeSidesByCell.get(`${r},${c}`)?.has("N");
  };
  for (const zone of grid.zones) {
    let anchor = null;
    for (let r = 0; r < grid.size.rows && !anchor; r++) {
      for (let c = 0; c < grid.size.cols; c++) {
        if (grid.cells[r][c].zoneId === zone.id && !grid.cells[r][c].blocked && freeForName(r, c)) {
          anchor = `${r},${c}`;
          break;
        }
      }
    }
    if (anchor) roomName.set(anchor, zone);
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
    node.dataset.navKind = kind;
    node.dataset.navIndex = String(index);
    if (onLabelTap) {
      node.classList.add("board-label-tappable");
      node.tabIndex = -1; // reached with the arrow keys from the cells (see handleNavKey)
      node.setAttribute(
        "aria-label",
        kind === "col" ? t("Note sulla colonna {n}", { n: index + 1 }) : t("Note sulla riga {n}", { n: index + 1 })
      );
      // A press that stays still on the label for the hold time is a "hold" (reserve the whole line); a short one is the click.
      let holdTimer = null;
      let held = false;
      const cancelHold = () => {
        clearTimeout(holdTimer);
        holdTimer = null;
        node.classList.remove("holding");
      };
      if (onLabelHold) {
        node.addEventListener("pointerdown", (e) => {
          if (e.button > 0) return;
          held = false;
          cancelHold();
          node.classList.add("holding");
          holdTimer = setTimeout(() => {
            holdTimer = null;
            held = true;
            node.classList.remove("holding");
            onLabelHold(kind, index);
          }, LABEL_HOLD_MS);
        });
        for (const type of ["pointerup", "pointercancel", "pointerleave"]) node.addEventListener(type, cancelHold);
        node.addEventListener("contextmenu", (e) => held && e.preventDefault());
      }
      node.addEventListener("click", () => {
        if (held) {
          held = false; // the click that ends a hold is not a tap
          return;
        }
        onLabelTap(kind, index);
      });
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.shiftKey && onLabelHold) onLabelHold(kind, index);
          else onLabelTap(kind, index);
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
      if (zone) classes += (floorOf(zone).own ? " zoned floored " : " zoned ") + floorOf(zone).cls;
      if (roomName.has(`${r},${c}`)) classes += " has-room-name";
      for (const side of edgeSidesByCell.get(`${r},${c}`) || []) classes += ` has-edge-${side}`;
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
        // --r/--c: the cell's place on the board, so a room's floor pattern runs
        // on from cell to cell (see --tile-pos in editor.css).
        style: zone ? `--r:${r};--c:${c}` : "",
        role: "gridcell",
        "aria-label": cellLabel,
        // Blocked cells still get onClick/onMousedown wired below (callers
        // like handleCellTap/handleCellHold already reject them via isOccupiable), but
        // are deliberately left out of the tab order — a "wall" cell has
        // nothing useful to land keyboard focus on, and skipping it here is
        // simpler than adding tab-order logic that jumps over it.
        tabindex: cellData.blocked ? undefined : "-1",
        onClick: (e) => onCellClick && onCellClick(r, c, e),
        onContextmenu: (e) => {
          // A long press on a phone raises "contextmenu" too: it must not erase the cell
          // (object, room and block), only a real right click does.
          if (e.pointerType === "touch") return;
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
        // In its row, like every other cell: the board is laid out by DOM order, so a
        // cell appended anywhere else drifts to the end of the row and shifts the rest.
        rowNode.appendChild(cellNode);
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

      const nameZone = roomName.get(`${r},${c}`);
      if (nameZone) cellNode.appendChild(el("span", { class: "room-name", title: nameZone.name, "aria-hidden": "true" }, nameZone.name));

      for (const { obj: edge, side } of edgesByCell.get(`${r},${c}`) || []) {
        const def = objectIcon(edge.typeId);
        if (!def || !def.edgeIcon) continue;
        const piece = el("span", {
          class: `edge-obj edge-${side}`,
          title: t("{label} (lato {side})", { label: def.label, side: sideLabel(side) }),
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
  if (floorRules.length > 0) container.appendChild(el("style", {}, floorRules.join("\n")));
  container.toggleAttribute("data-big", grid.size.cols > 12);
  trackDensity(container);

  // The one tab stop: where the keyboard focus was, else the current cell, else the first free cell.
  const wanted = focusedAt ?? rememberedAt;
  let landing = wanted ? navNodeAt(container, wanted.r, wanted.c) : null;
  if (!landing) {
    for (let r = 0; r < grid.size.rows && !landing; r++) {
      const first = endOfLine(container, r, 0, true, false);
      if (first) landing = navNodeAt(container, first.r, first.c);
    }
  }
  if (landing) {
    setRoving(container, landing);
    if (hadFocus) landing.focus({ preventScroll: true });
  }
}
