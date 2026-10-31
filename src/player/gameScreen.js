import { el, clear, qs, attachHoldToConfirm } from "../util/dom.js";
import { handleCellTap, handleCellHold, handleCellDrag, undo, clearAll, renderPlayerBoard } from "./board.js";
import { renderClueCards } from "./clueCards.js";
import { renderToolbar as renderToolbarChips } from "./toolbar.js";
import { renderHintStep } from "./hintView.js";
import { renderWinPanel } from "./winPanel.js";
import { createEffectiveSolution, murdererName, SOLUTION_UNSATISFIABLE_MSG, SOLUTION_AMBIGUOUS_MSG, SOLUTION_INCONCLUSIVE_MSG } from "./effectiveSolution.js";
import { chainDisclosesSomething, buildManualHintChain, extendChainWithOracleStep } from "./hintLogic.js";
import { computeHintChainAsync } from "../solver/solverClient.js";
import { resolveClueHoverCells, resolveCharacterHoverDomain } from "../solver/hoverTargets.js";
import { formatElapsed } from "../util/time.js";
import * as achievementsStore from "../storage/achievementsStore.js";
import { t } from "../i18n/i18n.js";

// Shared orchestration for a single puzzle-solving screen: toolbar, timer,
// hint-chain stepping, and submit-check. player.html and campaign.html's
// game screen were otherwise character-for-character identical here — the
// only real differences are WHERE a board snapshot gets saved (localStorage
// vs debounced Firestore) and what happens on a correct solve (mark a local
// puzzle completed vs call Firestore's markCaseCompleted), both captured as
// the `persistProgress`/`onSolved` callbacks instead of two parallel copies
// of this file. `achievementKey` is a third small per-caller input: a
// stable string identifying THIS puzzle for achievementsStore.recordSolve
// (`puzzle:<id>` for a standalone puzzle, `campaign:<campaignId>:<caseId>`
// for a campaign case) — gameScreen.js itself has no notion of which
// campaign/case a puzzle came from, only the caller does.
//
// Queries its own DOM refs by id rather than taking them as a parameter —
// player.html and campaign.html deliberately use the exact same ids for
// every element this module touches (#player-toolbar, #board, #clues-panel,
// #briefing-panel, #result-panel, #undo-btn, #clear-btn, #hint-btn,
// #hint-panel, #submit-btn, #timer). Keep it that way if either page's
// markup changes. #notes-hint also exists in both pages but is a static
// instruction paragraph now (no mode toggle to reflect) — this module never
// touches it.
export function createGameScreen({ puzzle, state, persistProgress, onSolved, achievementKey }) {
  const toolbarEl = qs("#player-toolbar");
  const boardEl = qs("#board");
  const cluesEl = qs("#clues-panel");
  const briefingEl = qs("#briefing-panel");
  const resultEl = qs("#result-panel");
  const undoBtn = qs("#undo-btn");
  const clearBtn = qs("#clear-btn");
  const hintBtn = qs("#hint-btn");
  const hintPanel = qs("#hint-panel");
  const submitBtn = qs("#submit-btn");
  const timerEl = qs("#timer");

  let hintHighlight = null; // { cells: [{row,col,cls}] } | null — ephemeral, not part of board.js state
  let hintChain = [];
  let hintChainIndex = 0;
  let timerInterval = null;
  let startedAt = null; // read by onSubmit too, for the elapsed time passed to onSolved
  let solved = false; // true once onSubmit's win branch has fired — keeps "Verifica soluzione" disabled until a placement/note actually changes again
  const effectiveSolution = createEffectiveSolution(puzzle);
  const getEffectiveSolution = () => effectiveSolution.get();

  function startTimer() {
    startedAt = Date.now();
    timerEl.textContent = "⏱ 0:00";
    timerInterval = setInterval(() => {
      timerEl.textContent = `⏱ ${formatElapsed(Math.floor((Date.now() - startedAt) / 1000))}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Selecting a character also highlights their clue card and every candidate
  // mark they already have on the board (see renderClueCards/board.js), so
  // re-render both whenever the active tool changes.
  function selectTool(tool) {
    state.selectedTool = tool;
    renderToolbar();
    renderBoardAndClues();
  }

  function renderToolbar() {
    renderToolbarChips(toolbarEl, puzzle, state, { selectTool, showCharacterHover, clearHover });
  }

  // Ephemeral, non-serialized cell highlighting for hover — mirrors
  // hintHighlight/applyHintHighlight below, but deliberately lighter-weight:
  // no full re-render, no dimming of the rest of the board (hover is a
  // frequent, transient touch, not a deliberate "look here" moment like a
  // hint). Classes are applied/removed directly on already-rendered nodes.
  function applyHoverCells(cells) {
    for (const { row, col } of cells) {
      const node = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (node) node.classList.add("hover-target");
    }
  }
  function clearHover() {
    boardEl.querySelectorAll(".hover-target").forEach((n) => n.classList.remove("hover-target"));
  }
  function showCharacterHover(characterId) {
    clearHover();
    applyHoverCells(resolveCharacterHoverDomain(puzzle, characterId, state.placements));
  }
  function showClueHover(clue) {
    clearHover();
    applyHoverCells(resolveClueHoverCells(clue, puzzle, state.placements));
  }

  // Dims every other cell while a hint is showing (see player.css) so the
  // highlighted one(s) can't get lost among character tokens, zone
  // textures, and wall borders on a busy board.
  function applyHintHighlight() {
    boardEl.classList.toggle("hint-active", !!hintHighlight);
    if (!hintHighlight) return;
    for (const { row, col, cls } of hintHighlight.cells) {
      const node = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (node) node.classList.add(cls);
    }
  }

  function clearHint() {
    hintHighlight = null;
    hintChain = [];
    hintChainIndex = 0;
    clear(hintPanel);
  }

  // Re-arms the submit button after a win — called from every handler that
  // can mutate state.placements/xMarks/candidates (tap, hold, drag, undo,
  // clear), since any of those can turn an already-solved board back into an
  // incomplete/wrong one (most directly: "Pulisci tutto" after a solve).
  // Deliberately not called from renderBoardAndClues() itself, which
  // selectTool()/showHintStep() also call without mutating anything.
  function markUnsolved() {
    solved = false;
    submitBtn.disabled = false;
  }

  // One board mutation = clear any hint, apply it, re-arm submit, save, redraw.
  function applyBoardChange(mutate, { rerenderToolbar = true } = {}) {
    clearHint();
    mutate();
    markUnsolved();
    persistProgress();
    if (rerenderToolbar) renderToolbar();
    renderBoardAndClues();
  }

  function renderBoardAndClues() {
    // Snapshotted at the instant a press begins and read back — instead of the
    // live state.selectedTool — when the hold timer fires: selectedTool can be
    // reassigned while a hold is pending (e.g. showHintStep() auto-selecting a
    // character via a second touch), and pinning it here is what makes
    // handleCellHold's own `tool` override meaningful.
    let pressStartTool = null;
    renderPlayerBoard(
      boardEl, puzzle, state,
      (row, col) => applyBoardChange(() => handleCellTap(state, puzzle.grid, row, col)), // tap: nota (o X/gomma)
      (row, col) => applyBoardChange(() => handleCellHold(state, puzzle.grid, row, col, pressStartTool)), // hold: conferma il personaggio selezionato all'inizio della pressione
      (row, col) => { // drag: note su più caselle (non azzera l'eventuale suggerimento)
        handleCellDrag(state, puzzle.grid, row, col);
        markUnsolved();
        persistProgress();
        renderBoardAndClues();
      },
      () => { pressStartTool = state.selectedTool; } // onPressStart
    );
    applyHintHighlight();
    renderClueCards(cluesEl, puzzle, state, showClueHover, clearHover);
  }

  function showHintStep() {
    const result = hintChain[hintChainIndex];
    hintHighlight = null;

    if (result.type === "forcedPlacement") {
      hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-target" }] };
      state.selectedTool = { kind: "character", id: result.characterId };
    } else if (result.type === "eliminatedCell") {
      hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-info" }] };
    } else if (result.type === "contradiction" && result.culprits.length > 0) {
      hintHighlight = {
        cells: result.culprits.map((id) => state.placements.get(id)).filter(Boolean).map((pos) => ({ row: pos.row, col: pos.col, cls: "hint-culprit" })),
      };
      if (result.culprits.length === 1) state.selectedTool = { kind: "erase" };
    }

    clear(hintPanel);
    for (const node of renderHintStep(puzzle, hintChain, hintChainIndex, {
      onPrev: () => { hintChainIndex--; showHintStep(); },
      onNext: () => { hintChainIndex++; showHintStep(); },
    })) hintPanel.appendChild(node);
    renderToolbar();
    renderBoardAndClues();
  }

  // Counts once per click that discloses something real — never for the ‹ ›
  // nav buttons re-showing an already-computed chain (they call
  // showHintStep() directly, never onHint()).
  function countHintIfReal() {
    if (chainDisclosesSomething(hintChain)) {
      state.hintsUsed++;
      persistProgress();
    }
  }

  async function onHint() {
    hintBtn.disabled = true;
    clear(hintPanel);

    // No Web Worker round-trip for author-written hints: the content is
    // already fully known synchronously.
    const manualChain = buildManualHintChain(puzzle);
    if (manualChain) {
      hintChain = manualChain;
      countHintIfReal();
      hintChainIndex = 0;
      showHintStep();
      hintBtn.disabled = false;
      return;
    }

    hintPanel.appendChild(el("div", { class: "result-banner hint-info" }, t("Sto calcolando un suggerimento…")));
    try {
      hintChain = await computeHintChainAsync(puzzle, state.placements, state.candidates);
      await extendChainWithOracleStep(hintChain, { puzzle, placements: state.placements, getEffectiveSolution });
      countHintIfReal();
      hintChainIndex = 0;
      showHintStep(); // already clears and re-renders hintPanel
    } catch (err) {
      clear(hintPanel);
      hintPanel.appendChild(el("div", { class: "result-banner hint-error" }, t("Non sono riuscito a calcolare un suggerimento: {message}. Riprova.", { message: err.message })));
    } finally {
      hintBtn.disabled = false;
    }
  }

  async function onSubmit() {
    clear(resultEl);
    submitBtn.disabled = true;
    resultEl.appendChild(el("div", { class: "result-banner hint-info" }, t("Sto verificando la soluzione…")));
    try {
      const effective = await getEffectiveSolution();
      clear(resultEl);
      if (effective.status !== "unique") {
        const message =
          effective.status === "unsatisfiable" ? SOLUTION_UNSATISFIABLE_MSG :
          effective.status === "ambiguous" ? SOLUTION_AMBIGUOUS_MSG :
          SOLUTION_INCONCLUSIVE_MSG;
        const cls = effective.status === "inconclusive" ? "hint-warning" : "hint-error";
        resultEl.appendChild(el("div", { class: `result-banner ${cls}` }, message));
        return;
      }

      const total = puzzle.characters.length;
      let correct = 0;
      for (const p of effective.placements) {
        const placed = state.placements.get(p.characterId);
        if (placed && placed.row === p.row && placed.col === p.col) correct++;
      }

      if (correct === total && state.placements.size === total) {
        solved = true;
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const previousBest = puzzle.bestTimeSeconds;
        stopTimer();
        await onSolved(elapsed);
        const hintsUsed = state.hintsUsed;
        const newlyUnlocked = achievementsStore.recordSolve({ key: achievementKey, elapsedSeconds: elapsed, hintsUsed });
        resultEl.appendChild(renderWinPanel({ puzzle, murderer: murdererName(puzzle, effective), elapsed, previousBest, hintsUsed, newlyUnlocked }));
      } else {
        // Deliberately doesn't say how many are right — that would let you brute
        // force it by trial and error instead of reasoning from the clues.
        resultEl.appendChild(el("div", { class: "result-banner partial" }, t("Non è ancora tutto corretto. Continua a dedurre dagli indizi.")));
      }
    } catch (err) {
      clear(resultEl);
      resultEl.appendChild(el("div", { class: "result-banner hint-error" }, t("Non sono riuscito a verificare la soluzione: {message}. Riprova.", { message: err.message })));
    } finally {
      submitBtn.disabled = solved;
    }
  }

  function renderBriefing() {
    clear(briefingEl);
    briefingEl.classList.toggle("hidden", !puzzle.briefing);
    if (puzzle.briefing) {
      briefingEl.appendChild(el("h3", {}, t("Il caso")));
      briefingEl.appendChild(el("p", {}, puzzle.briefing));
    }
  }

  function wireControls() {
    undoBtn.addEventListener("click", () => applyBoardChange(() => undo(state)));
    attachHoldToConfirm(clearBtn, 700, () => {
      applyBoardChange(() => clearAll(state));
      clear(resultEl);
    });
    hintBtn.addEventListener("click", onHint);
    submitBtn.addEventListener("click", onSubmit);
  }

  // Full initial setup — render, briefing, timer, and every control's event
  // listener. Call once, after `puzzle`/`state` are both ready; there's no
  // teardown/re-init support since both callers are full-page-navigation apps
  // where this only ever runs once per page load.
  function start() {
    renderToolbar();
    renderBoardAndClues();
    renderBriefing();
    clear(resultEl);
    startTimer();
    wireControls();
  }

  return { start };
}
