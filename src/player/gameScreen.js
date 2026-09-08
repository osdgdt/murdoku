import { el, clear, qs, attachHoldToConfirm } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { zoneOfCell } from "../model/grid.js";
import { characterColor } from "../model/puzzle.js";
import { describeClue } from "../model/clueTypes.js";
import { handleCellClick, handleCellDrag, undo, clearAll, renderPlayerBoard } from "./board.js";
import { renderClueCards } from "./clueCards.js";
import { computeHintChain } from "../solver/hints.js";
import { formatElapsed } from "../util/time.js";

// Shared orchestration for a single puzzle-solving screen: toolbar, timer,
// hint-chain stepping, and submit-check. player.html and campaign.html's
// game screen were otherwise character-for-character identical here — the
// only real differences are WHERE a board snapshot gets saved (localStorage
// vs debounced Firestore) and what happens on a correct solve (mark a local
// puzzle completed vs call Firestore's markCaseCompleted), both captured as
// the `persistProgress`/`onSolved` callbacks instead of two parallel copies
// of this file.
//
// Queries its own DOM refs by id rather than taking them as a parameter —
// player.html and campaign.html deliberately use the exact same ids for
// every element this module touches (#player-toolbar, #board, #clues-panel,
// #briefing-panel, #result-panel, #notes-btn, #notes-hint, #undo-btn,
// #clear-btn, #hint-btn, #hint-panel, #submit-btn, #timer). Keep it that way
// if either page's markup changes.
export function createGameScreen({ puzzle, state, persistProgress, onSolved }) {
  const toolbarEl = qs("#player-toolbar");
  const boardEl = qs("#board");
  const cluesEl = qs("#clues-panel");
  const briefingEl = qs("#briefing-panel");
  const resultEl = qs("#result-panel");
  const notesBtn = qs("#notes-btn");
  const notesHint = qs("#notes-hint");
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
  let startedAt = null; // hoisted out of startTimer so onSubmit can also read it, for the elapsed time passed to onSolved

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
    clear(toolbarEl);
    for (const character of puzzle.characters) {
      const placed = state.placements.has(character.id);
      const chip = el("div", {
        class: "char-chip" + (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") + (placed ? " used" : ""),
        onClick: () => selectTool({ kind: "character", id: character.id }),
      });
      const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
      iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
      chip.appendChild(iconWrap);
      if (!character.isVictim) chip.style.borderLeft = `3px solid ${characterColor(character)}`;
      chip.appendChild(document.createTextNode(character.name + (character.isVictim ? " (V)" : "")));
      toolbarEl.appendChild(chip);
    }
    toolbarEl.appendChild(el("div", { class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""), onClick: () => selectTool({ kind: "x" }) }, "✕ Segna"));
    toolbarEl.appendChild(el("div", { class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""), onClick: () => selectTool({ kind: "erase" }) }, "🧹 Gomma"));
  }

  function updateNotesUI() {
    notesBtn.classList.toggle("primary", state.notesMode);
    notesHint.textContent = state.notesMode
      ? "Modalità note attiva: seleziona un personaggio e clicca una cella per segnarlo come candidato in quella casella (notazione a griglia 3x3, come le matite del sudoku)."
      : "Modalità piazzamento: seleziona un personaggio e clicca una cella per confermarlo.";
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

  function renderBoardAndClues() {
    renderPlayerBoard(
      boardEl, puzzle, state,
      (row, col) => {
        clearHint();
        handleCellClick(state, puzzle.grid, row, col);
        persistProgress();
        renderToolbar();
        renderBoardAndClues();
      },
      (row, col) => {
        handleCellDrag(state, puzzle.grid, row, col);
        persistProgress();
        renderBoardAndClues();
      }
    );
    applyHintHighlight();
    renderClueCards(cluesEl, puzzle, state);
  }

  function murdererName() {
    const victim = puzzle.characters.find((c) => c.isVictim);
    if (!victim) return null;
    const vPlacement = puzzle.solution.placements.find((p) => p.characterId === victim.id);
    if (!vPlacement) return null;
    const vZone = zoneOfCell(puzzle.grid, vPlacement.row, vPlacement.col);
    if (vZone === null) return null;
    const sameZoneChars = puzzle.solution.placements.filter((p) => p.characterId !== victim.id && zoneOfCell(puzzle.grid, p.row, p.col) === vZone);
    if (sameZoneChars.length !== 1) return null;
    const murderer = puzzle.characters.find((c) => c.id === sameZoneChars[0].characterId);
    return murderer ? murderer.name : null;
  }

  // Renders the "Perché" explanation block under a hint step's banner: which
  // specific clues (by name, prefixed with the owning character when it's not
  // the step's own subject — e.g. a different character's directional clue can
  // be what forces THIS character's cell) make the deduction certain. Returns
  // null when there's nothing to add (result types other than
  // forcedPlacement/eliminatedCell/a clue-cause contradiction).
  function renderHintExplanation(result) {
    if (result.type === "contradiction" && result.cause === "clue") {
      return el("div", { class: "hint-explain" }, [
        el("div", { class: "hint-explain-label" }, "Indizio in conflitto:"),
        el("ul", { class: "hint-clue-list" }, result.clueIds.map((id) => {
          const clue = puzzle.clues.find((c) => c.id === id);
          if (!clue) return null;
          const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
          return el("li", {}, (owner ? owner.name + ": " : "") + describeClue(clue, puzzle));
        })),
      ]);
    }
    if (result.type !== "forcedPlacement" && result.type !== "eliminatedCell") return null;
    if (result.jointlyDetermined) {
      return el("div", { class: "hint-explain" }, el("p", { class: "hint-explain-note" }, "Questa deduzione dipende dalla combinazione di più indizi insieme."));
    }
    const blocks = [];
    if (result.involvedClues?.length) {
      blocks.push(el("div", { class: "hint-explain-label" }, "Perché:"));
      blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedClues.map((c) => el("li", {}, (c.ownerName ? c.ownerName + ": " : "") + c.description))));
    }
    if (result.involvedGroups?.length) {
      // "Naked subset" deductions (see propagation.js): not caused by any one
      // clue, but by several characters' clue-narrowed domains jointly
      // leaving no room for anyone else in a shared set of cells.
      blocks.push(el("div", { class: "hint-explain-label" }, "Interazione tra personaggi:"));
      blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedGroups.map((g) =>
        el("li", {}, `${g.characterNames.join(" e ")} possono stare solo in ${g.cellLabels.join(" o ")}: nessun altro personaggio può occupare quelle celle.`)
      )));
    }
    if (blocks.length === 0) return null;
    return el("div", { class: "hint-explain" }, blocks);
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
    hintPanel.appendChild(el("div", { class: `result-banner hint-${result.variant}` }, result.message));
    const explanation = renderHintExplanation(result);
    if (explanation) hintPanel.appendChild(explanation);
    if (hintChain.length > 1) {
      hintPanel.appendChild(
        el("div", { class: "hint-nav" }, [
          el("button", { onClick: () => { hintChainIndex--; showHintStep(); }, disabled: hintChainIndex === 0 || undefined }, "‹"),
          el("span", {}, `Passo ${hintChainIndex + 1} di ${hintChain.length}`),
          el("button", { onClick: () => { hintChainIndex++; showHintStep(); }, disabled: hintChainIndex === hintChain.length - 1 || undefined }, "›"),
        ])
      );
    }
    renderToolbar();
    renderBoardAndClues();
  }

  function onHint() {
    hintChain = computeHintChain(puzzle, state.placements, state.candidates);
    hintChainIndex = 0;
    showHintStep();
  }

  async function onSubmit() {
    clear(resultEl);
    const total = puzzle.characters.length;
    let correct = 0;
    for (const p of puzzle.solution.placements) {
      const placed = state.placements.get(p.characterId);
      if (placed && placed.row === p.row && placed.col === p.col) correct++;
    }

    if (correct === total && state.placements.size === total) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const previousBest = puzzle.bestTimeSeconds;
      stopTimer();
      await onSolved(elapsed);
      const murderer = murdererName();
      // `bestTimeSeconds` only exists on puzzles onSolved actually tracks it
      // for (single-puzzle play, via playerApp.js) — campaign mode's onSolved
      // doesn't set it, so this block simply doesn't render there instead of
      // needing a separate flag.
      let timeLine = null;
      if (typeof puzzle.bestTimeSeconds === "number") {
        const isNewBest = previousBest == null || elapsed <= previousBest;
        timeLine = el(
          "div",
          { class: "time-result" },
          isNewBest
            ? `⏱ Tempo: ${formatElapsed(elapsed)} — nuovo record personale!`
            : `⏱ Tempo: ${formatElapsed(elapsed)} (miglior tempo: ${formatElapsed(puzzle.bestTimeSeconds)})`
        );
      }
      resultEl.appendChild(
        el("div", { class: "win-panel result-banner success" }, [
          el("div", {}, "🎉 Caso risolto! Tutti i piazzamenti sono corretti."),
          murderer ? el("div", {}, `L'assassino è: ${murderer}`) : null,
          timeLine,
          puzzle.resolutionNote ? el("p", { class: "resolution-note" }, puzzle.resolutionNote) : null,
        ])
      );
    } else {
      // Deliberately doesn't say how many are right — that would let you brute
      // force it by trial and error instead of reasoning from the clues.
      resultEl.appendChild(el("div", { class: "result-banner partial" }, "Non è ancora tutto corretto. Continua a dedurre dagli indizi."));
    }
  }

  function renderBriefing() {
    clear(briefingEl);
    briefingEl.classList.toggle("hidden", !puzzle.briefing);
    if (puzzle.briefing) {
      briefingEl.appendChild(el("h3", {}, "Il caso"));
      briefingEl.appendChild(el("p", {}, puzzle.briefing));
    }
  }

  function wireControls() {
    notesBtn.addEventListener("click", () => {
      state.notesMode = !state.notesMode;
      persistProgress();
      updateNotesUI();
    });
    undoBtn.addEventListener("click", () => {
      clearHint();
      undo(state);
      persistProgress();
      renderToolbar();
      renderBoardAndClues();
    });
    attachHoldToConfirm(clearBtn, 700, () => {
      clearHint();
      clearAll(state);
      persistProgress();
      renderToolbar();
      renderBoardAndClues();
      clear(resultEl);
    });
    hintBtn.addEventListener("click", onHint);
    submitBtn.addEventListener("click", onSubmit);
  }

  // Full initial setup — render, notes hint text, briefing, timer, and every
  // control's event listener — replacing what each caller used to do inline
  // right after loading its puzzle. Call once, after `puzzle`/`state` are
  // both ready; there's no teardown/re-init support since both callers are
  // full-page-navigation apps where this only ever runs once per page load.
  function start() {
    renderToolbar();
    renderBoardAndClues();
    updateNotesUI();
    renderBriefing();
    clear(resultEl);
    startTimer();
    wireControls();
  }

  return { start };
}
