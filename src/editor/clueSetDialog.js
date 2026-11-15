// The two windows of "export clues" / "import clues" (the logic is in clueSets.js). Native <dialog>s: they trap
// focus, close with Escape and are announced as dialogs.
import { el, clear } from "../util/dom.js";
import { CLUE_TYPES, describeClue } from "../model/clueTypes.js";
import { clonePuzzle } from "../model/puzzle.js";
import { objectIcon } from "../model/icons.js";
import { MAX_IMPORT_BYTES } from "../util/safe.js";
import { exportClueSet, parseClueSet, planImport, applyImport, importReasonText } from "./clueSets.js";
import { t } from "../i18n/i18n.js";

function openDialog(title, body, actions) {
  const dialog = el("dialog", { class: "clueset-dialog", "aria-labelledby": "clueset-title" }, [
    el("h2", { id: "clueset-title" }, title),
    body,
    el(
      "div",
      { class: "clueset-actions" },
      actions(() => close())
    ),
  ]);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener("cancel", () => setTimeout(() => dialog.remove(), 0));
  document.body.appendChild(dialog);
  dialog.showModal();
  return { dialog, close };
}

const slug = (text) =>
  (text || "indizi")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "indizi";

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const clueLine = (clue, puzzle) => {
  const owner = clue.characterId ? puzzle.characters.find((c) => c.id === clue.characterId)?.name : t("Generale");
  return `${owner}: ${describeClue(clue, puzzle)}`;
};

// ---- export ------------------------------------------------------------------------

export function openExportDialog(puzzle) {
  if (puzzle.clues.length === 0) {
    openDialog(t("Esporta indizi"), el("p", {}, t("Non ci sono ancora indizi da esportare.")), (close) => [
      el("button", { type: "button", onClick: close }, t("Chiudi")),
    ]);
    return;
  }
  const boxes = puzzle.clues.map((clue) => el("input", { type: "checkbox", checked: true, "data-clue": clue.id }));
  const list = el(
    "ul",
    { class: "clueset-list" },
    puzzle.clues.map((clue, i) => el("li", {}, [el("label", {}, [boxes[i], " ", clueLine(clue, puzzle)])]))
  );
  const setAll = (value) => boxes.forEach((b) => (b.checked = value));
  openDialog(
    t("Esporta indizi"),
    el("div", {}, [
      el("p", { class: "muted" }, t("Scegli gli indizi da portare in un altro caso. Nel file personaggi e stanze sono indicati per nome.")),
      el("div", { class: "field-row" }, [
        el("button", { type: "button", onClick: () => setAll(true) }, t("Tutti")),
        el("button", { type: "button", onClick: () => setAll(false) }, t("Nessuno")),
      ]),
      list,
    ]),
    (close) => [
      el("button", { type: "button", onClick: close }, t("Annulla")),
      el(
        "button",
        {
          type: "button",
          class: "primary",
          "data-key": "export-go",
          onClick: () => {
            const ids = boxes.filter((b) => b.checked).map((b) => b.dataset.clue);
            if (ids.length === 0) return;
            download(`${slug(puzzle.title)}.murdoku-clues.json`, exportClueSet(puzzle, ids));
            close();
          },
        },
        t("Scarica")
      ),
    ]
  );
}

// ---- import ------------------------------------------------------------------------

const ERRORS = {
  "not-a-clue-set": () => t("Questo file non è un set di indizi di Murdoku."),
  "unsupported-version": () => t("Questo set di indizi è di una versione che non conosco."),
  empty: () => t("Il file non contiene indizi."),
  "too-many": () => t("Il file contiene troppi indizi."),
  "bad-clue": () => t("Il file contiene un indizio malformato."),
};

// `onImported(addedCount, skippedCount)` is called after the clues were added (the editor then saves one undo step).
export function openImportDialog(puzzle, onImported) {
  const body = el("div", {});
  const notice = el("p", { class: "violation", role: "alert" });
  notice.hidden = true;
  const summary = el("div", { class: "clueset-summary", "aria-live": "polite" });
  const mappingBox = el("div", { class: "clueset-mapping" });
  let state = null; // { set, mapping }
  let importBtn = null;

  const optionList = (items, selectedId) => [
    el("option", { value: "" }, t("— nessuno —")),
    ...items.map(({ id, label }) => el("option", { value: id, selected: id === selectedId || undefined }, label)),
  ];

  function renderSummary() {
    clear(summary);
    // a trial run on a copy: what would be added, what left out and why
    const trial = applyImport(clonePuzzle(puzzle), state.set, state.mapping);
    summary.appendChild(
      el(
        "p",
        { class: trial.added.length > 0 ? "ok-message" : "violation" },
        t("Verranno aggiunti {added} indizi su {total}.", { added: trial.added.length, total: state.set.clues.length })
      )
    );
    if (trial.skipped.length > 0) {
      summary.appendChild(el("p", { class: "muted" }, t("Non verranno aggiunti:")));
      summary.appendChild(
        el(
          "ul",
          { class: "clueset-list" },
          trial.skipped.map((s) =>
            el("li", {}, `${s.owner ? s.owner + ": " : ""}${CLUE_TYPES[s.type]?.label ?? s.type} — ${importReasonText(s.reason)}`)
          )
        )
      );
    }
    if (importBtn) importBtn.disabled = trial.added.length === 0;
  }

  function renderMapping() {
    clear(mappingBox);
    const { set, mapping } = state;
    const row = (label, select) => el("label", { class: "clueset-row" }, [el("span", {}, label), select]);
    const characters = puzzle.characters.map((c) => ({ id: c.id, label: c.name }));
    for (const c of set.characters) {
      mappingBox.appendChild(
        row(
          t("Personaggio «{name}» è…", { name: c.name }),
          el(
            "select",
            {
              "aria-label": t("Personaggio «{name}» è…", { name: c.name }),
              onChange: (e) => {
                mapping.characters[c.name] = e.target.value || null;
                renderSummary();
              },
            },
            optionList(characters, mapping.characters[c.name])
          )
        )
      );
    }
    const zones = puzzle.grid.zones.map((z) => ({ id: z.id, label: z.name }));
    for (const z of set.zones) {
      mappingBox.appendChild(
        row(
          t("Stanza «{name}» è…", { name: z.name }),
          el(
            "select",
            {
              "aria-label": t("Stanza «{name}» è…", { name: z.name }),
              onChange: (e) => {
                mapping.zones[z.name] = e.target.value || null;
                renderSummary();
              },
            },
            optionList(zones, mapping.zones[z.name])
          )
        )
      );
    }
    set.objects.forEach((o, index) => {
      const sameType = puzzle.grid.objects
        .filter((x) => x.typeId === o.typeId)
        .map((x) => ({ id: x.id, label: `${objectIcon(x.typeId)?.label ?? x.typeId} (R${x.row + 1}, C${x.col + 1})` }));
      const name = `${objectIcon(o.typeId)?.label ?? o.typeId} (R${o.row + 1}, C${o.col + 1})`;
      mappingBox.appendChild(
        row(
          t("Oggetto «{name}» è…", { name }),
          el(
            "select",
            {
              "aria-label": t("Oggetto «{name}» è…", { name }),
              onChange: (e) => {
                mapping.objects[index] = e.target.value || null;
                renderSummary();
              },
            },
            optionList(sameType, mapping.objects[index])
          )
        )
      );
    });
  }

  const fileInput = el("input", {
    type: "file",
    accept: ".json,application/json",
    "data-key": "import-file",
    "aria-label": t("File di indizi da importare"),
    onChange: async (e) => {
      const file = e.target.files?.[0];
      notice.hidden = true;
      clear(mappingBox);
      clear(summary);
      state = null;
      if (importBtn) importBtn.disabled = true;
      if (!file) return;
      let data = null;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error("size");
        data = JSON.parse(await file.text());
      } catch {
        notice.textContent = t("Il file non è un JSON valido o è troppo grande.");
        notice.hidden = false;
        return;
      }
      const parsed = parseClueSet(data);
      if (!parsed.ok) {
        notice.textContent = (ERRORS[parsed.error] ?? ERRORS["not-a-clue-set"])();
        notice.hidden = false;
        return;
      }
      state = { set: parsed.set, mapping: planImport(puzzle, parsed.set) };
      renderMapping();
      renderSummary();
    },
  });
  body.append(
    el(
      "p",
      { class: "muted" },
      t(
        "Scegli un file di indizi (.murdoku-clues.json). Personaggi e stanze con lo stesso nome si collegano da soli: correggi gli altri qui sotto."
      )
    ),
    fileInput,
    notice,
    mappingBox,
    summary
  );
  openDialog(t("Importa indizi"), body, (close) => {
    importBtn = el(
      "button",
      {
        type: "button",
        class: "primary",
        disabled: true,
        "data-key": "import-go",
        onClick: () => {
          if (!state) return;
          const result = applyImport(puzzle, state.set, state.mapping);
          close();
          onImported(result.added.length, result.skipped.length);
        },
      },
      t("Importa")
    );
    return [el("button", { type: "button", onClick: close }, t("Annulla")), importBtn];
  });
}
