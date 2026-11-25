import { el } from "../util/dom.js";
import { isNameHidden, setZoneNameHidden, hiddenNameZones, MAX_HIDDEN_NAMES, HIDDEN_NAME } from "../model/placeNames.js";
import { t } from "../i18n/i18n.js";

// The panel of the places whose name is to be deduced (Pirates: islands marked «???»), in the map tab under the sea and
// land: for each room, whether the board hides its name. The room keeps its real name here (that is the solution); the
// player sees «???» and the clues name the place («È nel luogo chiamato Cocco»).
export function renderPlaceNamePanel(panelEl, puzzle, { onChange }) {
  const zones = puzzle.grid.zones;
  if (zones.length === 0) return;
  panelEl.appendChild(el("h3", { "aria-level": "2" }, t("Luoghi da identificare")));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      t(
        "Per i casi dei Pirati: una stanza con il nome nascosto compare come «???» e il suo nome si deduce dagli indizi. Dai alla stanza il suo nome vero (è la soluzione) e spunta la casella."
      )
    )
  );
  const full = hiddenNameZones(puzzle.grid).length >= MAX_HIDDEN_NAMES;
  const list = el("div", { class: "hidden-name-zones" });
  for (const zone of zones) {
    const box = el("input", {
      type: "checkbox",
      disabled: (full && !isNameHidden(zone)) || undefined,
      onChange: (e) => {
        setZoneNameHidden(puzzle.grid, zone.id, e.target.checked);
        onChange();
      },
    });
    box.checked = isNameHidden(zone);
    list.appendChild(
      el("label", { class: "hidden-name-zone" }, [box, " ", isNameHidden(zone) ? `${HIDDEN_NAME} → ${zone.name}` : zone.name])
    );
  }
  panelEl.appendChild(list);
}
