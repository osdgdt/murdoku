import { describeNestedClue, upperFirst } from "./shared.js";
import { t } from "../../i18n/i18n.js";

// "A, oppure B" / "A, e inoltre B": the same sentence for the clues of a character and for the general ones.
const orSentence = (params, puzzle) => {
  const descA = upperFirst(describeNestedClue(params.a, puzzle) ?? "?");
  const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
  return t("{descA}, oppure {descB}.", { descA, descB });
};
const notOrSentence = (params, puzzle) => {
  const descA = describeNestedClue(params.a, puzzle) ?? "?";
  const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
  return t("Non è vero che {descA}, oppure {descB}.", { descA, descB });
};
const andSentence = (params, puzzle) => {
  const descA = upperFirst(describeNestedClue(params.a, puzzle) ?? "?");
  const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
  return t("{descA}, e inoltre {descB}.", { descA, descB });
};
const notAndSentence = (params, puzzle) => {
  const descA = describeNestedClue(params.a, puzzle) ?? "?";
  const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
  return t("Non è vero che {descA}, e inoltre {descB}.", { descA, descB });
};

export const LOGIC_CLUES = {
  // "A and B" about one character: the same as two separate clues, but it can be one side of an "or" or be denied as a whole.
  andClue: {
    combinator: true,
    label: t("E l'uno e l'altro (indizio composto)"),
    params: [],
    describe: andSentence,
    negatedDescribe: notAndSentence,
  },
  // The same two combinators over general clues (the sides are general clues, about nobody in particular).
  orGeneral: {
    scope: "generic",
    combinator: true,
    label: t("O uno o l'altro (fatto generale composto)"),
    params: [],
    describe: orSentence,
    negatedDescribe: notOrSentence,
  },
  andGeneral: {
    scope: "generic",
    combinator: true,
    label: t("E l'uno e l'altro (fatto generale composto)"),
    params: [],
    describe: andSentence,
    negatedDescribe: notAndSentence,
  },
  orClue: {
    // A general "A or B" combinator over two whole sub-clues (each its own
    // type + params), instead of a dedicated "eitherX" type for every pair
    // of clue kinds that might need combining — e.g. "was on the rug OR next
    // to the plant" mixes onObjectType with adjacent, which no single fixed
    // pair-type could cover. `params.a`/`params.b` hold the sub-clue specs
    // ({type, params}); clueBuilder.js renders each as a nested mini clue
    // row instead of the normal flat param list (see `combinator: true`).
    combinator: true,
    label: t("O uno o l'altro (indizio composto)"),
    params: [],
    describe: orSentence,
    // "Not (A or B)" is "neither A nor B": a plain "Non ..." in front of the sentence would only
    // deny A, so it is said as a whole.
    negatedDescribe: notOrSentence,
  },
};
