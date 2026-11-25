// Le parole scelte dall'autore per un indizio (`clue.text`): sostituiscono la frase automatica ovunque l'indizio si mostri.
import { createPuzzle, addCharacter, addClue, replaceClue, validatePuzzleShape, duplicateClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { describeClue } from "../src/model/clueTypes.js";
import { MAX_CLUE_TEXT, customClueText } from "../src/model/clueText.js";
import { draftFromClue, newDraft } from "../src/editor/clueDraft.js";
import { exportClueSet, parseClueSet, planImport, applyImport } from "../src/editor/clueSets.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { assert, assertEqual } from "./assert.js";

function scene() {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 4, 4);
  const room = addZone(puzzle.grid, "Sala", "#cfe");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) paintCellZone(puzzle.grid, r, c, room.id);
  placeObject(puzzle.grid, "carpet", 1, 1);
  const anna = addCharacter(puzzle, "Anna", "person1");
  addCharacter(puzzle, "Bors", "person2", true);
  return { puzzle, anna };
}

export const tests = [
  {
    name: "testo dell'indizio: senza parole proprie la frase è quella automatica; con parole proprie vince il testo, anche negato e al passato",
    fn: () => {
      const { puzzle, anna } = scene();
      const clue = addClue(puzzle, anna.id, "onObjectType", { objectTypeId: "carpet" });
      assertEqual(describeClue(clue, puzzle), "Si trova su un tappeto.");
      clue.text = "  Stava sul tappeto.  ";
      assertEqual(describeClue(clue, puzzle), "Stava sul tappeto.");
      clue.negate = true;
      puzzle.tense = "future";
      assertEqual(describeClue(clue, puzzle), "Stava sul tappeto.", "il testo è scritto per intero: niente tempo né negazione automatica");
      assertEqual(describeClue(clue, puzzle, { auto: true }), "Non si troverà su un tappeto.");
      clue.text = "   ";
      assertEqual(describeClue(clue, puzzle), "Non si troverà su un tappeto.", "solo spazi = nessun testo");
    },
  },
  {
    name: "testo dell'indizio: non cambia cosa dice l'indizio per il solver, e un testo lungo è tagliato",
    fn: () => {
      const { puzzle, anna } = scene();
      const clue = addClue(puzzle, anna.id, "onObjectType", { objectTypeId: "carpet" });
      clue.text = "Qualcosa di qualsiasi";
      const at = (row, col) => new Map([[anna.id, { row, col }]]);
      assertEqual(buildPredicate(clue, puzzle)(at(1, 1), true), true);
      assertEqual(buildPredicate(clue, puzzle)(at(0, 0), true), false);
      clue.text = "x".repeat(MAX_CLUE_TEXT + 50);
      assertEqual(customClueText(clue).length, MAX_CLUE_TEXT);
    },
  },
  {
    name: "testo dell'indizio: la modifica nell'editor lo salva e lo toglie, duplicare lo copia, cambiare tipo lo scarta, la validazione lo controlla",
    fn: () => {
      const { puzzle, anna } = scene();
      puzzle.solution = { placements: [] };
      const clue = addClue(puzzle, anna.id, "onObjectType", { objectTypeId: "carpet" });
      const draft = draftFromClue(clue);
      assertEqual(draft.text, "");
      draft.text = "Era sul tappeto.";
      replaceClue(puzzle, clue.id, draft);
      assertEqual(clue.text, "Era sul tappeto.");
      assertEqual(duplicateClue(puzzle, clue.id).text, "Era sul tappeto.");
      assertEqual(newDraft("seated", anna.id, puzzle).text, "");
      draft.text = "";
      replaceClue(puzzle, clue.id, draft);
      assert(!("text" in clue), "senza testo il campo sparisce");
      clue.text = 5;
      assert(validatePuzzleShape(puzzle).errors.length > 0, "un testo che non è una stringa non passa");
      clue.text = "Va bene.";
      assert(!validatePuzzleShape(puzzle).errors.some((e) => /testo/i.test(e)));
    },
  },
  {
    name: "testo dell'indizio: viaggia negli insiemi di indizi esportati e importati",
    fn: () => {
      const { puzzle, anna } = scene();
      const clue = addClue(puzzle, anna.id, "onObjectType", { objectTypeId: "carpet" });
      clue.text = "Si trovava sul tappeto.";
      const parsed = parseClueSet(JSON.parse(JSON.stringify(exportClueSet(puzzle))));
      assert(parsed.ok);
      const { puzzle: other, anna: otherAnna } = scene();
      const { added } = applyImport(other, parsed.set, planImport(other, parsed.set));
      assertEqual(added.length, 1);
      assertEqual(added[0].text, "Si trovava sul tappeto.");
      assertEqual(added[0].characterId, otherAnna.id);
    },
  },
];
