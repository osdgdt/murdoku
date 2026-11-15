import {
  createPuzzle,
  addCharacter,
  addClue,
  setSolutionPlacement,
  replaceClue,
  duplicateClue,
  moveClue,
  pruneDanglingClueReferences,
} from "../src/model/puzzle.js";
import { addZone, paintCellZone, placeObject, resizeGrid } from "../src/model/grid.js";
import { CLUE_TYPES } from "../src/model/clueTypes.js";
import {
  newDraft,
  missingParams,
  isComplete,
  convertParams,
  targetsAtCell,
  eligibleCells,
  targetChoices,
  hasDuplicateTargets,
  relevantParams,
  typeIdsFor,
} from "../src/editor/clueDraft.js";
import { suggestClues, declaredPlacementMap } from "../src/solver/suggestions.js";
import { buildPredicate } from "../src/solver/predicates/index.js";
import { assert, assertEqual } from "./assert.js";

function scene() {
  const puzzle = createPuzzle("Draft");
  puzzle.grid = resizeGrid(puzzle.grid, 3, 3);
  const zone = addZone(puzzle.grid, "Cucina", "#e08060");
  paintCellZone(puzzle.grid, 0, 0, zone.id);
  paintCellZone(puzzle.grid, 0, 1, zone.id);
  const chair = placeObject(puzzle.grid, "chair", 1, 1);
  const a = addCharacter(puzzle, "Anna", undefined, true);
  const b = addCharacter(puzzle, "Bruno");
  return { puzzle, zone, chair, a, b };
}

export const tests = [
  {
    name: "clueDraft: un indizio con un bersaglio mancante è incompleto e lo dice",
    fn() {
      const { puzzle, b } = scene();
      const draft = newDraft("adjacent", b.id, puzzle);
      // (b is just used as an owner id here)
      assert(!isComplete(draft), "senza bersaglio non è completo");
      assert(missingParams(draft).length === 1, "manca una cosa sola");
      draft.params.targetId = puzzle.characters[0].id;
      assert(isComplete(draft), "col bersaglio è completo");
    },
  },
  {
    name: "clueDraft: i campi irrilevanti della famiglia 'proprietà' non contano",
    fn() {
      const { puzzle, b } = scene();
      const id = Object.keys(CLUE_TYPES).find((k) => CLUE_TYPES[k].params?.some((p) => p.name === "property") && !CLUE_TYPES[k].internal);
      assert(id, "esiste un tipo della famiglia proprietà");
      const draft = newDraft(id, b.id, puzzle);
      draft.params.property = "male";
      assert(!relevantParams(id, draft.params).some((p) => p.name === "targetId"), "nessun bersaglio per 'un uomo'");
      assert(isComplete(draft), "completo senza bersaglio");
      draft.params.property = "adjacentTo";
      assert(!isComplete(draft), "con 'accanto a' serve il bersaglio");
    },
  },
  {
    name: "clueDraft: due bersagli uguali sono segnalati",
    fn() {
      const { puzzle, a, b } = scene();
      const draft = newDraft("closerTo", b.id, puzzle);
      draft.params.targetAId = a.id;
      draft.params.targetBId = a.id;
      assert(hasDuplicateTargets(draft), "A = B");
      draft.params.targetBId = puzzle.grid.zones[0].id;
      assert(!hasDuplicateTargets(draft), "A ≠ B");
    },
  },
  {
    name: "clueDraft: cambiare tipo conserva i parametri compatibili",
    fn() {
      const { puzzle, a, b } = scene();
      const before = { targetId: a.id };
      const next = convertParams("adjacent", before, "diagonal", puzzle);
      assertEqual(next.targetId, a.id, "il bersaglio resta");
      const other = convertParams("adjacent", before, "inRoom", puzzle);
      assert(!("targetId" in other) || other.targetId === undefined, "un parametro che non esiste più non si porta dietro");
      assert(b, "b");
    },
  },
  {
    name: "clueDraft: un tocco sulla plancia dà oggetto e stanza della casella",
    fn() {
      const { puzzle, zone, chair } = scene();
      const both = targetsAtCell(puzzle, 1, 1, ["object", "zone"]);
      assert(
        both.some((x) => x.id === chair.id),
        "la sedia"
      );
      assertEqual(targetsAtCell(puzzle, 0, 0, ["object", "zone"])[0].id, zone.id, "la stanza");
      assertEqual(targetsAtCell(puzzle, 2, 2).length, 0, "casella vuota senza stanza");
      assert(eligibleCells(puzzle, ["zone"]).length === 2, "due caselle della cucina");
    },
  },
  {
    name: "clueDraft: i bersagli sono raggruppati (persone, stanze, oggetti) e senza il proprietario",
    fn() {
      const { puzzle, a, b } = scene();
      const c = targetChoices(puzzle, { kind: "characterOrObject" }, a.id);
      assertEqual(c.people.length, 1, "solo l'altro personaggio");
      assertEqual(c.people[0].id, b.id, "Bruno");
      assertEqual(c.rooms.length, 1, "una stanza");
      assert(c.objects.length >= 1 && c.anyOfType.length >= 1, "oggetti e 'qualsiasi'");
    },
  },
  {
    name: "clueDraft: tipi disponibili per un personaggio e per gli indizi generali",
    fn() {
      assert(typeIdsFor("x").length > typeIdsFor(null).length, "più tipi per i personaggi");
      assert(typeIdsFor(null).length > 0, "ci sono tipi generali");
    },
  },
  {
    name: "suggestClues: ogni indizio suggerito è vero nella soluzione dichiarata",
    fn() {
      const { puzzle, a, b } = scene();
      assertEqual(declaredPlacementMap(puzzle), null, "senza soluzione completa niente mappa");
      setSolutionPlacement(puzzle, a.id, 0, 0);
      setSolutionPlacement(puzzle, b.id, 1, 1);
      const pm = declaredPlacementMap(puzzle);
      assert(pm, "ora c'è");
      const { clues } = suggestClues(puzzle, pm, { ownerId: b.id });
      assert(clues.length > 0, "ci sono suggerimenti");
      for (const c of clues) {
        const clue = { id: "x", characterId: c.characterId, type: c.type, params: c.params, negate: c.negate };
        assert(buildPredicate(clue, puzzle)(pm, true) === true, `falso: ${c.type} ${JSON.stringify(c.params)}`);
      }
    },
  },
  {
    name: "replaceClue / duplicateClue / moveClue: modificano l'indizio giusto e solo quello",
    fn() {
      const { puzzle, a, b } = scene();
      const c1 = addClue(puzzle, b.id, "adjacent", { targetId: a.id });
      const c2 = addClue(puzzle, b.id, "adjacent", { targetId: a.id });
      const other = addClue(puzzle, a.id, "adjacent", { targetId: b.id });
      replaceClue(puzzle, c1.id, { type: "diagonal", params: { targetId: a.id }, negate: true });
      assertEqual(puzzle.clues[0].type, "diagonal", "tipo cambiato");
      assert(puzzle.clues[0].negate === true && puzzle.clues[0].id === c1.id, "negazione e id");
      const copy = duplicateClue(puzzle, c1.id);
      assert(copy.id !== c1.id && puzzle.clues[1].id === copy.id, "copia subito dopo");
      assert(moveClue(puzzle, c2.id, -1), "su");
      assert(!moveClue(puzzle, c2.id, -1) || puzzle.clues.indexOf(c2) >= 0, "c'è sempre");
      // moving never crosses another owner's clues
      const aIndex = puzzle.clues.indexOf(other);
      moveClue(puzzle, c1.id, 1);
      assertEqual(puzzle.clues.indexOf(other), aIndex, "l'indizio di un altro non si muove");
    },
  },
  {
    name: "pruneDanglingClueReferences: un bersaglio non ancora scelto non cancella l'indizio",
    fn() {
      const { puzzle, b } = scene();
      addClue(puzzle, b.id, "adjacent", { targetId: "" });
      pruneDanglingClueReferences(puzzle);
      assertEqual(puzzle.clues.length, 1, "resta (incompleto)");
      puzzle.clues[0].params.targetId = "char-che-non-esiste";
      pruneDanglingClueReferences(puzzle);
      assertEqual(puzzle.clues.length, 0, "un riferimento a qualcosa che non c'è più sparisce");
    },
  },
];
