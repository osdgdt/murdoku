// Character / X / eraser chips above the board.
import { el, clear, onActivateKey } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { characterColor } from "../model/puzzle.js";
import { t } from "../i18n/i18n.js";

// `handlers`: { selectTool(tool), showCharacterHover(id), clearHover() }.
export function renderToolbar(toolbarEl, puzzle, state, handlers) {
  clear(toolbarEl);
  const { selectTool, showCharacterHover, clearHover } = handlers;
  for (const character of puzzle.characters) {
    const placed = state.placements.has(character.id);
    const selectThis = () => selectTool({ kind: "character", id: character.id });
    const chip = el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") + (placed ? " used" : ""),
      tabindex: "0",
      role: "button",
      "aria-label": character.name + (character.isVictim ? t(" (vittima)") : ""),
      onClick: selectThis,
      onKeydown: onActivateKey(selectThis),
      // Focus is the keyboard equivalent of hover: tabbing to a chip previews
      // its clue targets on the board before committing with Enter/Space.
      onMouseenter: () => showCharacterHover(character.id),
      onMouseleave: clearHover,
      onFocus: () => showCharacterHover(character.id),
      onBlur: clearHover,
    });
    const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
    iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
    chip.appendChild(iconWrap);
    if (!character.isVictim) chip.style.borderLeft = `3px solid ${characterColor(character)}`;
    chip.appendChild(document.createTextNode(character.name + (character.isVictim ? t(" (V)") : "")));
    toolbarEl.appendChild(chip);
  }
  const selectX = () => selectTool({ kind: "x" });
  const selectErase = () => selectTool({ kind: "erase" });
  toolbarEl.appendChild(el("div", {
    class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""),
    tabindex: "0", role: "button", "aria-label": t("Segna X"),
    onClick: selectX, onKeydown: onActivateKey(selectX),
  }, t("✕ Segna")));
  toolbarEl.appendChild(el("div", {
    class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""),
    tabindex: "0", role: "button", "aria-label": t("Gomma"),
    onClick: selectErase, onKeydown: onActivateKey(selectErase),
  }, t("🧹 Gomma")));
}
