import { el, clear } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { addZone, removeZone, paintCellZone, placeObject, removeObject, resizeGrid, setBlocked } from "../model/grid.js";
import { OBJECT_TYPES } from "../model/icons.js";

const ZONE_COLORS = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2", "#c2f4e8", "#e8e8e8"];

let tool = null; // { kind: 'zone', zoneId } | { kind: 'object', typeId } | { kind: 'block' } | { kind: 'erase' }

// Enter/Space equivalent of a click, for custom (non-<button>) widgets like
// the zone swatches and object-palette items below — they're plain <div>s so
// they need tabindex/role wired alongside this to actually be reachable.
function onActivateKey(onActivate) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
}

export function renderMapEditor(panelEl, boardEl, puzzle, onChange) {
  clear(panelEl);

  panelEl.appendChild(el("h3", {}, "Mappa"));

  // Grid size controls
  const rowsInput = el("input", { type: "number", min: "3", max: "9", value: String(puzzle.grid.size.rows), style: "width:4em" });
  const colsInput = el("input", { type: "number", min: "3", max: "9", value: String(puzzle.grid.size.cols), style: "width:4em" });
  const applySize = el("button", {
    onClick: () => {
      const rows = Math.max(3, Math.min(9, parseInt(rowsInput.value, 10) || 6));
      const cols = Math.max(3, Math.min(9, parseInt(colsInput.value, 10) || 6));
      puzzle.grid = resizeGrid(puzzle.grid, rows, cols);
      onChange();
    },
  }, "Applica");
  panelEl.appendChild(
    el("div", { class: "field-row" }, [
      el("label", {}, "Righe"), rowsInput,
      el("label", {}, "Colonne"), colsInput,
      applySize,
    ])
  );

  // Zones
  panelEl.appendChild(el("h3", {}, "Stanze / Zone"));
  const zoneNameInput = el("input", { type: "text", placeholder: "Nome stanza" });
  const addZoneBtn = el("button", {
    onClick: () => {
      const name = zoneNameInput.value.trim() || `Stanza ${puzzle.grid.zones.length + 1}`;
      const color = ZONE_COLORS[puzzle.grid.zones.length % ZONE_COLORS.length];
      const zone = addZone(puzzle.grid, name, color);
      tool = { kind: "zone", zoneId: zone.id };
      zoneNameInput.value = "";
      onChange();
    },
  }, "+ Aggiungi stanza");
  panelEl.appendChild(el("div", { class: "field-row" }, [zoneNameInput, addZoneBtn]));

  const zoneList = el("div", { class: "zone-swatch-list" });
  for (const zone of puzzle.grid.zones) {
    const selectZone = () => {
      tool = { kind: "zone", zoneId: zone.id };
      onChange();
    };
    const swatch = el("div", {
      class: "swatch" + (tool?.kind === "zone" && tool.zoneId === zone.id ? " selected" : ""),
      style: `background:${zone.color}`,
      title: zone.name + " (click per dipingere, doppio click per rimuovere)",
      tabindex: "0",
      role: "button",
      "aria-label": `Stanza ${zone.name}: seleziona per dipingere`,
      onClick: selectZone,
      onKeydown: onActivateKey(selectZone),
      onDblclick: () => {
        removeZone(puzzle.grid, zone.id);
        if (tool?.zoneId === zone.id) tool = null;
        onChange();
      },
    });
    zoneList.appendChild(swatch);
  }
  panelEl.appendChild(zoneList);
  panelEl.appendChild(el("p", { class: "muted" }, "Seleziona una stanza e clicca sulle celle per dipingerle. Doppio click su uno swatch per eliminare la stanza."));

  // Objects
  panelEl.appendChild(el("h3", {}, "Oggetti / Mobili"));
  const objectPalette = el("div", { class: "object-palette" });
  for (const [typeId, def] of Object.entries(OBJECT_TYPES)) {
    const selectObject = () => {
      tool = { kind: "object", typeId };
      onChange();
    };
    const item = el("div", {
      class: "palette-item" + (tool?.kind === "object" && tool.typeId === typeId ? " selected" : ""),
      title: def.label,
      tabindex: "0",
      role: "button",
      "aria-label": `Oggetto: ${def.label}`,
      onClick: selectObject,
      onKeydown: onActivateKey(selectObject),
    });
    item.innerHTML = def.icon;
    objectPalette.appendChild(item);
  }
  panelEl.appendChild(objectPalette);

  // Shape tool
  panelEl.appendChild(el("h3", {}, "Forma della mappa"));
  const blockBtn = el("button", {
    onClick: () => { tool = { kind: "block" }; onChange(); },
  }, tool?.kind === "block" ? "🚫 Blocca/sblocca cella (attivo)" : "🚫 Blocca/sblocca cella");
  panelEl.appendChild(el("div", { class: "field-row" }, [blockBtn]));
  panelEl.appendChild(el("p", { class: "muted" }, "Clicca sulle celle per escluderle dalla mappa (es. per creare forme a L o irregolari). Clicca di nuovo per riattivarle."));

  const eraseBtn = el("button", {
    onClick: () => { tool = { kind: "erase" }; onChange(); },
  }, tool?.kind === "erase" ? "Gomma (attiva)" : "Gomma");
  panelEl.appendChild(el("div", { class: "field-row" }, [eraseBtn]));

  renderBoard(boardEl, puzzle.grid, {
    onCellClick: (row, col) => {
      if (!tool) return;
      const cell = puzzle.grid.cells[row][col];
      if (tool.kind === "block") {
        setBlocked(puzzle.grid, row, col, !cell.blocked);
      } else if (cell.blocked) {
        // ignore paint/object/erase attempts on blocked cells
      } else if (tool.kind === "zone") {
        paintCellZone(puzzle.grid, row, col, tool.zoneId);
      } else if (tool.kind === "object") {
        placeObject(puzzle.grid, tool.typeId, row, col);
      } else if (tool.kind === "erase") {
        if (cell.objectId) removeObject(puzzle.grid, cell.objectId);
        cell.zoneId = null;
      }
      onChange();
    },
    onCellRightClick: (row, col) => {
      const cell = puzzle.grid.cells[row][col];
      if (cell.objectId) removeObject(puzzle.grid, cell.objectId);
      cell.zoneId = null;
      setBlocked(puzzle.grid, row, col, false);
      onChange();
    },
  });
}
