import { describeNestedClue, upperFirst } from "./shared.js";
import { t } from "../../i18n/i18n.js";

export const LOGIC_CLUES = {
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
    describe: (params, puzzle) => {
      const descA = upperFirst(describeNestedClue(params.a, puzzle) ?? "?");
      const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
      return t("{descA}, oppure {descB}.", { descA, descB });
    },
    // "Not (A or B)" is "neither A nor B": a plain "Non ..." in front of the sentence would only
    // deny A, so it is said as a whole.
    negatedDescribe: (params, puzzle) => {
      const descA = describeNestedClue(params.a, puzzle) ?? "?";
      const descB = params.b?.type ? describeNestedClue(params.b, puzzle) : "?";
      return t("Non è vero che {descA}, oppure {descB}.", { descA, descB });
    },
  },
};
