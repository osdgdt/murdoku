// Press, hold, tap and drag on the board cells — mouse and touch.
//
// One press at a time is tracked in module-level state (only one board is ever
// interactive); renderBoard() (boardRender.js) wires the cells to the exported
// functions below and refreshes the callbacks on every render.
import { el } from "./dom.js";

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
// Listeners on the element a touch STARTED on, alive for the whole touch (see
// beginTouchPress): the browser keeps sending a touch's events to that element
// even after a re-render has removed it from the page, so document-level
// listeners alone would lose the finger as soon as the first cell is painted.
let followTouch = null;
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
// the same cell, is a hold. Kept in sync by hand with the `hold-wheel-fill`
// CSS animation duration in styles/player.css (same manual-duplication
// tradeoff attachHoldToConfirm/700ms already accepts, src/util/dom.js).
const HOLD_THRESHOLD_MS = 900;
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
// The <div class="hold-wheel"> child currently appended to holdingCellNode,
// if any — tracked explicitly (not re-found via querySelector) so it can be
// removed on every exit path the exact same way holdingCellNode itself is.
let holdWheelNode = null;

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}
function clearHoldingVisual() {
  if (holdingCellNode) {
    holdingCellNode.classList.remove("holding");
    holdingCellNode = null;
  }
  if (holdWheelNode) {
    holdWheelNode.remove();
    holdWheelNode = null;
  }
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

function resetPressState() {
  followTouch?.abort();
  followTouch = null;
  dragActive = false;
  dragDownCell = null;
  lastTouchCell = null;
  activeTouchId = null;
  clearHoldTimer();
  holdFired = false;
  dragConverted = false;
  clearHoldingVisual();
}
// A genuine release (mouseup/touchend) that never moved off the down-cell
// and never held long enough to trigger onCellHold is a completed tap.
function releasePress() {
  if (dragActive && dragDownCell && !holdFired && !dragConverted && currentOnCellTap) {
    currentOnCellTap(dragDownCell.row, dragDownCell.col);
  }
  resetPressState();
}
// True if this touch event carries the finger that started the current
// press (or if the press isn't touch-driven at all) — see activeTouchId.
const isOwnTouch = (e) => activeTouchId === null || [...e.changedTouches].some((t) => t.identifier === activeTouchId);

function onTouchEnd(e) {
  if (isOwnTouch(e)) releasePress();
}
function onTouchCancel(e) {
  if (isOwnTouch(e)) resetPressState();
}
function onTouchMove(e) {
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
}

if (typeof document !== "undefined") {
  document.addEventListener("mouseup", releasePress);
  // draggable="false" is set on every cell, so this should never fire in
  // practice; if it ever does, treat it as an aborted gesture, not a
  // completed tap.
  document.addEventListener("dragend", resetPressState);
  document.addEventListener("touchend", onTouchEnd);
  // System-aborted gesture (e.g. an incoming call) — never a completed tap.
  document.addEventListener("touchcancel", onTouchCancel);
  // A press abandoned by leaving the window/tab entirely (alt-tab, the mouse
  // moving off-screen, switching apps mid-touch) must be cancelled outright,
  // not left armed to fire onCellHold later out of context, once focus
  // returns, on whatever's still under the cursor — mirrors
  // attachHoldToConfirm's mouseleave cancellation (src/util/dom.js) for the
  // same reason. window "blur" fires for all of these; a plain document
  // mouseleave would not (the pointer usually leaves via the OS chrome, not
  // back into the document).
  window.addEventListener("blur", resetPressState);
  document.addEventListener("touchmove", onTouchMove, { passive: false });
}

export function setGestureCallbacks({ onCellEnter, onCellTap }) {
  currentOnCellEnter = onCellEnter || null;
  currentOnCellTap = onCellTap || null;
}

export function isPressActive() {
  return dragActive;
}

// Starts a press on cell (r,c): if the caller wants hold-detection
// (onCellHold provided — only the player board does), arms the hold timer
// and shows the "holding" fill animation; otherwise just marks the press
// as active (editor boards: onCellClick alone handles everything, this is
// a harmless no-op setup shared with the player-board path). Shared by
// mousedown and touchstart to avoid duplicating the hold-timer logic per
// input type. Ignores a press while one is already active (e.g. a second
// finger touching the board) — only the first press drives the gesture; see
// activeTouchId for the touch-identity side of this.
export function startPress(r, c, node, { onPressStart, onCellHold }) {
  if (dragActive) return;
  dragActive = true;
  dragDownCell = { row: r, col: c };
  holdFired = false;
  dragConverted = false;
  // Fires once, synchronously, right as the press begins — lets a caller
  // (gameScreen.js) snapshot anything that could otherwise change out from
  // under a pending hold before its timer fires (e.g. the selected tool,
  // if something else reassigns it mid-hold via a second, unrelated
  // touch — see handleCellHold's `tool` override in board.js).
  if (onPressStart) onPressStart(r, c);
  if (onCellHold) {
    node.classList.add("holding");
    holdingCellNode = node;
    holdWheelNode = el("div", { class: "hold-wheel", "aria-hidden": "true" });
    holdWheelNode.innerHTML =
      '<svg viewBox="0 0 40 40"><circle class="hold-wheel-track" cx="20" cy="20" r="16"/><circle class="hold-wheel-fill" cx="20" cy="20" r="16"/></svg>';
    node.appendChild(holdWheelNode);
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holdFired = true;
      clearHoldingVisual();
      onCellHold(r, c);
    }, HOLD_THRESHOLD_MS);
  }
}

// The mouse pointer entered cell (r,c) while a button is held: a drag.
export function enterCell(r, c) {
  if (!dragActive || holdFired) return;
  if (dragDownCell && dragDownCell.row === r && dragDownCell.col === c) return;
  convertToDrag();
  if (currentOnCellEnter) currentOnCellEnter(r, c);
}

// A finger went down on cell (r,c). Besides starting the press, follow this
// touch on the element it started on: a drag repaints the board, which
// replaces that element, and from then on the browser delivers the finger's
// touchmove/touchend/touchcancel to the detached element only — never to
// `document`. While the element is still on the page the document-level
// listeners handle everything, so these forward only once it is detached.
export function beginTouchPress(e, r, c, node, hooks) {
  if (dragActive) return; // a second, unrelated finger — ignore
  e.preventDefault();
  activeTouchId = e.changedTouches[0]?.identifier ?? null;
  lastTouchCell = { row: r, col: c };
  startPress(r, c, node, hooks);
  const target = e.target;
  if (!dragActive || !target?.addEventListener) return;
  followTouch = new AbortController();
  const options = { passive: false, signal: followTouch.signal };
  const forward = (handler) => (ev) => {
    if (!target.isConnected) handler(ev);
  };
  target.addEventListener("touchmove", forward(onTouchMove), options);
  target.addEventListener("touchend", forward(onTouchEnd), options);
  target.addEventListener("touchcancel", forward(onTouchCancel), options);
}
