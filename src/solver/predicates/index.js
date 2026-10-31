import { builders as placement } from "./placement.js";
import { builders as rooms } from "./rooms.js";
import { builders as scene } from "./scene.js";
import { builders as logic } from "./logic.js";
import { posOfCharacter, zoneAt, victimId } from "./helpers.js";

export { resolveTargetPositions, victimId } from "./helpers.js";

// type -> builder. Adding a clue type means adding one entry to the family
// module it belongs to; nothing here needs to change.
const BUILDERS = { ...placement, ...rooms, ...scene, ...logic };

function buildPositivePredicate(clue, puzzle) {
  const build = BUILDERS[clue.type];
  if (!build) return () => undefined;
  return build({ clue, puzzle, ownerId: clue.characterId, params: clue.params || {} });
}

// Wraps any clue type's predicate with its negation when clue.negate is set,
// instead of every "not X" needing its own registered type — sound because
// `undefined` (not yet decidable) stays `undefined` either way; only an
// already-settled true/false gets flipped.
export function buildPredicate(clue, puzzle) {
  const positive = buildPositivePredicate(clue, puzzle);
  if (!clue.negate) return positive;
  return (pm, isComplete) => {
    const result = positive(pm, isComplete);
    return result === undefined ? undefined : !result;
  };
}

// Base rule of Murdoku, always on — not a user-addable/removable clue (see
// CLUE_TYPES.victimRoomRule in clueTypes.js, kept `internal: true` purely so
// this has a describe() for validateSolution's violation messages): the
// victim must end up in a room together with EXACTLY one other character —
// that person is the murderer. Companions can only accumulate as more
// characters get placed, never un-accumulate, so ">1 already" is a sound
// prune at any point; "==1" only becomes final once nobody is left unplaced.
function victimRoomRulePredicate(puzzle) {
  return (pm, isComplete) => {
    const vId = victimId(puzzle);
    if (!vId) return undefined;
    const v = posOfCharacter(pm, vId);
    if (!v) return undefined;
    const zv = zoneAt(puzzle, v);
    if (zv === null) return false; // the victim must be inside an actual room
    let companions = 0;
    for (const c of puzzle.characters) {
      if (c.id === vId) continue;
      const pos = posOfCharacter(pm, c.id);
      if (pos && zoneAt(puzzle, pos) === zv) companions++;
    }
    if (companions > 1) return false;
    if (!isComplete) return undefined;
    return companions === 1;
  };
}

export function buildPredicates(puzzle) {
  const clueChecks = puzzle.clues.map((clue) => ({ clue, predicate: buildPredicate(clue, puzzle) }));
  const baseRuleClue = { id: null, type: "victimRoomRule", characterId: null, params: {}, negate: false };
  return [...clueChecks, { clue: baseRuleClue, predicate: victimRoomRulePredicate(puzzle) }];
}
