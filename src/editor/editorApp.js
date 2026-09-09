import { el, qs } from "../util/dom.js";
import { createPuzzle, touch, validatePuzzleShape, clonePuzzle, duplicatePuzzle, pruneDanglingClueReferences, characterColor, DIFFICULTY_LEVELS, difficultyLabel, estimateDifficultyFromNodes, setSolutionPlacement } from "../model/puzzle.js";
import * as store from "../storage/puzzleStore.js";
import { exportPuzzle, importPuzzleFromFile } from "../storage/importExport.js";
import { validateSolution, checkUniqueness } from "../solver/validator.js";
import { deriveSolution } from "../solver/deriveSolution.js";
import { renderMapEditor } from "./mapEditor.js";
import { renderCharacterEditor } from "./characterEditor.js";
import { renderClueBuilder } from "./clueBuilder.js";
import { renderSolutionEditor } from "./solutionEditor.js";
import { wireThemeToggle } from "../util/theme.js";

wireThemeToggle();

const params = new URLSearchParams(location.search);
const existingId = params.get("id");

let puzzle = existingId ? store.get(existingId) : null;
if (!puzzle) puzzle = createPuzzle();

let activeTab = "map"; // "map" | "solution"

const titleInput = qs("#puzzle-title");
const authorInput = qs("#puzzle-author");
const difficultyInput = qs("#puzzle-difficulty");
for (const level of DIFFICULTY_LEVELS) {
  difficultyInput.appendChild(el("option", { value: level.value }, level.label));
}
const briefingInput = qs("#puzzle-briefing");
const resolutionInput = qs("#puzzle-resolution");
const leftPanel = qs("#left-panel");
const boardEl = qs("#board");
const rightTop = qs("#right-panel-top");
const rightBottom = qs("#right-panel-bottom");
const validationPanel = qs("#validation-panel");
const tabMapBtn = qs("#tab-map");
const tabSolutionBtn = qs("#tab-solution");
const saveBtn = qs("#save-btn");
const exportBtn = qs("#export-btn");
const importInput = qs("#import-input");
const playBtn = qs("#play-btn");
const printBtn = qs("#print-btn");
const deleteBtn = qs("#delete-btn");
const duplicateBtn = qs("#duplicate-btn");
const undoBtn = qs("#editor-undo-btn");
const redoBtn = qs("#editor-redo-btn");
const validateBtn = qs("#validate-btn");
const uniqueBtn = qs("#unique-btn");
const estimateBtn = qs("#estimate-btn");
const calcSolutionBtn = qs("#calc-solution-btn");
const statusEl = qs("#status");

// Snapshot-based undo/redo: every mutating sub-editor (mapEditor, characterEditor,
// clueBuilder, solutionEditor) already funnels its changes through a single
// onChange callback, so hooking undo there needs no changes to those modules.
// Named `undoStack`/`redoStack`, not `history`, to avoid shadowing window.history
// (used just below by persist()).
const UNDO_LIMIT = 50;
let undoStack = [];
let redoStack = [];
let lastSnapshot = clonePuzzle(puzzle);

function setStatus(text, kind = "muted") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function persist() {
  touch(puzzle);
  store.save(puzzle);
  history.replaceState(null, "", `editor.html?id=${puzzle.id}`);
  setStatus("Salvato in locale.", "muted");
}

// Shared funnel for every structural change (map, characters, clues, solution).
// Free-text fields (title/author/briefing/resolution/character bio) deliberately
// bypass this and call persist() directly instead, so typing doesn't flood the
// undo stack with one entry per keystroke.
function handleChange() {
  undoStack.push(lastSnapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
  pruneDanglingClueReferences(puzzle);
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
}

function undoChange() {
  if (undoStack.length === 0) return;
  redoStack.push(lastSnapshot);
  puzzle = undoStack.pop();
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
}

function redoChange() {
  if (redoStack.length === 0) return;
  undoStack.push(lastSnapshot);
  puzzle = redoStack.pop();
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function render() {
  titleInput.value = puzzle.title;
  authorInput.value = puzzle.author || "";
  difficultyInput.value = puzzle.difficulty || "";
  briefingInput.value = puzzle.briefing || "";
  resolutionInput.value = puzzle.resolutionNote || "";

  tabMapBtn.classList.toggle("primary", activeTab === "map");
  tabSolutionBtn.classList.toggle("primary", activeTab === "solution");

  if (activeTab === "map") {
    renderMapEditor(leftPanel, boardEl, puzzle, handleChange);
  } else {
    renderSolutionEditor(leftPanel, boardEl, puzzle, handleChange);
  }

  renderCharacterEditor(rightTop, puzzle, handleChange, persist);
  renderClueBuilder(rightBottom, puzzle, handleChange);
}

titleInput.addEventListener("input", () => { puzzle.title = titleInput.value; persist(); });
authorInput.addEventListener("input", () => { puzzle.author = authorInput.value; persist(); });
difficultyInput.addEventListener("change", () => { puzzle.difficulty = difficultyInput.value; persist(); });
briefingInput.addEventListener("input", () => { puzzle.briefing = briefingInput.value; persist(); });
resolutionInput.addEventListener("input", () => { puzzle.resolutionNote = resolutionInput.value; persist(); });

tabMapBtn.addEventListener("click", () => { activeTab = "map"; render(); });
tabSolutionBtn.addEventListener("click", () => { activeTab = "solution"; render(); });

saveBtn.addEventListener("click", () => { persist(); });

exportBtn.addEventListener("click", () => { exportPuzzle(puzzle); });

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  try {
    const imported = await importPuzzleFromFile(file);
    puzzle = imported;
    persist();
    render();
    setStatus("Puzzle importato.", "muted");
  } catch (err) {
    setStatus(err.message, "violation");
  }
  importInput.value = "";
});

playBtn.addEventListener("click", () => {
  persist();
  location.href = `player.html?id=${puzzle.id}`;
});

printBtn.addEventListener("click", () => {
  persist();
  window.open(`print.html?id=${puzzle.id}`, "_blank");
});

deleteBtn.addEventListener("click", () => {
  const ok = confirm(`Eliminare definitivamente il caso "${puzzle.title}"? L'azione non è reversibile.`);
  if (!ok) return;
  store.remove(puzzle.id);
  location.href = "index.html";
});

duplicateBtn.addEventListener("click", () => {
  persist();
  const copy = duplicatePuzzle(puzzle);
  store.save(copy);
  location.href = `editor.html?id=${copy.id}`;
});

undoBtn.addEventListener("click", undoChange);
redoBtn.addEventListener("click", redoChange);

validateBtn.addEventListener("click", () => {
  const shape = validatePuzzleShape(puzzle);
  const result = validateSolution(puzzle);
  validationPanel.innerHTML = "";
  const allErrors = [...shape.errors, ...result.violations.map((v) => v.message)];
  if (allErrors.length === 0) {
    validationPanel.appendChild(el("p", { class: "ok-message" }, "✓ La soluzione dichiarata soddisfa tutte le regole e gli indizi."));
  } else {
    for (const message of allErrors) {
      validationPanel.appendChild(el("p", { class: "violation" }, message));
    }
  }
});

// Cap on how many alternative solutions "Verifica unicità" will actually
// enumerate and preview — enough to be useful for a small (≤9×9) puzzle
// without risking a slow click if the puzzle is badly underconstrained
// (in which case the solver would keep finding solutions almost forever;
// maxNodes is the independent safety net for puzzles that are constrained
// enough to prune well but still have many solutions to enumerate).
const UNIQUENESS_PREVIEW_MAX_SOLUTIONS = 24;
const UNIQUENESS_PREVIEW_MAX_NODES = 200000;

// One small read-only grid per alternative solution, so they can be scanned
// and compared at a glance instead of reading placements as text. Deliberately
// its own compact rendering (not renderBoard/boardRender.js) — zones/walls/
// object icons aren't needed here, only "who ended up where."
function renderSolutionPreview(puzzle, placements, index) {
  const { rows, cols } = puzzle.grid.size;
  const byCell = new Map(placements.map((p) => [`${p.row},${p.col}`, p]));

  const grid = el("div", { class: "solution-preview-grid" });
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellData = puzzle.grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? puzzle.grid.zones.find((z) => z.id === cellData.zoneId) : null;
      const cellNode = el("div", {
        class: "solution-preview-cell" + (cellData.blocked ? " blocked" : ""),
        style: zone ? `background:${zone.color}` : "",
      });
      const placement = byCell.get(`${r},${c}`);
      const character = placement && puzzle.characters.find((ch) => ch.id === placement.characterId);
      if (character) {
        cellNode.appendChild(
          el(
            "span",
            {
              class: "solution-preview-token",
              style: `background:${character.isVictim ? "var(--danger)" : characterColor(character)}`,
              title: character.name,
            },
            character.name[0]?.toUpperCase() || "?"
          )
        );
      }
      grid.appendChild(cellNode);
    }
  }

  return el("div", { class: "solution-preview-item" }, [
    el("span", { class: "solution-preview-label" }, `Soluzione ${index + 1}`),
    grid,
  ]);
}

function renderSolutionPreviews(puzzle, solutions) {
  return el(
    "div",
    { class: "solution-preview-list" },
    solutions.map((sol, i) => renderSolutionPreview(puzzle, sol, i))
  );
}

uniqueBtn.addEventListener("click", () => {
  const report = checkUniqueness(puzzle, {
    maxSolutions: UNIQUENESS_PREVIEW_MAX_SOLUTIONS,
    maxNodes: UNIQUENESS_PREVIEW_MAX_NODES,
  });
  validationPanel.innerHTML = "";
  if (report.solutionCount === 0) {
    validationPanel.appendChild(el("p", { class: "violation" }, "Nessuna soluzione trovata: controlla gli indizi, sono troppo restrittivi."));
  } else if (report.solutionCount === 1) {
    validationPanel.appendChild(el("p", { class: "ok-message" }, "✓ Soluzione unica."));
  } else {
    // "Almeno N" instead of a bare count when the cap (not exhaustion) is
    // what ended the search — never claim the preview list below is complete
    // when it might not be.
    const countLabel = report.truncated ? `almeno ${report.solutionCount}` : `${report.solutionCount}`;
    validationPanel.appendChild(
      el("p", { class: "violation" }, `Il puzzle è ambiguo: esistono ${countLabel} soluzioni possibili. Aggiungi altri indizi.`)
    );
    validationPanel.appendChild(renderSolutionPreviews(puzzle, report.solutions));
  }
});

estimateBtn.addEventListener("click", () => {
  const report = checkUniqueness(puzzle, {
    maxSolutions: 2,
    maxNodes: UNIQUENESS_PREVIEW_MAX_NODES,
  });
  validationPanel.innerHTML = "";
  if (report.solutionCount !== 1) {
    // A stima only means something once the puzzle has exactly one solution
    // — with zero or several, "how hard was it to find" isn't a meaningful
    // question yet (fix that first, via Verifica unicità, before estimating).
    validationPanel.appendChild(
      el("p", { class: "violation" }, "La stima richiede una soluzione unica: usa prima \"Verifica unicità\".")
    );
    return;
  }
  const estimate = estimateDifficultyFromNodes(report.nodesVisited);
  validationPanel.appendChild(
    el(
      "p",
      { class: "ok-message" },
      `Stima difficoltà: ${difficultyLabel(estimate)} (nodi esplorati dal solver: ${report.nodesVisited}). È solo un'indicazione — il campo "Difficoltà" in alto resta una scelta manuale dell'autore.`
    )
  );
});

calcSolutionBtn.addEventListener("click", () => {
  const hasExistingSolution = puzzle.solution.placements.length > 0;
  // Confirm only when this would replace a declared solution that ISN'T
  // already valid (partial or wrong, likely still being placed by hand) —
  // if it's already valid, recomputing is provably harmless: either the
  // puzzle is genuinely unique (deriveSolution reproduces the same values)
  // or it isn't (in which case nothing gets overwritten below anyway).
  if (hasExistingSolution && !validateSolution(puzzle).valid) {
    const ok = confirm('Esiste già una soluzione dichiarata (incompleta o non valida): calcolarne una nuova la sostituirà. Continuare?');
    if (!ok) return;
  }

  validationPanel.innerHTML = "";
  const result = deriveSolution(puzzle);

  if (result.status === "unique") {
    for (const character of puzzle.characters) {
      const p = result.placements.find((pl) => pl.characterId === character.id);
      setSolutionPlacement(puzzle, character.id, p ? p.row : null, p ? p.col : null);
    }
    handleChange(); // one combined undo step for the whole auto-fill
    validationPanel.appendChild(el("p", { class: "ok-message" }, "✓ Soluzione calcolata e compilata automaticamente a partire dagli indizi."));
  } else if (result.status === "unsatisfiable") {
    validationPanel.appendChild(el("p", { class: "violation" }, "Nessuna soluzione trovata: gli indizi di questo caso sono contraddittori. La soluzione dichiarata non è stata modificata."));
  } else if (result.status === "ambiguous") {
    validationPanel.appendChild(el("p", { class: "violation" }, "Il puzzle è ambiguo: esistono più soluzioni possibili, non posso scegliere quella giusta al posto tuo. Aggiungi altri indizi. La soluzione dichiarata non è stata modificata."));
  } else {
    validationPanel.appendChild(el("p", { class: "violation" }, "Il caso è troppo complesso da risolvere in tempi ragionevoli: aggiungi indizi più stringenti. La soluzione dichiarata non è stata modificata."));
  }
});

render();
updateUndoRedoButtons();
