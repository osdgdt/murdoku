// Il cavallo («in sella a»), gli altri animali e oggetti all'aperto, il bersaglio «un animale» e l'indizio generale
// «c'è almeno una persona accanto a ciascun tipo di oggetto» (everyObjectTypeNear).
import { createPuzzle, addCharacter, addClue } from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid, isOccupiable } from "../src/model/grid.js";
import {
  OBJECT_TYPES,
  objectTypeTargetId,
  objectCategoryTargetId,
  isObjectTypeTarget,
  isObjectCategoryTarget,
  objectTypeIdsOf,
  isObjectTypeOccupiable,
  isObjectTypeMount,
} from "../src/model/icons.js";
import { CLUE_TYPES, describeClue } from "../src/model/clueTypes.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { resolveTargetPositions } from "../src/solver/predicates/helpers.js";
import { enumerateParams } from "../src/solver/suggestions.js";
import { targetChoices } from "../src/editor/clueDraft.js";
import { assert, assertEqual } from "./assert.js";

// 5×5 in una sola stanza: un cavallo (0,0), una mucca (2,2), una tigre (4,4), un albero (0,4)
function scene() {
  const puzzle = createPuzzle("Prova");
  puzzle.grid = resizeGrid(puzzle.grid, 5, 5);
  const room = addZone(puzzle.grid, "Prato", "#cfe");
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) paintCellZone(puzzle.grid, r, c, room.id);
  placeObject(puzzle.grid, "horse", 0, 0);
  placeObject(puzzle.grid, "cow", 2, 2);
  placeObject(puzzle.grid, "tiger", 4, 4);
  placeObject(puzzle.grid, "tree", 0, 4);
  const people = ["A", "B", "C", "D"].map((n, i) => addCharacter(puzzle, n, "person1", i === 3));
  return { puzzle, people };
}
const at = (entries) => new Map(entries.map(([c, row, col]) => [c.id, { row, col }]));

export const tests = [
  {
    name: "natura: il cavallo e la pozza di fango si occupano (il cavallo è una cavalcatura), gli altri animali ingombrano",
    fn: () => {
      assert(isObjectTypeOccupiable("horse") && isObjectTypeOccupiable("mud"));
      assert(isObjectTypeMount("horse") && !isObjectTypeMount("mud") && !isObjectTypeMount("chair"));
      for (const id of ["boar", "cow", "tiger", "tree", "vase", "fire", "bones"])
        assert(!isObjectTypeOccupiable(id), `${id} ingombra la casella`);
      assertEqual(objectTypeIdsOf(objectCategoryTargetId("animal")).sort().join(), "boar,cow,horse,pig,shark,tiger");
      assert(isObjectTypeTarget(objectCategoryTargetId("animal")) && isObjectCategoryTarget(objectCategoryTargetId("animal")));
      assert(!isObjectCategoryTarget(objectTypeTargetId("horse")));
      assertEqual(objectTypeIdsOf(objectTypeTargetId("chair")).join(), "chair");
      for (const id of ["horse", "mud", "boar", "cow", "tiger", "tree", "vase", "fire", "bones"])
        assert(OBJECT_TYPES[id].group === "nature", id);
    },
  },
  {
    name: "natura: «in sella a un cavallo» (non «si trova su»), e su una pozza di fango resta «si trova su»",
    fn: () => {
      const { puzzle, people } = scene();
      const horse = addClue(puzzle, people[0].id, "onObjectType", { objectTypeId: "horse" });
      assertEqual(describeClue(horse, puzzle), "È in sella a un cavallo.");
      horse.negate = true;
      assertEqual(describeClue(horse, puzzle), "Non è in sella a un cavallo.");
      const mud = addClue(puzzle, people[0].id, "onObjectType", { objectTypeId: "mud" });
      assertEqual(describeClue(mud, puzzle), "Si trova su una pozza di fango.");
    },
  },
  {
    name: "natura: stare in sella al cavallo vale solo sulla sua casella",
    fn: () => {
      const { puzzle, people } = scene();
      const clue = addClue(puzzle, people[0].id, "onObjectType", { objectTypeId: "horse" });
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(at([[people[0], 0, 0]]), false), true);
      assertEqual(predicate(at([[people[0], 1, 0]]), false), false);
      assert(isOccupiable(puzzle.grid, 0, 0), "il cavallo si può occupare");
      assert(!isOccupiable(puzzle.grid, 2, 2), "la mucca no");
    },
  },
  {
    name: "natura: «accanto a un animale» vale accanto a qualunque animale della mappa, e non accanto all'albero",
    fn: () => {
      const { puzzle, people } = scene();
      const target = objectCategoryTargetId("animal");
      assertEqual(resolveTargetPositions(new Map(), puzzle, target).length, 3, "cavallo, mucca, tigre");
      const clue = addClue(puzzle, people[0].id, "adjacent", { targetId: target });
      assertEqual(describeClue(clue, puzzle), "È accanto a un animale.");
      const predicate = buildPredicate(clue, puzzle);
      assertEqual(predicate(at([[people[0], 2, 3]]), false), true, "accanto alla mucca");
      assertEqual(predicate(at([[people[0], 1, 4]]), false), false, "accanto all'albero (e non a un animale)");
      assertEqual(predicate(at([[people[0], 3, 4]]), false), true, "accanto alla tigre");
    },
  },
  {
    name: "natura: «un animale» compare tra i bersagli dell'editor e del generatore solo se la mappa ha animali",
    fn: () => {
      const { puzzle, people } = scene();
      const def = CLUE_TYPES.adjacent;
      const choices = targetChoices(puzzle, def.params[0], people[0].id);
      assert(
        choices.anyOfType.some((c) => c.id === objectCategoryTargetId("animal")),
        "anyOfType"
      );
      assert(
        enumerateParams(def, puzzle, people[0].id).some((p) => p.targetId === objectCategoryTargetId("animal")),
        "generatore"
      );
      const empty = createPuzzle("Vuoto");
      empty.grid = resizeGrid(empty.grid, 5, 5);
      placeObject(empty.grid, "tree", 0, 0);
      const who = addCharacter(empty, "X", "person1", false);
      assert(!targetChoices(empty, def.params[0], who.id).anyOfType.some((c) => isObjectCategoryTarget(c.id)), "senza animali");
    },
  },
  {
    name: "everyObjectTypeNear: serve una persona accanto a ciascun tipo (porte e finestre escluse); mai falso a metà",
    fn: () => {
      const { puzzle, people } = scene();
      placeObject(puzzle.grid, "door", 1, 1, "E");
      const clue = addClue(puzzle, null, "everyObjectTypeNear", {});
      const predicate = buildPredicate(clue, puzzle);
      const [a, b, c, d] = people;
      assertEqual(predicate(at([[a, 1, 0]]), false), undefined, "a metà non si decide");
      // cavallo (0,0)←(1,0); mucca (2,2)←(2,1); tigre (4,4)←(3,4); albero (0,4)←(1,4)
      assertEqual(
        predicate(
          at([
            [a, 1, 0],
            [b, 2, 1],
            [c, 3, 4],
            [d, 1, 4],
          ]),
          true
        ),
        true
      );
      // nessuno accanto all'albero
      assertEqual(
        predicate(
          at([
            [a, 1, 0],
            [b, 2, 1],
            [c, 3, 4],
            [d, 4, 0],
          ]),
          true
        ),
        false
      );
      assertEqual(describeClue(clue, puzzle), "C'è almeno una persona accanto a ciascun tipo di oggetto.");
      clue.negate = true;
      assertEqual(describeClue(clue, puzzle), "C'è un tipo di oggetto senza nessuno accanto.");
    },
  },
];
