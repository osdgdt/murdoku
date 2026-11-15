import { el, clear, onActivateKey } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { setSolutionPlacement, removeSolutionPlacement, placementFor, characterColor } from "../model/puzzle.js";
import { isOccupiable } from "../model/grid.js";
import { t } from "../i18n/i18n.js";

let selectedCharacterId = null;

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

  renderBoard(boardEl, puzzle.grid, {
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
      const conflict = puzzle.solution.placements.find((p) => p.characterId !== selectedCharacterId && (p.row === row || p.col === col));
      if (conflict) return;
      setSolutionPlacement(puzzle, selectedCharacterId, row, col);
      onChange();
    },
    onCellRightClick: (row, col) => {
      const placement = puzzle.solution.placements.find((p) => p.row === row && p.col === col);
      if (placement && removeSolutionPlacement(puzzle, placement.characterId)) onChange();
    },
  });
}
