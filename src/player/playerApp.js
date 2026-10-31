import "../i18n/i18n.js";
import { el, clear, qs } from "../util/dom.js";
import * as store from "../storage/puzzleStore.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "./board.js";
import { duplicatePuzzle, difficultyLabel } from "../model/puzzle.js";
import { importPuzzleFromUrl } from "../storage/importExport.js";
import { decodePuzzleFromFragment } from "../storage/shareLink.js";
import { wireThemeToggle } from "../util/theme.js";
import { createGameScreen } from "./gameScreen.js";
import { formatElapsed } from "../util/time.js";
import { renderLibrarySection, isLibraryPuzzleId } from "./libraryPanel.js";
import * as recentActivity from "../storage/recentActivityStore.js";
import { t, intlLocale } from "../i18n/i18n.js";

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

// Share-by-link, no hosting needed: `player.html#case=<payload>` carries the
// whole (compressed) puzzle in the URL fragment — see storage/shareLink.js.
// Same rule as ?import=: an already-saved case is never overwritten, so
// reopening the link keeps the recipient's progress.
if (!puzzleId && location.hash.startsWith("#case=")) {
  try {
    const shared = await decodePuzzleFromFragment(location.hash);
    if (shared) {
      if (!store.get(shared.id)) store.save(shared);
      puzzleId = shared.id;
      history.replaceState(null, "", `player.html?id=${encodeURIComponent(puzzleId)}`);
    }
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
  titleEl.textContent = t("Scegli un caso da giocare");
  pickerEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  clear(pickerEl);
  if (importError) {
    pickerEl.appendChild(el("div", { class: "result-banner hint-error" }, t("Non sono riuscito a importare il caso dal link: {importError}", { importError })));
  }
  // Library cases that were already opened are saved like any other puzzle,
  // but are listed in the library section instead of being duplicated here.
  const puzzles = sortPuzzleEntries(store.list().filter((p) => !isLibraryPuzzleId(p.id)));
  renderLibrarySection(pickerEl).then(() => {
    // The section is appended asynchronously (it fetches the index); keep it
    // above the player's own cases.
    const section = pickerEl.querySelector(".library-section");
    if (section) pickerEl.insertBefore(section, pickerEl.firstChild);
  });
  if (puzzles.length === 0) return;
  pickerEl.appendChild(
    el("div", { class: "saved-list-header" }, [
      el("h2", {}, t("I tuoi casi")),
      puzzles.length > 0
        ? el(
            "select",
            {
              onChange: (e) => { pickerSortMode = e.target.value; showPicker(); },
            },
            [
              el("option", { value: "updated", selected: pickerSortMode === "updated" || undefined }, t("Aggiornati di recente")),
              el("option", { value: "title", selected: pickerSortMode === "title" || undefined }, t("Titolo")),
              el("option", { value: "difficulty", selected: pickerSortMode === "difficulty" || undefined }, t("Difficoltà")),
            ]
          )
        : null,
    ])
  );
  const panel = el("div", { class: "panel" });
  for (const entry of puzzles) {
    const updated = new Date(entry.updatedAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" });
    panel.appendChild(
      el("div", { class: "saved-row" }, [
        el("div", {}, [
          el("span", { class: "title" }, [
            entry.completed ? el("span", { class: "completed-badge", title: t("Completato") }, "✓") : null,
            entry.title,
          ]),
          entry.difficulty ? el("span", { class: `difficulty-badge difficulty-${entry.difficulty}` }, difficultyLabel(entry.difficulty)) : null,
          typeof entry.bestTimeSeconds === "number" ? el("span", { class: "best-time-badge", title: t("Miglior tempo") }, `⏱ ${formatElapsed(entry.bestTimeSeconds)}`) : null,
          el("span", { class: "meta" }, t("Aggiornato il {updated}", { updated })),
        ]),
        el("div", { class: "actions" }, [
          el("a", { class: "play", href: `player.html?id=${entry.id}` }, t("Gioca")),
          el("button", {
            type: "button",
            class: "duplicate",
            title: t("Duplica"),
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
            title: t("Elimina"),
            onClick: () => {
              const ok = confirm(t("Eliminare definitivamente il caso \"{title}\"? L'azione non è reversibile.", { title: entry.title }));
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
