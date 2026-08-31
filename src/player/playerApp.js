import { el, clear, qs, attachHoldToConfirm } from "../util/dom.js";
import * as store from "../storage/puzzleStore.js";
import { characterIcon } from "../model/icons.js";
import { zoneOfCell } from "../model/grid.js";
import { createBoardState, handleCellClick, handleCellDrag, undo, clearAll, renderPlayerBoard, serializeBoardState, deserializeBoardState } from "./board.js";
import { renderClueCards } from "./clueCards.js";
import { computeHintChain } from "../solver/hints.js";
import { describeClue } from "../model/clueTypes.js";
import { duplicatePuzzle, difficultyLabel, characterColor } from "../model/puzzle.js";
import { wireThemeToggle } from "../util/theme.js";

wireThemeToggle();

const params = new URLSearchParams(location.search);
const puzzleId = params.get("id");

const pickerEl = qs("#puzzle-picker");
const gameEl = qs("#game");
const titleEl = qs("#player-title");
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

let puzzle = puzzleId ? store.get(puzzleId) : null;
let state = puzzle ? deserializeBoardState(store.getProgress(puzzle.id)) : createBoardState();

// Saved on every board-state mutation (placement, X, candidate, undo,
// pulisci tutto, toggling note mode) so leaving and reopening this puzzle —
// even just reloading the page — restores exactly where you left off.
function persistProgress() {
  store.saveProgress(puzzle.id, serializeBoardState(state));
}
let hintHighlight = null; // { cells: [{row,col,cls}] } | null — ephemeral, not part of board.js state
let hintChain = [];
let hintChainIndex = 0;
let timerInterval = null;
let pickerSortMode = "updated"; // "updated" | "title" | "difficulty"
const DIFFICULTY_ORDER = ["", "very-easy", "easy", "medium", "hard", "expert"];

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  const startedAt = Date.now();
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

function sortPuzzleEntries(puzzles) {
  const sorted = [...puzzles];
  if (pickerSortMode === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else if (pickerSortMode === "difficulty") {
    sorted.sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty || "") - DIFFICULTY_ORDER.indexOf(b.difficulty || ""));
  } else {
    sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return sorted;
}

function showPicker() {
  pickerEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  clear(pickerEl);
  const puzzles = sortPuzzleEntries(store.list());
  pickerEl.appendChild(
    el("div", { class: "saved-list-header" }, [
      el("h2", {}, "Scegli un caso da giocare"),
      puzzles.length > 0
        ? el(
            "select",
            {
              onChange: (e) => { pickerSortMode = e.target.value; showPicker(); },
            },
            [
              el("option", { value: "updated", selected: pickerSortMode === "updated" || undefined }, "Aggiornati di recente"),
              el("option", { value: "title", selected: pickerSortMode === "title" || undefined }, "Titolo"),
              el("option", { value: "difficulty", selected: pickerSortMode === "difficulty" || undefined }, "Difficoltà"),
            ]
          )
        : null,
    ])
  );
  if (puzzles.length === 0) {
    const panel = el("div", { class: "panel" }, [
      el("p", { class: "muted" }, "Nessun puzzle salvato. Creane uno nell'Editor prima."),
      el("a", { href: "editor.html" }, "Vai all'editor →"),
    ]);
    pickerEl.appendChild(panel);
    return;
  }
  const panel = el("div", { class: "panel" });
  for (const entry of puzzles) {
    const updated = new Date(entry.updatedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    panel.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, [
            entry.completed ? el("span", { class: "completed-badge", title: "Completato" }, "✓") : null,
            entry.title,
          ]),
          entry.difficulty ? el("span", { class: `difficulty-badge difficulty-${entry.difficulty}` }, difficultyLabel(entry.difficulty)) : null,
          el("span", { class: "meta" }, `Aggiornato il ${updated}`),
        ]),
        el("div", { class: "actions" }, [
          el("a", { class: "play", href: `player.html?id=${entry.id}` }, "Gioca"),
          el("button", {
            type: "button",
            class: "duplicate",
            title: "Duplica",
            onClick: () => {
              const original = store.get(entry.id);
              if (!original) return;
              store.save(duplicatePuzzle(original));
              showPicker();
            },
          }, "📋"),
          el("button", {
            type: "button",
            class: "delete",
            title: "Elimina",
            onClick: () => {
              const ok = confirm(`Eliminare definitivamente il caso "${entry.title}"? L'azione non è reversibile.`);
              if (!ok) return;
              store.remove(entry.id);
              showPicker();
            },
          }, "🗑"),
        ]),
      ])
    );
  }
  pickerEl.appendChild(panel);
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
    const chip = el(
      "div",
      {
        class: "char-chip" + (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") + (placed ? " used" : ""),
        onClick: () => selectTool({ kind: "character", id: character.id }),
      }
    );
    const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    chip.appendChild(iconWrap);
    if (!character.isVictim) chip.style.borderLeft = `3px solid ${characterColor(character)}`;
    chip.appendChild(document.createTextNode(character.name + (character.isVictim ? " (V)" : "")));
    toolbarEl.appendChild(chip);
  }
  toolbarEl.appendChild(
    el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""),
      onClick: () => selectTool({ kind: "x" }),
    }, "✕ Segna")
  );
  toolbarEl.appendChild(
    el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""),
      onClick: () => selectTool({ kind: "erase" }),
    }, "🧹 Gomma")
  );
}

function updateNotesUI() {
  notesBtn.classList.toggle("primary", state.notesMode);
  notesHint.textContent = state.notesMode
    ? "Modalità note attiva: seleziona un personaggio e clicca una cella per segnarlo come candidato in quella casella (notazione a griglia 3x3, come le matite del sudoku)."
    : "Modalità piazzamento: seleziona un personaggio e clicca una cella per confermarlo.";
}

function applyHintHighlight() {
  // Dims every other cell while a hint is showing (see player.css) so the
  // highlighted one(s) can't get lost among character tokens, zone
  // textures, and wall borders on a busy board.
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
  const sameZoneChars = puzzle.solution.placements.filter((p) => {
    if (p.characterId === victim.id) return false;
    return zoneOfCell(puzzle.grid, p.row, p.col) === vZone;
  });
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
      el(
        "ul",
        { class: "hint-clue-list" },
        result.clueIds.map((id) => {
          const clue = puzzle.clues.find((c) => c.id === id);
          if (!clue) return null;
          const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
          return el("li", {}, (owner ? owner.name + ": " : "") + describeClue(clue, puzzle));
        })
      ),
    ]);
  }
  if (result.type !== "forcedPlacement" && result.type !== "eliminatedCell") return null;
  if (result.jointlyDetermined) {
    return el(
      "div", { class: "hint-explain" },
      el("p", { class: "hint-explain-note" }, "Questa deduzione dipende dalla combinazione di più indizi insieme.")
    );
  }
  const blocks = [];
  if (result.involvedClues?.length) {
    blocks.push(el("div", { class: "hint-explain-label" }, "Perché:"));
    blocks.push(el(
      "ul", { class: "hint-clue-list" },
      result.involvedClues.map((c) => el("li", {}, (c.ownerName ? c.ownerName + ": " : "") + c.description))
    ));
  }
  if (result.involvedGroups?.length) {
    // "Naked subset" deductions (see propagation.js): not caused by any one
    // clue, but by several characters' clue-narrowed domains jointly
    // leaving no room for anyone else in a shared set of cells.
    blocks.push(el("div", { class: "hint-explain-label" }, "Interazione tra personaggi:"));
    blocks.push(el(
      "ul", { class: "hint-clue-list" },
      result.involvedGroups.map((g) =>
        el("li", {}, `${g.characterNames.join(" e ")} possono stare solo in ${g.cellLabels.join(" o ")}: nessun altro personaggio può occupare quelle celle.`)
      )
    ));
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
      cells: result.culprits
        .map((id) => state.placements.get(id))
        .filter(Boolean)
        .map((pos) => ({ row: pos.row, col: pos.col, cls: "hint-culprit" })),
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
        el("button", {
          onClick: () => { hintChainIndex--; showHintStep(); },
          disabled: hintChainIndex === 0 || undefined,
        }, "‹"),
        el("span", {}, `Passo ${hintChainIndex + 1} di ${hintChain.length}`),
        el("button", {
          onClick: () => { hintChainIndex++; showHintStep(); },
          disabled: hintChainIndex === hintChain.length - 1 || undefined,
        }, "›"),
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

function onSubmit() {
  clear(resultEl);
  const total = puzzle.characters.length;
  let correct = 0;
  for (const p of puzzle.solution.placements) {
    const placed = state.placements.get(p.characterId);
    if (placed && placed.row === p.row && placed.col === p.col) correct++;
  }

  if (correct === total && state.placements.size === total) {
    stopTimer();
    if (!puzzle.completed) {
      puzzle.completed = true;
      store.save(puzzle);
    }
    const murderer = murdererName();
    const win = el("div", { class: "win-panel result-banner success" }, [
      el("div", {}, "🎉 Caso risolto! Tutti i piazzamenti sono corretti."),
      murderer ? el("div", {}, `L'assassino è: ${murderer}`) : null,
      puzzle.resolutionNote ? el("p", { class: "resolution-note" }, puzzle.resolutionNote) : null,
    ]);
    resultEl.appendChild(win);
  } else {
    // Deliberately doesn't say how many are right — that would let you brute
    // force it by trial and error instead of reasoning from the clues.
    resultEl.appendChild(
      el("div", { class: "result-banner partial" }, "Non è ancora tutto corretto. Continua a dedurre dagli indizi.")
    );
  }
}

if (!puzzle) {
  showPicker();
} else {
  pickerEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  titleEl.textContent = puzzle.title;
  renderToolbar();
  renderBoardAndClues();
  updateNotesUI();
  startTimer();
  if (puzzle.briefing) {
    briefingEl.classList.remove("hidden");
    briefingEl.appendChild(el("h3", {}, "Il caso"));
    briefingEl.appendChild(el("p", {}, puzzle.briefing));
  }

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
