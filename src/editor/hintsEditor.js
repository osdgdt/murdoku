import { el, clear, onActivateKey } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { characterIcon } from "../model/icons.js";
import { characterColor, addManualHintStep, updateManualHintStep, removeManualHintStep, reorderManualHintSteps } from "../model/puzzle.js";
import { isOccupiable, zoneOfCell } from "../model/grid.js";

// UI-only: which step (if any) is currently choosing its board highlight via
// the "🎯 Imposta su mappa" button below, and which character is currently
// selected in that picker's own toolbar. Both module-level (not local to a
// single renderHintsEditor call) because selecting a character calls
// rerenderSelf(), which re-invokes this function from scratch — a plain
// local variable would be silently reset back to null by that very
// re-render, discarding the selection before a cell could ever be clicked.
// Neither is touched by onChange/undo on its own — only an actual cell click
// (a real mutation) goes through that.
let pickingStepId = null;
let pickerCharacterId = null;

export function renderHintsEditor(panelEl, boardEl, puzzle, onChange, onPersistOnly) {
  const steps = puzzle.manualHints || [];
  if (pickingStepId && !steps.find((s) => s.id === pickingStepId)) pickingStepId = null;
  if (!pickingStepId) pickerCharacterId = null;
  const rerenderSelf = () => renderHintsEditor(panelEl, boardEl, puzzle, onChange, onPersistOnly);

  clear(panelEl);
  panelEl.appendChild(el("h3", {}, "Suggerimenti passo-passo"));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      'Se questo caso ha almeno un passo qui sotto, il pulsante "Suggerimento" nel gioco mostrerà SOLO questa sequenza scritta da te, nell\'ordine, al posto del motore di suggerimenti automatico. Lascia questa lista vuota per continuare a usare i suggerimenti automatici (comportamento invariato).'
    )
  );

  const list = el("div", { class: "clue-list" });
  steps.forEach((step, i) => {
    const character = step.characterId ? puzzle.characters.find((c) => c.id === step.characterId) : null;
    const zoneId = step.row != null && step.col != null ? zoneOfCell(puzzle.grid, step.row, step.col) : null;
    const zone = zoneId && puzzle.grid.zones.find((z) => z.id === zoneId);

    const textarea = el(
      "textarea",
      {
        class: "bio-input",
        rows: "2",
        placeholder: "Testo del passo (spiegazione dell'autore)",
        onInput: (e) => { updateManualHintStep(puzzle, step.id, { message: e.target.value }); onPersistOnly(); },
      },
      step.message || ""
    );

    const highlightSummary = el(
      "span",
      { class: "muted" },
      character && step.row != null
        ? `Evidenzia: ${character.name} in R${step.row + 1}/C${step.col + 1}${zone ? ` (${zone.name})` : ""}`
        : "Nessuna evidenziazione (solo testo)"
    );

    const pickBtn = el(
      "button",
      {
        onClick: () => {
          if (pickingStepId === step.id) {
            pickingStepId = null;
          } else {
            pickingStepId = step.id;
            pickerCharacterId = step.characterId || null;
          }
          rerenderSelf();
        },
      },
      pickingStepId === step.id ? "✓ Scegli sulla mappa a destra…" : "🎯 Imposta su mappa"
    );
    const clearHighlightBtn =
      character || step.row != null
        ? el(
            "button",
            { onClick: () => { updateManualHintStep(puzzle, step.id, { characterId: null, row: null, col: null }); onChange(); } },
            "✕ Rimuovi evidenziazione"
          )
        : null;
    const upBtn = el(
      "button",
      { disabled: i === 0 || undefined, onClick: () => { reorderManualHintSteps(puzzle, i, i - 1); onChange(); } },
      "↑"
    );
    const downBtn = el(
      "button",
      { disabled: i === steps.length - 1 || undefined, onClick: () => { reorderManualHintSteps(puzzle, i, i + 1); onChange(); } },
      "↓"
    );
    const removeBtn = el(
      "button",
      {
        class: "clue-remove",
        title: "Rimuovi passo",
        onClick: () => {
          if (pickingStepId === step.id) pickingStepId = null;
          removeManualHintStep(puzzle, step.id);
          onChange();
        },
      },
      "×"
    );

    list.appendChild(
      el("div", { class: "clue-card" }, [
        el("div", { class: "clue-card-header" }, [
          el("span", { class: "clue-text" }, `Passo ${i + 1}`),
          el("div", { class: "clue-card-actions" }, [upBtn, downBtn, removeBtn]),
        ]),
        textarea,
        el("div", { class: "row" }, [pickBtn, clearHighlightBtn, highlightSummary].filter(Boolean)),
      ])
    );
  });
  panelEl.appendChild(list);

  panelEl.appendChild(el("button", { onClick: () => { addManualHintStep(puzzle, ""); onChange(); } }, "+ Aggiungi passo"));

  // Board condivisa: anteprima di sola lettura (mostra i token già assegnati
  // ad ogni passo) quando nessun passo è in fase di scelta, oppure la
  // modalità "seleziona un personaggio poi clicca una cella" per un solo
  // passo alla volta.
  if (!pickingStepId) {
    renderBoard(boardEl, puzzle.grid, {
      decorateCell: (cellNode, row, col) => {
        const step = steps.find((s) => s.row === row && s.col === col && s.characterId);
        const character = step && puzzle.characters.find((c) => c.id === step.characterId);
        if (character) {
          const token = el("div", {
            class: "char-token",
            style: `background:${character.isVictim ? "var(--danger)" : characterColor(character)}`,
            title: character.name,
          });
          token.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
          cellNode.appendChild(token);
        }
      },
    });
    return;
  }

  const chips = el("div", { class: "player-toolbar" });
  for (const character of puzzle.characters) {
    const selectThis = () => { pickerCharacterId = character.id; rerenderSelf(); };
    chips.appendChild(
      el(
        "div",
        {
          class: "char-chip" + (pickerCharacterId === character.id ? " selected" : ""),
          tabindex: "0",
          role: "button",
          "aria-label": character.name,
          onClick: selectThis,
          onKeydown: onActivateKey(selectThis),
        },
        character.name + (character.isVictim ? " (V)" : "")
      )
    );
  }
  panelEl.insertBefore(el("p", { class: "muted" }, "Seleziona un personaggio, poi clicca la cella da evidenziare per questo passo."), list);
  panelEl.insertBefore(chips, list);

  renderBoard(boardEl, puzzle.grid, {
    onCellClick: (row, col) => {
      if (!pickerCharacterId || !isOccupiable(puzzle.grid, row, col)) return;
      updateManualHintStep(puzzle, pickingStepId, { characterId: pickerCharacterId, row, col });
      pickingStepId = null;
      onChange();
    },
  });
}
