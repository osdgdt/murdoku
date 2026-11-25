import { el, clear, onActivateKey } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { setSolutionPlacement, removeSolutionPlacement, placementFor, characterColor } from "../model/puzzle.js";
import { isOccupiable } from "../model/grid.js";
import { lineTracker } from "../model/sectors.js";
import { hasRoles, setSolutionRole } from "../model/roles.js";
import { t } from "../i18n/i18n.js";

let selectedCharacterId = null;

// Who has which role in the author's solution: one choice per person. Not chosen yet = unknown (the case checker says
// so); "nessun ruolo" is a choice of its own, offered unless everybody must have a role.
function renderRoleChoices(puzzle, onChange) {
  const box = el("div", { class: "role-choices" }, el("h4", { class: "palette-group", "aria-level": "3" }, t("Ruoli nella soluzione")));
  for (const character of puzzle.characters) {
    const current = puzzle.solution.roles ? puzzle.solution.roles[character.id] : undefined;
    const value = current === undefined ? "" : current === null ? "none" : current;
    const options = [
      el("option", { value: "", selected: value === "" || undefined }, t("— da scegliere —")),
      ...puzzle.roles.defs.map((d) => el("option", { value: d.id, selected: value === d.id || undefined }, d.name)),
      puzzle.roles.everyone ? null : el("option", { value: "none", selected: value === "none" || undefined }, t("nessun ruolo")),
    ];
    const select = el(
      "select",
      {
        "aria-label": t("Ruolo di {name}", { name: character.name }),
        onChange: (e) => {
          const next = e.target.value;
          setSolutionRole(puzzle, character.id, next === "" ? undefined : next === "none" ? null : next);
          onChange();
        },
      },
      options
    );
    box.appendChild(el("div", { class: "role-choice" }, [el("span", {}, character.name + (character.isVictim ? " (V)" : "")), select]));
  }
  return box;
}

export function renderSolutionEditor(panelEl, boardEl, puzzle, onChange) {
  clear(panelEl);
  panelEl.appendChild(el("h3", { "aria-level": "2" }, t("Soluzione dell'autore")));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      t(
        "Seleziona un personaggio e clicca una cella per piazzarlo. Non è possibile condividere riga o colonna con un altro personaggio già piazzato. Per toglierlo dalla soluzione clicca di nuovo la sua casella, oppure premi ✕ accanto al suo nome."
      )
    )
  );

  if (selectedCharacterId && !puzzle.characters.find((c) => c.id === selectedCharacterId)) {
    selectedCharacterId = null;
  }

  const chips = el("div", { class: "player-toolbar" });
  for (const character of puzzle.characters) {
    const placed = !!placementFor(puzzle, character.id);
    const selectThis = () => {
      selectedCharacterId = character.id;
      onChange();
    };
    const chip = el(
      "div",
      {
        class: "char-chip" + (selectedCharacterId === character.id ? " selected" : "") + (placed ? " used" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": character.name + (character.isVictim ? t(" (vittima)") : ""),
        onClick: selectThis,
        onKeydown: onActivateKey(selectThis),
      },
      character.name + (character.isVictim ? " (V)" : "")
    );
    if (!placed) {
      chips.appendChild(chip);
      continue;
    }
    // A placed character can be taken out of the solution: a real button next to the chip (not
    // inside it: a button in a button is not accessible), which also works on a phone.
    const removeBtn = el(
      "button",
      {
        type: "button",
        class: "chip-remove",
        title: t("Togli {name} dalla soluzione", { name: character.name }),
        "aria-label": t("Togli {name} dalla soluzione", { name: character.name }),
        onClick: () => {
          if (removeSolutionPlacement(puzzle, character.id)) onChange();
        },
      },
      "✕"
    );
    chips.appendChild(el("span", { class: "chip-with-remove" }, [chip, removeBtn]));
  }
  panelEl.appendChild(chips);
  if (hasRoles(puzzle)) panelEl.appendChild(renderRoleChoices(puzzle, onChange));

  renderBoard(boardEl, puzzle.grid, {
    roles: puzzle.roles,
    decorateCell: (cellNode, row, col) => {
      const placement = puzzle.solution.placements.find((p) => p.row === row && p.col === col);
      if (placement) {
        const character = puzzle.characters.find((c) => c.id === placement.characterId);
        if (character) {
          const token = el("div", {
            class: "char-token",
            style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}`,
            title: character.name,
          });
          token.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
          cellNode.appendChild(token);
        }
      }
    },
    onCellClick: (row, col) => {
      if (!selectedCharacterId) return;
      // Clicking the cell of the selected character, already placed there, takes it out.
      const placed = placementFor(puzzle, selectedCharacterId);
      if (placed && placed.row === row && placed.col === col) {
        removeSolutionPlacement(puzzle, selectedCharacterId);
        onChange();
        return;
      }
      if (!isOccupiable(puzzle.grid, row, col)) return;
      // the line of its own map in a train or a skyscraper (and the pillar, in a skyscraper)
      const taken = lineTracker(
        puzzle.grid,
        puzzle.solution.placements.filter((p) => p.characterId !== selectedCharacterId)
      );
      if (taken.has(row, col)) return;
      setSolutionPlacement(puzzle, selectedCharacterId, row, col);
      onChange();
    },
    onCellRightClick: (row, col) => {
      const placement = puzzle.solution.placements.find((p) => p.row === row && p.col === col);
      if (placement && removeSolutionPlacement(puzzle, placement.characterId)) onChange();
    },
  });
}
