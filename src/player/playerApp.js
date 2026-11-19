import "../i18n/i18n.js";
import { el, clear, qs } from "../util/dom.js";
import * as store from "../storage/puzzleStore.js";
import { createBoardState, serializeBoardState, deserializeBoardState } from "./board.js";
import { difficultyLabel } from "../model/puzzle.js";
import { duplicateCase } from "../community/remix.js";
import { isCaseCode, normalizeCode, isSharedPuzzleId, SHARED_PREFIX } from "../community/casePolicy.js";
import * as sharedRegistry from "../community/localRegistry.js";
import { openSharedCode } from "./sharedCase.js";
import { renderSharedPanel } from "./sharedPanel.js";
import { countPlay } from "./sharedActions.js";
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

// A case of the shared database: `player.html?c=ABCD2345` (a code someone passed on, a QR). It is saved here as
// `shared_<CODE>` the first time and opens from this browser afterwards — see player/sharedCase.js.
const sharedCode = params.get("c");
if (!puzzleId && sharedCode) {
  qs("#player-title").textContent = t("Cerco il caso {code}…", { code: normalizeCode(sharedCode) });
  const opened = await openSharedCode(sharedCode);
  if (opened.error) importError = opened.error;
  else puzzleId = opened.puzzleId;
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

// "Hai un codice?": the short code of a shared case, typed or pasted.
function renderCodeEntry() {
  const input = el("input", {
    type: "text",
    maxlength: "12",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    "aria-label": t("Codice del caso"),
    placeholder: t("Codice del caso"),
    "data-key": "code-input",
  });
  const notice = el("p", { class: "violation", role: "alert" });
  notice.hidden = true;
  const open = () => {
    const code = normalizeCode(input.value);
    if (!isCaseCode(code)) {
      notice.textContent = t("Il codice non è valido: sono 8 caratteri tra lettere e cifre, come ABCD-2345.");
      notice.hidden = false;
      return;
    }
    location.href = `player.html?c=${code}`;
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && open());
  return el("section", { class: "code-entry panel" }, [
    el("h2", {}, t("Hai un codice?")),
    el("p", { class: "muted" }, t("Se qualcuno ti ha passato il codice di un caso, scrivilo qui per giocarlo.")),
    el("div", { class: "field-row" }, [
      input,
      el("button", { type: "button", class: "primary", "data-key": "code-go", onClick: open }, t("Apri")),
    ]),
    notice,
    el("p", { class: "muted" }, [
      `${t("Non hai un codice?")} `,
      el("a", { href: "community.html", "data-key": "community-link" }, t("Sfoglia i casi della community")),
    ]),
  ]);
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
    pickerEl.appendChild(
      el("div", { class: "result-banner hint-error" }, t("Non sono riuscito a importare il caso dal link: {importError}", { importError }))
    );
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
  pickerEl.appendChild(renderCodeEntry());
  if (puzzles.length === 0) return;
  pickerEl.appendChild(
    el("div", { class: "saved-list-header" }, [
      el("h2", {}, t("I tuoi casi")),
      puzzles.length > 0
        ? el(
            "select",
            {
              onChange: (e) => {
                pickerSortMode = e.target.value;
                showPicker();
              },
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
          entry.difficulty
            ? el("span", { class: `difficulty-badge difficulty-${entry.difficulty}` }, difficultyLabel(entry.difficulty))
            : null,
          typeof entry.bestTimeSeconds === "number"
            ? el("span", { class: "best-time-badge", title: t("Miglior tempo") }, `⏱ ${formatElapsed(entry.bestTimeSeconds)}`)
            : null,
          el("span", { class: "meta" }, t("Aggiornato il {updated}", { updated })),
          isSharedPuzzleId(entry.id) && sharedRegistry.getShared(entry.id.slice(SHARED_PREFIX.length))?.authorNick
            ? el(
                "span",
                { class: "meta" },
                `🌐 ${t("di {nick}", { nick: sharedRegistry.getShared(entry.id.slice(SHARED_PREFIX.length)).authorNick })}`
              )
            : isSharedPuzzleId(entry.id)
              ? el("span", { class: "meta" }, `🌐 ${t("Caso condiviso")}`)
              : null,
        ]),
        el("div", { class: "actions" }, [
          el("a", { class: "play", href: `player.html?id=${entry.id}` }, t("Gioca")),
          el(
            "button",
            {
              type: "button",
              class: "duplicate",
              title: t("Duplica"),
              onClick: () => {
                const original = store.get(entry.id);
                if (!original) return;
                const made = duplicateCase(original);
                if (!made.ok) {
                  alert(t("L'autore non permette di copiare questo caso: puoi solo giocarlo."));
                  return;
                }
                store.save(made.copy);
                showPicker();
              },
            },
            "📋"
          ),
          el(
            "button",
            {
              type: "button",
              class: "delete",
              title: t("Elimina"),
              onClick: () => {
                const ok = confirm(t('Eliminare definitivamente il caso "{title}"? L\'azione non è reversibile.', { title: entry.title }));
                if (!ok) return;
                store.remove(entry.id);
                showPicker();
              },
            },
            "🗑"
          ),
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
  if (isSharedPuzzleId(puzzle.id)) {
    renderSharedPanel(qs("#shared-panel"), puzzle);
    countPlay(puzzle.id.slice(SHARED_PREFIX.length), "opened");
  }
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
      if (isSharedPuzzleId(puzzle.id)) countPlay(puzzle.id.slice(SHARED_PREFIX.length), "solved");
      puzzle.completed = true;
      if (puzzle.bestTimeSeconds == null || elapsedSeconds < puzzle.bestTimeSeconds) {
        puzzle.bestTimeSeconds = elapsedSeconds;
      }
      store.save(puzzle);
    },
  });
  screen.start();
}
