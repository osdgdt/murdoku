import { PLACEMENT_CLUES } from "./clues/placement.js";
import { ROOMS_CLUES } from "./clues/rooms.js";
import { SCENE_CLUES } from "./clues/scene.js";
import { LOGIC_CLUES } from "./clues/logic.js";

// Each clue type declares its label, the shape of its params (for the builder UI),
// and a describe() function for human-readable text. Predicate logic lives in
// solver/predicates/ (kept separate so the solver module has no DOM/UI concerns).
//
// `scope` says who can hold this clue type:
// - "character" (default, omitted): attached to one character's card, describes
//   that character's own position ("È accanto a...").
// - "generic": a puzzle-wide scene fact, not owned by any character
//   (clue.characterId is null) — e.g. "Nessuno si trova in questa stanza."
//
// Every clue — whatever its type — can also be flipped to its negation via
// `clue.negate` (a checkbox in the builder UI, not a param), instead of
// registering a mirror-image type for each one; see describeClue() below and
// buildPredicate() in predicates.js. A few older types are marked
// `legacy: true` (kept working for puzzles that already use them, but never
// offered for NEW clues — see characterClueTypeIds/genericClueTypeIds below)
// for one of two reasons:
// - Predates the unified negate mechanism above: `notAdjacent`, `notInRoom`,
//   `notSameRoomAs`, `direction`, `onlyPersonInRoom`, `aloneWithVictim` each
//   used to be its own mirror-image type; new clues should use the unified
//   form instead (e.g. `adjacent` + negate, or `directionDistance` with an
//   empty distance).
// - Superseded by a later, more general type that fully subsumes it:
//   `eitherAdjacent` (adjacent to one of two fixed targets) by `orClue` (one
//   of two whole sub-clues, of which `eitherAdjacent` is just one special
//   case), and `emptyRoomsCount` (N rooms are empty) by `roomsWithStateCount`
//   (N rooms are empty OR occupied — a strict superset).

export const CLUE_TYPES = { ...PLACEMENT_CLUES, ...ROOMS_CLUES, ...SCENE_CLUES, ...LOGIC_CLUES };

export function characterClueTypeIds() {
  return Object.keys(CLUE_TYPES).filter((id) => CLUE_TYPES[id].scope !== "generic" && !CLUE_TYPES[id].legacy && !CLUE_TYPES[id].internal);
}

export function genericClueTypeIds() {
  return Object.keys(CLUE_TYPES).filter((id) => CLUE_TYPES[id].scope === "generic" && !CLUE_TYPES[id].legacy && !CLUE_TYPES[id].internal);
}

// Turns "È accanto a X." into "Non è accanto a X." — a plain "Non " prefix
// (lowercasing the first letter) reads correctly for the vast majority of
// phrasings, which all open with a verb (È.../Si trova.../Condivide...). The
// few built around a quantifier or a subject ("Nessuno...", "A e B...")
// override this with their own `negatedDescribe` instead, since a blind
// prefix would misplace the negation or double it up ("non nessuno...").
function negateText(text) {
  return text ? "Non " + text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function describeClue(clue, puzzle) {
  const def = CLUE_TYPES[clue.type];
  if (!def) return "Indizio sconosciuto.";
  try {
    if (clue.negate) {
      if (def.negatedDescribe) return def.negatedDescribe(clue.params || {}, puzzle);
      return negateText(def.describe(clue.params || {}, puzzle));
    }
    return def.describe(clue.params || {}, puzzle);
  } catch {
    return "Indizio incompleto.";
  }
}
