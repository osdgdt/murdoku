import { el, clear, onActivateKey } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { setSolutionPlacement, placementFor, characterColor } from "../model/puzzle.js";
import { isOccupiable } from "../model/grid.js";

let selectedCharacterId = null;

export function renderSolutionEditor(panelEl, boardEl, puzzle, onChange) {
  clear(panelEl);
  panelEl.appendChild(el("h3", {}, "Soluzione dell'autore"));
  panelEl.appendChild(el("p", { class: "muted" }, "Seleziona un personaggio e clicca una cella per piazzarlo. Non è possibile condividere riga o colonna con un altro personaggio già piazzato."));

  if (selectedCharacterId && !puzzle.characters.find((c) => c.id === selectedCharacterId)) {
    selectedCharacterId = null;
  }

  const chips = el("div", { class: "player-toolbar" });
  for (const character of puzzle.characters) {
    const placed = !!placementFor(puzzle, character.id);
    const selectThis = () => { selectedCharacterId = character.id; onChange(); };
    const chip = el(
      "div",
      {
        class: "char-chip" + (selectedCharacterId === character.id ? " selected" : "") + (placed ? " used" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": character.name + (character.isVictim ? " (vittima)" : ""),
        onClick: selectThis,
        onKeydown: onActivateKey(selectThis),
      },
      character.name + (character.isVictim ? " (V)" : "")
    );
    chips.appendChild(chip);
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
            style: `background:${character.isVictim ? "var(--danger)" : characterColor(character)}`,
            title: character.name,
          });
          token.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
          cellNode.appendChild(token);
        }
      }
    },
    onCellClick: (row, col) => {
      if (!selectedCharacterId) return;
      if (!isOccupiable(puzzle.grid, row, col)) return;
      const conflict = puzzle.solution.placements.find(
        (p) => p.characterId !== selectedCharacterId && (p.row === row || p.col === col)
      );
      if (conflict) return;
      setSolutionPlacement(puzzle, selectedCharacterId, row, col);
      onChange();
    },
    onCellRightClick: (row, col) => {
      const placement = puzzle.solution.placements.find((p) => p.row === row && p.col === col);
      if (placement) {
        setSolutionPlacement(puzzle, placement.characterId, null, null);
        onChange();
      }
    },
  });
}
