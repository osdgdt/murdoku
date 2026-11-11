import { el, clear } from "../util/dom.js";
import { renderBoard } from "../util/boardRender.js";
import { addZone, removeZone, paintCellZone, placeObject, removeObject, resizeGrid, setBlocked, edgeObjectsAt } from "../model/grid.js";
import { OBJECT_TYPES, isEdgeObjectType } from "../model/icons.js";
import { ZONE_TEXTURES, floorStyle } from "../model/textures.js";

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

// Which side (N/E/S/W) of a cell a click landed closest to — how an author
// picks the side of a door/window: click near the edge it should sit on.
// Falls back to "N" when there's no usable event (e.g. keyboard activation).
function nearestSide(e) {
  const node = e && e.currentTarget;
  if (!node || typeof e.clientX !== "number") return "N";
  const rect = node.getBoundingClientRect();
  const dx = (e.clientX - rect.left) / rect.width - 0.5;
  const dy = (e.clientY - rect.top) / rect.height - 0.5;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "E" : "W";
  return dy > 0 ? "S" : "N";
}

// Erase under the pointer: the edge piece on the nearest side if there is one,
// else the whole-cell object, else any edge piece left in the cell.
function eraseObjectAt(grid, row, col, side) {
  const cell = grid.cells[row][col];
  const edges = edgeObjectsAt(grid, row, col);
  const onSide = edges.find((o) => (o.side || "N") === side);
  if (onSide) return removeObject(grid, onSide.id);
  if (cell.objectId) return removeObject(grid, cell.objectId);
  if (edges.length) removeObject(grid, edges[0].id);
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
    // Floor picker: a collapsed <details> showing the current floor as a
    // miniature, opening into a grid of miniatures (picking one re-renders the
    // panel, which closes it again). Miniatures carry the zone tint too, so
    // they preview what the room will actually look like.
    const currentId = zone.textureId || "hatch";
    const chipStyle = (id) => {
      const { image, size } = floorStyle(id, zone.color);
      return `background-color:${zone.color};background-image:${image};background-size:${size}`;
    };
    const floorPicker = el(
      "div",
      { class: "floor-picker" },
      Object.entries(ZONE_TEXTURES).map(([id, def]) =>
        el("button", {
          class: "floor-chip" + (id === currentId ? " selected" : ""),
          type: "button",
          title: def.label,
          "aria-label": `Pavimento: ${def.label}`,
          style: chipStyle(id),
          onClick: () => { zone.textureId = id; onChange(); },
        })
      )
    );
    const textureSelect = el("details", { class: "floor-details" }, [
      el("summary", { title: `Pavimento: ${ZONE_TEXTURES[currentId]?.label || ZONE_TEXTURES.hatch.label}` }, [
        el("span", { class: "floor-chip current", style: chipStyle(currentId) }),
      ]),
      floorPicker,
    ]);
    zoneList.appendChild(el("div", { class: "zone-swatch-item" }, [swatch, textureSelect]));
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
  panelEl.appendChild(el("p", { class: "muted" }, "Porte e finestre stanno su un lato della cella: clicca vicino al bordo dove devono andare (puoi metterne più di una nella stessa cella, e una persona può starci). Con la gomma o il tasto destro si toglie quella più vicina al click."));

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
    onCellClick: (row, col, e) => {
      if (!tool) return;
      const cell = puzzle.grid.cells[row][col];
      if (tool.kind === "block") {
        setBlocked(puzzle.grid, row, col, !cell.blocked);
      } else if (cell.blocked) {
        // ignore paint/object/erase attempts on blocked cells
      } else if (tool.kind === "zone") {
        paintCellZone(puzzle.grid, row, col, tool.zoneId);
      } else if (tool.kind === "object") {
        placeObject(puzzle.grid, tool.typeId, row, col, isEdgeObjectType(tool.typeId) ? nearestSide(e) : undefined);
      } else if (tool.kind === "erase") {
        eraseObjectAt(puzzle.grid, row, col, nearestSide(e));
        cell.zoneId = null;
      }
      onChange();
    },
    onCellRightClick: (row, col, e) => {
      const cell = puzzle.grid.cells[row][col];
      eraseObjectAt(puzzle.grid, row, col, nearestSide(e));
      cell.zoneId = null;
      setBlocked(puzzle.grid, row, col, false);
      onChange();
    },
  });
}
