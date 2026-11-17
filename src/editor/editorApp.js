import "../i18n/i18n.js";
import { el, qs, clear } from "../util/dom.js";
import {
  createPuzzle,
  touch,
  validatePuzzleShape,
  clonePuzzle,
  duplicatePuzzle,
  pruneDanglingClueReferences,
  pruneDanglingSolutionPlacements,
  characterColor,
  DIFFICULTY_LEVELS,
  TENSE_OPTIONS,
  setTense,
  setSolutionPlacement,
  removeClue,
} from "../model/puzzle.js";
import * as store from "../storage/puzzleStore.js";
import { exportPuzzle, importPuzzleFromFile } from "../storage/importExport.js";
import { encodePuzzleToFragment, isShareLinkSupported } from "../storage/shareLink.js";
import { validateSolution } from "../solver/validator.js";
import { checkUniquenessAsync, deriveSolutionAsync, cancelSolver } from "../solver/solverClient.js";
import { limitsFor, searchBudget } from "../solver/limits.js";
import { findRedundantClues, findCluesNeededWithoutVictim } from "../solver/redundancy.js";
import { describeClue } from "../model/clueTypes.js";
import { roomColor } from "../skin/paper/rooms.js";
import { renderMapEditor } from "./mapEditor.js";
import { renderCharacterEditor } from "./characterEditor.js";
import { renderClueBuilder } from "./clueBuilder.js";
import { setupClueWizard } from "./clueWizard.js";
import { createLivePreview } from "./livePreview.js";
import { renderSolutionEditor } from "./solutionEditor.js";
import { renderHintsEditor } from "./hintsEditor.js";
import { wireThemeToggle } from "../util/theme.js";
import { t } from "../i18n/i18n.js";

wireThemeToggle();

const params = new URLSearchParams(location.search);
const existingId = params.get("id");

let puzzle = existingId ? store.get(existingId) : null;
if (!puzzle) puzzle = createPuzzle();

let activeTab = "map"; // "map" | "solution" | "hints"

const titleInput = qs("#puzzle-title");
const authorInput = qs("#puzzle-author");
const difficultyInput = qs("#puzzle-difficulty");
for (const level of DIFFICULTY_LEVELS) {
  difficultyInput.appendChild(el("option", { value: level.value }, level.label));
}
const tenseInput = qs("#puzzle-tense");
for (const option of TENSE_OPTIONS) {
  tenseInput.appendChild(el("option", { value: option.value }, option.label));
}
const briefingInput = qs("#puzzle-briefing");
const resolutionInput = qs("#puzzle-resolution");
const leftPanel = qs("#left-panel");
const boardEl = qs("#board");
const rightTop = qs("#right-panel-top");
const cluePanel = qs("#clue-panel");
const validationPanel = qs("#validation-panel");
const tabMapBtn = qs("#tab-map");
const tabSolutionBtn = qs("#tab-solution");
const tabHintsBtn = qs("#tab-hints");
const saveBtn = qs("#save-btn");
const exportBtn = qs("#export-btn");
const shareBtn = qs("#share-btn");
const importInput = qs("#import-input");
const playBtn = qs("#play-btn");
const printBtn = qs("#print-btn");
const deleteBtn = qs("#delete-btn");
const duplicateBtn = qs("#duplicate-btn");
const undoBtn = qs("#editor-undo-btn");
const redoBtn = qs("#editor-redo-btn");
const validateBtn = qs("#validate-btn");
const uniqueBtn = qs("#unique-btn");
const previewEl = qs("#difficulty-preview");
const redundantBtn = qs("#redundant-btn");
const calcSolutionBtn = qs("#calc-solution-btn");
const statusEl = qs("#status");

// The clue wizard reads the CURRENT puzzle through a getter (an undo swaps the object).
setupClueWizard({ getPuzzle: () => puzzle, onChange: () => handleChange(), boardEl });

// The live difficulty line above the clues: re-analysed (debounced, on its own worker) after every change.
const preview = createLivePreview({ container: previewEl, getPuzzle: () => puzzle });

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
  try {
    store.save(puzzle);
    history.replaceState(null, "", `editor.html?id=${puzzle.id}`);
    setStatus(t("Salvato in locale."), "muted");
  } catch (err) {
    setStatus(err.message, "violation");
  }
}

// Used by every field that bypasses undo tracking (free-text title/author/
// difficulty/briefing/resolution inputs below, and character bio via the
// callback passed as the onPersistOnly argument to renderCharacterEditor)
// instead of calling persist() directly: the edit IS saved, but lastSnapshot
// must also move forward, or the next handleChange() would push the
// now-stale-again snapshot (predating this text edit) onto undoStack,
// letting a later undo silently revert text the user already committed.
function persistBypassingUndo() {
  persist();
  lastSnapshot = clonePuzzle(puzzle);
}

// Shared funnel for every structural change (map, characters, clues, solution).
// Free-text fields (title/author/briefing/resolution/character bio) deliberately
// bypass this and call persistBypassingUndo() instead, so typing doesn't flood
// the undo stack with one entry per keystroke.
function handleChange() {
  undoStack.push(lastSnapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
  pruneDanglingClueReferences(puzzle);
  pruneDanglingSolutionPlacements(puzzle);
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
  preview.schedule();
}

function undoChange() {
  if (undoStack.length === 0) return;
  redoStack.push(lastSnapshot);
  puzzle = undoStack.pop();
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
  preview.schedule();
}

function redoChange() {
  if (redoStack.length === 0) return;
  undoStack.push(lastSnapshot);
  puzzle = redoStack.pop();
  lastSnapshot = clonePuzzle(puzzle);
  persist();
  render();
  updateUndoRedoButtons();
  preview.schedule();
}

function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function render() {
  titleInput.value = puzzle.title;
  authorInput.value = puzzle.author || "";
  difficultyInput.value = puzzle.difficulty || "";
  tenseInput.value = puzzle.tense || "present";
  briefingInput.value = puzzle.briefing || "";
  resolutionInput.value = puzzle.resolutionNote || "";

  tabMapBtn.classList.toggle("primary", activeTab === "map");
  tabSolutionBtn.classList.toggle("primary", activeTab === "solution");
  tabHintsBtn.classList.toggle("primary", activeTab === "hints");

  if (activeTab === "map") {
    renderMapEditor(leftPanel, boardEl, puzzle, handleChange);
  } else if (activeTab === "solution") {
    renderSolutionEditor(leftPanel, boardEl, puzzle, handleChange);
  } else {
    renderHintsEditor(leftPanel, boardEl, puzzle, handleChange, persistBypassingUndo);
  }

  renderCharacterEditor(rightTop, puzzle, handleChange, persistBypassingUndo);
  renderClueBuilder(cluePanel, puzzle, handleChange);
}

titleInput.addEventListener("input", () => {
  puzzle.title = titleInput.value;
  persistBypassingUndo();
});
authorInput.addEventListener("input", () => {
  puzzle.author = authorInput.value;
  persistBypassingUndo();
});
difficultyInput.addEventListener("change", () => {
  puzzle.difficulty = difficultyInput.value;
  persistBypassingUndo();
});
// One choice for the whole case: every clue is re-worded at once (handleChange
// re-renders the clue list, and the change can be undone like any other).
tenseInput.addEventListener("change", () => {
  setTense(puzzle, tenseInput.value);
  handleChange();
});
briefingInput.addEventListener("input", () => {
  puzzle.briefing = briefingInput.value;
  persistBypassingUndo();
});
resolutionInput.addEventListener("input", () => {
  puzzle.resolutionNote = resolutionInput.value;
  persistBypassingUndo();
});

tabMapBtn.addEventListener("click", () => {
  activeTab = "map";
  render();
});
tabSolutionBtn.addEventListener("click", () => {
  activeTab = "solution";
  render();
});
tabHintsBtn.addEventListener("click", () => {
  activeTab = "hints";
  render();
});

saveBtn.addEventListener("click", () => {
  persist();
});

// A "working…" line in the validation panel with a Cancel button: a search on a big grid can take
// a while, and the author must be able to give up. Returns the element holding the text, so a
// caller can update it (progress counters).
function showProgress(text) {
  clear(validationPanel);
  const message = el("span", {}, text);
  validationPanel.appendChild(
    el("p", { class: "info-message" }, [
      message,
      " ",
      el("button", { type: "button", class: "cancel-solve", onClick: () => cancelSolver("main") }, t("Annulla")),
    ])
  );
  return message;
}

// What to say when a solver call failed: a cancel is not an error.
function showSolverError(err, describe) {
  clear(validationPanel);
  validationPanel.appendChild(
    err?.name === "AbortError"
      ? el("p", { class: "info-message" }, t("Operazione annullata."))
      : el("p", { class: "violation" }, describe(err.message))
  );
}

// The honest wording of a uniqueness report that did NOT run to its end: the search was stopped by
// a limit, so "no solution" and "unique" cannot be claimed.
// Does the author's declared solution already obey every clue? (A cheap, exact check: it does not search.)
function declaredSolutionHolds() {
  return puzzle.solution.placements.length === puzzle.characters.length && validateSolution(puzzle).valid;
}

function limitMessage(report) {
  if (report.solutionCount === 0 && declaredSolutionHolds()) {
    // The search had not reached it yet, but we KNOW this case has a solution: the one declared, which is valid.
    return t(
      "Limite di ricerca raggiunto: la soluzione dichiarata è valida, ma non sono riuscito a verificare che sia l'unica. Riprova, oppure aggiungi indizi per restringere la ricerca."
    );
  }
  return report.solutionCount === 0
    ? t(
        "Limite di ricerca raggiunto: finora non ho trovato nessuna soluzione, ma questo non significa che non esista. Aggiungi indizi per restringere la ricerca e riprova."
      )
    : t(
        "Ho trovato una soluzione, ma il limite di ricerca è finito prima di poter escludere che ce ne siano altre: non posso garantire che sia unica. Aggiungi indizi e riprova."
      );
}

// Before a case leaves the editor (file or link), make sure players won't get a
// broken one: a case with no solution, several solutions, or one we couldn't
// verify is flagged, and the author can still choose to go ahead.
async function confirmPublishable() {
  showProgress(t("Controllo che il caso abbia una soluzione unica…"));
  let problem = null;
  let cancelled = false;
  try {
    const report = await checkUniquenessAsync(puzzle, uniquenessOptions({ maxSolutions: 2 }));
    if (report.solutionCount > 1)
      problem = t("Il caso ha più di una soluzione: i giocatori potrebbero non capire quale sia quella giusta.");
    else if (!report.exhausted) problem = t("Non sono riuscito a verificare in tempi ragionevoli che la soluzione sia unica.");
    else if (report.solutionCount === 0) problem = t("Il caso non ha nessuna soluzione: nessuno potrà risolverlo.");
  } catch (err) {
    if (err?.name === "AbortError") cancelled = true;
    else problem = t("Non sono riuscito a verificare l'unicità: {message}. Riprova.", { message: err.message });
  }
  clear(validationPanel);
  if (cancelled) return false;
  if (!problem) return true;
  return confirm(`${problem}\n\n${t("Vuoi procedere comunque?")}`);
}

exportBtn.addEventListener("click", async () => {
  if (await confirmPublishable()) exportPuzzle(puzzle);
});

shareBtn.addEventListener("click", async () => {
  if (!isShareLinkSupported()) {
    setStatus(t("Il tuo browser non supporta i link di condivisione: usa Esporta."), "violation");
    return;
  }
  if (!(await confirmPublishable())) return;
  try {
    const url = new URL("player.html", location.href);
    url.hash = await encodePuzzleToFragment(puzzle);
    await navigator.clipboard.writeText(url.href);
    setStatus(t("Link copiato: chi lo apre può giocare il caso subito."));
  } catch {
    setStatus(t("Impossibile copiare il link negli appunti."), "violation");
  }
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  try {
    const imported = await importPuzzleFromFile(file);
    puzzle = imported;
    undoStack = [];
    redoStack = [];
    lastSnapshot = clonePuzzle(puzzle);
    persist();
    render();
    updateUndoRedoButtons();
    setStatus(t("Puzzle importato."), "muted");
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
  const ok = confirm(t('Eliminare definitivamente il caso "{title}"? L\'azione non è reversibile.', { title: puzzle.title }));
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
  clear(validationPanel);
  const allErrors = [...shape.errors, ...result.violations.map((v) => v.message)];
  if (allErrors.length === 0) {
    validationPanel.appendChild(el("p", { class: "ok-message" }, t("✓ La soluzione dichiarata soddisfa tutte le regole e gli indizi.")));
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
// the work budget is the independent safety net for puzzles that are constrained
// enough to prune well but still have many solutions to enumerate).
const UNIQUENESS_PREVIEW_MAX_SOLUTIONS = 24;

// The limits of every uniqueness check (work AND time, scaled with the grid: see solver/limits.js).
// forwardCheck: it costs more per step but prunes far more, which is what decides a big grid.
function uniquenessOptions({ maxSolutions }) {
  return { maxSolutions, ...searchBudget(limitsFor(puzzle).uniqueness), forwardCheck: true };
}

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
  // 96px is plenty up to 12 cells a side; a bigger grid grows so a cell stays about 8px.
  const side = Math.max(96, 8 * Math.max(rows, cols));
  grid.style.width = `${side}px`;
  grid.style.height = `${side}px`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellData = puzzle.grid.cells[r][c];
      const zone = !cellData.blocked && cellData.zoneId ? puzzle.grid.zones.find((z) => z.id === cellData.zoneId) : null;
      const cellNode = el("div", {
        class: "solution-preview-cell" + (cellData.blocked ? " blocked" : ""),
        style: zone ? `background:${roomColor(zone.color)}` : "",
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
    el("span", { class: "solution-preview-label" }, t("Soluzione {v}", { v: index + 1 })),
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

uniqueBtn.addEventListener("click", async () => {
  uniqueBtn.disabled = true;
  showProgress(t("Verifica unicità in corso…"));
  try {
    const report = await checkUniquenessAsync(puzzle, uniquenessOptions({ maxSolutions: UNIQUENESS_PREVIEW_MAX_SOLUTIONS }));
    clear(validationPanel);
    if (report.solutionCount <= 1 && !report.exhausted) {
      // stopped by a limit: neither "no solution" nor "unique" may be claimed
      validationPanel.appendChild(el("p", { class: "violation" }, limitMessage(report)));
    } else if (report.solutionCount === 0) {
      validationPanel.appendChild(
        el("p", { class: "violation" }, t("Nessuna soluzione trovata: controlla gli indizi, sono troppo restrittivi."))
      );
    } else if (report.solutionCount === 1) {
      validationPanel.appendChild(el("p", { class: "ok-message" }, t("✓ Soluzione unica.")));
    } else {
      // "Almeno N" instead of a bare count when the cap (not exhaustion) is
      // what ended the search — never claim the preview list below is complete
      // when it might not be.
      const countLabel = report.truncated ? t("almeno {count}", { count: report.solutionCount }) : `${report.solutionCount}`;
      validationPanel.appendChild(
        el(
          "p",
          { class: "violation" },
          t("Il puzzle è ambiguo: esistono {countLabel} soluzioni possibili. Aggiungi altri indizi.", { countLabel })
        )
      );
      validationPanel.appendChild(renderSolutionPreviews(puzzle, report.solutions));
    }
  } catch (err) {
    showSolverError(err, (message) => t("Non sono riuscito a verificare l'unicità: {message}. Riprova.", { message }));
  } finally {
    uniqueBtn.disabled = false;
  }
});

redundantBtn.addEventListener("click", async () => {
  redundantBtn.disabled = true;
  clear(validationPanel);
  const progress = showProgress(t("Analisi degli indizi in corso…"));
  try {
    const budget = searchBudget(limitsFor(puzzle).redundancy);
    const check = (candidate) => checkUniquenessAsync(candidate, { maxSolutions: 2, ...budget, forwardCheck: true });
    const result = await findRedundantClues(puzzle, check, {
      onProgress: (done, total) => {
        progress.textContent = t("Analisi degli indizi in corso… {done}/{total}", { done, total });
      },
    });
    clear(validationPanel);
    if (!result.ok) {
      validationPanel.appendChild(
        el(
          "p",
          { class: "violation" },
          result.reason === "limit"
            ? t(
                "Non sono riuscito a verificare l'unicità entro il limite di ricerca: non posso dire quali indizi siano superflui. Aggiungi indizi e riprova."
              )
            : result.reason === "unsolvable"
              ? t("Il caso non ha soluzione: non posso dire quali indizi siano superflui.")
              : t("Il caso non ha una soluzione unica: aggiungi indizi finché è univoco, poi cerca quelli superflui.")
        )
      );
    } else if (result.redundant.length === 0) {
      validationPanel.appendChild(
        result.unchecked > 0
          ? el(
              "p",
              { class: "info-message" },
              t(
                "Nessun indizio superfluo trovato, ma per {count} indizi il controllo ha raggiunto il limite di ricerca: non è provato che servano.",
                {
                  count: result.unchecked,
                }
              )
            )
          : el("p", { class: "ok-message" }, t("✓ Nessun indizio superfluo: ognuno è necessario all'unicità."))
      );
    } else {
      progress.textContent = t("Analisi degli indizi in corso…");
      const neededForSuspects = new Set(await findCluesNeededWithoutVictim(puzzle, result.redundant, check));
      validationPanel.appendChild(
        el(
          "p",
          { class: "info-message" },
          t(
            "{count} indizi si possono togliere senza perdere l'unicità. Toglierne uno alla volta: dopo ogni rimozione conviene rifare l'analisi, perché alcuni sono superflui solo in coppia.",
            { count: result.redundant.length }
          )
        )
      );
      const list = el("ul", { class: "redundant-list" });
      for (const clueId of result.redundant) {
        const clue = puzzle.clues.find((c) => c.id === clueId);
        if (!clue) continue;
        const owner = puzzle.characters.find((c) => c.id === clue.characterId);
        list.appendChild(
          el("li", {}, [
            el("span", {}, `${owner ? owner.name + ": " : ""}${describeClue(clue, puzzle)}`),
            neededForSuspects.has(clueId)
              ? el(
                  "em",
                  { class: "muted", title: t("Senza la vittima i sospettati non sarebbero più determinati: di solito è voluto.") },
                  ` ${t("(serve a determinare i sospettati: di solito è voluto)")}`
                )
              : null,
            " ",
            el(
              "button",
              {
                type: "button",
                onClick: () => {
                  removeClue(puzzle, clueId);
                  handleChange();
                  clear(validationPanel);
                  setStatus(t("Indizio rimosso. Rifai l'analisi per controllare gli altri."));
                },
              },
              t("Rimuovi")
            ),
          ])
        );
      }
      validationPanel.appendChild(list);
    }
  } catch (err) {
    showSolverError(err, (message) => t("Analisi non riuscita: {message}. Riprova.", { message }));
  } finally {
    redundantBtn.disabled = false;
  }
});

calcSolutionBtn.addEventListener("click", async () => {
  const hasExistingSolution = puzzle.solution.placements.length > 0;
  // Confirm only when this would replace a declared solution that ISN'T
  // already valid (partial or wrong, likely still being placed by hand) —
  // if it's already valid, recomputing is provably harmless: either the
  // puzzle is genuinely unique (deriveSolution reproduces the same values)
  // or it isn't (in which case nothing gets overwritten below anyway).
  if (hasExistingSolution && !validateSolution(puzzle).valid) {
    const ok = confirm(t("Esiste già una soluzione dichiarata (incompleta o non valida): calcolarne una nuova la sostituirà. Continuare?"));
    if (!ok) return;
  }

  // Snapshot the puzzle's version before starting a (potentially long)
  // background search — if the author keeps editing (undo/redo, map,
  // characters, clues all bump this via handleChange -> touch()) while it's
  // running, applying a since-stale result would silently clobber their
  // newer changes. Capture the object reference too, not just its
  // timestamp: undo/redo/import REASSIGN the module-level `puzzle` variable
  // outright (not just mutate it), and a bare timestamp comparison could in
  // principle miss a swap that lands in the same Date.now() millisecond.
  const startedAtVersion = puzzle.updatedAt;
  const startedAtPuzzle = puzzle;
  calcSolutionBtn.disabled = true;
  showProgress(t("Calcolo della soluzione in corso…"));
  try {
    const result = await deriveSolutionAsync(puzzle, searchBudget(limitsFor(puzzle).derive));
    clear(validationPanel);
    if (puzzle !== startedAtPuzzle || puzzle.updatedAt !== startedAtVersion) {
      validationPanel.appendChild(el("p", { class: "violation" }, t("Il caso è stato modificato nel frattempo: riprova.")));
      return;
    }

    if (result.status === "unique") {
      for (const character of puzzle.characters) {
        const p = result.placements.find((pl) => pl.characterId === character.id);
        setSolutionPlacement(puzzle, character.id, p ? p.row : null, p ? p.col : null);
      }
      handleChange(); // one combined undo step for the whole auto-fill
      validationPanel.appendChild(
        el("p", { class: "ok-message" }, t("✓ Soluzione calcolata e compilata automaticamente a partire dagli indizi."))
      );
    } else if (result.status === "unsatisfiable") {
      validationPanel.appendChild(
        el(
          "p",
          { class: "violation" },
          t("Nessuna soluzione trovata: gli indizi di questo caso sono contraddittori. La soluzione dichiarata non è stata modificata.")
        )
      );
    } else if (result.status === "ambiguous") {
      validationPanel.appendChild(
        el(
          "p",
          { class: "violation" },
          t(
            "Il puzzle è ambiguo: esistono più soluzioni possibili, non posso scegliere quella giusta al posto tuo. Aggiungi altri indizi. La soluzione dichiarata non è stata modificata."
          )
        )
      );
    } else {
      validationPanel.appendChild(
        el(
          "p",
          { class: "violation" },
          t(
            "Limite di ricerca raggiunto: il caso è troppo ampio da risolvere in tempi ragionevoli (non significa che sia irrisolvibile). Aggiungi indizi più stringenti. La soluzione dichiarata non è stata modificata."
          )
        )
      );
    }
  } catch (err) {
    showSolverError(err, (message) => t("Non sono riuscito a calcolare la soluzione: {message}. Riprova.", { message }));
  } finally {
    calcSolutionBtn.disabled = false;
  }
});

render();
updateUndoRedoButtons();
preview.schedule();
