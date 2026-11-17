// The clue wizard: how an author writes (or edits) a clue, on a PC and on a phone.
//
//  1. WHAT do you want to say? The clue types come grouped in plain-language families
//     (the same ones as the glossary), each with a one-line explanation, and a search box.
//  2. Complete the SENTENCE: the sentence being written is always on top, and each part of it
//     (a direction, a number, a target) is a control of its own. A target is chosen from short
//     lists (people, rooms, objects) or by TAPPING it on the board. Meanwhile the board shows
//     what the clue points at, and a mark says whether it is true in the author's solution.
//
// The clue lives in a DRAFT until it is complete, so the case never holds a half-written clue.
// The same two steps edit an existing clue (and "change type" goes back to step 1).
// A third panel offers SUGGESTED clues: all those true in the author's solution, one tap to add.
//
// Not part of the editor's page that is re-drawn on every change: the wizard is a panel of its
// own (a side drawer on a PC, a bottom sheet on a phone) that keeps its state between redraws.
import { el, clear } from "../util/dom.js";
import { CLUE_TYPES, describeClue } from "../model/clueTypes.js"; // first: clues/shared.js and clueTypes.js import each other
import { targetLabel } from "../model/clues/shared.js";
import { addClue, replaceClue } from "../model/puzzle.js";
import { FAMILIES, ENTRIES } from "../glossary/examples.js";
import { buildPredicate } from "../solver/predicates/index.js";
import { resolveClueHoverCells } from "../solver/hoverTargets.js";
import { declaredPlacementMap, suggestClues } from "../solver/suggestions.js";
import { composeCluesAsync } from "../solver/solverClient.js";
import { startProgress } from "../util/progressBanner.js";
import {
  newDraft,
  draftFromClue,
  typeIdsFor,
  relevantParams,
  missingParams,
  hasDuplicateTargets,
  convertParams,
  defaultParams,
  objectTypeChoices,
  cleanParamLabel,
  targetsAtCell,
  eligibleCells,
  targetChoices,
} from "./clueDraft.js";
import { t } from "../i18n/i18n.js";

let ctx = null; // { getPuzzle, onChange, boardEl }
let host = null; // the wizard's element
let session = null; // see openClueWizard
let pickHandler = null;

// ---------------------------------------------------------------------------- public API

// `getPuzzle()` must return the CURRENT puzzle (undo swaps it); `onChange()` is the editor's
// handleChange (it records an undo step and redraws); `boardEl` is the editor board.
export function setupClueWizard(options) {
  ctx = options;
}

// mode: "new" (a draft of a clue for `ownerId`, null = a general clue), "edit" (`clueId`).
export function openClueWizard({ ownerId = null, clueId = null } = {}) {
  const puzzle = ctx.getPuzzle();
  stopPicking();
  if (clueId) {
    const clue = puzzle.clues.find((c) => c.id === clueId);
    if (!clue) return;
    session = {
      mode: "edit",
      clueId,
      ownerId: clue.characterId,
      step: 2,
      draft: draftFromClue(clue),
      search: "",
      open: new Set(),
      notice: "",
    };
  } else {
    session = { mode: "new", clueId: null, ownerId, step: 1, draft: null, search: "", open: new Set(), notice: "" };
  }
  show();
}

export function openClueSuggestions({ ownerId = null } = {}) {
  stopPicking();
  session = {
    mode: "suggest",
    ownerId,
    step: 0,
    draft: null,
    search: "",
    open: new Set(),
    notice: "",
    showNegated: false,
    added: new Set(),
  };
  show();
}

// "Propose a set of clues": the generator panel (see renderGenerator).
export function openClueGenerator() {
  stopPicking();
  session = {
    mode: "generate",
    ownerId: null,
    step: 0,
    draft: null,
    search: "",
    open: new Set(),
    notice: "",
    gen: {
      level: "medium",
      victimFree: true,
      keepExisting: true,
      seed: 1 + Math.floor(Math.random() * 100000),
      running: false,
      result: null,
      selected: new Set(),
      controller: null,
    },
  };
  show();
}

export function closeClueWizard() {
  stopPicking();
  clearPreview();
  session = null;
  if (host) host.hidden = true;
  document.body.classList.remove("clue-wizard-open");
}

export function isClueWizardOpen() {
  return !!session;
}

// Called after every redraw of the editor: drops a session whose clue is gone (an undo), keeps
// the rest, and redraws the board marks the redraw erased.
export function refreshClueWizard() {
  if (!session || !ctx) return;
  const puzzle = ctx.getPuzzle();
  const ownerGone = session.ownerId && !puzzle.characters.some((c) => c.id === session.ownerId);
  const clueGone = session.mode === "edit" && !puzzle.clues.some((c) => c.id === session.clueId);
  if (ownerGone || clueGone) {
    closeClueWizard();
    return;
  }
  render();
}

// ---------------------------------------------------------------------------- the panel

function ensureHost() {
  if (host) return host;
  host = el("div", {
    id: "clue-wizard",
    class: "clue-wizard",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "clue-wizard-title",
  });
  host.hidden = true;
  document.body.appendChild(host);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !session) return;
    if (session.picking) stopPicking(true);
    else closeClueWizard();
  });
  return host;
}

function show() {
  ensureHost().hidden = false;
  document.body.classList.add("clue-wizard-open");
  render();
  host.querySelector("[data-key='close']")?.focus();
}

function render() {
  if (!session) return;
  const puzzle = ctx.getPuzzle();
  const focusKey = document.activeElement?.closest?.("#clue-wizard") ? document.activeElement.dataset?.key : null;
  const scroll = host.querySelector(".clue-wizard-body")?.scrollTop ?? 0;
  clear(host);
  host.classList.toggle("picking", !!session.picking);

  const owner = session.ownerId ? puzzle.characters.find((c) => c.id === session.ownerId) : null;
  const title =
    session.mode === "suggest"
      ? t("Indizi suggeriti")
      : session.mode === "generate"
        ? t("Proponi un set di indizi")
        : session.mode === "edit"
          ? t("Modifica indizio")
          : owner
            ? t("Nuovo indizio per {name}", { name: owner.name })
            : t("Nuovo indizio generale");
  host.appendChild(
    el("div", { class: "clue-wizard-header" }, [
      el("h2", { id: "clue-wizard-title" }, title),
      el(
        "button",
        { type: "button", class: "clue-wizard-close", "data-key": "close", "aria-label": t("Chiudi"), onClick: closeClueWizard },
        "✕"
      ),
    ])
  );

  if (session.picking) {
    renderPickBar(puzzle);
    updatePreview();
    return;
  }

  const body = el("div", { class: "clue-wizard-body" });
  const footer = el("div", { class: "clue-wizard-footer" });
  host.append(body, footer);
  if (session.mode === "suggest") renderSuggestions(body, footer, puzzle);
  else if (session.mode === "generate") renderGenerator(body, footer, puzzle);
  else if (session.step === 1) renderTypeStep(body, footer, puzzle);
  else renderSentenceStep(body, footer, puzzle);
  body.scrollTop = scroll;
  if (focusKey) host.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
  updatePreview();
}

// ---------------------------------------------------------------------------- small widgets

function chip(label, pressed, onClick, { key, title, extra = "" } = {}) {
  return el(
    "button",
    {
      type: "button",
      class: "clue-chip" + (extra ? ` ${extra}` : ""),
      "aria-pressed": pressed === null ? undefined : String(!!pressed),
      title,
      "data-key": key,
      onClick,
    },
    label
  );
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// ---------------------------------------------------------------------------- step 1: what to say

function typeCatalog() {
  const byType = {};
  for (const entry of ENTRIES) if (entry.type && !byType[entry.type]) byType[entry.type] = entry;
  return byType;
}

function firstSentence(text) {
  return String(text || "").split(/(?<=[.!?])\s+/)[0];
}

function renderTypeStep(body, footer, puzzle) {
  const catalog = typeCatalog();
  const allowed = new Set(typeIdsFor(session.ownerId));
  const search = el("input", {
    type: "search",
    class: "clue-search",
    "data-key": "search",
    placeholder: t("Cerca: accanto, stanza, angolo, nord…"),
    "aria-label": t("Cerca un tipo di indizio"),
    value: session.search,
  });
  const results = el("div", { class: "clue-types" });
  const change = session.mode === "edit";

  const card = (typeId) => {
    const entry = catalog[typeId];
    const def = CLUE_TYPES[typeId];
    return el(
      "button",
      {
        type: "button",
        class: "clue-type-card" + (change && session.draft?.type === typeId ? " current" : ""),
        "data-key": `type-${typeId}`,
        onClick: () => chooseType(typeId),
      },
      [el("strong", {}, def.label), entry ? el("span", { class: "clue-type-explain" }, firstSentence(entry.explain())) : null]
    );
  };

  const fill = () => {
    clear(results);
    const q = norm(session.search).split(/\s+/).filter(Boolean);
    const matches = (typeId) => {
      if (q.length === 0) return true;
      const entry = catalog[typeId];
      const hay = norm(`${CLUE_TYPES[typeId].label} ${entry ? entry.explain() : ""}`);
      return q.every((word) => hay.includes(word));
    };
    let shown = 0;
    for (const family of FAMILIES) {
      const ids = [...allowed].filter((id) => catalog[id]?.family === family.id && matches(id));
      if (ids.length === 0) continue;
      shown += ids.length;
      results.appendChild(
        el("section", { class: "clue-family" }, [
          el("h3", {}, family.title()),
          q.length === 0 ? el("p", { class: "muted" }, family.blurb()) : null,
          ...ids.map(card),
        ])
      );
    }
    // types without a glossary family (should not happen) are still reachable
    const rest = [...allowed].filter((id) => !catalog[id] && matches(id));
    for (const id of rest) (results.appendChild(card(id)), shown++);
    if (shown === 0) results.appendChild(el("p", { class: "muted" }, t("Nessun tipo di indizio corrisponde alla ricerca.")));
  };
  search.addEventListener("input", () => {
    session.search = search.value;
    fill();
  });
  fill();

  body.append(
    el(
      "p",
      { class: "muted" },
      change ? t("Che cosa vuoi dire ora? I dati compatibili restano.") : t("Che cosa vuoi dire con questo indizio?")
    ),
    search,
    results
  );
  footer.append(
    el(
      "button",
      { type: "button", onClick: () => (change ? ((session.step = 2), render()) : closeClueWizard()) },
      change ? t("← Indietro") : t("Annulla")
    )
  );
}

function chooseType(typeId) {
  const puzzle = ctx.getPuzzle();
  if (session.draft) {
    session.draft = {
      ...session.draft,
      type: typeId,
      params: convertParams(session.draft.type, session.draft.params, typeId, puzzle),
    };
  } else {
    session.draft = newDraft(typeId, session.ownerId, puzzle);
  }
  session.step = 2;
  session.open = new Set();
  render();
}

// ---------------------------------------------------------------------------- step 2: the sentence

// The spec at `path` of the draft: [] is the clue itself; ["customClue"], ["a"], ["b"] a nested one.
function specAt(path) {
  if (path.length === 0) return session.draft;
  return path.reduce((spec, key) => spec?.params?.[key], session.draft) ?? null;
}

function setSpecAt(path, spec) {
  if (path.length === 0) {
    session.draft = spec;
    return;
  }
  const parent = specAt(path.slice(0, -1));
  parent.params = { ...parent.params, [path[path.length - 1]]: spec };
}

function setParam(path, name, value) {
  const spec = specAt(path);
  spec.params = { ...spec.params, [name]: value };
  session.notice = "";
  render();
}

// True / false / undefined (not decidable: incomplete, or no declared solution).
function evaluateDraft(puzzle) {
  const pm = declaredPlacementMap(puzzle);
  if (!pm || missingParams(session.draft).length > 0) return undefined;
  try {
    const result = buildPredicate({ id: "draft", ...session.draft }, puzzle)(pm, true);
    return result === true ? true : result === false ? false : undefined;
  } catch {
    return undefined;
  }
}

function renderSentenceStep(body, footer, puzzle) {
  const draft = session.draft;
  const def = CLUE_TYPES[draft.type];
  const owner = draft.characterId ? puzzle.characters.find((c) => c.id === draft.characterId) : null;
  const sentence = describeClue(draft, puzzle);
  const missing = missingParams(draft);
  const verdict = evaluateDraft(puzzle);

  body.appendChild(
    el("div", { class: "clue-sentence-box" }, [
      el("p", { class: "clue-sentence", "aria-live": "polite" }, [owner ? el("strong", {}, `${owner.name}: `) : null, sentence]),
      el(
        "button",
        { type: "button", class: "clue-change-type", "data-key": "change-type", onClick: () => ((session.step = 1), render()) },
        [t("Tipo: {label}", { label: def?.label || "?" }), " ✎"]
      ),
    ])
  );

  // Is it true in the solution the author declared?
  const status = el("p", { class: "clue-verdict" });
  if (missing.length > 0) {
    status.className += " incomplete";
    status.textContent = t("Manca: {cosa}", { cosa: missing.join(", ") });
  } else if (hasDuplicateTargets(draft)) {
    status.className += " bad";
    status.textContent = t("Due parti dell'indizio indicano la stessa cosa: non può essere vero.");
  } else if (verdict === true) {
    status.className += " ok";
    status.textContent = t("✓ Vero nella tua soluzione");
  } else if (verdict === false) {
    status.className += " bad";
    status.textContent = t("✗ Falso nella tua soluzione: controlla la soluzione o l'indizio");
  } else {
    status.className += " muted";
    status.textContent = declaredPlacementMap(puzzle)
      ? t("Completa l'indizio per vedere se è vero nella tua soluzione.")
      : t("Completa la soluzione (scheda Soluzione) per vedere se l'indizio è vero.");
  }
  body.appendChild(status);

  body.appendChild(renderSlots(draft, [], puzzle));

  // The negation, in words: it flips the whole sentence.
  body.appendChild(
    el("div", { class: "clue-slot", role: "group", "aria-label": t("Come vale l'indizio") }, [
      el("span", { class: "clue-slot-label" }, t("Come vale l'indizio")),
      el("div", { class: "clue-chips" }, [
        chip(t("Così com'è"), !draft.negate, () => ((draft.negate = false), render()), { key: "negate-no" }),
        chip(t("Il contrario"), !!draft.negate, () => ((draft.negate = true), render()), {
          key: "negate-yes",
          title: t("Inverte l'indizio nel suo opposto"),
        }),
      ]),
    ])
  );

  if (session.notice) body.appendChild(el("p", { class: "violation", role: "alert" }, session.notice));

  const canSave = missing.length === 0 && !hasDuplicateTargets(draft);
  const editing = session.mode === "edit";
  footer.append(
    el("button", { type: "button", onClick: closeClueWizard }, t("Annulla")),
    editing
      ? null
      : el(
          "button",
          { type: "button", disabled: canSave ? undefined : true, "data-key": "add-another", onClick: () => save({ another: true }) },
          t("Aggiungi e scrivine un altro")
        ),
    el(
      "button",
      {
        type: "button",
        class: "primary",
        disabled: canSave ? undefined : true,
        "data-key": "save",
        onClick: () => save({ another: false }),
      },
      editing ? t("Salva") : t("Aggiungi indizio")
    )
  );
}

function save({ another }) {
  const puzzle = ctx.getPuzzle();
  const draft = session.draft;
  if (missingParams(draft).length > 0 || hasDuplicateTargets(draft)) return;
  if (session.mode === "edit") {
    replaceClue(puzzle, session.clueId, draft);
    closeClueWizard();
  } else {
    const clue = addClue(puzzle, draft.characterId, draft.type, JSON.parse(JSON.stringify(draft.params)));
    if (draft.negate) clue.negate = true;
    if (another) {
      session.step = 1;
      session.draft = null;
      session.search = "";
      session.notice = "";
    } else {
      closeClueWizard();
    }
  }
  ctx.onChange();
}

// One control per parameter that counts for the clue as it stands. `path` says which clue it is
// (the clue itself, or a nested one).
function renderSlots(spec, path, puzzle) {
  const wrap = el("div", { class: "clue-slots" });
  const def = CLUE_TYPES[spec.type];
  if (def?.combinator) {
    for (const [key, label] of [
      ["a", t("Prima parte")],
      ["b", t("Seconda parte")],
    ]) {
      wrap.appendChild(
        el("div", { class: "clue-slot nested" }, [
          el("span", { class: "clue-slot-label" }, label),
          renderNested(specAt([...path, key]), [...path, key], puzzle),
        ])
      );
    }
    return wrap;
  }
  for (const p of relevantParams(spec.type, spec.params)) {
    wrap.appendChild(
      el("div", { class: "clue-slot" }, [
        el("span", { class: "clue-slot-label" }, cleanParamLabel(p.label)),
        renderParamControl(p, spec, path, puzzle),
      ])
    );
  }
  return wrap;
}

// A nested clue: its type (a grouped list) and then its own parameters.
function renderNested(spec, path, puzzle) {
  const wrap = el("div", { class: "clue-nested" });
  const subTypeIds = typeIdsFor("character-scope").filter((id) => !CLUE_TYPES[id].combinator);
  const catalog = typeCatalog();
  const select = el(
    "select",
    {
      "aria-label": t("Tipo di indizio"),
      "data-key": `nested-type-${path.join(".")}`,
      onChange: (e) => {
        setSpecAt(path, e.target.value ? { type: e.target.value, params: defaultParams(e.target.value, puzzle) } : null);
        render();
      },
    },
    [
      el("option", { value: "" }, t("-- scegli indizio --")),
      ...FAMILIES.map((family) => {
        const ids = subTypeIds.filter((id) => catalog[id]?.family === family.id);
        return ids.length === 0
          ? null
          : el(
              "optgroup",
              { label: family.title() },
              ids.map((id) => el("option", { value: id, selected: spec?.type === id || undefined }, CLUE_TYPES[id].label))
            );
      }),
    ]
  );
  wrap.appendChild(select);
  if (spec?.type) {
    wrap.appendChild(el("p", { class: "clue-nested-sentence muted" }, describeClue({ ...spec, characterId: session.ownerId }, puzzle)));
    wrap.appendChild(renderSlots(spec, path, puzzle));
  }
  return wrap;
}

function renderParamControl(p, spec, path, puzzle) {
  const value = spec.params?.[p.name];
  const keyBase = `${path.join(".")}|${p.name}`;
  if (p.kind === "enum") {
    const labels = p.labels || {};
    const values = p.name === "objectTypeId" ? objectTypeChoices(puzzle, p) : p.values;
    // a long list (all the object types) is a menu, a short one chips
    if (values.length > 8) {
      return el(
        "select",
        { "aria-label": cleanParamLabel(p.label), "data-key": keyBase, onChange: (e) => setParam(path, p.name, e.target.value) },
        values.map((v) => el("option", { value: v, selected: value === v || undefined }, labels[v] ?? v))
      );
    }
    return el(
      "div",
      { class: "clue-chips" },
      values.map((v) => chip(labels[v] ?? v, value === v, () => setParam(path, p.name, v), { key: `${keyBase}|${v}` }))
    );
  }
  if (p.kind === "number") return renderNumber(p, value, (n) => setParam(path, p.name, n), keyBase);
  if (p.kind === "clueRef") return renderNested(value || null, [...path, p.name], puzzle);
  return renderTarget(p, spec, path, puzzle, keyBase);
}

function renderNumber(p, value, onSet, keyBase) {
  const min = p.min ?? 1;
  const isSet = Number.isFinite(value);
  const current = isSet ? value : min;
  const input = el("input", {
    type: "number",
    class: "clue-number",
    min: String(min),
    inputmode: "numeric",
    "aria-label": cleanParamLabel(p.label),
    "data-key": `${keyBase}|input`,
    placeholder: p.optional ? t("qualsiasi") : undefined,
    value: isSet ? String(value) : "",
    onChange: (e) => {
      const n = parseInt(e.target.value, 10);
      onSet(Number.isFinite(n) && n >= min ? n : p.optional && e.target.value.trim() === "" ? null : min);
    },
  });
  return el("div", { class: "clue-stepper" }, [
    el(
      "button",
      { type: "button", "aria-label": t("Diminuisci"), "data-key": `${keyBase}|minus`, onClick: () => onSet(Math.max(min, current - 1)) },
      "−"
    ),
    input,
    el(
      "button",
      { type: "button", "aria-label": t("Aumenta"), "data-key": `${keyBase}|plus`, onClick: () => onSet(isSet ? current + 1 : min) },
      "+"
    ),
    p.optional ? chip(t("qualsiasi"), !isSet, () => onSet(null), { key: `${keyBase}|any` }) : null,
  ]);
}

// ---------------------------------------------------------------------------- choosing a target

function targetName(puzzle, id) {
  return id ? targetLabel(puzzle, id) : "";
}

// A parameter that names something: a person, a room, an object, "any chair" — or several of them.
function renderTarget(p, spec, path, puzzle, keyBase) {
  const multi = p.kind === "characterOrObjectMulti";
  const value = spec.params?.[p.name];
  const picked = multi ? value || [] : value ? [value] : [];
  const openKey = keyBase;
  const isOpen = session.open.has(openKey) || (picked.length === 0 && !session.open.has(`${openKey}|closed`));
  const choices = targetChoices(puzzle, { ...p, kind: multi ? "characterOrObject" : p.kind }, spec.characterId ?? session.ownerId);
  const wrap = el("div", { class: "clue-target" });

  // what is chosen now
  wrap.appendChild(
    el(
      "button",
      {
        type: "button",
        class: "clue-target-current" + (picked.length === 0 ? " empty" : ""),
        "aria-expanded": String(isOpen),
        "data-key": `${keyBase}|current`,
        onClick: () => {
          if (isOpen) {
            session.open.delete(openKey);
            session.open.add(`${openKey}|closed`);
          } else {
            session.open.add(openKey);
            session.open.delete(`${openKey}|closed`);
          }
          render();
        },
      },
      picked.length === 0 ? t("Scegli…") : picked.map((id) => targetName(puzzle, id)).join(", ")
    )
  );
  if (!isOpen) return wrap;

  const select = (id) => {
    if (multi) {
      const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
      setParam(path, p.name, next);
    } else {
      session.open.delete(openKey);
      session.open.add(`${openKey}|closed`);
      setParam(path, p.name, id);
    }
  };
  const group = (title, items, kindClass) =>
    items.length === 0
      ? null
      : el("div", { class: "clue-target-group" }, [
          el("span", { class: "clue-group-title" }, title),
          el(
            "div",
            { class: "clue-chips" },
            items.map((item) =>
              chip(item.label, picked.includes(item.id), () => select(item.id), {
                key: `${keyBase}|${item.id}`,
                extra: kindClass,
              })
            )
          ),
        ]);

  // tap it on the board (rooms and objects; people are listed)
  const kinds = p.kind === "zone" ? ["zone"] : p.kind === "character" ? [] : p.noZone ? ["object"] : ["object", "zone"];
  if (kinds.length > 0 && eligibleCells(puzzle, kinds).length > 0) {
    wrap.appendChild(
      el(
        "button",
        {
          type: "button",
          class: "clue-pick-btn",
          "data-key": `${keyBase}|pick`,
          onClick: () => startPicking({ path, name: p.name, kinds, multi }),
        },
        t("👆 Tocca sulla plancia")
      )
    );
  }
  wrap.append(
    group(t("Persone"), choices.people),
    group(t("Stanze"), choices.rooms, "room"),
    group(t("Qualsiasi oggetto di un tipo"), choices.anyOfType),
    group(t("Oggetti sulla mappa"), choices.objects)
  );
  if (!choices.people.length && !choices.rooms.length && !choices.objects.length && !choices.anyOfType.length) {
    wrap.appendChild(el("p", { class: "muted" }, t("Non c'è ancora niente da scegliere: aggiungi personaggi, stanze od oggetti.")));
  }
  return wrap;
}

// ---------------------------------------------------------------------------- tapping on the board

function startPicking({ path, name, kinds, multi }) {
  const puzzle = ctx.getPuzzle();
  session.picking = { path, name, kinds, multi, choose: null, message: "" };
  ctx.boardEl.scrollIntoView({ block: "start", behavior: "smooth" });
  markEligible(eligibleCells(puzzle, kinds));
  pickHandler = (e) => {
    const cellNode = e.target.closest?.(".board-cell");
    if (!cellNode || !session?.picking) return;
    e.preventDefault();
    e.stopPropagation();
    const found = targetsAtCell(ctx.getPuzzle(), Number(cellNode.dataset.row), Number(cellNode.dataset.col), session.picking.kinds);
    if (found.length === 0) {
      session.picking.message = t("Qui non c'è niente da scegliere: tocca un oggetto o una stanza.");
      session.picking.choose = null;
    } else if (found.length === 1) {
      applyPick(found[0].id);
      return;
    } else {
      session.picking.message = "";
      session.picking.choose = found;
    }
    render();
  };
  ctx.boardEl.addEventListener("click", pickHandler, true);
  render();
}

function applyPick(id) {
  const { path, name, multi } = session.picking;
  const spec = specAt(path);
  const before = spec.params?.[name];
  const value = multi ? (Array.isArray(before) && before.includes(id) ? before.filter((x) => x !== id) : [...(before || []), id]) : id;
  stopPicking();
  session.open.add(`${path.join(".")}|${name}`);
  setParam(path, name, value);
}

function stopPicking(redraw = false) {
  if (pickHandler && ctx) ctx.boardEl.removeEventListener("click", pickHandler, true);
  pickHandler = null;
  ctx?.boardEl.querySelectorAll(".clue-pick-eligible").forEach((n) => n.classList.remove("clue-pick-eligible"));
  if (session?.picking) {
    session.picking = null;
    if (redraw) render();
  }
}

function markEligible(cells) {
  for (const { row, col } of cells)
    ctx.boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.classList.add("clue-pick-eligible");
}

function renderPickBar(puzzle) {
  const pick = session.picking;
  const bar = el("div", { class: "clue-pick-bar" }, [
    el("p", { class: "clue-pick-text" }, pick.message || t("Tocca sulla plancia l'oggetto o la stanza che vuoi scegliere.")),
  ]);
  if (pick.choose) {
    bar.appendChild(el("p", { class: "muted" }, t("Cosa intendi?")));
    bar.appendChild(
      el(
        "div",
        { class: "clue-chips" },
        pick.choose.map((item) => chip(item.label, null, () => applyPick(item.id), { key: `choose-${item.id}` }))
      )
    );
  }
  bar.appendChild(el("button", { type: "button", "data-key": "pick-cancel", onClick: () => stopPicking(true) }, t("Annulla")));
  host.appendChild(bar);
  // the marks survive the redraw of the panel (the board itself is not redrawn)
  markEligible(eligibleCells(puzzle, pick.kinds));
}

// ---------------------------------------------------------------------------- preview on the board

function clearPreview() {
  ctx?.boardEl
    ?.querySelectorAll(".clue-preview-target, .clue-preview-owner")
    .forEach((n) => n.classList.remove("clue-preview-target", "clue-preview-owner"));
}

// The cells the clue being written points at, and the owner's cell in the declared solution.
function updatePreview() {
  clearPreview();
  if (!session?.draft || session.mode === "suggest" || session.mode === "generate") return;
  const puzzle = ctx.getPuzzle();
  const pm =
    declaredPlacementMap(puzzle) ||
    new Map((puzzle.solution?.placements || []).map((pl) => [pl.characterId, { row: pl.row, col: pl.col }]));
  let cells = [];
  try {
    cells = resolveClueHoverCells({ id: "draft", ...session.draft }, puzzle, pm);
  } catch {
    cells = [];
  }
  for (const { row, col } of cells)
    ctx.boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.classList.add("clue-preview-target");
  const own = session.draft.characterId ? pm.get(session.draft.characterId) : null;
  if (own) ctx.boardEl.querySelector(`[data-row="${own.row}"][data-col="${own.col}"]`)?.classList.add("clue-preview-owner");
}

// ---------------------------------------------------------------------------- suggested clues

function renderSuggestions(body, footer, puzzle) {
  const pm = declaredPlacementMap(puzzle);
  const ownerSelect = el(
    "select",
    {
      "aria-label": t("Per chi"),
      "data-key": "suggest-owner",
      onChange: (e) => {
        session.ownerId = e.target.value || null;
        session.open = new Set();
        render();
      },
    },
    [
      el("option", { value: "" }, t("Indizi generali")),
      ...puzzle.characters.map((c) => el("option", { value: c.id, selected: session.ownerId === c.id || undefined }, c.name)),
    ]
  );
  body.appendChild(
    el(
      "button",
      { type: "button", class: "clue-generate-link", "data-key": "to-generator", onClick: () => openClueGenerator() },
      t("✨ Proponi un set completo di indizi")
    )
  );
  body.appendChild(el("label", { class: "clue-slot" }, [el("span", { class: "clue-slot-label" }, t("Per chi")), ownerSelect]));
  if (!pm) {
    body.appendChild(
      el(
        "p",
        { class: "muted" },
        t(
          "Servono tutti i personaggi piazzati nella soluzione (scheda Soluzione): i suggerimenti sono gli indizi veri in quella soluzione."
        )
      )
    );
    footer.append(el("button", { type: "button", onClick: closeClueWizard }, t("Chiudi")));
    return;
  }
  body.appendChild(
    el("label", { class: "clue-check" }, [
      el("input", {
        type: "checkbox",
        checked: session.showNegated || undefined,
        onChange: (e) => {
          session.showNegated = e.target.checked;
          render();
        },
      }),
      " ",
      t("Mostra anche gli indizi che dicono il contrario"),
    ])
  );
  const { clues, truncated } = suggestClues(puzzle, pm, { ownerId: session.ownerId });
  const present = new Set(puzzle.clues.map((c) => JSON.stringify([c.characterId, c.type, c.params, !!c.negate])));
  const usable = clues.filter(
    (c) => (session.showNegated || !c.negate) && !present.has(JSON.stringify([c.characterId, c.type, c.params, c.negate]))
  );
  const byType = new Map();
  for (const c of usable) {
    if (!byType.has(c.type)) byType.set(c.type, []);
    byType.get(c.type).push(c);
  }
  if (usable.length === 0)
    body.appendChild(el("p", { class: "muted" }, t("Nessun indizio suggerito (hai già aggiunto tutti quelli possibili?).")));
  for (const [type, list] of byType) {
    const key = `type-${type}`;
    const open = session.open.has(key);
    const details = el("details", { class: "clue-suggest-type", open: open || undefined });
    details.addEventListener("toggle", () => (details.open ? session.open.add(key) : session.open.delete(key)));
    details.appendChild(el("summary", {}, [CLUE_TYPES[type].label, el("span", { class: "muted" }, ` (${list.length})`)]));
    const more = session.open.has(`${key}|all`);
    for (const c of list.slice(0, more ? list.length : 25)) {
      details.appendChild(
        el("div", { class: "clue-suggest-item" }, [
          el("span", {}, describeClue({ ...c, id: "s" }, puzzle)),
          el(
            "button",
            {
              type: "button",
              class: "clue-add",
              "aria-label": t("Aggiungi: {clue}", { clue: describeClue({ ...c, id: "s" }, puzzle) }),
              onClick: () => {
                const clue = addClue(puzzle, c.characterId, c.type, JSON.parse(JSON.stringify(c.params)));
                if (c.negate) clue.negate = true;
                session.open.add(key);
                ctx.onChange();
              },
            },
            "+"
          ),
        ])
      );
    }
    if (list.length > 25 && !more) {
      details.appendChild(
        el(
          "button",
          { type: "button", onClick: () => (session.open.add(`${key}|all`), session.open.add(key), render()) },
          t("Mostra tutti ({n})", { n: list.length })
        )
      );
    }
    body.appendChild(details);
  }
  if (truncated) body.appendChild(el("p", { class: "muted" }, t("Elenco parziale: ci sono troppi indizi possibili.")));
  footer.append(el("button", { type: "button", onClick: closeClueWizard }, t("Chiudi")));
}

// ---------------------------------------------------------------------------- propose a whole set

const LEVELS = [
  ["easy", () => t("Facile")],
  ["medium", () => t("Medio")],
  ["hard", () => t("Difficile")],
];

function failureText(reason) {
  switch (reason) {
    case "no-solution":
      return t("Servono tutti i personaggi piazzati nella soluzione (scheda Soluzione).");
    case "time":
      return t("Il tempo a disposizione è finito prima di trovare un set. Riprova, o scegli un livello più facile.");
    case "limit":
      return t("Ho trovato un set ma non sono riuscito a verificare l'unicità entro il limite di ricerca.");
    case "not-unique":
      return t("I set provati lasciavano più di una soluzione. Riprova (un'altra estrazione) o aggiungi qualche indizio a mano.");
    default:
      return t("Non sono riuscito a comporre un set con questo livello. Prova un altro livello o un'altra estrazione.");
  }
}

// Proposes a set of clues that makes the declared solution the only one (composer.js, on a worker of its own);
// the author ticks the ones to keep and adds them in one step.
function renderGenerator(body, footer, puzzle) {
  const gen = session.gen;
  if (!declaredPlacementMap(puzzle)) {
    body.appendChild(el("p", { class: "muted" }, failureText("no-solution")));
    footer.append(el("button", { type: "button", onClick: closeClueWizard }, t("Chiudi")));
    return;
  }
  body.appendChild(
    el("p", { class: "muted" }, t("Propongo indizi veri nella tua soluzione che la rendono l'unica. Tu scegli quali tenere."))
  );
  body.appendChild(
    el("div", { class: "clue-slot", role: "group", "aria-label": t("Livello") }, [
      el("span", { class: "clue-slot-label" }, t("Livello")),
      el(
        "div",
        { class: "clue-chips" },
        LEVELS.map(([id, label]) =>
          chip(label(), gen.level === id, () => ((gen.level = id), (gen.result = null), render()), { key: `level-${id}` })
        )
      ),
    ])
  );
  const check = (key, label, prop) =>
    el("label", { class: "clue-check" }, [
      el("input", {
        type: "checkbox",
        "data-key": key,
        checked: gen[prop] || undefined,
        onChange: (e) => {
          gen[prop] = e.target.checked;
          gen.result = null;
          render();
        },
      }),
      " ",
      label,
    ]);
  body.appendChild(check("gen-victim", t("Nessun indizio sulla vittima (consigliato)"), "victimFree"));
  body.appendChild(check("gen-keep", t("Parti dagli indizi che ho già"), "keepExisting"));

  if (gen.running) {
    body.appendChild(gen.progress.node); // the same banner on every render: its clock and bar keep going
  } else {
    body.appendChild(
      el(
        "button",
        { type: "button", class: "primary clue-generate-btn", "data-key": "generate", onClick: () => runGenerator(gen) },
        gen.result ? t("Rigenera (un'altra estrazione)") : t("Genera")
      )
    );
  }

  const result = gen.result;
  if (result && !gen.running) {
    if (result.status !== "ok") {
      body.appendChild(el("p", { class: "violation", role: "alert" }, failureText(result.reason)));
    } else if (result.clues.length === 0) {
      body.appendChild(el("p", { class: "ok-message" }, t("Il caso ha già una soluzione unica: non serve aggiungere indizi.")));
    } else {
      body.appendChild(
        el(
          "p",
          { class: "ok-message", "aria-live": "polite" },
          t("✓ {count} indizi: con questi la soluzione è unica.", { count: result.clues.length })
        )
      );
      body.appendChild(
        el(
          "ul",
          { class: "clue-gen-list" },
          result.clues.map((clue, i) => {
            const owner = clue.characterId ? puzzle.characters.find((c) => c.id === clue.characterId)?.name : t("Generale");
            return el("li", {}, [
              el("label", {}, [
                el("input", {
                  type: "checkbox",
                  "data-key": `gen-pick-${i}`,
                  checked: gen.selected.has(i) || undefined,
                  onChange: (e) => {
                    if (e.target.checked) gen.selected.add(i);
                    else gen.selected.delete(i);
                    render();
                  },
                }),
                " ",
                `${owner}: ${describeClue({ id: "g", ...clue }, puzzle)}`,
              ]),
            ]);
          })
        )
      );
      if (gen.selected.size < result.clues.length) {
        body.appendChild(
          el(
            "p",
            { class: "muted" },
            t("Senza tutti gli indizi la soluzione potrebbe non essere più unica: guarda la riga della difficoltà dopo averli aggiunti.")
          )
        );
      }
    }
  }
  footer.append(
    el("button", { type: "button", onClick: closeClueWizard }, t("Chiudi")),
    result?.status === "ok" && result.clues.length > 0
      ? el(
          "button",
          {
            type: "button",
            class: "primary",
            "data-key": "gen-add",
            disabled: gen.selected.size === 0 || undefined,
            onClick: () => {
              const target = ctx.getPuzzle();
              for (const i of [...gen.selected].sort((a, b) => a - b)) {
                const c = result.clues[i];
                const clue = addClue(target, c.characterId, c.type, JSON.parse(JSON.stringify(c.params)));
                if (c.negate) clue.negate = true;
              }
              closeClueWizard();
              ctx.onChange(); // one undo step for the whole set
            },
          },
          t("Aggiungi i selezionati")
        )
      : null
  );
}

async function runGenerator(gen) {
  const puzzle = ctx.getPuzzle();
  gen.running = true;
  gen.result = null;
  gen.controller = new AbortController();
  const controller = gen.controller;
  // no limit: it ends when it has a set or has run out of attempts, and the person can cancel (progress bar and Cancel)
  gen.progress = startProgress({
    label: t("Sto componendo un set di indizi…"),
    onCancel: () => controller.abort(),
    className: "result-banner hint-info",
  });
  const mine = session;
  render();
  try {
    const result = await composeCluesAsync(
      puzzle,
      {
        mode: gen.level,
        seed: gen.seed,
        victimFree: gen.victimFree,
        keepExisting: gen.keepExisting,
        maxNodes: Infinity,
        timeMs: null,
      },
      { signal: controller.signal, onProgress: gen.progress.update }
    );
    gen.seed += 1; // the next press draws a different set
    gen.result = result;
    gen.selected = new Set(result.status === "ok" ? result.clues.map((_, i) => i) : []);
  } catch (err) {
    gen.result = err?.name === "AbortError" ? null : { status: "failed", reason: "error" };
  } finally {
    gen.progress?.stop();
    gen.progress = null;
    gen.running = false;
    gen.controller = null;
    if (session === mine) render();
  }
}
