import { describeNestedClue } from "./shared.js";

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
    label: "O uno o l'altro (indizio composto)",
    params: [],
    describe: (params, puzzle) => {
      const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      const descA = describeNestedClue(params.a, puzzle) ?? "?";
      const descB = params.b?.type ? lower(describeNestedClue(params.b, puzzle)) : "?";
      return `${descA}, oppure ${descB}.`;
    },
  },
};
