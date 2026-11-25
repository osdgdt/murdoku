// Clues that are TRUE in a given arrangement of the characters (the author's solution): every
// clue type x parameter combination, kept when its predicate holds. The editor offers them as
// "suggested clues" (one tap to add), and the library builder (tools/lib/author.mjs) draws
// its candidate clues from the same list.
//
// Import order: clueTypes.js first (clues/shared.js and clueTypes.js import each other).
import { CLUE_TYPES } from "../model/clueTypes.js";
import { objectTypeTargetId, objectCategoryTargetId, OBJECT_CATEGORIES, OBJECT_TYPES } from "../model/icons.js";
import { hasSeals, sealedCells } from "../model/grid.js";
import { buildPredicate } from "./predicates/index.js";
import { hasRoles } from "../model/roles.js";
import { withDeclared } from "../model/declared.js";
import { placeNameLabels, isNameHidden } from "../model/placeNames.js";
import { hasFloors, longestFloor, enumValuesFor } from "../model/sectors.js";

// orClue needs two sub-clues (not enumerable here); victimRoomRule is the built-in base rule.
const SKIP_TYPES = new Set(["orClue", "victimRoomRule", "sealRule", "roleRule"]);
// «North of all the cooks»: on a skyscraper directions only count inside one floor, so this is not offered there.
const NO_FLOORS_TYPES = new Set(["roleDirection"]);

// Every parameter combination of a clue type that makes sense on this map, for one owner.
export function enumerateParams(def, puzzle, ownerId) {
  const presentObjectTypes = [...new Set(puzzle.grid.objects.map((o) => o.typeId))];
  const targetsChar = puzzle.characters.filter((c) => c.id !== ownerId).map((c) => c.id);
  const targetsAny = [
    ...targetsChar,
    ...puzzle.grid.objects.map((o) => o.id),
    ...presentObjectTypes.map(objectTypeTargetId),
    ...OBJECT_CATEGORIES.filter((c) => presentObjectTypes.some((id) => OBJECT_TYPES[id]?.category === c)).map(objectCategoryTargetId),
    ...puzzle.grid.zones.map((z) => z.id),
  ];
  const maxIndex = Math.max(longestFloor(puzzle.grid), puzzle.grid.size.cols);
  const isProperty = def.params.some((p) => p.name === "property");
  const hasGender = puzzle.characters.some((c) => c.gender);

  function valuesFor(p, chosen) {
    if (p.name === "customClue") return [undefined];
    if (isProperty) {
      if (p.name === "property")
        return ["adjacentTo", "seated", "sittingOn", ...(hasGender ? ["male", "female"] : []), ...(p.values.includes("") ? [""] : [])];
      if (p.name === "targetId") return chosen.property === "adjacentTo" ? targetsAny : [undefined];
      if (p.name === "objectTypeId") return chosen.property === "sittingOn" ? presentObjectTypes : [undefined];
    }
    // The roles of the case ("*" too where the clue allows any role at all): none on a case without roles.
    // The names still to be deduced (none on a case without unknown places: no clue about them).
    if (p.dynamic === "placeNames") return placeNameLabels(puzzle.grid);
    if (p.dynamic === "roles") return hasRoles(puzzle) ? [...p.values, ...puzzle.roles.defs.map((d) => d.id)] : [];
    if (p.dynamic === "floors") return hasFloors(puzzle.grid) ? puzzle.grid.sectors.map((s) => s.id) : [];
    switch (p.kind) {
      case "characterOrObject":
        return p.noZone ? targetsAny.filter((id) => !puzzle.grid.zones.some((z) => z.id === id)) : targetsAny;
      case "character":
        return targetsChar;
      case "zone":
        // a room whose name is hidden has no words of its own to be named by («la stanza ???» would fit all of them)
        return puzzle.grid.zones.filter((z) => !isNameHidden(z)).map((z) => z.id);
      case "number":
        return [...Array.from({ length: maxIndex }, (_, i) => i + (p.min ?? 1)), ...(p.optional ? [undefined] : [])];
      case "enum":
        // Only the seals that are really on the map (none on a map without seals: no clue about them).
        if (p.name === "sealKind")
          return p.values.filter((k) => (k === "any" ? hasSeals(puzzle.grid) : sealedCells(puzzle.grid).some((s) => s.seal === k)));
        return enumValuesFor(p, puzzle.grid).filter((v) => v !== "" && v !== "custom");
      default:
        return null; // multi / clueRef: not enumerated
    }
  }

  const out = [];
  (function rec(i, chosen) {
    if (i === def.params.length) {
      out.push({ ...chosen });
      return;
    }
    const p = def.params[i];
    const values = valuesFor(p, chosen);
    if (values === null) return;
    for (const v of values) {
      const next = { ...chosen };
      if (v !== undefined) next[p.name] = v;
      rec(i + 1, next);
    }
  })(0, {});
  return out;
}

// The clues true under `placementMap` (Map: characterId -> { row, col }, every character placed).
//  - `ownerId`: only the clues of that character; `null` = only the general ones; omitted = all.
//  - `limit` / `maxEvaluations`: bounds, so a big grid does not freeze the page; `truncated` says
//    when one was hit.
// Result: { clues: [{ type, characterId, params, negate, generic }], truncated }.
export function suggestClues(puzzle, placementMap, { ownerId, limit = 3000, maxEvaluations = 200000 } = {}) {
  const seen = new Set();
  const clues = [];
  let evaluations = 0;
  let truncated = false;
  const view = withDeclared(puzzle); // the author's roles and place names, so that clues about them can be judged
  outer: for (const [type, def] of Object.entries(CLUE_TYPES)) {
    if (def.internal || SKIP_TYPES.has(type)) continue;
    // the clues about floors only on a skyscraper, and those that compare with everybody not there (only one floor can be compared)
    if (hasFloors(puzzle.grid) ? NO_FLOORS_TYPES.has(type) : def.floors) continue;
    const owners = def.scope === "generic" ? [null] : puzzle.characters.map((c) => c.id);
    for (const owner of owners) {
      if (ownerId !== undefined && owner !== ownerId) continue;
      for (const params of enumerateParams(def, puzzle, owner)) {
        for (const negate of [false, true]) {
          if (evaluations++ >= maxEvaluations || clues.length >= limit) {
            truncated = true;
            break outer;
          }
          const clue = { id: "x", type, characterId: owner, params, negate };
          let result;
          try {
            result = buildPredicate(clue, view)(placementMap, true);
          } catch {
            continue;
          }
          if (result !== true) continue;
          const key = JSON.stringify([owner, type, params, negate]);
          if (seen.has(key)) continue;
          seen.add(key);
          clues.push({ type, characterId: owner, params, negate, generic: def.scope === "generic" });
        }
      }
    }
  }
  return { clues, truncated };
}

// The solution a puzzle declares, as the placement map the predicates read; null unless every
// character is placed.
export function declaredPlacementMap(puzzle) {
  const placements = puzzle.solution?.placements || [];
  if (puzzle.characters.length === 0 || placements.length !== puzzle.characters.length) return null;
  const map = new Map(placements.map((p) => [p.characterId, { row: p.row, col: p.col }]));
  return puzzle.characters.every((c) => map.has(c.id)) ? map : null;
}
