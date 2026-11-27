// Combinators that wrap other clues.
// Each builder: ({ clue, puzzle, ownerId, params }) -> predicate (pm, isComplete) -> true|false|undefined.
import { buildPredicate } from "./index.js";

// "A and B": false as soon as either side is known-false, undefined while one is undecided and none is false, true when both hold.
function andBuilder({ puzzle, ownerId, params }) {
  return (pm, isComplete) => {
    const subA = { characterId: ownerId, type: params.a?.type, params: params.a?.params || {}, negate: params.a?.negate };
    const subB = { characterId: ownerId, type: params.b?.type, params: params.b?.params || {}, negate: params.b?.negate };
    const resA = buildPredicate(subA, puzzle)(pm, isComplete);
    const resB = buildPredicate(subB, puzzle)(pm, isComplete);
    if (resA === false || resB === false) return false;
    if (resA === undefined || resB === undefined) return undefined;
    return true;
  };
}

export const builders = {
  andClue: andBuilder,
  andGeneral: andBuilder,
  orGeneral: (args) => builders.orClue(args),
  orClue: ({ clue, puzzle, ownerId, params }) => {
    // Sound three-way OR over two whole sub-clues (see clueTypes.js): true
    // as soon as either side is already known-true, undefined only while
    // BOTH sides are still undecided, false only once both are settled and
    // neither holds. Reuses buildPredicate() (not just the positive half)
    // so a sub-clause can itself be negated.
    return (pm, isComplete) => {
      const subA = { characterId: ownerId, type: params.a?.type, params: params.a?.params || {}, negate: params.a?.negate };
      const subB = { characterId: ownerId, type: params.b?.type, params: params.b?.params || {}, negate: params.b?.negate };
      const resA = buildPredicate(subA, puzzle)(pm, isComplete);
      const resB = buildPredicate(subB, puzzle)(pm, isComplete);
      if (resA === true || resB === true) return true;
      if (resA === undefined || resB === undefined) return undefined;
      return false;
    };
  },
};
