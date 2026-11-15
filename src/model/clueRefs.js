// The ids a clue's parameters point at (characters, rooms, objects), found by walking the parameters —
// including the nested clues of "either/or" and of the "who also satisfied…" condition, and the lists of
// targets. Pure and independent of the clue registry (it goes by the parameters' names), so the model can
// use it without pulling in the clue types.
//
// Which parameters name something: targetId, targetAId, targetBId, zoneId (one id), targetIds (a list),
// and the nested clues a, b (either/or) and customClue. Of the property family, only the parameter that
// matches the chosen property counts (the target of "accanto a…" is not part of "un uomo").
const SINGLE = ["targetId", "targetAId", "targetBId", "zoneId"];
const LIST = ["targetIds"];

const isSet = (v) => v !== undefined && v !== null && v !== "";

// Whether `key` is part of the clue as it stands (see above).
function counts(params, key) {
  if (key === "targetId" && "property" in params) return params.property === "adjacentTo";
  if (key === "customClue") return params.property === "custom";
  return true;
}

// A copy of `params` with every id replaced by `fn(id)`; `fn` may return anything (a token, an id, null).
// Nested clues are copied with their own parameters mapped; parameters that do not count are left as they are.
export function mapClueRefs(params, fn) {
  const out = { ...(params || {}) };
  for (const key of SINGLE) if (isSet(out[key]) && counts(out, key)) out[key] = fn(out[key], key);
  for (const key of LIST) if (Array.isArray(out[key])) out[key] = out[key].map((id) => fn(id, key));
  for (const key of ["a", "b", "customClue"]) {
    const nested = out[key];
    if (nested && typeof nested === "object" && counts(out, key)) out[key] = { ...nested, params: mapClueRefs(nested.params, fn) };
  }
  return out;
}

// Every id the parameters name (with repeats), nested ones included.
export function collectClueRefs(params) {
  const ids = [];
  mapClueRefs(params, (id) => {
    ids.push(id);
    return id;
  });
  return ids;
}

// Removes from `params` (in place, nested too) the ids `isKnown` rejects out of target LISTS, and reports
// whether anything left in the clue still points at something unknown (a single id that is unknown, or a
// list that ended up empty). A clue for which this is true cannot be saved by editing a list.
export function dropUnknownFromLists(params, isKnown) {
  let broken = false;
  for (const key of SINGLE) if (isSet(params[key]) && counts(params, key) && !isKnown(params[key])) broken = true;
  for (const key of LIST) {
    if (!Array.isArray(params[key])) continue;
    params[key] = params[key].filter((id) => isKnown(id));
    if (params[key].length === 0) broken = true;
  }
  for (const key of ["a", "b", "customClue"]) {
    const nested = params[key];
    if (nested && typeof nested === "object" && counts(params, key)) {
      nested.params = nested.params || {};
      if (dropUnknownFromLists(nested.params, isKnown)) broken = true;
    }
  }
  return broken;
}
