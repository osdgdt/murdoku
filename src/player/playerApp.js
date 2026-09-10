import { el, clear, qs } from "../util/dom.js";
import * as store from "../storage/puzzleStore.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "./board.js";
import { duplicatePuzzle, difficultyLabel } from "../model/puzzle.js";
import { importPuzzleFromUrl } from "../storage/importExport.js";
import { wireThemeToggle } from "../util/theme.js";
import { createGameScreen } from "./gameScreen.js";
import { formatElapsed } from "../util/time.js";
import * as recentActivity from "../storage/recentActivityStore.js";

wireThemeToggle();

const params = new URLSearchParams(location.search);
let puzzleId = params.get("id");
let importError = null;

// Share-by-link: `player.html?import=<url>` fetches a puzzle from anywhere
// (typically a .murdoku.json sitting right next to this file, e.g. exported
// from the editor and committed alongside it) and plays it directly, instead
// of asking the recipient to save the file and use the editor's manual
// "Importa" file picker. A puzzle already saved under that id (the recipient
// revisiting the same link mid-game) is never overwritten, so their progress
// survives — this just resolves the link to its id and continues exactly
// like the normal `?id=` flow below.
const importUrl = params.get("import");
if (!puzzleId && importUrl) {
  try {
    const imported = await importPuzzleFromUrl(importUrl);
    if (!store.get(imported.id)) store.save(imported);
    puzzleId = imported.id;
    history.replaceState(null, "", `player.html?id=${puzzleId}`);
  } catch (err) {
    importError = err.message;
  }
}

const pickerEl = qs("#puzzle-picker");
const gameEl = qs("#game");
const titleEl = qs("#player-title");

let puzzle = puzzleId ? store.get(puzzleId) : null;
let state = puzzle ? deserializeBoardState(store.getProgress(puzzle.id)) : createBoardState();

// Saved on every board-state mutation (placement, X, candidate, undo,
// pulisci tutto) so leaving and reopening this puzzle — even just reloading
// the page — restores exactly where you left off.
function persistProgress() {
  store.saveProgress(puzzle.id, serializeBoardState(state));
}

let pickerSortMode = "updated"; // "updated" | "title" | "difficulty"
const DIFFICULTY_ORDER = ["", "very-easy", "easy", "medium", "hard", "expert"];

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
  if (importError) {
    pickerEl.appendChild(el("div", { class: "result-banner hint-error" }, `Non sono riuscito a importare il caso dal link: ${importError}`));
  }
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
          typeof entry.bestTimeSeconds === "number" ? el("span", { class: "best-time-badge", title: "Miglior tempo" }, `⏱ ${formatElapsed(entry.bestTimeSeconds)}`) : null,
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

if (!puzzle) {
  showPicker();
} else {
  pickerEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  titleEl.textContent = puzzle.title;
  recentActivity.recordOpened({
    kind: "puzzle",
    id: puzzle.id,
    title: puzzle.title,
    url: `player.html?id=${puzzle.id}`,
  });
  const screen = createGameScreen({
    puzzle,
    state,
    persistProgress,
    achievementKey: `puzzle:${puzzle.id}`,
    onSolved: (elapsedSeconds) => {
      puzzle.completed = true;
      if (puzzle.bestTimeSeconds == null || elapsedSeconds < puzzle.bestTimeSeconds) {
        puzzle.bestTimeSeconds = elapsedSeconds;
      }
      store.save(puzzle);
    },
  });
  screen.start();
}
