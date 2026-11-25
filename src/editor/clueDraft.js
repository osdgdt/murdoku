// The logic behind the clue wizard (clueWizard.js), kept free of the page so it can be tested:
// a clue being written (a "draft": { type, characterId, params, negate }), which of its
// parameters count, whether it is complete, how to turn it into another type, and what a tap
// on the board can mean as a target.
//
// Import order: clueTypes.js first (clues/shared.js and clueTypes.js import each other).
import { CLUE_TYPES, characterClueTypeIds, genericClueTypeIds } from "../model/clueTypes.js";
import {
  objectIcon,
  objectTypeTargetId,
  objectCategoryTargetId,
  OBJECT_CATEGORIES,
  OBJECT_TYPES,
  isEdgeObjectType,
  sideLabel,
} from "../model/icons.js";
import { edgeObjectsAt } from "../model/grid.js";
import { lowerLabel } from "../model/clues/shared.js";
import { hasRoles } from "../model/roles.js";
import { hasFloors, enumValuesFor } from "../model/sectors.js";
import { placeNameLabels, hasHiddenNames } from "../model/placeNames.js";
import { t } from "../i18n/i18n.js";

// Object types actually on the map: a clue about "a chair" must not be written when the
// map has none (it could never be true). `includeEdges: false` leaves out doors and windows
// (nobody stands or sits on them).
export function presentObjectTypes(puzzle, { includeEdges = true } = {}) {
  const types = [...new Set(puzzle.grid.objects.map((o) => o.typeId))];
  return includeEdges ? types : types.filter((id) => !isEdgeObjectType(id));
}

// The choices of an `objectTypeId` enum: the types allowed by the control that are on the map
// (all the allowed ones when the map has no objects yet, so the list is never empty).
export function objectTypeChoices(puzzle, paramDef) {
  const present = presentObjectTypes(puzzle, { includeEdges: false }).filter((id) => paramDef.values.includes(id));
  return present.length > 0 ? present : paramDef.values;
}

// The choices of a `roleId` parameter (marked `dynamic: "roles"`): the special ones the clue allows ("*" = any role), then
// the roles of the case, which come from the puzzle and not from the clue type.
export function roleChoices(puzzle, paramDef) {
  return [...paramDef.values, ...(puzzle.roles?.defs || []).map((d) => d.id)];
}

// The choices of a `placeName` parameter (marked `dynamic: "placeNames"`): the names still to be deduced.
export function placeNameChoices(puzzle) {
  return placeNameLabels(puzzle.grid);
}

// The choices of a `floorId` parameter (marked `dynamic: "floors"`): the floors of the case, the highest first.
export function floorChoices(puzzle) {
  return hasFloors(puzzle.grid) ? puzzle.grid.sectors.map((s) => s.id) : [];
}

// Sensible values for the enum/number parameters of a new clue, so what the form shows is what
// is stored: the first choice, the minimum, no distance.
export function defaultParams(typeId, puzzle) {
  const params = {};
  for (const p of CLUE_TYPES[typeId]?.params || []) {
    if (p.kind === "enum" && p.dynamic === "placeNames") params[p.name] = placeNameChoices(puzzle)[0] ?? "";
    else if (p.kind === "enum" && p.dynamic === "roles") params[p.name] = puzzle.roles?.defs?.[0]?.id ?? p.values[0];
    else if (p.kind === "enum" && p.dynamic === "floors") params[p.name] = floorChoices(puzzle)[0] ?? "";
    else if (p.kind === "enum") params[p.name] = p.name === "objectTypeId" ? (objectTypeChoices(puzzle, p)[0] ?? p.values[0]) : p.values[0];
    if (p.kind === "number") params[p.name] = p.optional ? null : (p.min ?? 1);
    if (p.kind === "characterOrObjectMulti") params[p.name] = [];
  }
  return params;
}

export function newDraft(typeId, characterId, puzzle) {
  return { type: typeId, characterId, params: defaultParams(typeId, puzzle), negate: false, text: "" };
}

export function draftFromClue(clue) {
  return {
    type: clue.type,
    characterId: clue.characterId,
    params: JSON.parse(JSON.stringify(clue.params || {})),
    negate: !!clue.negate,
    text: typeof clue.text === "string" ? clue.text : "",
  };
}

// The types a clue can have: those of a character, or the general ones.
// The clues about roles are only offered when the case has roles to talk about, those about the names of places when it
// has places whose name is to be deduced.
export function typeIdsFor(characterId, puzzle = null) {
  const ids = characterId ? characterClueTypeIds() : genericClueTypeIds();
  if (!puzzle) return ids;
  const about = (id, dynamic) => CLUE_TYPES[id].params.some((p) => p.dynamic === dynamic);
  const floors = hasFloors(puzzle.grid);
  return ids.filter(
    (id) =>
      (hasRoles(puzzle) || !about(id, "roles")) &&
      (hasHiddenNames(puzzle) || !about(id, "placeNames")) &&
      (floors || !CLUE_TYPES[id].floors)
  );
}

// A clue type built on the "property" family (see clues/shared.js propertyParams): which of its
// extra parameters matter depends on the property chosen.
function isPropertyType(def) {
  return (def.params || []).some((p) => p.name === "property");
}
const PROPERTY_PARAM = { targetId: "adjacentTo", objectTypeId: "sittingOn", customClue: "custom" };

// Whether a parameter is part of the clue as it stands (the target of "accanto a…" does not
// exist while the property is "un uomo").
export function paramIsRelevant(def, paramDef, params) {
  if (isPropertyType(def) && PROPERTY_PARAM[paramDef.name]) return params.property === PROPERTY_PARAM[paramDef.name];
  return true;
}

export function relevantParams(typeId, params) {
  const def = CLUE_TYPES[typeId];
  return (def?.params || []).filter((p) => paramIsRelevant(def, p, params || {}));
}

const isEmptyId = (v) => v === undefined || v === null || v === "";

// The parameters (their labels) a clue still lacks; nested clues are checked too.
export function missingParams(clueLike) {
  const def = CLUE_TYPES[clueLike.type];
  if (!def) return [t("Tipo di indizio")];
  const params = clueLike.params || {};
  if (def.combinator) {
    const out = [];
    for (const [key, label] of [
      ["a", t("Prima parte")],
      ["b", t("Seconda parte")],
    ]) {
      const spec = params[key];
      if (!spec?.type) out.push(label);
      else if (missingParams(spec).length > 0) out.push(label);
    }
    return out;
  }
  const missing = [];
  for (const p of relevantParams(clueLike.type, params)) {
    const v = params[p.name];
    if (p.kind === "clueRef") {
      if (!v?.type || missingParams(v).length > 0) missing.push(cleanParamLabel(p.label));
    } else if (p.kind === "characterOrObjectMulti") {
      if (!Array.isArray(v) || v.length === 0) missing.push(cleanParamLabel(p.label));
    } else if (p.kind === "character" || p.kind === "zone" || p.kind === "characterOrObject") {
      if (!p.optional && isEmptyId(v)) missing.push(cleanParamLabel(p.label));
    } else if (p.kind === "number") {
      if (!p.optional && !(Number.isFinite(v) && v >= (p.min ?? 1))) missing.push(cleanParamLabel(p.label));
    } else if (p.kind === "enum") {
      if (v === undefined || v === null) missing.push(cleanParamLabel(p.label));
    }
  }
  return missing;
}

export const isComplete = (clueLike) => missingParams(clueLike).length === 0;

// Parameter captions say "(se 'accanto a')" for the property family; the wizard only shows the
// parameters that count, so the condition is noise.
export function cleanParamLabel(label) {
  return String(label || "")
    .replace(/\s*\(se [^)]*\)/i, "")
    .replace(/\s*\(vuoto[^)]*\)/i, "")
    .trim();
}

// Two target parameters naming the same thing ("più vicino a Bruno che a Bruno") make a clue
// that can never hold: reported, and refused when saving.
const PAIRS = [
  ["targetAId", "targetBId"],
  ["targetId", "targetBId"],
];
export function hasDuplicateTargets(clueLike) {
  const params = clueLike.params || {};
  return PAIRS.some(([a, b]) => !isEmptyId(params[a]) && params[a] === params[b]);
}

// The parameters a clue keeps when it becomes another type: those with the same name and kind
// whose value is still valid (an enum choice the new type also offers); the rest get defaults.
export function convertParams(oldType, oldParams, newType, puzzle) {
  const next = defaultParams(newType, puzzle);
  const oldDef = CLUE_TYPES[oldType];
  const newDef = CLUE_TYPES[newType];
  for (const p of newDef?.params || []) {
    const before = (oldDef?.params || []).find((q) => q.name === p.name && q.kind === p.kind);
    if (!before || oldParams?.[p.name] === undefined) continue;
    const value = oldParams[p.name];
    if (p.kind === "enum" && !p.dynamic && !enumValuesFor(p, puzzle.grid).includes(value)) continue;
    if (p.dynamic === "roles" && !roleChoices(puzzle, p).includes(value)) continue;
    if (p.dynamic === "placeNames" && !placeNameChoices(puzzle).includes(value)) continue;
    if (p.dynamic === "floors" && !floorChoices(puzzle).includes(value)) continue;
    next[p.name] = JSON.parse(JSON.stringify(value));
  }
  return next;
}

// ---- targets on the board ---------------------------------------------------------------

// What a tap on cell (row, col) can mean as a clue target: the object on the cell, the doors and
// windows on its sides, and its room. `kinds`: "object" and/or "zone".
export function targetsAtCell(puzzle, row, col, kinds = ["object", "zone"]) {
  const out = [];
  const cell = puzzle.grid.cells[row]?.[col];
  if (!cell || cell.blocked) return out;
  if (kinds.includes("object")) {
    const wanted = cell.objectId ? puzzle.grid.objects.find((o) => o.id === cell.objectId) : null;
    if (wanted) out.push({ id: wanted.id, kind: "object", label: objectIcon(wanted.typeId)?.label || t("Oggetto") });
    for (const piece of edgeObjectsAt(puzzle.grid, row, col)) {
      out.push({ id: piece.id, kind: "object", label: objectIcon(piece.typeId)?.label || t("Oggetto") });
    }
  }
  if (kinds.includes("zone") && cell.zoneId) {
    const zone = puzzle.grid.zones.find((z) => z.id === cell.zoneId);
    if (zone) out.push({ id: zone.id, kind: "zone", label: t("Stanza {name}", { name: zone.name }) });
  }
  return out;
}

// The cells where a tap would pick something, for the highlight while choosing a target.
export function eligibleCells(puzzle, kinds = ["object", "zone"]) {
  const cells = [];
  puzzle.grid.cells.forEach((line, r) =>
    line.forEach((_, c) => {
      if (targetsAtCell(puzzle, r, c, kinds).length > 0) cells.push({ row: r, col: c });
    })
  );
  return cells;
}

// What the target-choosing control of a parameter offers, grouped: people, rooms, objects (each
// specific one, and "any chair" per type present).
export function targetChoices(puzzle, paramDef, ownerId) {
  const people = [];
  const rooms = [];
  const objects = [];
  const anyOfType = [];
  const kind = paramDef.kind;
  if (kind === "character" || kind === "characterOrObject") {
    for (const c of puzzle.characters) if (c.id !== ownerId) people.push({ id: c.id, label: c.name });
  }
  if (kind === "zone" || (kind === "characterOrObject" && !paramDef.noZone)) {
    for (const z of puzzle.grid.zones) rooms.push({ id: z.id, label: z.name, color: z.color });
  }
  if (kind === "characterOrObject") {
    for (const o of puzzle.grid.objects) {
      const label = objectIcon(o.typeId)?.label || t("Oggetto");
      const where = o.side
        ? t("{phrase} (R{row}, C{col}, lato {side})", { phrase: label, row: o.row + 1, col: o.col + 1, side: sideLabel(o.side) })
        : t("{phrase} (R{row}, C{col})", { phrase: label, row: o.row + 1, col: o.col + 1 });
      objects.push({ id: o.id, label: where, row: o.row, col: o.col });
    }
    for (const typeId of presentObjectTypes(puzzle)) {
      const def = objectIcon(typeId);
      if (def) anyOfType.push({ id: objectTypeTargetId(typeId), label: t("Qualsiasi {v}", { v: lowerLabel(def.label) }) });
    }
    // a whole category ("any animal") when the map has at least one object of it
    for (const category of OBJECT_CATEGORIES) {
      if (presentObjectTypes(puzzle).some((id) => OBJECT_TYPES[id]?.category === category))
        anyOfType.push({ id: objectCategoryTargetId(category), label: t("Qualsiasi animale") });
    }
  }
  return { people, rooms, objects, anyOfType };
}
