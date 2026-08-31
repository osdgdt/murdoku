import { el, clear } from "../util/dom.js";
import { CLUE_TYPES, characterClueTypeIds, genericClueTypeIds, describeClue } from "../model/clueTypes.js";
import { objectIcon, objectTypeTargetId } from "../model/icons.js";
import { addClue, removeClue, updateClue, setClueNegate, cluesForCharacter, genericClues } from "../model/puzzle.js";

function targetOptions(puzzle, kind, excludeCharacterId) {
  const options = [];
  if (kind === "character" || kind === "characterOrObject") {
    for (const c of puzzle.characters) {
      if (c.id === excludeCharacterId) continue;
      options.push({ value: c.id, label: c.name });
    }
  }
  if (kind === "zone") {
    for (const z of puzzle.grid.zones) options.push({ value: z.id, label: z.name });
  }
  if (kind === "characterOrObject") {
    // A room counts as a target too — e.g. "è accanto a" a whole zone means
    // adjacent to any one of its cells (see resolveTargetPositions).
    for (const z of puzzle.grid.zones) options.push({ value: z.id, label: `${z.name} (stanza)` });
    for (const o of puzzle.grid.objects) {
      const def = objectIcon(o.typeId);
      options.push({ value: o.id, label: `${def?.label || "Oggetto"} (${o.row + 1},${o.col + 1})` });
    }
    // "Any door", "any shelf", etc. — one option per object type actually
    // present on the map, so the clue doesn't have to commit to one instance.
    const typesPresent = [...new Set(puzzle.grid.objects.map((o) => o.typeId))];
    for (const typeId of typesPresent) {
      const def = objectIcon(typeId);
      if (!def) continue;
      options.push({ value: objectTypeTargetId(typeId), label: `Qualsiasi ${def.label.toLowerCase()}` });
    }
  }
  return options;
}

// Seeds sensible defaults for enum/number params so what's shown in the
// control matches what's actually stored from the start — otherwise a clue
// whose dropdown/number field is never touched would keep an undefined param
// even though the control visually shows its first option/minimum value.
function defaultParams(typeId) {
  const params = {};
  for (const p of CLUE_TYPES[typeId]?.params || []) {
    if (p.kind === "enum") params[p.name] = p.values[0];
    if (p.kind === "number") params[p.name] = p.optional ? null : (p.min ?? 1);
    if (p.kind === "characterOrObjectMulti") params[p.name] = [];
  }
  return params;
}

// Renders one param control against a plain `currentParams` object, telling
// the caller about changes via `onSet(paramName, value)` instead of writing
// to a clue directly — so the exact same control can drive either a
// top-level clue's own params or a nested sub-clue's params (a `clueRef`
// param, or one of the `orClue` combinator's two branches — see
// `renderNestedClue`, which both go through).
function renderParamControl(paramDef, currentParams, puzzle, ownerId, onSet) {
  if (paramDef.kind === "enum") {
    const labels = paramDef.labels || {};
    const select = el(
      "select",
      { title: paramDef.label, onChange: (e) => onSet(paramDef.name, e.target.value) },
      paramDef.values.map((v) =>
        el("option", { value: v, selected: currentParams[paramDef.name] === v || undefined }, labels[v] ?? v)
      )
    );
    return labeledControl(paramDef.label, select);
  }
  if (paramDef.kind === "number") {
    const min = paramDef.min ?? 1;
    const current = currentParams[paramDef.name];
    const isUnset = current === undefined || current === null;
    // Committed on "change" (blur/enter), not every keystroke, so the field
    // doesn't lose focus mid-typing from the full re-render onChange triggers.
    const input = el("input", {
      type: "number",
      min: String(min),
      placeholder: paramDef.optional ? "qualsiasi" : undefined,
      value: isUnset ? (paramDef.optional ? "" : String(min)) : String(current),
      onChange: (e) => {
        const raw = e.target.value.trim();
        if (raw === "" && paramDef.optional) {
          onSet(paramDef.name, null);
        } else {
          const n = parseInt(raw, 10);
          onSet(paramDef.name, Number.isFinite(n) && n >= min ? n : min);
        }
      },
    });
    return labeledControl(paramDef.label, input);
  }
  if (paramDef.kind === "characterOrObjectMulti") {
    const options = targetOptions(puzzle, "characterOrObject", ownerId);
    const selected = new Set(currentParams[paramDef.name] || []);
    const select = el(
      "select",
      {
        multiple: true,
        title: paramDef.label,
        onChange: (e) => onSet(paramDef.name, [...e.target.selectedOptions].map((o) => o.value)),
      },
      options.map((o) => el("option", { value: o.value, selected: selected.has(o.value) || undefined }, o.label))
    );
    return labeledControl(paramDef.label, select);
  }
  if (paramDef.kind === "clueRef") {
    const picker = renderNestedClue(currentParams[paramDef.name], puzzle, ownerId, (spec) => onSet(paramDef.name, spec));
    return labeledControl(paramDef.label, picker);
  }
  const options = targetOptions(puzzle, paramDef.kind, ownerId);
  const select = el(
    "select",
    { title: paramDef.label, onChange: (e) => onSet(paramDef.name, e.target.value) },
    [el("option", { value: "" }, "-- scegli --"), ...options.map((o) =>
      el("option", { value: o.value, selected: currentParams[paramDef.name] === o.value || undefined }, o.label)
    )]
  );
  return labeledControl(paramDef.label, select);
}

// Wraps a control with its small caption label above it, so a clue with
// several parameters reads as a clean stack of "Field: control" pairs
// instead of a run of unlabeled dropdowns competing for the same line.
function labeledControl(label, control) {
  return el("div", { class: "clue-field" }, [el("span", { class: "clue-field-label" }, label), control]);
}

// Renders a picker for one nested clue spec ({type, params}) — a type select
// plus that type's own param controls — reporting the whole updated spec via
// onSetSpec. Shared by the `orClue` combinator's two branches and by any
// `clueRef`-kind param (e.g. "...who also satisfied: <condition>"). Nested
// types exclude other combinators (no "or of or") and stay character-scoped,
// since they're always evaluated against a specific person (the parent
// clue's owner, or — for a clueRef property filter — whichever character is
// being tested).
function renderNestedClue(spec, puzzle, ownerId, onSetSpec) {
  const current = spec || { type: "", params: {} };
  const subTypeIds = characterClueTypeIds().filter((id) => !CLUE_TYPES[id].combinator);
  const typeSelect = el(
    "select",
    {
      onChange: (e) => onSetSpec({ type: e.target.value, params: defaultParams(e.target.value) }),
    },
    [el("option", { value: "" }, "-- scegli indizio --"), ...subTypeIds.map((id) =>
      el("option", { value: id, selected: current.type === id || undefined }, CLUE_TYPES[id].label)
    )]
  );
  const subDef = CLUE_TYPES[current.type];
  const subControls = (subDef?.params || []).map((p) =>
    renderParamControl(p, current.params || {}, puzzle, ownerId, (name, value) =>
      onSetSpec({ ...current, params: { ...(current.params || {}), [name]: value } })
    )
  );
  return el("div", { class: "clue-nested" }, [typeSelect, ...subControls]);
}

function renderClueRow(clue, puzzle, ownerId, onChange) {
  const def = CLUE_TYPES[clue.type];

  const controlsArea = def?.combinator
    ? el("div", { class: "clue-branches" }, [
        el("div", { class: "clue-branch" }, [
          el("span", { class: "clue-branch-label" }, "Ramo A"),
          renderNestedClue(clue.params.a, puzzle, ownerId, (spec) => { updateClue(puzzle, clue.id, { a: spec }); onChange(); }),
        ]),
        el("div", { class: "clue-branch-joiner" }, "oppure"),
        el("div", { class: "clue-branch" }, [
          el("span", { class: "clue-branch-label" }, "Ramo B"),
          renderNestedClue(clue.params.b, puzzle, ownerId, (spec) => { updateClue(puzzle, clue.id, { b: spec }); onChange(); }),
        ]),
      ])
    : el(
        "div",
        { class: "clue-fields" },
        (def?.params || []).map((p) =>
          renderParamControl(p, clue.params, puzzle, ownerId, (name, value) => {
            updateClue(puzzle, clue.id, { [name]: value });
            onChange();
          })
        )
      );

  // Flips the clue to its negation instead of needing a mirror-image type for
  // every "not X" — see buildPredicate()/describeClue().
  const negateToggle = el("label", { class: "clue-negate", title: "Inverte l'indizio nel suo opposto" }, [
    el("input", {
      type: "checkbox",
      checked: clue.negate || undefined,
      onChange: (e) => { setClueNegate(puzzle, clue.id, e.target.checked); onChange(); },
    }),
    " no",
  ]);
  const removeBtn = el("button", {
    class: "clue-remove",
    title: "Rimuovi indizio",
    onClick: () => { removeClue(puzzle, clue.id); onChange(); },
  }, "×");

  const header = el("div", { class: "clue-card-header" }, [
    el("span", { class: "clue-text" }, describeClue(clue, puzzle)),
    el("div", { class: "clue-card-actions" }, [negateToggle, removeBtn]),
  ]);

  return el("div", { class: "clue-card" }, [header, controlsArea]);
}

function renderGenericCluesSection(puzzle, onChange) {
  const wrap = el("div", { class: "character-card" });
  wrap.appendChild(el("strong", {}, "🔎 Indizi generali del caso"));
  wrap.appendChild(el("p", { class: "muted" }, "Fatti sulla scena non legati a un personaggio specifico."));

  const clueList = el("div", { class: "clue-list" });
  for (const clue of genericClues(puzzle)) {
    clueList.appendChild(renderClueRow(clue, puzzle, null, onChange));
  }
  wrap.appendChild(clueList);

  const genericTypeIds = genericClueTypeIds();
  if (genericTypeIds.length === 0) return wrap;

  const typeSelect = el(
    "select",
    {},
    genericTypeIds.map((id) => el("option", { value: id }, CLUE_TYPES[id].label))
  );
  const addClueBtn = el("button", {
    onClick: () => {
      addClue(puzzle, null, typeSelect.value, defaultParams(typeSelect.value));
      onChange();
    },
  }, "+ Indizio generale");
  wrap.appendChild(el("div", { class: "field-row" }, [typeSelect, addClueBtn]));

  return wrap;
}

export function renderClueBuilder(container, puzzle, onChange) {
  clear(container);
  container.appendChild(el("h3", {}, "Indizi"));

  container.appendChild(renderGenericCluesSection(puzzle, onChange));

  if (puzzle.characters.length === 0) {
    container.appendChild(el("p", { class: "muted" }, "Aggiungi prima dei personaggi per aggiungere indizi a loro dedicati."));
    return;
  }

  const characterTypeIds = characterClueTypeIds();

  for (const character of puzzle.characters) {
    const wrap = el("div", { class: "character-card" });
    wrap.appendChild(el("strong", {}, character.name + (character.isVictim ? " (vittima)" : "")));

    const clueList = el("div", { class: "clue-list" });
    for (const clue of cluesForCharacter(puzzle, character.id)) {
      clueList.appendChild(renderClueRow(clue, puzzle, character.id, onChange));
    }
    wrap.appendChild(clueList);

    const typeSelect = el(
      "select",
      {},
      characterTypeIds.map((id) => el("option", { value: id }, CLUE_TYPES[id].label))
    );
    const addClueBtn = el("button", {
      onClick: () => {
        addClue(puzzle, character.id, typeSelect.value, defaultParams(typeSelect.value));
        onChange();
      },
    }, "+ Indizio");
    wrap.appendChild(el("div", { class: "field-row" }, [typeSelect, addClueBtn]));

    container.appendChild(wrap);
  }
}
