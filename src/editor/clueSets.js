// A set of clues that can be taken out of one case and put into another ("export clues" / "import clues").
//
// A clue refers to the case it was written for by ids (a character, a room, a piece of furniture), and those
// mean nothing elsewhere. So the file stores NAMES instead: a character as its name, a room as its name,
// a piece of furniture as its type and place; "any chair" (`objtype:chair`) is portable as it is. On import
// the names are matched to the destination case (same name, case-insensitive), the author can correct the
// matches, and clues that cannot be placed are listed with the reason, never added silently or half.
//
// Pure (no page): `exportClueSet`, `parseClueSet`, `planImport`, `applyImport`.
import { CLUE_TYPES } from "../model/clueTypes.js"; // first: clues/shared.js and clueTypes.js import each other
import { addClue } from "../model/puzzle.js";
import { customClueText } from "../model/clueText.js";
import { mapClueRefs } from "../model/clueRefs.js";
import { isObjectTypeTarget } from "../model/icons.js";
import { missingParams } from "./clueDraft.js";
import { t } from "../i18n/i18n.js";

export const CLUE_SET_FORMAT = "murdoku-clues";
export const CLUE_SET_VERSION = 1;
export const MAX_CLUES_IN_SET = 500;

// JSON with the keys in a fixed order, so two clues that say the same thing compare equal.
const stable = (value) =>
  JSON.stringify(value, (key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  );

const norm = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

// ---- export ------------------------------------------------------------------------

// The clues with `clueIds` (all, when null) as a portable set.
export function exportClueSet(puzzle, clueIds = null) {
  const wanted = clueIds ? new Set(clueIds) : null;
  const clues = puzzle.clues.filter((c) => !wanted || wanted.has(c.id));
  const characters = new Map(); // id -> { name, gender }
  const zones = new Map(); // id -> { name }
  const objects = new Map(); // id -> index in `objectList`
  const objectList = [];

  const token = (id) => {
    if (isObjectTypeTarget(id)) return id;
    const character = puzzle.characters.find((c) => c.id === id);
    if (character) {
      characters.set(id, { name: character.name, gender: character.gender ?? null, isVictim: !!character.isVictim });
      return { $char: character.name };
    }
    const zone = puzzle.grid.zones.find((z) => z.id === id);
    if (zone) {
      zones.set(id, { name: zone.name });
      return { $zone: zone.name };
    }
    const object = puzzle.grid.objects.find((o) => o.id === id);
    if (object) {
      if (!objects.has(id)) {
        objects.set(id, objectList.length);
        objectList.push({ typeId: object.typeId, row: object.row, col: object.col, ...(object.side ? { side: object.side } : {}) });
      }
      return { $obj: objects.get(id) };
    }
    return { $unknown: String(id) }; // cannot happen after pruning; kept so the import reports it
  };

  const out = clues.map((clue) => ({
    owner: clue.characterId ? token(clue.characterId) : null,
    type: clue.type,
    params: JSON.parse(JSON.stringify(mapClueRefs(clue.params, token))),
    ...(clue.negate ? { negate: true } : {}),
    ...(customClueText(clue) ? { text: customClueText(clue) } : {}),
  }));
  return {
    format: CLUE_SET_FORMAT,
    version: CLUE_SET_VERSION,
    grid: { rows: puzzle.grid.size.rows, cols: puzzle.grid.size.cols },
    characters: [...characters.values()],
    zones: [...zones.values()],
    objects: objectList,
    clues: out,
  };
}

// ---- reading a file -------------------------------------------------------------------

// Checks the shape of a parsed file; returns { ok: true, set } or { ok: false, error }.
export function parseClueSet(data) {
  if (!data || typeof data !== "object" || data.format !== CLUE_SET_FORMAT) return { ok: false, error: "not-a-clue-set" };
  if (data.version !== CLUE_SET_VERSION) return { ok: false, error: "unsupported-version" };
  if (!Array.isArray(data.clues) || data.clues.length === 0) return { ok: false, error: "empty" };
  if (data.clues.length > MAX_CLUES_IN_SET) return { ok: false, error: "too-many" };
  for (const clue of data.clues) {
    if (!clue || typeof clue.type !== "string" || typeof clue.params !== "object" || clue.params === null)
      return { ok: false, error: "bad-clue" };
  }
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    ok: true,
    set: {
      grid: data.grid && typeof data.grid === "object" ? data.grid : null,
      characters: list(data.characters).filter((c) => c && typeof c.name === "string"),
      zones: list(data.zones).filter((z) => z && typeof z.name === "string"),
      objects: list(data.objects).filter((o) => o && typeof o.typeId === "string"),
      clues: data.clues,
    },
  };
}

// ---- import: matching names to the destination case -------------------------------------

// Proposes, for everything the set refers to, the thing in `puzzle` it most likely means (or null):
//   { characters: { name -> id|null }, zones: { name -> id|null }, objects: { index -> id|null } }
export function planImport(puzzle, set) {
  const byName = (list) => new Map(list.map((x) => [norm(x.name), x.id]));
  const characterByName = byName(puzzle.characters);
  const zoneByName = byName(puzzle.grid.zones);
  const plan = { characters: {}, zones: {}, objects: {} };
  for (const c of set.characters) plan.characters[c.name] = characterByName.get(norm(c.name)) ?? null;
  for (const z of set.zones) plan.zones[z.name] = zoneByName.get(norm(z.name)) ?? null;
  set.objects.forEach((o, index) => {
    const same = puzzle.grid.objects.find(
      (x) => x.typeId === o.typeId && x.row === o.row && x.col === o.col && (x.side || null) === (o.side || null)
    );
    plan.objects[index] = same ? same.id : null;
  });
  return plan;
}

// ---- import: putting the clues in ---------------------------------------------------------

const REASONS = {
  unknownType: () => t("tipo di indizio sconosciuto"),
  scope: () => t("il tipo non va bene per questo titolare"),
  unmapped: () => t("personaggio, stanza od oggetto non collegato"),
  outOfGrid: () => t("riga o colonna fuori dalla griglia"),
  incomplete: () => t("indizio incompleto"),
  duplicate: () => t("già presente"),
};
export const importReasonText = (reason) => REASONS[reason]?.() ?? reason;

// Adds the clues of `set` to `puzzle`, resolving their names with `mapping` (shaped like planImport's result,
// possibly corrected by the author). Returns { added: [clue], skipped: [{ index, type, owner, reason }] }:
// every clue of the set is either added whole or skipped with its reason.
export function applyImport(puzzle, set, mapping) {
  const { rows, cols } = puzzle.grid.size;
  const existing = new Set(puzzle.clues.map((c) => stable([c.characterId, c.type, c.params, !!c.negate])));
  const added = [];
  const skipped = [];

  // A name, a type+place or an `objtype:` from the file -> an id of this case, or null when it has no match.
  const resolve = (value) => {
    if (typeof value === "string") return isObjectTypeTarget(value) ? value : null;
    if (value && typeof value === "object") {
      if ("$char" in value) return mapping.characters?.[value.$char] ?? null;
      if ("$zone" in value) return mapping.zones?.[value.$zone] ?? null;
      if ("$obj" in value) return mapping.objects?.[value.$obj] ?? null;
    }
    return null;
  };
  // Whether every id in the (already resolved) params is set: mapClueRefs on the raw ones tells which failed.
  const unresolved = (params) => {
    let failed = false;
    const resolved = mapClueRefs(params, (value) => {
      const id = resolve(value);
      if (id === null) failed = true;
      return id;
    });
    return { failed, resolved };
  };

  set.clues.forEach((raw, index) => {
    const label = { index, type: raw.type, owner: raw.owner && typeof raw.owner === "object" ? (raw.owner.$char ?? null) : null };
    const def = CLUE_TYPES[raw.type];
    if (!def || def.internal) return skipped.push({ ...label, reason: "unknownType" });
    const generic = def.scope === "generic";
    let ownerId = null;
    if (raw.owner) {
      ownerId = resolve(raw.owner);
      if (ownerId === null) return skipped.push({ ...label, reason: "unmapped" });
    }
    if (generic !== (raw.owner === null || raw.owner === undefined)) return skipped.push({ ...label, reason: "scope" });
    const { failed, resolved } = unresolved(raw.params);
    if (failed) return skipped.push({ ...label, reason: "unmapped" });
    if (resolved.index !== undefined && Number.isFinite(resolved.index) && resolved.index > (resolved.axis === "row" ? rows : cols)) {
      return skipped.push({ ...label, reason: "outOfGrid" });
    }
    if (missingParams({ type: raw.type, params: resolved }).length > 0) return skipped.push({ ...label, reason: "incomplete" });
    const key = stable([ownerId, raw.type, resolved, !!raw.negate]);
    if (existing.has(key)) return skipped.push({ ...label, reason: "duplicate" });
    existing.add(key);
    const clue = addClue(puzzle, ownerId, raw.type, resolved);
    if (raw.negate) clue.negate = true;
    if (customClueText(raw)) clue.text = customClueText(raw);
    added.push(clue);
  });
  return { added, skipped };
}
