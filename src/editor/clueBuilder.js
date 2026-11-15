// The clues of the case, as a compact list under the board: one line per clue (the sentence, a
// mark that says whether it is complete and true in the declared solution) with the actions to
// edit, duplicate, move and remove it. Writing and editing a clue happens in the clue wizard
// (clueWizard.js), the same on a PC and on a phone.
import { el, clear } from "../util/dom.js";
import { describeClue } from "../model/clueTypes.js"; // first: clues/shared.js and clueTypes.js import each other
import { removeClue, duplicateClue, moveClue, cluesForCharacter, genericClues } from "../model/puzzle.js";
import { declaredPlacementMap } from "../solver/suggestions.js";
import { buildPredicate } from "../solver/predicates/index.js";
import { missingParams, hasDuplicateTargets } from "./clueDraft.js";
import { openClueWizard, openClueSuggestions, openClueGenerator, refreshClueWizard } from "./clueWizard.js";
import { openExportDialog, openImportDialog } from "./clueSetDialog.js";
import { t } from "../i18n/i18n.js";

// "incomplete" | "true" | "false" | "unknown" (no complete declared solution to judge with).
function clueStatus(clue, puzzle, placementMap) {
  if (missingParams(clue).length > 0 || hasDuplicateTargets(clue)) return "incomplete";
  if (!placementMap) return "unknown";
  try {
    const result = buildPredicate(clue, puzzle)(placementMap, true);
    return result === true ? "true" : result === false ? "false" : "unknown";
  } catch {
    return "unknown";
  }
}

const STATUS_BADGE = {
  incomplete: { mark: "⚠", label: () => t("Indizio incompleto: modificalo per completarlo") },
  true: { mark: "✓", label: () => t("Vero nella soluzione") },
  false: { mark: "✗", label: () => t("Falso nella soluzione") },
  unknown: { mark: "·", label: () => t("Non verificabile senza soluzione completa") },
};

function iconButton(mark, label, onClick, { disabled = false, danger = false, key } = {}) {
  return el(
    "button",
    {
      type: "button",
      class: "clue-icon-btn" + (danger ? " clue-remove" : ""),
      title: label,
      "aria-label": label,
      "data-key": key,
      disabled: disabled || undefined,
      onClick,
    },
    mark
  );
}

function renderClueRow(clue, puzzle, siblings, placementMap, onChange) {
  const status = clueStatus(clue, puzzle, placementMap);
  const badge = STATUS_BADGE[status];
  const index = siblings.indexOf(clue);
  const text =
    missingParams(clue).length > 0 ? t("(da completare) {clue}", { clue: describeClue(clue, puzzle) }) : describeClue(clue, puzzle);
  return el("li", { class: `clue-row ${status}`, "data-clue-id": clue.id }, [
    el("span", { class: `clue-status ${status}`, title: badge.label(), role: "img", "aria-label": badge.label() }, badge.mark),
    el(
      "button",
      { type: "button", class: "clue-row-text", title: t("Modifica indizio"), onClick: () => openClueWizard({ clueId: clue.id }) },
      text
    ),
    el("span", { class: "clue-row-actions" }, [
      iconButton("✎", t("Modifica indizio"), () => openClueWizard({ clueId: clue.id })),
      iconButton("⧉", t("Duplica indizio"), () => (duplicateClue(puzzle, clue.id), onChange())),
      iconButton(
        "↑",
        t("Sposta su"),
        () => {
          moveClue(puzzle, clue.id, -1);
          onChange();
        },
        { disabled: index <= 0 }
      ),
      iconButton(
        "↓",
        t("Sposta giù"),
        () => {
          moveClue(puzzle, clue.id, 1);
          onChange();
        },
        { disabled: index === siblings.length - 1 }
      ),
      iconButton(
        "×",
        t("Rimuovi indizio"),
        () => {
          removeClue(puzzle, clue.id);
          onChange();
        },
        { danger: true }
      ),
    ]),
  ]);
}

function renderOwner(title, subtitle, clues, ownerId, puzzle, placementMap, onChange) {
  const wrap = el("section", { class: "clue-owner" + (ownerId ? "" : " generic") });
  const incomplete = clues.filter((c) => clueStatus(c, puzzle, placementMap) === "incomplete").length;
  wrap.appendChild(
    el("header", { class: "clue-owner-header" }, [
      el("strong", {}, [title, el("span", { class: "muted" }, ` (${clues.length})`)]),
      incomplete > 0 ? el("span", { class: "clue-incomplete-count", role: "status" }, t("⚠ {n} da completare", { n: incomplete })) : null,
      el(
        "button",
        { type: "button", class: "clue-new-btn", "data-key": `new-${ownerId ?? "generic"}`, onClick: () => openClueWizard({ ownerId }) },
        ownerId ? t("+ Indizio") : t("+ Indizio generale")
      ),
    ])
  );
  if (subtitle) wrap.appendChild(el("p", { class: "muted" }, subtitle));
  if (clues.length > 0) {
    wrap.appendChild(
      el(
        "ul",
        { class: "clue-rows" },
        clues.map((c) => renderClueRow(c, puzzle, clues, placementMap, onChange))
      )
    );
  }
  return wrap;
}

export function renderClueBuilder(container, puzzle, onChange) {
  clear(container);
  const placementMap = declaredPlacementMap(puzzle);
  container.appendChild(
    el("div", { class: "clue-panel-header" }, [
      el("h3", { "aria-level": "2" }, t("Indizi")),
      el(
        "button",
        {
          type: "button",
          class: "clue-propose-btn",
          "data-key": "propose-set",
          title: t("Propone un insieme di indizi che rende unica la soluzione che hai dichiarato"),
          onClick: () => openClueGenerator(),
        },
        t("✨ Proponi")
      ),
      el(
        "button",
        {
          type: "button",
          class: "clue-suggest-btn",
          title: t("Gli indizi veri nella soluzione che hai dichiarato, da aggiungere con un tocco"),
          onClick: () => openClueSuggestions({}),
        },
        t("💡 Suggerisci")
      ),
      el(
        "button",
        {
          type: "button",
          class: "clue-set-btn",
          "data-key": "export-clues",
          title: t("Salva degli indizi in un file, per usarli in un altro caso"),
          onClick: () => openExportDialog(puzzle),
        },
        t("⬇ Esporta indizi")
      ),
      el(
        "button",
        {
          type: "button",
          class: "clue-set-btn",
          "data-key": "import-clues",
          title: t("Aggiungi a questo caso gli indizi di un file"),
          onClick: () =>
            openImportDialog(puzzle, (added, skipped) => {
              onChange(); // one undo step for the whole import
              const status = document.getElementById("status");
              if (status) status.textContent = t("Importati {added} indizi ({skipped} esclusi).", { added, skipped });
            }),
        },
        t("⬆ Importa indizi")
      ),
    ])
  );

  container.appendChild(
    renderOwner(
      t("🔎 Indizi generali del caso"),
      t("Fatti sulla scena non legati a un personaggio specifico."),
      genericClues(puzzle),
      null,
      puzzle,
      placementMap,
      onChange
    )
  );

  if (puzzle.characters.length === 0) {
    container.appendChild(el("p", { class: "muted" }, t("Aggiungi prima dei personaggi per aggiungere indizi a loro dedicati.")));
  } else {
    for (const character of puzzle.characters) {
      container.appendChild(
        renderOwner(
          character.name + (character.isVictim ? t(" (vittima)") : ""),
          "",
          cluesForCharacter(puzzle, character.id),
          character.id,
          puzzle,
          placementMap,
          onChange
        )
      );
    }
  }
  // the wizard (if open) keeps its own state: redraw it against the new puzzle and the new board
  refreshClueWizard();
}
