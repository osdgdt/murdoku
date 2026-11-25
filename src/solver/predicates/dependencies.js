// Which characters a clue's verdict depends on.
//
// The search places characters one at a time and, after each placement, asks every clue whether it
// is already violated. A clue whose verdict depends only on a few characters cannot change when a
// DIFFERENT character is placed, so re-asking it is wasted work (with 16 characters and ~60 clues,
// most of the cost of a search step). `dependenciesOf` says which clues can be skipped:
//
//   { all: true }        the verdict can change with ANY placement (or with the board becoming
//                        complete): the clue is always re-checked. This is the safe default for every
//                        type not listed below, so a new clue type is never silently skipped.
//   { ids: Set<id> }     the verdict is a function of the positions of exactly these characters (the
//                        owner and the characters named in the parameters), plus the fixed map.
//
// The table is checked by test/test-dependencies.js: for every type, moving, adding or removing a
// character OUTSIDE `ids` must never change the predicate's result.
//
// Which types are "local": those whose predicate (predicates/placement.js, rooms.js, scene.js) reads
// only the owner's position and the positions of the characters named in its params. The rest scan
// every character (someone in the room, nobody near, how many rooms are empty...) or change meaning
// when the board is complete (alone in the room), so they are "all".
const LOCAL_TYPES = new Set([
  "inRoom",
  "inRoomCorner",
  "inCorner",
  "onSeal",
  "nextToWall",
  "inSea",
  "onShip",
  "inPlaceNamed",
  "inRowOrCol",
  "rowOrColParity",
  "onObjectType",
  "seated",
  "inFrontOfWindow",
  "adjacent",
  "diagonal",
  "facing",
  "rowOrColWith",
  "rowOrColAdjacentTo",
  "directionDistance",
  "between",
  "closerTo",
  "zoneAdjacentTo",
  "sameRoomAs",
  "inRowOrColWithAny",
  "sameRoomSizeAs",
  "sameRoomTogether",
  "sameFloor",
  "floorOrder",
  "onFloor",
]);

const ALL = Object.freeze({ all: true });

// Character ids named anywhere in a params bag (a single id, or a list of ids).
function addNamedCharacters(params, characterIds, into) {
  for (const value of Object.values(params || {})) {
    if (typeof value === "string" && characterIds.has(value)) into.add(value);
    else if (Array.isArray(value)) for (const v of value) if (typeof v === "string" && characterIds.has(v)) into.add(v);
  }
}

// `spec`: a clue, or a nested clue of an orClue ({ type, params }); `ownerId` the clue's owner.
function collect(spec, ownerId, characterIds, into) {
  if (!spec || !LOCAL_TYPES.has(spec.type)) return false;
  if (ownerId) into.add(ownerId);
  addNamedCharacters(spec.params, characterIds, into);
  return true;
}

export function dependenciesOf(clue, puzzle) {
  const characterIds = new Set(puzzle.characters.map((c) => c.id));
  const ids = new Set();
  if (clue.type === "orClue") {
    // An OR depends on both sides; if either side is not local, neither is the OR.
    const a = clue.params?.a;
    const b = clue.params?.b;
    if (!collect(a, clue.characterId, characterIds, ids) || !collect(b, clue.characterId, characterIds, ids)) return ALL;
  } else if (!collect(clue, clue.characterId, characterIds, ids)) {
    return ALL;
  }
  // A clue that names no character at all is not worth reasoning about: always re-check it.
  return ids.size === 0 ? ALL : { ids };
}
