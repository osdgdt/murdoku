// Character / X / eraser chips above the board.
import { el, clear, onActivateKey, keepFocus } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { characterColor } from "../model/puzzle.js";
import { characterKey } from "./characterKeys.js";
import { t } from "../i18n/i18n.js";

// `handlers`: { selectTool(tool), showCharacterHover(id), clearHover() }.
export function renderToolbar(toolbarEl, puzzle, state, handlers) {
  keepFocus(toolbarEl, ".char-chip", () => buildToolbar(toolbarEl, puzzle, state, handlers));
}

// The toolbar pattern: one tab stop (the selected tool, or the first), Left/Right/Home/End move between the chips.
function wireToolbarKeys(toolbarEl) {
  if (toolbarEl.dataset.keysWired) return;
  toolbarEl.dataset.keysWired = "1";
  toolbarEl.setAttribute("role", "toolbar");
  toolbarEl.setAttribute("aria-label", t("Personaggi e strumenti"));
  toolbarEl.addEventListener("keydown", (e) => {
    const chips = [...toolbarEl.querySelectorAll(".char-chip")];
    const at = chips.indexOf(document.activeElement);
    if (at < 0) return;
    let next = at;
    if (e.key === "ArrowRight") next = (at + 1) % chips.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + chips.length) % chips.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = chips.length - 1;
    else return;
    e.preventDefault();
    chips.forEach((c, i) => (c.tabIndex = i === next ? 0 : -1));
    chips[next].focus();
  });
}

function buildToolbar(toolbarEl, puzzle, state, handlers) {
  clear(toolbarEl);
  wireToolbarKeys(toolbarEl);
  const { selectTool, showCharacterHover, clearHover } = handlers;
  puzzle.characters.forEach((character, index) => {
    const placed = state.placements.has(character.id);
    const selectThis = () => selectTool({ kind: "character", id: character.id });
    const chip = el("div", {
      class:
        "char-chip" +
        (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") +
        (placed ? " used" : ""),
      tabindex: "-1",
      role: "button",
      "aria-pressed": String(state.selectedTool?.kind === "character" && state.selectedTool.id === character.id),
      "aria-label": character.name + (character.isVictim ? t(" (vittima)") : "") + (placed ? t(", già piazzato") : ""),
      "aria-keyshortcuts": characterKey(index) || undefined,
      // The key is drawn by CSS (::after) so the chip's visible text stays the name,
      // which is exactly its accessible name.
      "data-key": characterKey(index) || undefined,
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
  });
  const selectX = () => selectTool({ kind: "x" });
  const selectErase = () => selectTool({ kind: "erase" });
  toolbarEl.appendChild(
    el(
      "div",
      {
        class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""),
        tabindex: "-1",
        role: "button",
        "aria-pressed": String(state.selectedTool?.kind === "x"),
        "aria-label": t("Segna X"),
        onClick: selectX,
        onKeydown: onActivateKey(selectX),
      },
      t("✕ Segna")
    )
  );
  toolbarEl.appendChild(
    el(
      "div",
      {
        class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""),
        tabindex: "-1",
        role: "button",
        "aria-pressed": String(state.selectedTool?.kind === "erase"),
        "aria-label": t("Gomma"),
        onClick: selectErase,
        onKeydown: onActivateKey(selectErase),
      },
      t("🧹 Gomma")
    )
  );
  // the one tab stop of the toolbar: the selected tool, else the first
  const chips = [...toolbarEl.querySelectorAll(".char-chip")];
  const current = chips.find((c) => c.classList.contains("selected")) || chips[0];
  if (current) current.tabIndex = 0;
}
