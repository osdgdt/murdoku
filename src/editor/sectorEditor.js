import { el } from "../util/dom.js";
import { hasSectors, sectorAxis, sectorSize, setSectors, MAX_SECTORS } from "../model/sectors.js";
import { t } from "../i18n/i18n.js";

// The panel of the cases made of several maps (Wild West: the train, one map per wagon side by side; the skyscraper, one map
// per floor, stacked), in the map tab under the size: the grid is cut into strips of the given sizes. Wagons side by side:
// the columns are numbered across the wagons (C1…C15) and each has one person, the rows repeat in each wagon and in each of
// them there is one per row. Floors: the same turned around.
export function renderSectorPanel(panelEl, puzzle, { onChange }) {
  const grid = puzzle.grid;
  const current = sectorAxis(grid);
  panelEl.appendChild(el("h3", { "aria-level": "2" }, t("Mappe multiple (treno, grattacielo)")));
  panelEl.appendChild(
    el(
      "p",
      { class: "muted" },
      t(
        "Per i casi del treno (vagoni affiancati) o del grattacielo (piani impilati): la griglia è tagliata in più mappe. Treno: le colonne sono numerate da un vagone all'altro e ognuna ha una persona; le righe si ripetono in ogni vagone e in ciascuno ne vale una per riga. Grattacielo: ogni piano è una mappa, ci può essere al massimo una persona per riga, per colonna di ogni piano e per «pilastro» (la stessa casella in tutti i piani). Scrivi le dimensioni delle mappe (la loro somma è il numero di colonne nel treno, di righe nel grattacielo) e, se vuoi, i nomi; nel grattacielo anche le larghezze: i piani più stretti hanno le caselle a destra vuote."
      )
    )
  );
  const axis = el(
    "select",
    { "aria-label": t("Disposizione delle mappe") },
    [
      ["col", t("Treno: vagoni affiancati")],
      ["row", t("Grattacielo: piani impilati")],
    ].map(([value, label]) => el("option", { value, selected: current === value || undefined }, label))
  );
  const sizes = el("input", {
    type: "text",
    "aria-label": t("Dimensioni delle mappe, separate da virgole"),
    placeholder: "4, 4, 4, 3",
    value: hasSectors(grid) ? grid.sectors.map(sectorSize).join(", ") : "",
    style: "width:10em",
  });
  const names = el("input", {
    type: "text",
    "aria-label": t("Nomi delle mappe, separati da virgole"),
    placeholder: t("Merci, Passeggeri, Ristorante, Locomotiva"),
    value: hasSectors(grid) ? grid.sectors.map((s) => s.name).join(", ") : "",
    style: "width:18em",
  });
  // Floors only: how wide each floor is (empty = as wide as the grid); the cells beyond are not part of the floor.
  const widths = el("input", {
    type: "text",
    "aria-label": t("Larghezze dei piani, separate da virgole (vuoto = tutta la griglia)"),
    placeholder: t("4, 3, 2"),
    value: hasSectors(grid) ? grid.sectors.map((s) => s.width ?? grid.size.cols).join(", ") : "",
    style: "width:8em",
  });
  const widthsLabel = el("label", {}, t("Larghezze"));
  const showWidths = () => {
    const floors = axis.value === "row";
    widths.hidden = widthsLabel.hidden = !floors;
  };
  axis.addEventListener("change", showWidths);
  showWidths();
  const notice = el("p", { class: "muted", role: "status" }, "");
  const split = (text) =>
    text
      .split(",")
      .map((part) => part.trim())
      .filter((part, i, all) => part !== "" || i < all.length - 1);
  // the widths of the floors, in the order of the sizes: a blank one is a floor as wide as the grid
  const floorWidths = () => (axis.value === "row" ? split(widths.value).map((w) => (w === "" ? undefined : Number(w))) : []);
  panelEl.appendChild(
    el("div", { class: "field-row" }, [
      axis,
      el("label", {}, t("Dimensioni")),
      sizes,
      el("label", {}, t("Nomi")),
      names,
      widthsLabel,
      widths,
      el(
        "button",
        {
          onClick: () => {
            const along = axis.value === "row" ? grid.size.rows : grid.size.cols;
            if (!setSectors(grid, split(sizes.value).map(Number), split(names.value), axis.value, floorWidths())) {
              notice.textContent = t(
                "Servono da 2 a {max} dimensioni intere, e la loro somma deve essere {total} (righe o colonne della griglia); le larghezze dei piani, se le scrivi, vanno da 1 alla larghezza della griglia.",
                {
                  max: MAX_SECTORS,
                  total: along,
                }
              );
              return;
            }
            onChange();
          },
        },
        t("Dividi in mappe")
      ),
      hasSectors(grid)
        ? el(
            "button",
            {
              onClick: () => {
                setSectors(grid, null);
                onChange();
              },
            },
            t("Togli la divisione")
          )
        : null,
    ])
  );
  panelEl.appendChild(notice);
}
