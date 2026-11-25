import { el } from "../util/dom.js";
import { TERRAINS, TERRAIN_LABELS, terrainOf, setZoneTerrain } from "../model/terrain.js";
import { t } from "../i18n/i18n.js";

// The panel of the sea and the land (Pirates), in the map tab under the roles: for each room, what it is. The Water is
// always one single area and a ship is an area of its own; everything else is land.
export function renderTerrainPanel(panelEl, puzzle, { onChange }) {
  const zones = puzzle.grid.zones;
  if (zones.length === 0) return;
  panelEl.appendChild(el("h3", { "aria-level": "2" }, t("Mare e terra")));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      t(
        "Per i casi dei Pirati: ogni nave è una stanza a sé e l'Acqua è una stanza sola, anche se le navi la interrompono. «In mare» vale per l'Acqua e per le navi, «a terra» per tutto il resto."
      )
    )
  );
  const list = el("div", { class: "terrain-zones" });
  for (const zone of zones) {
    const select = el(
      "select",
      {
        "aria-label": t("Che cos'è {room}", { room: zone.name }),
        onChange: (e) => {
          setZoneTerrain(puzzle.grid, zone.id, e.target.value);
          onChange();
        },
      },
      ["land", ...TERRAINS].map((kind) =>
        el("option", { value: kind, selected: terrainOf(zone) === kind || undefined }, TERRAIN_LABELS[kind])
      )
    );
    list.appendChild(el("label", { class: "terrain-zone" }, [el("span", {}, zone.name), " ", select]));
  }
  panelEl.appendChild(list);
}
