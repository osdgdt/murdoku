// The tutorial page's worked case (src/tutorial/tutorialCase.js): it must be a
// real, uniquely solvable case that follows the house rules, and the deduction
// narrated by the page (derived with the game's own predicates) must be the one
// the text tells: Carla is forced first, then Bruno, then Anna; the victim takes
// the last cell; the murderer is whoever shares the victim's room.
import { validatePuzzleShape } from "../src/model/puzzle.js";
import { checkUniqueness, validateSolution } from "../src/solver/validator.js";
import { buildTutorialCase, deriveSteps, cluePossibleCells } from "../src/tutorial/tutorialCase.js";
import { assert, assertEqual } from "./assert.js";

export const tests = [
  {
    name: "tutorial: il caso d'esempio è ben formato, ha soluzione unica e la soluzione dichiarata rispetta le regole",
    fn: () => {
      const { puzzle } = buildTutorialCase();
      const shape = validatePuzzleShape(puzzle);
      assert(shape.valid, shape.errors.join("; "));
      const report = checkUniqueness(puzzle, { maxSolutions: 3, forwardCheck: true });
      assertEqual(report.solutionCount, 1, "soluzioni trovate");
      assert(validateSolution(puzzle).valid, "la soluzione dichiarata deve rispettare tutti gli indizi");
    },
  },
  {
    name: "tutorial: regole della casa (griglia N×N con N personaggi, nomi in ordine, vittima con la V e senza indizi)",
    fn: () => {
      const { puzzle, suspects, characters } = buildTutorialCase();
      assertEqual(puzzle.grid.size.rows, puzzle.characters.length, "N×N con N personaggi");
      assertEqual(puzzle.grid.size.cols, puzzle.characters.length);
      const names = suspects.map((s) => s.name);
      assertEqual(JSON.stringify(names), JSON.stringify([...names].sort()), "sospettati in ordine alfabetico");
      assert(characters.victim.name.startsWith("V"), "il nome della vittima inizia con la V");
      assert(!puzzle.clues.some((c) => c.characterId === characters.victim.id), "nessun indizio sulla vittima");
    },
  },
  {
    name: "tutorial: i passi raccontati dalla pagina sono quelli veri (Carla, poi Bruno, poi Anna, poi la vittima; l'assassina è Carla)",
    fn: () => {
      const built = buildTutorialCase();
      const steps = deriveSteps(built);
      assertEqual(steps.map((s) => s.kind).join(","), "clues,place,place,place,victim,killer");
      assertEqual(
        steps
          .slice(1, 4)
          .map((s) => s.character.name)
          .join(","),
        "Carla,Bruno,Anna"
      );
      // Carla starts with one cell, Bruno with two, Anna with three — the page says so.
      const sizes = built.suspects.map((s) => cluePossibleCells(built, s).length);
      assertEqual(sizes.join(","), "3,2,1");
      // after Carla's row and column are crossed out, Bruno and Anna each lose cells but keep exactly one
      assertEqual(steps[2].options.length, 1, "Bruno ha una sola casella dopo la X di Carla");
      assertEqual(steps[3].options.length, 1, "Anna ha una sola casella dopo le X di Carla e Bruno");
      assertEqual(steps[5].character.name, "Carla", "l'assassina");
      // the board of the last step has no empty row or column left
      const cells = [...steps[5].placed.values()];
      assertEqual(new Set(cells.map((c) => c.row)).size, 4);
      assertEqual(new Set(cells.map((c) => c.col)).size, 4);
    },
  },
];
